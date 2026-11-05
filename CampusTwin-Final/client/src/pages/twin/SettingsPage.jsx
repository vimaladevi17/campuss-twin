import { useEffect, useState } from "react";
import http, { errorMessage } from "../../api/http";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../components/shell/AppShell";
import { PageHeader, Card, Field, Btn, State } from "../../components/ui";
import { minutesToHHMM } from "../../lib/time";

const hhmm = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dark, toggle] = useTheme();
  const [s, setS] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const admin = user.role === "admin";

  useEffect(() => {
    http.get("/settings").then((r) => {
      setS(r.data);
      const w = r.data.scoringWeights;
      setForm({ availability: Math.round(w.availability * 100), equipment: Math.round(w.equipment * 100), capacity: Math.round(w.capacity * 100), distance: Math.round(w.distance * 100),
        maxRecommendedWalkM: r.data.maxRecommendedWalkM, walkingSpeedMps: r.data.walkingSpeedMps, dayStart: minutesToHHMM(r.data.dayStartMinutes), dayEnd: minutesToHHMM(r.data.dayEndMinutes), turnoverBufferMin: r.data.turnoverBufferMin });
    }).catch((e) => setError(errorMessage(e, "Unable to load settings.")));
  }, []);

  const total = form ? Number(form.availability) + Number(form.equipment) + Number(form.capacity) + Number(form.distance) : 0;
  const save = async (e) => {
    e.preventDefault();
    if (total <= 0) { toast("Weights must add up to more than 0.", "error"); return; }
    if (hhmm(form.dayEnd) <= hhmm(form.dayStart)) { toast("Day end must be after day start.", "error"); return; }
    setSaving(true);
    try {
      const r = await http.put("/settings", { scoringWeights: { availability: form.availability / total, equipment: form.equipment / total, capacity: form.capacity / total, distance: form.distance / total },
        maxRecommendedWalkM: Number(form.maxRecommendedWalkM), walkingSpeedMps: Number(form.walkingSpeedMps), dayStartMinutes: hhmm(form.dayStart), dayEndMinutes: hhmm(form.dayEnd), turnoverBufferMin: Number(form.turnoverBufferMin) });
      setS(r.data); toast("Settings saved");
    } catch (err) { toast(errorMessage(err, "Could not save settings."), "error"); } finally { setSaving(false); }
  };
  const num = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Settings" />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", alignItems: "start" }}>
        <Card title="Appearance"><Btn kind="ghost" onClick={toggle}>Switch to {dark ? "light" : "dark"} theme</Btn></Card>
        <Card title="Campus reference">
          <State error={error} loading={!s && !error}>
            {s && <ul className="text-sm" style={{ margin: 0, paddingLeft: 18 }}><li>{s.name}</li><li>Total campus area: {s.totalAreaSqm.toLocaleString()} m²</li><li>Open space ratio: {s.openSpaceRatioPct}%</li><li>Map centre: {s.referencePoint.lat}, {s.referencePoint.lng}</li></ul>}
          </State>
        </Card>
        {admin && form && (
          <Card title="Lab replacement scoring">
            <form onSubmit={save} style={{ display: "grid", gap: 10 }}>
              <p className="text-xs text-muted">Score = weighted sum of availability, equipment, capacity and distance scores (each 0–100). Weights are normalised to 100%.</p>
              {[["availability", "Availability %"], ["equipment", "Equipment %"], ["capacity", "Capacity %"], ["distance", "Walking distance %"]].map(([k, l]) => <Field key={k} label={l}><input type="number" min="0" max="100" value={form[k]} onChange={num(k)} /></Field>)}
              <p className="text-xs text-muted">Current total: {total}% {total !== 100 && total > 0 ? `(will be scaled to 100%)` : ""}</p>
              <Field label="Distance that scores 0 (metres)"><input type="number" min="50" value={form.maxRecommendedWalkM} onChange={num("maxRecommendedWalkM")} /></Field>
              <Field label="Walking speed (m/s)"><input type="number" step="0.01" min="0.3" max="3" value={form.walkingSpeedMps} onChange={num("walkingSpeedMps")} /></Field>
              <Field label="Teaching day starts"><input type="time" value={form.dayStart} onChange={num("dayStart")} /></Field>
              <Field label="Teaching day ends"><input type="time" value={form.dayEnd} onChange={num("dayEnd")} /></Field>
              <Field label="Turnover buffer (minutes)"><input type="number" min="0" value={form.turnoverBufferMin} onChange={num("turnoverBufferMin")} /></Field>
              <Btn type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Btn>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
