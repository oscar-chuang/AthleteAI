#!/bin/bash
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set — skipping GitHub push"
  exit 0
fi

CREDS_FILE=$(mktemp)
trap 'rm -f "$CREDS_FILE"' EXIT

printf 'https://oscar-chuang:%s@github.com\n' "$GITHUB_TOKEN" > "$CREDS_FILE"

git -c "credential.helper=store --file=${CREDS_FILE}" \
  push --force https://github.com/oscar-chuang/AthleteAI.git HEAD:main
