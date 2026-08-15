export function Badge({
  kind,
  label,
}: {
  kind: "ok" | "soon" | "expired" | "perm";
  label: string;
}) {
  return (
    <span className={`badge ${kind}`}>
      <i className="dot" />
      {label}
    </span>
  );
}
