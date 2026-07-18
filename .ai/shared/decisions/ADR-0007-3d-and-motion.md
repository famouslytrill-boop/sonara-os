# ADR-0007: 3D, Motion, Haptics, and Sound

Status: Accepted

## Decision

Treat advanced visuals as progressive enhancement. Core navigation and actions work without WebGL, motion, haptics, sound, or special device APIs.

## Consequences

- Honor reduced motion and low-power behavior.
- Provide static/accessible fallbacks.
- Haptics and sounds are optional, consent-aware, and safe no-ops when unsupported.

