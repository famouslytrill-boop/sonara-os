# Agent Architecture

SONARA agents are approval-gated workflow assistants. LangGraph-style orchestration, Temporal-style durable workflows, and MCP-style tool access are references only until reviewed and implemented.

Agents may draft plans, summarize governed records, and prepare human-reviewed actions. They may not automatically send messages, charge money, delete data, change permissions, deploy code, merge PRs, or access device permissions without explicit consent and approval.

The canonical experience stack is:

`current text/voice agent -> skills/tool permissions -> memory -> emotion/state system -> optional three.ws 3D presentation adapter`

## Permission boundary

Every skill/tool must operate inside explicit tenant, role, consent, approval, and audit boundaries. Memory and emotion/state are not authorization systems and may not expand the agent's authority.

## three.ws adapter

A three.ws integration is permitted only as an optional presentation adapter. Keep it isolated behind an adapter boundary and disabled-by-default feature flag such as `SONARA_3D_AGENT_ENABLED=false` until operationally approved.

The adapter may receive approved presentation state such as speech text, expression state, animation intent, and non-sensitive metadata. It must not receive database service-role credentials, unrestricted provider secrets, raw payment data, or implicit elevated permissions.

Core text and voice operation must remain functional when the 3D adapter is disabled, unavailable, or removed.

See `docs/architecture/SONARA-ENGINEERING-SECURITY-AGENT-ARCHITECTURE.md` for the full engineering, security, and agent dependency boundaries.
