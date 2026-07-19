# Risks

1. The hosted organizations table combines an older required company_key field with newer slug and owner_id fields. Setup writes must support both until a separately approved migration normalizes the table.
2. accountDatabase configured proves connection settings are present; it does not prove every write contract.
3. Organization and membership writes are separate. Retry recovery by deterministic slug is required to prevent duplicates.
4. The legacy internal company key must remain private and must not appear in customer-facing product names.
5. Do not claim the issue fixed in Production until the deployed SHA and an authenticated setup result are verified.
6. Existing launch gates for access replacement, delivery evidence, billing lifecycle evidence, legal review, Preview isolation, browser testing, and physical-device testing remain open.
