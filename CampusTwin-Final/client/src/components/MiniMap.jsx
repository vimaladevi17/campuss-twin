import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

function Fit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 17);
    else if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 18 });
  }, [points, map]);
  return null;
}

// points: [{ lat, lng, color, label, radius }]   lines: [{ positions: [[lat,lng],...], color }]
export default function MiniMap({ points, lines = [], height = 280 }) {
  return (
    <MapContainer center={[9.5743, 77.6761]} zoom={16} style={{ height, width: "100%", borderRadius: 10 }} scrollWheelZoom={false}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {lines.map((l, i) => <Polyline key={i} positions={l.positions} pathOptions={{ color: l.color || "#2563eb", weight: 4 }} />)}
      {points.map((p, i) => (
        <CircleMarker key={i} center={[p.lat, p.lng]} radius={p.radius || 10} pathOptions={{ color: "#fff", weight: 2, fillColor: p.color, fillOpacity: 0.95 }}>
          <Tooltip permanent={points.length <= 6} direction="top">{p.label}</Tooltip>
        </CircleMarker>
      ))}
      <Fit points={points} />
    </MapContainer>
  );
}
