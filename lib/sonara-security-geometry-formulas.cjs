// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic evidence math and geometry. Integer coordinates avoid silent
// floating-point drift. Geometry is a spatial signal only; it never grants
// authentication, physical access, legal authority, or payment authority.
const MAX_COORD = 1_000_000_000;
const TRUSTED_COORDINATE_SOURCES = new Set([
  "server_measured",
  "provider_verified",
  "user_confirmed_layout"
]);

function safeInt(name, value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new TypeError(`invalid_${name}`);
  return value;
}
function coordinate(value, name) {
  return safeInt(name, value, -MAX_COORD, MAX_COORD);
}
function rect(input, prefix) {
  if (!input || typeof input !== "object") throw new TypeError(`invalid_${prefix}_rectangle`);
  const minX = coordinate(input.minX, `${prefix}_min_x`);
  const minY = coordinate(input.minY, `${prefix}_min_y`);
  const maxX = coordinate(input.maxX, `${prefix}_max_x`);
  const maxY = coordinate(input.maxY, `${prefix}_max_y`);
  if (maxX <= minX || maxY <= minY) throw new TypeError(`invalid_${prefix}_rectangle`);
  return { minX, minY, maxX, maxY };
}

function evidenceWeightedCoverage(requirements = []) {
  if (!Array.isArray(requirements) || requirements.length === 0)
    throw new TypeError("requirements_required");
  let total = 0n;
  let satisfied = 0n;
  const blockers = [];
  const seen = new Set();
  for (const row of requirements) {
    if (!row || typeof row.key !== "string" || !/^[a-z0-9._:-]{2,120}$/i.test(row.key))
      throw new TypeError("invalid_requirement_key");
    if (seen.has(row.key)) throw new TypeError("duplicate_requirement_key");
    seen.add(row.key);
    const weight = safeInt("requirement_weight", row.weight, 1, 1_000_000);
    total += BigInt(weight);
    if (row.verified === true && row.current === true) satisfied += BigInt(weight);
    else if (row.required !== false) blockers.push(row.key);
  }
  const basisPoints = Number((satisfied * 10_000n) / total);
  return Object.freeze({
    basisPoints,
    satisfiedWeight: satisfied.toString(),
    totalWeight: total.toString(),
    blockers: Object.freeze(blockers),
    certificationClaimed: false,
    probabilityClaimed: false
  });
}

function polygonDoubleArea(points = []) {
  if (!Array.isArray(points) || points.length < 3) throw new TypeError("polygon_requires_three_points");
  const normalized = points.map((p, i) => {
    if (!p || typeof p !== "object") throw new TypeError(`invalid_point_${i}`);
    return { x: coordinate(p.x, `point_${i}_x`), y: coordinate(p.y, `point_${i}_y`) };
  });
  let twice = 0n;
  for (let i = 0; i < normalized.length; i += 1) {
    const a = normalized[i];
    const b = normalized[(i + 1) % normalized.length];
    twice += BigInt(a.x) * BigInt(b.y) - BigInt(a.y) * BigInt(b.x);
  }
  if (twice < 0n) twice = -twice;
  return Object.freeze({
    doubleAreaUnits2: twice.toString(),
    wholeAreaUnits2: (twice / 2n).toString(),
    halfUnitRemainder: Number(twice % 2n),
    geometryValidated: true
  });
}

function rectangleOverlapBps(first, second) {
  const a = rect(first, "first");
  const b = rect(second, "second");
  const width = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const height = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  const overlap = BigInt(width) * BigInt(height);
  const areaA = BigInt(a.maxX - a.minX) * BigInt(a.maxY - a.minY);
  const areaB = BigInt(b.maxX - b.minX) * BigInt(b.maxY - b.minY);
  const smaller = areaA < areaB ? areaA : areaB;
  const bps = Number((overlap * 10_000n) / smaller);
  return Object.freeze({
    overlapAreaUnits2: overlap.toString(),
    overlapOfSmallerBasisPoints: bps,
    intersects: overlap > 0n
  });
}

function withinRadiusSquared({ point, center, radiusUnits } = {}) {
  if (!point || !center) throw new TypeError("point_and_center_required");
  const px = coordinate(point.x, "point_x");
  const py = coordinate(point.y, "point_y");
  const cx = coordinate(center.x, "center_x");
  const cy = coordinate(center.y, "center_y");
  const radius = safeInt("radius_units", radiusUnits, 0, MAX_COORD);
  const dx = BigInt(px) - BigInt(cx);
  const dy = BigInt(py) - BigInt(cy);
  const distanceSquared = dx * dx + dy * dy;
  const radiusSquared = BigInt(radius) * BigInt(radius);
  return Object.freeze({
    insideOrOnBoundary: distanceSquared <= radiusSquared,
    distanceSquaredUnits2: distanceSquared.toString(),
    radiusSquaredUnits2: radiusSquared.toString(),
    squareRootRequired: false
  });
}

function spatialSecurityGate({
  geometryMatch = false,
  coordinateSource,
  coordinateIntegrityVerified = false,
  accuracyMeters,
  maxAccuracyMeters,
  serverPolicyApproved = false,
  userPermissionGranted = false,
  privilegedAction = false
} = {}) {
  const blockers = [];
  if (geometryMatch !== true) blockers.push("geometry_outside_approved_zone");
  if (!TRUSTED_COORDINATE_SOURCES.has(coordinateSource))
    blockers.push("coordinate_source_untrusted");
  if (coordinateIntegrityVerified !== true) blockers.push("coordinate_integrity_unverified");
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 ||
      !Number.isFinite(maxAccuracyMeters) || maxAccuracyMeters < 0)
    blockers.push("coordinate_accuracy_invalid");
  else if (accuracyMeters > maxAccuracyMeters) blockers.push("coordinate_accuracy_insufficient");
  if (serverPolicyApproved !== true) blockers.push("server_spatial_policy_unapproved");
  if (userPermissionGranted !== true) blockers.push("user_location_or_layout_permission_missing");
  if (privilegedAction === true) blockers.push("spatial_signal_cannot_authorize_privileged_action");

  return Object.freeze({
    state: blockers.length ? "spatial_signal_blocked" : "spatial_signal_acceptable",
    blockers: Object.freeze([...new Set(blockers)]),
    authorizationGranted: false,
    legalBoundaryCertified: false,
    physicalSafetyCertified: false
  });
}

module.exports = {
  MAX_COORD,
  TRUSTED_COORDINATE_SOURCES,
  evidenceWeightedCoverage,
  polygonDoubleArea,
  rectangleOverlapBps,
  withinRadiusSquared,
  spatialSecurityGate
};
