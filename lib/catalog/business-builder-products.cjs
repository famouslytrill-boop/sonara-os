"use strict";

// See lib/catalog/sonara-industries-products.cjs for the row shape. name,
// summary and customerOutcome are customer-facing copy; the rest is internal.

module.exports = Object.freeze([
  [
    "business-readiness-plan",
    "Business Plan & Setup Check",
    "planning",
    "An honest look at your business model, milestones, costs, risks, support, legal and security gaps, with a plan to close them.",
    "Know what is ready, what is blocking you, and what to do next.",
    "free",
    "beta",
    "/business-builder/tools/readiness",
    "readiness score|guided business plan|startup costs|cash-flow snapshot|launch report",
    "launch checklist|formula engine",
    "Guidance does not replace legal, tax, accounting, banking, or licensing professionals."
  ],
  [
    "market-offer-pricing-lab",
    "Offer & Pricing Builder",
    "sales",
    "Work out who you can realistically reach, then build the package, scope, costs, margin, proof, and price.",
    "Publish a focused offer you can actually deliver at a profit.",
    "free",
    "active",
    "/business-builder/tools/offer",
    "customer definition|market evidence|offer builder|pricing calculator|service packages",
    "market intelligence|business catalog",
    "Claims, guarantees, capacity, pricing, and refunds require owner review."
  ],
  [
    "customer-intake-service-crm",
    "Customer & Enquiry Tracker",
    "crm",
    "Every prospect, enquiry, customer, permission, note, status, and next step in one list.",
    "Never lose track of somebody who wanted to buy from you.",
    "starter",
    "active",
    // Both this and "Bookings, Staff & Day-to-Day" pointed at
    // /business-builder/dashboard. Two products, two plan floors, one
    // destination -- so whichever one a customer bought, they arrived at the
    // same page and had to work out which half of it they had paid for.
    //
    // They are not duplicates: this is the CRM and that is operations, which is
    // why one sits at Starter and the other at Core. The lazy route was the
    // only thing they had in common. This one goes to the customer records.
    "/business-builder/owner/customers",
    "lead records|customer records|intake forms|service catalog|follow-up",
    "customer_records|intake_requests",
    "Collect only necessary data and follow consent and retention rules."
  ],
  [
    "quotes-billing-payments",
    "Quotes, Invoices & Getting Paid",
    "payments",
    "Quotes, the invoices they turn into, what is on each one, what has been paid and what you are still owed.",
    "Go from an accepted quote to money received, without ever touching your customer's card details.",
    "core",
    "beta",
    // Was /business-builder/billing, which is the customer's own SONARA
    // subscription -- "Upgrade: Starter", "Manage billing portal". This row is
    // about invoicing *their* customers, and it sent them to a page about
    // paying us. The invoices page has the records and the form.
    "/business-builder/owner/invoices",
    "quotes|invoices|line items|payments received|money owed to you",
    "Stripe|orders|purchases",
    "Payment success appears only after provider confirmation; refunds require approval."
  ],
  [
    "booking-operations-team",
    "Bookings, Staff & Day-to-Day",
    "operations",
    "Appointments, staff, shifts, hours, stock, suppliers, locations, equipment, recipes, food costs, and reports.",
    "Run the whole working day from one screen.",
    "core",
    "beta",
    // The other half of the shared route above. This row spans bookings,
    // staff, shifts, stock, suppliers, locations and vehicles, so a single
    // record page would misrepresent it -- /business-builder/owner is the
    // operations hub that lists all of them.
    "/business-builder/owner",
    "booking|appointments|employees|shifts|inventory|vendors|locations|assets|food operations|reports",
    "business operations tables|notifications",
    "External messages, payroll actions, and calendar mutations require configured providers and authorization."
  ],
  [
    // Was "Records, Renewals & Exports", pointing at /business-builder/launch-readiness
    // and stuck on validation_required. Three separate things were wrong with
    // that and only one of them was the lifecycle field.
    //
    // It promised renewal reminders and CSV import mapping, and neither is
    // built -- grep for either and the only hits are this row and the
    // migrations that copied it. It pointed at the service setup checklist,
    // which is the same page for all three products and shows which providers
    // are configured, not one record belonging to the business. And
    // validation_required is not a state anything could leave, because no
    // criteria were ever written for it.
    //
    // What does exist is the export side: prepare a batch of records for a
    // period, see whether it finished, and take the whole account away from
    // /account/data. So the row now says that and points at the page that
    // does it. The promises came out rather than the feature.
    "business-evidence-compliance-portability",
    "Records & Exports",
    "governance",
    "Prepare your records for an accountant, see whether each export finished, and download everything on your account.",
    "Get your paperwork out whenever you want, in a form somebody else can use.",
    "core",
    "beta",
    "/business-builder/owner/accounting-exports",
    "accounting exports|export status|full account download|erasure requests|audit evidence",
    "storage|export jobs",
    "An export is a copy of your records, not a legal or tax filing, and SONARA does not determine what you are obliged to keep."
  ]
]);
