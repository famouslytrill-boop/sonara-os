"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const precision = require("../public/sonara-location-precision.js");

// The `create table ... location_events` block, and only that block.
//
// The first version of the two checks below matched `event_type ... check (...)`
// against the whole migration file. Migration 015 creates several sensor tables
// and `motion_sensor_events` comes first, so the assertion compared the route's
// list of location event types against the motion table's -- measuring a
// different population from the one it named, and failing on correct code.
function locationEventsTable() {
  const migration = fs.readFileSync(
    require.resolve("../supabase/migrations/015_sonara_device_sensory_location_schema.sql"),
    "utf8"
  );
  const start = migration.indexOf("create table if not exists public.location_events");
  assert.notEqual(start, -1, "location_events is no longer created here; this check has gone blind");
  const end = migration.indexOf("\n);", start);
  assert.notEqual(end, -1, "could not find the end of the location_events definition");
  const block = migration.slice(start, end);
  // Proof the slice is the right one rather than an empty or truncated read.
  assert.match(block, /privacy_mode/, "the location_events block does not contain privacy_mode");
  return block;
}

// The values inside a `check (column in ('a','b'))` clause.
function allowedValues(block, column) {
  const declared = block.match(new RegExp(`${column} text not null[^,]*check \\(${column} in \\(([^)]+)\\)\\)`));
  assert.ok(declared, `the ${column} constraint has moved; this check has gone blind`);
  const values = declared[1].split(",").map((entry) => entry.trim().replace(/'/g, "")).filter(Boolean);
  assert.ok(values.length >= 2, `only ${values.length} value(s) parsed out of the ${column} constraint`);
  return values.sort();
}

describe("how precisely a check-in records where somebody was", () => {
  const reading = { latitude: 51.5074321, longitude: -0.1277654, accuracyMeters: 8 };

  it("sends the device's own figures when precise was chosen", () => {
    const reduced = precision.reduce(reading, "precise");
    assert.equal(reduced.mode, "precise");
    assert.equal(reduced.latitude, 51.5074321);
    assert.equal(reduced.accuracyMeters, 8);
  });

  it("rounds to about a hundred metres for approximate", () => {
    const reduced = precision.reduce(reading, "approximate");
    assert.equal(reduced.latitude, 51.507);
    assert.equal(reduced.longitude, -0.128);
    // Three decimal places and no more. `51.50700000000001` is the same number
    // and a different disclosure once it is written into a row somebody reads.
    assert.equal(String(reduced.latitude).split(".")[1].length <= 3, true);
  });

  it("rounds to about a kilometre for masked", () => {
    const reduced = precision.reduce(reading, "masked");
    assert.equal(reduced.latitude, 51.51);
    assert.equal(reduced.longitude, -0.13);
  });

  it("sends no coordinates at all for manual", () => {
    const reduced = precision.reduce(reading, "manual");
    assert.equal(reduced.latitude, null);
    assert.equal(reduced.longitude, null);
    assert.equal(reduced.accuracyMeters, null);
  });

  // The accuracy figure is what anything drawing a circle will use. A masked
  // point carrying the device's 8 metres draws a tight circle around a place
  // the person was not -- a number that reports a precision it does not have.
  it("widens the accuracy to the rounding grid, never leaves it at the device's", () => {
    for (const mode of ["approximate", "masked"]) {
      const reduced = precision.reduce(reading, mode);
      const grid = precision.gridMetres(precision.modeFor(mode).decimals);
      assert.ok(
        reduced.accuracyMeters >= Math.floor(grid),
        `${mode} kept ${reduced.accuracyMeters}m against a ${Math.round(grid)}m grid`
      );
      assert.ok(reduced.accuracyMeters > reading.accuracyMeters, `${mode} should not claim the device's accuracy`);
    }
  });

  it("keeps a device accuracy that is already worse than the grid", () => {
    // Rounding does not make a bad fix better. A 2km fix rounded onto a 1.1km
    // grid is still a 2km fix.
    const vague = precision.reduce({ latitude: 51.5, longitude: -0.12, accuracyMeters: 2000 }, "masked");
    assert.equal(vague.accuracyMeters, 2000);
  });

  // Both are readings of "we could not tell what they chose", and only one of
  // them is safe.
  it("falls back to approximate rather than precise for an unknown mode", () => {
    assert.equal(precision.modeFor("nonsense").value, "approximate");
    assert.equal(precision.modeFor(undefined).value, "approximate");
    assert.equal(precision.reduce(reading, "nonsense").latitude, 51.507);
    assert.notEqual(precision.DEFAULT_MODE, "precise");
  });

  // "Approximate, with no position" would be a row claiming a precision it does
  // not have.
  it("records a mode that wanted coordinates and got none as manual", () => {
    const reduced = precision.reduce({ latitude: null, longitude: null }, "approximate");
    assert.equal(reduced.mode, "manual");
    assert.equal(reduced.latitude, null);
  });

  it("offers every mode the database column allows, and no others", () => {
    const allowed = allowedValues(locationEventsTable(), "privacy_mode");
    assert.deepEqual(precision.MODES.map((mode) => mode.value).sort(), allowed);
  });

  it("gives every mode a label and a sentence saying what it does", () => {
    assert.ok(precision.MODES.length >= 4, "the mode list has gone empty; this check measures nothing");
    for (const mode of precision.MODES) {
      assert.ok(mode.label && /^[A-Z]/.test(mode.label), `${mode.value} has no readable label`);
      assert.ok(mode.note && mode.note.length > 20, `${mode.value} does not say what it does`);
    }
  });
});

describe("capturing a check-in in the browser", () => {
  const source = fs.readFileSync(require.resolve("../public/sonara-check-in.js"), "utf8");
  const code = source.replace(/^\s*\/\/.*$/gm, "");

  // The difference between "a check-in" and "tracking" is entirely whether a
  // position is taken when somebody asks or continuously while they are not
  // looking. AGENTS.md permits one of those.
  it("never starts a position watch", () => {
    assert.doesNotMatch(code, /watchPosition/, "a watch is background tracking, whatever it is called");
  });

  // Not "the call is textually after the handler" -- readPosition is declared
  // above it, so that assertion failed on correct code. What matters is that
  // nothing *invokes* the capture except the handler.
  it("only reads a position from inside the submit handler", () => {
    assert.equal(
      (code.match(/navigator\.geolocation\.getCurrentPosition\(/g) || []).length,
      1,
      "there should be exactly one place that captures a position"
    );

    const declaration = code.indexOf("function readPosition()");
    assert.notEqual(declaration, -1, "readPosition has been renamed; this check has gone blind");
    const capture = code.indexOf("navigator.geolocation.getCurrentPosition(");
    assert.ok(capture > declaration, "the capture should live inside readPosition");

    const submit = code.indexOf('addEventListener("submit"');
    assert.notEqual(submit, -1);
    // The declaration's own `readPosition()` matches this pattern too, so it is
    // dropped by position rather than by a cleverer regex.
    const callSites = [...code.matchAll(/readPosition\(\)/g)]
      .map((match) => match.index)
      .filter((index) => index !== declaration + "function ".length);
    assert.ok(callSites.length >= 1, "nothing calls readPosition; the button does nothing");
    for (const site of callSites) {
      assert.ok(site > submit, "readPosition must only be called from the submit handler");
    }
  });

  // The reason the rounding is shared rather than done server-side: by the time
  // a coordinate reaches the server it has already left the device.
  it("rounds on the device before anything is posted", () => {
    const capture = code.indexOf("precision.reduce(");
    const post = code.indexOf("post({");
    assert.ok(capture > -1 && post > -1 && capture < post, "the reduction must happen before the request is built");
  });

  it("posts same-origin with the session cookie and nothing else", () => {
    assert.match(code, /credentials: "same-origin"/);
    assert.doesNotMatch(code, /https?:\/\/(?!localhost)/, "a check-in must not be sent anywhere but this origin");
  });

  // /staff/location lists check-ins by employee_id. A check-in with none is
  // written, reports success, and never appears on the page the person was just
  // told to reload.
  it("attributes the check-in to the person, so it appears on their own page", () => {
    assert.match(code, /employee_id: config\.employeeId/);
  });

  it("says which of the three refusals happened rather than one sentence for all", () => {
    for (const reason of ["denied", "unsupported"]) {
      assert.match(code, new RegExp(`result\\.reason === "${reason}"`), `${reason} has no sentence of its own`);
    }
  });
});

describe("the page and the header that let it work at all", () => {
  const server = fs.readFileSync(require.resolve("../server.js"), "utf8");
  const routes = fs.readFileSync(require.resolve("../routes/sonara-last9-routes.cjs"), "utf8");

  // geolocation=() denies the feature to this origin too, so every part of this
  // -- the table, the endpoint, the page, the helpers -- could never run.
  it("permits this origin to ask for a position, and no embedded third party", () => {
    const header = server.match(/setHeader\("Permissions-Policy", "([^"]+)"\)/);
    assert.ok(header, "the Permissions-Policy header has moved; this check has gone blind");
    assert.match(header[1], /geolocation=\(self\)/);
    assert.doesNotMatch(header[1], /geolocation=\*/);
    // Unchanged, and asserted so that widening one permission does not quietly
    // widen the others beside it.
    assert.match(header[1], /camera=\(\)/);
    assert.match(header[1], /microphone=\(\)/);
  });

  it("records the reason for the header change where AGENTS.md requires it", () => {
    const notes = fs.readFileSync(require.resolve("../SECURITY_NOTES.md"), "utf8");
    assert.match(notes, /Permissions-Policy/);
    assert.match(notes, /geolocation=\(self\)/);
  });

  it("loads the capture scripts on the location page and nowhere else in the portal", () => {
    assert.match(routes, /path === "\/staff\/location" \? withCheckInScripts\(html\) : html/);
    assert.match(routes, /src="\/sonara-check-in\.js"/);
    assert.match(routes, /src="\/sonara-location-precision\.js"/);
  });

  it("validates the event type against the list the table actually allows", () => {
    const allowed = allowedValues(locationEventsTable(), "event_type");
    const listed = routes.match(/const LOCATION_EVENT_TYPES = Object\.freeze\(\[([\s\S]*?)\]\)/);
    assert.ok(listed, "the route no longer keeps a list of allowed event types");
    const inCode = listed[1].split(",").map((entry) => entry.trim().replace(/["\s]/g, "")).filter(Boolean).sort();
    assert.deepEqual(inCode, allowed, "the route and the table disagree about which event types exist");
  });

  // The form carries a real method and action, so it submits with no
  // JavaScript at all. What comes back then must be the page, not raw JSON.
  it("answers a plain form submit with the page rather than JSON", () => {
    assert.match(routes, /acceptsHtml\(req\)[\s\S]{0,400}\/staff\/location\?checked_in=1/);
    assert.match(routes, /req\.query\.checked_in/, "coming back to an unchanged page says nothing happened");
    assert.match(routes, /req\.query\.problem/, "a failed save must say so too");
  });

  it("refuses to put a staff member's check-in on a colleague's page", () => {
    // The organization check catches another business. Within one business it
    // caught nothing, which was theoretical only while nothing posted here.
    assert.match(routes, /const suppliedEmployee = String\(req\.body\.employee_id \|\| ""\)/);
    assert.match(routes, /me\.ok && me\.profile\.id !== suppliedEmployee/);
  });

  // A speed and a heading beside a masked coordinate narrow it back down.
  it("drops movement figures whenever the position was coarsened or withheld", () => {
    assert.match(routes, /speed_mps: reduced\.mode === "precise"/);
    assert.match(routes, /heading_degrees: reduced\.mode === "precise"/);
  });

  it("applies the same reduction server-side, so a payload cannot claim a coarseness it did not use", () => {
    assert.match(routes, /reducePosition\(/);
    assert.match(routes, /privacy_mode: reduced\.mode/);
  });
});
