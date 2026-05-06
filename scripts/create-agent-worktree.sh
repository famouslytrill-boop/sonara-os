#!/usr/bin/env bash
set -euo pipefail

TASK_NAME="${1:-}"
if [ -z "$TASK_NAME" ]; then
  echo "Usage: scripts/create-agent-worktree.sh <task-name>"
  exit 1
fi

SAFE_NAME="$(echo "$TASK_NAME" | tr -cd '[:alnum:]-_' | tr '[:upper:]' '[:lower:]')"
if [ -z "$SAFE_NAME" ]; then
  echo "Task name must include letters or numbers."
  exit 1
fi

TARGET="../sonara-agent-${SAFE_NAME}"
BRANCH="agent/${SAFE_NAME}"

if [ -e "$TARGET" ]; then
  echo "Refusing to overwrite existing path: $TARGET"
  exit 1
fi

git worktree add -b "$BRANCH" "$TARGET"
echo "Created worktree: $TARGET"
echo "Next:"
echo "  cd $TARGET"
echo "  npm install"
echo "  npm run build"
