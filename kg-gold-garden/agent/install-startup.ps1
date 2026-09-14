<#
    START THE CARETAKER, AND KEEP IT STARTED
    ========================================

    Puts a tiny launcher in your Windows Startup folder so the caretaker begins
    working every time you log in - and starts it right now too.

    No administrator rights needed.

      powershell -ExecutionPolicy Bypass -File install-startup.ps1

    To stop it permanently, run:  uninstall-startup.ps1
#>

$ErrorActionPreference = 'Stop'

$Root     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Watcher  = Join-Path $Root 'watcher.ps1'
$StartDir = [Environment]::GetFolderPath('Startup')
$VbsPath  = Join-Path $StartDir 'KG Gold Garden Caretaker.vbs'

if (-not (Test-Path $Watcher)) {
    Write-Host "Cannot find watcher.ps1. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  KG Gold Garden - Caretaker" -ForegroundColor Yellow
Write-Host "  ==========================" -ForegroundColor Yellow
Write-Host ""

# A .vbs launcher is used because it can start PowerShell with no console
# window at all - nothing flashes on screen when you log in.
$vbs = @"
' Starts the KG Gold Garden caretaker, completely hidden.
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$Watcher""", 0, False
"@

Set-Content -Path $VbsPath -Value $vbs -Encoding ASCII
Write-Host "  [ok] Added to Startup - it will run automatically every time you log in." -ForegroundColor Green

# --- Start it now, so you do not have to log out --------------------------
$already = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*watcher.ps1*' }

if ($already) {
    Write-Host "  [ok] Already running in the background (pid $($already.ProcessId))." -ForegroundColor Green
} else {
    Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + $VbsPath + '"') -WindowStyle Hidden
    Start-Sleep -Seconds 3
    $now = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*watcher.ps1*' }
    if ($now) {
        Write-Host "  [ok] Started now (pid $($now.ProcessId)) - first check is running." -ForegroundColor Green
    } else {
        Write-Host "  [!] Could not confirm it started. Run watcher.ps1 by hand to check." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  Checking your website every 10 minutes." -ForegroundColor Green
Write-Host "  See how it is doing any time with:  .\status.ps1" -ForegroundColor Cyan
Write-Host ""
