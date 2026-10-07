"use strict";
const assert = require("node:assert/strict");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const ORG = "11111111-1111-4111-8111-111111111111";
const BOOKING = "22222222-2222-4222-8222-222222222222";
describe("fake Supabase jsonb equality", () => {
  function fixture() {
    const fake = createFakeSupabase({ tables: { business_bookings: [{
      id: BOOKING, organization_id: ORG, status: "requested",
      metadata: { waitlist: true, nested: { party: 2, resources: ["a", "b"] } }
    }] } });
    return { fake, fetch: fake.install(async () => { throw new Error("external request refused"); }) };
  }
  const query = (fake, operator, value) => fake.url + "/rest/v1/business_bookings?organization_id=eq." + ORG
    + "&metadata=" + operator + "." + encodeURIComponent(value);
  it("matches equal JSON objects independently of key order", async () => {
    const { fake, fetch } = fixture();
    const response = await fetch(query(fake, "eq", JSON.stringify({ nested: { resources: ["a", "b"], party: 2 }, waitlist: true })));
    assert.equal((await response.json())[0].id, BOOKING);
  });
  it("does not widen an equality query on changed values or array order", async () => {
    const { fake, fetch } = fixture();
    for (const value of [{ waitlist: true, nested: { party: 3, resources: ["a", "b"] } },
      { waitlist: true, nested: { party: 2, resources: ["b", "a"] } }]) {
      assert.deepEqual(await (await fetch(query(fake, "eq", JSON.stringify(value)))).json(), []);
    }
  });
  it("uses structural inequality rather than object coercion", async () => {
    const { fake, fetch } = fixture();
    assert.deepEqual(await (await fetch(query(fake, "neq",
      JSON.stringify({ waitlist: true, nested: { party: 2, resources: ["a", "b"] } })))).json(), []);
    assert.equal((await (await fetch(query(fake, "neq", JSON.stringify({ waitlist: false })))).json()).length, 1);
  });
  it("does not let malformed JSON equality mutate every row", async () => {
    const { fake, fetch } = fixture();
    const response = await fetch(query(fake, "eq", "[object Object]"), { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
    assert.deepEqual(await response.json(), []);
    assert.equal(fake.rows("business_bookings")[0].status, "requested");
  });
});

