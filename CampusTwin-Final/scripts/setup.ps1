# One-time setup. Run from the project folder:  .\scripts\setup.ps1
$ErrorActionPreference = "Stop"
if (-not (Test-Path server\.env)) { Copy-Item server\.env.example server\.env; Write-Host "Created server\.env. Open it and fill MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD." }
if (-not (Test-Path client\.env)) { Copy-Item client\.env.example client\.env }
npm --prefix server install
npm --prefix client install
Write-Host "Setup finished. Next: edit server\.env, then run .\scripts\run-dev.ps1"
