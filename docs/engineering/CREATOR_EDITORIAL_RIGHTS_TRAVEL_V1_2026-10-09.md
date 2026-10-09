# SONARA Creator Studio — Editorial, Writing, Copyright Review and Travel v1
**Prepared:** 2026-10-09 | **Status:** Draft implementation, not deployed

## Engineering approach

New feature branch is based on `main` rather than stacked on the five
pending STEM/CAD branches. This prevents outstanding migrations and CI jobs
from blocking independent creator editorial review.

Existing SONARA Storyboard Builder (`lib/sonara-storyboard-tool.cjs`) is
reused for any selected video runtime. Existing `module_outputs` table is
reused for opt-in saved drafts and subsequent revisions. There is no new
SQL migration, cloud AI model, image/video generator, external licence scan,
geographic provider, booking, publisher or social media connection.

### Six writing modes

| Mode | User-controlled artifact | Automated aid | Deliberate limitation |
| --- | --- | --- | --- |
| Note | Private-to-workspace notes, journal, meeting memo | Word count, limited English corrections | No automatic summarization or publishing |
| Blog | User-authored blog draft with section prompts | Word count, spelling/grammar heuristics, rights inventory | No website publication, automatic SEO guarantee or claim verification |
| Storyboard | Shot plan from user's topic and exact runtime | Existing largest-remainder shot allocator; durations sum exactly | Planning only; no footage generation |
| Vlog | User-entered narration and B-roll outline | Optional timed storyboard and rights reminders | No camera access, location tracking or upload |
| Gaming | Gameplay recap/stream script, community/clip outline | Optional timed storyboard, gameplay/music rights reminders | Does not grant streaming rights, capture gameplay or bypass platform rules |
| Travel | Destination and itinerary journal, user-entered stops/costs | UTC-based trip days, expense sum and verification checklist | No live destination search, advisory feed, routing, reservations or booking |

User-entered source passages can be compared for *exact five-token sequence
overlap*. No web search, registered-work scan or fingerprint database is
contacted, so the result **cannot detect or rule out copyright infringement,
plagiarism or fair use**. The third-party comparison passage is deliberately
excluded from saved input/output and from the user's persistent draft.

Rights inventory stores human-submitted asset name/status and optional
evidence reference. Unknown rights or missing evidence are flagged; even a
claimed public-domain asset remains subject to manual review. A licensed
asset can still trigger a platform claim; none of these statuses is legal
clearance or permission to publish.

The grammar tool uses a small allowlisted English correction set, repeated
word detection, excess spaces and repeated punctuation. It has bounded
finding counts and **never auto-rewrites** the draft. For languages other
than English the server checker explicitly says unsupported. The HTML
textarea has native browser spellcheck enabled so people can select local
suggestions where their browser supports them. A full multilingual grammar
editor remains separate future work.

## Routes and privacy

Server routes registered (disabled by default):
- GET `/creator-studio/editorial` — actual accessible HTML draft form,
  with typed notes/blog/storyboard/vlog/gaming/travel fields and recent
  saved-draft links.
- POST `/creator-studio/editorial/preview` — no-write HTML preview.
- POST `/creator-studio/editorial/save` — explicit save and redirect only
  after the database confirmed an inserted revision.
- GET `/creator-studio/editorial/drafts/:id` — open one saved revision,
  scoped by server-resolved organization, creator product and editorial module.
- POST `/api/creator-studio/editorial/preview` — JSON preview.
- POST `/api/creator-studio/editorial/save` — explicit JSON write requiring
  `X-Sonara-Intent: save-editorial-draft`; cross-site simple HTML forms
  cannot provide this header.
- GET `/api/creator-studio/editorial/drafts` — latest 20 scoped drafts
  with explicit pagination/truncation notice.

All routes require `requireWorkspaceAccess("creator_studio")`.
Write operations additionally require the existing durable-capable
rate limiter (30 requests per hour by hashed IP and account subject).
Browser form POST additionally requires `Sec-Fetch-Site: same-origin`;
same-site-but-cross-origin and missing signal are refused rather than
trusting the user's cookies alone. The existing global Express request-body
limit is 1 MB, while editorial field caps are more restrictive (title 160
characters, body/reference 12,000, asset count 20, stops 20).

`SONARA_EDITORIAL_WORKBENCH_ENABLED=true` is a server-only operator
feature flag and defaults off. No user's form input can change that.
Disabled routes return 404 without storage reads or writes. All routes
set `Cache-Control: no-store`.

The save contract inserts into `public.module_outputs` with
`organization_id` resolved from the authenticated user, constant
`product_key=creator_studio` and `module_key=editorial_workbench`.
List/open queries explicitly filter all three, plus UUID for single
drafts. Existing service-role bypass of RLS is why *every* query must carry
those server-derived filters. Drafts are **workspace-visible**, not
user-only private; only users with valid creator workspace access should
view them. No public link is created or shared by this module. Existing
workspace sharing features remain a separate explicit user action.

Each save creates a **new revision record**, not an unlogged overwrite.
No delete, publish, submit-copyright-takedown, payment, advertisement,
travel booking or external API side effect is wired.

## Research and official sources

- W3C spelling help, G194: suggestions are useful when a person can review
  and select corrections. Built-in support remains limited:
  https://www.w3.org/WAI/WCAG22/Techniques/general/G194
- U.S. Copyright Office fair use case-specific analysis; there is no
  numerical infringement threshold:
  https://copyright.gov/fair-use/
- U.S. Copyright Office FAQ; rights disputes cannot be finally determined
  by a software comparison counter:
  https://www.copyright.gov/help/faq/faq-fairuse.html
- Twitch official music guidance; streamers need relevant music rights,
  and licensed audio may still encounter platform enforcement:
  https://legal.twitch.com/en/legal/music/20233107/
- YouTube live stream copyright guidance:
  https://support.google.com/youtube/answer/3367684
- U.S. State Department travel advisories change; trip plans must prompt
  a fresh official check before departure:
  https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html
- National Park Service plans ahead for reservations, hours, accessibility
  and safety:
  https://www.nps.gov/planyourvisit/index.htm
- Google Search Central BlogPosting data: use only on genuinely published
  articles with verified author/date/image/URL; cannot guarantee rankings:
  https://developers.google.com/search/docs/appearance/structured-data/article

## Verification and rollout

Focused regression tests:
```sh
pnpm install --frozen-lockfile
pnpm exec mocha tests/sonara-editorial-workbench.test.js tests/sonara-editorial-workbench-routes.test.js tests/a-storyboard-that-adds-up.test.js
pnpm run verify:applied-migrations
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

A fast isolated V8 test harness is useful for bounded logic and route
fixtures but **not** a substitute for Node/pnpm, live Supabase tenant
membership, native browser spellcheck, security scans, keyboard navigation,
or full production deployment gates. Full exact-commit CI is mandatory.

Operator acceptance sequence:
1. Require code review, green full CI, known migration state and an up-to-date
   deployed commit matching the approved SHA.
2. Deploy with `SONARA_EDITORIAL_WORKBENCH_ENABLED` unset/false.
   Verify all new routes return 404.
3. In a consenting test workspace, enable only for canary testing, check
   unauthenticated, wrong workspace, same-site cross-origin, overlong,
   invalid date/rights, failed DB insert, and saved-draft retrieval cases.
4. Confirm workspace-only records, no raw comparison passages persisted,
   no user text in logs and no accidental public sharing.
5. Obtain owner approval for rollout only after reviewed proof.
   For rollback, unset the flag and verify all routes become inaccessible.
   Do not reverse unrelated migrations.

### Next engineering opportunities

- Human-approved corrections and multilingual on-device or licensed
  spelling dictionaries; optional provider-powered grammar changes with
  privacy consent, metering and review.
- Creator Project Graph linkage (scene-to-footage, note-to-article, blog
  to social clips) and opt-in export of portable JSON/Markdown.
- A rights evidence vault with per-asset usage scope, expiry, territory,
  permission attachments, audit history and revocation, but **no
  self-declared infringement verdict**.
- BlogPosting metadata only upon validated publication through user-selected
  hosting, preserving dates and authorship.
- Travel destination discovery via user-provided geographic constraints and
  real source adapters for advisories/hours/maps/reservation; do not invent
  availability, costs or transit times.
- Platform-specific livestream/vlog workflows verifying approved game and
  soundtrack usage terms before publication.

## Security and export refinement

- Added `GET /api/creator-studio/editorial/drafts/:id` for exactly one organization-scoped draft and `GET /creator-studio/editorial/drafts/:id/export.md` for a downloadable Markdown revision. Both require Creator Studio workspace authorization, a valid UUID, and server-derived organization, product and module filters.
- A saved input now copies **only allowlisted fields**. Extra keys inside nested asset or travel objects are never stored, even if the client submits them; source comparison passages remain ephemeral.
- JSON saves require both the explicit `X-Sonara-Intent` header and rejection of browser-reported `cross-site` and `same-site` origins. HTML forms require `Sec-Fetch-Site: same-origin`; cookie presence alone is insufficient.
- Exports are returned as `text/markdown`, with a constant attachment filename and `Cache-Control: no-store`. This is an owner-selected download, not an externally published article or website.
- New regression tests cover missing/other-tenant export, intentional draft save, source minimization and cross-origin write attempts.
