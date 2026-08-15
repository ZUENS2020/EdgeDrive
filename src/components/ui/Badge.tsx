export function Badge({
  kind,
  label,
}: {
  kind: "ok" | "soon" | "expired" | "perm";
  label: string;
}) {
  return <span className={`badge ${kind}`}>{label}</span>;
}
