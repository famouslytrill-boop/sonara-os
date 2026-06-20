/* SONARA Creator Studio Music System helper */
(function () {
  const root = (window.SONARA = window.SONARA || {});

  const routes = {
    systems: "/api/creator/artist-systems",
    voice: "/api/creator/voice-profiles",
    sound: "/api/creator/influence-maps",
    story: "/api/creator/narrative-arcs",
    songs: "/api/creator/song-blueprints",
    sections: "/api/creator/song-sections",
    notes: "/api/creator/production-notes",
    packs: "/api/creator/prompt-packs",
    releases: "/api/creator/release-packages",
    checks: "/api/creator/quality-checks",
    exports: "/api/creator/export-packages",
    readiness: "/api/creator/music-system/readiness"
  };

  const requiredSongFields = [
    "key_signature",
    "rhythmic_feel",
    "harmonic_identity",
    "drum_language",
    "vocal_mode"
  ];

  function formDataToJson(form) {
    const data = new FormData(form);
    const payload = {};
    for (const [key, value] of data.entries()) {
      payload[key] = String(value || "").trim();
    }
    return payload;
  }

  async function save(route, payload) {
    const response = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({ ok: false, code: "bad_json" }));
    if (!response.ok) return Object.assign({ ok: false, status: response.status }, result);
    return result;
  }

  async function load(route) {
    const response = await fetch(route);
    const result = await response.json().catch(() => ({ ok: false, code: "bad_json" }));
    if (!response.ok) return Object.assign({ ok: false, status: response.status }, result);
    return result;
  }

  function validateSongBlueprint(payload) {
    return requiredSongFields.filter((field) => !String(payload[field] || "").trim());
  }

  function attachForm(form, route, options) {
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const payload = formDataToJson(form);
      if (options && typeof options.validate === "function") {
        const missing = options.validate(payload);
        if (missing.length) {
          alert("Missing required fields: " + missing.join(", "));
          return;
        }
      }
      const result = await save(route, payload);
      const output = form.querySelector("[data-result]");
      if (output) output.textContent = JSON.stringify(result, null, 2);
    });
  }

  function attachAll() {
    attachForm(document.querySelector("[data-creator-system-form]"), routes.systems);
    attachForm(document.querySelector("[data-creator-voice-form]"), routes.voice);
    attachForm(document.querySelector("[data-creator-sound-form]"), routes.sound);
    attachForm(document.querySelector("[data-creator-story-form]"), routes.story);
    attachForm(document.querySelector("[data-creator-song-form]"), routes.songs, { validate: validateSongBlueprint });
    attachForm(document.querySelector("[data-creator-section-form]"), routes.sections);
    attachForm(document.querySelector("[data-creator-note-form]"), routes.notes);
    attachForm(document.querySelector("[data-creator-pack-form]"), routes.packs);
    attachForm(document.querySelector("[data-creator-release-form]"), routes.releases);
    attachForm(document.querySelector("[data-creator-check-form]"), routes.checks);
    attachForm(document.querySelector("[data-creator-export-form]"), routes.exports);
  }

  root.creatorMusicSystem = {
    routes,
    requiredSongFields,
    load,
    save,
    validateSongBlueprint,
    attachForm,
    attachAll
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAll);
  } else {
    attachAll();
  }
})();
