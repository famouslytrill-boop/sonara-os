import { ModulePlaceholder } from "@/components/sonara/LaunchShell";

export default function ExchangePage() {
  return (
    <ModulePlaceholder
      title="SONARA Exchange™"
      description="Marketplace features are delayed until rights verification, seller compliance, payout compliance, moderation, storage cost controls, and marketplace terms are ready."
      cards={[
        {
          title: "Launch boundary",
          text: "SONARA does not sell third-party sample packs at launch. Vault tooling remains focused on organize, classify, verify, and export workflows.",
          status: "Delayed",
        },
      ]}
    />
  );
}
