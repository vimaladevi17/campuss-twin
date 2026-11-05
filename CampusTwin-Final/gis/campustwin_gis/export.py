"""GeoJSON export (EPSG:4326). Feature ids are the stable osm_id."""
import json
import geopandas as gpd
from .config import CRS


def to_geojson(gdf: gpd.GeoDataFrame, path: str):
    g = gdf.to_crs(CRS).copy()
    for c in g.columns:
        if c != "geometry" and g[c].dtype == "object":
            g[c] = g[c].where(g[c].notna(), None)
    fc = json.loads(g.to_json(drop_id=True, na="null"))
    fc["crs_note"] = "EPSG:4326 (WGS84 lon/lat)"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)
    return len(g)
