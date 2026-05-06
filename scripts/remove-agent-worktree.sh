#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: scripts/remove-agent-worktree.sh <worktree-path>"
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "Worktree path not found: $TARGET"
  exit 1
fi

read -r -p "Remove worktree '$TARGET'? Type remove to continue: " CONFIRM
if [ "$CONFIRM" != "remove" ]; then
  echo "Canceled."
  exit 0
fi

git worktree remove "$TARGET"
echo "Removed worktree: $TARGET"
