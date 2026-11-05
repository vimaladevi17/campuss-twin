# CampusTwin

Campus digital twin for Kalasalingam Academy of Research and Education (KARE). React (Vite) client, Express and MongoDB server, a Python GIS pipeline.
Modules: buildings, floors and rooms; facilities; 2D and 3D campus map; timetables with conflict detection; vacancy finder; smart lab replacement with admin approval;
reservations; maintenance; real-time notifications; admin CRUD with audit history; the original portal (students, faculty, labs, events, notices, attendance).

## Folders
| Folder | Contents |
|---|---|
| `client/` | React app (MapLibre GL JS, deck.gl, Socket.IO client). Port 5173. |
| `server/` | Express API, Mongoose models, Socket.IO, migration and import scripts. Port 5000. |
| `gis/` | Python pipeline (OSMnx, GeoPandas, Shapely, NetworkX) and its tests. |
| `data/` | KARE facilities workbook, `gis/` output folder, reference images. |
| `docs/` | API, database models, GIS pipeline, migration, Windows setup, troubleshooting, architecture. |
| `scripts/` | PowerShell helpers: `setup.ps1`, `run-dev.ps1`, `test-all.ps1`. |
| `COMPLETE_IMPLEMENTATION_REPORT.md` | What was built, test counts, limitations. |

## Quick start (Windows PowerShell, from this folder)
```powershell
.\scripts\setup.ps1                     # installs packages, creates server\.env and client\.env
notepad server\.env                     # fill MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
cd server
npm run seed                            # first admin account
npm run migrate:dry                     # preview, changes nothing
npm run migrate
npm run import:facilities -- ..\data\KARE_Campus_Facilities_Spatial_Data.xlsx --commit
npm run validate:startup
cd ..
.\scripts\run-dev.ps1                   # server on :5000, client on :5173
```
Open http://localhost:5173 and sign in with the admin account from `.env`.
Full steps and the optional GIS import are in `docs/WINDOWS_SETUP.md` and `docs/GIS_PIPELINE.md`. Problems: `docs/TROUBLESHOOTING.md`.

## Tests and build
```powershell
.\scripts\test-all.ps1
```

## Data honesty
* OpenStreetMap data is labelled `OSM-derived` and has not been verified by the college. Demo records show a DEMO badge.
* Building heights come from stored data. Heights derived from floor counts are labelled estimates. Buildings with no height are not extruded in 3D.
* Walking distance uses a pedestrian graph. If no connected route exists the result says "unavailable". It never falls back to a straight line.
* The extraction point and radius are not a campus boundary. No boundary is drawn unless boundary data is loaded.

## Security
`server/.env` is never part of the repository or the ZIP. Passwords are hashed with bcrypt, roles are enforced on the server, login is rate limited,
and socket connections need a valid token. A token keeps its role until it expires (7 days).
