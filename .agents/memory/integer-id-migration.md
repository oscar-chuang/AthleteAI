---
name: Integer ID migration
description: The GitHub codebase migrated all IDs from UUID strings to serial integers. Every place that treats IDs as strings now needs to be number.
---

## Rule
The DB schema now uses `serial("id")` (integer) for all primary keys and `integer("user_id")` for foreign keys. **Never pass string IDs to Drizzle `eq()` calls.**

## Changes required when editing routes

- `eq(table.id, req.params.id)` → `eq(table.id, Number(req.params.id))`
- `eq(table.userId, req.userId!)` — `req.userId` is now `number`; already correct if auth middleware is updated
- Function signatures: `runAnalysis(analysisId: string)` → `number`
- Zod schemas: `referencedAnalysisId: z.string().uuid()` → `z.number().int().positive()`

## Auth middleware
`AuthRequest.userId` is `number` (not string). `JwtPayload.userId` is `number`.

**Why:** The GitHub codebase replaced UUIDs with auto-increment integers throughout the DB schema. The Drizzle column types enforce this at the TypeScript level — passing a `string` to an `integer` column's `eq()` call is a compile error.

**How to apply:** Any new route handler that reads `req.params.id` must call `Number(req.params.id)`. Any new function that accepts an analysis or user ID should type it as `number`.
