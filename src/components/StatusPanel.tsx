export interface StatusPanelProps {
  kind: "loading" | "empty" | "error" | "not-found" | "session-expired";
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function StatusPanel({ kind, title, description, action }: StatusPanelProps) {
  const liveProps = kind === "loading" ? { role: "status", "aria-live": "polite" as const } :
    kind === "error" || kind === "session-expired" ? { role: "alert" } : {};

  return (
    <section className={`status-panel status-panel--${kind}`} {...liveProps}>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <button className="primary-button" type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
