---
name: referencedAnalysisId ownership check
description: chat POST must verify analysis ownership before persisting referencedAnalysisId
---

When a chat message includes referencedAnalysisId, the server must verify the analysis
belongs to the requesting user (WHERE id=? AND userId=?) before persisting it.

**Why:** Without the check, a user could link any analysis ID to their chat message,
potentially leaking IDs or causing confusing cross-user data references.

**How to apply:** In POST /chat, resolve referencedAnalysisId → resolvedAnalysisId by
querying analysesTable with both id and userId conditions. Use null if not found/owned.
