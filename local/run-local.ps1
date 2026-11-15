$ErrorActionPreference = "Stop"
$localDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $env:LOCALAPPDATA "GLaDOSCheckin"
$encryptedFile = Join-Path $dataDir "pushplus-token.dpapi"
$env:PUSHPLUS_TOKEN = ""
if (Test-Path -LiteralPath $encryptedFile) {
    $secure = Get-Content -Raw -LiteralPath $encryptedFile | ConvertTo-SecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $env:PUSHPLUS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}
Push-Location -LiteralPath $localDir
try {
    & node (Join-Path $localDir "checkin.mjs")
    $exitCode = $LASTEXITCODE
} finally {
    $env:PUSHPLUS_TOKEN = ""
    Pop-Location
}
exit $exitCode
