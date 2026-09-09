# Completion pathway and Claude handoff

9 September 2026. Base synchronized with origin/main ddac658e; preserve the
original dirty checkout. Work occurs on codex/launch-reconciliation-20260906.

## Usage before implementation

Account snapshot: 27% consumed in the five-hour window, 36% in the weekly
window, zero reset credits. This is shared account usage, not a token budget.
There is no defensible conversion to remaining engineering hours. No guarantee
can be made that all proposed products fit this allowance.

Planning allocation, not a usage prediction: 15% discovery, 45% narrow repairs,
25% verification, 15% handoff/reserve. Check account usage between milestones;
avoid duplicate agents and repeated full suites on unchanged source. Stop
expanding scope when verification/handoff would consume the reserve. Do not
stop a necessary test merely to describe unfinished work as complete.

## Ordered work and acceptance evidence

1. Reconcile main and Claude, preserve local work, install frozen lockfile,
   run root launch gate. Fix reproducible failures without lowering assertions.
2. Pricing: follow docs/owner/PRICING-STEP-BY-STEP.md. Match advertised amount,
   currency, interval and entitlement to real Stripe prices. Owner approves
   account changes and a live purchase; redirect alone never unlocks access.
3. Database/storage/table editor: schema replay, tenant authorization, denied
   cross-tenant reads/writes, private download expiry, and restore evidence.
   Supabase remains authoritative; R2/D1 are optional adapters, not a migration.
4. Modules/formulas/workflows: pick one customer journey per change. Demonstrate
   real persistence and failure recovery, validate formula inputs/results,
   require approval for external side effects, and retain audit references.
5. Distribution/SEO: check public route/canonical/sitemap alignment, crawlable
   factual product copy, structured-data truth, and consent-safe campaign drafts.
6. Design/3D: first measure current mobile overflow, keyboard use, load cost and
   conversion obstacles. Prototype one optional scene with static fallback,
   reduced motion and desktop/mobile screenshots. No heavy runtime replacement.
7. Business model: measure fulfilled paid workflows and provider unit costs.
   Forecast only from explicit traffic, conversion, retention and margin inputs;
   no readiness percentage or earnings guarantee derived from file counts.
8. Commit reviewed changes, push a review branch, merge only after required CI.
   Deployment and paid-live proof are separate from a successful local suite.

## Photo work carried forward

See PHOTO_REPOSITORY_INTAKE_20260908.md. Later close-ups confirm
obra/superpowers, cporter202/vibe-coding-with-base44,
cporter202/job-data-apis-and-scrapers, cporter202/awesome-ai-tools,
cporter202/lovable-for-beginners, vercel/next.js and facebook/react.
These do not authorize replacing Express or installing every dependency.
The 26-skills poster points at claude-skills.free; package identity, source and
licensing still need verification. RAG/product/system posters describe ideas,
not installed packages. Stock promotion is not an engineering dependency.

## Claude next step

Local checkpoint: frozen install, moderate audit, diff check and verify:launch
all exited 0. JavaScript coverage reported 92.1%; Python ran 97 tests with
52.5% measured coverage and 21 unmeasured files needing optional dependencies.
PostgreSQL replay skipped because binaries were absent. Live Stripe prices were
not compared because a key was unavailable. These are explicit verification
limits, not production passes. Seven repository skills pass provenance checks.

Read all .ai/shared files, this document, latest docs/HANDOFF_PROMPT.md and Git
history. Recheck origin/main before edits. Do not reapply the superseded database
repair stash wholesale: main already contains the service-role grant and review
table fixes. Verify live claims independently. Keep provider secrets out of
logs and distinguish mocked, local, preview and production evidence.
