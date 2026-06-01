# Feature Intake Clarifier

The Feature Intake Clarifier prevents vague feature requests from entering development without enough route, data, permission, safety, and test detail.

## Required Questions

1. What is the feature?
2. Who uses it?
3. What problem does it solve?
4. What page or route does it affect?
5. What data does it need?
6. What permissions are required?
7. What should be blocked?
8. What does done mean?
9. What tests prove it works?

## Files

- `packages/web/src/lib/requirements/feature-intake-schema.ts`
- `packages/web/src/lib/requirements/feature-intake-policy.ts`
- `packages/web/src/ui/requirements/FeatureIntakeClarifier.ts`
- `packages/web/src/ui/requirements/FeatureSpecCard.ts`

The requested root `lib/` and `components/` paths were mapped into the checked `packages/web/src` workspace so typecheck and build cover them.

## Safety Rules

- No vague ASAP work without specs.
- No hidden prompt changes.
- No security, pricing, deployment, billing, or permissions changes without review.
- No third-party dependency installation from generated prompts unless approved.
- High-risk categories require owner review.
