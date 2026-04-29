# SONARA™ Business Principles Schema

## Core Types

- `SonaraBusinessSnapshot`: monthly operating metrics used for internal scoring.
- `SonaraInitiativeSnapshot`: scope, risk, and creator-value data for one initiative.
- `SonaraPrincipleResult`: normalized result from each internal operating engine.
- `SonaraFinalCompanyAudit`: combined score and gate output for the infrastructure package.

## Score Bands

- `clear`: 78-100. Continue inside current phase gate.
- `watch`: 58-77. Reduce risk or tighten scope before expansion.
- `hold`: 0-57. Pause until margin, trust, focus, or delivery risk is corrected.

## Validation Files

- `frontend/types/sonaraBusinessPrinciples.ts`
- `frontend/config/sonara/businessPrinciples.ts`
- `frontend/config/sonara/circleOfCompetence.ts`
- `frontend/config/sonara/marginOfSafetyRules.ts`
- `frontend/config/sonara/systemVisibility.ts`
- `frontend/lib/sonara/businessPrinciples/index.ts`
- `scripts/validate-sonara-full-infrastructure.mjs`
