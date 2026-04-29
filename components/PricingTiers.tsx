"use client";

import { CheckCircle2, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { sonaraBillingTiers, sonaraStripeKits, type SonaraBillingTierId, type SonaraKitId } from "../config/sonara/paymentTiers";
import { Button } from "./ui/Button";

export function PricingTiers() {
  const [message, setMessage] = useState("");
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  async function startCheckout(payload: { tierId: SonaraBillingTierId } | { kitId: SonaraKitId }) {
    const loadingKey = "tierId" in payload ? `tier:${payload.tierId}` : `kit:${payload.kitId}`;
    setMessage("");
    setLoadingItem(loadingKey);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Stripe checkout is not configured yet.");
        return;
      }

      window.location.href = data.url;
    } finally {
      setLoadingItem(null);
    }
  }

  return (
    <div className="mt-5 grid gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        {sonaraBillingTiers.map((tier) => {
          const loadingKey = `tier:${tier.id}`;

          return (
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
              <Button type="button" className="mt-5 w-full" onClick={() => startCheckout({ tierId: tier.id })} disabled={loadingItem !== null}>
                {loadingItem === loadingKey ? "Opening checkout" : "Choose tier"}
              </Button>
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <ShoppingBag className="text-[#22D3EE]" size={18} />
          <p className="text-sm font-black text-[#F8FAFC]">One-time creator kits</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sonaraStripeKits.map((kit) => {
            const loadingKey = `kit:${kit.id}`;

            return (
              <div key={kit.id} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
                <p className="text-sm font-black text-[#F8FAFC]">{kit.name}</p>
                <p className="mt-1 text-sm font-black text-[#22D3EE]">{kit.priceLabel}</p>
                <p className="mt-2 min-h-24 text-sm leading-6 text-[#A1A1AA]">{kit.description}</p>
                <Button
                  type="button"
                  tone="secondary"
                  className="mt-4 w-full"
                  onClick={() => startCheckout({ kitId: kit.id })}
                  disabled={loadingItem !== null}
                >
                  {loadingItem === loadingKey ? "Opening checkout" : "Buy kit"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {message ? <p className="rounded-lg border border-[#2A2A35] bg-[#111118] p-3 text-sm text-[#A1A1AA]">{message}</p> : null}
    </div>
  );
}
