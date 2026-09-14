"use strict";

// Location rendering rules for Business Builder. Location capture itself stays
// opt-in and permission-gated in public/sonara-check-in.js and the browser
// Geolocation API. This module never requests a location and never upgrades a
// stored privacy mode. It only makes already-recorded points less precise when
// their row says it should.

const EARTH_RADIUS_METERS = 6371008.8;
const ALLOWED_PRIVACY = new Set(["precise", "approximate", "masked", "manual"]);

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinate(value, min, max) {
  const parsed = finite(value);
  return parsed !== null && parsed >= min && parsed <= max ? parsed : null;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function pointFromEvent(row = {}) {
  const latitude = coordinate(row.latitude, -90, 90);
  const longitude = coordinate(row.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;
  const privacyMode = ALLOWED_PRIVACY.has(row.privacy_mode) ? row.privacy_mode : "masked";

  // Approximate (~1.1 km latitude grid) and masked (~11 km latitude grid)
  // deliberately remove precision. Manual points are treated like approximate
  // points because they were not device telemetry and should not be presented
  // as if they were a live trace.
  const places = privacyMode === "precise" ? 5 : privacyMode === "masked" ? 1 : 2;
  return {
    latitude: round(latitude, places),
    longitude: round(longitude, places),
    privacyMode,
    eventType: String(row.event_type || "position_update"),
    capturedAt: row.captured_at || row.created_at || null,
    accuracyMeters: privacyMode === "precise" ? Math.max(0, finite(row.accuracy_meters) ?? 0) : null
  };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  if (!a || !b) return null;
  const lat1 = coordinate(a.latitude, -90, 90);
  const lon1 = coordinate(a.longitude, -180, 180);
  const lat2 = coordinate(b.latitude, -90, 90);
  const lon2 = coordinate(b.longitude, -180, 180);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const p1 = toRadians(lat1);
  const p2 = toRadians(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function buildMapSnapshot(rows = [], options = {}) {
  const limit = Math.min(1000, Math.max(1, Number(options.limit) || 250));
  const sorted = (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => Date.parse(a?.captured_at || a?.created_at || 0) - Date.parse(b?.captured_at || b?.created_at || 0));

  const points = [];
  let unreadable = 0;
  for (const row of sorted) {
    if (points.length >= limit) break;
    const point = pointFromEvent(row);
    if (!point) unreadable += 1;
    else points.push(point);
  }

  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segment = distanceMeters(points[index - 1], points[index]);
    if (segment !== null) distance += segment;
  }

  const lats = points.map((point) => point.latitude);
  const lons = points.map((point) => point.longitude);
  return {
    ok: true,
    points,
    pointCount: points.length,
    unreadable,
    distanceMeters: Math.round(distance),
    bounds: points.length ? {
      south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lons), east: Math.max(...lons)
    } : null,
    privacy: {
      capture: "user_permission_required",
      backgroundTracking: false,
      precisionNeverUpgraded: true
    }
  };
}

module.exports = { ALLOWED_PRIVACY, buildMapSnapshot, distanceMeters, pointFromEvent };
