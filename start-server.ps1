$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location (Split-Path $MyInvocation.MyCommand.Path)
Write-Host "Starting Meme Ludo Server..." -ForegroundColor Yellow
$memeLudoPort = 3000
$existingListener = Get-NetTCPConnection -LocalPort $memeLudoPort -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
  Write-Host "Meme Ludo is already running at http://localhost:$memeLudoPort" -ForegroundColor Green
  Write-Host "Close the other server window before starting a second copy." -ForegroundColor DarkYellow
  Read-Host "Press Enter to exit"
  exit 0
}
node server.js
Read-Host "`nPress Enter to exit"
