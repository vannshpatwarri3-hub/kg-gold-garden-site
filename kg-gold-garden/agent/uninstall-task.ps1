<#
    Stop and remove the caretaker's scheduled task.
    Your logs, settings and saved rate are left untouched.

      powershell -ExecutionPolicy Bypass -File uninstall-task.ps1
#>

$TaskName = 'KG Gold Garden Caretaker'

schtasks /Query /TN $TaskName 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "The caretaker is not installed - nothing to remove." -ForegroundColor Yellow
    exit 0
}

schtasks /Delete /TN $TaskName /F | Out-Null
Write-Host "Caretaker stopped and removed. Your website is no longer being kept awake." -ForegroundColor Yellow
Write-Host "Reinstall any time with:  .\install-task.ps1" -ForegroundColor Cyan
