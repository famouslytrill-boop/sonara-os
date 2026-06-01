"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SONARA route error]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#07070A] text-white p-10">
      <section className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.055] p-6">
        <h1 className="text-2xl font-semibold">Signal interrupted</h1>
        <p className="mt-3 text-white/60">
          A route-level fault occurred. The system can recover without losing the full application
          shell.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-full border border-violet-400/60 bg-violet-500/20 px-5 py-3"
        >
          Restore Signal
        </button>
      </section>
    </main>
  );
}
