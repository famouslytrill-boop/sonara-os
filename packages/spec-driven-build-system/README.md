# Spec-Driven Build System

Internal package for keeping major SONARA One and Signal OS feature work spec-first.

Every major feature should have:

- problem
- users
- user stories
- non-goals
- data model notes
- route requirements
- API requirements
- security requirements
- privacy requirements
- acceptance criteria
- test requirements
- launch gate requirements

This package does not add public UI and must not be surfaced as a branded product surface.

## Exports

- `createFeatureSpec`
- `checkSpecDrift`
- `buildImplementationPlan`
- `createTaskBreakdown`
- `createCodexPrompt`
- acceptance-criteria helpers

## Starter Specs

Starter specs live in the root `specs/` directory and are grouped by product or shared infrastructure area.
