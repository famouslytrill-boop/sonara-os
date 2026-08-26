# Contributing

This repository is proprietary. See `LICENSE`: no licence is granted, and
possession of a copy conveys no right to use or redistribute it.

Contributions are accepted only from people SONARA Industries has authorised in
writing. If that is you, everything you need is below. If it is not, there is no
contribution process to follow — this is not an open-source project, and a pull
request from outside that list cannot be accepted regardless of its quality.

## Ownership of contributions

By contributing, you assign to SONARA Industries all right, title, and interest
in your contributions, including copyright. You confirm the work is yours to
assign and that it carries no obligation to a third party — in particular, that
you have not copied it from a repository under a reciprocal licence (AGPL, GPL,
OSL), which would oblige releasing this product's source under the same terms
the moment it is served over a network.

Before adapting any external code, read the record in `data/open-source-tools.ts`
and the rules in `CLAUDE.md`. Two facts decide most cases: **a repository with no
licence declared is all rights reserved** — the absence of a licence is not
permission — and **a reciprocal licence triggers on network use**.

## The rules

`AGENTS.md` is the safety rule and it is not advisory. Read it before your first
change. `CLAUDE.md` explains what else to read.

The short version:

- pnpm only. Not npm, not `npm audit fix`, not `package-lock.json`.
- Never commit a secret. Service-role keys are server-only.
- Do not weaken an audit or security check without writing the exact reason in
  `SECURITY_NOTES.md`.
- Before you push: `pnpm install --frozen-lockfile`, `pnpm audit --audit-level
  moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run
  build`. Before a release: `pnpm run verify:launch`.

## Checks that cannot lie

The recurring defect here is not broken code — it is a check that reports success
without being true. When you add one, **break the thing it tests and watch it go
red before you trust it green**, then record in `docs/SPRINT_LOG.md` what you
broke to prove it works. `.claude/skills/checks-that-cannot-lie` has the six
shapes this has taken so far.

## Reporting a security problem

Report it privately to the repository owner. Do not open an issue, and do not
describe it in a pull request title, a commit message, or any other place that
is readable before the fix lands.

## Conduct

Treat the people you work with decently. The owner decides what falls short of
that and may remove anyone's access.
