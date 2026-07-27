"use client";

import { useMemo, useState } from "react";

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function VoicePromptInput({
  label = "Action note",
  placeholder = "Dictate or type an operator note.",
}: {
  label?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }, []);

  function startDictation() {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Voice dictation is not supported in this browser. Type the note instead.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setText((current) => [current, transcript].filter(Boolean).join(" "));
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
    setMessage("Microphone permission is controlled by your browser. Transcript stays local until you submit it.");
  }

  return (
    <div className="rounded-2xl border border-[#332A40] bg-[#121018] p-4">
      <label className="text-sm font-bold text-white" htmlFor="voice-prompt-input">
        {label}
      </label>
      <textarea
        id="voice-prompt-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        className="mt-3 min-h-28 w-full rounded-xl border border-[#332A40] bg-[#08070B] p-3 text-sm text-white outline-none transition focus:border-[#2DD4BF]"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startDictation}
          disabled={!supported || listening}
          className="rounded-xl bg-[#F9FAFB] px-4 py-2 text-sm font-black text-[#17131F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {listening ? "Listening..." : "Start Dictation"}
        </button>
        <button
          type="button"
          onClick={() => setText("")}
          className="rounded-xl border border-[#332A40] px-4 py-2 text-sm font-bold text-[#C4BFD0] hover:text-white"
        >
          Clear
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#8F879C]">
        {message || "Voice support is browser-dependent. Nothing is sent until the user submits a note or action."}
      </p>
    </div>
  );
}
