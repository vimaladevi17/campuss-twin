# Database models (MongoDB, Mongoose)

All relations use ObjectId references. Models live in `server/models/`.

| Model | Purpose | Key fields and indexes |
|---|---|---|
| Building | Campus building | `code` (unique), `name`, `category`, `location` (Point), `footprint` (Polygon/MultiPolygon, kept as imported), `floorsCount`, `heightM` + `heightSource` (`osm`, `estimated_from_floors`, `unknown`), `osmId` (unique when set), `adminEditedFields`, `source`, `verification`, `isDemo`. 2dsphere on `location` and `footprint`. |
| Floor | Floor of a building | `building` ref, `level`, unique `(building, level)` |
| Room | Classroom, lab, office | `building` and `floor` refs, `roomNumber`, `type`, `capacity`, `equipment[]`, `facilities`, `accessible`, `operationalStatus`, `maintenanceStatus`. Unique `(building, roomNumber)`. |
| Facility | Canteen, toilet, ramp, parking, bus stop | `category`, `layer`, `accessibilityType`, `location` (Point, 2dsphere), `importKey` (unique), `adminEditedFields` |
| CampusPath | Walkable segment | `geometry` (LineString), `pathType`, `accessible`, `walkable`, `osmId` (segment id, unique when set) |
| WalkingDistance | NetworkX distance between two buildings | `a`, `b` (Building.osmId, stored in sorted order), `meters` (null = no connected route), `route`. Unique `(a, b)`. |
| Timetable | Class slot | `roomRef`, `facultyRef`, `courseRef`, `day`, `startMinutes`, `endMinutes`, `section`, `needsReview`. Conflict checks run before every save. Legacy text fields are kept. |
| Reservation | Room booking | `room`, `date`, `startMinutes`, `endMinutes`, `status` (`pending`, `approved`, `rejected`, `cancelled`), `requestedBy` |
| MaintenanceRecord | Room or building out of service | `room` or `building`, `startAt`, `endAt`, `reason`, `status` |
| ReplacementRequest | Outage analysis awaiting a decision | `room` or `maintenance`, `startAt`, `endAt`, `weights`, `occurrences[]` (each with `timetable`, `date`, ranked `candidates[]` with score breakdown, equipment and capacity comparison and walking result, plus `rejected[]`, `suggestedRoom`, `selectedRoom`, `decision`), `status`, `decidedBy` |
| AllocationChange | Approved room change for one date | `timetable`, `date`, `originalRoom`, `newRoom`, `replacementRequest`, `approvedBy`, `status` |
| Notification | Per-user message | `user`, `type`, `title`, `message`, `link`, `readAt`, `dedupeKey` |
| AuditLog | Administrative history | `actor`, `actorName`, `action`, `entity`, `entityId`, `details`, `createdAt` |
| CampusSettings | One document | reference point, area, scoring weights (default equipment .40, capacity .30, availability .20, distance .10), walking speed |
| Course, CampusLayer, User, Student, Faculty, Lab, Event, Notice, Attendance | Course catalogue, map layers, accounts, and the original portal modules | unchanged from the original portal |

Verification labels: `extracted_osm` (OSM-derived, not verified by the college), `manual`, `verified_college`, `demo`, `estimated`.
Records flagged `isDemo` show a DEMO badge in the interface.
