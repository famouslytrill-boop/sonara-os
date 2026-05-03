const statusStyles = {
  complete: { color: "#22C55E", label: "Complete" },
  current: { color: "#8B5CF6", label: "Current" },
  upcoming: { color: "#9A8FA8", label: "Upcoming" },
  blocked: { color: "#F59E0B", label: "Blocked" },
};

export function StepProgress({
  steps,
}: {
  steps: {
    label: string;
    description?: string;
    status: "complete" | "current" | "upcoming" | "blocked";
  }[];
}) {
  return (
    <ol
      style={{
        listStyle: "none",
        padding: 0,
        margin: "0 0 24px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
        gap: "12px",
      }}
    >
      {steps.map((step, index) => {
        const style = statusStyles[step.status];

        return (
          <li
            key={step.label}
            style={{
              border: "1px solid rgba(52, 42, 70, 0.35)",
              borderRadius: "18px",
              background: "rgba(255, 249, 240, 0.78)",
              color: "#17131F",
              padding: "14px",
            }}
          >
            <span style={{ color: style.color, fontWeight: 900 }}>
              {index + 1}. {style.label}
            </span>
            <h3 style={{ margin: "8px 0 4px", fontSize: "16px" }}>
              {step.label}
            </h3>
            {step.description ? (
              <p style={{ color: "#6E657A", margin: 0, lineHeight: 1.45 }}>
                {step.description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
