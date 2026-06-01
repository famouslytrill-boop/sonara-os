# GitHub Intelligence Engine Report

## Summary

Fast Sprint 29 added five recent research candidates to the existing open-source intake registry and GitHub Update Watcher. The work remains registry-first and does not install, copy, bundle, or expose third-party code.

## Repositories Added

| Repository               | Score | Risk label                          | Product fit                                                                      | Status                             |
| ------------------------ | ----: | ----------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| `open-jarvis/OpenJarvis` |    84 | Review required                     | Shared Infrastructure, Local Edge Mode, Owner Command Center, product assistants | Reference only                     |
| `microsoft/SkillOpt`     |    88 | Allowed with review                 | Codex Sprint Generator, AI Agent Quality Layer, GitHub Radar                     | Reference only                     |
| `NVlabs/LongLive`        |    76 | Review required                     | Creator Studio, Creative Model Hub, Campaign Builder                             | Research only                      |
| `GH05TCREW/pentestagent` |    62 | Restricted security review required | Security Command Center, Launch Security Gate                                    | Restricted internal reference only |
| `nasa-gibs/worldview`    |    73 | Review required                     | Mapping, venue planning, Growth Studio local research                            | Reference only                     |

## Feature Flags

- `openjarvis_review_enabled`
- `local_first_agent_shell_review_enabled`
- `skillopt_review_enabled`
- `agent_skill_optimizer_enabled`
- `codex_skill_generator_enabled`
- `longlive_review_enabled`
- `creator_long_video_research_enabled`
- `pentestagent_research_only_enabled`
- `defensive_security_agent_review_enabled`
- `nasa_worldview_review_enabled`
- `mapping_research_layer_enabled`
- `feature_intake_clarifier_enabled`
- `codex_requirements_gate_enabled`

## Blocked Uses

- OpenJarvis: no automatic shell access, private file access without consent, hidden scheduled tasks, autonomous production actions, or unauthorized customer data processing.
- SkillOpt: no self-modifying production agents, unsafe autonomous deployment, hidden prompt changes, or high-risk workflow changes without validation.
- LongLive: no bundled model weights without review, copyrighted style/character imitation, fake endorsements, non-consensual likeness, or untested production real-time claims.
- PentestAgent: no public pentest automation, unauthorized scanning, exploit automation, customer-facing hacking tools, or offensive workflows.
- NASA Worldview: no NASA partnership claims, copying UI/code without review, surveillance, people tracking, or emergency routing claims.

## Feature Intake Clarifier

Added a checked requirements gate under `packages/web/src/lib/requirements` and `packages/web/src/ui/requirements`. It generates sprint-ready specs only after route, data, permission, blocked behavior, done definition, and tests are specified.

## Human Review Required

- Legal/license review for all repositories.
- Security review for OpenJarvis, PentestAgent, LongLive, and NASA Worldview-style mapping.
- Privacy review before local agents, mapping, logs, or prompt optimization affect user data.
- Owner approval before any adapter, dependency install, provider setup, or production exposure.

## Next Sprint Recommendations

1. Add an admin-only GitHub Radar UI section for these five candidates.
2. Add a review queue filter for `restricted_reference_only` records.
3. Add generated Codex prompt previews from Feature Intake Clarifier.
4. Add explicit license review status fields if the registry evolves beyond metadata labels.

## Merge Recommendation

Safe to review after validation passes. Do not merge unless CI, route smoke, public claims, risky-feature, env-safety, license-risk, GitHub Radar, typecheck, and build gates pass.
