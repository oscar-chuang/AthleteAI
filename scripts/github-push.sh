#!/bin/bash
set -e

GITHUB_REPO="oscar-chuang/AthleteAI"

notify_failure() {
  local error_msg="$1"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  echo "❌ GitHub sync failed at $timestamp: $error_msg" >&2

  if [ -n "$GITHUB_TOKEN" ]; then
    local title="[Auto] GitHub sync failed — $timestamp"
    local body
    body=$(printf '## GitHub Sync Failed\n\n**Time:** %s\n\n**Error:**\n```\n%s\n```\n\nThis issue was opened automatically by the post-merge sync script. Resolve the error and close this issue once the sync is confirmed working.' \
      "$timestamp" "$error_msg")

    http_status=$(curl -s -o /tmp/gh_issue_response.json -w "%{http_code}" \
      -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "Content-Type: application/json" \
      --data "$(jq -n --arg t "$title" --arg b "$body" '{title: $t, body: $b, labels: ["sync-failure"]}')" \
      "https://api.github.com/repos/${GITHUB_REPO}/issues")

    if [ "$http_status" = "201" ]; then
      issue_url=$(jq -r '.html_url' /tmp/gh_issue_response.json)
      echo "📋 GitHub issue created: $issue_url" >&2
    else
      echo "⚠️  Could not create GitHub issue (HTTP $http_status)" >&2
      cat /tmp/gh_issue_response.json >&2 || true
    fi
  fi

  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    slack_text="*GitHub sync failed* (${GITHUB_REPO})\n*Time:* ${timestamp}\n*Error:* \`${error_msg}\`"
    curl -s -X POST \
      -H "Content-Type: application/json" \
      --data "$(jq -n --arg t "$slack_text" '{text: $t}')" \
      "$SLACK_WEBHOOK_URL" > /dev/null || \
      echo "⚠️  Could not send Slack notification" >&2
  fi
}

if [ -z "$GITHUB_TOKEN" ]; then
  notify_failure "GITHUB_TOKEN is not set — cannot push to GitHub"
  exit 1
fi

CREDS_FILE=$(mktemp)
trap 'rm -f "$CREDS_FILE"' EXIT

printf 'https://oscar-chuang:%s@github.com\n' "$GITHUB_TOKEN" > "$CREDS_FILE"

if ! PUSH_OUTPUT=$(git -c "credential.helper=store --file=${CREDS_FILE}" \
    push --force https://github.com/oscar-chuang/AthleteAI.git HEAD:main 2>&1); then
  notify_failure "$PUSH_OUTPUT"
  exit 1
fi

echo "✅ GitHub sync successful"
