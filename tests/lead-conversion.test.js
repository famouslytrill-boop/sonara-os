"use strict";

const assert = require("node:assert/strict");
const convert = require("../lib/sonara-lead-conversion.cjs");
const { describedColumns, hasColumn } = require("../lib/sonara-migration-columns.cjs");

const ORG = "11111111-1111-1111-1111-111111111111";

function lead(overrides = {}) {
  return { id: "l-1", status: "won", name: "Halton Facilities", email: "ap@example.com", phone: "0161 000 0000", source: "referral", customer_id: null, ...overrides };
}

describe("turning a won lead into a customer", () => {
  it("writes only columns the customers table actually has", () => {
    const columns = new Set((describedColumns("customers") || []).map((column) => column.name));
    assert.ok(columns.size > 0, "the migrations were not read");
    const wrong = Object.keys(convert.customerFromLead(lead(), { organizationId: ORG })).filter((key) => !columns.has(key));
    assert.deepEqual(wrong, [], `customers has no column ${wrong.join(", ")}`);
  });

  it("records which customer a lead became, so a second press is detectable", () => {
    // hasColumn rather than describedColumns: customer_id is added by an ALTER,
    // and describedColumns deliberately omits those because it cannot read
    // their type, while tableColumns knows them by name. Asking the wrong one
    // reported a column that is there as missing.
    assert.ok(
      hasColumn("growth_leads", "customer_id"),
      "growth_leads needs customer_id or a converted lead is indistinguishable from a new one"
    );
  });

  it("converts a won lead", () => {
    assert.equal(convert.reasonNotConvertible(lead(), []), null);
  });

  it("refuses a qualified lead, because looking promising is not agreeing", () => {
    assert.match(convert.reasonNotConvertible(lead({ status: "qualified" }), []), /not won yet/);
  });

  it("refuses every status that is not won", () => {
    for (const status of ["new", "contacted", "lost", "archived", ""]) {
      assert.ok(convert.reasonNotConvertible(lead({ status }), []), `${status || "(blank)"} must not convert`);
    }
  });

  it("refuses a lead it has already converted", () => {
    assert.match(convert.reasonNotConvertible(lead({ customer_id: "c-9" }), []), /already been made a customer/);
  });

  it("refuses a lead with no name", () => {
    assert.match(convert.reasonNotConvertible(lead({ name: "  " }), []), /nothing to be addressed to/);
  });

  it("refuses a lead with no way to contact them, since an invoice would have nowhere to go", () => {
    assert.match(convert.reasonNotConvertible(lead({ email: "", phone: "" }), []), /nowhere to go/);
    assert.equal(convert.reasonNotConvertible(lead({ email: "", phone: "0161 000 0000" }), []), null, "a phone alone is enough");
    assert.equal(convert.reasonNotConvertible(lead({ email: "ap@example.com", phone: "" }), []), null, "an email alone is enough");
  });

  it("refuses when a customer with that email already exists", () => {
    // Two people share a name; a second row for the same address is the
    // duplicate somebody finds months later with half the invoices on each.
    const existing = [{ id: "c-1", name: "Halton Facilities Ltd", email: "AP@Example.com" }];
    assert.match(convert.reasonNotConvertible(lead(), existing), /already exists \(Halton Facilities Ltd\)/);
  });

  it("does not treat a different email as a match", () => {
    assert.equal(convert.reasonNotConvertible(lead(), [{ id: "c-1", name: "Someone", email: "other@example.com" }]), null);
  });

  it("does not block a lead with no email on somebody else's blank email", () => {
    const existing = [{ id: "c-1", name: "No Email Co", email: "" }];
    assert.equal(convert.reasonNotConvertible(lead({ email: "", phone: "0161 000 0000" }), existing), null);
  });

  it("carries every field across without tidying it", () => {
    // If the owner wrote "instagram dm" then so does the customer, because that
    // is how they will search for it later.
    const customer = convert.customerFromLead(lead({ source: "instagram dm" }), { organizationId: ORG, userId: "u-1" });
    assert.equal(customer.name, "Halton Facilities");
    assert.equal(customer.email, "ap@example.com");
    assert.equal(customer.source, "instagram dm");
    assert.equal(customer.organization_id, ORG);
    assert.equal(customer.created_by, "u-1");
  });

  it("stores a missing optional field as null rather than an empty string", () => {
    const customer = convert.customerFromLead(lead({ phone: "  ", source: "" }), { organizationId: ORG });
    assert.equal(customer.phone, null);
    assert.equal(customer.source, null);
  });

  it("refuses to build anything without an organization", () => {
    assert.throws(() => convert.customerFromLead(lead(), {}), /organizationId/);
  });
});
