"use strict";

// Batch 11 screenshot intake, 16 September 2026. Evidence and planning data
// only: nothing here is installed, imported, executed or given a secret.
//
// **It is batch 10 and not batch 8, and the gap is deliberate.** The screenshot
// radar modules run batch2 through batch7, which makes 8 the obvious next
// number and the wrong one: `getCombinedReadiness` in
// routes/sonara-requested-repositories-routes.cjs already publishes
// `capabilityBatch8` and `designBatch9`, and the founder-facing card in that
// same file already tells a reader "Batches 8 and 9 are separate internal
// convergence records". Reusing 8 here would put two different things behind
// one label in a catalog whose whole purpose is that its labels are checkable.
// So this continues the combined numbering rather than the file-name sequence.
//
// Seven batches of screenshots arrived across one hold -- 68 images, eight
// files and one pasted research block. This module records what survived
// verification. Most of the intake did not, and the reasons are the useful part.
//
// **What is different about this batch.** Every licence below was read from a
// `git clone --depth 1` on 16 September 2026, and `evidence` carries the file
// count that clone produced. That field exists because of how batch 7 decides
// the same question:
//
//   repositoryVerified: !/reported in submitted screenshot|requires authoritative/.test(input.license)
//
// which derives "somebody verified this" from the absence of two phrases in a
// prose string. A record whose licence text happens not to contain either
// phrase claims verification nobody performed. Here `repositoryVerified` is set
// from `evidence`, and `getScreenshotToolReadinessBatch11` refuses to count a
// record as verified without one.
//
// **Three descriptions did not survive measurement**, which is this batch's
// recurring theme and the reason the skill says to count rather than describe:
//
//   - `ran-isenberg/awesome-serverless-blueprints` was submitted as
//     "production-ready architectural blueprints using the AWS CDK ... clean
//     architecture, rigorous testing patterns, Rust-based Lambda resolvers".
//     Measured: 13 files, of which exactly one is content (README.md). The
//     description belongs to the repositories it links to.
//   - `brandonhimpfen/awesome-serverless` was submitted as "a curated
//     directory". Measured: 20 files, no licence file of any kind. No licence
//     is not a permissive licence; it is all rights reserved.
//   - `beekeeper-studio` reached us through a Google snippet calling it "an
//     open-source, cross-platform SQL editor". Measured: GPL-3.0 for the
//     community edition, plus a commercial EULA governing everything under a
//     `src-commercial` directory. Partly proprietary, and the snippet says so
//     nowhere.
//
// **One licence would have been read wrongly from its first line.**
// `aws-samples/serverless-samples` opens "Copyright Amazon.com, Inc. or its
// affiliates. All Rights Reserved." Reading only that would record it as
// closed. The body grants use without restriction and, checked by grep, omits
// the "above copyright notice ... shall be included" clause entirely -- so it
// is MIT-0 rather than MIT. The difference is whether attribution is required.
//
// **Four leads were already recorded and are deduplicated rather than
// re-entered**, and the independent re-measurement agreed with all four:
// `owasp-noir/noir` (MIT), `volcengine/OpenViking` (AGPL-3.0),
// `simplifaisoul/osiris` (MIT licence, blocked on conduct) and
// `kamranahmedse/developer-roadmap` (custom personal-use-only). The
// developer-roadmap record even notes that its licence file is lowercase
// `license`, which is why a `LICENSE`/`LICENSE.md` fetch 404s and a quick check
// concludes there is none -- the same trap this session hit before reading that
// note. A repository with two verdicts has none, so these keep theirs.

const REPOSITORIES = [
  {
    key: "claude_bughunter",
    label: "Claude BugHunter",
    repository: "elementalsouls/Claude-BugHunter",
    license: "MIT for code; CC BY 4.0 for content, split by file type",
    licenseRisk: "medium",
    reciprocalLicense: false,
    role: "authorized vulnerability-hunting skill bundle",
    productFit: ["Authorized Security Lab", "Internal development"],
    integrationStatus: "research_only",
    evidence:
      "Cloned 16 September 2026: 298 files, LICENSE is MIT (Copyright (c) 2026 Sachin Sharma), LICENSE-CONTENT is CC BY 4.0. The README states the boundary rather than leaving it to be guessed: *.py, *.sh and other source are MIT; *.md documentation, wordlists, regex catalogs and rubrics are CC BY 4.0.",
    note:
      "Two licences over one repository is normally the warning sign that a record has no verdict. This is the legitimate version of it -- the split is by file type, documented upstream, and the two do not overlap. What it means in practice is that adapting the methodology, wordlists or severity rubrics carries an attribution obligation the MIT half does not, and that obligation is easy to lose when an idea is paraphrased into a SONARA skill.",
    nextStep:
      "If any of this is adapted, attribute the CC BY 4.0 content explicitly. Scanning stays limited to SONARA-owned or explicitly authorized targets; the 681 vulnerability patterns are a reading list for hardening our own routes, not a licence to point anything outward."
  },
  {
    key: "beekeeper_studio",
    label: "Beekeeper Studio",
    repository: "beekeeper-studio/beekeeper-studio",
    license: "Mixed: GPL-3.0 community edition; commercial EULA for **/src-commercial",
    licenseRisk: "high",
    reciprocalLicense: true,
    role: "cross-platform SQL editor and database manager",
    productFit: ["Internal development"],
    integrationStatus: "developer_only",
    evidence:
      "Cloned 16 September 2026: 1,865 files. LICENSE.md is the GNU General Public License version 3 for the Community Edition; LICENSE-COMMERCIAL.md governs files under src-commercial directories, of which the clone contains one, and points at beekeeperstudio.io/legal/commercial-eula.",
    note:
      "Arrived as a Google snippet calling it open source. It is open source and also partly not, and the distinction is the whole reason this register exists. Nothing about it would reach SONARA's runtime in any case: this application talks to Supabase over PostgREST and has one production dependency, so a desktop SQL client is a tool somebody runs on their own machine.",
    nextStep:
      "Usable as a local developer client under the community licence. Never bundled, never shipped, and no source from either half copied into this repository."
  },
  {
    key: "serverless_examples",
    label: "Serverless Examples",
    repository: "serverless/examples",
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    role: "Serverless Framework boilerplate collection",
    productFit: ["Research Lab", "Internal development"],
    integrationStatus: "curated_reference",
    evidence:
      "Cloned 16 September 2026: 1,095 files, 149 markdown, 105 top-level directories, LICENSE.txt is MIT. Tip commit dated 2026-09-09, so actively maintained.",
    note:
      "The most useful thing in the pasted serverless research, and useful as reading rather than as a dependency. Every pattern in it is shaped around AWS Lambda, SAM or CDK; this product is one Express 4 application on Vercel with a documented 300-second function lifetime. The two shapes worth studying are the event-driven file pipeline and the queue consumer -- the second is directly relevant to the campaign send that still cannot exceed one request's worth of recipients.",
    nextStep:
      "Read the queue-consumer examples against the >1,000-recipient campaign gap. Take the shape, not the framework: adding a Lambda toolchain to a single-dependency Express application would cost more than the problem."
  },
  {
    key: "localstack_serverless_examples",
    label: "LocalStack Serverless Examples",
    repository: "localstack/serverless-examples",
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    role: "Serverless Framework examples, LocalStack fork",
    productFit: ["Research Lab"],
    integrationStatus: "curated_reference",
    evidence:
      "Cloned 16 September 2026: 774 files, 96 markdown, 105 top-level directories of which 63 are shared with serverless/examples and 42 are unique to each. LICENSE.txt is MIT. Tip commit dated 2020-04-26.",
    note:
      "Recorded separately from serverless/examples rather than merged into it, because the pasted research described the two in almost identical words and that would have produced one record for two divergent bodies of work. Measured: they share 63 of 105 directories and each holds 42 the other does not, and this one's newest commit is from April 2020. Six years without a commit is the fact that decides it -- an examples repository for a fast-moving cloud API is a snapshot of an old API.",
    nextStep:
      "Prefer serverless/examples. Consult this one only where it holds one of its 42 unique directories, and treat any API surface in it as six years stale."
  },
  {
    key: "aws_serverless_samples",
    label: "AWS Serverless Samples",
    repository: "aws-samples/serverless-samples",
    license: "MIT-0 (MIT with no attribution clause)",
    licenseRisk: "low",
    reciprocalLicense: false,
    role: "first-party AWS serverless application samples",
    productFit: ["Research Lab", "Internal development"],
    integrationStatus: "curated_reference",
    evidence:
      "Cloned 16 September 2026: 1,193 files, 118 markdown. LICENSE opens \"Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.\" and then grants use without restriction. Checked by grep: it contains no \"above copyright notice\" clause, which is what makes it MIT-0 rather than MIT.",
    note:
      "The clearest small lesson in this batch about reading a licence rather than skimming it. The first line says All Rights Reserved and the record would have been wrong. MIT-0 is more permissive than MIT, not less: no attribution is required at all.",
    nextStep:
      "Use as the first-party reference for how AWS itself structures these patterns, and prefer it over third-party blog diagrams of the same thing."
  },
  {
    key: "awesome_serverless_blueprints",
    label: "Awesome Serverless Blueprints",
    repository: "ran-isenberg/awesome-serverless-blueprints",
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    role: "link index of serverless blueprint repositories",
    productFit: ["Research Lab"],
    integrationStatus: "reference_only",
    evidence:
      "Cloned 16 September 2026: 13 files total. Of those, exactly one is content -- README.md. The rest are LICENSE, CODEOWNERS, a Makefile, package.json, package-lock.json, .markdownlint.yaml, CONTRIBUTING.md, CODE_OF_CONDUCT.md and three GitHub workflow files that lint the list and handle submissions.",
    note:
      "Submitted as production-ready CDK blueprints with clean architecture, rigorous testing patterns and Rust-based Lambda resolvers. There is no CDK code, no test code and no Rust in it. That description belongs to the repositories the README links to, and mattered because it is the difference between 'a dependency to evaluate' and 'a page of links'. Reference-only as a measured fact rather than as a caution: there is nothing here to take.",
    nextStep:
      "Treat as an index. Anything reached through it gets its own licence read, because an MIT list says nothing about what it points at."
  },
  {
    key: "awesome_serverless_himpfen",
    label: "Awesome Serverless (Himpfen)",
    repository: "brandonhimpfen/awesome-serverless",
    license: "NONE DECLARED -- all rights reserved",
    licenseRisk: "high",
    reciprocalLicense: false,
    role: "link directory of serverless frameworks and tools",
    productFit: ["Research Lab"],
    integrationStatus: "reference_only_no_license",
    evidence:
      "Cloned 16 September 2026: 20 files, and no LICENSE, LICENCE or COPYING file at the repository root. Contents are README.md, awesome-lists.json, CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, two link-checking Python scripts, lychee.toml and GitHub workflow and issue-template files.",
    note:
      "The absence of a licence is not permission, and nobody here can grant what its author has not. Recorded rather than dropped: the finding that this is unlicensed is worth keeping so the next person meeting it does not repeat the check. Nothing from it may be copied, including the list itself.",
    nextStep:
      "Read in a browser if useful. Copy nothing. Revisit only if the author publishes terms."
  },
  {
    key: "ninety_days_cybersecurity",
    label: "90DaysOfCyberSecurity",
    repository: "farhanashrafdev/90DaysOfCyberSecurity",
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    role: "structured security learning path",
    productFit: ["Internal development"],
    integrationStatus: "reference_only",
    evidence:
      "Cloned 16 September 2026: 12 files, all markdown -- README.md, learn.md, seven translations and .all-contributorsrc. License.md carries the full MIT grant, with the copyright line left as the unfilled template \"Copyright (c) [2023] [farhanashrafdev]\".",
    note:
      "There is no code in it, so reference-only is a measurement rather than a precaution. The unfilled bracket placeholders in the copyright line do not weaken the grant -- the permission text is complete and the owner is identifiable from the repository -- but they are worth noting rather than silently normalising.",
    nextStep:
      "Compare its curriculum against the twelve security domains taken from the ByteByteGo intake, and use the comparison to decide what this repository genuinely does not cover."
  },
  {
    key: "adguard_home",
    label: "AdGuard Home",
    repository: "AdguardTeam/AdGuardHome",
    license: "GPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    role: "self-hosted network-wide DNS filtering server",
    productFit: ["Internal development"],
    integrationStatus: "research_only",
    evidence: "Cloned 16 September 2026: 1,818 files, LICENSE.txt is the GNU General Public License version 3, 29 June 2007.",
    note:
      "A DNS server is not something a Vercel function can host -- it needs a long-lived process holding a port, which is the boundary docs/architecture/EXTERNAL-SERVICES.md exists to state. GPL-3.0 also puts it firmly outside anything that could be linked into a hosted product.",
    nextStep: "No product path. Keep the record so the licence and the runtime shape do not have to be established twice."
  },
  {
    key: "iptv_org",
    label: "iptv-org/iptv",
    repository: "iptv-org/iptv",
    license: "Unlicense (public domain) for the repository; NOT for the streams it lists",
    licenseRisk: "high",
    reciprocalLicense: false,
    role: "public directory of IPTV stream URLs",
    productFit: [],
    integrationStatus: "blocked",
    evidence:
      "Cloned 16 September 2026: 564 files. LICENSE reads \"This is free and unencumbered software released into the public domain.\" -- the Unlicense, which covers the lists and tooling in the repository.",
    note:
      "The clearest instance in this batch of the rule that a tool's licence says nothing about the rights in what you feed it. The Unlicense disclaims the maintainers' own rights in their list. It cannot and does not grant anything in the broadcast streams the list points at, which belong to their broadcasters. Blocked on rights rather than on the licence, and there is no SONARA product this belongs to in any case.",
    nextStep: "None. Recorded so the distinction between the list's licence and the streams' rights is written down once."
  }
];

// Conduct refusals.
//
// New in this batch, and the reason it is a separate list rather than more
// `integrationStatus: "blocked"` rows: every entry below is refused for what
// using it would *do*, not for what its licence says. Three of them are
// permissively licensed. Filing them as licence problems would misdescribe them
// and, worse, would suggest that a relicence could unblock them.
const CONDUCT_REFUSALS = Object.freeze([
  Object.freeze({
    key: "people_search_osint",
    label: "Email and username OSINT suites",
    observed: "A 2-in-1 OSINT suite advertising 295+ scan vectors across email and username signals, with breach-database lookup, and a real-time OSINT dashboard aggregating flight tracking, CCTV, satellites and Telegram.",
    refusedBecause:
      "AGENTS.md permits security tooling only against systems SONARA owns or is explicitly authorized to assess. These target people, and the target of an email-or-username sweep is by construction somebody who did not ask to be swept. Both are MIT, which changes nothing.",
    relicensingWouldNotHelp: true
  }),
  Object.freeze({
    key: "provenance_stripping",
    label: "Watermark and metadata removers",
    observed: "A tool for removing watermarks and stripping embedded provenance marks from images.",
    refusedBecause:
      "AGENTS.md requires SONARA to *enforce* provenance, consent and anti-clone safety. Creator Studio's whole claim is that a customer can prove authorship of their own work. Shipping the ability to remove that proof would contradict the product, and the content fed to such a tool is somebody else's by assumption.",
    relicensingWouldNotHelp: true
  }),
  Object.freeze({
    key: "provider_boundary_bypass",
    label: "Routing a coding agent through a chat web session",
    observed: "A launcher that routes a coding agent's model calls through a consumer chat web session, advertised as needing no separate API key and as still counting against the chat quota.",
    refusedBecause:
      "It works by using a consumer session in place of the API the provider sells, which is a terms question before it is a technical one. It also bypasses Provider Gateway, which AGENTS.md makes the boundary for every model call, and a credential scoped to a person's chat account is not a server-side provider credential.",
    relicensingWouldNotHelp: true
  }),
  Object.freeze({
    key: "detection_evasion",
    label: "Jailbreak and detection-evasion sections of two prompt cheat sheets",
    observed: "Two widely-shared cheat sheets carrying JAILBREAK sections naming DAN, STAN, DUDE, Illegality Mode and Developer Mode, plus \"Avoiding Plagiarism\", \"How to Trick Detection\" and \"Bypass Detection Tools\" tables.",
    refusedBecause:
      "Defeating detection and safety controls is refused on conduct. The remainder of both sheets -- writing styles, role framing, priming patterns -- is unremarkable and already covered by this repository's own skills, so nothing is lost by declining the whole artefact.",
    relicensingWouldNotHelp: true
  }),
  Object.freeze({
    key: "platform_fee_circumvention",
    label: "\"Web paywall to bypass the 30% app store fee\"",
    observed: "A growth-tactics list whose ninth item advises routing purchases to a web paywall to avoid an app store's commission.",
    refusedBecause:
      "This is a platform-rules question rather than a growth tactic, and the platform decides how it lands. SONARA will not ship a pattern whose failure mode is a customer's business losing its store listing. Recorded so the advice is not re-imported as a neutral idea.",
    relicensingWouldNotHelp: false
  })
]);

// Services, vendors and content. A price is not a licence, and none of these
// screenshots carried a price.
const NON_REPOSITORY_REFERENCES_BATCH11 = Object.freeze([
  reference("slang_phone_answering", "Slang", "Paid 24/7 phone answering for restaurants, pitched against voicemail, claiming 1,200+ restaurants", "The closest direct competitor in seven batches: it sells the thing Business Builder's booking side implies -- answer the phone, capture the reservation. Record it in docs/market/ with the claim attributed and dated, and note that its pitch inverts SONARA's own rule that voice and sound stay off unless a customer turns them on."),
  reference("jumpcloud_saas_management", "JumpCloud", "SaaS discovery, shadow-IT visibility and SSO management", "A commercial service. Relevant only as a comparison for how an operations product describes unmanaged tooling."),
  reference("dba_tooling", "Toad Database Administrator and IDERA SQL Server Tools", "Enterprise database administration suites from a Google result", "Proprietary vendor products with no public repository. Neither is reachable from a serverless request process, and this application talks to Supabase over PostgREST."),
  reference("bytebytego_secure_systems", "ByteByteGo secure-systems cheat sheet", "Twelve security domains -- authentication, authorization, encryption, vulnerability, audit and compliance, network, terminal, emergency response, container, API, third-party management, disaster recovery -- advertising a paid 158-page PDF", "The twelve headings are the usable part and the PDF is not ours to take. Compare the headings against what this repository actually enforces; third-party management and disaster recovery currently have no record at all."),
  reference("ionos_product_guide", "IONOS product guide", "Hosting vendor product documentation", "A vendor price list, not a licence or a repository."),
  reference("dxc_cloud_paper", "DXC \"Building software in the cloud\"", "Third-party enterprise white paper supplied as a PDF", "Copyrighted third-party material. Readable; not quotable into SONARA documents beyond short attributed citation."),
  reference("cloud_diagram_tooling", "AWS-backed cloud architecture diagram ebook and tool", "A diagramming product whose screenshot shows per-month cost estimation on an architecture canvas", "A hosted commercial tool. The idea worth keeping is cost annotated directly onto an architecture diagram, which is a Research Lab presentation idea rather than a dependency."),
  reference("ai_sales_vendor_stack", "\"AI Sales Playbook\" vendor stack", "Twenty-four named commercial vendors across prospecting, outreach, conversation intelligence, CRM and forecasting", "A vendor census, useful to docs/market/ as a list of who occupies the space. Not one of the twenty-four carried a price in the screenshot, so none can become a figure in docs/pricing/, which requires a dated source per number. No third-party brand appears in customer-facing copy as an endorsement."),
  reference("serverless_case_study_claims", "Serverless case-study figures", "Vendor-blog claims including \"operational costs cut by 65%\", \"over 1 billion daily requests\" and \"zero idle cost\", attributed to Coca-Cola, BMW, Netflix, iRobot, Major League Baseball, The New York Times, FINRA and Nordstrom", "Quotable as attributed claims; not usable as figures. Each traces to a marketing blog citing another marketing blog, which does not meet the dated-primary-source rule docs/market/ and docs/pricing/ apply."),
  reference("website_prompt_series", "Eight-part website prompt series", "Plan, homepage structure, homepage copy, visual style, landing page in code, services page, About page, SEO content", "No licence surface and substantial overlap with skills already in this repository. Two lines in it cut against SONARA's own rules and are the reason it is recorded rather than adopted wholesale: copy \"impossible to confuse with AI-generated content\", and \"publish-ready copy in minutes\". Copy produced this way passes the same gates as copy a person wrote."),
  reference("ai_video_style_lists", "AI video style catalogues", "Two lists totalling forty-odd named visual styles", "Roughly a third name a studio or a property directly. Those cannot be used as style instructions in a product that enforces an anti-clone rule, and no third-party brand belongs in customer-facing copy. The generic entries -- paper craft, ink wash, isometric, low poly, chalkboard -- carry no such problem."),
  reference("agent_inspection_harness", "Agent inspection harness (name unresolved)", "A claim of 32 repeatable inspections run against any agent, surfacing where behaviour drifts from expected alignment and tracking it over time", "The most interesting idea in the whole intake and the least resolvable: it arrived as a screen recording of a social post inside another screenshot, and no owner or repository can be established from those pixels. The idea sits directly beside lib/sonara-agent-authority.cjs and the falsification discipline in .claude/skills/checks-that-cannot-lie. Establish the upstream before anything else; guessing an owner into a permanent register is the one thing the intake skill forbids outright."),
  reference("legacy_reference_material", "Prompt packs, ERP prompt lists, page-niche lists, handbook template, learning roadmaps", "Bulk content artefacts across seven batches", "No repository, no licence surface, and heavy overlap with material this repository already holds. Kept as one line rather than a record each, because a register entry per screenshot makes the register harder to read without making it more true."),
  reference("misfiled_personal_files", "An invoice PDF and a 2012 gang-codes PDF", "Two files that arrived inside the batch with no product context", "Neither was opened, extracted, quoted or committed. An invoice is a financial record and the second has no business use here. Flagged back to the owner as probably misfiled; no content from either enters this repository.")
]);

function reference(key, label, observedTheme, nextStep) {
  return Object.freeze({
    key,
    label,
    status: "unverified_or_non_repository_reference",
    observedTheme,
    reason: "A verified service, vendor or content artefact is not an executable repository record. A hosted service with a free tier is a price, not a licence.",
    placement: "Research Lab and product-planning backlog",
    safety: ["No code, credentials, customer data, or runtime authority is granted by this record."],
    nextStep
  });
}

// Deduplicated on purpose, with the re-measurement that confirmed each one.
// Recorded rather than dropped: "checked again and it still says what it said"
// is evidence, and a reader who cannot see that a second reading happened will
// do it a third time.
const CONFIRMED_EXISTING_RECORDS = Object.freeze([
  Object.freeze({ repository: "owasp-noir/noir", registerSays: "MIT", reReadSays: "MIT, Copyright (c) 2022 HAHWUL", agrees: true, added: "Cloned 16 September 2026: 5,120 files. shard.yml gives version 1.3.1 and requires Crystal ~> 1.19 -- it is a compiled Crystal binary, which is why it cannot run inside the Vercel request process whatever its licence permits. Its premise, hunting every endpoint in the source to expose shadow APIs, is what prompted scripts/verify-route-surface.mjs: a SONARA-owned implementation of the idea rather than a dependency." }),
  Object.freeze({ repository: "volcengine/OpenViking", registerSays: "AGPL-3.0, reciprocal, high risk", reReadSays: "GNU Affero General Public License version 3", agrees: true, added: "Cloned 16 September 2026: 4,156 files, with Cargo.toml, a Dockerfile and a Caddyfile -- it is a hosted Rust service, which is precisely the deployment shape an AGPL network-use term is written for." }),
  Object.freeze({ repository: "simplifaisoul/osiris", registerSays: "MIT, blocked", reReadSays: "MIT License, Copyright (c) 2026 simplifaisoul", agrees: true, added: "Cloned 16 September 2026: 924 files. The existing record blocks it while recording a permissive licence, which is the correct shape: the refusal is on conduct, and no relicence would lift it." }),
  Object.freeze({ repository: "kamranahmedse/developer-roadmap", registerSays: "Custom: personal use only, no republication; critical; blocked", reReadSays: "Custom licence confirmed verbatim: personal use permitted, publishing the images, project files or content in any form not permitted without prior consent", agrees: true, added: "Cloned 16 September 2026: 10,677 files. The existing record notes the licence file is lowercase `license`, which is why a LICENSE or LICENSE.md fetch 404s and a quick check concludes there is no licence at all -- exactly the trap hit again here before that note was read." })
]);

const SCREENSHOT_TOOL_RADAR_BATCH11 = Object.freeze(REPOSITORIES.map((input) => Object.freeze({
  ...input,
  // Set from evidence, never from the shape of the licence string. A record with
  // no measurement is not verified, whatever its licence text happens to say.
  repositoryVerified: Boolean(input.evidence && input.evidence.length > 40),
  repoUrl: `https://github.com/${input.repository}`,
  runtimeClass: input.role.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
  integrationMode: "governed_research_record",
  placement: input.productFit.length ? input.productFit.join(", ") : "Research Lab only",
  capabilities: Object.freeze([input.role]),
  launchImpact: "optional",
  enabledInProduction: false,
  humanReviewRequired: true,
  licenseReadOn: "2026-09-16",
  safety: Object.freeze([
    "No third-party code executes from this catalog; adoption requires a separate implementation and dependency review.",
    "Every licence in this batch was read from a shallow clone on 16 September 2026, not from a badge, a README claim or a search-result snippet.",
    "Keep secrets, customer data, tenant boundaries, provider terms, cost limits, provenance and rollback controls explicit."
  ]),
  blockedUses: Object.freeze([
    "production execution from the research catalog",
    "unreviewed source adoption",
    "treating a permissive licence on a tool as rights in the material fed to it"
  ]),
  source: "user_submitted_screenshot_research_batch11_2026_09_16"
})));

function getPublicScreenshotToolCatalogBatch11() {
  return SCREENSHOT_TOOL_RADAR_BATCH11.map((item) => ({
    ...item,
    requestedRepository: item.repository,
    requestedRepoUrl: item.repoUrl,
    sourceCorrection: null,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses]
  }));
}

function getNonRepositoryReferencesBatch11() {
  return NON_REPOSITORY_REFERENCES_BATCH11.map((item) => ({ ...item, safety: [...item.safety] }));
}

function getConductRefusalsBatch11() {
  return CONDUCT_REFUSALS.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch11() {
  return CONFIRMED_EXISTING_RECORDS.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch11() {
  const repositories = getPublicScreenshotToolCatalogBatch11().map((item) => ({
    ...item,
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false
  }));
  return {
    ok: true,
    mode: "static_governed_screenshot_research_batch11",
    repositoryCount: repositories.length,
    // Counted from evidence rather than from the absence of a phrase in prose.
    verifiedCount: repositories.filter((item) => item.repositoryVerified && item.evidence).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH11.length,
    conductRefusalCount: CONDUCT_REFUSALS.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch11(),
    conductRefusals: getConductRefusalsBatch11(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch11()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH11,
  NON_REPOSITORY_REFERENCES_BATCH11,
  CONDUCT_REFUSALS,
  CONFIRMED_EXISTING_RECORDS,
  getPublicScreenshotToolCatalogBatch11,
  getNonRepositoryReferencesBatch11,
  getConductRefusalsBatch11,
  getConfirmedExistingRecordsBatch11,
  getScreenshotToolReadinessBatch11
};
