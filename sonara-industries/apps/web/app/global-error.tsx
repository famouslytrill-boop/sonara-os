"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-slate-950 p-8 text-white">
          <section className="mx-auto max-w-xl rounded-3xl border border-red-300/30 bg-red-950/30 p-6">
            <h1 className="text-2xl font-black">Something went wrong</h1>
            <p className="mt-3 text-sm text-red-100">
              The error was captured by the configured monitoring provider if Sentry is enabled.
            </p>
            <p className="mt-2 text-xs text-red-200/70">{error.digest ? `Digest: ${error.digest}` : "No digest available"}</p>
            <button className="mt-5 rounded-2xl bg-red-200 px-4 py-2 font-black text-red-950" onClick={() => reset()}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
