# AthleteAI — Ops Runbooks

Operational one-liners and runbooks for production maintenance tasks.

---

## Avatar compression migration

Compresses oversized avatar data-URLs that were stored before write-time
compression was introduced.  The script is **idempotent** — avatars already
within the 20 KB limit are logged as "already OK" and skipped; the process
exits 0.

### When to run

- After first deploying the avatar compression feature, to back-fill existing
  rows.
- Any time you suspect oversized avatars are in the database (e.g. after a
  bulk import or a hot-fix that bypassed compression).

### How to run (production)

1. Get the production `DATABASE_URL` from the Replit deployment secrets panel
   (or from your password manager / secrets store).

2. Run the migration from the repository root:

   ```bash
   DATABASE_URL="postgres://user:pass@host/db" bash scripts/migrate-avatars.sh
   ```

   The script prints each profile it processes and a summary at the end:

   ```
   ==> Running avatar compression migration
       Target database: postgres://user@***

   Fetching profiles with avatars...
   Found 42 profile(s) with an avatar.
     Profile 1 (user 7): already within limit (8192 B) — skipping.
     Profile 2 (user 9): 45678 B — compressing...
       → compressed to 18234 B
   ...
   Done. 1 compressed, 41 already OK / non-data-URL, 0 error(s).
   ```

3. The process exits **0** on success (even if nothing needed compressing) and
   **1** if any row raised an error.  A non-zero exit means at least one avatar
   was not compressed — check the log output for the specific profile IDs and
   re-run after investigating.

### How to run (dev / staging)

If `DATABASE_URL` is already exported in your shell (e.g. from a `.env` file
loaded by `direnv`), just run:

```bash
bash scripts/migrate-avatars.sh
```

### Script internals

| File | Purpose |
|------|---------|
| `scripts/migrate-avatars.sh` | Thin shell wrapper — validates `DATABASE_URL`, then delegates |
| `artifacts/api-server/src/scripts/migrate-avatars.ts` | Core logic — reads profiles, compresses via `sharp`, writes back |
| `artifacts/api-server/package.json` (`migrate-avatars` script) | `tsx` entrypoint used by the wrapper |

Compression parameters (defined in the TypeScript source):
- Max dimensions: **64 × 64 px** (cover crop)
- Max file size: **20 KB**
- Format: JPEG, quality stepped down from 80 → 20 until the size limit is met

---

*Last updated: 2026-06-19*
