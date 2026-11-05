# CampusTwin API
Base URL `/api`. JSON. Auth: `Authorization: Bearer <token>`. Roles: admin > faculty > student (admin passes every role check).
Errors: `{ "message": "...", ...details }` with 400 validation, 401 login, 403 role, 404, 409 conflict.
List endpoints return arrays; add `?page=&limit=` for `{ items, total, page, pages }`. `?search=` and listed filters apply.

| Group | Endpoint | Access |
|---|---|---|
| Auth | POST /auth/register, /auth/login, GET /auth/me | public / any |
| Buildings | GET / , GET /:id (filters category,status,verification,search); GET /:id/overview (floors, rooms, live status); POST, PUT /:id, DELETE /:id (409 if it still has floors/rooms) | read public (overview: login), write admin |
| Floors | GET (filter building), GET /:id, POST, PUT, DELETE (409 if rooms) | read login, write admin |
| Rooms | GET (filters building,floor,type,operationalStatus,maintenanceStatus,search), POST, PUT, DELETE (409 if used by timetable/reservations); POST /:id/equipment, PUT /:id/equipment/:eid, DELETE /:id/equipment/:eid | read login, write admin |
| Facilities | GET (filters category,layer,status,accessibilityType,tag,search), POST, PUT, DELETE | read public, write admin |
| Courses / Paths / Layers | standard CRUD at /courses, /paths, /layers | read: courses login, paths+layers public; write admin |
| Timetable | GET (day, room, building, faculty, course, section, mine=true, date=YYYY-MM-DD -> applies approved room changes as `effective`), GET /:id, POST /validate (dry run), POST, PUT /:id, DELETE /:id | read login, write admin. Conflicts -> 409 `{ conflicts:[{code,message,entry}], warnings }` |
| Availability | GET /availability?at= (live status of all rooms); GET /availability/vacant?date&startTime&endTime&building&type&capacity&equipment=desktop_computer:30,projector; GET /availability/room/:id?date= | login |
| Maintenance | GET, POST (`analyze:true` also returns a replacement analysis), PUT /:id, DELETE /:id | read faculty+admin, write admin |
| Reservations | GET (own; admin all), POST (faculty -> pending; admin -> approved; 409 if clash), POST /:id/approve, /reject (admin), /cancel | faculty+admin |
| Replacements | POST /analyze `{room,startAt,endAt,reason?,weights?}`; GET; GET /:id; POST /:id/approve `{selections:[{occurrenceId,roomId}]}` or `{useSuggested:true}`; POST /:id/reject | admin |
| Map (GeoJSON) | GET /map/buildings, /map/facilities (category, layer=accessibility, tag, search), /map/boundary, /map/layers/:key, /map/paths | public |
| Settings | GET (public), PUT (admin): area, open-space %, scoring weights, walking speed, day hours | |
| Notifications | GET (own), POST /read-all, PATCH /:id/read, DELETE /:id | login, own only |
| Audit | GET /audit-logs?entity=&action=&page= | admin |
| Stats | GET /stats (original keys + `twin` block, all computed from MongoDB) | admin |
| Legacy (unchanged) | /users /students /faculty /labs /events /notices /attendance | as before |

## Realtime (Socket.IO)
Connect to the server origin (for example `http://localhost:5000`, not `/api`) and send the login token: `io(url, { auth: { token } })`.
A missing, forged, expired or role-less token is refused with `Authentication failed`.

Rooms the server puts a socket in automatically: `auth` (every signed-in socket), `user:<id>` (own notifications), `role:<role>`.
Clients can ask to `subscribe` only to `building:<id>` or `room:<id>` channels; any other room name is refused, so nobody can listen on another user's room.

| Event | Direction | Room | Payload |
|---|---|---|---|
| `notification:sync` | server to client, on every (re)connect | the socket | `{ unread, serverTime }`. The client then reloads the list over REST. |
| `notification:new` | server to client | `user:<id>` | the saved notification |
| `notification:read` | client to server `(id, ack)`, then broadcast to the user's own room | `user:<id>` | `{ id }`. Works only on the caller's own notifications. |
| `subscribe` / `unsubscribe` | client to server | | `"building:<24-hex id>"` or `"room:<24-hex id>"` |
| `<entity>:created / updated / deleted`, `availability:changed`, `timetable:changed`, `maintenance:created`, `replacement:created / approved / rejected` | server to client | `auth` | ids only, no personal data. Clients reload through REST. |

`type` is free text. In use: `class_room_changed`, `replacement_pending`, `replacement_approved`, `reservation_request`, `reservation_approved` / `reservation_rejected`, `timetable_changed`, `maintenance_update`.
Duplicates: each notification may carry a `dedupeKey`; a unique index on `(user, dedupeKey)` makes a retried action insert nothing the second time.
REST fallback: `GET /notifications` always works. The app polls it every 60 s only while the socket is disconnected.

## Walking distance in replacement results
`candidates[].walking.type` is `same_building`, `network` or `unavailable`.
`network` comes from the NetworkX matrix (`engine: "networkx"`) or, when a pair is missing there, from a path network built from `/paths` (`engine: "campuspath"`).
`unavailable` means no connected pedestrian route exists in the data: `meters` is `null`, the distance score is 0 and the reason is returned.
`straightLineMeters` is included for information only and is never used for scoring.
