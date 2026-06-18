# Agent Control Plane

The Agent Control Plane is a safe foundation for future AI-assisted workflows.

Implemented foundation:
- Agent task types and sessions.
- Tool registry with risk levels and approval requirements.
- Task orchestration records.
- Memory/context records.
- Scheduled automation policy.
- Audit log schemas.
- Model routing integration.

Launch safety boundaries:
- No arbitrary code execution.
- No browser automation enabled by default.
- No automatic email, SMS, phone calls, posts, charges, refunds, deletes, exports, or deploys.
- External API actions require permission tracking and audit logs.

Database foundation:
- `agent_tasks`
- `agent_sessions`
- `agent_tools`
- `agent_memory_entries`
- `agent_feedback`
- `agent_audit_logs`
- `agent_search_logs`
