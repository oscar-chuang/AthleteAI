import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "./auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number().int().positive(),
  contentType: z.string(),
});

/**
 * POST /storage/uploads/request-url
 * Auth-protected — only signed-in users can upload files.
 * Client sends JSON metadata; receives a presigned S3/R2 URL to PUT the file directly.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "name, size (int), and contentType are required" });
    return;
  }

  try {
    const userId = String(req.userId);
    const { name, size, contentType } = parsed.data;
    const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(userId);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    console.error("Error generating upload URL", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 * Unconditionally public — serves files stored under the `public/` prefix in R2.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    const stream = file.createReadStream();
    Readable.from(stream).pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
    } else {
      res.status(500).json({ error: "Failed to serve file" });
    }
  }
});

/**
 * GET /storage/objects/*
 * Auth-protected — serves private uploaded files (e.g. training videos).
 */
router.get("/storage/objects/*filePath", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const userId = String(req.userId);

    // Strict ownership: ONLY allow paths in the exact format uploads/{userId}/{objectId}.
    const normalized = filePath.replace(/^\/+/, "");
    const match = normalized.match(/^uploads\/([^/]+)\/[^/]+$/);
    if (!match || match[1] !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const file = await objectStorageService.getObjectEntityFile(filePath);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType ?? "application/octet-stream");
    const stream = file.createReadStream();
    Readable.from(stream).pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
    } else {
      res.status(500).json({ error: "Failed to serve file" });
    }
  }
});

export default router;
