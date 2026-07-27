import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

const pages = ["terms", "privacy", "acceptable-use", "cookies", "dmca", "security", "data-processing", "ai-use", "emergency-alert-disclaimer", "restaurant-disclaimer", "music-rights-disclaimer"];

export default function Page() {
  return (
    <LegalPage title="Legal Center">
      <p>Review the MVP legal boundaries before live launch, billing, uploads, or public broadcasting.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {pages.map((page) => (
          <Link className="readable-pill rounded-2xl px-4 py-3 font-bold" href={`/legal/${page}`} key={page}>
            {page.replaceAll("-", " ")}
          </Link>
        ))}
      </div>
    </LegalPage>
  );
}
