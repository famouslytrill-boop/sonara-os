"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!installEvent) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-3xl border border-cyan-300/30 bg-slate-950 p-4 shadow-2xl">
      <p className="text-sm font-bold text-white">Install SONARA Industries</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">Add the parent platform to this device. Mobile app packaging comes later.</p>
      <div className="mt-3">
        <Button
          type="button"
          onClick={async () => {
            await installEvent.prompt();
            setInstallEvent(null);
          }}
        >
          Install
        </Button>
      </div>
    </div>
  );
}
