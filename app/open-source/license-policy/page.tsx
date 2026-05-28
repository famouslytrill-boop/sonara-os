import { OpenSourcePromisePage } from "../../../components/OpenSourcePromisePage";

export default function OpenSourceLicensePolicyPage() {
  return (
    <OpenSourcePromisePage
      title="License review blocks unsafe adoption."
      description="Every external candidate must pass license, commercial-use, security, safety, maintenance, and product-fit review before adoption."
      sections={[
        {
          title: "Blocked by default",
          body: "Risky scraping tools, unofficial messaging automation, restricted model weights, and unclear-license projects stay blocked until reviewed.",
        },
        {
          title: "Allowed paths",
          body: "Safe references can remain research-only, become documentation, become optional adapters, or become separately self-hosted services after review.",
        },
      ]}
    />
  );
}
