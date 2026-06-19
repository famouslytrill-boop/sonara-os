const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const request = require("supertest");

const app = require("../server");

describe("SONARA SaaS functional routes", () => {
  it("returns readiness without secret values", async () => {
    const res = await request(app).get("/api/readiness").expect(200);
    assert.equal(res.body.ok, true);
    for (const key of ["accountDatabase", "paymentConnection", "paymentUpdates", "emailDelivery", "googleSignIn", "founderAccess"]) {
      assert.ok(["configured", "deferred", "missing"].includes(res.body[key]), `bad readiness value for ${key}`);
    }
    assert.equal(JSON.stringify(res.body).includes("sk_"), false);
    assert.equal(JSON.stringify(res.body).includes("whsec_"), false);
  });

  it("rejects invalid Stripe webhook signatures", async () => {
    const previous = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_signature_check_1234567890";
    const payload = Buffer.from(JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: {} } }));
    const signature = `t=123,v1=${crypto.createHmac("sha256", "wrong_secret").update(`123.${payload.toString("utf8")}`).digest("hex")}`;
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", signature)
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(400);
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  });

  it("shows setup-required for protected intake without auth instead of fake success", async () => {
    const res = await request(app)
      .post("/api/business-builder/intake")
      .set("Accept", "application/json")
      .send({ company_name: "Test", contact_name: "Test", email: "test@example.com", goals: "Launch" });
    assert.ok([401, 503].includes(res.status));
    assert.equal(res.body.ok, false);
  });
});
