<#
    Stop the caretaker and remove it from Startup.
    Your logs, settings and saved rate are left untouched.

      powershell -ExecutionPolicy Bypass -File uninstall-startup.ps1
#>

$StartDir = [Environment]::GetFolderPath('Startup')
$VbsPath  = Join-Path $StartDir 'KG Gold Garden Caretaker.vbs'

if (Test-Path $VbsPath) {
    Remove-Item $VbsPath -Force
    Write-Host "Removed from Startup - it will not come back after you log in." -ForegroundColor Yellow
} else {
    Write-Host "Not in Startup." -ForegroundColor DarkGray
}

$running = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*watcher.ps1*' }

if ($running) {
    foreach ($p in $running) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "Stopped the running caretaker. Your website is no longer being kept awake." -ForegroundColor Yellow
} else {
    Write-Host "Nothing was running." -ForegroundColor DarkGray
}

Write-Host "Start it again any time with:  .\install-startup.ps1" -ForegroundColor Cyan
