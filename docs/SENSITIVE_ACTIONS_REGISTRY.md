# Sensitive Actions Registry

The sensitive action registry defines categories that require owner confirmation or are blocked from routine automation.

## Categories

- `money_movement`
- `refunds`
- `price_changes`
- `payout_settings`
- `legal_policy_text`
- `customer_facing_campaigns`
- `security_setting_changes`
- `deleting_data`
- `publishing_proof_reviews`
- `ai_voice_output`
- `ai_visual_output`
- `ai_video_output`

## Product Integrations

Business Builder:

- Payment option changes require approval when public-facing.
- Booking link changes require approval when public-facing.
- Offer price changes require approval.
- Customer-facing follow-ups require approval.
- Refund suggestions require approval before action.
- Proof passport publishing requires approval.
- Review/testimonial publishing requires approval.

Creator Studio:

- Creator proof card publishing requires approval.
- Asset rights-sensitive publishing requires approval.
- AI voice, visual, and video output export requires approval.
- Release campaign publishing requires approval.
- Licensing and rights text changes require approval.

Growth Studio:

- Campaign sends require approval.
- Offer publishing requires approval.
- Review request campaigns require approval.
- Referral campaigns require approval.
- Win-back messages require approval.
- Ad and public campaign copy requires approval.

Security Center:

- Security setting changes require approval.
- AI provider changes require approval.
- External provider sensitive-data routing requires approval.
- Source leak critical overrides require approval.
- Phishing-defense bypasses require approval.
- Customer-facing reliability continuity mode changes require approval.

Reliability Center:

- Public incident notices require approval.
- Maintenance-mode customer messages require approval.
- Provider failover activation requires approval unless explicitly configured.
- Customer-facing outage messaging requires approval.

Billing and Stripe:

- Owner/admin subscription plan changes require approval.
- Live pricing changes require approval.
- Refunds require approval.
- Payout settings cannot be changed by automation.
- Stripe Connect or marketplace payout features remain disabled unless explicitly reviewed.
