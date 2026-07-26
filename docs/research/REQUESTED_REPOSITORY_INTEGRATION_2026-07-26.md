# Requested Repository Integration Review — 2026-07-26

## Decision

SONARA now contains a governed intake layer for the ten repositories requested from the supplied social-media screenshots. The implementation records verified sources, corrected repository identities, product placement, license posture, safety boundaries, staged next actions, and static readiness.

This change does **not** blindly clone, vendor, install, or execute third-party code inside the production website. That would be unsafe and architecturally wrong for desktop applications, coding agents, document binaries, experimental skill libraries, and penetration-testing tools.

## Source verification

| Requested source | Verified source | Decision | SONARA placement |
|---|---|---|---|
| `OpenHands/OpenHands` | `OpenHands/OpenHands` | Verified; developer-only pilot | Isolated development control plane |
| `JuliusBrussee/caveman` | `JuliusBrussee/caveman` | Verified; reference profile | Prompt Library / developer tooling |
| `sonoisa/agency-agents` | `msitarzewski/agency-agents` | Corrected | Curated role templates only |
| `Zackriya-Solutions/meetily` | `Zackriya-Solutions/meetily` | Verified | Local desktop companion and explicit import |
| `nicobrenner/officecli` | `iOfficeAI/OfficeCLI` | Corrected | Isolated artifact worker |
| `nicosxt/openwiki` | `langchain-ai/openwiki` | Corrected | Development documentation worker |
| `omniroute/omniroute` | None verified | Blocked | Research intake only |
| `strixsec/strix` | `usestrix/strix` | Corrected; high-risk | Authorized staging security pipeline only |
| `plurigrid/asi` | `plurigrid/asi` | Verified; quarantined | Individually allowlisted skill concepts |
| `nicosxt/awesome-design-md` | None verified | Blocked | Replace with SONARA-owned templates |

## Implemented surfaces

- `lib/sonara-requested-repository-registry.cjs`
  - authoritative static registry;
  - corrected source identities;
  - product fit and runtime class;
  - license and security posture;
  - blocked uses and human-review requirements;
  - no credentials or executable commands.
- `routes/sonara-requested-repositories-routes.cjs`
  - `GET /api/ecosystem/requested-repositories`;
  - `GET /research-lab/requested-repositories`;
  - admin-protected readiness JSON and control-plane page.
- `scripts/apply-requested-repository-suite.cjs`
  - idempotent registration into the Express runtime.
- `supabase/migrations/20260726170000_requested_repository_catalog.sql`
  - non-secret metadata in the existing open-source and integration registries;
  - all execution flags remain false;
  - unverified sources are disabled.
- `tests/requested-repository-suite.test.js`
  - source corrections;
  - blocked sources;
  - non-execution guarantees;
  - public catalog behavior;
  - admin authentication boundary.

## Integration architecture

### Tier 1 — safe reference adoption

1. **Caveman**
   - Recreate the useful brevity concept as a SONARA-owned prompt profile.
   - Benchmark total token cost, answer quality, and failure cases.
   - Never compress required legal, safety, financial, or operational detail.
2. **Agency Agents**
   - Review and adapt only a small role allowlist.
   - Initial candidates: code reviewer, technical writer, database optimizer, accessibility specialist, and incident commander.
3. **ASI Agent Skills**
   - Use only as quarantined research.
   - Rewrite selected concepts into minimal SONARA-owned skills after individual review.

### Tier 2 — isolated workers and companions

1. **OfficeCLI**
   - Queue-backed container or worker.
   - Per-job temporary directories, MIME/extension validation, file-size limits, malware scanning, and command allowlists.
   - Never run inside the Vercel request process.
2. **Meetily**
   - Remains a local desktop application.
   - SONARA accepts only explicit user-approved transcript or summary imports.
   - Recording consent and tenant isolation are mandatory.
3. **OpenWiki**
   - Code mode only on a disposable documentation branch.
   - Personal Gmail, Slack, Notion, X, and web-search connectors remain disabled.
   - Generated documentation must arrive through a reviewable pull request.
4. **OpenHands**
   - Dedicated sandbox or development machine.
   - Begin with read-only repository tasks.
   - Patch creation requires review; merge, deployment, deletion, billing, and secret changes require explicit human approval.

### Tier 3 — restricted security pipeline

**Strix** may be evaluated only against SONARA-owned or explicitly authorized targets in an isolated staging environment. Requirements include target allowlists, network egress restrictions, non-production credentials, rate limits, complete audit logs, and human validation of every finding, proof-of-concept, patch, and CI decision.

### Blocked

- **OmniRoute**: the supplied repository and claimed navigation-engine performance could not be verified.
- **Awesome Design MD**: the supplied repository and license could not be verified.

Neither source may be cloned, copied, marketed, or executed until an authoritative project source, license, ownership, and security posture are established.

## Production boundary

The production website remains an Express/Vercel application backed by its existing Supabase, Stripe, and Resend contracts. Third-party coding agents, desktop applications, document binaries, autonomous skill libraries, and offensive-security tools do not belong in the synchronous customer request path. They must operate through isolated, authenticated, audited workers or controlled development environments with graceful failure and human approval.

## Staged rollout

1. Merge the governed catalog and public/admin visibility surfaces.
2. Apply the Supabase metadata migration.
3. Pilot the SONARA-owned concise-output profile and five curated agent roles.
4. Prototype the OfficeCLI artifact-worker contract with deterministic test files.
5. Test OpenWiki code mode on a disposable documentation branch.
6. Evaluate OpenHands with read-only repository permissions.
7. Evaluate Meetily through explicit local export/import.
8. Run Strix only after written rules of engagement for a staging target.
9. Keep ASI quarantined until individual skills pass review.
10. Revisit blocked sources only when authoritative URLs are supplied.
