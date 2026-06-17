import { supabaseAdmin } from "@workspace/db";
import { randomUUID } from "crypto";

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "athlete-media";

export class SupabaseStorageService {
  /**
   * Generate a signed upload URL so the client can upload directly to Supabase Storage.
   */
  async getUploadUrl(userId: number): Promise<{ uploadUrl: string; objectPath: string }> {
    const objectId = randomUUID();
    const objectPath = `uploads/${userId}/${objectId}`;

    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (error) {
      throw new Error(`Failed to create signed upload URL: ${error.message}`);
    }

    return {
      uploadUrl: data.signedUrl,
      objectPath,
    };
  }

  /**
   * Get a public URL for a stored object.
   */
  getPublicUrl(objectPath: string): string {
    const { data } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(objectPath);

    return data.publicUrl;
  }

  /**
   * Get a signed download URL for private objects with expiration.
   */
  async getSignedUrl(objectPath: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(objectPath, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete an object from storage.
   */
  async deleteObject(objectPath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([objectPath]);

    if (error) {
      throw new Error(`Failed to delete object: ${error.message}`);
    }
  }

  /**
   * Check if a path is owned by a specific user (for auth checks).
   */
  isOwnedByUser(objectPath: string, userId: number): boolean {
    const normalized = objectPath.replace(/^\/+/, "");
    const match = normalized.match(/^uploads\/(\d+)\//);
    return match !== null && match[1] === String(userId);
  }

  /**
   * Upload a buffer directly (server-side).
   */
  async uploadBuffer(objectPath: string, buffer: Buffer, contentType: string): Promise<string> {
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload: ${error.message}`);
    }

    return this.getPublicUrl(objectPath);
  }

  /**
   * Download a file as a buffer (server-side).
   */
  async downloadAsBuffer(objectPath: string): Promise<Buffer> {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(objectPath);

    if (error) {
      throw new Error(`Failed to download: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * List objects in a path prefix.
   */
  async listObjects(prefix: string) {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list(prefix);

    if (error) {
      throw new Error(`Failed to list objects: ${error.message}`);
    }

    return data;
  }
}

export const supabaseStorage = new SupabaseStorageService();