# Model Routing

The model routing foundation provides cost and risk control before any direct model API integration.

Implemented:
- Task categories for summaries, support, strategy, code, content, extraction, compliance, campaign generation, restaurant receptionist scripts, knowledge search, and agent planning.
- Cost tiers: `free_or_local`, `low`, `standard`, and `premium`.
- Provider tiers: local placeholder, economy external, standard external, and premium external.
- High-risk or high-sensitivity work requires admin review.
- Simple tasks route toward cheaper/faster tiers.

Not implemented before launch:
- No model API calls.
- No provider keys.
- No hard dependency on one AI provider.
- No production autonomous prompt changes.

Fallback behavior:
- If external models are not allowed, routing falls back to the local placeholder tier.
- Premium or restricted tasks are flagged for admin review and audit.
