# Test Matrix

## Root gates

| Domain | Command | Current session status |
| --- | --- | --- |
| Install integrity | `pnpm install --frozen-lockfile` | Not run |
| Package manager | `pnpm run check:package-manager` | Passed 2026-07-17 |
| Lint | `pnpm run lint` | Not run |
| Format | `pnpm run format` | Not run |
| Typecheck | `pnpm run typecheck` | Not run |
| Unit/integration | `pnpm test` | Not run |
| Build | `pnpm run build` | Not run |
| Route smoke | `pnpm run smoke:routes` | Not run |
| Client secret scan | `pnpm run scan:client-secrets` | Not run |
| Supabase verification | `pnpm run verify:supabase` | Not run |
| Infrastructure | `pnpm run validate:infrastructure` | Not run |
| Launch gate | `pnpm run verify:launch` | Not run |
| Migration syntax/order | `pnpm run validate:migrations` | Passed 2026-07-17 |
| Controlled architecture | `pnpm run check:controlled-architecture` | Passed 2026-07-17 |
| Shared patch hygiene | `git diff --check -- .ai/shared` | Passed 2026-07-17 |

## Contract coverage required

- Auth/session/logout and unauthorized/admin denial
- Organization/workspace and tenant isolation
- Contact validation, database queue, email success/failure/retry
- Stripe price validation, checkout, webhook signatures/idempotency, entitlements
- Migration order, RLS expectations, storage policy
- Route registry and public assets
- Product CRUD/outputs and honest setup states
- Mobile navigation, no overflow/clipping, reduced motion, keyboard/focus, graphics fallback

## Rule

Agents update this matrix with actual commands and results in each handoff. Provider/live checks are reported separately from local code gates.
