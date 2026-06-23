import sharp from "sharp";

const AVATAR_MAX_PX = 64;
const AVATAR_MAX_BYTES = 20 * 1024;

/**
 * Compress a base64-encoded data-URI avatar to at most 64×64px JPEG.
 * Returns the original string unchanged if it is not a data URI.
 */
export async function compressAvatarIfNeeded(avatarUrl: string): Promise<string> {
  const match = avatarUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return avatarUrl;

  const inputBuffer = Buffer.from(match[2]!, "base64");

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
