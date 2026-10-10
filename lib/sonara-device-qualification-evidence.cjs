// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const PLATFORMS = Object.freeze(["android", "ios"]);
const RESULT_STATES = Object.freeze(["pass", "fail", "not_applicable"]);

const COMMON_CASES = Object.freeze([
  "physical_device_identity",
  "secure_context",
  "account_permission_off_blocks_prompt",
  "browser_permission_granted",
  "browser_permission_denied",
  "bounded_motion_sample",
  "hidden_page_stops_capture",
  "revocation_after_load_blocks_write",
  "rotation_reflow",
  "text_scaling",
  "reduced_motion",
  "auth_session_continuity"
]);

const PROFILE_CASES = Object.freeze({
  motion_web: COMMON_CASES,
  android_twa: Object.freeze([
    ...COMMON_CASES,
    "play_signed_internal_install",
    "digital_asset_links",
    "app_link_route",
    "offline_public_fallback",
    "tenant_private_cache_excluded",
    "push_permission_opt_in"
  ]),
  ios_internal_shell: Object.freeze([
    ...COMMON_CASES,
    "signed_internal_install",
    "universal_link_route",
    "voiceover_navigation",
    "offline_boundary",
    "tenant_private_cache_excluded"
  ])
});

const PROFILE_PLATFORMS = Object.freeze({
  motion_web: Object.freeze(["android", "ios"]),
  android_twa: Object.freeze(["android"]),
  ios_internal_shell: Object.freeze(["ios"])
});

function text(value, max) {
  const clean = String(value || "").trim();
  return clean && clean.length <= max ? clean : null;
}

function validSha(value) {
  return /^[0-9a-f]{40}$/i.test(String(value || ""));
}

function validIso(value) {
  const raw = String(value || "");
  const time = Date.parse(raw);
  return Number.isFinite(time) && new Date(time).toISOString() === raw;
}

function normalizeCase(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { ok: false, code: "case_invalid" };
  const key = text(entry.key, 80);
  const status = text(entry.status, 32);
  if (!key) return { ok: false, code: "case_key_invalid" };
  if (!RESULT_STATES.includes(status)) return { ok: false, code: "case_status_invalid", key };
  const notes = entry.notes == null ? null : text(entry.notes, 800);
  if (entry.notes != null && !notes) return { ok: false, code: "case_notes_invalid", key };
  const evidenceSha256 = entry.evidenceSha256 == null ? null : String(entry.evidenceSha256).toLowerCase();
  if (evidenceSha256 !== null && !/^[0-9a-f]{64}$/.test(evidenceSha256)) {
    return { ok: false, code: "case_evidence_hash_invalid", key };
  }
  return { ok: true, value: { key, status, notes, evidenceSha256 } };
}

function validateRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, code: "record_invalid" };
  const platform = text(input.platform, 16);
  const profile = text(input.profile, 40);
  if (!PLATFORMS.includes(platform)) return { ok: false, code: "platform_invalid" };
  if (!Object.prototype.hasOwnProperty.call(PROFILE_CASES, profile)) return { ok: false, code: "profile_invalid" };
  if (!PROFILE_PLATFORMS[profile].includes(platform)) return { ok: false, code: "profile_platform_mismatch" };
  if (input.physicalDevice !== true) return { ok: false, code: "physical_device_required" };
  if (!validSha(input.releaseSha)) return { ok: false, code: "release_sha_invalid" };
  if (!validIso(input.capturedAt)) return { ok: false, code: "captured_at_invalid" };

  const deviceModel = text(input.deviceModel, 120);
  const osVersion = text(input.osVersion, 80);
  const browserName = text(input.browserName, 80);
  const browserVersion = text(input.browserVersion, 80);
  const installMode = text(input.installMode, 80);
  const buildIdentity = text(input.buildIdentity, 160);
  if (!deviceModel || !osVersion || !browserName || !browserVersion || !installMode || !buildIdentity) {
    return { ok: false, code: "device_identity_incomplete" };
  }

  if (!Array.isArray(input.cases)) return { ok: false, code: "cases_invalid" };
  const cases = [];
  const seen = new Set();
  for (const rawCase of input.cases) {
    const normalized = normalizeCase(rawCase);
    if (!normalized.ok) return normalized;
    if (seen.has(normalized.value.key)) return { ok: false, code: "case_duplicate", key: normalized.value.key };
    seen.add(normalized.value.key);
    cases.push(normalized.value);
  }

  const required = PROFILE_CASES[profile];
  const missing = required.filter((key) => !seen.has(key));
  if (missing.length) return { ok: false, code: "required_cases_missing", missing };

  return {
    ok: true,
    value: {
      platform,
      profile,
      physicalDevice: true,
      releaseSha: String(input.releaseSha).toLowerCase(),
      capturedAt: String(input.capturedAt),
      deviceModel,
      osVersion,
      browserName,
      browserVersion,
      installMode,
      buildIdentity,
      cases
    }
  };
}

function qualificationFor(records, { platform, profile, releaseSha }) {
  if (!PLATFORMS.includes(platform)) return { ok: false, qualified: false, code: "platform_invalid" };
  if (!PROFILE_PLATFORMS[profile]?.includes(platform)) return { ok: false, qualified: false, code: "profile_platform_mismatch" };
  if (!validSha(releaseSha)) return { ok: false, qualified: false, code: "release_sha_invalid" };

  const matching = [];
  const invalid = [];
  for (const raw of Array.isArray(records) ? records : []) {
    const validated = validateRecord(raw);
    if (!validated.ok) {
      invalid.push(validated);
      continue;
    }
    const record = validated.value;
    if (record.platform === platform && record.profile === profile && record.releaseSha === String(releaseSha).toLowerCase()) {
      matching.push(record);
    }
  }
  if (invalid.length) return { ok: false, qualified: false, code: "invalid_records", invalid };
  if (!matching.length) return { ok: true, qualified: false, code: "physical_device_evidence_missing", matching: 0 };

  for (const record of matching) {
    const byKey = new Map(record.cases.map((entry) => [entry.key, entry]));
    const failed = PROFILE_CASES[profile].filter((key) => byKey.get(key)?.status !== "pass");
    if (!failed.length) {
      return {
        ok: true,
        qualified: true,
        code: "qualified",
        releaseSha: record.releaseSha,
        capturedAt: record.capturedAt,
        deviceModel: record.deviceModel,
        buildIdentity: record.buildIdentity
      };
    }
  }
  return { ok: true, qualified: false, code: "required_cases_not_passed", matching: matching.length };
}

module.exports = {
  PLATFORMS,
  RESULT_STATES,
  COMMON_CASES,
  PROFILE_CASES,
  PROFILE_PLATFORMS,
  validSha,
  validateRecord,
  qualificationFor
};
