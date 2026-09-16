"use strict";

const assert = require("node:assert/strict");
const cash = require("../lib/sonara-cash-position.cjs");
const { describedColumns } = require("../lib/sonara-migration-columns.cjs");

const NOW = Date.parse("2026-08-11T12:00:00.000Z");

function day(offset) {
  return new Date(NOW + offset * 86400000).toISOString().slice(0, 10);
}

function ok(rows) {
  return { ok: true, rows };
}

// A read that succeeded and came back short of what exists. Deliberately a
// separate helper from `ok`: it is a third state, not a milder failure, and the
// whole point of the assertions below is that `build` keeps the three apart.
function short(rows) {
  return { ok: true, rows, truncated: true };
}

const EMPTY = { incoming: ok([]), outgoing: ok([]), received: ok([]), now: NOW };

describe("money due in and out", () => {
  it("reads only columns the migrations actually have", () => {
    // The same failure as the record checks: a column PostgREST does not have
    // returns PGRST204, and an owner reads the empty result as "nothing due".
    const wrong = [];
    for (const [key, source] of Object.entries(cash.SOURCES)) {
      const columns = new Set((describedColumns(source.table) || []).map((column) => column.name));
      if (columns.size === 0) {
        wrong.push(`${source.table} is not in the migrations`);
        continue;
      }
      for (const column of source.columns) {
        if (!columns.has(column)) wrong.push(`${source.table} has no column ${column} (source ${key})`);
      }
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("puts a due date in the period it belongs to, by whole days", () => {
    // A timestamp comparison would push something due later today into
    // "overdue" purely because of the clock.
    assert.equal(cash.periodFor(cash.daysUntil(day(0), NOW)).key, "week");
    assert.equal(cash.periodFor(cash.daysUntil(day(-1), NOW)).key, "overdue");
    assert.equal(cash.periodFor(cash.daysUntil(day(7), NOW)).key, "week");
    assert.equal(cash.periodFor(cash.daysUntil(day(8), NOW)).key, "month");
    assert.equal(cash.periodFor(cash.daysUntil(day(91), NOW)).key, "later");
  });

  it("counts a sent invoice and ignores a draft", () => {
    const result = cash.build({
      ...EMPTY,
      incoming: ok([
        { id: "a", due_on: day(3), total_cents: 50000, status: "sent" },
        { id: "b", due_on: day(3), total_cents: 90000, status: "draft" }
      ])
    });
    assert.equal(result.totalIncoming, 50000, "a draft nobody has seen is not money anybody owes");
  });

  it("counts an unpaid bill and ignores a paid one", () => {
    const result = cash.build({
      ...EMPTY,
      outgoing: ok([
        { id: "a", due_date: day(3), total_cents: 20000, payment_status: "unpaid" },
        { id: "b", due_date: day(3), total_cents: 70000, payment_status: "paid" }
      ])
    });
    assert.equal(result.totalOutgoing, 20000);
  });

  it("nets payments received off the invoice they were paid against", () => {
    const result = cash.build({
      ...EMPTY,
      incoming: ok([{ id: "inv-1", due_on: day(5), total_cents: 100000, status: "sent" }]),
      received: ok([{ id: "p1", invoice_id: "inv-1", amount_cents: 30000 }])
    });
    assert.equal(result.totalIncoming, 70000, "an invoice half paid still brings in only the rest");
  });

  it("drops an invoice that has been paid in full even if its status was never changed", () => {
    const result = cash.build({
      ...EMPTY,
      incoming: ok([{ id: "inv-1", due_on: day(5), total_cents: 100000, status: "sent" }]),
      received: ok([{ id: "p1", invoice_id: "inv-1", amount_cents: 100000 }])
    });
    assert.equal(result.totalIncoming, 0);
    assert.equal(result.rows.find((row) => row.key === "week").incomingCount, 0);
  });

  it("never lets an overpayment turn into money owed the other way", () => {
    const result = cash.build({
      ...EMPTY,
      incoming: ok([{ id: "inv-1", due_on: day(5), total_cents: 10000, status: "sent" }]),
      received: ok([{ id: "p1", invoice_id: "inv-1", amount_cents: 25000 }])
    });
    assert.equal(result.totalIncoming, 0, "a negative outstanding would quietly reduce another invoice's total");
  });

  it("reports an undated row instead of dropping it, and says the picture is incomplete", () => {
    const result = cash.build({
      ...EMPTY,
      incoming: ok([{ id: "a", due_on: null, total_cents: 40000, status: "sent" }]),
      outgoing: ok([{ id: "b", due_date: "", total_cents: 15000, payment_status: "unpaid" }])
    });
    assert.equal(result.undated.incomingCount, 1);
    assert.equal(result.undated.incomingCents, 40000);
    assert.equal(result.undated.outgoingCount, 1);
    assert.equal(result.undated.outgoingCents, 15000);
    assert.equal(result.totalIncoming, 0, "an undated row must not be counted into a period");
    assert.equal(result.complete, false, "totals that exclude real money must not read as the whole picture");
  });

  it("treats an unreadable table as unavailable, never as zero", () => {
    const result = cash.build({ incoming: { ok: false, rows: [] }, outgoing: ok([]), received: ok([]), now: NOW });
    assert.equal(result.complete, false);
    assert.deepEqual(result.unavailable, ["money owed to you"]);
  });

  it("treats an unreadable payments table as unavailable rather than reporting gross as net", () => {
    // Overstating money coming in is the wrong direction to be wrong in.
    const result = cash.build({
      incoming: ok([{ id: "inv-1", due_on: day(5), total_cents: 100000, status: "sent" }]),
      outgoing: ok([]),
      received: { ok: false, rows: [] },
      now: NOW
    });
    assert.equal(result.complete, false);
    assert.deepEqual(result.unavailable, ["payments received"]);
  });

  it("computes the net as money in minus money out, per period and overall", () => {
    const result = cash.build({
      ...EMPTY,
      incoming: ok([{ id: "a", due_on: day(3), total_cents: 50000, status: "sent" }]),
      outgoing: ok([{ id: "b", due_date: day(3), total_cents: 80000, payment_status: "unpaid" }])
    });
    const week = result.rows.find((row) => row.key === "week");
    assert.equal(week.netCents, -30000, "a week that takes more out than it brings in is the whole point of this view");
    assert.equal(result.netCents, -30000);
  });

  it("reports an empty business as complete rather than as a problem", () => {
    const result = cash.build(EMPTY);
    assert.equal(result.complete, true);
    assert.equal(result.netCents, 0);
    assert.equal(result.rows.length, cash.PERIODS.length, "every period renders, including the ones with nothing in them");
  });

  it("does not call a capped read the whole picture", () => {
    // `complete` is documented in the module as false whenever "money exists
    // that these figures do not include", and a read that came back capped is
    // exactly that -- it was simply not one of the three things the flag
    // counted. The caller read 500 rows per table and reported `{ ok: true }`,
    // so a business with more than 500 invoices got an understated cash
    // position labelled complete.
    const result = cash.build({
      ...EMPTY,
      incoming: short([{ id: "a", due_on: day(3), total_cents: 50000, status: "sent" }])
    });

    assert.equal(result.complete, false, "a total summed from a capped read read as the whole picture");
    assert.deepEqual(result.truncated, ["money owed to you"]);

    // Kept apart from the unreadable case. The causes differ and so do the
    // remedies: an outage is worth retrying and a size is not, so an owner told
    // "could not be read" about a capped read is being told to do something
    // that cannot work.
    assert.deepEqual(result.unavailable, [], "a capped read was reported as an unreadable table");

    // And the rows it DID read still count. Refusing to total anything would
    // replace an understated figure with no figure, and the page's job is to
    // say what it knows and what it does not.
    assert.equal(result.totalIncoming, 50000);
  });

  it("names a capped payments read, which errs in the other direction", () => {
    // The sharpest of the three and the least obvious. Payments are SUBTRACTED
    // from what is owed, so missing payment rows do not understate the total --
    // they overstate money coming in, by failing to reduce invoices already
    // settled. The module already refuses to report gross as net when the
    // payments read FAILS; this is the same error arriving by a different route.
    const result = cash.build({
      ...EMPTY,
      incoming: ok([{ id: "a", due_on: day(3), total_cents: 50000, status: "sent" }]),
      received: short([])
    });

    assert.equal(result.complete, false);
    assert.deepEqual(result.truncated, ["payments received"]);
  });

  it("still reports a full read as complete", () => {
    // Or the three assertions above are satisfied by a flag that is never true,
    // and "never complete" would pass a check written about a wrong complete.
    const result = cash.build({
      ...EMPTY,
      incoming: ok([{ id: "a", due_on: day(3), total_cents: 50000, status: "sent" }])
    });

    assert.equal(result.complete, true);
    assert.deepEqual(result.truncated, []);
  });

  it("survives a malformed row rather than failing the page", () => {
    const result = cash.build({
      ...EMPTY,
      incoming: ok([null, {}, { id: "a", due_on: "not-a-date", total_cents: "abc", status: "sent" }]),
      outgoing: ok([undefined, { total_cents: null, payment_status: "unpaid" }])
    });
    assert.equal(result.totalIncoming, 0);
    assert.equal(result.totalOutgoing, 0);
  });
});
