"use strict";

const ARTIST_TABLES = {
  profiles: "creator_artist_profiles",
  sonic: "creator_sonic_profiles",
  albums: "creator_album_cycles",
  tracks: "creator_tracks",
  prompts: "creator_prompt_blueprints",
  checks: "creator_quality_checks",
  videos: "creator_video_treatments",
  tasks: "creator_release_tasks"
};

const TASHA_KEYS_TEMPLATE = {
  artist_name: "Tasha Keys",
  artist_key: "tasha_keys",
  public_description: "A grounded melodic rap and trap artist system for emotionally restrained, cinematic, release-ready creator workflows.",
  private_backstory: {
    tone: "conflicted, grounded, resilient, emotionally restrained",
    themes: ["faith conflict", "recovery", "survival", "luxury vs pain", "country/city tension", "family scars", "sobriety arc"],
    visual_world: ["dark luxury rooms", "designer objects", "church shadows", "neon restraint", "no fake glamour"]
  },
  voice_identity: {
    cadence: "Midwest-grounded conversational delivery with a slight Southern/country edge",
    vocal_modes: ["low melodic rap", "restrained pain vocal", "dry conversational verse", "hook-focused melodic lift"],
    avoid: ["generic pop diva", "over-singing", "copying any living artist", "named-artist vocal cloning"]
  },
  genre_blend: {
    trap: 45,
    melodic_rap: 40,
    rnb_texture: 10,
    cinematic_orchestral: 5
  },
  writing_rules: {
    style: "conversational, specific, emotionally controlled, adult, direct",
    profanity: "allowed only when natural",
    structure: "vary song structures, cadence, flow, and production by track",
    originality: "no copied lyrics, no interpolation unless rights are cleared"
  },
  visual_rules: {
    cover_art: "1:1 square, photorealistic, no person visible, dark luxury apartment/hotel/object scenes unless explicitly changed",
    video: "social-ready, shot and lit intentionally, synced to audio, avoid fake celebrity likeness"
  },
  prompt_rules: {
    max_characters: 1000,
    required: ["unique key", "unique rhythmic feel", "unique harmonic identity", "unique drum language", "unique vocal mode"],
    banned: ["copy this artist", "sound exactly like", "use copyrighted lyrics", "name living artists in public generation prompts"]
  }
};

module.exports = function registerCreatorArtistSystemRoutes(app, deps = {}) {
  const ui = buildUi(deps);
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => passthrough;
  const middleware = requireWorkspaceAccess("creator_studio");

  app.get("/creator-studio/artists", middleware, async (req, res) => {
    const summary = await artistSummary(getConfig(deps));
    return res.status(200).type("html").send(ui.layout({
      title: "Artists",
      eyebrow: "Creator Studio",
      heading: "Artist Systems",
      body: "Create reusable artist systems for personas, sonic profiles, album cycles, songs, prompts, videos, releases, and quality checks.",
      sections: [
        ui.card("Tasha Keys system", "Use the Tasha Keys method as a reusable Creator Studio artist engine: persona, sound, prompt rules, albums, songs, visuals, release tasks, and quality checks."),
        ui.card("Real outputs", "Every song, prompt, DAW job, video treatment, and release task should save real records."),
        ...summary.map((item) => ui.card(item.label, item.value))
      ],
      actions: [ui.link("/creator-studio/artists/tasha-keys", "Tasha Keys"), ui.link("/creator-studio/music-projects", "Music Projects"), ui.link("/creator-studio/dashboard", "Dashboard")]
    }));
  });

  app.get("/creator-studio/artists/tasha-keys", middleware, (req, res) => {
    return res.status(200).type("html").send(ui.layout({
      title: "Tasha Keys",
      eyebrow: "Artist system",
      heading: "Tasha Keys Creator System",
      body: "Persona, sonic identity, album cycles, tracks, prompt rules, release tasks, video treatments, DAW sessions, and AI/audio jobs for the Tasha Keys workflow.",
      sections: [
        ui.card("Persona", "Grounded melodic rap/trap system with controlled emotion, faith conflict, recovery, luxury/pain contrast, and city/country tension."),
        ui.card("Prompt rule", "Every music prompt must include a unique key, rhythmic feel, harmonic identity, drum language, and vocal mode. Keep generation prompts under 1,000 characters."),
        ui.card("Rights rule", "Do not copy lyrics from other songs. Do not ask tools to clone living artists. Use references for direction only, not imitation."),
        ui.card("Visual rule", "Dark premium visuals, photorealistic object-led covers, social-ready video treatments, and synced cue plans.")
      ],
      actions: [ui.link("/api/creator/artists/tasha-keys/template", "Template JSON"), ui.link("/creator-studio/music-projects", "Music Projects"), ui.link("/creator-studio/device-cues", "Cues")]
    }));
  });

  app.get("/api/creator/artists/tasha-keys/template", middleware, (req, res) => res.status(200).json({ ok: true, template: TASHA_KEYS_TEMPLATE }));

  app.post("/api/creator/artists/tasha-keys/install", middleware, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);

    const profilePayload = {
      ...TASHA_KEYS_TEMPLATE,
      organization_id: org.organizationId,
      user_id: org.userId || null,
      platform_id: req.body.platform_id || null,
      status: "active"
    };

    const profile = await upsertArtistProfile(config, profilePayload);
    if (!profile.ok) return res.status(500).json(profile);
    const artistId = profile.row?.id;

    const [sonic, prompt] = await Promise.all([
      insert(config, ARTIST_TABLES.sonic, {
        organization_id: org.organizationId,
        artist_profile_id: artistId,
        name: "Tasha Keys Core Sonic Profile",
        profile_key: "tasha_keys_core",
        bpm_range: "72-156 depending on half-time or trap pocket",
        keys_allowed: ["F minor", "C minor", "D minor", "A minor", "B-flat minor", "E minor"],
        drum_language: "trap drums, sliding 808s, restrained bounce, occasional orchestral tension",
        harmonic_identity: "minor-key emotional loops, cinematic pads, church-shadow chords, sparse luxury textures",
        vocal_mode: "low melodic rap, dry conversational verse, restrained hook lift",
        texture_notes: "dark premium rooms, neon edges, smoke, glass, designer contrast",
        mix_notes: "deep female vocal forward, controlled sibilance, warm low mids, crisp but not harsh top",
        mastering_notes: "competitive loudness without brittle high-end",
        avoid_notes: "no generic pop gloss, no vocal cloning, no over-bright S sounds"
      }),
      insert(config, ARTIST_TABLES.prompts, {
        organization_id: org.organizationId,
        artist_profile_id: artistId,
        blueprint_key: "tasha_keys_suno_1000",
        name: "Tasha Keys 1000 Character Music Prompt",
        purpose: "Generate safe, original music prompt text for AI music tools without copying artists or lyrics.",
        max_characters: 1000,
        prompt_template: "Original female melodic rap/trap song. Key: {{unique_key}}. Rhythmic feel: {{rhythmic_feel}}. Harmonic identity: {{harmonic_identity}}. Drum language: {{drum_language}}. Vocal mode: {{vocal_mode}}. Mood: grounded, cinematic, emotionally controlled, premium but bruised. Avoid copying artists or lyrics. Keep the sound distinct, release-ready, and specific.",
        negative_prompt_rules: "No copyrighted lyrics. No living artist cloning. No named-artist imitation. No generic prompt language. No fake rights claims."
      })
    ]);

    return res.status(200).json({ ok: true, artist: profile.row, sonic, prompt });
  });

  registerResource(app, "/api/creator/artists", ARTIST_TABLES.profiles, ["artist_name", "artist_key"], middleware, deps);
  registerResource(app, "/api/creator/sonic-profiles", ARTIST_TABLES.sonic, ["artist_profile_id", "name", "profile_key"], middleware, deps);
  registerResource(app, "/api/creator/album-cycles", ARTIST_TABLES.albums, ["artist_profile_id", "title", "slug"], middleware, deps);
  registerResource(app, "/api/creator/tracks", ARTIST_TABLES.tracks, ["artist_profile_id", "title"], middleware, deps);
  registerResource(app, "/api/creator/prompt-blueprints", ARTIST_TABLES.prompts, ["artist_profile_id", "blueprint_key", "name", "prompt_template"], middleware, deps);
  registerResource(app, "/api/creator/quality-checks", ARTIST_TABLES.checks, ["artist_profile_id", "track_id", "check_type"], middleware, deps);
  registerResource(app, "/api/creator/video-treatments", ARTIST_TABLES.videos, ["artist_profile_id", "title"], middleware, deps);
  registerResource(app, "/api/creator/release-tasks", ARTIST_TABLES.tasks, ["artist_profile_id", "title"], middleware, deps);

  app.post("/api/creator/tracks/:id/check-prompt", middleware, async (req, res) => {
    const prompt = String(req.body.suno_prompt || req.body.prompt || "");
    const required = ["key", "rhythmic", "harmonic", "drum", "vocal"];
    const missing = required.filter((word) => !prompt.toLowerCase().includes(word));
    return res.status(200).json({
      ok: missing.length === 0 && prompt.length <= 1000,
      length: prompt.length,
      max: 1000,
      missing,
      message: missing.length ? "Prompt is missing required identity fields." : prompt.length > 1000 ? "Prompt is over 1,000 characters." : "Prompt passes core rule check."
    });
  });
};

function registerResource(app, path, table, required, middleware, deps) {
  app.get(path, middleware, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    return res.status(200).json(await list(config, table));
  });

  app.post(path, middleware, async (req, res) => {
    const missing = required.filter((key) => !String(req.body[key] || "").trim());
    if (missing.length) return res.status(400).json({ ok: false, code: "validation_failed", missing });
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const payload = sanitizeObject({ ...req.body, organization_id: org.organizationId, user_id: org.userId || req.body.user_id || null });
    return res.status(200).json(await insert(config, table, payload));
  });
}

async function artistSummary(config) {
  if (!config.ok) return [{ label: "Database", value: "Setup required: Supabase service role is not configured." }];
  const rows = [
    ["Artist profiles", ARTIST_TABLES.profiles],
    ["Sonic profiles", ARTIST_TABLES.sonic],
    ["Albums / projects", ARTIST_TABLES.albums],
    ["Tracks", ARTIST_TABLES.tracks],
    ["Prompt blueprints", ARTIST_TABLES.prompts],
    ["Video treatments", ARTIST_TABLES.videos],
    ["Release tasks", ARTIST_TABLES.tasks]
  ];
  const results = await Promise.all(rows.map(async ([label, table]) => ({ label, result: await count(config, table) })));
  return results.map(({ label, result }) => ({ label, value: result.ok ? `${result.count} records` : "Setup required" }));
}

async function resolveOrganization(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (typeof deps.getCustomerPrimaryOrganization === "function" && user) {
    const org = await deps.getCustomerPrimaryOrganization(user);
    if (org?.ok) return { ok: true, organizationId: org.organizationId, userId: user.id };
  }
  const orgFromBody = sanitizeText(req.body.organization_id);
  if (orgFromBody && process.env.SONARA_ALLOW_MANUAL_ORG_ID === "true") return { ok: true, organizationId: orgFromBody, userId: user?.id || null };
  return { ok: false, code: "creator_access_required", message: "Creator Studio session is required." };
}

function getConfig(deps) {
  if (typeof deps.getSupabaseServerConfig === "function") return deps.getSupabaseServerConfig();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return { ok: false };
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function headers(config, extra = {}) {
  return { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...extra };
}

async function list(config, table) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=*&order=created_at.desc&limit=100`, { headers: headers(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, table, code: "table_unavailable", status: response?.status || null };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows };
}

async function count(config, table) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id&limit=1`, { headers: headers(config, { Prefer: "count=exact" }) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, count: null };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return { ok: true, count: match ? Number(match[1]) : 0 };
}

async function insert(config, table, payload) {
  const response = await fetch(`${config.url}/rest/v1/${table}`, { method: "POST", headers: headers(config, { Prefer: "return=representation" }), body: JSON.stringify(payload) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, table, code: "insert_failed", status: response?.status || null };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, row: Array.isArray(rows) ? rows[0] : rows };
}

async function upsertArtistProfile(config, payload) {
  const response = await fetch(`${config.url}/rest/v1/${ARTIST_TABLES.profiles}?on_conflict=organization_id,artist_key`, {
    method: "POST",
    headers: headers(config, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(payload)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, table: ARTIST_TABLES.profiles, code: "upsert_failed", status: response?.status || null };
  const rows = await response.json().catch(() => []);
  return { ok: true, row: Array.isArray(rows) ? rows[0] : rows };
}

function buildUi(deps) {
  const escape = deps.escapeHtml || ((value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"));
  return {
    layout: deps.layout || (({ title, eyebrow, heading, body, sections, actions }) => `<!doctype html><html><head><title>${escape(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${escape(eyebrow)}</p><h1>${escape(heading)}</h1><p>${escape(body)}</p><div>${(actions || []).join("")}</div><section>${(sections || []).join("")}</section></main></body></html>`),
    card: deps.brandCard || ((title, body) => `<article class="card"><h2>${escape(title)}</h2><p>${escape(body)}</p></article>`),
    link: deps.linkAction || ((href, label) => `<a class="action" href="${escape(href)}">${escape(label)}</a>`)
  };
}

function sanitizeText(value) {
  return String(value || "").trim().slice(0, 5000);
}

function sanitizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (["password", "secret", "token", "service_role", "api_key"].some((part) => key.toLowerCase().includes(part))) continue;
    output[key] = typeof item === "string" ? sanitizeText(item) : item;
  }
  return output;
}

function passthrough(req, res, next) {
  return next();
}
