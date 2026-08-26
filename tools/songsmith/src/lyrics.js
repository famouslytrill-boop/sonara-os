"use strict";

// The writing helper: a prompt in, a title, a style note and structured lyrics
// out.
//
// ## Two sources, and the page says which
//
// If a language model is configured, it writes the draft. If one is not, this
// still answers -- with a **structure outline**: the section headings, a title
// taken from the prompt, and a style line assembled from what the person
// actually typed. That is genuinely useful (an empty editor is the hardest part
// of writing anything) and it is not a song.
//
// So `source` comes back on every result, `"model"` or `"outline"`, and the
// page prints it. A scaffold presented as a written draft would be the same
// defect as a progress bar that moves on its own: a signal reporting more than
// happened.
//
// ## The model call is server side, and stays there
//
// The key is read from the environment in this process and never reaches a
// page. The endpoint is OpenAI-shaped because that is what nearly every
// self-hostable inference server speaks -- llama.cpp, vLLM, Ollama's compatible
// route -- so "self-hosted" can stay true all the way down if the owner wants
// it to.

const SECTIONS = ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"];

const STYLES = [
  "indie folk", "synthwave", "lo-fi hip hop", "soul ballad", "garage rock",
  "ambient", "country", "drum and bass", "gospel", "bossa nova", "punk", "orchestral"
];

const SYSTEM = [
  "You draft song lyrics. Answer with JSON only, no prose around it, shaped:",
  '{"title": string, "style": string, "lyrics": string}.',
  "The lyrics must use section headings in square brackets, like [Verse 1] and [Chorus], one per line, with the lines of that section beneath it.",
  "The style is one short sentence naming genre, tempo, instruments and voice.",
  "Write original words. Do not reproduce the lyrics of an existing song, and do not name a recording artist as somebody to imitate."
].join(" ");

function createDrafter({
  apiKey = process.env.SONGSMITH_LLM_API_KEY || "",
  baseUrl = process.env.SONGSMITH_LLM_BASE_URL || "",
  model = process.env.SONGSMITH_LLM_MODEL || "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 45000
} = {}) {
  // A base URL and a model are the requirement; a key is not. A local
  // llama.cpp or Ollama has no key, and demanding one would rule out exactly
  // the setup this application is meant for.
  const configured = Boolean(baseUrl && model);

  async function fromModel(prompt, style) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          temperature: 0.9,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: style ? `${prompt}\n\nStyle to aim for: ${style}` : prompt }
          ]
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`the writing model answered ${response.status}`);
    const payload = await response.json();
    const text = payload && payload.choices && payload.choices[0] && payload.choices[0].message
      ? payload.choices[0].message.content
      : null;
    if (typeof text !== "string" || !text.trim()) throw new Error("the writing model answered with no content");
    return parse(text);
  }

  return {
    configured,
    async draft({ prompt, style }) {
      const asked = String(prompt || "").trim();
      if (!asked) return { ok: false, problem: "Say what the song should be about." };
      if (!configured) return { ok: true, source: "outline", ...outline(asked, style) };
      try {
        return { ok: true, source: "model", ...(await fromModel(asked, style)) };
      } catch (error) {
        // Falls back to the outline, and says both things: what was tried and
        // what came back instead. Silently returning the outline would make a
        // broken model endpoint look like a working one that writes badly.
        return {
          ok: true,
          source: "outline",
          problem: `The writing model could not be used: ${error.message}`,
          ...outline(asked, style)
        };
      }
    }
  };
}

/**
 * Read a model's answer.
 *
 * Models fence JSON in markdown roughly half the time, so the fence comes off
 * before parsing. A reply that is not JSON at all is treated as the lyrics
 * themselves rather than thrown away -- the words are the valuable part, and
 * losing a good draft over a formatting habit would be perverse.
 */
function parse(text) {
  const stripped = String(text).replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === "object" && typeof parsed.lyrics === "string" && parsed.lyrics.trim()) {
      return {
        title: String(parsed.title || "").trim().slice(0, 120) || "Untitled",
        style: String(parsed.style || "").trim().slice(0, 500),
        lyrics: parsed.lyrics.trim().slice(0, 20000)
      };
    }
  } catch {
    // Not JSON. Handled below.
  }
  return { title: "Untitled", style: "", lyrics: stripped.slice(0, 20000) };
}

/**
 * The no-model answer: a structure to write into.
 *
 * Every line is either a heading or an explicit placeholder in brackets. That
 * is on purpose -- somebody who submits this unedited gets a song about
 * "(a line about ...)", which is obvious, rather than plausible filler they
 * might not notice was not theirs.
 */
function outline(prompt, style) {
  const words = String(prompt).split(/\s+/).filter(Boolean);
  const title = words.slice(0, 6).join(" ").replace(/[.,;:!?]+$/, "") || "Untitled";
  const guessed = STYLES.find((name) => String(prompt).toLowerCase().includes(name));
  const lines = [];
  for (const section of SECTIONS) {
    lines.push(`[${section}]`);
    for (let index = 0; index < (section === "Chorus" ? 2 : 4); index += 1) {
      lines.push(`(a line about ${title.toLowerCase()})`);
    }
    lines.push("");
  }
  return {
    title: title.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    style: String(style || "").trim() || (guessed ? `${guessed}, moderate tempo` : "Describe the genre, tempo, instruments and voice."),
    lyrics: lines.join("\n").trim()
  };
}

/**
 * The section headings a lyric sheet actually uses.
 *
 * Used by the page to show the structure beside the words. Returns [] rather
 * than a guessed structure when there are no headings, and the page says
 * "no sections marked" -- which is a fact, where "[Verse 1]" would not be.
 */
function structureOf(lyrics) {
  const found = [];
  for (const line of String(lyrics || "").split("\n")) {
    const match = line.match(/^\s*\[([^\]]{1,40})\]\s*$/);
    if (match) found.push(match[1].trim());
  }
  return found;
}

module.exports = { createDrafter, outline, parse, structureOf, SECTIONS, STYLES, SYSTEM };
