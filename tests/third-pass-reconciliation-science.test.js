const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { settle, totalPaid } = require("../lib/sonara-invoice-settlement.cjs");
const { evaluateFormula } = require("../lib/sonara-formula-library.cjs");
const notice = require("../lib/sonara-invoice-paid-notice.cjs");
describe("verified invoice arithmetic", () => {
  for (const amount of [true, false, 0.5, "1.5", " ", "1e3", {}, Number.MAX_SAFE_INTEGER + 1]) {
    it(`refuses ambiguous cents ${JSON.stringify(amount)}`, () => {
      const result = settle({ invoice: { total_cents: 100 }, payments: [{ amount_cents: 100 }, { amount_cents: amount }] });
      assert.equal(result.status, "unknown"); assert.equal(result.outstandingCents, null);
    });
  }
  it("retains signed corrections and integer text", () => {
    assert.deepEqual(totalPaid([{ amount_cents: "100" }, { amount_cents: -20 }]), { cents: 80, unreadable: 0 });
    assert.equal(settle({ invoice: { total_cents: 100 }, payments: [{ amount_cents: 100 }, { amount_cents: -20 }] }).outstandingCents, 20);
  });
  it("refuses overflowing sums and balances", () => {
    assert.equal(settle({ invoice: { total_cents: 100 }, payments: [{ amount_cents: Number.MAX_SAFE_INTEGER }, { amount_cents: 1 }] }).status, "unknown");
    assert.equal(settle({ invoice: { total_cents: Number.MAX_SAFE_INTEGER }, payments: [{ amount_cents: -1 }] }).status, "unknown");
  });
  it("refuses an invalid payment collection", () => {
    assert.equal(settle({ invoice: { total_cents: 100 }, payments: {} }).status, "unknown");
  });
  it("does not notify when an unreadable correction accompanies a covering payment", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const fetchImpl = async (url) => ({ ok: true, json: async () => url.includes("customer_invoice_payments") ? [{ id, amount_cents: 100 }, { id: "other", amount_cents: null }] : [{ id, total_cents: 100 }] });
    const result = await notice.announcePayment({ supabaseUrl: "https://example.com", serviceRoleHeaders: () => ({}) }, { organizationId: id, invoiceId: id, paymentId: id }, { fetchImpl, notify: async () => { throw Error("must not notify"); } });
    assert.equal(result.notified, false); assert.equal(result.reason, "balance_unverified");
  });
});
describe("bounded science and media formulas", () => {
  const examples = [
    ["kinetic_energy_joules", { mass_kg: 30, speed_meters_per_second: 0.5 }, 3.75],
    ["dilution_stock_volume", { target_concentration: 2, final_volume: 100, stock_concentration: 10 }, 20],
    ["render_time_estimate_seconds", { frame_count: 300, measured_frames_per_second: 25, overhead_seconds: 3 }, 15],
    ["uncompressed_image_bytes", { width_pixels: 1920, height_pixels: 1080, channels: 4, bytes_per_channel: 1 }, 8294400],
    ["average_acceleration", { final_velocity: -2, initial_velocity: 4, elapsed_seconds: 3 }, -2],
    ["rectangle_area_square_meters", { length_meters: 3, width_meters: 4 }, 12]
  ];
  for (const [key, values, expected] of examples) it(`evaluates ${key} through the existing HTTP route`, async () => {
    const app = express(); app.use(express.json()); require("../routes/sonara-formula-routes.cjs")(app);
    const res = await request(app).post("/api/formulas/evaluate").send({ formulaKey: key, inputValues: values });
    assert.equal(res.status, 200); assert.equal(res.body.resultValue, expected);
  });
  it("rejects concentration by dilution, zero throughput and oversized images", () => {
    assert.equal(evaluateFormula("dilution_stock_volume", { target_concentration: 20, stock_concentration: 10, final_volume: 100 }).code, "invalid_input");
    assert.equal(evaluateFormula("render_time_estimate_seconds", { frame_count: 10, measured_frames_per_second: 0, overhead_seconds: 0 }).code, "invalid_input");
    assert.equal(evaluateFormula("uncompressed_image_bytes", { width_pixels: 8193, height_pixels: 1, channels: 4, bytes_per_channel: 1 }).code, "invalid_input");
  });
});
