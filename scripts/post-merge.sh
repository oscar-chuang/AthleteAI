#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

git config --global core.hooksPath /home/runner/workspace/git-hooks

bash "$(dirname "$0")/github-push.sh" || echo "GitHub push failed (non-fatal)"
