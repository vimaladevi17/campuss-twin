# Starts the server and the client in two PowerShell windows.
$root = Split-Path -Parent $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev"
Write-Host "Server: http://localhost:5000   Client: http://localhost:5173"
