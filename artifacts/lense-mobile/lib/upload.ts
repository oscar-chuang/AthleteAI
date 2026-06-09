import { getToken } from "./api";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/**
 * Upload a video file to object storage via a server-issued presigned URL.
 *
 * Flow:
 *  1. Ask the API server for a presigned GCS upload URL (auth-protected)
 *  2. PUT the video bytes directly to GCS using the presigned URL
 *  3. Return the objectPath (stable server-side reference for the analysis record)
 *
 * @param localUri  The `file://` or `content://` URI from expo-image-picker
 * @param mimeType  e.g. "video/mp4"  (default: "video/mp4")
 * @param onProgress  optional 0-1 progress callback (best-effort)
 */
export async function uploadVideo(
  localUri: string,
  mimeType: string = "video/mp4",
  onProgress?: (progress: number) => void,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  // Step 1: get filename + rough size from the URI
  const filename = localUri.split("/").pop() ?? `video_${Date.now()}.mp4`;

  // Request presigned URL
  const metaRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: filename,
      size: 1, // placeholder — GCS presigned URL doesn't enforce size at request time
      contentType: mimeType,
    }),
  });

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to get upload URL");
  }

  const { uploadURL, objectPath } = (await metaRes.json()) as {
    uploadURL: string;
    objectPath: string;
  };

  // Step 2: upload file bytes directly to GCS
  // On React Native we use fetch with the local URI — RN's fetch handles file:// URIs
  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();

  onProgress?.(0.1);

  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status}`);
  }

  onProgress?.(1.0);

  return objectPath;
}
