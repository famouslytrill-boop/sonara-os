# Batch 1–10 Commercial Open-Source Adoption Policy

SONARA does not equate public source with production-safe adoption.

## Candidate gate

A repository may enter the permissive-candidate class only when all of the following are true:

- canonical upstream is verified;
- source license is permissive for the intended use;
- formal commercial-use status is allowed or allowed-after-review;
- integration status is not blocked/quarantined;
- product/runtime placement is defined;
- model-weight, dataset, content-rights, privacy, and provider terms are separately acceptable when relevant.

## Copyleft/source-available gate

GPL, AGPL, MPL, custom community, and source-available projects stay external, isolated, or review-only unless the intended deployment/distribution boundary is explicitly approved.

## Model/media gate

Source-code licensing never substitutes for model-weight/data/output-rights review. GPU/media/model workloads run behind an isolated worker or local companion boundary unless a separate architecture decision proves a narrower integration safe.

## Conduct and policy gate

A permissive license does not override a conduct/safety block. Tools whose purpose conflicts with authorization, privacy, anti-abuse, financial, or other SONARA policy remain blocked even when their source license is MIT/Apache/BSD/CC0.

## Registry authority

`data/open-source-tools.ts` is the maintained deeper-review registry. `lib/sonara-batch-convergence-engine.cjs` preserves all batch provenance but applies the formal registry decision last for matching canonical repositories.
