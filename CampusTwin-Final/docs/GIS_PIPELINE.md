# GIS pipeline

Code: `gis/campustwin_gis/`. Output: `data/gis/`. The extraction point (9.5743, 77.6761) and radius (1500 m) are approximate
extraction parameters. They are not a campus boundary.

## Install (Windows PowerShell)
```powershell
cd gis
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
If PowerShell blocks the activate script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Run
```powershell
cd gis
python -m campustwin_gis.cli --out ..\data\gis              # downloads from OpenStreetMap, needs internet
python -m campustwin_gis.cli --offline features.geojson paths.geojson --out ..\data\gis   # from saved files
python -m pytest -q                                          # pipeline tests
```

## Stages
1. Extract features (`ox.features_from_point`) and the walking graph (`ox.graph_from_point`, `network_type="walk"`).
2. Prepare: stable ids (`way/123`, `node/45`), category, name. Unnamed features are labelled "(unnamed OSM feature)"; names are never invented.
3. Repair invalid polygons with `make_valid` and list each repair in the report.
4. Building footprints stay polygons. Representative points go into a separate file.
5. Height: OSM `height` is used as is; otherwise floors times 3.5 m is marked `estimated_from_floors`; otherwise `unknown` (not extruded).
6. Duplicates (same name and category within 3 m) are reported and the later record is dropped from the output.
7. Walking distances: a NetworkX graph over walkable segments, all-pairs distances between named buildings. Pairs without a connected route get `meters: null`. There is no straight-line fallback.
8. Validation: CRS is EPSG:4326, geometry types, empty or invalid geometry, coordinates range, distance from the reference point, duplicate ids.

## Output files
`buildings.geojson`, `building_centroids.geojson`, `facilities.geojson`, `pedestrian_paths.geojson`, `pedestrian_network.geojson`,
`walking_distances.json`, `gis_validation_report.json` and `.md`, `gis_import_manifest.json`.
`campus_boundary.geojson` is only written when reliable boundary data exists. The pipeline currently does not fetch one, and the report says so.
Every feature carries `source: "OSM-derived"`. OSM data is community-contributed and has not been verified by the college.

## Import into MongoDB
```powershell
cd server
npm run import:gis                         # dry run: validates and reports, saves nothing
npm run import:gis -- ..\data\gis --commit   # saves; safe to repeat, no duplicates, nothing deleted
npm run import:gis -- ..\data\gis --commit --overwrite   # also replaces fields an admin edited
```
Records are matched by OSM id. Fields an administrator edited, and records marked `manual` or `verified_college`, are skipped unless `--overwrite` is given.
