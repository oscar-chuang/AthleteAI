/**
 * One-time backfill: shrink thumbnailUrl data-URLs wider than 160 px.
 *
 * Safe to re-run — rows already at ≤ 160 px or with no data-URL thumbnail
 * are skipped without modification.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run backfill-thumbnails
 *
 * Requires DATABASE_URL to be set in the environment.
 */

import sharp from "sharp";
import { db, analysesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "url";

export const THUMBNAIL_MAX_WIDTH = 160;
export const THUMBNAIL_JPEG_QUALITY = 40;

export async function resizeThumbnail(dataUrl: string): Promise<string> {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) throw new Error("malformed data-URL: no comma found");
  const prefix = dataUrl.slice(0, commaIdx);
  const raw = dataUrl.slice(commaIdx + 1);
  const inputBuf = Buffer.from(raw, "base64");
  const outputBuf = await sharp(inputBuf)
    .resize({ width: THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMBNAIL_JPEG_QUALITY })
    .toBuffer();
  return `${prefix},${outputBuf.toString("base64")}`;
}

export type ProcessRowResult = "skipped" | "resized" | "errored";

/**
 * Process a single analyses row.
 *
 * Extracted for testability — the caller supplies `updateFn` so tests can
 * inject a mock and assert whether (and with what value) the DB write fires.
 *
 * @param row       - The row to process (id + thumbnailUrl).
 * @param updateFn  - Async callback that persists the resized data-URL for the given row id.
 */
export async function processRow(
  row: { id: number; thumbnailUrl: string },
  updateFn: (id: number, resizedUrl: string) => Promise<void>,
): Promise<ProcessRowResult> {
  const dataUrl = row.thumbnailUrl;
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    return "skipped"; // malformed — skip silently
  }

  const raw = dataUrl.slice(commaIdx + 1);
  const inputBuf = Buffer.from(raw, "base64");
  const meta = await sharp(inputBuf).metadata();
  const width = meta.width ?? 0;

  if (width <= THUMBNAIL_MAX_WIDTH) {
    return "skipped"; // already small enough — idempotent skip
  }

  const resizedUrl = await resizeThumbnail(dataUrl);
  await updateFn(row.id, resizedUrl);
  return "resized";
}

async function main(): Promise<void> {
  console.log("Fetching analyses rows with data-URL thumbnails…");

  const rows = await db
    .select({ id: analysesTable.id, thumbnailUrl: analysesTable.thumbnailUrl })
    .from(analysesTable)
    .where(
      sql`${analysesTable.thumbnailUrl} IS NOT NULL AND ${analysesTable.thumbnailUrl} LIKE 'data:%'`
    );

  console.log(`Found ${rows.length} rows with data-URL thumbnails.`);

  let skipped = 0;
  let resized = 0;
  let errored = 0;

  for (const row of rows) {
    const dataUrl = row.thumbnailUrl!;
    try {
      const result = await processRow(
        { id: row.id, thumbnailUrl: dataUrl },
        async (id, resizedUrl) => {
          const commaIdx = dataUrl.indexOf(",");
          const raw = dataUrl.slice(commaIdx + 1);
          await db
            .update(analysesTable)
            .set({ thumbnailUrl: resizedUrl })
            .where(sql`${analysesTable.id} = ${id}`);
          const meta = await sharp(Buffer.from(raw, "base64")).metadata();
          const origWidth = meta.width ?? 0;
          console.log(
            `  [${id}] resized ${origWidth}px → ≤${THUMBNAIL_MAX_WIDTH}px ` +
              `(${(raw.length * 0.75 / 1024).toFixed(1)} KB → ` +
              `${(resizedUrl.slice(commaIdx + 1).length * 0.75 / 1024).toFixed(1)} KB)`
          );
        },
      );
      if (result === "resized") {
        resized++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  [${row.id}] error — ${(err as Error).message}`);
      errored++;
    }
  }

  console.log(
    `\nDone. resized=${resized}, skipped=${skipped}, errors=${errored}`
  );

  process.exit(errored > 0 ? 1 : 0);
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
