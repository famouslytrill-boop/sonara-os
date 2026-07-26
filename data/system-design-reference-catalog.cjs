"use strict";

const SYSTEM_DESIGN_REFERENCE_SOURCE = Object.freeze({
  id: "liquidslr-system-design-notes",
  name: "system-design-notes",
  owner: "liquidslr",
  repository: "liquidslr/system-design-notes",
  repositoryUrl: "https://github.com/liquidslr/system-design-notes",
  defaultBranch: "main",
  pinnedCommit: "aa7ac69e206bca659020baa5954bb65cfd70ab99",
  upstreamTopicCount: 28,
  upstreamType: "educational notes and diagrams",
  upstreamAttribution: "Notes derived from System Design Interview - An Insider's Guide, Volumes 1 and 2.",
  licenseStatus: "no_license_file_detected",
  rightsStatus: "reference_only",
  commercialUseStatus: "blocked_from_code_or_asset_copying",
  integrationMode: "topic_index_and_original_sonara_mapping_only",
  remoteRuntimeDependency: false,
  copiedUpstreamContent: false,
  reviewedAt: "2026-07-26",
  governance: Object.freeze([
    "Do not copy upstream chapter text, diagrams, screenshots, or book-derived assets into SONARA.",
    "Use only topic names, public repository metadata, and original SONARA architecture mappings.",
    "Do not treat educational examples as production-ready designs without threat, cost, failure, and tenant-isolation review.",
    "Keep the upstream repository outside the production dependency graph and customer request path.",
    "Record owner/admin review before architecture recommendations become implementation work."
  ])
});

const SYSTEM_DESIGN_PATTERNS = Object.freeze([
  pattern(1, "scaling", "Scaling and capacity", "platform_foundation", [
    "SONARA core runtime", "Vercel deployment", "Supabase data tier", "Worker infrastructure"
  ], ["scale", "capacity", "traffic", "latency", "load balancing", "cache", "cdn", "stateless"], [
    "Define expected active users, peak requests, storage growth, and background-job volume.",
    "Separate stateless request handling from durable state and long-running work.",
    "Document the first bottleneck, rollback path, and scale trigger before adding infrastructure."
  ], ["Do not shard or add distributed services before measured need.", "Keep tenant isolation intact while scaling."], "active_reference"),

  pattern(2, "back-of-envelope-estimation", "Back-of-the-envelope estimation", "planning", [
    "Performance Planner", "Cost Planner", "Launch Readiness", "Capacity Review"
  ], ["estimate", "throughput", "storage", "bandwidth", "cost", "requests per second", "retention"], [
    "Estimate peak and average throughput separately.",
    "Calculate storage, egress, queue depth, and provider cost from explicit assumptions.",
    "Record uncertainty ranges instead of presenting false precision."
  ], ["Do not publish unsupported capacity or cost claims."], "active_reference"),

  pattern(3, "system-design-framework", "System design review framework", "governance", [
    "Architecture Intelligence", "Admin Command Center", "Module Launch Review"
  ], ["requirements", "constraints", "api", "data model", "failure modes", "tradeoffs", "architecture review"], [
    "Clarify functional and non-functional requirements before selecting components.",
    "Define APIs, data ownership, permissions, failure modes, observability, and rollback.",
    "Separate required launch scope from future scale options."
  ], ["No architecture is approved without security, data, cost, and operational ownership."], "active_reference"),

  pattern(4, "rate-limiter", "Rate limiting and abuse controls", "edge_security", [
    "Public APIs", "Authentication", "Stripe webhooks", "Resend dispatch", "Research intake"
  ], ["rate limit", "throttle", "quota", "burst", "abuse", "webhook", "api gateway"], [
    "Choose limits by actor, organization, route, and provider boundary.",
    "Define burst handling, retry guidance, and observable rejection reasons.",
    "Protect webhook, login, email, upload, and research endpoints independently."
  ], ["Do not share rate-limit buckets across tenants.", "Do not hide throttling failures from operators."], "active_reference"),

  pattern(5, "consistent-hashing", "Consistent routing and partition ownership", "distribution", [
    "Worker routing", "Cache partitioning", "Object processing", "Job ownership"
  ], ["consistent hashing", "partition", "shard", "worker routing", "rebalance", "hot key"], [
    "Use stable partition keys only when horizontal partitioning is justified.",
    "Plan rebalance behavior, hot-key mitigation, and ownership visibility.",
    "Keep organization boundaries stronger than distribution convenience."
  ], ["Never use a partition key that can mix customer data."], "future_reference"),

  pattern(6, "key-value-store", "Key-value and configuration storage", "data", [
    "Feature flags", "Session metadata", "Readiness cache", "Provider configuration"
  ], ["key value", "cache", "configuration", "session", "feature flag", "ttl", "consistency"], [
    "Define consistency, expiration, eviction, and source-of-truth rules.",
    "Keep secrets out of client-readable configuration stores.",
    "Use durable relational records when auditability or relationships matter."
  ], ["Do not replace Postgres records with an opaque cache without a recovery plan."], "active_reference"),

  pattern(7, "unique-id-generator", "Unique IDs and idempotency", "data_integrity", [
    "Database records", "Webhook events", "Background jobs", "Audit events", "Exports"
  ], ["uuid", "unique id", "idempotency", "event id", "job id", "deduplication"], [
    "Use collision-resistant IDs generated at a trusted boundary.",
    "Define idempotency keys for payments, webhooks, emails, imports, and jobs.",
    "Preserve source IDs when reconciling external systems."
  ], ["Never infer ownership from an ID alone.", "Idempotency must not bypass authorization."], "active_reference"),

  pattern(8, "url-shortener", "Tracked links and redirects", "growth_delivery", [
    "Growth Studio campaigns", "Creator release links", "Business Builder offers"
  ], ["short url", "redirect", "campaign link", "tracking", "slug", "expiration"], [
    "Separate destination ownership, redirect behavior, analytics, and expiration.",
    "Validate destinations and prevent open-redirect abuse.",
    "Make tracking and consent behavior visible to users."
  ], ["No deceptive redirects, cloaking, or unsafe destination schemes."], "future_reference"),

  pattern(9, "web-crawler", "Governed public-source collection", "research", [
    "Market Intelligence", "Research Lab", "Growth Studio public research"
  ], ["crawler", "public source", "robots", "research", "web ingestion", "crawl budget"], [
    "Collect only public or explicitly authorized sources.",
    "Honor robots directives, provider terms, rate limits, and deletion requests.",
    "Store provenance, fetch time, source rights, and extraction confidence."
  ], ["No paywall bypass, credential theft, private-data collection, or platform-rule evasion."], "active_reference"),

  pattern(10, "notification-system", "Notification delivery", "communications", [
    "Resend email", "Admin alerts", "Customer notifications", "Job completion notices"
  ], ["notification", "email", "push", "sms", "delivery", "retry", "preference"], [
    "Separate event creation, user preference, provider dispatch, retry, and delivery status.",
    "Use deduplication and suppression controls.",
    "Expose setup-required states when providers are unavailable."
  ], ["No outbound message without authorization, consent where required, and audit evidence."], "active_reference"),

  pattern(11, "news-feed-system", "Activity and content feeds", "experience", [
    "Workspace activity", "Creator updates", "Growth activity", "Admin audit views"
  ], ["feed", "timeline", "activity", "fanout", "ranking", "pagination"], [
    "Choose chronological or ranked behavior explicitly.",
    "Define tenant-scoped fanout, pagination, retention, and moderation.",
    "Keep durable events separate from personalized presentation."
  ], ["Do not leak cross-tenant activity or create manipulative ranking."], "future_reference"),

  pattern(12, "chat-system", "Conversation and support messaging", "communications", [
    "Support", "Team communication", "Customer conversations", "Agent sessions"
  ], ["chat", "message", "conversation", "presence", "delivery receipt", "moderation"], [
    "Define conversation membership and authorization per message.",
    "Separate message persistence, delivery, presence, attachments, and moderation.",
    "Plan retention, export, deletion, and abuse reporting."
  ], ["No hidden agent impersonation, cross-tenant threads, or unreviewed message sending."], "future_reference"),

  pattern(13, "search-autocomplete", "Search and autocomplete", "discovery", [
    "Command navigation", "Product catalog", "Customer search", "Research search"
  ], ["search", "autocomplete", "prefix", "ranking", "index", "query"], [
    "Separate source records from indexes and suggestions.",
    "Define freshness, typo handling, ranking, access filtering, and empty states.",
    "Apply authorization before results or suggestions are returned."
  ], ["Search indexes must preserve tenant and role boundaries."], "active_reference"),

  pattern(14, "video-platform", "Video ingestion and delivery", "creator_media", [
    "Creator Studio video", "Media analysis workers", "Transcoding jobs", "Asset delivery"
  ], ["video", "upload", "transcode", "stream", "thumbnail", "cdn", "media"], [
    "Separate upload, virus checks, metadata, transcoding, storage, delivery, and rights review.",
    "Use asynchronous jobs for expensive processing.",
    "Define rendition, retention, egress, and failure-recovery policies."
  ], ["No unlicensed media processing, deceptive media, or direct heavy processing in the web request path."], "active_reference"),

  pattern(15, "file-sync-system", "File storage, versioning, and synchronization", "files", [
    "Files & Records", "Creator assets", "Business assets", "Exports", "Supabase Storage"
  ], ["file sync", "drive", "version", "conflict", "upload", "download", "storage"], [
    "Separate file metadata, object bytes, versions, sharing, and synchronization state.",
    "Define conflict resolution, resumable upload, integrity checks, and deletion behavior.",
    "Keep signed access scoped and short lived."
  ], ["No public bucket exposure for private customer files."], "active_reference"),

  pattern(16, "proximity-service", "Location-aware service discovery", "location", [
    "Business Builder service areas", "Local discovery", "Mobile operations"
  ], ["proximity", "nearby", "location", "radius", "geospatial", "service area"], [
    "Use coarse location when precision is unnecessary.",
    "Define search radius, indexing, freshness, and fallback behavior.",
    "Separate business service areas from sensitive user location history."
  ], ["Do not collect continuous precise location without a clear need and consent."], "future_reference"),

  pattern(17, "nearby-presence", "Consent-based presence", "location", [
    "Team availability", "Field operations", "Event collaboration"
  ], ["nearby friends", "presence", "live location", "availability", "consent"], [
    "Treat presence and location as opt-in, time-limited, and revocable.",
    "Define visibility groups and emergency disable controls.",
    "Avoid storing exact history unless operationally required."
  ], ["No covert tracking, surveillance, or default-on precise location sharing."], "blocked_reference"),

  pattern(18, "maps-and-routing", "Maps, routes, and dispatch", "location", [
    "Business routes", "Delivery planning", "Mobile service operations", "Location records"
  ], ["map", "route", "dispatch", "eta", "geocoding", "directions"], [
    "Separate geocoding, route calculation, live status, and provider billing.",
    "Plan degraded behavior when a mapping provider is unavailable.",
    "Store only location data required for the operational purpose."
  ], ["No unsafe routing claims or unrestricted location retention."], "future_reference"),

  pattern(19, "distributed-message-queue", "Durable background-job queues", "workers", [
    "Creator media jobs", "Email dispatch", "Growth provider jobs", "Webhook processing", "Exports"
  ], ["queue", "message", "producer", "consumer", "retry", "dead letter", "background job"], [
    "Define delivery semantics, retries, dead-letter handling, visibility timeout, and idempotency.",
    "Keep job payloads minimal and tenant scoped.",
    "Expose queue lag, failure count, and operator retry controls."
  ], ["No arbitrary shell jobs or unbounded retries from customer input."], "active_reference"),

  pattern(20, "metrics-monitoring-alerting", "Metrics, monitoring, and alerting", "observability", [
    "Admin Command Center", "Launch Readiness", "Runtime monitoring", "Provider health"
  ], ["metrics", "monitoring", "alert", "logging", "slo", "error rate", "latency"], [
    "Define service-level indicators for availability, latency, correctness, and queue health.",
    "Separate logs, metrics, traces, audit events, and user-facing status.",
    "Make alerts actionable with owner, threshold, evidence, and runbook."
  ], ["Do not expose secrets or customer content in logs and alerts."], "active_reference"),

  pattern(21, "event-aggregation", "Consent-safe event aggregation", "analytics", [
    "Growth Studio attribution", "Campaign analytics", "Product usage analytics"
  ], ["event aggregation", "click", "attribution", "analytics", "deduplication", "window"], [
    "Define event schema, source, deduplication key, aggregation window, and late-event handling.",
    "Separate raw events from reporting views.",
    "Document consent, retention, and deletion behavior."
  ], ["No cross-site tracking, hidden fingerprinting, or invented attribution certainty."], "active_reference"),

  pattern(22, "reservation-system", "Bookings, reservations, and capacity holds", "business_operations", [
    "Business Builder bookings", "Appointments", "Resource scheduling", "Inventory holds"
  ], ["reservation", "booking", "appointment", "availability", "hold", "double booking"], [
    "Define availability source, temporary holds, confirmation, cancellation, and expiration.",
    "Use transactions or equivalent concurrency controls to prevent double booking.",
    "Separate customer booking state from payment state."
  ], ["No confirmed availability without a durable capacity check."], "active_reference"),

  pattern(23, "distributed-email-service", "Reliable email service", "communications", [
    "Resend dispatch", "Auth emails", "Campaign email", "Support notifications"
  ], ["distributed email", "email queue", "bounce", "suppression", "template", "delivery"], [
    "Separate template rendering, consent, queueing, provider dispatch, webhook reconciliation, and suppression.",
    "Use stable message IDs and provider event reconciliation.",
    "Expose verified sender and domain readiness."
  ], ["No bulk sending without consent review, unsubscribe handling, and provider compliance."], "active_reference"),

  pattern(24, "object-storage", "Object storage architecture", "storage", [
    "Supabase Storage", "Creator assets", "Business documents", "Exports", "Support attachments"
  ], ["object storage", "s3", "bucket", "signed url", "multipart", "retention"], [
    "Define buckets by data class and access boundary.",
    "Use signed access, content validation, quotas, lifecycle rules, and deletion evidence.",
    "Keep metadata and ownership in durable database records."
  ], ["No public access to private buckets and no executable uploads without validation."], "active_reference"),

  pattern(25, "leaderboard", "Ranked scoreboards", "engagement", [
    "Creator challenges", "Internal performance views", "Optional community programs"
  ], ["leaderboard", "score", "rank", "season", "anti cheat", "aggregation"], [
    "Define score ownership, update frequency, ties, seasons, and correction behavior.",
    "Design anti-abuse and explainability before public ranking.",
    "Prefer private progress views when competition adds little value."
  ], ["No exploitative engagement loops, public employee shaming, or unverifiable scoring."], "future_reference"),

  pattern(26, "payment-system", "Payment processing and reconciliation", "payments", [
    "Stripe Checkout", "Billing Portal", "Webhook reconciliation", "Orders", "Purchases"
  ], ["payment", "checkout", "webhook", "ledger", "refund", "idempotency", "reconciliation"], [
    "Separate order intent, provider checkout, webhook evidence, entitlement, refund, and accounting records.",
    "Treat provider webhooks as the source of truth for payment completion.",
    "Use idempotency and immutable event evidence for every financial transition."
  ], ["No client-declared payment success, secret exposure, or autonomous refund without authorization."], "active_reference"),

  pattern(27, "digital-wallet", "Digital wallet architecture", "regulated_finance", [
    "Future financial research only", "Accounting export research"
  ], ["wallet", "balance", "transfer", "ledger", "stored value", "financial account"], [
    "Require legal, licensing, custody, ledger, fraud, identity, dispute, and reconciliation analysis.",
    "Use a double-entry ledger if any stored-value design is ever approved.",
    "Keep research separate from current Stripe billing functionality."
  ], ["SONARA does not operate a wallet, hold customer funds, or claim banking functionality."], "blocked_reference"),

  pattern(28, "stock-exchange", "Exchange and trading architecture", "regulated_finance", [
    "Research Lab only"
  ], ["stock exchange", "trading", "order book", "matching engine", "market data", "settlement"], [
    "Treat matching, custody, market data, surveillance, settlement, and regulation as separate systems.",
    "Require specialist legal and security review before any financial-market functionality.",
    "Keep this topic out of customer-facing production modules."
  ], ["No trading, brokerage, securities execution, custody, or investment claims."], "blocked_reference")
]);

function pattern(order, slug, title, domain, sonaraModules, keywords, reviewQuestions, guardrails, status) {
  return Object.freeze({
    order,
    slug,
    title,
    domain,
    status,
    sonaraModules: Object.freeze(sonaraModules),
    keywords: Object.freeze(keywords),
    reviewQuestions: Object.freeze(reviewQuestions),
    guardrails: Object.freeze(guardrails),
    sourceReference: Object.freeze({
      sourceId: SYSTEM_DESIGN_REFERENCE_SOURCE.id,
      upstreamTopicNumber: order,
      copiedContent: false
    })
  });
}

function getSystemDesignPattern(slug) {
  return SYSTEM_DESIGN_PATTERNS.find((item) => item.slug === slug) || null;
}

module.exports = {
  SYSTEM_DESIGN_REFERENCE_SOURCE,
  SYSTEM_DESIGN_PATTERNS,
  getSystemDesignPattern
};
