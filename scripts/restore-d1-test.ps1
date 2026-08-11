[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$EncryptedBackupPath,

    [Parameter(Mandatory = $true)]
    [string]$IdentityFile,

    [Parameter(Mandatory = $true)]
    [string]$WorkDirectory,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_-]+$')]
    [string]$TestDatabaseName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_-]+$')]
    [string]$ProductionDatabaseName,

    [string]$WranglerConfig,

    [Parameter(Mandatory = $true)]
    [string]$AgeCommand,

    [switch]$AcceptUnencryptedTemporaryFiles,

    [switch]$ExecuteTestRestore,

    [switch]$ConfirmTestDatabaseRestore,

    [switch]$ConfirmEmptyTestDatabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NormalizedPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath(
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
    )
}

function Test-PathWithin {
    param(
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Parent
    )

    $normalizedCandidate = (Get-NormalizedPath $Candidate).TrimEnd('\', '/')
    $normalizedParent = (Get-NormalizedPath $Parent).TrimEnd('\', '/')
    $prefix = $normalizedParent + [System.IO.Path]::DirectorySeparatorChar

    return $normalizedCandidate.Equals($normalizedParent, [System.StringComparison]::OrdinalIgnoreCase) -or
        $normalizedCandidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-DriveLetterPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$DriveLetter,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $root = [System.IO.Path]::GetPathRoot((Get-NormalizedPath $Path))
    if (-not $root.Equals(
        ($DriveLetter.TrimEnd(':') + ':\'),
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "$Label must remain on the approved $DriveLetter drive."
    }
}

function Get-ExternalCommand {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command -Name $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) {
        throw "Required command was not found: $Name"
    }

    return $command
}

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Label
    )

    & $Command.Source @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

function Assert-SafeCleanupDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][string[]]$ExpectedFiles
    )

    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        throw 'Restore directory cleanup stopped because the directory is missing or is not a directory.'
    }

    $directoryItem = Get-Item -LiteralPath $Directory -Force
    if (($directoryItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Restore directory cleanup stopped because the directory is a reparse point.'
    }

    $expectedPathSet = @{}
    foreach ($expectedFile in $ExpectedFiles) {
        $expectedPathSet[(Get-NormalizedPath $expectedFile)] = $true
    }

    foreach ($entry in @(Get-ChildItem -LiteralPath $Directory -Force)) {
        if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Restore directory cleanup stopped because it contains a reparse point.'
        }
        if ($entry.PSIsContainer) {
            throw 'Restore directory cleanup stopped because it contains an unexpected directory.'
        }
        if (-not $expectedPathSet.ContainsKey((Get-NormalizedPath $entry.FullName))) {
            throw 'Restore directory cleanup stopped because it contains an unexpected file.'
        }
    }
}

$configInput = if ([string]::IsNullOrWhiteSpace($WranglerConfig)) {
    Join-Path $PSScriptRoot '..\wrangler.jsonc'
} else {
    $WranglerConfig
}
$configPath = Get-NormalizedPath $configInput
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Wrangler config was not found: $configPath"
}

$configText = Get-Content -LiteralPath $configPath -Raw
$databaseMatch = [regex]::Match($configText, '"database_name"\s*:\s*"([^"]+)"')
if (-not $databaseMatch.Success) {
    throw 'Wrangler config does not contain a database_name.'
}
if (-not $ProductionDatabaseName.Equals($databaseMatch.Groups[1].Value, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'ProductionDatabaseName does not match the D1 database in Wrangler config.'
}
if ($TestDatabaseName.Equals($ProductionDatabaseName, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'The test D1 name matches the production D1 name. Production restore is forbidden.'
}
if ($TestDatabaseName -notmatch '(?i)(test|restore|qa)') {
    throw 'The test D1 name must include test, restore, or qa.'
}
if ($ExecuteTestRestore -and (-not $ConfirmTestDatabaseRestore -or -not $ConfirmEmptyTestDatabase)) {
    throw 'Remote restore requires -ExecuteTestRestore, -ConfirmTestDatabaseRestore, and -ConfirmEmptyTestDatabase.'
}
if (-not $ExecuteTestRestore -and ($ConfirmTestDatabaseRestore -or $ConfirmEmptyTestDatabase)) {
    throw 'Restore confirmation switches require -ExecuteTestRestore.'
}

$projectRoot = Get-NormalizedPath (Join-Path $PSScriptRoot '..')
$workRoot = Get-NormalizedPath $WorkDirectory
$backupPath = Get-NormalizedPath $EncryptedBackupPath
$identityPath = Get-NormalizedPath $IdentityFile

if (Test-PathWithin -Candidate $workRoot -Parent $projectRoot) {
    throw 'The restore work directory must be outside the Git project.'
}
Assert-DriveLetterPath -Path $workRoot -DriveLetter 'D:' -Label 'The restore work directory'
Assert-DriveLetterPath -Path $backupPath -DriveLetter 'D:' -Label 'The encrypted backup file'
Assert-DriveLetterPath -Path $identityPath -DriveLetter 'E:' -Label 'The encrypted identity file'

if (-not $ExecuteTestRestore) {
    [pscustomobject]@{
        Mode = 'PlanOnly'
        EncryptedBackup = $backupPath
        TestDatabase = $TestDatabaseName
        ProductionDatabase = $ProductionDatabaseName
        RemoteAction = 'wrangler d1 execute --remote --file=<decrypted-sql>'
        Safety = 'Use an empty test D1 only, reject production name, remove plaintext in finally'
        ExecutionAcknowledgement = '-AcceptUnencryptedTemporaryFiles, -ConfirmTestDatabaseRestore, and -ConfirmEmptyTestDatabase are required for remote restore'
        SecureErasureGuaranteed = $false
    }
    return
}

if (-not $AcceptUnencryptedTemporaryFiles) {
    throw 'Remote restore requires -AcceptUnencryptedTemporaryFiles because the temporary SQL is created on unencrypted storage.'
}

if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
    throw "Encrypted backup was not found: $backupPath"
}
if (-not $backupPath.EndsWith('.sql.age', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Restore input must be an encrypted .sql.age file.'
}
if (-not (Test-Path -LiteralPath $identityPath -PathType Leaf)) {
    throw "age identity file was not found: $identityPath"
}
if (-not $identityPath.EndsWith('.age', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'age identity file must be an encrypted .age file.'
}
if ((Get-Content -LiteralPath $backupPath -TotalCount 1) -ne 'age-encryption.org/v1') {
    throw 'The backup file is not an age-encrypted file.'
}
if ((Get-Content -LiteralPath $identityPath -TotalCount 1) -ne 'age-encryption.org/v1') {
    throw 'The identity file is not the approved passphrase-encrypted age identity.'
}
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
$restoreDirectory = Join-Path $workRoot ('.d1-restore-' + [Guid]::NewGuid().ToString('N'))
$plainSqlPath = Join-Path $restoreDirectory 'restore.sql'

try {
    New-Item -ItemType Directory -Path $restoreDirectory | Out-Null

    $ageExecutable = Get-ExternalCommand $AgeCommand
    $npxCommand = Get-ExternalCommand 'npx'

    Invoke-ExternalCommand -Command $ageExecutable -Label 'age decryption' -Arguments @(
        '-d', '-i', $identityPath, '-o', $plainSqlPath, $backupPath
    )

    if (-not (Test-Path -LiteralPath $plainSqlPath -PathType Leaf) -or
        (Get-Item -LiteralPath $plainSqlPath).Length -eq 0) {
        throw 'The decrypted SQL file is missing or empty.'
    }

    Invoke-ExternalCommand -Command $npxCommand -Label 'test D1 restore' -Arguments @(
        'wrangler', 'd1', 'execute', $TestDatabaseName,
        '--remote', "--file=$plainSqlPath", '--config', $configPath
    )

    [pscustomobject]@{
        Mode = 'Executed'
        TestDatabase = $TestDatabaseName
        ProductionDatabaseUntouched = $true
        PlaintextFileDeleted = $true
        SecureErasureGuaranteed = $false
        NextAction = 'Compare core table row counts and sample data with read-only queries'
    }
}
finally {
    if (Test-Path -LiteralPath $restoreDirectory) {
        $restoreParent = Get-NormalizedPath (Split-Path -Parent $restoreDirectory)
        $restoreLeaf = Split-Path -Leaf $restoreDirectory
        if (-not $restoreParent.Equals($workRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
            -not $restoreLeaf.StartsWith('.d1-restore-', [System.StringComparison]::Ordinal)) {
            throw 'Restore directory cleanup stopped because the safety boundary did not match.'
        }
        Assert-SafeCleanupDirectory -Directory $restoreDirectory -ExpectedFiles @($plainSqlPath)
        Remove-Item -LiteralPath $restoreDirectory -Recurse -Force
    }
}
