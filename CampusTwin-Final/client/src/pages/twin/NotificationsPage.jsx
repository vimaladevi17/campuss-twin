import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http, { errorMessage } from "../../api/http";
import { useToast } from "../../context/ToastContext";
import { PageHeader, Card, Btn, State, Badge } from "../../components/ui";
import { fmtIst } from "../../lib/time";

export default function NotificationsPage() {
  const { toast } = useToast();
  const [data, setData] = useState({ unread: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData((await http.get("/notifications")).data); setError(""); } catch (e) { setError(errorMessage(e, "Unable to load notifications.")); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Refresh the list when the shell reports a pushed, read or re-synced notification.
  useEffect(() => { window.addEventListener("campustwin:notifications", load); return () => window.removeEventListener("campustwin:notifications", load); }, [load]);
  const act = async (fn, ok) => { try { await fn(); if (ok) toast(ok); load(); } catch (e) { toast(errorMessage(e), "error"); } };

  return (
    <>
      <PageHeader title="Notifications" subtitle={`${data.unread} unread`} actions={<Btn kind="ghost" disabled={!data.unread} onClick={() => act(() => http.post("/notifications/read-all"), "All marked as read")}>Mark all as read</Btn>} />
      <Card>
        <State loading={loading} error={error} empty={data.items.length === 0} emptyText="You have no notifications.">
          <div style={{ display: "grid", gap: 8 }}>
            {data.items.map((n) => (
              <div key={n._id} className="border border-line rounded-lg p-3 text-sm" style={{ background: n.readAt ? "transparent" : "var(--ct-brand-soft)" }}>
                <div className="flex justify-between gap-3 flex-wrap">
                  <strong className="text-ink">{n.title} {!n.readAt && <Badge tone="selected">New</Badge>}</strong>
                  <span className="text-muted">{fmtIst(n.createdAt)}</span>
                </div>
                <p className="text-muted" style={{ margin: "4px 0" }}>{n.message}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {n.link && <Link to={n.link}>Open</Link>}
                  {!n.readAt && <Btn kind="ghost" onClick={() => act(() => http.patch(`/notifications/${n._id}/read`))}>Mark read</Btn>}
                  <Btn kind="ghost" onClick={() => act(() => http.delete(`/notifications/${n._id}`), "Notification deleted")}>Delete</Btn>
                </div>
              </div>
            ))}
          </div>
        </State>
      </Card>
    </>
  );
}
