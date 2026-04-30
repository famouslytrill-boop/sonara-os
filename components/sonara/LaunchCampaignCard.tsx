import { Megaphone } from "lucide-react";
import { buildLaunchCampaignAssets } from "../../lib/sonara/marketing/launchCampaignEngine";

export function LaunchCampaignCard() {
  const assets = buildLaunchCampaignAssets();

  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <Megaphone className="text-[#FFB454]" size={22} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Launch campaign</p>
      <h2 className="mt-1 text-xl font-black">{assets.shortPitch}</h2>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{assets.launchPost}</p>
    </article>
  );
}
