# SONARA Legal, Terms, Privacy, and Trademark Governance

Date: 2026-09-23
Status: engineering and product governance; not legal clearance
Scope: SONARA Industries, Business Builder, Creator Studio, Growth Studio, shared Nexus services, integrations, AI/media tooling, payments, subscriptions, commerce, jobs, location, recording, biometrics, and future vertical packs.

## Production rule

A feature is not production-ready merely because its route, database table, provider adapter, or user interface exists. High-consequence capabilities remain disabled until their legal notice, consent, retention, data-flow, authorization, and audit requirements are implemented and reviewed for the jurisdictions where the feature will operate.

The repository's legal pages are product disclosures and templates. Qualified counsel must review launch terms, privacy practices, trademark clearance, regulated-industry boundaries, and jurisdiction-specific requirements before production use.

## Trademark control: SONARA

Do not represent SONARA, SONARA Industries, Business Builder, Creator Studio, Growth Studio, Nexus, or any product logo as federally registered unless an actual registration has been verified and recorded. Do not use the registered-trademark symbol (R in a circle) without that evidence.

Current engineering disposition for SONARA: **clearance required; no availability conclusion recorded**.

Before filing or materially expanding use, complete and retain a clearance record that covers:

1. Exact and similar wording, phonetic equivalents, spelling variations, translations, abbreviations, and dominant terms.
2. Federal registered and pending marks.
3. State trademark databases and common-law/internet uses.
4. Related goods and services, not only the same Nice class.
5. Company names, domains, app stores, social handles, software marketplaces, developer ecosystems, and major product directories.
6. Logo/design similarity when a design mark will be used.
7. Counsel review of likelihood-of-confusion risk and filing strategy.

USPTO guidance says confusing similarity can arise from sound, appearance, meaning, or overall commercial impression, and related goods/services can create a conflict even when they are not in the same class.

Official references:
- https://www.uspto.gov/trademarks/search/likelihood-confusion
- https://www.uspto.gov/trademarks/search/federal-trademark-searching
- https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks
- https://www.uspto.gov/trademarks/search

## Legal surface that must remain routed

The application must retain working routes for, at minimum:

- Terms of Service
- Privacy Policy
- Refund Policy
- Cookie Policy
- Acceptable Use
- Accessibility
- Earnings Disclaimer
- AI and Tooling Disclaimer
- Payment Terms
- Data Processing
- Security Policy
- General Disclaimer
- Commercial Email Reminder
- Subprocessor Notice

Aliases must resolve to the canonical legal pages rather than duplicate independent legal text.

## Privacy and data governance

Every new data field or provider must answer: what is collected, why, legal/business purpose, who receives it, retention, deletion/archival behavior, tenant boundary, user access/export, and whether it is optional.

For jurisdictions where comprehensive privacy laws apply, notices must be synchronized with the real product. California's CCPA materials, for example, describe notice-at-collection and privacy-policy obligations, including categories collected, purposes, privacy rights, and applicable sale/share controls.

Official reference:
- https://www.oag.ca.gov/privacy/ccpa

No product copy may promise that data is never shared with outside companies when configured providers, infrastructure processors, email services, payment processors, analytics providers, AI providers, or customer-enabled connectors receive data.

## Biometrics, voice, face, camera, and sensor data

Biometric identification, face templates, voiceprints, fingerprints, iris/retina data, or other identifiers must remain disabled unless the feature has an explicit jurisdiction-aware consent and retention implementation.

Illinois BIPA is a concrete high-risk example: covered private entities must maintain a public retention/destruction policy and obtain written notice and a written release before collecting biometric identifiers or biometric information. Its private right of action creates material litigation exposure.

Official references:
- https://www.ilga.gov/legislation/ilcs/fulltext?DocName=074000140K15
- https://www.ilga.gov/Documents/legislation/ilcs/documents/074000140K20.htm

Voice generation and likeness workflows must distinguish ordinary media files from biometric identification/verification. Consent to create media is not automatically consent to enroll a biometric identifier.

## Recording and communications

Audio/video recording, call recording, camera monitoring, employee monitoring, surveillance, location history, and communications interception are jurisdiction-sensitive. Do not activate silent recording or surveillance defaults. Require a feature-specific legal review, visible status, consent/notice evidence where required, retention controls, and an audit trail.

## Payments, subscriptions, refunds, and commerce

Checkout, subscriptions, renewals, cancellation, refunds, marketplace transactions, payouts, banking connections, lending, insurance, investments, stored value, and money transmission must each have bounded authority.

For subscriptions:
- price and renewal cadence must be disclosed before purchase;
- cancellation must be easy to locate and actually work;
- refund terms must match the product and support workflow;
- plan copy must not promise unlimited costly usage unless the economic model actually supports it;
- payment-provider records remain the source of truth for payment state.

FTC negative-option rulemaking changed again in 2026, so subscription compliance must be reviewed against current federal and applicable state law rather than hard-coded to an outdated "click-to-cancel" summary.

Official reference:
- https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

## AI, agents, deterministic workflows, and generated content

Agents may research, draft, classify, summarize, recommend, or prepare bounded actions. They do not receive implied authority to publish, spend, refund, transfer funds, change security settings, enroll biometrics, sign contracts, submit government forms, make regulated eligibility decisions, or perform other irreversible actions.

Generated text, images, audio, video, code, formulas, forecasts, translations, and recommendations must remain reviewable. The system must preserve provenance where practical and avoid presenting estimates or model output as deterministic fact.

## User content and intellectual property

Terms must preserve customer ownership of customer content while granting only the license needed to operate the service. Users remain responsible for having rights to uploaded material. The product must not claim copyright, trademark, patent, publicity-right, music, likeness, or licensing clearance unless a real clearance workflow supports that claim.

Open-source intake must retain license, source, version, intended use, reciprocal-license containment status, and whether code is reference-only, research-only, blocked, or approved for runtime adoption.

## Regulated and high-consequence verticals

Government, military, healthcare, education records, employment, background screening, lending, banking, investments, insurance, legal services, biometrics, children's services, transportation safety, autonomous vehicles, energy/utilities, and critical infrastructure require separate legal/product gates before runtime activation.

A generic "platform supports every industry" statement must never be interpreted as permission to perform regulated decisions.

## Required engineering controls

1. Every public button and navigation element has one intentional route or action.
2. No duplicate canonical legal routes; aliases point to canonical content.
3. No empty demo controls that imply a legal or financial action works when it does not.
4. Every high-consequence action has authorization, idempotency where applicable, audit evidence, and a truthful failure state.
5. Consent records are versioned and tied to the exact purpose they authorize.
6. Policy versions and effective dates are retained so acceptance can be proven against the text shown at the time.
7. Material legal changes trigger a review of whether re-acceptance or advance notice is required.
8. Data retention rules are executable where possible, not only prose.
9. Provider/subprocessor disclosures are generated from a maintained registry when feasible.
10. Product claims about privacy, security, accessibility, legal compliance, financial outcomes, or trademark status require evidence.

## Launch legal checklist

Before a paid public launch, record:

- legal entity and contact details shown to customers;
- Terms and Privacy effective dates;
- counsel review status;
- subscription/cancellation/refund flow evidence;
- current subprocessors and data-flow map;
- privacy request/export/deletion procedure;
- breach/incident communication procedure;
- open-source/license audit;
- trademark clearance record and filing decision;
- marketing claim substantiation review;
- biometric/recording/location feature status;
- age/children policy where relevant;
- regulated-industry exclusions or approvals;
- accessibility review status;
- production URLs and exact deployed commit SHA.

## Change rule

When a new module introduces a new category of personal data, irreversible action, regulated decision, external processor, or public claim, its pull request must include the corresponding legal/privacy/consent update or explicitly keep the capability disabled.
