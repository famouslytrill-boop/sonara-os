# Facebook Reference Intelligence R&D — 2026-07-22

## Executive decision

The founder supplied 28 Facebook URLs containing one duplicate, producing **27 unique references**. Facebook blocked unauthenticated inspection of the shared Reel/video URLs, so the system must not claim to know their subjects, creators, claims, performance, or marketing lessons yet.

The correct engineering response is a governed reference-intelligence pipeline: catalog the sources, require authenticated review or an owner-supplied transcript, separate facts from interpretation, review rights and disclosures, map approved insights to the three products, and require human approval before implementation.

## Why this approach

- SONARA already requires truthful readiness states, evidence, consent, provenance, and owner approval.
- A shared social URL is not evidence of what the video says.
- Facebook publishing APIs support approved Page publishing workflows, but they are not a general-purpose mechanism for scraping arbitrary shared videos.
- Unknown-rights content may be studied as a reference, but it must not be cloned, republished, or silently used as training material.
- Marketing recommendations must preserve the distinction between an observed fact, an interpretation, and a proposed experiment.

## Implemented system

### Catalog and governance

`data/facebook-reference-catalog.cjs` stores all 27 unique URLs with these default states:

- `verificationStatus = requires_authenticated_source_review`
- `accessStatus = public_fetch_blocked`
- `rightsStatus = unknown`
- candidate review scope: Business Builder, Creator Studio, and Growth Studio

No titles, summaries, transcripts, creators, or performance claims are invented.

### Database model

`supabase/migrations/20260722201500_reference_intelligence_system.sql` adds:

1. `reference_intelligence_sources`
   - source URL and external ID
   - access, verification, and rights states
   - optional title, creator, transcript, factual summary, and owner notes
   - candidate product mapping

2. `reference_intelligence_insights`
   - factual basis separated from interpretation
   - confidence and evidence
   - product scopes and expected impact
   - review/approval status

3. `reference_intelligence_actions`
   - approved target product and module
   - proposed change and expected impact
   - approval and implementation status
   - implementation reference for traceability

All three tables use row-level security and are restricted to the server-side service role.

### Founder control plane

The runtime adds:

- `/admin/reference-intelligence`
- `/api/admin/reference-intelligence`

Both routes require founder/admin authorization. The dashboard exposes review state and product-mapping rules without exposing secrets or claiming the content has been analyzed.

## Review pipeline

### 1. Source intake

Normalize and deduplicate URLs. Store the platform, source type, external ID, access state, and date supplied.

### 2. Evidence acquisition

Use one of these evidence paths:

- authenticated human review of the original Facebook Reel/video;
- owner-supplied transcript and screenshots;
- creator-provided source material;
- a permitted platform API for content owned or managed by the connected account.

Do not bypass platform access controls.

### 3. Structured extraction

For each source, capture:

- creator/account and title when available;
- publish date and duration;
- factual transcript;
- visual sequence and editing structure;
- offer, audience, problem, proof, and call to action;
- claimed result versus demonstrated result;
- sponsorship, affiliate, testimonial, or endorsement indicators;
- reusable pattern versus protected expression;
- uncertainty and missing evidence.

### 4. Rights and compliance gate

Assign one rights state:

- unknown;
- reference only;
- permission granted;
- licensed;
- public domain;
- blocked.

For sponsored or affiliate material, record the disclosure evidence. Marketing claims must be truthful, non-deceptive, and evidence-backed. Testimonials and endorsements require clear disclosure of material connections.

### 5. Product mapping

#### Business Builder

Extract only verified operating patterns:

- offer design and packaging;
- pricing presentation;
- sales and intake flow;
- customer experience;
- fulfillment and operations;
- automation opportunities;
- proof and claim requirements.

Potential approved outputs:

- operating checklist;
- feature requirement;
- testable offer hypothesis;
- customer workflow improvement.

#### Creator Studio

Extract only originalizable creative patterns:

- hook architecture;
- story structure;
- pacing and edit grammar;
- visual and audio language;
- asset requirements;
- rights and release checks;
- content-series structure.

Potential approved outputs:

- original format brief;
- production checklist;
- rights review;
- content experiment.

The system should derive principles, not duplicate scripts, footage, branding, music, characters, or protected creative expression.

#### Growth Studio

Extract only testable growth hypotheses:

- target audience;
- channel and placement;
- message and call to action;
- proof mechanism;
- cadence and sequence;
- conversion hypothesis;
- disclosure and consent requirements;
- measurement plan.

Potential approved outputs:

- campaign hypothesis;
- consent-safe follow-up plan;
- approved content brief;
- A/B experiment with success and stop criteria.

## New systems to develop on top of the foundation

### Hook and Format Lab

Compare verified opening structures, pacing, captions, shot changes, and narrative formats. Store patterns as abstract variables rather than copied scripts.

### Offer Pattern Lab

Translate verified offer mechanics into configurable Business Builder templates: audience, problem, promise, proof, price, friction, fulfillment, guarantee, and call to action.

### Proof and Claims Gate

Require evidence for objective claims. Flag health, income, legal, financial, and performance claims for elevated review. Prevent unverifiable testimonials, fake urgency, fake scarcity, and invented results.

### Campaign Experiment Queue

Convert approved insights into Growth Studio experiments with:

- hypothesis;
- audience;
- creative variant;
- channel;
- budget/time cap;
- primary metric;
- guardrail metrics;
- minimum sample;
- stop condition;
- decision and learning.

### Originality and Rights Gate

Before Creator Studio exports a brief or asset package, verify that the output is original, licensed, permissioned, or otherwise authorized. Unknown-rights reference material cannot become a direct production asset.

### Trend Decay and Confidence

Every insight should carry:

- source date;
- review date;
- confidence;
- evidence count;
- product relevance;
- expected impact;
- expiration/review date.

Trends should decay unless renewed by current evidence.

### Reference-to-Roadmap Bridge

Approved actions should create traceable roadmap items with the source insight, owner approval, affected module, acceptance criteria, test plan, and implementation reference.

## Marketing measurement contract

Do not optimize for views alone. Use a funnel appropriate to the product:

- attention: qualified view, hold rate, completion;
- intent: profile/site click, save, reply, lead start;
- conversion: completed intake, booking, checkout, purchase;
- quality: refund, churn, support burden, customer outcome;
- economics: acquisition cost, contribution margin, payback;
- trust: disclosure compliance, complaints, opt-outs, claim substantiation.

## Source and platform research

- Meta Facebook Reels Publishing collection: https://www.postman.com/meta/facebook/folder/simabyk/reels-publishing
- Meta Facebook API documentation in Postman: https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api
- Meta Instagram API documentation in Postman: https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00
- Facebook Help — embed a video: https://www.facebook.com/help/1570724596499071/
- Facebook Help — Reels discovery and viewing: https://www.facebook.com/help/262748009210134/
- FTC Disclosures 101: https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
- FTC Endorsements, Influencers, and Reviews: https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

## Production activation checklist

1. Apply the Supabase migration.
2. Deploy the branch and confirm the runtime patch registers the routes.
3. Open the founder dashboard and review the 27 sources.
4. Attach an authenticated review or owner-supplied transcript for each source.
5. Complete factual summary, rights, disclosure, and confidence fields.
6. Approve or reject product-specific insights.
7. Convert only approved insights into experiments or roadmap actions.
8. Record implementation references and measured results.

## Current limitation

The source URLs are integrated and governed, but the video contents remain **unverified**. No content-specific feature, campaign, or marketing conclusion should be treated as approved until the original videos or transcripts are reviewed.
