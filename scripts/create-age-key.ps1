[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z]:\\?$')]
    [string]$ExternalDriveRoot,

    [Parameter(Mandatory = $true)]
    [string]$AgeDirectory,

    [string]$RecipientFile = 'D:\TravelGuideRecovery\recipients.txt'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NormalizedPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath(
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
    )
}

$driveRoot = Get-NormalizedPath $ExternalDriveRoot
if (-not ([System.IO.Path]::GetPathRoot($driveRoot)).Equals(
    'E:\',
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    throw 'The recovery identity must remain on the approved E: drive.'
}
$driveLetter = $driveRoot.Substring(0, 1)
$partition = Get-Partition -DriveLetter $driveLetter -ErrorAction Stop
$disk = $partition | Get-Disk
if ($disk.BusType -ne 'USB' -or $disk.IsBoot -or $disk.IsSystem) {
    throw 'The selected drive is not a non-system USB drive.'
}

$ageRoot = Get-NormalizedPath $AgeDirectory
$ageExecutable = Join-Path $ageRoot 'age.exe'
$keygenExecutable = Join-Path $ageRoot 'age-keygen.exe'
if (-not (Test-Path -LiteralPath $ageExecutable -PathType Leaf) -or
    -not (Test-Path -LiteralPath $keygenExecutable -PathType Leaf)) {
    throw 'The age executables were not found in the approved installation directory.'
}

$recoveryDirectory = Join-Path $driveRoot 'TravelGuideRecovery'
$identityPath = Join-Path $recoveryDirectory 'key.age'
$recipientPath = Get-NormalizedPath $RecipientFile
if (-not ([System.IO.Path]::GetPathRoot($recipientPath)).Equals(
    'D:\',
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    throw 'The public recipient file must remain on the approved D: drive.'
}
if (Test-Path -LiteralPath $identityPath) {
    throw 'The encrypted identity already exists. Refusing to overwrite it.'
}
if (Test-Path -LiteralPath $recipientPath) {
    throw 'The public recipient file already exists. Refusing to overwrite it.'
}

New-Item -ItemType Directory -Path $recoveryDirectory -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $recipientPath) -Force | Out-Null

$completed = $false
$identityLines = $null
$identityText = $null
try {
    $identityLines = & $keygenExecutable
    if ($LASTEXITCODE -ne 0) {
        throw "age-keygen failed with exit code $LASTEXITCODE"
    }

    $publicLine = $identityLines | Where-Object { $_ -match '^# public key: (age1[0-9a-z]+)$' } | Select-Object -First 1
    if (-not $publicLine) {
        throw 'The public recipient was not present in the generated identity.'
    }
    $publicRecipient = ([regex]::Match($publicLine, '^# public key: (age1[0-9a-z]+)$')).Groups[1].Value

    $identityText = ($identityLines -join [Environment]::NewLine) + [Environment]::NewLine
    $identityText | & $ageExecutable -p -o $identityPath
    if ($LASTEXITCODE -ne 0) {
        throw "age passphrase encryption failed with exit code $LASTEXITCODE"
    }
    if (-not (Test-Path -LiteralPath $identityPath -PathType Leaf) -or
        (Get-Item -LiteralPath $identityPath).Length -eq 0) {
        throw 'The encrypted identity file is missing or empty.'
    }
    if (Select-String -LiteralPath $identityPath -Pattern 'AGE-SECRET-KEY-' -Quiet) {
        throw 'The encrypted identity file unexpectedly contains a plaintext secret key.'
    }
    if ((Get-Content -LiteralPath $identityPath -Encoding ASCII -TotalCount 1) -ne 'age-encryption.org/v1') {
        throw 'The encrypted identity file does not have an age header.'
    }

    Set-Content -LiteralPath $recipientPath -Value $publicRecipient -Encoding Ascii -NoNewline
    $completed = $true

    Write-Host ''
    Write-Host 'SUCCESS: encrypted age identity and public recipient were created.'
    Write-Host "Encrypted identity: $identityPath"
    Write-Host "Public recipient: $recipientPath"
    Write-Host 'Do not store the passphrase with the external drive.'
}
finally {
    $identityLines = $null
    $identityText = $null
    if (-not $completed) {
        if (Test-Path -LiteralPath $identityPath) {
            Remove-Item -LiteralPath $identityPath -Force
        }
        if (Test-Path -LiteralPath $recipientPath) {
            Remove-Item -LiteralPath $recipientPath -Force
        }
    }
}

Read-Host 'Press Enter to close this window'
