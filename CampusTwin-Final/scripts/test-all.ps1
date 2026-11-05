# Runs every test suite and the production build.
$ErrorActionPreference = "Stop"
Push-Location server; npm test; Pop-Location
Push-Location client; npm test; npm run build; Pop-Location
if (Get-Command python -ErrorAction SilentlyContinue) { Push-Location gis; python -m pytest -q; Pop-Location } else { Write-Host "Python not found: GIS tests skipped" }
