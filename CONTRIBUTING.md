# Contributing

Keep stabilization work separate from product feature work.

## Local Checks

Before opening a PR, run:

```sh
npm install
npm run validate:infrastructure
npm run typecheck
npm run lint
npm run build
npm test
```

For the full gate, run:

```sh
npm run check
```

## Repo Rules

- Keep CI and configuration PRs small.
- Do not add fake passing tests.
- Do not suppress TypeScript, lint, build, or test errors without documenting why.
- Do not run `npm audit fix --force` without explicit review.
- Do not add fake production services, migrations, or Dockerfiles to satisfy tooling.
- Do not expose service-role secrets in client-accessible code or public env vars.
- Preserve existing package boundaries unless a broken import or build error requires a small correction.

## Documentation

When a blocker is not fixed in the same PR, update `docs/KNOWN_ISSUES.md` with:

- the exact command that failed
- the relevant file or dependency
- the reason it was not fixed
- the recommended next action
