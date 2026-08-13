# Legal Review Required

The public legal pages are review-ready templates, not final legal advice.

**This is where the review is tracked, and it is the only place.** `/readiness`
used to carry it too, as `legalPages: review_required` — an item on a setup list
beside things like "Payment connection: Missing", which somebody closes by doing
something. Nobody could close this one: engaging counsel is a business decision
with a cost, made outside the repository, and no change to the code moves it.

What `/readiness` reports now is the part that is finished:
`legalPages: published_with_disclaimer`, derived from the pages actually
carrying the disclaimer, beside `legalReviewBoundary: not_attorney_reviewed`,
which is unchanged and says in as many words that no attorney has reviewed
these. Taking an item off a setup list is not answering the question it asked,
and the question is still open below.

`COUNSEL_REVIEW_BRIEF.md` in this directory states what the system actually does
— cookies, third-party recipients, what is refused — and records the places where
the policy text and the code disagree. Take it into the review so the engagement
is spent on judgement rather than on discovery.

Before paid public launch:

- Review terms, privacy, refund, billing, AI usage, acceptable use, security, accessibility, cookie, DPA, subprocessor, and service-level pages with qualified counsel.
- Confirm company legal name, contact address, support address, effective dates, and jurisdiction.
- Confirm subscription cancellation and refund terms align with Stripe configuration.
- Confirm data deletion, retention, export, and support processes.
- Confirm prohibited-use policy covers fake reviews, fake proof, deceptive claims, scraping, spam, impersonation, and synthetic media misuse.
- Confirm AI outputs are described as drafts and not professional advice.

Do not claim guaranteed legal compliance, guaranteed security, guaranteed uptime, guaranteed revenue, or professional advice from the software.
