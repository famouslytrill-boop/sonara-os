import { buildVaultStack } from "../../lib/sonara/vault/vaultStackEngine";

export function VaultStackCard() {
  const stack = buildVaultStack();
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#2DD4BF]">SONARA Vault™</p>
      <h3 className="mt-2 text-xl font-black">Personal Vault Kit Export</h3>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{stack.purpose}</p>
      <ul className="mt-3 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {stack.items.map((item) => (
          <li key={item.name}>{item.name}: {item.status.replaceAll("_", " ")}</li>
        ))}
      </ul>
    </section>
  );
}
