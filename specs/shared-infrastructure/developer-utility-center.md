# Developer Utility Center

## Problem

Developers and agents need one internal place for repo commands, validation notes, and safe utility actions without adding destructive automation or fake infrastructure.

## Users

- Developers
- Agents
- Admin reviewers

## User Stories

- As a developer, I can find local validation commands.
- As an agent, I can follow repo guardrails before changing code.
- As a reviewer, I can see known blockers.

## Non-Goals

- No destructive command runner.
- No automatic dependency installs beyond explicit developer action.
- No production deployment controls.

## Data Model Notes

- Static documentation is enough for MVP.
- Future persistence may track command results and reviewers.
- Do not store secrets or private logs.

## Route Requirements

- Internal developer route only if UI is approved.
- Docs-first implementation is acceptable.
- No public marketing link.

## API Requirements

- No API required for MVP.
- Future command execution must be human-approved.
- No auto-run production migrations.

## Security Requirements

- Block destructive commands by default.
- Do not push to main or deploy without approval.
- Do not mark placeholders production-ready.

## Privacy Requirements

- No private log upload.
- No customer data in utility output.
- No hidden tracking of developers.

## Acceptance Criteria

- Local commands are documented.
- Dangerous automation remains disabled.
- Known issues are visible and not hidden.

## Test Requirements

- Test docs references are accurate when practical.
- Test unsafe flags stay false.
- Test validation scripts still pass.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Repo validation passes before PR merge.
