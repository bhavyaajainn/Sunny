// Small presentational pieces reused across screens.

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={className ? `seg ${className}` : 'seg'} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The gradient-sun app icon, drawn in CSS. */
export function AppIcon() {
  return <div className="appicon" aria-hidden="true" />;
}

/** An iOS-style notification card (preview only). */
export function NotifCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="notif">
      <AppIcon />
      <div className="n-body">
        <div className="n-top">
          <span>Sunny</span>
          <span>now</span>
        </div>
        <b>{title}</b>
        <p>{body}</p>
      </div>
    </div>
  );
}

/** A CSS sun: rotating rays around a core. `kind` picks the size/color variant. */
export function Sun({ kind }: { kind: 'bigsun' | 'disc' | 'msun' }) {
  return (
    <div className={kind} aria-hidden="true">
      <div className="rays" />
      <div className="core" />
    </div>
  );
}

export const TRASH_SVG = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
