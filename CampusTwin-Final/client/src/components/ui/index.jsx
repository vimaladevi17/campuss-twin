import { STATUS_LABEL } from "../../lib/time";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink m-0">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1 mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Card({ title, right, children, className = "" }) {
  return (
    <section className={`bg-surface border border-line rounded-xl p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-base font-semibold text-ink m-0">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE = {
  available: "bg-ok/15 text-ok", occupied: "bg-busy/15 text-busy", maintenance: "bg-maint/15 text-maint", unavailable: "bg-bad/15 text-bad",
  selected: "bg-sel/15 text-sel", neutral: "bg-surface2 text-muted", warn: "bg-busy/15 text-busy", demo: "bg-maint/15 text-maint",
};
export function Badge({ tone = "neutral", children }) {
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TONE[tone] || TONE.neutral}`}>{children}</span>;
}
export const StatusBadge = ({ status }) => <Badge tone={status}>{STATUS_LABEL[status] || status}</Badge>;

export function State({ loading, error, empty, emptyText = "Nothing to show yet.", children }) {
  if (loading) return <p className="text-sm text-muted py-6 text-center" role="status">Loading…</p>;
  if (error) return <p className="text-sm text-bad py-6 text-center" role="alert">{error}</p>;
  if (empty) return <p className="text-sm text-muted py-6 text-center">{emptyText}</p>;
  return children;
}

export function Btn({ kind = "primary", className = "", ...props }) {
  const k = { primary: "bg-brand text-white hover:opacity-90", ghost: "bg-surface2 text-ink hover:opacity-80 border border-line", danger: "bg-bad text-white hover:opacity-90", ok: "bg-ok text-white hover:opacity-90" }[kind];
  return <button type="button" {...props} className={`${k} rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${className}`} />;
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-muted">{label}</span>
      {children}
      {hint && <small className="text-muted">{hint}</small>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-[2500] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`bg-surface border border-line rounded-xl p-5 w-full ${wide ? "max-w-4xl" : "max-w-lg"} mt-10`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-ink m-0">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted text-xl leading-none bg-transparent border-0">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Confirmation dialog (replaces window.confirm in new screens)
export function Confirm({ message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  return (
    <Modal title="Please confirm" onClose={onCancel}>
      <p className="text-sm text-ink mt-0">{message}</p>
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn kind={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}
