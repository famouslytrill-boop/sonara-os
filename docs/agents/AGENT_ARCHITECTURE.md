# Agent Architecture

SONARA agents are approval-gated workflow assistants. LangGraph-style orchestration, Temporal-style durable workflows, and MCP-style tool access are references only until reviewed and implemented.

Agents may draft plans, summarize governed records, and prepare human-reviewed actions. They may not automatically send messages, charge money, delete data, change permissions, deploy code, merge PRs, or access device permissions without explicit consent and approval.
