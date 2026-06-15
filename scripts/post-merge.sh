#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push-force

git config --global core.hooksPath /home/runner/workspace/git-hooks

bash "$(dirname "$0")/github-push.sh" || echo "GitHub push failed (non-fatal)"
