# Backend Modeling Notes

The TypeScript model layer is inspired by typed backend modeling patterns, but does not introduce Rayfin, decorators, Microsoft Fabric, or a new database dependency.

Implemented model contracts:
- Company account.
- User profile.
- Product.
- Subscription.
- Order.
- Agent task.
- Campaign.
- Knowledge entry.

Rules:
- Supabase remains the source of truth.
- Models include access scope and table mapping expectations.
- Service abstractions wrap existing Supabase and Stripe readiness logic.
- No migration is introduced solely to satisfy model naming.
