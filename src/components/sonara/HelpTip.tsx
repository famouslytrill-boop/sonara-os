import type { ReactNode } from "react";

const variantColors = {
  info: "#29D3C2",
  warning: "#F59E0B",
  success: "#22C55E",
  setup: "#8B5CF6",
  rights: "#FF6B6B",
};

export function HelpTip({
  title,
  body,
  variant = "info",
  compact = false,
}: {
  title: string;
  body: ReactNode;
  variant?: "info" | "warning" | "success" | "setup" | "rights";
  compact?: boolean;
}) {
  return (
    <aside
      style={{
        border: "1px solid rgba(52, 42, 70, 0.85)",
        borderLeft: `4px solid ${variantColors[variant]}`,
        background: "rgba(255, 249, 240, 0.76)",
        borderRadius: compact ? "14px" : "20px",
        color: "#17131F",
        padding: compact ? "12px" : "16px",
        lineHeight: 1.55,
      }}
    >
      <strong>{title}</strong>
      <div style={{ color: "#6E657A", marginTop: "6px" }}>{body}</div>
    </aside>
  );
}
