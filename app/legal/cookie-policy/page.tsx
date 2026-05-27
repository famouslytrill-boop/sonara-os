import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function CookiePolicyPage() {
  return (
    <LegalPolicyPage
      title="Cookie Policy"
      description="A draft explaining basic cookies, storage, and future analytics controls."
      sections={[
        "The app may use essential cookies or browser storage for sessions, security, preferences, and product setup state.",
        "Analytics or marketing cookies should remain disabled unless configured with notice, consent handling where required, and provider documentation.",
        "Notification preferences, sound settings, and reduced-motion choices may be stored locally first.",
      ]}
    />
  );
}
