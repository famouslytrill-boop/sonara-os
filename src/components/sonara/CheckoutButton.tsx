"use client";

import { useState, type ReactNode } from "react";

type CheckoutTier = "creator" | "pro" | "label";

type CheckoutResponse = {
  ok?: boolean;
  url?: string;
  error?: string;
  missing?: string[];
  warnings?: string[];
};

export function CheckoutButton({
  tier,
  children,
  className,
}: {
  tier: CheckoutTier;
  children?: ReactNode;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<string[]>([]);

  async function startCheckout() {
    setIsLoading(true);
    setMessage("");
    setDetails([]);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier }),
      });

      const payload = (await response.json()) as CheckoutResponse;

      if (payload.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }

      if (payload.error === "Stripe setup required" || response.status === 503) {
        setMessage("Stripe checkout is not ready yet.");
        setDetails([
          ...(payload.missing?.map((name) => `Missing: ${name}`) ?? []),
          ...(payload.warnings?.map((warning) =>
            warning.includes("prod_")
              ? "Use a Stripe price_... ID, not a prod_... Product ID."
              : warning
          ) ?? []),
        ]);
        return;
      }

      setMessage(payload.error || "Checkout could not start. Try again later.");
    } catch {
      setMessage("Checkout could not start. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <button
        type="button"
        onClick={startCheckout}
        disabled={isLoading}
        aria-busy={isLoading}
        className={className}
        style={
          className
            ? undefined
            : {
                minHeight: "46px",
                padding: "12px 18px",
                borderRadius: "999px",
                border: "1px solid #332A40",
                background: isLoading ? "#211B2D" : "#121018",
                color: "#F9FAFB",
                cursor: isLoading ? "wait" : "pointer",
                fontWeight: 900,
              }
        }
      >
        {isLoading ? "Opening checkout..." : children ?? "Subscribe"}
      </button>
      {message ? (
        <div style={{ color: "#FFB454", lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}>{message}</p>
          {details.length > 0 ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
