[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_-]+$')]
    [string]$DatabaseName,

    [Parameter(Mandatory = $true)]
    [string]$RecipientFile,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [string]$WranglerConfig,

    [Parameter(Mandatory = $true)]
    [string]$AgeCommand,

    [switch]$AcceptUnencryptedTemporaryFiles,

    [switch]$ExecuteRemoteExport
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
        throw 'Temporary directory cleanup stopped because the directory is missing or is not a directory.'
    }

    $directoryItem = Get-Item -LiteralPath $Directory -Force
    if (($directoryItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Temporary directory cleanup stopped because the directory is a reparse point.'
    }

    $expectedPathSet = @{}
    foreach ($expectedFile in $ExpectedFiles) {
        $expectedPathSet[(Get-NormalizedPath $expectedFile)] = $true
    }

    foreach ($entry in @(Get-ChildItem -LiteralPath $Directory -Force)) {
        if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Temporary directory cleanup stopped because it contains a reparse point.'
        }
        if ($entry.PSIsContainer) {
            throw 'Temporary directory cleanup stopped because it contains an unexpected directory.'
        }
        if (-not $expectedPathSet.ContainsKey((Get-NormalizedPath $entry.FullName))) {
            throw 'Temporary directory cleanup stopped because it contains an unexpected file.'
        }
    }
}

$projectRoot = Get-NormalizedPath (Join-Path $PSScriptRoot '..')
$outputRoot = Get-NormalizedPath $OutputDirectory
$configInput = if ([string]::IsNullOrWhiteSpace($WranglerConfig)) {
    Join-Path $PSScriptRoot '..\wrangler.jsonc'
} else {
    $WranglerConfig
}
$configPath = Get-NormalizedPath $configInput
$recipientPath = Get-NormalizedPath $RecipientFile

if (Test-PathWithin -Candidate $outputRoot -Parent $projectRoot) {
    throw 'The backup output directory must be outside the Git project.'
}
Assert-DriveLetterPath -Path $outputRoot -DriveLetter 'D:' -Label 'The backup output directory'
Assert-DriveLetterPath -Path $recipientPath -DriveLetter 'D:' -Label 'The public recipient file'
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Wrangler config was not found: $configPath"
}

$configText = Get-Content -LiteralPath $configPath -Raw
$databaseMatch = [regex]::Match($configText, '"database_name"\s*:\s*"([^"]+)"')
if (-not $databaseMatch.Success) {
    throw 'Wrangler config does not contain a database_name.'
}
if (-not $DatabaseName.Equals($databaseMatch.Groups[1].Value, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'DatabaseName does not match the D1 database in Wrangler config.'
}

$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$fileStem = '{0}-{1}-{2}' -f $DatabaseName, $timestamp, ([Guid]::NewGuid().ToString('N').Substring(0, 8))
$encryptedPath = Join-Path $outputRoot ($fileStem + '.sql.age')

if (-not $ExecuteRemoteExport) {
    [pscustomobject]@{
        Mode = 'PlanOnly'
        Database = $DatabaseName
        RemoteAction = 'wrangler d1 export --remote'
        Encryption = 'age recipient file'
        EncryptedOutput = $encryptedPath
        PlaintextPolicy = 'Create only in the dedicated temporary directory and remove in finally'
        ExecutionAcknowledgement = '-AcceptUnencryptedTemporaryFiles is required for remote export'
        SecureErasureGuaranteed = $false
        DrivePolicy = 'Manually upload only the encrypted .age file'
    }
    return
}

if (-not $AcceptUnencryptedTemporaryFiles) {
    throw 'Remote export requires -AcceptUnencryptedTemporaryFiles because the temporary SQL is created on unencrypted storage.'
}

if (-not (Test-Path -LiteralPath $recipientPath -PathType Leaf)) {
    throw "age recipient file was not found: $recipientPath"
}
if (Select-String -LiteralPath $recipientPath -Pattern 'AGE-SECRET-KEY-' -Quiet) {
    throw 'The recipient file contains an age secret key. Use a public recipient file only.'
}
$recipient = (Get-Content -LiteralPath $recipientPath -Raw).Trim()
if ($recipient -notmatch '^age1[0-9a-z]+$') {
    throw 'The recipient file does not contain exactly one public age recipient.'
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
if (Test-Path -LiteralPath $encryptedPath) {
    throw "An encrypted backup with the same name already exists: $encryptedPath"
}

$workDirectory = Join-Path $outputRoot ('.d1-backup-' + [Guid]::NewGuid().ToString('N'))
$plainSqlPath = Join-Path $workDirectory ($fileStem + '.sql')
$partialEncryptedPath = Join-Path $workDirectory ($fileStem + '.sql.age.partial')
$completed = $false

try {
    New-Item -ItemType Directory -Path $workDirectory | Out-Null

    $npxCommand = Get-ExternalCommand 'npx'
    $ageExecutable = Get-ExternalCommand $AgeCommand

    Invoke-ExternalCommand -Command $npxCommand -Label 'D1 remote export' -Arguments @(
        'wrangler', 'd1', 'export', $DatabaseName,
        '--remote', "--output=$plainSqlPath", '--config', $configPath
    )

    if (-not (Test-Path -LiteralPath $plainSqlPath -PathType Leaf) -or
        (Get-Item -LiteralPath $plainSqlPath).Length -eq 0) {
        throw 'The D1 export result is missing or empty.'
    }

    Invoke-ExternalCommand -Command $ageExecutable -Label 'age encryption' -Arguments @(
        '-R', $recipientPath, '-o', $partialEncryptedPath, $plainSqlPath
    )

    if (-not (Test-Path -LiteralPath $partialEncryptedPath -PathType Leaf) -or
        (Get-Item -LiteralPath $partialEncryptedPath).Length -eq 0) {
        throw 'The age encryption result is missing or empty.'
    }
    if ((Get-Content -LiteralPath $partialEncryptedPath -Encoding ASCII -TotalCount 1) -ne 'age-encryption.org/v1') {
        throw 'The age encryption result does not have an age header.'
    }

    Move-Item -LiteralPath $partialEncryptedPath -Destination $encryptedPath
    $completed = $true

    $encryptedFile = Get-Item -LiteralPath $encryptedPath
    $encryptedHash = Get-FileHash -LiteralPath $encryptedPath -Algorithm SHA256

    [pscustomobject]@{
        Mode = 'Executed'
        Database = $DatabaseName
        EncryptedOutput = $encryptedFile.FullName
        EncryptedBytes = $encryptedFile.Length
        Sha256 = $encryptedHash.Hash
        PlaintextFileDeleted = $true
        SecureErasureGuaranteed = $false
        NextAction = 'Manually upload only the encrypted .age file to the private Drive folder'
    }
}
finally {
    if (Test-Path -LiteralPath $workDirectory) {
        $workParent = Get-NormalizedPath (Split-Path -Parent $workDirectory)
        $workLeaf = Split-Path -Leaf $workDirectory
        if (-not $workParent.Equals($outputRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
            -not $workLeaf.StartsWith('.d1-backup-', [System.StringComparison]::Ordinal)) {
            throw 'Temporary directory cleanup stopped because the safety boundary did not match.'
        }
        Assert-SafeCleanupDirectory -Directory $workDirectory -ExpectedFiles @(
            $plainSqlPath,
            $partialEncryptedPath
        )
        Remove-Item -LiteralPath $workDirectory -Recurse -Force
    }

    if (-not $completed -and (Test-Path -LiteralPath $encryptedPath)) {
        Remove-Item -LiteralPath $encryptedPath -Force
    }
}
