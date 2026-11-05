# Tests

Tests sit next to the code they check.

| Area | Location | Run |
|---|---|---|
| Backend unit, API guards, frontend-to-backend route contract, Socket.IO auth, GIS importer, legacy smoke test | `server/tests/` | `cd server; npm test` |
| Frontend (forms, role menus, timetable, vacancy, replacement, map page, admin pages) | `client/src/**/*.test.*` | `cd client; npm test` |
| GIS pipeline | `gis/tests/` | `cd gis; python -m pytest -q` |
| Startup (server, API, socket handshake, MongoDB when `MONGO_URI` is set) | `server/scripts/validateStartup.js` | `cd server; npm run validate:startup` |

`scripts\test-all.ps1` runs all of them. None of the automated tests need a database.
Database-backed paths (migration commits, importer commits against real MongoDB) are covered by in-memory stand-ins in the tests
and by the manual checklist in `docs/PROGRESS.md`.
