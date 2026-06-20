/**
 * One-time migration: compress avatar data-URLs larger than 20 KB down to
 * a 64×64 JPEG so the profile table stays lean.
 *
 * Safe to re-run — rows that are already within the limit, or that store a
 * plain URL rather than a data-URI, are skipped without modification.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run migrate-avatars
 *
 * Requires DATABASE_URL to be set in the environment.
 */

import sharp from "sharp";
import { db, profilesTable } from "@workspace/db";
import { isNotNull, eq } from "drizzle-orm";
import { fileURLToPath } from "url";

export const AVATAR_MAX_PX = 64;
export const AVATAR_MAX_BYTES = 20 * 1024;

/**
 * Compress a data-URI avatar to ≤ 20 KB / 64×64 px JPEG.
 *
 * - Returns the input unchanged if it is not a recognised image data-URI.
 * - Returns the input unchanged if it is already within the size limit.
 * - Otherwise re-encodes via sharp, lowering quality until the output fits.
 */
export async function compressAvatarIfNeeded(avatarUrl: string): Promise<string> {
  const match = avatarUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return avatarUrl;

  const inputBuffer = Buffer.from(match[2], "base64");

  if (inputBuffer.byteLength <= AVATAR_MAX_BYTES) {
    return avatarUrl;
  }

  let quality = 80;
  let outputBuffer: Buffer;

  do {
    outputBuffer = await sharp(inputBuffer)
      .resize(AVATAR_MAX_PX, AVATAR_MAX_PX, { fit: "cover", position: "centre" })
      .jpeg({ quality })
      .toBuffer();
    quality -= 10;
  } while (outputBuffer.byteLength > AVATAR_MAX_BYTES && quality >= 20);

  return `data:image/jpeg;base64,${outputBuffer.toString("base64")}`;
}

export type ProcessRowResult = "skipped" | "compressed";

/**
 * Process a single profiles row.
 *
 * Extracted for testability — the caller supplies `updateFn` so tests can
 * inject a mock and assert whether (and with what value) the DB write fires.
 *
 * @param row      - The row to process (id, userId, avatarUrl).
 * @param updateFn - Async callback that persists the compressed data-URI.
 */
export async function processRow(
  row: { id: number; userId: number; avatarUrl: string },
  updateFn: (id: number, newUrl: string) => Promise<void>,
): Promise<ProcessRowResult> {
  const original = row.avatarUrl;

  const match = original.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return "skipped";
  }

  const originalBytes = Buffer.from(match[2], "base64").byteLength;
  if (originalBytes <= AVATAR_MAX_BYTES) {
    return "skipped";
  }

  const updated = await compressAvatarIfNeeded(original);
  await updateFn(row.id, updated);
  return "compressed";
}

export interface RunStats {
  skipped: number;
  compressed: number;
  errors: number;
}

/**
 * Process a batch of profile rows using the supplied update callback.
 *
 * Errors on individual rows are caught, counted, and logged — they do not
 * abort processing of subsequent rows.
 *
 * @param rows      - Profile rows to process.
 * @param updateFn  - Async callback that persists a compressed avatar URL.
 */
export async function runWithDeps(
  rows: Array<{ id: number; userId: number; avatarUrl: string }>,
  updateFn: (id: number, newUrl: string) => Promise<void>,
): Promise<RunStats> {
  let skipped = 0;
  let compressed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const result = await processRow(row, updateFn);
      if (result === "compressed") {
        compressed++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  Profile ${row.id} (user ${row.userId}): ERROR —`, err);
      errors++;
    }
  }

  return { skipped, compressed, errors };
}

async function main(): Promise<void> {
  console.log("Fetching profiles with avatars...");

  const rows = await db
    .select({ id: profilesTable.id, userId: profilesTable.userId, avatarUrl: profilesTable.avatarUrl })
    .from(profilesTable)
    .where(isNotNull(profilesTable.avatarUrl));

  console.log(`Found ${rows.length} profile(s) with an avatar.`);

  const stats = await runWithDeps(
    rows.map((r) => ({ id: r.id, userId: r.userId, avatarUrl: r.avatarUrl! })),
    async (id, newUrl) => {
      await db
        .update(profilesTable)
        .set({ avatarUrl: newUrl, updatedAt: new Date() })
        .where(eq(profilesTable.id, id));
    },
  );

  console.log(
    `\nDone. ${stats.compressed} compressed, ${stats.skipped} already OK / non-data-URL, ${stats.errors} error(s).`,
  );

  process.exit(stats.errors > 0 ? 1 : 0);
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
