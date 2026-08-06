Newest first. Each entry says what changed, what was verified, and what the next
person should not have to rediscover. This is the hand-written half of
`docs/HANDOFF_PROMPT.md`; everything else in that file is generated.

### 2026-08-06 — Cinematic public surfaces

Every public route is now on one of two lists with a recorded reason: twenty are
cinematic front doors, eleven stay calm. The eleven are the seven legal
documents, the accessibility page, and the three launch-readiness checklists —
somebody opens a refund policy to check a term, and parallax does not help them
find it.

`/help` and `/prompt-library` moved to the marketing surface. Both are reached
before signing up as often as after and were rendering the plain operational
frame.

The backdrop is one rule on `.sonara-stage::before` rather than markup on
eighteen pages — three colour fields in the product hues over a ruled grid,
parallaxed by the scroll variable the depth script already writes. No image
files, no library, nothing for the CSP to refuse.

Not obvious and worth keeping: `z-index: -1` with `isolation: isolate` on the
stage is the only combination that works. At `z-index: 0` an absolutely
positioned pseudo-element paints over in-flow text; without the isolation, `-1`
falls behind the body background and disappears.

The asset version token lives in four files and the service worker caches by it.
Three were updated and one was not; an existing test caught it.

### 2026-08-06 — The agent approval rule as code

`lib/sonara-agent-authority.cjs` implements the seven categories from AGENTS.md
plus the default. The nineteen agent tables have existed since migration 008
with nothing running against them, so the release gate's "no runtime" line was
the whole guarantee — a guarantee that expires the moment somebody builds one.

Four decisions that look backwards until you see why. The default is deny.
Sensitive patterns are checked before the allowlist, because `delete_draft_content`
matches both. The row's own `requires_approval` column is ignored, because it is
writable and a safety property the agent can edit is not one. And an approval
must name a person, be for that action, and not come from the requester.

The release checks all of it. Verified by flipping the unrecognised-action
default to allow — the release fails.

There is still no runtime. That is the next thing, and it should be built to
call `decideExecution` rather than around it.

### 2026-08-06 — Twenty-five repositories, licences verified

Read off each repository rather than recalled, which mattered: five turned out
reciprocal (AGPL, GPL, OSL), two declared no licence at all, two could not be
confirmed. Recalling them would have put four in the adoption path wrongly.

Two blocks that cannot be lifted from inside this project: a repository with no
licence is all rights reserved, so there is nothing to authorise.

Two corrections to earlier reasoning, both mine. The AGENTS.md anti-clone rule
sits beside provenance and consent and is implemented by `song_fingerprints` and
`creator_voice_consents` — it protects creators from being cloned, not this
project from reading open-source code. And Apache-2.0 permits derivative works
commercially; attribution is the obligation, not prohibition.

`tests/open-source-licence-terms.test.js` reads the licence sentence rather than
the risk tier, because `check-license-risk.mjs` greps for "gpl" and otherwise
trusts two hand-typed fields — and neither `OSL-3.0` nor "None declared"
contains it.

`docs/github-radar/GITHUB_RADAR_PRODUCT_INTEGRATION_MAP.md` is now generated per
repository from the register instead of being four sentences that named none of
them.
