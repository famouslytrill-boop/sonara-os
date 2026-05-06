# Billing

Stripe Billing is the shared provider. Product groups must stay separated by app_code:

- sonara_one
- tableops
- civic_signal

Stripe Connect-ready architecture is planned, but marketplace payouts are not implemented at launch.

The webhook route records events and should verify signatures before state changes. No fake active subscriptions are allowed.

