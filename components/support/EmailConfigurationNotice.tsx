export function EmailConfigurationNotice() {
  return (
    <p className="rounded-2xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-5 text-sm leading-6 text-[#FDE68A]">
      Email provider environment variables are optional. Missing provider values must show a clear fallback message
      instead of failing silently.
    </p>
  );
}
