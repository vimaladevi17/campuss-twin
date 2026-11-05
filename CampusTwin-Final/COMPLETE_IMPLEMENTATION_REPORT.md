# Complete implementation report

Date: 2026-11-03. Built on the supplied `campustwin-phase2b.zip`; no application was started from scratch.

## 1. What was implemented, by phase
| Phase | Result |
|---|---|
| 1 Inspect and preserve | Phase 2b inspected. Its models, routes, auth, admin screens, timetable, vacancy finder and replacement engine are kept. 147 backend tests passed before any change. |
| 2 Data model | Models for Building, Floor, Room, Facility, Reservation, MaintenanceRecord, CampusPath, ReplacementRequest, AllocationChange, Notification and AuditLog were already present. Added: `WalkingDistance`, `Building.footprint` and `osmId` indexes, `adminEditedFields` on Building and CampusPath, `Notification.dedupeKey`. Migration step added for the scoring weights. |
| 3 GIS | New `gis/` package and the `npm run import:gis` importer (dry run by default). See section 4. |
| 4 2D map | MapLibre GL JS map: footprints, labels, facility markers, paths, search, category filters, layer toggles, selection panels, accessibility information near a building, legend, step-free path filter. Data comes from `/api/map/*`. |
| 5 3D map | deck.gl on MapLibre: extruded buildings, labels, facilities, paths, 2D/3D toggle, selection. |
| 6 Admin | Existing CRUD for buildings, floors, rooms, classrooms, labs, facilities, courses, timetables and users kept. New screens: Maintenance, Room Reservations (request, approve, reject, cancel), Audit History (filters, pagination). Courses and Maintenance added to the menu. |
| 7 Timetable and vacancy | Already complete in Phase 2b (daily, weekly, room, course, faculty and student views, free-room search, conflict detection). Kept. |
| 8 Replacement engine | Default weights corrected to equipment 40, capacity 30, availability 20, distance 10. Distance now prefers the NetworkX matrix, then a path network built from `/paths`, then reports "unavailable". The straight-line fallback was removed. Approval, allocation change and audit were already present. |
| 9 Notifications | Socket.IO with token authentication, server-assigned rooms, persisted notifications, read state, history, de-duplication, reconnect sync and REST fallback. Timetable and maintenance changes now notify. |
| 10 Tests and docs | Tests below. Docs in `docs/`. |

## 2. Phase 2b functionality preserved
All existing routes were kept. Only distance output changed: `straight_line_approx` is replaced by `unavailable`, and the replacement page was updated to match.
No existing record is deleted by any script.

## 3. Database migration
`npm run migrate:dry` then `npm run migrate` (see `docs/MIGRATION.md`). Backup first. Re-runnable. The new weights step updates stored weights only if they still equal the old defaults.
Not run against a real database in this environment.

## 4. GIS data source and validation
Source: OpenStreetMap through OSMnx, reference point 9.5743, 77.6761, radius 1500 m (approximate). Labels: OSM-derived.
Polygons are preserved; representative points are a separate file. Outputs and checks are described in `docs/GIS_PIPELINE.md`.
**The live OSM download has not been run.** The environment could not reach OpenStreetMap, so `data/gis/` is empty. The pipeline was exercised with synthetic data only.
`campus_boundary.geojson` is not produced.

## 5. API endpoints
See `docs/API.md` for the complete table, access levels and Socket.IO events. Added in this work: socket events, `dedupeKey` behaviour and the `walking.type` values.

## 6. Test results (run from the final folder after a clean `npm ci`)
| Suite | Result |
|---|---|
| Server (unit, API guards, route contract, Socket.IO auth, GIS importer, legacy smoke) | 175 passed, 0 failed |
| Client (Vitest) | 61 passed, 0 failed |
| GIS (pytest) | 11 passed |
| Startup validation | 5 of 5 server and socket checks passed. The `.env` check failed because no `.env` exists in the package. MongoDB check skipped (no `MONGO_URI`). |

## 7. Frontend build
`vite build` succeeded. The map code is a separate, lazily loaded chunk (MapLibre and deck.gl).

## 8. Backend startup
`node server.js` without `MONGO_URI` exits with "MONGO_URI is missing in server/.env". With an unreachable URI it prints "MongoDB connection failed". With a reachable database it was not run here.
The HTTP and Socket.IO server itself starts and answers (startup validation).

## 9. Limitations
* No MongoDB was available. Database connection, migration commits, importer commits and the database-backed API paths have not been run against a real database.
* The OSM download and the real GIS output are untested. Run the pipeline and review `gis_validation_report.md` before relying on the data.
* The 2D and 3D map were built and tested only through their data logic, with the renderer replaced in tests. No browser was available, so rendering, clicking and 3D performance have not been checked on screen. Basemap tiles and 2D labels load from openstreetmap.org and demotiles.maplibre.org.
* Until GIS data is imported, there are no building outlines and every replacement candidate shows walking distance as unavailable.
* `Building` records from OSM need a floor count or height to be extruded. Most OSM buildings have neither.
* Notification history returns the most recent entries only; there is no paging control.
* A JWT keeps its role until it expires. Sockets are not disconnected when a role changes.
* Users, students, faculty, labs, events, notices and attendance are the original portal modules and were not changed beyond what is listed.

## 10. Windows PowerShell commands
```powershell
.\scripts\setup.ps1
notepad server\.env
cd server
npm run seed
npm run migrate:dry
npm run migrate
npm run import:facilities -- ..\data\KARE_Campus_Facilities_Spatial_Data.xlsx --commit
npm run validate:startup
cd ..
.\scripts\run-dev.ps1
```
Optional GIS:
```powershell
cd gis
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m campustwin_gis.cli --out ..\data\gis
cd ..\server
npm run import:gis
npm run import:gis -- ..\data\gis --commit
```
