# Support Form Live Testing

## Before launch

- Submit a general contact request.
- Submit a billing/refund request.
- Submit a technical support request.
- Submit a security report.
- Confirm required fields reject invalid input.
- Confirm users are not asked for passwords, card data, bank details, API keys, or private keys.
- Confirm missing email/storage providers show a visible fallback.
- Confirm provider errors do not expose stack traces.

## After provider setup

- Confirm support storage writes to the intended table only.
- Confirm outbound email sends only after provider secrets are configured.
- Confirm correlation IDs or audit references are generated without exposing private message content.
