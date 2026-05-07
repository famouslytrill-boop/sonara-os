"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { pricingTiers, type PricingTierId } from "../config/pricing";
import { Button } from "./ui/Button";

export function PricingTiers({ paymentsConfigured = false }: { paymentsConfigured?: boolean }) {
  const [message, setMessage] = useState("");
  const [loadingTier, setLoadingTier] = useState<PricingTierId | null>(null);

  async function startCheckout(tierId: PricingTierId) {
    setMessage("");
    setLoadingTier(tierId);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Payment setup is required before checkout goes live.");
        return;
      }

      window.location.href = data.url;
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {pricingTiers.map((tier) => {
        const isFree = tier.id === "free";
        const canCheckout = paymentsConfigured && !isFree;

        return (
          <div key={tier.id} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
            <p className="text-sm font-black text-[#F8FAFC]">{tier.name}</p>
            <p className="mt-2 text-3xl font-black text-[#22D3EE]">
              {tier.monthlyPrice === 0 ? "$0" : `$${tier.monthlyPrice.toFixed(2)}`}
              <span className="text-sm text-[#A1A1AA]">/mo</span>
            </p>
            <p className="mt-3 min-h-20 text-sm leading-6 text-[#A1A1AA]">{tier.description}</p>
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <CheckCircle2 className="mt-1 shrink-0 text-[#22C55E]" size={16} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className="mt-5 w-full"
              tone={canCheckout ? "primary" : "secondary"}
              disabled={!canCheckout || loadingTier !== null}
              onClick={() => startCheckout(tier.id)}
            >
              {isFree ? "Included" : canCheckout ? (loadingTier === tier.id ? "Opening checkout" : "Subscribe") : "Payment setup required"}
            </Button>
          </div>
        );
      })}
      {message ? <p className="md:col-span-2 xl:col-span-4 rounded-lg border border-[#2A2A35] bg-[#111118] p-3 text-sm text-[#A1A1AA]">{message}</p> : null}
    </div>
  );
}
