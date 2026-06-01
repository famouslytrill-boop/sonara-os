"use client";

export function PermissionRequestButton({ label }: { label: string }) {
  return (
    <button type="button" className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-black text-white" onClick={() => alert("Permission requests are setup-gated and require user action plus policy review.")}>
      {label}
    </button>
  );
}
