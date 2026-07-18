# Coordination Locks

## Active

None.

## Released

LOCK: `.ai/shared/**`
OWNER: Codex
PURPOSE: Initialize the dual-agent repository memory, contracts, registries, ADRs, task board, and handoff log without modifying the existing in-flight product changes.
STARTED: 2026-07-17T23:39:04-04:00
RELEASED: 2026-07-17 session close after focused validation passed.

LOCK: `.ai/shared/CURRENT_STATE.md`, `.ai/shared/HANDOFF_LOG.md`, `.ai/shared/CHANGELOG_AI.md`, `.ai/shared/LOCKS.md`
OWNER: Codex
PURPOSE: Record the exact shared-contract commit SHA and final handoff metadata.
STARTED: 2026-07-17 session close
RELEASED: 2026-07-17 immediately after metadata update.

## Rules

- Record a lock before changing a shared or high-conflict area.
- Do not edit another agent's active lock.
- Keep locks narrowly scoped and release them when the task is handed off.
- A lock is coordination metadata, not authorization to overwrite uncommitted work.
