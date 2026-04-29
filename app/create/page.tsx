"use client";

import { useMemo, useState } from "react";

type InstrumentRole = {
  name: string;
  purpose: string;
  howToUse: string;
};

const instruments: InstrumentRole[] = [
  {
    name: "Drums",
    purpose: "Controls the energy, movement, bounce, and street/commercial feel.",
    howToUse:
      "Use tight drums for clean pop or R&B. Use harder kicks, trap hats, and 808 movement for rap, drill, trap, or darker records.",
  },
  {
    name: "Bass / 808",
    purpose: "Gives the song weight, emotion, and physical impact.",
    howToUse:
      "Use long gliding 808s for trap and pain records. Use shorter bass notes for pop, dance, and radio-ready tracks.",
  },
  {
    name: "Piano / Keys",
    purpose: "Builds emotion, melody, intimacy, and harmonic identity.",
    howToUse:
      "Use soft piano for vulnerable songs. Use dark keys for luxury, villain, trap, or nighttime moods.",
  },
  {
    name: "Guitar",
    purpose: "Adds warmth, pain, country influence, acoustic texture, or live-band feeling.",
    howToUse:
      "Use clean guitar for emotional songs. Use muted guitar loops for modern country, pop rap, or melodic records.",
  },
  {
    name: "Synths / Pads",
    purpose: "Creates atmosphere, space, tension, and cinematic emotion.",
    howToUse:
      "Use wide pads for dreamy hooks. Use darker synths for tension, mystery, or futuristic branding.",
  },
  {
    name: "Strings / Choir",
    purpose: "Adds drama, scale, cinematic lift, and premium emotion.",
    howToUse:
      "Use strings in bridges, intros, or final hooks. Use choir lightly for power, suspense, or spiritual weight.",
  },
  {
    name: "Vocals",
    purpose: "Carries the identity, emotion, cadence, hook, and replay value.",
    howToUse:
      "Use conversational verses, memorable hooks, controlled ad-libs, stacked harmonies, and delay throws for a finished sound.",
  },
];

export default function CreatePage() {
  const [songTitle, setSongTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [notes, setNotes] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [bpm, setBpm] = useState("");
  const [keySignature, setKeySignature] = useState("");
  const [vocalMode, setVocalMode] = useState("");
  const [generated, setGenerated] = useState("");

  const releaseReadiness = useMemo(() => {
    let score = 0;

    if (songTitle.trim()) score += 15;
    if (creator.trim()) score += 10;
    if (notes.trim()) score += 20;
    if (genre.trim()) score += 15;
    if (mood.trim()) score += 10;
    if (bpm.trim()) score += 10;
    if (keySignature.trim()) score += 10;
    if (vocalMode.trim()) score += 10;

    return score;
  }, [songTitle, creator, notes, genre, mood, bpm, keySignature, vocalMode]);

  function generateSongSystem() {
    const title = songTitle.trim() || "Untitled Song";
    const artist = creator.trim() || "Independent Creator";
    const selectedGenre = genre.trim() || "Modern commercial hybrid";
    const selectedMood = mood.trim() || "Focused, emotional, polished";
    const selectedBpm = bpm.trim() || "90-110 BPM";
    const selectedKey = keySignature.trim() || "Minor key with emotional movement";
    const selectedVocal = vocalMode.trim() || "Lead vocal with stacked harmonies and controlled ad-libs";
    const userNotes = notes.trim() || "No extra notes provided.";

    const output = `
SONARA OS(TM) SONG BUILD

TITLE:
${title}

CREATOR:
${artist}

CORE IDENTITY:
${title} should feel like a complete, release-ready record built around ${selectedMood.toLowerCase()} energy, ${selectedGenre.toLowerCase()} production, and a clear vocal identity.

GENRE DIRECTION:
${selectedGenre}

MOOD:
${selectedMood}

BPM / RHYTHMIC FEEL:
${selectedBpm}

KEY / HARMONIC IDENTITY:
${selectedKey}

VOCAL MODE:
${selectedVocal}

USER NOTES:
${userNotes}

INSTRUMENT PLAN:
- Drums: Build the main movement and energy without crowding the vocal.
- Bass / 808: Support the emotional weight and hook impact.
- Keys / Piano: Establish the harmonic identity and emotional center.
- Guitar: Add human texture only if it supports the mood.
- Synths / Pads: Create atmosphere, width, and modern polish.
- Strings / Choir: Use lightly for cinematic lift or final-hook elevation.
- Vocals: Keep the lead clear, memorable, and emotionally controlled.

SONG STRUCTURE:
Intro: 4 to 8 bars, establish mood quickly.
Verse 1: Tell the story with specific details.
Pre-Hook: Build tension and emotional direction.
Hook: Simple, repeatable, memorable, and easy to market.
Verse 2: Add contrast, sharper imagery, or a new emotional angle.
Bridge: Optional. Use only if it improves the song.
Final Hook: Bigger vocal layers, stronger drums, and more emotional payoff.
Outro: Short, clean, and intentional.

RELEASE READINESS SCORE:
${releaseReadiness}/100

NEXT PRACTICAL MOVE:
${
  releaseReadiness >= 85
    ? "This concept is ready to move into demo generation, cover art, metadata, and rollout planning."
    : releaseReadiness >= 60
      ? "This concept is close. Strengthen the hook direction, vocal identity, and release notes before export."
      : "This concept needs more detail before release planning. Add mood, genre, BPM, key, vocal mode, and audience direction."
}

COPY-AND-PASTE MUSIC PROMPT:
Create a release-ready ${selectedGenre} song titled "${title}" with a ${selectedMood} mood. Use ${selectedBpm}, ${selectedKey}, and ${selectedVocal}. The production should include purposeful drums, controlled bass or 808, emotional keys, optional guitar texture, atmospheric synths, and polished vocal layers. Keep the hook memorable, the verses specific, and the arrangement clean enough for modern streaming platforms. Avoid generic filler and make every section feel intentional.
`.trim();

    setGenerated(output);

    localStorage.setItem(
      "sonara_last_song_build",
      JSON.stringify({
        songTitle: title,
        creator: artist,
        notes: userNotes,
        genre: selectedGenre,
        mood: selectedMood,
        bpm: selectedBpm,
        keySignature: selectedKey,
        vocalMode: selectedVocal,
        output,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  async function copyOutput() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    alert("Copied to clipboard.");
  }

  function downloadTxt() {
    if (!generated) return;

    const blob = new Blob([generated], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${songTitle || "sonara-song-build"}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function clearForm() {
    setSongTitle("");
    setCreator("");
    setNotes("");
    setGenre("");
    setMood("");
    setBpm("");
    setKeySignature("");
    setVocalMode("");
    setGenerated("");
    localStorage.removeItem("sonara_last_song_build");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #172033 0, #08080c 45%, #050508 100%)",
        color: "white",
        padding: "32px",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "20px",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div>
          <p style={{ color: "#22d3ee", fontWeight: 800, letterSpacing: "0.12em" }}>
            CREATE
          </p>
          <h1 style={{ fontSize: "44px", margin: "8px 0" }}>Build a Song</h1>
          <p style={{ color: "#cbd5e1", maxWidth: "720px", lineHeight: 1.7 }}>
            Enter your song details, choose the musical direction, then generate a
            release-ready song blueprint, prompt, instrument plan, and next-step checklist.
          </p>
        </div>

        <button
          onClick={clearForm}
          style={{
            padding: "12px 18px",
            borderRadius: "999px",
            border: "1px solid #334155",
            background: "rgba(15, 23, 42, 0.7)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
          gap: "24px",
        }}
      >
        <div
          style={{
            padding: "24px",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: "24px",
            background: "rgba(15, 23, 42, 0.72)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Song Details</h2>

          <label>Song title</label>
          <input
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            style={inputStyle}
          />

          <label>Creator / artist / team</label>
          <input
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            style={inputStyle}
          />

          <label>Genre / sound direction</label>
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={inputStyle}
          />

          <label>Mood / emotional target</label>
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            style={inputStyle}
          />

          <label>BPM / rhythmic feel</label>
          <input
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            style={inputStyle}
          />

          <label>Key / harmonic identity</label>
          <input
            value={keySignature}
            onChange={(e) => setKeySignature(e.target.value)}
            style={inputStyle}
          />

          <label>Vocal mode</label>
          <input
            value={vocalMode}
            onChange={(e) => setVocalMode(e.target.value)}
            style={inputStyle}
          />

          <label>Song and release notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              ...inputStyle,
              minHeight: "140px",
              resize: "vertical",
            }}
          />

          <button
            onClick={generateSongSystem}
            style={{
              marginTop: "18px",
              width: "100%",
              padding: "15px 22px",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(135deg, #22d3ee, #8b5cf6)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Generate Song Blueprint
          </button>
        </div>

        <div
          style={{
            padding: "24px",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: "24px",
            background: "rgba(15, 23, 42, 0.72)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}
        >
          <p style={{ color: "#22d3ee", fontWeight: 800, letterSpacing: "0.12em" }}>
            SONARA CORE
          </p>

          <h2>Release Readiness</h2>

          <div
            style={{
              width: "100%",
              height: "16px",
              background: "#111827",
              borderRadius: "999px",
              overflow: "hidden",
              border: "1px solid rgba(148, 163, 184, 0.25)",
            }}
          >
            <div
              style={{
                width: `${releaseReadiness}%`,
                height: "100%",
                background: "linear-gradient(135deg, #22d3ee, #8b5cf6)",
              }}
            />
          </div>

          <p style={{ color: "#cbd5e1" }}>{releaseReadiness}/100 ready</p>

          <h3>Generated Output</h3>

          <pre
            style={{
              minHeight: "420px",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              background: "#050508",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "18px",
              padding: "18px",
              color: "#e5e7eb",
              overflow: "auto",
            }}
          >
            {generated || "Your generated song blueprint will appear here after you press the generate button."}
          </pre>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button onClick={copyOutput} style={secondaryButtonStyle}>
              Copy
            </button>
            <button onClick={downloadTxt} style={secondaryButtonStyle}>
              Download .txt
            </button>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: "24px",
          padding: "24px",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          borderRadius: "24px",
          background: "rgba(15, 23, 42, 0.72)",
        }}
      >
        <p style={{ color: "#22d3ee", fontWeight: 800, letterSpacing: "0.12em" }}>
          TUTORIAL
        </p>

        <h2>How to Use the Song Builder</h2>

        <ol style={{ color: "#cbd5e1", lineHeight: 1.8 }}>
          <li>Enter the song title.</li>
          <li>Add the creator, artist, or team name.</li>
          <li>Choose the genre or sound direction.</li>
          <li>Add the mood and emotional target.</li>
          <li>Choose BPM or describe the rhythmic feel.</li>
          <li>Add the key or harmonic identity.</li>
          <li>Describe the vocal mode.</li>
          <li>Add release notes, hook ideas, audience, mix notes, or timeline.</li>
          <li>Press Generate Song Blueprint.</li>
          <li>Copy or download the finished output.</li>
        </ol>
      </section>

      <section
        style={{
          marginTop: "24px",
          padding: "24px",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          borderRadius: "24px",
          background: "rgba(15, 23, 42, 0.72)",
        }}
      >
        <p style={{ color: "#22d3ee", fontWeight: 800, letterSpacing: "0.12em" }}>
          INSTRUMENT GUIDE
        </p>

        <h2>How to Use the Instruments</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            marginTop: "20px",
          }}
        >
          {instruments.map((instrument) => (
            <article
              key={instrument.name}
              style={{
                padding: "18px",
                borderRadius: "18px",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                background: "#050508",
              }}
            >
              <h3 style={{ marginTop: 0 }}>{instrument.name}</h3>
              <p style={{ color: "#cbd5e1" }}>{instrument.purpose}</p>
              <p style={{ color: "#94a3b8" }}>{instrument.howToUse}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "8px",
  marginBottom: "16px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "#050508",
  color: "white",
  outline: "none",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "rgba(15, 23, 42, 0.85)",
  color: "white",
  cursor: "pointer",
};
