$ErrorActionPreference = "Stop"
$localDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $env:LOCALAPPDATA "GLaDOSCheckin"
$taskName = "GLaDOS-Edge-Checkin"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is missing. Install Node.js 22+ LTS first."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm is missing. Install Node.js 22+ LTS first."
}
$version = & node -p "parseInt(process.versions.node.split('.')[0], 10)"
if ([int]$version -lt 22) { throw "Node.js 22+ is required" }

Write-Host "Installing local browser automation dependencies..."
Push-Location -LiteralPath $localDir
try {
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

Write-Host "PushPlus token is encrypted locally using Windows DPAPI."
Write-Host "Enter your existing PushPlus token or press Enter to skip."
$token = Read-Host "PushPlus token" -AsSecureString
$ptr = [IntPtr]::Zero
$plainLength = 0
try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
    $plainLength = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Length
} finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}
if ($plainLength -gt 0) {
    $protected = ConvertFrom-SecureString -SecureString $token
    Set-Content -LiteralPath (Join-Path $dataDir "pushplus-token.dpapi") -Value $protected -Encoding UTF8
    Write-Host "PushPlus token saved with Windows user-scoped DPAPI."
} elseif (-not (Test-Path (Join-Path $dataDir "pushplus-token.dpapi"))) {
    Write-Warning "No PushPlus token configured. Results will be logged locally."
}

Write-Host "Account 1: sign in using the dedicated Edge window."
Push-Location -LiteralPath $localDir
try {
    & node (Join-Path $localDir "login.mjs") 1
    if ($LASTEXITCODE -ne 0) { throw "Account 1 login verification failed" }
    Write-Host "Account 2: sign in using the second Edge window."
    & node (Join-Path $localDir "login.mjs") 2
    if ($LASTEXITCODE -ne 0) { throw "Account 2 login verification failed" }
} finally { Pop-Location }

$powerShell = (Get-Command powershell.exe).Source
$taskScript = Join-Path $localDir "run-local.ps1"
$arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $taskScript + '"'
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $localDir
$trigger = New-ScheduledTaskTrigger -Daily -At "19:30"
$username = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $username -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 25)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host ""
Write-Host "Scheduled task installed: $taskName (daily 19:30 Windows local time)."
Write-Host "Runs only when this Windows user is logged in and the computer is awake."
Write-Host "To test, run this script manually: $taskScript"
Write-Host ("Logs: " + (Join-Path $dataDir 'logs'))
Write-Host "This task cannot bypass mandatory human verification."
