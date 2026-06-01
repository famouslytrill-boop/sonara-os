export function LaunchChecklistPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-lg font-black text-white">Launch checklist preview</h2>
      <ul className="mt-4 grid gap-2 text-sm text-[#CBD5E1]">
        {["Profile basics", "Offer/service page", "Payment link placeholder", "Booking/intake path", "Review workflow", "Support route"].map((item) => (
          <li key={item} className="rounded-xl border border-white/10 bg-[#081827] px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
