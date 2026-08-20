"use strict";

// The business assistant's checks, tested against the schema and against rows.
//
// Two failures this file exists to prevent, both of which have happened in this
// codebase before.
//
// A column typed from memory. Seventeen owner forms once sent `user_id` to
// tables that do not have it; every save failed in production while the tests
// passed against a stub, because a stub answers whatever it is asked. The
// column check below reads supabase/migrations/ instead.
//
// A check that finds nothing because it cannot see. Every check here would
// report "nothing to fix" if its predicate silently stopped matching, and
// "nothing to fix" is the answer an owner most wants to believe. So each one is
// given a row it must catch and a row it must leave alone.

const assert = require("node:assert/strict");
const {
  CHECKS,
  PRODUCTS,
  checksFor,
  validate,
  selectFor,
  runCheck,
  summarise
} = require("../lib/sonara-record-checks.cjs");

const DAY = 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - 40 * DAY).toISOString().slice(0, 10);
const future = new Date(Date.now() + 400 * DAY).toISOString().slice(0, 10);
const pastStamp = new Date(Date.now() - 40 * DAY).toISOString();
const futureStamp = new Date(Date.now() + 400 * DAY).toISOString();
// Inside the fortnight the staleness checks use, so a row carrying it is one
// they must leave alone. Written as "recent" rather than "now" because a row
// created this instant is the easy case and would not prove much.
const recentStamp = new Date(Date.now() - 2 * DAY).toISOString();

// One row that must be caught and one that must not, per check. Written from
// what the check claims to be about rather than from its implementation.
const CASES = {
  menu_items_priced_below_cost: {
    catches: { id: "1", name: "Burger", selling_price_cents: 900, theoretical_cost_cents: 1100 },
    ignores: { id: "2", name: "Salad", selling_price_cents: 1200, theoretical_cost_cents: 400 }
  },
  menu_items_without_cost: {
    catches: { id: "1", name: "Soup", selling_price_cents: 700, theoretical_cost_cents: null },
    ignores: { id: "2", name: "Pasta", selling_price_cents: 1400, theoretical_cost_cents: 500 }
  },
  invoices_overdue_unpaid: {
    catches: { id: "1", invoice_number: "INV-1", due_date: past, total_cents: 25000, payment_status: "pending" },
    ignores: { id: "2", invoice_number: "INV-2", due_date: past, total_cents: 25000, payment_status: "paid" }
  },
  customer_invoices_overdue: {
    catches: { id: "1", invoice_number: "AR-1", due_on: past, total_cents: 42000, status: "sent", currency: "usd" },
    // Same overdue date, still a draft. A draft nobody has seen is not late,
    // and this is the row that proves the status test is doing the work rather
    // than the date alone.
    ignores: { id: "2", invoice_number: "AR-2", due_on: past, total_cents: 42000, status: "draft", currency: "usd" }
  },
  customer_invoices_sent_without_due_date: {
    catches: { id: "1", invoice_number: "AR-3", due_on: null, status: "sent" },
    ignores: { id: "2", invoice_number: "AR-4", due_on: past, status: "sent" }
  },
  services_without_price: {
    catches: { id: "1", name: "Consultation", price_cents: 0, status: "active" },
    ignores: { id: "2", name: "Deep clean", price_cents: 15000, status: "active" }
  },
  bookings_without_contact: {
    catches: { id: "1", customer_name: "Sam", customer_email: "", customer_phone: null, starts_at: future, status: "confirmed" },
    ignores: { id: "2", customer_name: "Alex", customer_email: "a@example.com", customer_phone: null, starts_at: future, status: "confirmed" }
  },
  inventory_at_or_below_reorder: {
    catches: { id: "1", name: "Flour", quantity: 2, reorder_level: 5, unit: "kg", status: "active" },
    ignores: { id: "2", name: "Sugar", quantity: 40, reorder_level: 5, unit: "kg", status: "active" }
  },
  vehicle_registration_expiring: {
    catches: { id: "1", make: "Ford", model: "Transit", plate_number: "AB12", registration_expires_at: past, status: "active" },
    ignores: { id: "2", make: "Ford", model: "Transit", plate_number: "CD34", registration_expires_at: future, status: "active" }
  },
  staff_without_contact: {
    catches: { id: "1", display_name: "Jo", email: null, phone: "", status: "active" },
    ignores: { id: "2", display_name: "Kim", email: null, phone: "555-0100", status: "active" }
  },
  locations_without_address: {
    catches: { id: "1", name: "Main St", address_line1: "", city: "Leeds", status: "open" },
    ignores: { id: "2", name: "Second St", address_line1: "12 Second St", city: "Leeds", status: "open" }
  },

  // Creator Studio.
  voice_consent_expired_or_revoked: {
    catches: { id: "1", subject_name: "Ari", consent_scope: "album", consent_attested: true, expires_at: pastStamp, revoked_at: null },
    ignores: { id: "2", subject_name: "Ari", consent_scope: "album", consent_attested: true, expires_at: futureStamp, revoked_at: null }
  },
  voice_consent_without_evidence: {
    catches: { id: "1", subject_name: "Ari", consent_attested: true, evidence_type: "signed_form", evidence_reference: "" },
    ignores: { id: "2", subject_name: "Ari", consent_attested: true, evidence_type: "signed_form", evidence_reference: "form-2026-01" }
  },
  tracks_with_unresolved_lyrics_originality: {
    catches: { id: "1", title: "Track One", song_status: "in_progress", lyrics_originality_status: "pending" },
    ignores: { id: "2", title: "Track Two", song_status: "in_progress", lyrics_originality_status: "cleared" }
  },
  releases_past_date_not_released: {
    catches: { id: "1", title: "EP", release_date: past, status: "scheduled" },
    ignores: { id: "2", title: "Single", release_date: past, status: "released" }
  },
  release_tasks_overdue: {
    catches: { id: "1", title: "Master the single", task_type: "mastering", due_at: pastStamp, status: "in_progress" },
    ignores: { id: "2", title: "Master the single", task_type: "mastering", due_at: pastStamp, status: "done" }
  },

  // Growth Studio.
  content_scheduled_without_approval: {
    catches: { id: "1", title: "Launch post", channel: "email", scheduled_for: futureStamp, approval_status: "pending", publish_status: "queued" },
    ignores: { id: "2", title: "Launch post", channel: "email", scheduled_for: futureStamp, approval_status: "approved", publish_status: "queued" }
  },
  contact_consent_withdrawn_or_expired: {
    catches: { id: "1", channel: "email", purpose: "offers", consent_status: "withdrawn", expires_at: futureStamp, withdrawn_at: pastStamp },
    ignores: { id: "2", channel: "email", purpose: "offers", consent_status: "granted", expires_at: futureStamp, withdrawn_at: null }
  },
  content_failed_to_publish: {
    catches: { id: "1", title: "Weekly note", channel: "email", publish_status: "failed", failure_code: "provider_rejected" },
    ignores: { id: "2", title: "Weekly note", channel: "email", publish_status: "published", failure_code: null }
  },
  leads_without_contact: {
    catches: { id: "1", name: "Pat", email: "", phone: null, source: "web form", status: "new" },
    ignores: { id: "2", name: "Pat", email: "pat@example.com", phone: null, source: "web form", status: "new" }
  },
  campaigns_running_without_goal: {
    catches: { id: "1", name: "Spring", goal: "", channel: "email", status: "active" },
    ignores: { id: "2", name: "Spring", goal: "20 bookings", channel: "email", status: "active" }
  },
  experiments_ended_without_result: {
    catches: { id: "1", name: "Subject line A/B", hypothesis: "shorter wins", result: null, status: "completed" },
    ignores: { id: "2", name: "Subject line A/B", hypothesis: "shorter wins", result: "shorter won by 8%", status: "completed" }
  },

  // The five staleness checks. Each `ignores` row is chosen to be the one that
  // would be caught if the check's own discrimination broke -- a fresh draft
  // for the ones that read the calendar, and a row in the wrong status for the
  // ones that read the status. A row that is clean in every respect proves only
  // that the check is not catching everything.
  customer_invoices_draft_and_aging: {
    catches: { id: "1", invoice_number: "AR-5", total_cents: 144000, status: "draft", created_at: pastStamp },
    ignores: { id: "2", invoice_number: "AR-6", total_cents: 144000, status: "draft", created_at: recentStamp }
  },
  quotes_sent_without_answer: {
    catches: { id: "1", title: "Roof repair", amount_cents: 200000, status: "sent", updated_at: pastStamp },
    ignores: { id: "2", title: "Roof repair", amount_cents: 200000, status: "sent", updated_at: recentStamp }
  },
  quotes_sent_without_amount: {
    catches: { id: "1", title: "Boiler service", amount_cents: null, status: "sent" },
    // A draft with no price yet is a quote somebody is still writing, which is
    // the normal state of a draft and must not be reported as a problem.
    ignores: { id: "2", title: "Boiler service", amount_cents: null, status: "draft" }
  },
  bookings_past_and_still_open: {
    catches: { id: "1", customer_name: "Sam", starts_at: pastStamp, ends_at: pastStamp, status: "confirmed" },
    ignores: { id: "2", customer_name: "Sam", starts_at: pastStamp, ends_at: pastStamp, status: "completed" }
  },
  customers_without_contact: {
    catches: { id: "1", name: "Jamie", email: "", phone: null, status: "active" },
    ignores: { id: "2", name: "Jamie", email: "", phone: "555-0100", status: "active" }
  }
};

describe("the record checks behind the assistant pages", () => {
  it("names only columns the schema actually has", () => {
    // The whole point: no column here is typed from memory.
    assert.deepEqual(validate(), [], "these checks reference columns or tables that supabase/migrations does not define");
  });

  it("gives every check a product that has a page", () => {
    const stranded = CHECKS.filter((check) => !PRODUCTS.includes(check.product));
    assert.deepEqual(stranded.map((check) => `${check.id} (${check.product})`), [], "a check with an unknown product appears on no page at all");
    for (const product of PRODUCTS) {
      assert.ok(checksFor(product).length > 0, `${product} has an assistant page and no checks to put on it`);
    }
  });

  it("has a test case for every check", () => {
    // Without this, adding a check silently adds one nobody proved works.
    const untested = CHECKS.map((check) => check.id).filter((id) => !CASES[id]);
    assert.deepEqual(untested, [], "these checks have no row proving they catch anything");
  });

  it("asks for the columns it reads and no more", () => {
    for (const check of CHECKS) {
      const select = selectFor(check).split(",");
      assert.ok(select.includes("id"), `${check.id} must select id so a finding can be pointed at a record`);
      assert.ok(
        !select.includes("organization_id"),
        `${check.id} selects organization_id; the tenant filter carries it and returning it invites something downstream to trust the row instead of the query`
      );
      assert.deepEqual([...new Set(select)], select, `${check.id} selects a column twice`);
    }
  });

  for (const check of CHECKS) {
    describe(check.id, () => {
      const testCase = CASES[check.id];

      it("catches the row it is for", () => {
        const result = runCheck(check, [testCase.catches]);
        assert.equal(result.count, 1, `${check.id} did not catch the row it exists to catch`);
        assert.ok(result.findings[0].sentence.length > 10, "a finding has to say something to the owner");
      });

      it("leaves the healthy row alone", () => {
        const result = runCheck(check, [testCase.ignores]);
        assert.equal(result.count, 0, `${check.id} flagged a row that is fine, which trains owners to ignore it`);
      });

      it("survives a malformed row rather than failing the page", () => {
        // One bad record should not take out the whole assistant.
        assert.doesNotThrow(() => runCheck(check, [{}, null, { id: "x" }]));
      });

      it("says why it matters, and where to fix it", () => {
        assert.ok(check.why && check.why.length > 20, `${check.id} has no reason an owner would care`);
        assert.ok(check.fixPath && check.fixPath.startsWith("/"), `${check.id} has no page to fix it on`);
      });
    });
  }

  describe("the summary", () => {
    it("keeps checks that found nothing", () => {
      // "We looked and it is fine" and "we did not look" must not render the
      // same way. Dropping empty results makes them identical.
      const results = CHECKS.map((check) => runCheck(check, []));
      const summary = summarise(results);
      assert.equal(summary.results.length, CHECKS.length);
      assert.equal(summary.total, 0);
      assert.equal(summary.clean, CHECKS.length);
    });

    it("puts what costs money first", () => {
      const results = CHECKS.map((check) => runCheck(check, [CASES[check.id].catches]));
      const summary = summarise(results);
      assert.equal(summary.results[0].severity, "money");
      assert.equal(summary.total, CHECKS.length);

      const severities = summary.results.map((result) => result.severity);
      const firstTidy = severities.indexOf("tidy");
      const lastMoney = severities.lastIndexOf("money");
      assert.ok(firstTidy === -1 || lastMoney < firstTidy, "a tidy-up is ordered above something costing money");
    });
  });
});
