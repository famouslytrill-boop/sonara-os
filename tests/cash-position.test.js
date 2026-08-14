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
