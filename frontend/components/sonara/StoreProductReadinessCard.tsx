import { PackageCheck } from "lucide-react";
import { storeProducts } from "../../config/pricing";
import { evaluateStoreProductReadiness } from "../../lib/sonara/store/storeReadinessEngine";

export function StoreProductReadinessCard() {
  const readiness = storeProducts.map((product) => {
    const rightsSensitive = product.id.includes("metadata") || product.id.includes("vault") || product.id.includes("genre");
    return {
      product,
      result: evaluateStoreProductReadiness({
      title: product.name,
      description: product.description,
      price: product.status === "checkout_ready" ? 9 : undefined,
      stripePriceId: undefined,
      licenseTerms: rightsSensitive ? undefined : "Standard SONARA store terms required before publishing.",
      previewImage: "placeholder",
      includedFiles: ["export manifest"],
      refundSupportNote: "Support and refund notes required before sale.",
      rightsClassification: rightsSensitive ? undefined : "digital workflow",
      exportBundleExists: false,
      hasBlockedSoundAssets: product.id.includes("vault") || product.id.includes("genre"),
      requiresAttribution: rightsSensitive,
      attributionSheetExists: false,
      }),
    };
  });

  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <PackageCheck className="text-[#FFB454]" size={22} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Store product readiness</p>
      <div className="mt-3 grid gap-2">
        {readiness.map(({ product, result }) => (
          <div key={product.id} className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
            <p className="text-sm font-black">{product.name}</p>
            <p className="mt-1 text-xs font-bold uppercase text-[#C4BFD0]">{result.status}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
