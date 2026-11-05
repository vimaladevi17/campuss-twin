"""Pedestrian network and building-to-building walking distances (NetworkX).
Distances use graph paths. If two buildings are not connected, the distance is reported as null
with reason 'no_connected_route'; it is never replaced by a straight-line value."""
from __future__ import annotations
import math
import geopandas as gpd
import networkx as nx
from shapely.geometry import LineString, Point

from .config import CRS, METRIC_CRS, SRC_OSM

WALK_HIGHWAYS = {"footway", "path", "pedestrian", "steps", "living_street", "residential", "service",
                 "track", "unclassified", "tertiary", "secondary", "primary", "cycleway", "corridor", "crossing"}


def edges_to_gdf(graph) -> gpd.GeoDataFrame:
    """OSMnx graph -> edge GeoDataFrame in EPSG:4326."""
    import osmnx as ox
    edges = ox.graph_to_gdfs(graph, nodes=False).reset_index()
    return edges.to_crs(CRS)


def paths_from_edges(edges: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """One feature per walkable segment, with path type and a step-free flag (False for steps)."""
    def first(v):
        return v[0] if isinstance(v, list) and v else v
    rows = []
    n = 0
    for _, e in edges.iterrows():
        hw = str(first(e.get("highway", "")) or "")
        geom = e.geometry
        if geom is None or geom.is_empty or geom.geom_type != "LineString":
            continue
        ptype = "stairs" if hw == "steps" else "road" if hw in ("residential", "service", "tertiary", "secondary", "primary", "unclassified", "living_street", "track") else "crossing" if hw == "crossing" else "footpath"
        u, v = e.get("u"), e.get("v")
        n += 1
        rows.append({"osm_id": f"way/{first(e.get('osmid'))}", "segment_id": f"way/{first(e.get('osmid'))}#{n}", "name": first(e.get("name")) if e.get("name") == e.get("name") else None,
                     "highway": hw, "path_type": ptype, "accessible": hw != "steps", "walkable": True,
                     "length_m": float(e.get("length", 0) or 0), "source": SRC_OSM, "geometry": geom})
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=CRS)


def build_graph(paths: gpd.GeoDataFrame, accessible_only: bool = False) -> nx.Graph:
    """Undirected graph whose nodes are rounded lon/lat vertices and whose edge weights are metres."""
    g = nx.Graph()
    m = paths.to_crs(METRIC_CRS)
    for (_, row), (_, row_m) in zip(paths.iterrows(), m.iterrows()):
        if not row["walkable"] or (accessible_only and not row["accessible"]):
            continue
        ll = list(row.geometry.coords)
        mm = list(row_m.geometry.coords)
        for i in range(len(ll) - 1):
            a, b = (round(ll[i][0], 7), round(ll[i][1], 7)), (round(ll[i + 1][0], 7), round(ll[i + 1][1], 7))
            if a == b:
                continue
            d = math.dist(mm[i], mm[i + 1])
            if g.has_edge(a, b):
                d = min(d, g[a][b]["weight"])
            g.add_edge(a, b, weight=d, path_type=row["path_type"])
    return g


def snap(graph: nx.Graph, point: Point, max_snap_m: float = 150.0):
    """Nearest graph node within max_snap_m metres, else None."""
    if graph.number_of_nodes() == 0:
        return None
    pm = gpd.GeoSeries([point], crs=CRS).to_crs(METRIC_CRS).iloc[0]
    nodes = list(graph.nodes)
    nm = gpd.GeoSeries([Point(n) for n in nodes], crs=CRS).to_crs(METRIC_CRS)
    d = nm.distance(pm)
    i = int(d.values.argmin())
    return (nodes[i], float(d.iloc[i])) if d.iloc[i] <= max_snap_m else None


def distance_matrix(graph: nx.Graph, places: gpd.GeoDataFrame, key: str = "osm_id", max_snap_m: float = 150.0) -> dict:
    """All-pairs walking distances between place points. Result is JSON-serialisable."""
    snapped = {}
    for _, r in places.iterrows():
        s = snap(graph, r.geometry, max_snap_m)
        snapped[r[key]] = s
    comp = {}
    for ci, nodes in enumerate(nx.connected_components(graph)):
        for n in nodes:
            comp[n] = ci
    pairs = []
    ids = list(snapped)
    for i, a in enumerate(ids):
        sa = snapped[a]
        if sa is None:
            continue
        lengths = nx.single_source_dijkstra_path_length(graph, sa[0], weight="weight")
        for b in ids[i + 1:]:
            sb = snapped[b]
            if sb is None:
                continue
            if sb[0] in lengths:
                pairs.append({"from": a, "to": b, "meters": round(lengths[sb[0]] + sa[1] + sb[1], 1), "route": "network"})
            else:
                pairs.append({"from": a, "to": b, "meters": None, "route": "no_connected_route"})
    return {"unsnapped": [k for k, v in snapped.items() if v is None], "pairs": pairs,
            "note": "meters = graph path length plus snap distance at both ends. null = no connected pedestrian route."}


def route_geometry(graph: nx.Graph, a: Point, b: Point, max_snap_m: float = 150.0):
    sa, sb = snap(graph, a, max_snap_m), snap(graph, b, max_snap_m)
    if not sa or not sb:
        return None
    try:
        nodes = nx.shortest_path(graph, sa[0], sb[0], weight="weight")
    except nx.NetworkXNoPath:
        return None
    return LineString(nodes) if len(nodes) > 1 else None
