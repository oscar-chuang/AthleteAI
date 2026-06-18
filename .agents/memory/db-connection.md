---
name: DB connection URL precedence
description: Which Postgres the API connects to and why DATABASE_URL must win over SUPABASE_DATABASE_URL.
---

# DB connection (`lib/db/src/index.ts`)

`db`/`pool` connect to `process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL`
(DATABASE_URL first).

**Why:** the repl has a stale `SUPABASE_DATABASE_URL` secret whose host
(`db.<ref>.supabase.co`) no longer resolves — DNS `ENOTFOUND` (the Supabase project was
paused/deleted). When the code preferred SUPABASE first, EVERY query (signup, login, all
routes) 500'd with "Failed query…", and the api-server vitest suite was "env-blocked"
with ENOTFOUND. The working DB is the Replit-provisioned Postgres in `DATABASE_URL`
(host `helium`), and `replit.md` documents DATABASE_URL as the required env. The Replit DB
already holds the full schema (users, profiles, analyses, chat_messages).

**How to apply:** if you see signup/login/any route 500 with a Postgres "Failed query" or
`getaddrinfo ENOTFOUND …supabase…`, the app is pointed at the dead Supabase host — keep
DATABASE_URL first (do not flip back to Supabase-first). To diagnose without printing
secrets, connect a `pg.Pool` to each URL and run `select 1`; log only the host + error code.
The api-server bundles via esbuild, so restart its workflow after changing `lib/db`.
