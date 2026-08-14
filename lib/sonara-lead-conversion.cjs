"use strict";

// Turning a won lead into a customer.
//
// growth_leads and customers hold the same four fields and nothing joined them,
// so a lead that closed had to be retyped before it could be quoted. That seam
// is the one the "one system" claim is actually about: Growth Studio finds the
// work, Business Builder bills it.
//
// Both tables are scoped to the same organization, so this crosses a product
// boundary and not a tenancy one. The route still passes the organization to
// every read and write rather than trusting that.
//
// Same shape as lib/sonara-quote-conversion.cjs, and for the same reasons: this
// is the owner acting rather than an agent, and every refusal below exists
// because the alternative creates a record somebody later has to untangle.

// Only a won lead becomes a customer.
//
// "qualified" is the state where somebody looks promising, which is not the
// same as having agreed to anything -- the same distinction as "sent" against
// "accepted" on a quote. Creating customer records for everyone who looked
// interested turns the customer list into a second copy of the lead list.
const CONVERTIBLE = Object.freeze(["won"]);

function reasonNotConvertible(lead, existingCustomers) {
  if (!lead || !lead.id) return "That lead is not one of yours.";

  const status = String(lead.status || "").toLowerCase();
  if (!CONVERTIBLE.includes(status)) {
    return status === "qualified"
      ? "This lead is qualified but not won yet. Mark it won once they agree, and it can become a customer."
      : `A lead has to be won before it becomes a customer. This one is ${status || "not set"}.`;
  }

  if (lead.customer_id) {
    return "This lead has already been made a customer. Open that customer rather than creating a second one.";
  }

  const name = String(lead.name || "").trim();
  if (!name) {
    return "This lead has no name, so the customer would have nothing to be addressed to. Add the name to the lead first.";
  }

  // Not required by the schema, and required here. A customer with no email and
  // no phone cannot be sent an invoice, which is the only reason to create one.
  if (!String(lead.email || "").trim() && !String(lead.phone || "").trim()) {
    return "This lead has no email and no phone, so an invoice would have nowhere to go. Add a way to contact them first.";
  }

  // The last guard, and the one that matters when a button is pressed twice.
  // Matching on email is deliberate: two people can share a name, and a second
  // customer row for the same address is the duplicate somebody finds months
  // later with half the invoices against each.
  const email = String(lead.email || "").trim().toLowerCase();
  if (email) {
    const already = (Array.isArray(existingCustomers) ? existingCustomers : []).find(
      (row) => String(row?.email || "").trim().toLowerCase() === email
    );
    if (already) {
      return `A customer with that email already exists${already.name ? ` (${already.name})` : ""}. Link the lead to them rather than creating a second record.`;
    }
  }

  return null;
}

/**
 * The customer row a lead becomes.
 *
 * Every field is carried across unchanged. Nothing is inferred, defaulted to a
 * guess, or tidied -- if a lead's source says "instagram dm" then so does the
 * customer's, because the owner wrote it and it is how they will search for it.
 */
function customerFromLead(lead, { organizationId, userId = null } = {}) {
  if (!organizationId) throw new TypeError("converting a lead requires an organizationId");

  return {
    organization_id: organizationId,
    name: String(lead.name || "").trim(),
    email: String(lead.email || "").trim() || null,
    phone: String(lead.phone || "").trim() || null,
    source: String(lead.source || "").trim() || null,
    status: "active",
    created_by: userId
  };
}

module.exports = { CONVERTIBLE, reasonNotConvertible, customerFromLead };
