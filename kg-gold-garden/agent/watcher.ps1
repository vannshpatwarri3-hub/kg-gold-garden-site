<#
    KG GOLD GARDEN - CARETAKER WATCHER
    ==================================

    A small, quiet program that sits in the background and runs the heartbeat
    every 10 minutes, forever.

    This exists because Windows Task Scheduler is locked down on this machine
    and refuses to launch tasks (error 0x80070005). The watcher needs no special
    permission at all - it is just a program running as you.

    It starts itself every time you log in (see install-startup.ps1).
    Only one copy can ever run at a time, so logging in twice is harmless.
#>

$ErrorActionPreference = 'Continue'

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Heartbeat = Join-Path $Root 'heartbeat.ps1'
$LogDir    = Join-Path $Root 'logs'
$IntervalS = 600   # 10 minutes

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$WatcherLog = Join-Path $LogDir 'watcher.log'

function Note {
    param([string]$m)
    $line = "{0}  {1}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $m
    Add-Content -Path $WatcherLog -Value $line -Encoding utf8
}

# --- Only one watcher at a time --------------------------------------------
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Global\KGGoldGardenCaretaker', [ref]$created)
if (-not $created) {
    Note 'Another watcher is already running - this copy is exiting.'
    exit 0
}

Note "Watcher started (pid $PID). Checking every $($IntervalS / 60) minutes."

# --- The loop ---------------------------------------------------------------
# Each check runs as a separate process, so even a hard failure inside the
# heartbeat cannot stop the watcher from trying again in 10 minutes.
try {
    while ($true) {
        try {
            $p = Start-Process -FilePath 'powershell.exe' `
                -ArgumentList @(
                    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                    '-WindowStyle', 'Hidden', '-File', ('"' + $Heartbeat + '"'), '-Quiet'
                ) `
                -WindowStyle Hidden -PassThru -Wait

            # Exit 0 = all well. Exit 1 = a real problem was found and logged.
            if ($p.ExitCode -eq 2) { Note 'Heartbeat could not start - check config.json.' }
        } catch {
            Note ("Check failed to launch: " + $_.Exception.Message)
        }

        Start-Sleep -Seconds $IntervalS
    }
} finally {
    try { $mutex.ReleaseMutex() } catch {}
    Note "Watcher stopped (pid $PID)."
}
