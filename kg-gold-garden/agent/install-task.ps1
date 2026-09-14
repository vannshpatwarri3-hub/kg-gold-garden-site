<#
    INSTALL THE CARETAKER
    =====================

    Registers a Windows scheduled task that runs the heartbeat every 10 minutes,
    quietly in the background. No administrator rights needed - it installs for
    your account only.

    To install:
      powershell -ExecutionPolicy Bypass -File install-task.ps1

    To remove it later:
      powershell -ExecutionPolicy Bypass -File uninstall-task.ps1

    NOTE: this uses schtasks.exe rather than Register-ScheduledTask, because the
    PowerShell cmdlet needs elevation on this machine and schtasks does not.
#>

$ErrorActionPreference = 'Stop'

$TaskName  = 'KG Gold Garden Caretaker'
$Root      = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Launcher  = Join-Path $Root 'run-heartbeat.cmd'
$IntervalM = 10

if (-not (Test-Path $Launcher)) {
    Write-Host "Cannot find run-heartbeat.cmd next to this installer. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  KG Gold Garden - Caretaker setup" -ForegroundColor Yellow
Write-Host "  ================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Watching : https://kg-gold-garden-site.onrender.com"
Write-Host "  Every    : $IntervalM minutes"
Write-Host ""

# /F replaces any existing copy, so re-running this is always safe.
schtasks /Create /TN $TaskName /TR ('"' + $Launcher + '"') /SC MINUTE /MO $IntervalM /F | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Could not create the task. Try running this from a normal (non-admin) PowerShell window." -ForegroundColor Red
    exit 1
}

Write-Host "  [ok] Caretaker installed." -ForegroundColor Green
Write-Host ""
Write-Host "  Running the first check now..." -ForegroundColor DarkGray
schtasks /Run /TN $TaskName | Out-Null
Start-Sleep -Seconds 8

schtasks /Query /TN $TaskName /FO LIST | Select-String -Pattern 'TaskName|Status|Next Run Time|Last Run Time|Last Result'

Write-Host ""
Write-Host "  It will now keep itself running in the background." -ForegroundColor Green
Write-Host "  To see how the website is doing, run:  .\status.ps1" -ForegroundColor Cyan
Write-Host ""
