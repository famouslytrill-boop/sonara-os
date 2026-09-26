"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeLocale } = require("../lib/sonara-locale-contract.cjs");

const migration = fs.readFileSync(
  path.join(__dirname, "..", "supabase/migrations/20260926040000_align_user_preference_locales.sql"),
  "utf8"
);

describe("saved preference locale migration", () => {
  it("canonicalizes persisted legacy aliases before validating the strict constraint", () => {
    const updatePosition = migration.toLowerCase().indexOf("update public.user_preferences");
    const constraintPosition = migration.toLowerCase().indexOf(
      "add constraint user_preferences_language_allowed_chk"
    );

    assert.ok(updatePosition >= 0, "the migration must backfill existing preferences");
    assert.ok(
      updatePosition < constraintPosition,
      "legacy values must be normalized before the new constraint is added"
    );
    assert.match(migration, /when\s+'en'\s+then\s+'en-US'/i);
    assert.match(migration, /when\s+'pt'\s+then\s+'pt-BR'/i);
    assert.match(migration, /where\s+language\s+in\s*\('en'\s*,\s*'pt'\)/i);
    assert.deepEqual(["en", "pt"].map(normalizeLocale), ["en-US", "pt-BR"]);
  });
});
