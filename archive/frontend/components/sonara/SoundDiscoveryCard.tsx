import { demoSoundDiscoveryRecord, getSoundDiscoveryLaunchStatus } from "../../lib/sonara/soundDiscovery/soundDiscoveryEngine";

export function SoundDiscoveryCard() {
  const status = getSoundDiscoveryLaunchStatus();
  const demo = demoSoundDiscoveryRecord();

  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#2DD4BF]">Rights-Safe Sound Discovery</p>
      <h3 className="mt-2 text-xl font-black">Metadata-first, license-review required</h3>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">
        SONARA can discover open sound metadata, but it cannot sell or redistribute files until rights are verified.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
          <p className="text-sm font-black">Supported sources</p>
          <ul className="mt-2 grid gap-1 text-sm text-[#C4BFD0]">
            {status.supportedSources.map((source) => (
              <li key={source.id}>{source.name}: {source.launchStatus.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
          <p className="text-sm font-black">Demo classification</p>
          <p className="mt-2 text-sm text-[#C4BFD0]">{demo.name}</p>
          <p className="mt-1 text-sm text-[#FFB454]">{demo.classification.exportStatus}</p>
        </div>
      </div>
    </section>
  );
}
