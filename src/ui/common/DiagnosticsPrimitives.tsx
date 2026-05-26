export function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function StatusPill({ value }: { value: string }) {
  const tone = value.includes("blocked") || value.includes("missing") || value === "blocker" || value === "failed"
    ? "danger"
    : value.includes("ready") || value.includes("done") || value === "PASS" || value === "success"
      ? "good"
      : "neutral";
  return <span className={`pill ${tone}`}>{value}</span>;
}

export function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function CompactList({ items, empty = "No blockers or warnings." }: { items: string[]; empty?: string }) {
  if (!items.length) return <small className="muted-copy">{empty}</small>;
  return (
    <div className="compact-list">
      {items.slice(0, 5).map((item, index) => (
        <small key={`${item}-${index}`}>{item}</small>
      ))}
      {items.length > 5 && <small>+{items.length - 5} more</small>}
    </div>
  );
}
