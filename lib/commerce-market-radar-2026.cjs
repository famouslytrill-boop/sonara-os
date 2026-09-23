// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * SONARA Commerce + Omnichannel Market Radar — 2026-09-22
 *
 * Non-executing research/control-plane registry. This file translates current
 * commerce, retail, POS, kiosk, agentic-commerce, inventory and fulfillment
 * evidence into SONARA-owned architecture decisions.
 *
 * It does not process a payment, reserve inventory, create an order, install a
 * provider, call a marketplace, publish a product feed, or enable agent spend.
 */

const SNAPSHOT_DATE = "2026-09-22";
const REGISTRY_VERSION = "1.0.0";

const STATUS = Object.freeze({
  RESEARCH: "research",
  DESIGN: "design",
  PARTNER_BOUNDARY: "partner_boundary",
  DO_NOT_REBUILD: "do_not_rebuild"
});

const CHANNELS = Object.freeze([
  "owned_web_storefront",
  "mobile_web",
  "staff_pos",
  "self_service_kiosk",
  "qr_order_and_pay",
  "social_commerce",
  "marketplace",
  "b2b_portal",
  "agentic_commerce",
  "pickup",
  "local_delivery",
  "ship_from_store",
  "warehouse_fulfillment"
]);

const CANONICAL_COMMERCE_GRAPH = Object.freeze([
  "merchant",
  "brand",
  "location",
  "channel",
  "customer",
  "company_account",
  "catalog",
  "product",
  "variant",
  "product_identifier",
  "price_list",
  "promotion",
  "tax_rule_reference",
  "inventory_position",
  "inventory_reservation",
  "stock_movement",
  "supplier",
  "purchase_order",
  "transfer_order",
  "cart",
  "checkout_session",
  "order",
  "order_line",
  "fulfillment",
  "shipment",
  "pickup",
  "return_authorization",
  "exchange",
  "refund",
  "payment_reference",
  "gift_card_reference",
  "loyalty_account",
  "subscription",
  "entitlement",
  "register",
  "device",
  "cashier_session",
  "receipt",
  "evidence_event"
]);

const INVARIANTS = Object.freeze([
  "one canonical product identity feeds every channel",
  "inventory availability is tenant and location scoped",
  "channel adapters never become the source of truth for inventory or orders",
  "all side effects require idempotency keys and durable outcome evidence",
  "payment credentials never enter model context",
  "models may recommend or draft but deterministic commands validate mutations",
  "refunds exchanges discounts and delegated spend are policy controlled",
  "every order preserves channel location customer pricing tax and fulfillment provenance",
  "returns are first-class order lifecycle objects rather than free-form notes",
  "offline operations reconcile through explicit queued state rather than silent overwrite",
  "customer-visible availability must never exceed authoritative available-to-promise inventory",
  "agentic commerce adapters expose machine-readable catalog policy availability and checkout contracts without granting autonomous spend by default"
]);

const MARKET_SIGNALS = Object.freeze([
  signal("us_ecommerce_scale", "US Census Bureau", "2026-08-18",
    "https://www.census.gov/retail/ecommerce.html",
    "US Q2 2026 ecommerce sales were $340.2B seasonally adjusted and 17.1% of total retail sales.",
    "Treat digital commerce as a major channel while preserving physical-store operations in the same system of record."),
  signal("physical_and_ai_convergence", "NRF + IBM", "2026-01-07",
    "https://nrf.com/research/own-the-agentic-commerce-experience",
    "Consumers continue to use stores heavily while AI-assisted product research and deal discovery are growing.",
    "Build one customer, catalog, inventory and order graph across physical, digital and agent surfaces."),
  signal("ucp", "Google", "2026-01-11",
    "https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/",
    "Universal Commerce Protocol provides open commerce primitives across consumer surfaces, businesses and payment providers with API, A2A and MCP compatibility.",
    "Keep SONARA commerce protocol-neutral and expose canonical contracts through reviewed adapters."),
  signal("ucp_cart", "Google", "2026-03-19",
    "https://blog.google/products-and-platforms/products/shopping/ucp-updates/",
    "UCP added optional cart capabilities for multi-item agent shopping.",
    "Model cart and checkout as durable commerce objects independent of any single assistant."),
  signal("openai_acp", "OpenAI", "2025-09-29",
    "https://openai.com/index/buy-it-in-chatgpt/",
    "Agentic Commerce Protocol keeps merchants in control of orders, payments, fulfillment, returns and support while enabling agent-mediated checkout.",
    "Implement ACP as an adapter over SONARA merchant-owned order and fulfillment state, not as the primary business model."),
  signal("shopify_unified_commerce", "Shopify", "2026-07-02",
    "https://www.shopify.com/blog/unified-commerce",
    "Unified commerce centers shared customer, order, inventory and fulfillment state across retail and ecommerce.",
    "Use a single commerce graph instead of separate online-store and POS databases."),
  signal("shopify_b2b", "Shopify", "2026-04-02",
    "https://www.shopify.com/news/b2b-for-all",
    "Native B2B capabilities increasingly share the same commerce platform as direct-to-consumer operations.",
    "Support company accounts, price lists, terms, quantity rules and wholesale ordering as extensions of the canonical catalog."),
  signal("square_retail", "Square", SNAPSHOT_DATE,
    "https://squareup.com/us/en/retail",
    "Square unifies payments, multichannel inventory, purchase orders, customer profiles and selling across locations.",
    "Prioritize inventory, supplier, customer and payment reconciliation depth before cosmetic channel expansion."),
  signal("toast_pos_kiosk", "Toast", "2026-08-14",
    "https://pos.toasttab.com/hardware/restaurant-kiosk",
    "Restaurant kiosks connect ordering, payment, kitchen routing, upsells and loyalty to the same POS state.",
    "Treat kiosk and QR ordering as constrained channel shells over one order/menu/payment contract."),
  signal("toast_retail_mode", "Toast", "2026-09-17",
    "https://support.toasttab.com/en/article/Get-Started-With-Retail-POS-Mode",
    "Retail POS workflows include barcode scanning, weighed items and PLU lookup.",
    "Design product identity and checkout inputs for barcode, PLU, weighted quantity and modifier use cases."),
  signal("lightspeed_inventory", "Lightspeed", SNAPSHOT_DATE,
    "https://www.lightspeedhq.com/pos/retail/inventory-management-software/",
    "Multi-location retail combines supplier ordering, landed cost, forecasting, inventory transfers, ecommerce and POS.",
    "Build stock movements, purchase orders, transfer orders, landed-cost evidence and replenishment before autonomous reordering."),
  signal("returns", "NRF + Happy Returns", "2025-10-15",
    "https://nrf.com/research/2025-retail-returns-landscape",
    "Returns are economically material, especially online, and fraud controls are increasingly important.",
    "Make returns, exchanges, refund state and fraud evidence first-class commerce workflows."),
  signal("gs1_digital_link", "GS1 US", SNAPSHOT_DATE,
    "https://www.gs1us.org/industries-and-insights/gs1-digital-link/for-retailers",
    "GS1 Digital Link connects product identifiers and 2D barcodes to digital information and future POS use cases.",
    "Store GTIN, SKU, lot, serial and Digital Link references without coupling core product identity to one barcode format."),
  signal("visa_agentic_payments", "Visa", "2026-07-14",
    "https://www.visa.com/en-us/thought-leadership/innovation/agentic-payments-from-the-ground-up",
    "Agentic purchasing increases the importance of authenticated intent, scoped credentials, limits and transaction evidence.",
    "Keep payment authority deterministic, bounded and independently auditable from model reasoning."),
  signal("mastercard_agent_connect", "Mastercard", "2026-09-09",
    "https://www.mastercard.com/us/en/news-and-trends/press/2026/september/mastercard-gives-merchants-a-simpler-way-to-build--connect-and-s.html",
    "Merchant tooling is evolving for product discovery, agent access control and trusted AI-assisted purchase flows.",
    "Add agent-channel policy and discoverability controls to the commerce adapter layer."),
  signal("stripe_machine_payments", "Stripe", "2026-03-18",
    "https://stripe.com/blog/machine-payments-protocol",
    "Machine payment protocols target programmatic agent-to-business transactions.",
    "Represent machine payments as a reviewed provider adapter with budgets, idempotency, receipts and reconciliation."),
  signal("amazon_checkout_fulfillment", "Amazon Buy with Prime", "2026-05-02",
    "https://buywithprime.amazon.com/",
    "Third-party storefronts can combine merchant-owned sites with external checkout and fulfillment capabilities.",
    "Separate storefront ownership from fulfillment-provider choice so merchants can route orders without migrating the catalog.")
]);

const BENCHMARKS = Object.freeze([
  benchmark("Shopify", ["unified commerce", "POS", "B2B", "agent-ready catalog"]),
  benchmark("Square", ["SMB POS", "inventory", "payments", "loyalty", "online"]),
  benchmark("Toast", ["restaurant POS", "kiosk", "KDS", "QR ordering", "retail hybrid"]),
  benchmark("Lightspeed", ["multi-location retail", "supplier purchasing", "landed cost", "forecasting"]),
  benchmark("Amazon Buy with Prime", ["checkout", "fulfillment", "post-purchase"]),
  benchmark("Google UCP", ["agentic commerce protocol", "cart", "merchant interoperability"]),
  benchmark("OpenAI ACP", ["agent-mediated discovery and checkout", "merchant-of-record boundary"]),
  benchmark("Visa Intelligent Commerce", ["agent payment trust", "credential controls"]),
  benchmark("Mastercard Agent Pay / Agent Connect", ["agent identity", "intent", "merchant agent surfaces"]),
  benchmark("GS1 Digital Link", ["product identity", "2D barcode", "traceability"])
]);

const ROADMAP = Object.freeze({
  days0to30: [
    "define Canonical Commerce Graph contracts and ownership boundaries",
    "reconcile current product catalog/order/payment/inventory schema against the graph",
    "define location-scoped inventory position reservation and stock-movement contracts",
    "define cart checkout order fulfillment return refund and exchange state machines",
    "add channel capability negotiation for web POS kiosk B2B marketplace and agent surfaces",
    "add deterministic commerce formulas with units timestamps inputs and evidence",
    "add protocol adapter specifications for UCP ACP and machine-payment research without runtime activation",
    "add storefront/POS/kiosk UX truth states including offline setup required unavailable and degraded"
  ],
  days30to90: [
    "implement one owned storefront canary over the canonical catalog and order lifecycle",
    "implement one staff POS canary with barcode search cart tender handoff receipt and inventory decrement",
    "implement one self-service kiosk canary with accessibility large-touch flow and explicit assistance path",
    "implement purchase orders receiving transfers cycle counts and supplier records",
    "implement BOPIS local delivery ship-from-store and fulfillment evidence",
    "implement returns exchanges partial refunds and reconciliation",
    "implement customer profiles loyalty and consent-aware messaging boundaries",
    "verify offline queue reconciliation and duplicate-prevention under network failure"
  ],
  days90to180: [
    "add B2B company accounts catalogs price lists quantity rules terms and approval flows",
    "add one marketplace or social-commerce adapter with receipts and reconciliation",
    "add one agentic-commerce adapter after protocol threat modeling and merchant policy controls",
    "add GS1 Digital Link and 2D barcode readiness behind identifier abstractions",
    "add demand forecasting reorder recommendations and safety-stock suggestions as advisory outputs",
    "add multi-location margin landed-cost sell-through aging and shrink analytics",
    "add provider-neutral fulfillment routing and carrier evidence",
    "expand vertical packs for restaurant retail creator merchandise trades parts fleet supplies and manufacturing inventory"
  ]
});

const AGENT_POLICY = Object.freeze({
  allowedWithoutApproval: [
    "search catalog",
    "read scoped availability",
    "compare approved offers",
    "draft cart",
    "draft purchase order",
    "recommend reorder",
    "classify return reason"
  ],
  deterministicCommandRequired: [
    "reserve inventory",
    "create order",
    "change price",
    "apply exceptional discount",
    "issue refund",
    "transfer inventory",
    "submit purchase order",
    "publish product feed"
  ],
  explicitHumanOrPolicyAuthorizationRequired: [
    "capture or commit spend",
    "large or unusual refund",
    "high-risk discount override",
    "supplier commitment above configured threshold",
    "mass product mutation",
    "marketplace publication when not pre-approved"
  ],
  forbiddenByDefault: [
    "placing unrestricted purchases",
    "storing raw payment credentials in prompts or memory",
    "silently changing inventory truth",
    "silently changing tax or legal policy",
    "bypassing merchant return policy",
    "auto-publishing to every channel"
  ]
});

const FORMULAS = Object.freeze({
  availableToPromise: "max(0, on_hand - reserved - safety_stock - blocked)",
  grossMargin: "net_sales - cost_of_goods_sold",
  grossMarginRate: "gross_margin / net_sales when net_sales > 0",
  inventoryTurnover: "cost_of_goods_sold / average_inventory_value",
  sellThroughRate: "units_sold / units_received for a defined period and cohort",
  reorderPoint: "expected_demand_during_lead_time + safety_stock",
  returnRate: "returned_units / fulfilled_units for the same cohort and period",
  conversionRate: "completed_orders / eligible_checkout_sessions",
  fulfillmentSlaRate: "fulfillments_within_sla / fulfilled_orders",
  channelContribution: "channel_net_revenue - channel_variable_costs - returns_cost - fulfillment_variable_cost"
});

function signal(key, source, observedAt, sourceUrl, finding, designRule) {
  return Object.freeze({ key, source, observedAt, sourceUrl, finding, designRule, relationship: "market_reference_not_integration" });
}

function benchmark(name, strengths) {
  return Object.freeze({ name, strengths: Object.freeze([...strengths]), relationship: "market_reference_not_integration" });
}

function availableToPromise({ onHand = 0, reserved = 0, safetyStock = 0, blocked = 0 } = {}) {
  const values = [onHand, reserved, safetyStock, blocked].map(Number);
  if (values.some((value) => !Number.isFinite(value))) throw new TypeError("inventory inputs must be finite numbers");
  return Math.max(0, values[0] - values[1] - values[2] - values[3]);
}

function commerceReadinessScore(input = {}) {
  const weights = {
    catalogIntegrity: 18,
    inventoryAccuracy: 18,
    orderLifecycle: 16,
    paymentReconciliation: 14,
    fulfillmentEvidence: 12,
    returnsLifecycle: 8,
    channelConsistency: 8,
    securityAndAuthority: 6
  };
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const raw = Number(input[key] ?? 0);
    const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    total += normalized * weight;
  }
  return Math.round(total);
}

function getCommerceMarketRadar2026() {
  return Object.freeze({
    asOf: SNAPSHOT_DATE,
    version: REGISTRY_VERSION,
    authority: "research_and_design_only",
    runtimeAuthority: "none",
    executionEnabled: false,
    productionClaim: false,
    owner: "Business Builder + shared SONARA Nexus commerce services",
    channels: CHANNELS,
    canonicalCommerceGraph: CANONICAL_COMMERCE_GRAPH,
    invariants: INVARIANTS,
    marketSignals: MARKET_SIGNALS,
    benchmarks: BENCHMARKS,
    roadmap: ROADMAP,
    agentPolicy: AGENT_POLICY,
    formulas: FORMULAS,
    boundaries: Object.freeze({
      sonaraOwns: [
        "merchant workspace and UX",
        "canonical catalog inventory order fulfillment return and evidence state",
        "workflow policy approvals audit analytics and channel orchestration",
        "provider-neutral commerce adapters and reconciliation"
      ],
      partnerOrAdapter: [
        "card networks and money movement",
        "payment processors",
        "tax filing",
        "shipping carriers",
        "marketplace and social distribution APIs",
        "regulated credit underwriting",
        "specialist ERP where required",
        "payment hardware certification"
      ],
      doNotRebuild: [
        "card network",
        "bank",
        "general parcel carrier",
        "tax authority",
        "general-purpose marketplace"
      ]
    })
  });
}

module.exports = {
  SNAPSHOT_DATE,
  REGISTRY_VERSION,
  STATUS,
  CHANNELS,
  CANONICAL_COMMERCE_GRAPH,
  INVARIANTS,
  MARKET_SIGNALS,
  BENCHMARKS,
  ROADMAP,
  AGENT_POLICY,
  FORMULAS,
  availableToPromise,
  commerceReadinessScore,
  getCommerceMarketRadar2026
};
