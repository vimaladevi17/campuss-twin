# Migration

The old Lab and Timetable records stay in the database. The migration adds the new Room and Timetable references beside them. It never deletes anything and can be repeated.

1. Back up first. In MongoDB Atlas, use a snapshot (Atlas dashboard, Backup) or `mongodump --uri "<your uri>" --out backup-2026-11-03`.
2. Preview: `cd server` then `npm run migrate:dry`. Read the printed report.
3. Run: `npm run migrate`.
4. The printed report counts labs converted to rooms, timetable rows linked to a room or faculty member, rows flagged `needsReview` because no single match was found, and whether the scoring weights were updated. Rows flagged `needsReview` are fixed in the admin Timetables screen.

Scoring weights: older builds stored availability .40, equipment .30, capacity .20. The migration changes the stored weights to equipment .40, capacity .30, availability .20, distance .10 only when they still equal the old defaults. Weights an administrator edited are not touched. Admins can change weights under Settings.

Rollback: restore the backup from step 1.
