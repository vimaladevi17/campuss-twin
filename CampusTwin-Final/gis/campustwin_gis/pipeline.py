"""End-to-end run. `run(raw_features, raw_graph_or_paths, out_dir)` is pure of network access so it
can be tested offline; `extract_osm()` is the only function that talks to OpenStreetMap."""
from __future__ import annotations
import json, os
from datetime import datetime, timezone
import geopandas as gpd
import pandas as pd

from . import processing as P, network as N, validation as V
from .config import REF_LAT, REF_LON, RADIUS_M, OSM_TAGS, CRS
from .export import to_geojson


def extract_osm(lat=REF_LAT, lon=REF_LON, radius=RADIUS_M):
    """Download features and the walking graph. Needs internet (Overpass API)."""
    import osmnx as ox
    raw = ox.features_from_point((lat, lon), tags=OSM_TAGS, dist=radius)
    graph = ox.graph_from_point((lat, lon), dist=radius, network_type="walk", simplify=True)
    return raw, graph


def run(raw: gpd.GeoDataFrame, paths: gpd.GeoDataFrame, out_dir: str, source_note: str = "OpenStreetMap via OSMnx") -> dict:
    os.makedirs(out_dir, exist_ok=True)
    gdf = P.prepare(raw)
    gdf, issues = P.fix_geometries(gdf)
    buildings = P.split_buildings(gdf)
    dupes = P.find_duplicates(buildings)
    buildings = P.drop_duplicates(buildings, dupes)
    gdf = gdf[~gdf["osm_id"].isin(set(dupes["osm_id"]))]
    cent = P.centroids(buildings)
    fac = P.facilities(gdf, buildings)
    fdupes = P.find_duplicates(fac)
    fac = P.drop_duplicates(fac, fdupes)

    graph = N.build_graph(paths)
    graph_info = {"nodes": graph.number_of_nodes(), "edges": graph.number_of_edges()}
    import networkx as nx
    graph_info["components"] = nx.number_connected_components(graph) if graph.number_of_nodes() else 0
    matrix = N.distance_matrix(graph, cent[cent["osm_id"].isin(set(buildings[buildings["has_real_name"]]["osm_id"]))]) if graph.number_of_nodes() else {"pairs": [], "unsnapped": [], "note": "no pedestrian graph"}

    # Pedestrian network = walkable segments as lines; paths = footways/steps only.
    foot = paths[paths["highway"].isin(["footway", "path", "pedestrian", "steps", "corridor", "crossing", "cycleway"])]

    outputs = {
        "buildings.geojson": (buildings.drop(columns=[c for c in ["building:levels"] if c in buildings.columns]), ("Polygon", "MultiPolygon")),
        "building_centroids.geojson": (cent, ("Point",)),
        "facilities.geojson": (fac, ("Point",)),
        "pedestrian_paths.geojson": (foot, ("LineString",)),
        "pedestrian_network.geojson": (paths, ("LineString",)),
    }
    counts = {}
    for name, (g, _) in outputs.items():
        counts[name] = to_geojson(g, os.path.join(out_dir, name))

    with open(os.path.join(out_dir, "walking_distances.json"), "w", encoding="utf-8") as f:
        json.dump(matrix, f)

    # Campus boundary: only if reliable data exists. OSM landuse polygons tagged as the university are
    # not fetched here, so no boundary is produced and the report says so.
    boundary = "not generated: no reliable boundary data was extracted (the radius is not a boundary)"

    report = V.build_report({n: (g, e) for n, (g, e) in outputs.items()},
                            {"duplicates_removed": {"buildings": int(len(dupes)), "facilities": int(len(fdupes))},
                             "geometry_repairs": issues, "campus_boundary": boundary,
                             "pedestrian_graph": graph_info,
                             "building_heights": {"osm": int((buildings["height_source"] == "osm").sum()),
                                                  "estimated_from_floors": int((buildings["height_source"] == "estimated_from_floors").sum()),
                                                  "unknown": int((buildings["height_source"] == "unknown").sum())},
                             "category_counts": fac["category"].value_counts().to_dict(),
                             "unconnected_building_pairs": sum(1 for p in matrix["pairs"] if p["meters"] is None)})
    V.write_report(report, os.path.join(out_dir, "gis_validation_report.json"), os.path.join(out_dir, "gis_validation_report.md"))

    manifest = {"generated_at": datetime.now(timezone.utc).isoformat(), "source": source_note, "provenance_label": "OSM-derived",
                "crs": CRS, "reference_point": {"lat": REF_LAT, "lon": REF_LON, "radius_m": RADIUS_M},
                "verification_statement": "OSM data is community-contributed and has NOT been verified by the college.",
                "files": {n: {"features": c, "idField": "osm_id"} for n, c in counts.items()},
                "walking_distances": {"file": "walking_distances.json", "pairs": len(matrix["pairs"])}}
    with open(os.path.join(out_dir, "gis_import_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    return {"counts": counts, "report": report, "manifest": manifest}
