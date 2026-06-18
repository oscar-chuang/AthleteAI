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

const THUMBNAIL_MAX_WIDTH = 160;
const THUMBNAIL_JPEG_QUALITY = 40;

async function resizeThumbnail(dataUrl: string): Promise<string> {
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
      const commaIdx = dataUrl.indexOf(",");
      if (commaIdx === -1) {
        console.warn(`  [${row.id}] skipped — malformed data-URL (no comma)`);
        skipped++;
        continue;
      }
      const raw = dataUrl.slice(commaIdx + 1);
      const inputBuf = Buffer.from(raw, "base64");

      const meta = await sharp(inputBuf).metadata();
      const width = meta.width ?? 0;

      if (width <= THUMBNAIL_MAX_WIDTH) {
        skipped++;
        continue;
      }

      const resized_url = await resizeThumbnail(dataUrl);

      await db
        .update(analysesTable)
        .set({ thumbnailUrl: resized_url })
        .where(sql`${analysesTable.id} = ${row.id}`);

      console.log(
        `  [${row.id}] resized ${width}px → ≤${THUMBNAIL_MAX_WIDTH}px ` +
          `(${(raw.length * 0.75 / 1024).toFixed(1)} KB → ` +
          `${(resized_url.slice(commaIdx + 1).length * 0.75 / 1024).toFixed(1)} KB)`
      );
      resized++;
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

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
