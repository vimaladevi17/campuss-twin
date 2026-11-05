// Walking distance between buildings.
//  - "network": shortest path over CampusPath LineStrings (Dijkstra). Used only when path data connects both ends.
//  - "straight_line_approx": great-circle distance. Clearly labelled; NOT a walking route.
//  - "same_building" / "unknown".
// A Python/NetworkX service can later replace buildGraph/shortest without changing callers.
const { haversine } = require("../utils/geo");

const key = (c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`;

function buildGraph(paths, { accessibleOnly = false } = {}) {
  const nodes = new Map(), adj = new Map();
  const add = (c) => { const k = key(c); if (!nodes.has(k)) { nodes.set(k, c); adj.set(k, []); } return k; };
  for (const p of paths) {
    if (p.walkable === false || (accessibleOnly && p.accessible === false)) continue;
    const cs = p.geometry && p.geometry.coordinates; if (!cs) continue;
    for (let i = 0; i < cs.length - 1; i++) {
      const a = add(cs[i]), b = add(cs[i + 1]), d = haversine(cs[i], cs[i + 1]);
      adj.get(a).push([b, d]); adj.get(b).push([a, d]);
    }
  }
  return { nodes, adj };
}

function nearestNode(graph, point, maxSnapM = 150) {
  let best = null, bd = Infinity;
  for (const [k, c] of graph.nodes) { const d = haversine(point, c); if (d < bd) { bd = d; best = k; } }
  return best && bd <= maxSnapM ? { node: best, snapM: bd } : null;
}

function shortest(graph, from, to) {
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  const queue = [[0, from]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, u] = queue.shift();
    if (done.has(u)) continue; done.add(u);
    if (u === to) break;
    for (const [v, w] of graph.adj.get(u) || []) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); queue.push([nd, v]); }
    }
  }
  if (!dist.has(to)) return null;
  const route = []; for (let n = to; n; n = prev.get(n)) route.unshift(graph.nodes.get(n));
  return { meters: dist.get(to), route };
}

// Precomputed NetworkX distances (gis/ pipeline -> WalkingDistance collection), keyed by building osmId.
const pairKey = (a, b) => (String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`);
function buildMatrix(docs) {
  const m = new Map();
  for (const d of docs) m.set(pairKey(d.a, d.b), d);
  return m;
}

// Order of preference: same building -> NetworkX matrix -> path network built from CampusPath -> unavailable.
// There is NO straight-line fallback for scoring: when no connected pedestrian route exists the distance is
// reported as unavailable (meters null). The straight-line figure is returned separately, for display only.
function walkingDistance(graph, fromPoint, toPoint, { sameBuilding = false, speedMps = 1.34, aKey, bKey } = {}) {
  if (sameBuilding) return { meters: 0, minutes: 0, type: "same_building", route: null };
  if (!fromPoint || !toPoint) return { meters: null, minutes: null, type: "unknown", route: null };
  const straight = Math.round(haversine(fromPoint, toPoint));
  if (graph && graph.matrix && aKey && bKey) {
    const hit = graph.matrix.get(pairKey(aKey, bKey));
    if (hit && hit.meters != null) return { meters: Math.round(hit.meters), minutes: Math.max(1, Math.round(hit.meters / speedMps / 60)), type: "network", engine: "networkx", route: null, straightLineMeters: straight };
    if (hit && hit.meters == null) return { meters: null, minutes: null, type: "unavailable", reason: "no connected pedestrian route (NetworkX)", route: null, straightLineMeters: straight };
  }
  if (graph && graph.nodes.size) {
    const a = nearestNode(graph, fromPoint), b = nearestNode(graph, toPoint);
    if (a && b) {
      const r = a.node === b.node ? { meters: 0, route: [graph.nodes.get(a.node)] } : shortest(graph, a.node, b.node);
      if (r) { const m = r.meters + a.snapM + b.snapM; return { meters: Math.round(m), minutes: Math.max(1, Math.round(m / speedMps / 60)), type: "network", engine: "campuspath", route: r.route, straightLineMeters: straight }; }
    }
  }
  return { meters: null, minutes: null, type: "unavailable", reason: "no connected pedestrian route in the data", route: null, straightLineMeters: straight };
}

module.exports = { buildMatrix, pairKey, buildGraph, walkingDistance, nearestNode, shortest };
