"""Command line:  python -m campustwin_gis.cli --out ../data/gis            (needs internet)
                  python -m campustwin_gis.cli --offline raw.geojson edges.geojson --out ../data/gis"""
import argparse
import geopandas as gpd
from . import pipeline, network as N
from .config import REF_LAT, REF_LON, RADIUS_M


def main(argv=None):
    ap = argparse.ArgumentParser(description="CampusTwin GIS pipeline")
    ap.add_argument("--out", default="../data/gis")
    ap.add_argument("--lat", type=float, default=REF_LAT)
    ap.add_argument("--lon", type=float, default=REF_LON)
    ap.add_argument("--radius", type=int, default=RADIUS_M)
    ap.add_argument("--offline", nargs=2, metavar=("FEATURES_GEOJSON", "PATHS_GEOJSON"),
                    help="use saved GeoJSON instead of downloading (features, then walkable path lines)")
    a = ap.parse_args(argv)
    if a.offline:
        raw = gpd.read_file(a.offline[0]); paths = gpd.read_file(a.offline[1]); note = "local files (offline mode)"
    else:
        raw, graph = pipeline.extract_osm(a.lat, a.lon, a.radius)
        paths = N.paths_from_edges(N.edges_to_gdf(graph)); note = "OpenStreetMap via OSMnx"
    res = pipeline.run(raw, paths, a.out, note)
    print("Written:", res["counts"])
    print("All layers valid:", res["report"]["all_layers_ok"])


if __name__ == "__main__":
    main()
