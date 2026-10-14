export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`badge sev-${severity}`}>{severity}</span>;
}
export function Flags({ flags }: { flags: string[] }) {
  return <span>{flags.map(f => <span key={f} className="flag">{f}</span>)}</span>;
}
