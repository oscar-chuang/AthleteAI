import sharp from "sharp";
import { db, profilesTable } from "@workspace/db";
import { isNotNull, eq } from "drizzle-orm";

const AVATAR_MAX_PX = 64;
const AVATAR_MAX_BYTES = 20 * 1024;

async function compressAvatarIfNeeded(avatarUrl: string): Promise<string> {
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

async function run() {
  console.log("Fetching profiles with avatars...");

  const rows = await db
    .select({ id: profilesTable.id, userId: profilesTable.userId, avatarUrl: profilesTable.avatarUrl })
    .from(profilesTable)
    .where(isNotNull(profilesTable.avatarUrl));

  console.log(`Found ${rows.length} profile(s) with an avatar.`);

  let skipped = 0;
  let compressed = 0;
  let errors = 0;

  for (const row of rows) {
    const original = row.avatarUrl!;

    try {
      const match = original.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!match) {
        console.log(`  Profile ${row.id} (user ${row.userId}): not a data-URL — skipping.`);
        skipped++;
        continue;
      }

      const originalBytes = Buffer.from(match[2], "base64").byteLength;
      if (originalBytes <= AVATAR_MAX_BYTES) {
        console.log(`  Profile ${row.id} (user ${row.userId}): already within limit (${originalBytes} B) — skipping.`);
        skipped++;
        continue;
      }

      console.log(`  Profile ${row.id} (user ${row.userId}): ${originalBytes} B — compressing...`);
      const updated = await compressAvatarIfNeeded(original);
      const updatedBytes = Buffer.from(updated.split(",")[1]!, "base64").byteLength;

      await db
        .update(profilesTable)
        .set({ avatarUrl: updated, updatedAt: new Date() })
        .where(eq(profilesTable.id, row.id));

      console.log(`    → compressed to ${updatedBytes} B`);
      compressed++;
    } catch (err) {
      console.error(`  Profile ${row.id} (user ${row.userId}): ERROR —`, err);
      errors++;
    }
  }

  console.log(
    `\nDone. ${compressed} compressed, ${skipped} already OK / non-data-URL, ${errors} error(s).`,
  );

  process.exit(errors > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
