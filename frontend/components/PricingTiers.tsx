"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { sonaraBillingTiers, type SonaraBillingTierId } from "../config/sonara/paymentTiers";
import { Button } from "./ui/Button";

export function PricingTiers() {
  const [message, setMessage] = useState("");
  const [loadingTier, setLoadingTier] = useState<SonaraBillingTierId | null>(null);

  async function startCheckout(tierId: SonaraBillingTierId) {
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
        setMessage(data.message ?? "Stripe checkout is not configured yet.");
        return;
      }

      window.location.href = data.url;
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-3">
      {sonaraBillingTiers.map((tier) => (
        <div key={tier.id} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#F8FAFC]">{tier.name}</p>
              <p className="mt-1 text-2xl font-black text-[#22D3EE]">{tier.priceLabel}</p>
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{tier.description}</p>
          <ul className="mt-4 grid gap-2 text-sm text-[#A1A1AA]">
            {tier.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#22C55E]" size={16} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button type="button" className="mt-5 w-full" onClick={() => startCheckout(tier.id)} disabled={loadingTier !== null}>
            {loadingTier === tier.id ? "Opening checkout" : "Choose tier"}
          </Button>
        </div>
      ))}
      {message ? <p className="md:col-span-3 rounded-lg border border-[#2A2A35] bg-[#111118] p-3 text-sm text-[#A1A1AA]">{message}</p> : null}
    </div>
  );
}
