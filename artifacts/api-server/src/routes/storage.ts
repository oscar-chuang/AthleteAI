import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { supabaseStorage } from "../lib/supabaseStorage";
import { requireAuth } from "./auth";

const router: IRouter = Router();

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number().int().positive(),
  contentType: z.string(),
});

/**
 * POST /storage/uploads/request-url
 * Auth-protected — only signed-in users can upload files.
 * Returns a signed Supabase Storage upload URL.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "name, size (int), and contentType are required" });
    return;
  }

  try {
    const userId = (req as any).userId as number;
    const { name, size, contentType } = parsed.data;
    const { uploadUrl, objectPath } = await supabaseStorage.getUploadUrl(userId);

    res.json({ uploadUrl, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    console.error("Error generating upload URL", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/objects/*
 * Auth-protected — returns a signed URL for private objects.
 */
router.get("/storage/objects/*", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params[0] as string;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const userId = (req as any).userId as number;

    if (!supabaseStorage.isOwnedByUser(filePath, userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const signedUrl = await supabaseStorage.getSignedUrl(filePath);
    res.json({ url: signedUrl });
  } catch (err) {
    console.error("Error serving file", err);
    res.status(500).json({ error: "Failed to serve file" });
  }
});

/**
 * GET /storage/public/*
 * Returns a public URL for non-sensitive files like thumbnails.
 */
router.get("/storage/public/*", async (req: Request, res: Response) => {
  try {
    const raw = req.params[0] as string;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const publicUrl = supabaseStorage.getPublicUrl(filePath);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error("Error serving public file", err);
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;