"""Validation report for the generated datasets."""
from __future__ import annotations
import json
from datetime import datetime, timezone
import geopandas as gpd

from .config import CRS, REF_LAT, REF_LON, RADIUS_M, METRIC_CRS
from shapely.geometry import Point


def check_layer(name: str, gdf: gpd.GeoDataFrame, expect: tuple) -> dict:
    n = len(gdf)
    r = {"layer": name, "features": n, "crs": str(gdf.crs) if gdf.crs else None, "problems": []}
    if n == 0:
        r["problems"].append("layer is empty")
        return r
    if gdf.crs is None or gdf.crs.to_string().upper() != CRS:
        r["problems"].append(f"CRS is {gdf.crs}, expected {CRS}")
    bad_type = int((~gdf.geometry.geom_type.isin(expect)).sum())
    if bad_type:
        r["problems"].append(f"{bad_type} feature(s) with unexpected geometry type (expected {'/'.join(expect)})")
    empty = int(gdf.geometry.is_empty.sum() + gdf.geometry.isna().sum())
    if empty:
        r["problems"].append(f"{empty} empty geometry")
    invalid = int((~gdf.geometry.is_valid).sum())
    if invalid:
        r["problems"].append(f"{invalid} invalid geometry")
    b = gdf.total_bounds
    if not (-180 <= b[0] <= 180 and -180 <= b[2] <= 180 and -90 <= b[1] <= 90 and -90 <= b[3] <= 90):
        r["problems"].append("coordinates outside lon/lat range (wrong CRS or swapped axes?)")
    ref = gpd.GeoSeries([Point(REF_LON, REF_LAT)], crs=CRS).to_crs(METRIC_CRS).iloc[0]
    far = int((gdf.to_crs(METRIC_CRS).geometry.representative_point().distance(ref) > RADIUS_M * 1.5).sum())
    if far:
        r["problems"].append(f"{far} feature(s) more than 1.5x the extraction radius from the reference point")
    if "osm_id" in gdf.columns:
        dup_ids = int(gdf["osm_id"].duplicated().sum())
        if dup_ids:
            r["problems"].append(f"{dup_ids} duplicate osm_id")
    r["bounds"] = [round(float(x), 6) for x in b]
    return r


def build_report(layers: dict, extra: dict) -> dict:
    results = [check_layer(n, g, e) for n, (g, e) in layers.items()]
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "reference_point": {"lat": REF_LAT, "lon": REF_LON, "radius_m": RADIUS_M,
            "note": "Approximate extraction parameters, not an official campus boundary."},
            "all_layers_ok": all(not r["problems"] for r in results if r["features"] > 0), "layers": results, **extra}


def write_report(report: dict, path_json: str, path_md: str):
    with open(path_json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    lines = ["# GIS validation report", "", f"Generated: {report['generated_at']}", "",
             f"Reference point: {report['reference_point']['lat']}, {report['reference_point']['lon']}, radius {report['reference_point']['radius_m']} m (approximate, not an official boundary).", "",
             "| Layer | Features | Problems |", "|---|---|---|"]
    for r in report["layers"]:
        lines.append(f"| {r['layer']} | {r['features']} | {'; '.join(r['problems']) or 'none'} |")
    for k in ("duplicates_removed", "geometry_repairs", "campus_boundary", "notes"):
        if k in report:
            lines += ["", f"**{k}**: {report[k]}"]
    with open(path_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
