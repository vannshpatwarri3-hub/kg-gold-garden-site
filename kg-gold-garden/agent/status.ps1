<#
    HOW IS MY WEBSITE DOING?
    ========================

    Prints a short, plain-English health report from the caretaker's last check.

      powershell -ExecutionPolicy Bypass -File status.ps1
#>

$Root       = Split-Path -Parent $MyInvocation.MyCommand.Definition
$StatusPath = Join-Path $Root 'state\status.json'
$LogDir     = Join-Path $Root 'logs'
$TaskName   = 'KG Gold Garden - Website Caretaker'

function Line { param([string]$k, [string]$v, [string]$c = 'White')
    Write-Host ("  {0,-16}" -f $k) -NoNewline -ForegroundColor DarkGray
    Write-Host $v -ForegroundColor $c
}

Write-Host ""
Write-Host "  KG GOLD GARDEN - SITE HEALTH" -ForegroundColor Yellow
Write-Host "  ============================" -ForegroundColor Yellow
Write-Host ""

# --- Is the caretaker actually running? ------------------------------------
# The watcher is the normal way this runs. The scheduled task is only a fallback
# for machines where Task Scheduler is not locked down.
$watcher = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*watcher.ps1*' } | Select-Object -First 1

if ($null -ne $watcher) {
    Line 'Caretaker' ("running (pid {0}) - checks every 10 min" -f $watcher.ProcessId) 'Green'
} else {
    $task = $null
    try { $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop } catch {}
    if ($null -ne $task) {
        Line 'Caretaker' 'running as a scheduled task' 'Green'
    } else {
        Line 'Caretaker' 'NOT RUNNING - run .\install-startup.ps1' 'Red'
    }
}

if (-not (Test-Path $StatusPath)) {
    Write-Host ""
    Write-Host "  No check has run yet. Run .\heartbeat.ps1 once to get started." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

$s = Get-Content $StatusPath -Raw -Encoding utf8 | ConvertFrom-Json

Line 'Last checked' $s.checkedAtLocal
Write-Host ""

# --- Verdict ----------------------------------------------------------------
$verdictText  = $s.verdict
$verdictColor = 'White'
if ($s.verdict -eq 'HEALTHY')         { $verdictText = 'All good - your real rates are live'; $verdictColor = 'Green'  }
if ($s.verdict -eq 'HEALTHY_STALE')   { $verdictText = 'Real rates live, but over 36h old';    $verdictColor = 'Yellow' }
if ($s.verdict -eq 'REPAIRED')        { $verdictText = 'Demo rates appeared - I put yours back'; $verdictColor = 'Cyan' }
if ($s.verdict -eq 'DEMO_RATES_LIVE') { $verdictText = 'DEMO RATES ARE SHOWING TO CUSTOMERS';  $verdictColor = 'Red'    }
if ($s.verdict -eq 'DOWN')            { $verdictText = 'WEBSITE IS NOT RESPONDING';            $verdictColor = 'Red'    }
if ($s.verdict -eq 'DEGRADED')        { $verdictText = 'Site loads but rates are broken';      $verdictColor = 'Red'    }

Line 'Status' $verdictText $verdictColor
if ($s.detail) { Line '' $s.detail 'DarkGray' }
Write-Host ""

# --- The numbers customers can see -----------------------------------------
$rateColour = 'Green'
if ($s.isPlaceholder) { $rateColour = 'Red' }

Line 'Showing 24K' ("Rs {0} /g" -f $s.gold24) $rateColour
Line 'Showing 22K' ("Rs {0} /g" -f $s.gold22) $rateColour
Line 'Showing 18K' ("Rs {0} /g" -f $s.gold18) $rateColour
Line 'Showing silver' ("Rs {0} /g" -f $s.silver) $rateColour

if ($s.isPlaceholder) {
    Write-Host ""
    Write-Host "  ^ These are the DEMO figures, not your real prices." -ForegroundColor Red
}

Write-Host ""
Line 'Speed' ("{0} ms" -f $s.responseMs) $(if ($s.coldStart) { 'Yellow' } else { 'Green' })
if ($s.coldStart) { Line '' 'Site had gone to sleep on that check' 'DarkGray' }

# --- Recent trouble ---------------------------------------------------------
$today = Join-Path $LogDir ("heartbeat-{0}.log" -f (Get-Date).ToString('yyyy-MM-dd'))
if (Test-Path $today) {
    $bad = Get-Content $today -Encoding utf8 | Where-Object { $_ -match '\s(ALERT|FIXED)\s' } | Select-Object -Last 5
    if ($bad) {
        Write-Host ""
        Write-Host "  Notable events today:" -ForegroundColor DarkGray
        foreach ($b in $bad) { Write-Host ("    " + $b) -ForegroundColor DarkYellow }
    }
}

Write-Host ""
