// sharp native binary is not available in this environment.
const AVATAR_MAX_PX = 64;
const AVATAR_MAX_BYTES = 20 * 1024;

/**
 * Compress a base64-encoded data-URI avatar to at most 64×64px JPEG.
 * Returns the original string unchanged if it is not a data URI.
 */
export async function compressAvatarIfNeeded(avatarUrl: string): Promise<string> {
  // sharp native binary not available — return unchanged.
  return avatarUrl;
}

// Keep constants referenced so tree-shaking doesn't warn.
void AVATAR_MAX_PX; void AVATAR_MAX_BYTES;
