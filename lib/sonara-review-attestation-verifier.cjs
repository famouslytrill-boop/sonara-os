// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// STAGED, UNMOUNTED verifier: no route, SQL, signing keys, publishing, payment,
// or provider connection. Reviewers sign server-produced content-bound claims.
// A public feed candidate requires TWO independent, enabled Ed25519 signers:
// moderation and rights. The key registry and safety snapshot must be supplied
// by trusted SERVER infrastructure, not a browser, post, report or JWT profile.
//
// This is SONARA-specific review evidence; NOT a C2PA Content Credential.
// A cryptographic signature proves key possession, NOT that a reviewer or the
// underlying content is genuinely lawful, safe or original. Only a separately
// managed reviewer roster / issuance service can establish those facts.

const { createPublicKey, verify } = require("node:crypto");

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const COUNTRY = /^[A-Z]{2}$/;
const MAX_ITEMS = 250;
const MAX_KEYS = 24;
const MAX_STATE = 500;
const MAX_CLOCK_DRIFT = 60 * 1000;
const ROLES = Object.freeze(["moderation", "rights"]);
const FIELDS = Object.freeze([
  "attestationId", "policyVersion", "postId", "channelId",
  "organizationId", "postVersion", "channelVersion", "contentDigest",
  "moderationStatus", "rightsStatus", "sponsored", "aiGenerated",
  "originalityVerified", "quality", "diversity", "verifiedAt",
  "expiresAt", "topic", "ageRating", "territory", "allowedCountries"
]);

function deny(code) {
  return Object.freeze({ ok: false, code, entries: Object.freeze([]) });
}
function isId(s) {
  return typeof s === "string" && ID.test(s);
}
function isKeyId(s) {
  return typeof s === "string" && KEY_ID.test(s);
}
function isInstant(s) {
  return typeof s === "string" && s.length >= 20 && s.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) &&
    Number.isFinite(Date.parse(s));
}
function isClaim(c) {
  return c && typeof c === "object" && !Array.isArray(c) &&
    Object.keys(c).length === FIELDS.length && FIELDS.every(k =>
      Object.prototype.hasOwnProperty.call(c, k)) &&
    [c.attestationId,c.postId,c.channelId,c.organizationId].every(isId) &&
    isKeyId(c.policyVersion) &&
    isInstant(c.postVersion) && isInstant(c.channelVersion) &&
    isInstant(c.verifiedAt) && isInstant(c.expiresAt) &&
    typeof c.contentDigest === "string" && SHA256.test(c.contentDigest) &&
    c.moderationStatus === "approved" && c.rightsStatus === "cleared" &&
    typeof c.sponsored === "boolean" && typeof c.aiGenerated === "boolean" &&
    typeof c.originalityVerified === "boolean" &&
    [c.quality,c.diversity].every(n=>typeof n === "number" &&
      Number.isFinite(n) && n>=0 && n<=1) &&
    typeof c.topic === "string" &&
    /^[a-z0-9][a-z0-9 _-]{0,63}$/.test(c.topic) &&
    ["general","mature"].includes(c.ageRating) &&
    (c.territory === "global" || c.territory === "restricted") &&
    Array.isArray(c.allowedCountries) && c.allowedCountries.length <= 50 &&
    c.allowedCountries.every(n=>typeof n === "string" && COUNTRY.test(n)) &&
    new Set(c.allowedCountries).size === c.allowedCountries.length &&
    (c.territory !== "restricted" || c.allowedCountries.length > 0) &&
    (c.territory !== "global" || c.allowedCountries.length === 0) &&
    Date.parse(c.expiresAt)>Date.parse(c.verifiedAt);
}

/** Explicit ordered, domain-separated bytes: no JSON object key-order risk. */
function signingMessage(role, keyId, claim) {
  if (!ROLES.includes(role) || !isKeyId(keyId) || !isClaim(claim))
    throw new TypeError("invalid attestation signing payload");
  return Buffer.from(JSON.stringify([
    "SONARA-review-attestation-v1", role, keyId,
    ...FIELDS.map(f=>claim[f])
  ]), "utf8");
}
function readSignature(signature) {
  if (typeof signature !== "string" ||
      !/^[A-Za-z0-9_-]{86}$/.test(signature)) return null;
  try {
    const b=Buffer.from(signature,"base64url");
    return b.length===64 && b.toString("base64url")===signature ? b : null;
  } catch { return null; }
}
function trustKeys(result) {
  if (!result || result.ok !== true ||
      !Number.isSafeInteger(result.revision) || result.revision < 1 ||
      !isKeyId(result.policyVersion) ||
      !Array.isArray(result.keys) || result.keys.length < 2 ||
      result.keys.length > MAX_KEYS) return null;
  const keys=new Map();
  for (const key of result.keys) {
    if (!key || !isKeyId(key.keyId) || !ROLES.includes(key.role) ||
        typeof key.publicKeyPem !== "string" ||
        key.publicKeyPem.length < 50 || key.publicKeyPem.length > 4000 ||
        typeof key.enabled !== "boolean" || keys.has(key.keyId)) return null;
    let publicKey;
    try { publicKey=createPublicKey(key.publicKeyPem); }
    catch { return null; }
    if (publicKey.asymmetricKeyType !== "ed25519" ||
        publicKey.type !== "public") return null;
    keys.set(key.keyId,{role:key.role,enabled:key.enabled,publicKey});
  }
  return {revision:result.revision,policyVersion:result.policyVersion,keys};
}
function safety(result, ids, now) {
  if (!result || result.ok !== true ||
      !Number.isSafeInteger(result.revision) || result.revision < 1 ||
      !isInstant(result.checkedAt) ||
      Date.parse(result.checkedAt)>now ||
      now-Date.parse(result.checkedAt)>MAX_CLOCK_DRIFT) return null;
  const sets={};
  for (const [field,validate] of [
    ["heldPostIds",isId],["revokedAttestationIds",isId],
    ["revokedKeyIds",isKeyId]
  ]) {
    if (!Array.isArray(result[field]) || result[field].length>MAX_STATE ||
        !result[field].every(validate)) return null;
    const values=result[field].map(x=>x.toLowerCase());
    if (new Set(values).size!==values.length) return null;
    sets[field]=new Set(values);
  }
  if (result.heldPostIds.some(x=>!ids.has(x.toLowerCase()))) return null;
  return {revision:result.revision,checkedAt:result.checkedAt,
    fingerprint:JSON.stringify([
      [...sets.heldPostIds].sort(),[...sets.revokedAttestationIds].sort(),
      [...sets.revokedKeyIds].sort()
    ]), ...sets};
}
function approved(envelope,keys,record,postIds,nowMs) {
  if (!envelope || typeof envelope!=="object" || Array.isArray(envelope) ||
      Object.keys(envelope).length!==2 ||
      !Object.prototype.hasOwnProperty.call(envelope,"claim") ||
      !Object.prototype.hasOwnProperty.call(envelope,"signatures") ||
      !isClaim(envelope.claim)) return null;
  const c=envelope.claim;
  if (!postIds.has(c.postId.toLowerCase()) ||
      c.policyVersion!==keys.policyVersion ||
      Date.parse(c.verifiedAt)>nowMs ||
      nowMs-Date.parse(c.verifiedAt)>15*60*1000 ||
      Date.parse(c.expiresAt)<=nowMs ||
      Date.parse(c.expiresAt)-Date.parse(c.verifiedAt)>60*60*1000 ||
      record.heldPostIds.has(c.postId.toLowerCase()) ||
      record.revokedAttestationIds.has(c.attestationId.toLowerCase())) return null;

  if (!envelope.signatures ||
      typeof envelope.signatures!=="object" ||
      Array.isArray(envelope.signatures) ||
      Object.keys(envelope.signatures).length!==2 ||
      !ROLES.every(r=>Object.prototype.hasOwnProperty.call(envelope.signatures,r)))
    return null;
  const used=new Set();
  for (const role of ROLES) {
    const signature=envelope.signatures[role];
    if (!signature || typeof signature!=="object" ||
        Array.isArray(signature) || Object.keys(signature).length!==2 ||
        !isKeyId(signature.keyId) || typeof signature.signature!=="string")
      return null;
    const id=signature.keyId;
    const key=keys.keys.get(id);
    const bytes=readSignature(signature.signature);
    if (!bytes || !key || !key.enabled || key.role!==role ||
        used.has(id) || record.revokedKeyIds.has(id.toLowerCase())) return null;
    try {
      if (!verify(null,signingMessage(role,id,c),key.publicKey,bytes)) return null;
    } catch { return null; }
    used.add(id);
  }
  // Downstream output is a newly reconstructed, verified claim, not an
  // attestation envelope or private reviewer identity.
  return Object.freeze(Object.fromEntries(FIELDS.map(f=>[
    f, f==="allowedCountries" ? Object.freeze([...c[f]]) : c[f]
  ])));
}

/**
 * Wrapper suitable ONLY for an independently verified SERVER registry.
 * The returned loadAttestations callback plugs into
 * createGrowthPublicProjectionSource({loadGrowthRows,loadAttestations,clock}).
 *
 * The source ports must authenticate & strictly scope themselves. A trust
 * snapshot made from browser fields is NOT a trust list. Safety must be a
 * complete authoritative holds+revocations snapshot for requested posts.
 */
function createVerifiedAttestationLoader({loadSignedAttestations,
  loadTrustRegistry,loadSafetyState,clock}={}) {
  if ([loadSignedAttestations,loadTrustRegistry,loadSafetyState,clock]
    .some(f=>typeof f!=="function"))
    throw new TypeError("verified attestation loader requires four trusted server ports");
  return async function loadAttestations({postIds,scope}={}) {
    if (scope!=="discovery_proof" || !Array.isArray(postIds) ||
        postIds.length>MAX_ITEMS ||
        postIds.some(x=>!isId(x)) ||
        new Set(postIds.map(x=>x.toLowerCase())).size!==postIds.length)
      return deny("attestation_request_invalid");
    if (postIds.length===0) return Object.freeze({ok:true,entries:Object.freeze([])});
    let now;
    try {now=clock();}catch{return deny("attestation_clock_unavailable");}
    if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
      return deny("attestation_clock_unavailable");
    const at=now.getTime(),ids=new Set(postIds.map(x=>x.toLowerCase()));
    let trust,first,raw,second;
    try {
      trust=trustKeys(await loadTrustRegistry({scope:"internal_approved_review_keys"}));
      first=safety(await loadSafetyState({postIds:[...ids],fresh:true}),ids,at);
    }catch{return deny("attestation_authority_unavailable");}
    if (!trust || !first) return deny("attestation_authority_unavailable");
    try {raw=await loadSignedAttestations({postIds:[...ids],scope:"signed_discovery_reviews"});}
    catch {return deny("attestation_source_unavailable");}
    if (!raw || raw.ok!==true || !Array.isArray(raw.entries) ||
        raw.entries.length>postIds.length)
      return deny("attestation_source_unavailable");
    const entries=[],seen=new Set();
    for (const entry of raw.entries) {
      if (!entry || !isId(entry.claim?.postId)) return deny("attestation_ambiguous");
      const id=entry.claim.postId.toLowerCase();
      if (!ids.has(id) || seen.has(id)) return deny("attestation_ambiguous");
      seen.add(id);
      const accepted=approved(entry,trust,first,ids,at);
      if (accepted) entries.push(accepted);
    }
    try {second=safety(await loadSafetyState({postIds:[...ids],fresh:true}),ids,at);}
    catch {return deny("attestation_authority_unavailable");}
    if (!second || second.revision!==first.revision ||
        second.fingerprint!==first.fingerprint)
      return deny("attestation_safety_changed");
    return Object.freeze({ok:true,entries:Object.freeze(entries)});
  };
}
module.exports={FIELDS,ROLES,signingMessage,createVerifiedAttestationLoader};
