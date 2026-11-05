"""Turn raw OSM features into campus datasets. Building polygons are kept; representative
points are produced as a SEPARATE dataset and never replace the polygon."""
from __future__ import annotations
import re
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from shapely.validation import explain_validity, make_valid

from .classify import classify, DB_FACILITY_CATEGORY
from .config import CRS, METRIC_CRS, SRC_OSM, ESTIMATED_FLOOR_HEIGHT_M

KEEP = ["name", "name:en", "building", "amenity", "shop", "leisure", "public_transport", "highway", "tourism",
        "operator", "addr:street", "building:levels", "height", "wheelchair", "ele"]


def stable_id(index) -> str:
    """OSM index is (element_type, osmid). Gives e.g. 'way/123' so imports are repeatable."""
    if isinstance(index, tuple) and len(index) == 2:
        return f"{index[0]}/{index[1]}"
    return str(index)


def _num(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    m = re.match(r"^\s*(\d+(?:\.\d+)?)", str(v))
    return float(m.group(1)) if m else None


def prepare(raw: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Keep useful columns, give each feature a stable id, a category and a clean name."""
    gdf = raw.copy()
    if "osm_id" in gdf.columns:
        pass  # already supplied (e.g. re-processing saved GeoJSON)
    else:
        gdf["osm_id"] = [stable_id(i) if isinstance(i, tuple) else f"feature/{i}" for i in gdf.index]
    gdf = gdf.reset_index(drop=True)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    cols = [c for c in KEEP if c in gdf.columns]
    gdf = gdf[["osm_id", *cols, "geometry"]].copy()
    if gdf.crs is None:
        gdf = gdf.set_crs(CRS)
    gdf = gdf.to_crs(CRS)
    if "name:en" in gdf.columns:
        gdf["name"] = gdf["name"].fillna(gdf["name:en"]) if "name" in gdf.columns else gdf["name:en"]
    if "name" not in gdf.columns:
        gdf["name"] = None
    gdf["category"] = gdf.apply(classify, axis=1)
    gdf["has_real_name"] = gdf["name"].notna()
    gdf["name"] = gdf["name"].fillna(gdf["category"].str.replace("_", " ").str.title() + " (unnamed OSM feature)")
    gdf["source"] = SRC_OSM
    return gdf


def fix_geometries(gdf: gpd.GeoDataFrame):
    """Repair invalid polygons with make_valid. Returns (gdf, list of issues)."""
    issues, out = [], []
    for idx, g in gdf.geometry.items():
        if not g.is_valid:
            issues.append({"osm_id": gdf.at[idx, "osm_id"], "problem": explain_validity(g), "action": "repaired with make_valid"})
            g = make_valid(g)
        out.append(g)
    gdf = gdf.copy()
    gdf["geometry"] = out
    return gdf, issues


def split_buildings(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Building footprints: polygon features that carry a building tag."""
    has_b = gdf["building"].notna() if "building" in gdf.columns else pd.Series(False, index=gdf.index)
    poly = gdf.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
    b = gdf[has_b & poly].copy()
    if "building:levels" in b.columns:
        b["levels"] = b["building:levels"].map(_num)
    else:
        b["levels"] = None
    h = b["height"].map(_num) if "height" in b.columns else pd.Series([None] * len(b), index=b.index)
    b["db_category"] = b["category"].map(DB_FACILITY_CATEGORY).fillna("other")
    b["height_m"] = h
    b["height_source"] = ["osm" if pd.notna(x) else "unknown" for x in h]
    est = b["height_m"].isna() & b["levels"].notna()
    b.loc[est, "height_m"] = b.loc[est, "levels"] * ESTIMATED_FLOOR_HEIGHT_M
    b.loc[est, "height_source"] = "estimated_from_floors"
    return b


def centroids(buildings: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Representative points (always inside the polygon) as their own dataset."""
    c = buildings[["osm_id", "name", "category", "source"]].copy()
    c["geometry"] = buildings.geometry.representative_point()
    return gpd.GeoDataFrame(c, geometry="geometry", crs=CRS)


def facilities(gdf: gpd.GeoDataFrame, buildings: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Point features for the map: amenities, shops, transport. Plain 'building' footprints are
    not facilities; footprints that carry a named amenity/category are, using their representative point."""
    mask = gdf["category"].ne("building")
    f = gdf[mask].copy()
    f["geometry"] = f.geometry.representative_point()
    f["db_category"] = f["category"].map(DB_FACILITY_CATEGORY).fillna("other")
    return f


def find_duplicates(gdf: gpd.GeoDataFrame, tolerance_m: float = 3.0) -> pd.DataFrame:
    """Same name + category within tolerance_m of each other. Reported, not deleted."""
    if gdf.empty:
        return pd.DataFrame(columns=["osm_id", "duplicate_of", "distance_m"])
    m = gdf.to_crs(METRIC_CRS)
    pts = m.geometry.representative_point()
    rows, seen = [], []
    for i, (idx, p) in enumerate(pts.items()):
        for j_idx, j_pt, in seen:
            if m.at[idx, "name"] == m.at[j_idx, "name"] and m.at[idx, "category"] == m.at[j_idx, "category"]:
                d = p.distance(j_pt)
                if d <= tolerance_m:
                    rows.append({"osm_id": m.at[idx, "osm_id"], "duplicate_of": m.at[j_idx, "osm_id"], "distance_m": round(d, 2)})
                    break
        seen.append((idx, p))
    return pd.DataFrame(rows, columns=["osm_id", "duplicate_of", "distance_m"])


def drop_duplicates(gdf: gpd.GeoDataFrame, dupes: pd.DataFrame) -> gpd.GeoDataFrame:
    return gdf[~gdf["osm_id"].isin(set(dupes["osm_id"]))].copy() if len(dupes) else gdf
