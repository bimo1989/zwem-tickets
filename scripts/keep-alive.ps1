# Pings the live ticket site once so it makes a real database query
# (the homepage loads upcoming events from Supabase). This is enough
# activity to stop the free Supabase project from auto-pausing after
# 7 days of total inactivity. Run daily via Windows Task Scheduler —
# see scripts/register-keep-alive-task.ps1.

$siteUrl = "https://zwem-tickets-ly88.vercel.app/"
$logPath = Join-Path $PSScriptRoot "keep-alive.log"

try {
    $response = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 30
    $result = "OK (status $($response.StatusCode))"
} catch {
    $result = "ERROR: $($_.Exception.Message)"
}

$line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $result"
Add-Content -Path $logPath -Value $line

# Keep the log from growing forever — trim to the last 200 lines.
if (Test-Path $logPath) {
    $lines = Get-Content $logPath
    if ($lines.Count -gt 200) {
        $lines[-200..-1] | Set-Content $logPath
    }
}
