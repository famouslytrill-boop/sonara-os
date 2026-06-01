"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#07070A", color: "white", fontFamily: "Arial" }}>
        <main style={{ minHeight: "100vh", padding: "3rem" }}>
          <section
            style={{
              maxWidth: 720,
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 24,
              padding: 32
            }}
          >
            <h1>Signal core interrupted</h1>
            <p style={{ opacity: 0.68 }}>
              A root-level fault occurred. Restore the application shell to continue.
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 24, padding: "12px 18px", borderRadius: 999 }}
            >
              Restore Signal
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
