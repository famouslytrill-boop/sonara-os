import { OpenSourcePromisePage } from "../../../components/OpenSourcePromisePage";

export default function ThirdPartyNoticesPage() {
  return (
    <OpenSourcePromisePage
      title="Third-party notices stay explicit."
      description="External tools, providers, APIs, and research references are separate from SONARA unless a reviewed integration exists."
      sections={[
        {
          title: "No false endorsement",
          body: "A reference does not mean partnership, endorsement, bundled functionality, native integration, or commercial-use approval.",
        },
        {
          title: "Provider costs",
          body: "Stripe, Supabase, email, SMS, AI, storage, or other provider costs may be separate when enabled and must be disclosed clearly.",
        },
      ]}
    />
  );
}
