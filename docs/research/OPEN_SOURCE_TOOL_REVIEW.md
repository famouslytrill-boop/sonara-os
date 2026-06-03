# Open Source Tool Review

SONARA tracks external tools as research candidates before adoption. Research references are not automatically bundled, endorsed, or shipped.

## New Review Records

- OpenJarvis: local-first AI agent research. Block shell/file actions unless explicit consent, approval, and audit logging exist.
- Microsoft SkillOpt: prompt and skill optimization research. Block hidden prompt changes and production workflow changes without validation.
- NVlabs LongLive: long-video generation research. Block model-weight bundling, non-consensual likeness, fake endorsements, and production real-time claims until tested and reviewed.
- PentestAgent: restricted defensive security research only. Block public pentest automation, exploit workflows, unauthorized scanning, and customer-facing hacking tools.
- NASA Worldview: satellite/mapping UI reference. Block NASA endorsement claims, surveillance, people tracking, and emergency routing claims.
- Foundation Emails: email-template reference only. Outbound support email still requires provider setup.
- mail2telegram: internal alert reference only. Block private customer data, support content, credential, or secret forwarding.
- Qdrant and Milvus: vector database references only. Block production sync until privacy, deletion, retention, and cost review pass.
- SurrealDB and CockroachDB: database technology references only. Supabase remains the source of truth.
- TDengine: AGPL-3.0 restricted reference only.
- Xiaomi Kernel Open Source: blocked from product integration.
- Linphone iPhone: restricted SIP/VoIP reference only. Block GPL source copying, robocalling, covert recording, emergency calling claims, and SIP credential exposure.
- HyperFrames: HTML-to-video reference only. Block production rendering without queues, quotas, storage, auth, rights review, and tests.

## Review Requirements

- License review.
- Security review.
- Privacy review.
- Commercial-use review.
- Owner approval before adapter work.
- Tests proving no auto-install, no source copy, no public exposure for restricted tools.

## Current Decision

All repositories remain registry/watchlist entries only. No dependency was added and no third-party code was copied.
