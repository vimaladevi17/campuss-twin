import json, os, sys
import pytest
import geopandas as gpd
from shapely.geometry import Polygon, Point, LineString, box

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from campustwin_gis import processing as P, network as N, validation as V, pipeline
from campustwin_gis.classify import classify
from campustwin_gis.config import REF_LAT, REF_LON

D = 0.0005  # about 55 m


def sq(dx, dy, s=0.0002):
    x, y = REF_LON + dx, REF_LAT + dy
    return box(x, y, x + s, y + s)


def raw_features():
    rows = [
        {"osm_id": "way/1", "name": "Academic Block 8", "building": "university", "levels": "6", "geometry": sq(0, 0)},
        {"osm_id": "way/2", "name": "Academic Block 9", "building": "university", "height": "21 m", "geometry": sq(D * 2, 0)},
        {"osm_id": "way/3", "name": "Far Hostel", "building": "dormitory", "geometry": sq(D * 2, D * 8)},
        # bowtie = invalid polygon
        {"osm_id": "way/4", "name": "Odd Shed", "building": "yes", "geometry": Polygon([(REF_LON, REF_LAT + D * 4), (REF_LON + 0.0002, REF_LAT + D * 4 + 0.0002), (REF_LON + 0.0002, REF_LAT + D * 4), (REF_LON, REF_LAT + D * 4 + 0.0002)])},
        {"osm_id": "node/5", "name": "Main Canteen", "amenity": "canteen", "geometry": Point(REF_LON + D, REF_LAT + D)},
        {"osm_id": "node/6", "name": "Main Canteen", "amenity": "canteen", "geometry": Point(REF_LON + D, REF_LAT + D + 0.00001)},
        {"osm_id": "node/7", "name": None, "highway": "bus_stop", "geometry": Point(REF_LON - D, REF_LAT)},
    ]
    g = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")
    g["osmid_idx"] = range(len(g))
    return g


def raw_with_index():
    g = raw_features()
    ids = g["osm_id"].tolist()
    g = g.drop(columns=["osm_id", "osmid_idx"])
    import pandas as pd
    g.index = pd.MultiIndex.from_tuples([(i.split("/")[0], int(i.split("/")[1])) for i in ids], names=["element", "id"])
    g.columns = [c if c != "levels" else "building:levels" for c in g.columns]
    return g


def paths():
    rows = [  # connects block 8 and block 9 only; the hostel is isolated
        {"osm_id": "way/10", "name": None, "highway": "footway", "path_type": "footpath", "accessible": True, "walkable": True, "length_m": 100, "source": "OSM-derived",
         "geometry": LineString([(REF_LON + 0.0001, REF_LAT + 0.0001), (REF_LON + D * 2 + 0.0001, REF_LAT + 0.0001)])},
        {"osm_id": "way/11", "name": None, "highway": "steps", "path_type": "stairs", "accessible": False, "walkable": True, "length_m": 5, "source": "OSM-derived",
         "geometry": LineString([(REF_LON + D * 2 + 0.0001, REF_LAT + 0.0001), (REF_LON + D * 2 + 0.0001, REF_LAT + D * 3)])},
    ]
    return gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")


def test_classification_rules():
    assert classify({"amenity": "canteen"}) == "food"
    assert classify({"highway": "bus_stop"}) == "transport"
    assert classify({"building": "dormitory", "name": "Men's Hostel 1"}) == "hostel"
    assert classify({"amenity": "laboratory"}) == "laboratory"
    assert classify({"building": "university"}) == "academic"
    assert classify({"amenity": "place_of_worship"}) == "religious"
    assert classify({"leisure": "pitch"}) == "sports"
    assert classify({"amenity": "parking"}) == "parking"


def test_polygons_are_preserved_and_centroids_are_separate():
    g, _ = P.fix_geometries(P.prepare(raw_with_index()))
    b = P.split_buildings(g)
    assert set(b.geometry.geom_type) <= {"Polygon", "MultiPolygon"}
    c = P.centroids(b)
    assert set(c.geometry.geom_type) == {"Point"}
    for (_, bi), (_, ci) in zip(b.iterrows(), c.iterrows()):
        assert bi.geometry.contains(ci.geometry) or bi.geometry.touches(ci.geometry)


def test_invalid_geometry_is_repaired_and_reported():
    _, issues = P.fix_geometries(P.prepare(raw_with_index()))
    assert any(i["osm_id"] == "way/4" for i in issues)


def test_stable_ids_from_osm_index():
    g = P.prepare(raw_with_index())
    assert "way/1" in set(g["osm_id"]) and "node/5" in set(g["osm_id"])


def test_height_labelling():
    b = P.split_buildings(P.prepare(raw_with_index()))
    b = b.set_index("osm_id")
    assert b.loc["way/2", "height_source"] == "osm" and b.loc["way/2", "height_m"] == 21
    assert b.loc["way/1", "height_source"] == "estimated_from_floors" and b.loc["way/1", "height_m"] == 21.0
    assert b.loc["way/3", "height_source"] == "unknown" and b.loc["way/3", "height_m"] != b.loc["way/3", "height_m"]  # NaN


def test_duplicate_detection_reports_and_removes_second_record():
    g = P.prepare(raw_with_index())
    f = P.facilities(g, P.split_buildings(g))
    d = P.find_duplicates(f)
    assert list(d["osm_id"]) == ["node/6"] and d.iloc[0]["duplicate_of"] == "node/5"
    assert "node/6" not in set(P.drop_duplicates(f, d)["osm_id"])


def test_unnamed_features_are_labelled_not_invented():
    g = P.prepare(raw_with_index())
    row = g[g.osm_id == "node/7"].iloc[0]
    assert "unnamed" in row["name"].lower() and not row["has_real_name"]


def test_walking_distance_uses_graph_and_reports_missing_route():
    g = P.prepare(raw_with_index())
    cent = P.centroids(P.split_buildings(g))
    cent = cent[cent.osm_id.isin(["way/1", "way/2", "way/3"])]
    graph = N.build_graph(paths())
    m = N.distance_matrix(graph, cent)
    by = {(p["from"], p["to"]): p for p in m["pairs"]}
    ok = by[("way/1", "way/2")]
    assert ok["route"] == "network" and 80 < ok["meters"] < 200
    # hostel is farther than the snap limit from every path: it must be unsnapped, never a straight-line guess
    assert "way/3" in m["unsnapped"]


def test_accessible_graph_excludes_steps():
    full = N.build_graph(paths())
    step_free = N.build_graph(paths(), accessible_only=True)
    assert full.number_of_edges() > step_free.number_of_edges()


def test_pipeline_outputs_epsg4326_manifest_and_report(tmp_path):
    out = str(tmp_path)
    res = pipeline.run(raw_with_index(), paths(), out)
    for f in ["buildings.geojson", "building_centroids.geojson", "facilities.geojson", "pedestrian_paths.geojson",
              "pedestrian_network.geojson", "gis_validation_report.json", "gis_validation_report.md", "gis_import_manifest.json", "walking_distances.json"]:
        assert os.path.exists(os.path.join(out, f)), f
    assert not os.path.exists(os.path.join(out, "campus_boundary.geojson"))  # no reliable boundary data -> not produced
    man = json.load(open(os.path.join(out, "gis_import_manifest.json")))
    assert man["crs"] == "EPSG:4326" and man["provenance_label"] == "OSM-derived"
    b = gpd.read_file(os.path.join(out, "buildings.geojson"))
    assert set(b.geometry.geom_type) <= {"Polygon", "MultiPolygon"} and (b["source"] == "OSM-derived").all()
    assert res["report"]["all_layers_ok"], res["report"]["layers"]


def test_validation_flags_wrong_crs_and_far_features():
    bad = gpd.GeoDataFrame({"osm_id": ["a"]}, geometry=[Point(500000, 1000000)], crs="EPSG:32643")
    r = V.check_layer("x", bad, ("Point",))
    assert any("CRS" in p for p in r["problems"])
    far = gpd.GeoDataFrame({"osm_id": ["a"]}, geometry=[Point(REF_LON + 0.5, REF_LAT)], crs="EPSG:4326")
    assert any("radius" in p for p in V.check_layer("x", far, ("Point",))["problems"])
