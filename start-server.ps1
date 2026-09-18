$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location (Split-Path $MyInvocation.MyCommand.Path)
Write-Host "Starting Star Wars Ludo Server..." -ForegroundColor Yellow
node server.js
Read-Host "`nPress Enter to exit"
