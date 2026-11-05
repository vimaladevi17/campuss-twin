# CampusTwin: backend architecture (Phase 2)

## Data model
Campus -> **Building** -> **Floor** -> **Room** (classroom | laboratory | ...) -> equipment[].
Other collections: Facility, Course, Timetable, Reservation, MaintenanceRecord, AllocationChange, ReplacementRequest,
CampusPath (LineString), CampusLayer (boundary/water/...), CampusSettings, Notification, AuditLog.
Existing collections (User, Student, Faculty, Lab, Event, Notice, Attendance) are unchanged apart from `Lab.room`.

Geometry: Building.footprint (Polygon/MultiPolygon) is kept as supplied; Building.location (Point) is a separate marker point
(derived from the footprint if not given). Heights from floor count are stored with `heightSource: "estimated_from_floors"`.
Every imported record carries `source` and `verification` (verified_college | imported_excel | extracted_osm | digitized_master_plan | manual | estimated_unverified).

## Availability is calculated, never stored
A room is busy when any of these overlaps the window: timetable entry (weekday + date range), approved reservation,
maintenance record (room or whole building), room flagged inactive/under maintenance, or an approved room change
(which moves a class INTO the new room for that date only). Overlap is half-open, so 10-11 and 11-12 do not clash.
All times are Asia/Kolkata. Code: `services/availability.js`.

## Timetable
Original fields (day, time, subject, faculty, room, className) are kept. New structured fields (startMinutes, endMinutes, roomRef,
facultyRef, section, studentCount, dateFrom/dateTo, requiredEquipment ...) drive the checks. Creating/updating validates:
room double booking, faculty double booking, section double booking, capacity, room inactive/maintenance (errors -> HTTP 409), and
warns about maintenance/reservations on scheduled dates. Entries with only a text room are saved but marked `needsReview` and excluded
from checks until an admin links a Room.
Concurrency: check-then-write runs inside an in-process lock (`services/locks.js`). This is correct for one server process. For several
instances add a MongoDB transaction (needs a replica set) or a unique slot collection.

## Lab replacement (`services/replacement.js`)
1. Affected classes = effective allocations in the outage room overlapping the outage (per date).
2. Hard constraints (any failure rejects the room, with reasons): same room type, free for the whole slot, not under maintenance/inactive,
   capacity >= students, every required equipment type has enough WORKING units, all special facilities present.
3. Scores 0-100: **A** free = 60, +20 if free 15 min before, +20 if free 15 min after. **E** 70 when requirements met, +15 same lab category,
   +15 scaled by spare working equipment. **C** 100 when 60-100% full, falls to 0 at 20% full. **D** 100 at 0 m to 0 at `maxRecommendedWalkM`
   (1000 m); unknown distance scores 0 and is flagged.
   `Score = 0.40A + 0.30E + 0.20C + 0.10D` (weights in CampusSettings, normalised, admin-editable via PUT /api/settings).
4. Greedy suggestion so two simultaneous classes are not sent to the same room.
5. Nothing changes until an admin approves. Approval re-validates against fresh data inside locks, is all-or-nothing, then writes one
   AllocationChange per class per date (unique per timetable entry + date), keeps the original Timetable entry untouched,
   records approver/time/reason, notifies affected faculty and admins, writes the audit log and emits realtime events.

## Walking distance (`services/distance.js`)
`network` = shortest path (NetworkX matrix from the GIS pipeline first, else Dijkstra over CampusPath data); `unavailable` = no connected pedestrian route, so meters is null and the distance score is 0 (straight-line is shown for information only).
distance, labelled as NOT a walking route; `same_building`; `unknown`. No CampusPath data exists yet, so today distances are approximate.
The Python/NetworkX service (Phase 3) will populate CampusPath; the Node code then switches to `network` automatically.

## Known limitations at this stage
* DB-backed code paths were not executed against a live MongoDB in the development sandbox (none available). Pure logic, schemas,
  importer, validation and authorization are covered by tests; run the integration checklist in docs/PROGRESS.md against your database.
* JWT role is trusted until expiry (7 days). Demoting a user does not revoke an existing token; re-checking the role per request is planned.
* Socket.IO is not attached yet (`utils/realtime.js` is the hook; events are already emitted at every write).
