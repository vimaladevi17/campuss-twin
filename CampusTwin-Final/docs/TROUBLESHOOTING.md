# Troubleshooting

| Problem | Cause and fix |
|---|---|
| `npm start` prints "MONGO_URI is missing" or cannot connect | Check `server/.env`. In Atlas, add your current IP under Network Access and check the user and password. |
| Login works but the page shows "Cannot reach the server" | The server is not running, or `VITE_API_URL` in `client/.env` is wrong. Default is `http://localhost:5000/api`. Restart `npm run dev` after editing `.env`. |
| Browser console shows a CORS error | Set `CLIENT_URL` in `server/.env` to the exact address in the browser bar, then restart the server. |
| No live notifications | The bell falls back to polling every 60 s. Check the server log for "Authentication failed" (log in again), and that `VITE_SOCKET_URL` is empty or points at the server origin without `/api`. |
| Map is blank or grey | The basemap loads tiles from openstreetmap.org and labels from demotiles.maplibre.org. Check your internet connection. Building outlines appear only after `npm run import:gis` has been run. |
| 3D shows flat buildings | Only buildings with stored or floor-derived heights are extruded. That is expected. |
| Replacement results say "distance unavailable" | No connected pedestrian route exists in the data. Run the GIS pipeline and `npm run import:gis -- ..\data\gis --commit`. |
| `python` is not recognised | Install Python from python.org and tick "Add python.exe to PATH", or use `py -m venv .venv`. |
| `pip install osmnx` fails on Windows | Upgrade pip first: `python -m pip install --upgrade pip`. Using Python 3.11 or 3.12 avoids most wheel problems. |
| PowerShell says scripts are disabled | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Port 5000 or 5173 is in use | Change `PORT` in `server/.env` (and `VITE_API_URL`), or stop the other program: `Get-NetTCPConnection -LocalPort 5000`. |
| Import says "Cannot import without the manifest" | Run the GIS pipeline first so `data/gis/gis_import_manifest.json` exists. |
