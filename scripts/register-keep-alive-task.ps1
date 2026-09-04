# Run this once (as your normal user is fine) to schedule the keep-alive
# ping. It runs daily at 09:00, and is configured to still fire (as soon as
# possible) even if the PC was off or asleep at that exact time — so it's
# fine if you don't leave the computer on all day, as long as it's on at
# least briefly every few days.

$scriptPath = Join-Path $PSScriptRoot "keep-alive.ps1"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At 9:00AM

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries

Register-ScheduledTask `
    -TaskName "ZwemTicketsKeepAlive" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Pings the zwem-tickets site daily so the free Supabase project doesn't auto-pause after 7 days of inactivity." `
    -Force

Write-Host "Scheduled task 'ZwemTicketsKeepAlive' registered - runs daily at 09:00."
