"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = userAgent.includes("safari") && !userAgent.includes("crios") && !userAgent.includes("fxios");
  return isIos && isSafari;
}

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setShowIosHint(isIosSafari());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!installPrompt && !showIosHint) return null;

  return (
    <div className="mx-auto mb-4 max-w-6xl px-4">
      <div className="rounded-lg border border-white/10 bg-[#111118] p-3 text-sm text-slate-300">
        {installPrompt ? (
          <button
            className="font-bold text-cyan-300"
            onClick={async () => {
              await installPrompt.prompt();
              await installPrompt.userChoice;
              setInstallPrompt(null);
            }}
          >
            Install SONARA Industries
          </button>
        ) : (
          <span>Add SONARA Industries to your Home Screen from the iOS share menu.</span>
        )}
      </div>
    </div>
  );
}
