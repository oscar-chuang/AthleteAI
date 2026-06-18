---
name: Artifact directory rename constraint
description: Why you cannot rename artifact directories and how to surface a rename instead.
---

# Artifact directory rename constraint

Artifact directory names (e.g. `artifacts/lense-mobile`) double as their registration IDs in the Replit artifact system. `verifyAndReplaceArtifactToml` will reject any `artifact.edit.toml` whose `id` field differs from the live `artifact.toml` — the call succeeds only when IDs match.

**Why:** The artifact registry uses the directory path as the stable identifier. Moving the directory de-registers the artifact; restoring the directory re-registers it, but under the old ID.

**How to apply:** When a user asks to "rename" a mobile or web artifact:
1. Keep the directory as-is.
2. Change the `name` field in `package.json` to the desired name (e.g. `@workspace/athlete-mobile`).
3. Update workflow commands via `configureWorkflow` (remove old, create new) to use the new package name.
4. Update artifact TOML dev/prod commands via `verifyAndReplaceArtifactToml` with the **same `id`**, new run commands.
5. Run `pnpm install` to regenerate the lockfile with the renamed package.
6. Update replit.md and docs to use the new name everywhere.
