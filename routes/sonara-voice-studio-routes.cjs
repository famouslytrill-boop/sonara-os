"use strict";

// What this application can say about a voice service the owner runs.
//
//   GET /creator-studio/voice-studio    what it is, and whether it is reachable
//   GET /api/creator/voice-studio/status  the same, as JSON
//
// Neither carries audio. `lib/sonara-voice-clone-adapter.cjs` explains at
// length why not; the short version is that a reference clip is somebody's
// voice, a serverless function is the wrong pipe for it, and the consent gate
// lives at the service rather than here.
//
// So this page is deliberately not a control panel. It is the answer to "is my
// voice studio set up, what can it do, and what will it refuse" -- and a link
// to the owner's own instance, where the work happens.
//
// ## Why it renders at all when nothing is configured
//
// Because that is the state almost everybody is in, and a page that only exists
// once a service is running is a page nobody discovers in time to set the
// service up. Unconfigured, it says what the feature is, what it would need,
// and that no voice may be cloned without recorded consent. That last sentence
// is worth showing whether or not anything is plugged in.

const { getVoiceCloneReadiness, capabilities, ENV_KEYS, LABEL } = require("../lib/sonara-voice-clone-adapter.cjs");

// The consent rule, in one place, rendered on the page and returned in the
// JSON. AGENTS.md requires provenance, consent and anti-clone safety; a page
// about voice cloning that did not say so would be the gap.
const CONSENT_RULE = [
  "A voice is only cloned when the speaker has read a phrase this service issued for that request, and the recording matches it.",
  "A check that could not run is never treated as consent.",
  "Every clone carries a record of who consented and when, every refusal is recorded too, and a refused reference clip is deleted.",
  "Generated audio is watermarked."
];

// What the states mean to somebody reading the page, rather than the codes.
const EXPLAIN = Object.freeze({
  disabled: "Off. This has not been switched on, so nothing is being called.",
  setup_required: "Turned on, but not finished being set up.",
  unreachable_from_serverless: "Pointed at an address this deployment cannot reach.",
  configured: "Configured.",
  rejected: "Reachable, but it did not accept the token.",
  unreachable: "Configured, and it did not answer.",
  timed_out: "Configured, and it did not answer in time.",
  failed: "Configured, and the call failed.",
  unreadable_response: "Reachable, but what came back was not what this expects."
});

function describe(readiness, probe) {
  const state = probe && !probe.ok ? probe.code : readiness.status;
  return {
    state,
    summary: EXPLAIN[state] || "Unknown.",
    detail: (probe && !probe.ok ? probe.detail : readiness.detail) || "",
    // Host, never the URL. A base URL can carry a token in its query string,
    // and this is rendered onto a page.
    host: readiness.host || null,
    capabilities: probe && probe.ok ? probe.data : null
  };
}

module.exports = function registerVoiceStudioRoutes(app, deps = {}) {
  const layout = deps.layout;
  const brandCard = deps.brandCard;
  const linkAction = deps.linkAction;
  const escapeHtml = deps.escapeHtml;
  const requireCustomer = deps.requireCustomer;
  for (const [name, value] of Object.entries({ layout, brandCard, linkAction, escapeHtml, requireCustomer })) {
    if (typeof value !== "function") throw new TypeError(`registerVoiceStudioRoutes requires ${name}`);
  }

  async function read() {
    const readiness = getVoiceCloneReadiness();
    // Only call out when there is somewhere to call. An unconfigured service
    // must not produce a request, a timeout, or a wait on a page load.
    const probe = readiness.status === "configured" ? await capabilities(readiness) : null;
    return describe(readiness, probe);
  }

  app.get("/api/creator/voice-studio/status", requireCustomer, async (req, res) => {
    const state = await read();
    res.status(200).json({ ok: true, service: LABEL, ...state, consentRule: CONSENT_RULE });
  });

  app.get("/creator-studio/voice-studio", requireCustomer, async (req, res) => {
    const state = await read();
    const sections = [];

    sections.push(brandCard(
      "What this is",
      "A voice studio you run on your own machine. Upload a clip of somebody speaking, prove they agreed, "
      + "and type what they should say -- in English, Spanish, French, Chinese, Japanese or Korean, whichever "
      + "language the sample was in."
    ));

    sections.push(brandCard("Consent is proved, not asked about", CONSENT_RULE.join(" ")));

    if (state.state === "configured" && state.capabilities) {
      const caps = state.capabilities;
      const languages = caps.languages.map((entry) => entry.name).join(", ");
      sections.push(brandCard(
        "Your studio is reachable",
        `${caps.engine} at ${state.host}. `
        + (caps.producesRealSpeech === true
          ? "It is loaded with a speech model."
          : caps.producesRealSpeech === false
            ? "It is running without a speech model, so it returns a tone rather than a cloned voice."
            : "It did not say whether a speech model is loaded.")
      ));
      if (languages) sections.push(brandCard("Languages it offers", languages));
      if (caps.styles.length) {
        sections.push(brandCard(
          "Styles it offers",
          caps.styles.length === 1
            ? `One: ${caps.styles[0]}. This engine takes its delivery from the base speaker rather than from a named emotion.`
            : caps.styles.join(", ")
        ));
      }
    } else {
      sections.push(brandCard(`Not ready: ${state.summary}`, state.detail));
      sections.push(brandCard(
        "What it needs",
        `${ENV_KEYS.enabled}=true, ${ENV_KEYS.baseUrl} pointing at your studio, and ${ENV_KEYS.token} `
        + "matching the token it was started with. The token is not optional: a studio reachable from the "
        + "internet without a token on it is a voice cloner anybody can use."
      ));
      sections.push(brandCard(
        "A local address will not work in production",
        "This application runs as serverless functions, so localhost means the function's own container rather "
        + "than your machine. docs/architecture/EXTERNAL-SERVICES.md sets out the three ways round it, starting "
        + "with a tunnel."
      ));
    }

    sections.push(brandCard(
      "Audio never passes through this application",
      "A reference clip is somebody's voice, and this application is not a place that holds voices. The recording, "
      + "the consent check and the generated audio all stay on the machine running the studio."
    ));

    res.status(200).type("html").send(layout({
      title: "Voice studio",
      eyebrow: "Creator Studio",
      heading: "Voice studio",
      body: "Clone a voice with the speaker's recorded consent, in six languages, on hardware you own.",
      sections,
      actions: [
        linkAction("/creator-studio/dashboard", "Back to your workspace")
      ]
    }));
  });
};

module.exports.CONSENT_RULE = CONSENT_RULE;
module.exports.EXPLAIN = EXPLAIN;
module.exports.describe = describe;
