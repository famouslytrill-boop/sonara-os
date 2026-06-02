# GitHub Intelligence Engine Report

## Summary

Fast Sprint 29 added the first five recent research candidates. The combined go-live pass added the email, alerting, vector database, database technology, VoIP, kernel-source, and HTML-to-video candidates requested in the latest research batch. The work remains registry-first and does not install, copy, bundle, or expose third-party code.

## Repositories Added

| Repository                                 | Score | Risk label                          | Product fit                                                                      | Status                             |
| ------------------------------------------ | ----: | ----------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| `open-jarvis/OpenJarvis`                   |    84 | Review required                     | Shared Infrastructure, Local Edge Mode, Owner Command Center, product assistants | Reference only                     |
| `microsoft/SkillOpt`                       |    88 | Allowed with review                 | Codex Sprint Generator, AI Agent Quality Layer, GitHub Radar                     | Reference only                     |
| `NVlabs/LongLive`                          |    76 | Review required                     | Creator Studio, Creative Model Hub, Campaign Builder                             | Research only                      |
| `GH05TCREW/pentestagent`                   |    62 | Restricted security review required | Security Command Center, Launch Security Gate                                    | Restricted internal reference only |
| `nasa-gibs/worldview`                      |    73 | Review required                     | Mapping, venue planning, Growth Studio local research                            | Reference only                     |
| `foundation/foundation-emails`             |    71 | Allowed with review                 | Support Center, transactional email templates                                    | Reference only                     |
| `jeremykenedy/laravel-auth`                |    55 | Review required                     | Auth readiness, owner bootstrap docs                                             | Reference only                     |
| `dword-design/nuxt-mail`                   |    54 | Review required                     | Support email route planning                                                     | Reference only                     |
| `tbxark/mail2telegram`                     |    58 | Security review required            | Internal admin alerts                                                            | Reference only, internal review    |
| `qdrant/qdrant`                            |    86 | Allowed with review                 | Smart Document Reader, Business Memory Graph                                     | Reference only                     |
| `milvus-io/milvus`                         |    78 | Allowed with review                 | Future enterprise vector search                                                  | Reference only                     |
| `surrealdb/surrealdb`                      |    64 | Review required                     | Database technology research                                                     | Research only                      |
| `cockroachdb/cockroach`                    |    67 | Review required                     | Future scale reference                                                           | Reference only                     |
| `taosdata/TDengine`                        |    49 | Restricted                          | Time-series database research                                                    | Restricted reference only          |
| `MiCode/Xiaomi_Kernel_OpenSource`          |    10 | Blocked                             | Research Lab only                                                                | Blocked from product integration   |
| `BelledonneCommunications/linphone-iphone` |    57 | Restricted                          | SIP/VoIP architecture                                                            | Reference only                     |
| `heygen-com/hyperframes`                   |    82 | Allowed with review                 | Creator Studio, Growth Studio, video workflows                                   | Reference only                     |

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
- `foundation_emails_review_enabled`
- `mail2telegram_internal_alert_review_enabled`
- `qdrant_review_enabled`
- `milvus_review_enabled`
- `surrealdb_review_enabled`
- `cockroachdb_review_enabled`
- `tdengine_restricted_review_enabled`
- `xiaomi_kernel_product_integration_blocked`
- `linphone_sip_voip_reference_enabled`
- `sip_phone_system_review_enabled`
- `hyperframes_video_rendering_review_enabled`
- `html_to_video_templates_enabled`

## Blocked Uses

- OpenJarvis: no automatic shell access, private file access without consent, hidden scheduled tasks, autonomous production actions, or unauthorized customer data processing.
- SkillOpt: no self-modifying production agents, unsafe autonomous deployment, hidden prompt changes, or high-risk workflow changes without validation.
- LongLive: no bundled model weights without review, copyrighted style/character imitation, fake endorsements, non-consensual likeness, or untested production real-time claims.
- PentestAgent: no public pentest automation, unauthorized scanning, exploit automation, customer-facing hacking tools, or offensive workflows.
- NASA Worldview: no NASA partnership claims, copying UI/code without review, surveillance, people tracking, or emergency routing claims.
- Foundation Emails, laravel-auth, and nuxt-mail: no framework imports or live email claims without provider setup and review.
- mail2telegram: no forwarding private customer/support data, tokens, or secrets to chat channels.
- Qdrant and Milvus: no production sync of private tenant records without privacy, deletion, and cost review.
- SurrealDB and CockroachDB: no database replacement; Supabase remains source of truth.
- TDengine: no closed-source product integration without AGPL/legal review.
- Xiaomi Kernel Open Source: blocked from product integration and app dependencies.
- Linphone iPhone: no GPL source copying, SIP credential exposure, robocalling, covert recording, or emergency calling claims.
- HyperFrames: no production rendering, unlimited rendering, auto-publishing, vendor partnership claims, fake endorsements, or non-consensual likeness.

## Feature Intake Clarifier

Added a checked requirements gate under `packages/web/src/lib/requirements` and `packages/web/src/ui/requirements`. It generates sprint-ready specs only after route, data, permission, blocked behavior, done definition, and tests are specified.

## Human Review Required

- Legal/license review for all repositories, especially GPL/AGPL/BSL/restricted candidates.
- Security review for OpenJarvis, PentestAgent, LongLive, and NASA Worldview-style mapping.
- Privacy review before local agents, mapping, logs, or prompt optimization affect user data.
- Owner approval before any adapter, dependency install, provider setup, or production exposure.

## Next Sprint Recommendations

1. Add an admin-only GitHub Radar UI section for the expanded candidate batch.
2. Add a review queue filter for `restricted_reference_only` records.
3. Add generated Codex prompt previews from Feature Intake Clarifier.
4. Add explicit license review status fields if the registry evolves beyond metadata labels.

## Merge Recommendation

Safe to review after validation passes. Do not merge unless CI, route smoke, public claims, risky-feature, env-safety, license-risk, GitHub Radar, typecheck, and build gates pass.
