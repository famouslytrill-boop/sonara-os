"use strict";

// Three states for a permission, and a bucket that existed without a feature.
//
// AGENTS.md: "Sounds, voice announcements, haptics, SMS, push, and email alerts
// must be off or explicitly user-controlled by default." The schema half of that
// sentence is what this file guards, and it is not obvious: `boolean default
// false` *looks* like off-by-default and cannot tell these apart —
//
//   the person said no   ->  false
//   nobody ever asked    ->  false
//
// — which matters because they call for opposite behaviour. "Never asked" is a
// prompt to show once. "Said no" is a prompt never to show again, and showing it
// again is what makes somebody uninstall an application.
//
// public.device_capability_profiles (migration 015) has six columns of exactly
// that shape and nothing has ever read or written it from a route, so no
// behaviour depended on the collapse. device_permission_grants replaces it for
// this purpose: a decision is a row, no row means nobody asked, and there is no
// default value to misread.
//
// The second half of this file is the avatars bucket. It was declared in
// lib/sonara-ecosystem-manifest.cjs, asserted present by
// scripts/verify-production-schema.mjs, and written to by nothing at all, while
// /account/profile was a page with no form on it. The gate was not broken and its
// statement was not false — "the avatars bucket exists" was true. It simply was
// not evidence for the thing a reader takes it as evidence for.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const permissions = require("../lib/sonara-device-permissions.cjs");
const storage = require("../lib/sonara-file-storage.cjs");

const root = path.join(__dirname, "..");
const MIGRATION = path.join(root, "supabase", "migrations", "20261003010000_a_profile_a_person_can_set.sql");
const MOTION_PERMISSION_MIGRATION = path.join(root, "supabase", "migrations", "20261009235500_motion_is_an_account_device_permission.sql");

const AT = "2026-10-02T12:00:00Z";
const LATER = "2026-10-03T12:00:00Z";

describe("a permission nobody granted is not a yes", () => {
  describe("three states, and the third is the absence of a row", () => {
    it("reads no row as not_recorded, never as denied", () => {
      assert.equal(permissionStateOf([], "camera"), permissions.STATE.not_recorded);
      // The distinction the whole table exists for. If these were equal the row
      // encoding would be buying nothing.
      assert.notEqual(permissions.STATE.not_recorded, permissions.STATE.denied);
    });

    it("reads a failed read as unreadable, not as not_recorded", () => {
      const state = permissions.permissionState({ grants: [], readable: false }, "camera");
      assert.equal(state, permissions.STATE.unreadable);
      // A page that could not read the grants must not tell somebody they have
      // never been asked, and must not re-ask them on the strength of a request
      // that failed.
      assert.notEqual(state, permissions.STATE.not_recorded);
    });

    it("reads a decision", () => {
      assert.equal(permissionStateOf([grant("camera", "granted")], "camera"), permissions.STATE.granted);
      assert.equal(permissionStateOf([grant("camera", "denied")], "camera"), permissions.STATE.denied);
    });

    it("takes the newest decision, whatever order the rows arrive in", () => {
      const rows = [grant("camera", "granted", AT), grant("camera", "denied", LATER)];
      assert.equal(permissionStateOf(rows, "camera"), permissions.STATE.denied);
      // Reversed. A caller that forgot `order=` would otherwise get whichever
      // row the database handed back first and call it the current answer.
      assert.equal(permissionStateOf([...rows].reverse(), "camera"), permissions.STATE.denied);
    });

    it("lets somebody change their mind back", () => {
      const rows = [grant("camera", "denied", AT), grant("camera", "granted", LATER)];
      assert.equal(permissionStateOf(rows, "camera"), permissions.STATE.granted);
    });

    it("ignores a row whose state is not one of the two stored values", () => {
      // A row reading 'not_recorded' would be a second encoding of the absence,
      // and a reader would have to guess which one meant what.
      assert.equal(permissionStateOf([grant("camera", "not_recorded")], "camera"), permissions.STATE.not_recorded);
      assert.equal(permissionStateOf([grant("camera", "")], "camera"), permissions.STATE.not_recorded);
    });

    it("does not let one capability answer for another", () => {
      const rows = [grant("microphone", "granted")];
      assert.equal(permissionStateOf(rows, "microphone"), permissions.STATE.granted);
      assert.equal(permissionStateOf(rows, "camera"), permissions.STATE.not_recorded);
    });
  });

  describe("only a yes is a yes", () => {
    it("refuses on denied, on never asked, and on unreadable", () => {
      for (const record of [
        { grants: [] },
        { grants: [grant("camera", "denied")] },
        { grants: [], readable: false }
      ]) {
        const verdict = permissions.mayAsk(record, "camera");
        assert.equal(verdict.ok, false, `mayAsk allowed ${verdict.state}`);
        assert.ok(verdict.message, `${verdict.state} gave no reason a page could show`);
      }
    });

    it("gives a different reason for each refusal", () => {
      const messages = new Set([
        permissions.mayAsk({ grants: [] }, "camera").message,
        permissions.mayAsk({ grants: [grant("camera", "denied")] }, "camera").message,
        permissions.mayAsk({ grants: [], readable: false }, "camera").message
      ]);
      // Three refusals that read the same are three refusals somebody cannot act
      // on. "You turned this off" and "we could not read your settings" call for
      // different things from the person looking at the page.
      assert.equal(messages.size, 3);
    });

    it("allows only on a granted row", () => {
      assert.equal(permissions.mayAsk({ grants: [grant("camera", "granted")] }, "camera").ok, true);
    });

    it("refuses a capability this application does not ask about", () => {
      assert.equal(permissions.mayAsk({ grants: [grant("screen_recording", "granted")] }, "screen_recording").ok, false);
    });
  });

  describe("the capabilities the owner named are all here", () => {
    it("covers camera, microphone, contacts and location", () => {
      for (const key of ["camera", "microphone", "contacts", "location"]) {
        assert.ok(permissions.CAPABILITY_KEYS.includes(key), `${key} is not a capability anybody can decide about`);
      }
    });

    it("covers using the device's own processor and storage", () => {
      for (const key of ["local_compute", "local_storage"]) {
        assert.ok(permissions.CAPABILITY_KEYS.includes(key), `${key} is not a capability anybody can decide about`);
      }
    });

    it("covers motion as an explicit account decision rather than relying on the browser prompt alone", () => {
      assert.ok(permissions.CAPABILITY_KEYS.includes("motion"));
      const motion = permissions.CAPABILITIES.find((capability) => capability.key === "motion");
      assert.ok(motion);
      assert.match(motion.why, /short motion sample/i);
      assert.equal(motion.browserPermission, null, "DeviceMotionEvent permission is not one navigator.permissions name");
      assert.equal(permissions.mayAsk({ grants: [] }, "motion").ok, false);
      assert.equal(permissions.mayAsk({ grants: [grant("motion", "granted")] }, "motion").ok, true);
    });


    it("says why each one would be used, in words a customer would read", () => {
      for (const capability of permissions.CAPABILITIES) {
        assert.ok(capability.why && capability.why.length > 20, `${capability.key} has no reason a person could weigh`);
        assert.doesNotMatch(capability.why, /\bAPI\b|endpoint|permission state|navigator/i, `${capability.key} explains itself in our words rather than theirs: ${capability.why}`);
      }
    });

    it("records no browser permission name for the ones that have none", () => {
      const contacts = permissions.CAPABILITIES.find((capability) => capability.key === "contacts");
      // There is no Permissions API name for the Contact Picker. A made-up string
      // here would throw inside navigator.permissions.query for whoever used it.
      assert.equal(contacts.browserPermission, null);
    });

    it("lists every capability on the settings page, including the undecided ones", () => {
      const summary = permissions.permissionSummary({ grants: [grant("camera", "granted")] });
      assert.equal(summary.length, permissions.CAPABILITY_KEYS.length);
      // A list built from the stored rows would show only what had been decided,
      // which is a settings page that hides the settings you have not found yet.
      assert.ok(summary.some((entry) => entry.key === "contacts" && entry.state === permissions.STATE.not_recorded));
    });

    it("has everything off when nothing has been decided", () => {
      const summary = permissions.permissionSummary({ grants: [] });
      assert.ok(summary.length >= 6, `only ${summary.length} capabilities; this check has gone blind`);
      assert.ok(summary.every((entry) => entry.allowed === false), "something is on by default");
    });
  });

  describe("a form that lost a section does not revoke a permission", () => {
    it("reads a missing field as nothing to record, not as a no", () => {
      // The difference between a page that lost a section and a page that
      // revoked a permission.
      assert.equal(permissions.decisionFrom({}, "camera"), null);
    });

    it("reads an offered box left unticked as a no", () => {
      assert.equal(permissions.decisionFrom({ offered_camera: "1" }, "camera"), "denied");
    });

    it("reads an offered box ticked as a yes", () => {
      assert.equal(permissions.decisionFrom({ offered_camera: "1", allow_camera: "true" }, "camera"), "granted");
    });

    it("records nothing for a capability it does not know", () => {
      assert.equal(permissions.decisionFrom({ offered_screen: "1", allow_screen: "true" }, "screen"), null);
    });
  });

  describe("the migration says all of this to the database too", () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");

    it("reads a migration worth measuring", () => {
      assert.ok(sql.length > 2000, `the migration is ${sql.length} bytes; this check has gone blind`);
    });

    it("constrains state to the two that are stored", () => {
      assert.match(sql, /check \(state in \('granted', 'denied'\)\)/);
      // not_recorded is the absence of a row. A value for it would be a second
      // encoding of one fact.
      assert.doesNotMatch(sql, /state in \([^)]*not_recorded/);
    });

    it("gives state no default", () => {
      assert.doesNotMatch(sql, /state text not null default/);
    });

    it("keeps a person's decision out of their employer's reach", () => {
      // No organization_id on the table, and the read policy is self-only.
      const table = sql.slice(sql.indexOf("create table if not exists public.device_permission_grants"));
      const body = table.slice(0, table.indexOf(");"));
      assert.doesNotMatch(body, /organization_id/);
      assert.match(sql, /using \(user_id = auth\.uid\(\)\)/);
    });

    it("asserts its own shape against the live catalogue", () => {
      // Each of these was broken and watched to fail by name before this test
      // was written; see docs/SPRINT_LOG.md.
      for (const claim of [
        /profiles gained a non-nullable profile column/,
        /has default %\. A grant with a default is a decision nobody made/,
        /gained an organization_id/,
        /no longer names both decisions/,
        /admits not_recorded/,
        /has no state check constraint/
      ]) {
        assert.match(sql, claim, `the migration no longer asserts ${claim}`);
      }
    });

    it("keeps the new profile columns nullable", () => {
      const block = sql.slice(sql.indexOf("alter table public.profiles"));
      const statement = block.slice(0, block.indexOf(";"));
      for (const column of ["display_name", "headline", "bio", "avatar_path"]) {
        assert.match(statement, new RegExp(`add column if not exists ${column} text`), `${column} is missing`);
      }
      assert.doesNotMatch(statement, /not null/, "an unset field would read as answered");
      assert.doesNotMatch(statement, /default/, "a default would make an untouched row look filled in");
    });
  });

  describe("motion extends the existing account permission vocabulary without granting it", () => {
    const sql = fs.readFileSync(MOTION_PERMISSION_MIGRATION, "utf8");

    it("adds motion to the same capability constraint instead of creating another consent table", () => {
      assert.match(sql, /device_permission_grants_capability_check/);
      assert.match(sql, /'local_storage','motion'/);
      assert.doesNotMatch(sql, /create table/i);
    });

    it("does not create a granted row for anybody", () => {
      assert.doesNotMatch(sql, /insert\s+into\s+(?:public\.)?device_permission_grants/i);
      assert.match(sql, /no row still means never asked\/off/i);
    });

    it("refuses unexpected earlier constraint drift before replacing the constraint", () => {
      for (const capability of ["camera", "microphone", "contacts", "location", "local_compute", "local_storage"]) {
        assert.match(sql, new RegExp(`position\\('${capability}' in current_definition\\) = 0`));
      }
      assert.match(sql, /raise exception 'device permission capability constraint drifted/);
    });
  });

  describe("a picture belongs to a person, not to a workspace", () => {
    const PERSON = "11111111-1111-1111-1111-111111111111";
    const OTHER = "22222222-2222-2222-2222-222222222222";

    it("puts a personal file under its own prefix", () => {
      const where = storage.personalPathFor({ userId: PERSON, kind: "avatar", filename: "me.png" });
      assert.ok(where.startsWith(`person/${PERSON}/avatar/`), where);
    });

    it("refuses a call that names both a workspace and a person", () => {
      // A call that has not decided whose file this is must not be filed under
      // whichever value happened to be truthy.
      assert.equal(storage.ownerPrefix({ organizationId: PERSON, userId: OTHER }), null);
    });

    it("refuses a call that names neither", () => {
      assert.equal(storage.ownerPrefix({}), null);
    });

    it("keeps one person's prefix away from another's", () => {
      assert.notEqual(storage.ownerPrefix({ userId: PERSON }), storage.ownerPrefix({ userId: OTHER }));
    });

    it("keeps a person's id from addressing a workspace folder of the same uuid", () => {
      // Both are uuids. Without the `person/` segment, a user id and an
      // organization id with the same value would address the same folder.
      assert.notEqual(storage.ownerPrefix({ userId: PERSON }), storage.ownerPrefix({ organizationId: PERSON }));
    });

    it("refuses to sign another person's path", async () => {
      const mine = storage.personalPathFor({ userId: PERSON, kind: "avatar", filename: "me.png" });
      const link = await storage.signedUrl(
        { url: "https://example.invalid", serviceRoleKey: "test" },
        { userId: OTHER, path: mine },
        { fetchImpl: () => { throw new Error("should never be reached"); } }
      );
      assert.equal(link.ok, false);
      assert.equal(link.code, "not_yours");
    });

    it("refuses to delete another person's path", async () => {
      const mine = storage.personalPathFor({ userId: PERSON, kind: "avatar", filename: "me.png" });
      const gone = await storage.remove(
        { url: "https://example.invalid", serviceRoleKey: "test" },
        { userId: OTHER, path: mine },
        { fetchImpl: () => { throw new Error("should never be reached"); } }
      );
      assert.equal(gone.ok, false);
      assert.equal(gone.code, "not_yours");
    });

    it("still refuses to sign across workspaces, as it always did", async () => {
      const link = await storage.signedUrl(
        { url: "https://example.invalid", serviceRoleKey: "test" },
        { organizationId: OTHER, path: `${PERSON}/invoice/x.pdf` },
        { fetchImpl: () => { throw new Error("should never be reached"); } }
      );
      assert.equal(link.code, "not_yours");
    });
  });

  describe("a declared bucket with no writer is not a feature", () => {
    const manifest = fs.readFileSync(path.join(root, "lib", "sonara-ecosystem-manifest.cjs"), "utf8");
    const route = fs.readFileSync(path.join(root, "routes", "sonara-account-profile-routes.cjs"), "utf8");

    it("declares the avatars bucket", () => {
      assert.match(manifest, /storageBuckets:\s*\[[^\]]*"avatars"/);
    });

    it("now has something writing to it", () => {
      // The finding this file is about: the bucket was declared and provisioned
      // and verified present, and nothing ever put a byte in it.
      assert.match(route, /const AVATAR_BUCKET = "avatars"/);
      assert.match(route, /bucket: AVATAR_BUCKET/);
      assert.match(route, /storage\.put\(/);
    });

    it("is checked by a gate that traces the name to the call", () => {
      const gate = fs.readFileSync(path.join(root, "scripts", "verify-declared-buckets.mjs"), "utf8");
      // The first version of that gate asked "does this file name the bucket"
      // and "does this file upload" separately, and stayed green when the two
      // were disconnected -- which is the original bug exactly.
      assert.match(gate, /function writesTo\(/);
      assert.match(gate, /identifiersFor/);
      assert.match(gate, /shouldMatch: false/);
    });

    it("is in the release chain", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
      assert.ok(pkg.scripts["verify:declared-buckets"], "the gate is not a script");
      assert.ok(
        pkg.scripts["verify:gates"].includes("verify:declared-buckets"),
        "the gate exists and the release chain does not run it"
      );
    });
  });
});

function grant(capability, state, decided_at = AT) {
  return { capability, state, decided_at };
}

function permissionStateOf(grants, capability) {
  return permissions.permissionState({ grants }, capability);
}
