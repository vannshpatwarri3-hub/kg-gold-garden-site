<#
    KG GOLD GARDEN - CARETAKER HEARTBEAT
    ====================================

    Runs every 10 minutes, on its own, forever.

    WHAT IT DOES
      1. Opens your website  -> stops Render putting it to sleep.
      2. Reads the live gold rate.
      3. If the rate has fallen back to the demo figures, it either
         puts YOUR last real rate back (if you switched that on), or
         records a loud alert so the caretaker can tell you.
      4. Writes a health snapshot + a log line.

    THE ONE RULE THIS SCRIPT OBEYS
      It NEVER makes up a gold rate. The only number it will ever post is one
      that YOU typed into the admin panel yourself, which it remembered from a
      previous healthy reading. If it has never seen a real rate from you, it
      raises an alert and posts nothing.

    Run by hand any time:
      powershell -ExecutionPolicy Bypass -File heartbeat.ps1
#>

param(
    [switch]$Quiet     # suppress console output (used by the scheduled task)
)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# --- Where everything lives -------------------------------------------------
$Root       = Split-Path -Parent $MyInvocation.MyCommand.Definition
$StateDir   = Join-Path $Root 'state'
$LogDir     = Join-Path $Root 'logs'
$ConfigPath = Join-Path $Root 'config.json'
$SecretPath = Join-Path $Root 'secrets.env'
$KnownGood  = Join-Path $StateDir 'known-good-rates.json'
$StatusPath = Join-Path $StateDir 'status.json'

foreach ($d in @($StateDir, $LogDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

$Stamp   = Get-Date
$LogFile = Join-Path $LogDir ("heartbeat-{0}.log" -f $Stamp.ToString('yyyy-MM-dd'))

function Write-Log {
    param([string]$Level, [string]$Message)
    $line = "{0}  {1,-5}  {2}" -f $Stamp.ToString('yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Add-Content -Path $LogFile -Value $line -Encoding utf8
    if (-not $Quiet) {
        $colour = 'Gray'
        if ($Level -eq 'OK')    { $colour = 'Green'  }
        if ($Level -eq 'WARN')  { $colour = 'Yellow' }
        if ($Level -eq 'ALERT') { $colour = 'Red'    }
        if ($Level -eq 'FIXED') { $colour = 'Cyan'   }
        Write-Host $line -ForegroundColor $colour
    }
}

# --- Settings ---------------------------------------------------------------
if (-not (Test-Path $ConfigPath)) {
    Write-Log 'ALERT' "config.json is missing. Cannot run."
    exit 2
}
$cfg = Get-Content $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json

$SiteUrl  = $cfg.siteUrl.TrimEnd('/')
$Timeout  = [int]$cfg.timeoutSeconds
$Retries  = [int]$cfg.retries
$MaxAge   = [int]$cfg.maxRestoreAgeDays

# Credentials are optional and only read from secrets.env, which you own.
$AdminUser = $null
$AdminPass = $null
if (Test-Path $SecretPath) {
    foreach ($raw in (Get-Content $SecretPath -Encoding utf8)) {
        $l = $raw.Trim()
        if ($l -eq '' -or $l.StartsWith('#')) { continue }
        $i = $l.IndexOf('=')
        if ($i -lt 1) { continue }
        $k = $l.Substring(0, $i).Trim()
        $v = $l.Substring($i + 1).Trim()
        if ($k -eq 'ADMIN_USERNAME') { $AdminUser = $v }
        if ($k -eq 'ADMIN_PASSWORD') { $AdminPass = $v }
    }
}
$HaveCreds = -not ([string]::IsNullOrWhiteSpace($AdminUser) -or [string]::IsNullOrWhiteSpace($AdminPass))

# --- The running health record ---------------------------------------------
$status = [ordered]@{
    checkedAt      = $Stamp.ToString('o')
    checkedAtLocal = $Stamp.ToString('dd MMM yyyy, HH:mm')
    siteUrl        = $SiteUrl
    reachable      = $false
    httpCode       = 0
    responseMs     = 0
    coldStart      = $false
    ratesSource    = $null
    isPlaceholder  = $null
    isStale        = $null
    gold24         = $null
    gold22         = $null
    gold18         = $null
    silver         = $null
    ratesUpdatedAt = $null
    action         = 'none'
    verdict        = 'unknown'
    detail         = ''
}

function Save-Status {
    $status | ConvertTo-Json -Depth 10 | Set-Content -Path $StatusPath -Encoding utf8
}

# --- Step 1: wake the site up ----------------------------------------------
$watch   = [Diagnostics.Stopwatch]::StartNew()
$pingOk  = $false
$attempt = 0

while ($attempt -le $Retries -and -not $pingOk) {
    $attempt++
    try {
        $r = Invoke-WebRequest -Uri "$SiteUrl/" -Method GET -TimeoutSec $Timeout -UseBasicParsing
        $status.httpCode = [int]$r.StatusCode
        $pingOk = ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch {
        $resp = $null
        try { $resp = $_.Exception.Response } catch {}
        if ($null -ne $resp) { try { $status.httpCode = [int]$resp.StatusCode } catch {} }
        if ($attempt -le $Retries) {
            Write-Log 'WARN' ("Ping attempt {0} failed ({1}). Retrying..." -f $attempt, $_.Exception.Message)
            Start-Sleep -Seconds 5
        } else {
            Write-Log 'ALERT' ("Website did not answer after {0} attempts: {1}" -f $attempt, $_.Exception.Message)
        }
    }
}
$watch.Stop()
$status.responseMs = [int]$watch.ElapsedMilliseconds
$status.reachable  = $pingOk
$status.coldStart  = ($status.responseMs -gt 8000)

if (-not $pingOk) {
    $status.verdict = 'DOWN'
    $status.detail  = "The website did not respond. It may be deploying, or Render may be having trouble."
    Write-Log 'ALERT' "SITE DOWN - no response from $SiteUrl"
    Save-Status
    exit 1
}

if ($status.coldStart) {
    Write-Log 'WARN' ("Site was asleep - took {0}s to wake. This is when rates get wiped." -f [math]::Round($status.responseMs / 1000, 1))
} else {
    Write-Log 'OK' ("Site awake and healthy ({0} ms)." -f $status.responseMs)
}

# --- Step 2: read the live rate --------------------------------------------
try {
    $ratesRaw = Invoke-WebRequest -Uri "$SiteUrl/api/rates" -Method GET -TimeoutSec $Timeout -UseBasicParsing
    $rates = ($ratesRaw.Content | ConvertFrom-Json).rates
} catch {
    $status.verdict = 'DEGRADED'
    $status.detail  = "Homepage loads but the rate service did not answer."
    Write-Log 'ALERT' ("Could not read /api/rates: {0}" -f $_.Exception.Message)
    Save-Status
    exit 1
}

$status.ratesSource    = $rates.source
$status.isPlaceholder  = [bool]$rates.isPlaceholder
$status.isStale        = [bool]$rates.isStale
$status.gold24         = $rates.gold24
$status.gold22         = $rates.gold22
$status.gold18         = $rates.gold18
$status.silver         = $rates.silver
$status.ratesUpdatedAt = $rates.updatedAt

# --- Step 3: healthy? Then remember this rate as known-good -----------------
if (-not $status.isPlaceholder -and $rates.source -eq 'showroom') {

    # This rate came from YOU via the admin panel. Safe to remember and reuse.
    $remember = [ordered]@{
        gold24     = $rates.gold24
        gold22     = $rates.gold22
        gold18     = $rates.gold18
        silver     = $rates.silver
        capturedAt = $Stamp.ToString('o')
        setByYouAt = $rates.updatedAt
        note       = 'Captured from a healthy live reading. Set by the showroom admin panel, never generated.'
    }
    $remember | ConvertTo-Json -Depth 10 | Set-Content -Path $KnownGood -Encoding utf8

    $status.verdict = 'HEALTHY'
    $status.action  = 'remembered'
    $status.detail  = "Live rates are your real ones."
    Write-Log 'OK' ("Rates LIVE and real - 24K {0} / 22K {1} / silver {2}. Remembered as your known-good." -f $rates.gold24, $rates.gold22, $rates.silver)

    if ($status.isStale) {
        $status.verdict = 'HEALTHY_STALE'
        $status.detail  = "Rates are real but have not been updated in over 36 hours."
        Write-Log 'WARN' "Rates are real but older than 36 hours - the site is showing a 'stale' notice to customers."
    }

    Save-Status
    exit 0
}

# --- Step 4: the rates have reset to demo ----------------------------------
Write-Log 'ALERT' ("DEMO RATES ARE LIVE - showing 24K {0} / 22K {1} / silver {2} to customers." -f $rates.gold24, $rates.gold22, $rates.silver)
$status.verdict = 'DEMO_RATES_LIVE'

if (-not $cfg.autoRestoreRates) {
    $status.action = 'alert-only'
    $status.detail = "Demo rates are showing. Auto-restore is switched off, so nothing was changed."
    Write-Log 'WARN' "Auto-restore is OFF in config.json - leaving the site untouched and waiting for you."
    Save-Status
    exit 1
}

if (-not (Test-Path $KnownGood)) {
    $status.action = 'blocked-no-known-rate'
    $status.detail = "Demo rates are showing, but I have never seen a real rate from you, so there is nothing safe to restore."
    Write-Log 'ALERT' "Cannot restore - no known-good rate on file. I will not invent one. Please set the rate once in the admin panel."
    Save-Status
    exit 1
}

$good    = Get-Content $KnownGood -Raw -Encoding utf8 | ConvertFrom-Json
$ageDays = ((Get-Date) - [datetime]$good.capturedAt).TotalDays

if ($ageDays -gt $MaxAge) {
    $status.action = 'blocked-too-old'
    $status.detail = ("The rate I have saved is {0} days old - too old to put back safely." -f [math]::Round($ageDays, 1))
    Write-Log 'ALERT' ("Refusing to restore a {0}-day-old rate (limit {1} days). Gold moves daily - please set today's rate yourself." -f [math]::Round($ageDays, 1), $MaxAge)
    Save-Status
    exit 1
}

if (-not $HaveCreds) {
    $status.action = 'blocked-no-credentials'
    $status.detail = "Demo rates are showing and I have your rate saved, but no admin login was provided."
    Write-Log 'ALERT' "Cannot restore - secrets.env has no ADMIN_USERNAME / ADMIN_PASSWORD."
    Save-Status
    exit 1
}

# --- Step 5: log in and put YOUR rate back ---------------------------------
try {
    $loginBody = @{ username = $AdminUser; password = $AdminPass } | ConvertTo-Json -Compress
    Invoke-WebRequest -Uri "$SiteUrl/api/admin/login" -Method POST -Body $loginBody -ContentType 'application/json' -TimeoutSec $Timeout -UseBasicParsing -SessionVariable sess | Out-Null
} catch {
    $status.action = 'login-failed'
    $status.detail = "Could not sign in to the admin panel to restore the rate."
    Write-Log 'ALERT' ("Admin login failed: {0} - check ADMIN_USERNAME / ADMIN_PASSWORD in secrets.env." -f $_.Exception.Message)
    Save-Status
    exit 1
}

try {
    # Only YOUR remembered figures are sent. Nothing here is calculated or guessed.
    $payload = @{
        gold24 = $good.gold24
        gold22 = $good.gold22
        silver = $good.silver
        actor  = 'caretaker (restored your last rate)'
    }
    if ($good.gold18) { $payload.gold18 = $good.gold18 }

    $postBody = $payload | ConvertTo-Json -Compress
    $res  = Invoke-WebRequest -Uri "$SiteUrl/api/rates" -Method POST -Body $postBody -ContentType 'application/json' -TimeoutSec $Timeout -UseBasicParsing -WebSession $sess
    $back = ($res.Content | ConvertFrom-Json).rates

    $status.action        = 'restored'
    $status.verdict       = 'REPAIRED'
    $status.gold24        = $back.gold24
    $status.gold22        = $back.gold22
    $status.gold18        = $back.gold18
    $status.silver        = $back.silver
    $status.isPlaceholder = [bool]$back.isPlaceholder
    $status.ratesSource   = $back.source
    $status.detail        = ("Demo rates were live. I put your own last rate back (set by you on {0})." -f ([datetime]$good.setByYouAt).ToString('dd MMM, HH:mm'))

    Write-Log 'FIXED' ("RESTORED your rate - 24K {0} / 22K {1} / silver {2} (originally set by you {3})." -f $back.gold24, $back.gold22, $back.silver, ([datetime]$good.setByYouAt).ToString('dd MMM HH:mm'))

    if ($ageDays -gt 1) {
        Write-Log 'WARN' ("Heads up - that rate is {0} days old. Worth setting today's figure." -f [math]::Round($ageDays, 1))
    }
} catch {
    $status.action = 'restore-failed'
    $status.detail = "Signed in, but the rate update was rejected."
    Write-Log 'ALERT' ("Restore failed: {0}" -f $_.Exception.Message)
}

Save-Status

# --- Tidy old logs ----------------------------------------------------------
try {
    $cutoff = (Get-Date).AddDays(-1 * [int]$cfg.keepLogDays)
    Get-ChildItem -Path $LogDir -Filter 'heartbeat-*.log' | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force -Confirm:$false
} catch {}

exit 0
