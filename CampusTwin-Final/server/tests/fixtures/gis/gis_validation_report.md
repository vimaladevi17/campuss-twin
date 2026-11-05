# GIS validation report

Generated: 2026-11-03T07:40:36.853271+00:00

Reference point: 9.5743, 77.6761, radius 1500 m (approximate, not an official boundary).

| Layer | Features | Problems |
|---|---|---|
| buildings.geojson | 4 | none |
| building_centroids.geojson | 4 | none |
| facilities.geojson | 5 | none |
| pedestrian_paths.geojson | 2 | none |
| pedestrian_network.geojson | 2 | none |

**duplicates_removed**: {'buildings': 0, 'facilities': 1}

**geometry_repairs**: [{'osm_id': 'way/4', 'problem': 'Self-intersection[77.6762 9.5764]', 'action': 'repaired with make_valid'}]

**campus_boundary**: not generated: no reliable boundary data was extracted (the radius is not a boundary)
