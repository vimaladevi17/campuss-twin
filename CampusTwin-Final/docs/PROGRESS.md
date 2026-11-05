# Progress checklist
## Phase 1 audit: done
## Phase 2 backend + database
- [x] Models: Building, Floor, Room(+equipment), Facility, Course, Reservation, MaintenanceRecord, CampusPath, CampusLayer, CampusSettings, AllocationChange, ReplacementRequest, Notification, AuditLog; Timetable and Lab extended without removing fields
- [x] REST APIs + validation + role checks + referential-integrity guards (see API.md)
- [x] Scheduling conflict detection, vacancy calculation, replacement engine, approval with audit/notifications
- [x] Excel facility importer (dry-run default, idempotent, protects verified/admin-edited data); verified on the real 58-row workbook
- [x] Non-destructive legacy Lab/Timetable migration; labelled DEMO seed (coordinates from Excel, everything else invented and flagged)
- [x] helmet, login rate limit, .env.example, .env git-ignored
- [x] Tests: 69 new (logic, schemas, importer, API guards) + original smoke test, all passing
- [ ] Integration run against YOUR MongoDB (see below)
## Integration checklist to run once against MongoDB (cd server)
1. `cp .env.example .env`, fill MONGO_URI (NEW rotated credentials), JWT_SECRET, ADMIN_*; `npm install`; `npm run seed`
2. `npm run migrate:dry` then `npm run migrate`
3. `npm run import:facilities -- <xlsx>` (dry run) then add `--commit`; run commit twice, the count must not change
4. `npm run seed:twin-demo -- <xlsx>`, `npm start`, log in as admin
5. POST /api/timetable twice with the same room/time -> second must return 409
6. POST /api/maintenance for CL-1 Monday 10:00-12:00 IST with `analyze:true` -> CL-4 recommended, others rejected with reasons
7. POST /api/replacements/:id/approve with `useSuggested:true`; GET /api/timetable?date=<that Monday> shows the effective room; /api/availability/vacant shows CL-4 busy
## Next
- [ ] Phase 2b: CRA -> Vite + Tailwind migration, new sidebar shell, connect existing pages (Labs, Faculty, Campus, home stats) to the API
- [ ] Phase 3: improved Python OSM extractor + pedestrian graph; master plan / accessibility map layers
- [ ] Phases 4-10 as agreed
