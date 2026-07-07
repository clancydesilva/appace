# Create logs directory if it doesn't exist
$logsDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path -Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# Generate timestamped filename
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logsDir "launch-$timestamp.log"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Launching Appace Android & Logging Output" -ForegroundColor Cyan
Write-Host " Log file: $logFile" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

# Start Expo and Tee output to console and file
# Metro bundler remains interactive
npx expo run:android --device Pixel_6_API_34i | Tee-Object -FilePath $logFile
