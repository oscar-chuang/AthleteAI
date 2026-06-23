import { db, analysesTable, profilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { analyzeAthletePerformance, type JointAngles, type JointRisks, type AIAnalysisResult } from "./anthropic";
import { cache } from "./redis";

export type BiomechanicsJobPayload = {
  analysisId: number;
  userId: number;
  frameBase64?: string | null;
};

type JobWorker = {
  close: () => Promise<void>;
};

let _worker: JobWorker | null = null;
let _queue: { add: (name: string, data: BiomechanicsJobPayload) => Promise<void> } | null = null;

async function processBiomechanicsJob(payload: BiomechanicsJobPayload): Promise<void> {
  const { analysisId, userId, frameBase64 } = payload;

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.id, analysisId), eq(analysesTable.userId, userId)));

  if (!row) {
    throw new Error(`Analysis ${analysisId} not found for user ${userId}`);
  }

  if (row.biomechanicsApplied) {
    console.log(`[queue] Analysis ${analysisId} already has biomechanics applied — skipping`);
    await cache.releaseLock(`lock:analysis:${analysisId}`);
    return;
  }

  const [profileRow] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const athleteProfile = profileRow
    ? {
        name: profileRow.name,
        level: profileRow.level,
        goals: profileRow.goals ?? [],
        injuryConcerns: profileRow.injuryConcerns ?? [],
      }
    : null;

  const jointAngles = row.jointAngles as JointAngles | null;
  const jointRisks = row.jointRisks as JointRisks | null;

  const result: AIAnalysisResult = await analyzeAthletePerformance(
    row.sport,
    row.title,
    row.videoUrl ?? undefined,
    athleteProfile,
    jointAngles,
    jointRisks,
    frameBase64 ?? null
  );

  const values = {
    status: "complete" as const,
    overallScore: result.overallScore,
    techniqueScore: result.techniqueScore,
    powerScore: result.powerScore,
    balanceScore: result.balanceScore,
    consistencyScore: result.consistencyScore,
    mobilityScore: result.mobilityScore,
    speedScore: result.speedScore,
    strengths: result.strengths,
    improvements: result.improvements,
    tips: result.tips as unknown as object[],
    injuryRisks: result.injuryRisks as unknown as object[],
    biomechanicsApplied: true,
  };

  await db
    .update(analysesTable)
    .set(values)
    .where(and(eq(analysesTable.id, analysisId), eq(analysesTable.biomechanicsApplied, false)));

  await cache.releaseLock(`lock:analysis:${analysisId}`);

  await cache.invalidate(`stats:${userId}`);
  await cache.invalidatePrefix(`progress:${userId}:`);

  console.log(`[queue] Biomechanics analysis complete for id=${analysisId}`);
}

export async function enqueueBiomechanicsJob(payload: BiomechanicsJobPayload): Promise<"queued" | "inline"> {
  if (_queue) {
    await _queue.add("biomechanics-analysis", payload);
    return "queued";
  }

  processBiomechanicsJob(payload).catch((err) => {
    console.error(`[queue] Inline biomechanics job failed for id=${payload.analysisId}:`, err);
    db.update(analysesTable)
      .set({ status: "failed" })
      .where(and(eq(analysesTable.id, payload.analysisId), eq(analysesTable.biomechanicsApplied, false)))
      .catch(() => {});
    cache.releaseLock(`lock:analysis:${payload.analysisId}`).catch(() => {});
  });
  return "inline";
}

export async function startWorker(): Promise<void> {
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) {
    console.warn("[queue] REDIS_URL not set — BullMQ worker disabled; jobs run inline");
    return;
  }

  try {
    const { Queue, Worker } = await import("bullmq");

    const connection = { url: redisUrl };

    const queue = new Queue("biomechanics-analysis", { connection });

    const worker = new Worker(
      "biomechanics-analysis",
      async (job) => {
        await processBiomechanicsJob(job.data as BiomechanicsJobPayload);
      },
      {
        connection,
        concurrency: 2,
      }
    );

    worker.on("failed", async (job, err) => {
      console.error(`[queue] Job ${job?.id} failed:`, err.message);
      if (job?.data) {
        const { analysisId } = job.data as BiomechanicsJobPayload;
        await db
          .update(analysesTable)
          .set({ status: "failed" })
          .where(and(eq(analysesTable.id, analysisId), eq(analysesTable.biomechanicsApplied, false)))
          .catch(() => {});
        await cache.releaseLock(`lock:analysis:${analysisId}`).catch(() => {});
      }
    });

    _queue = {
      add: async (name: string, data: BiomechanicsJobPayload) => {
        await queue.add(name, data);
      },
    };
    _worker = { close: async () => { await worker.close(); await queue.close(); } };

    console.log("[queue] BullMQ worker started");
  } catch (err) {
    console.error("[queue] Failed to start BullMQ worker — falling back to inline processing:", err);
  }
}

export async function stopWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
    _queue = null;
  }
}

export function _resetQueueForTesting(): void {
  _worker = null;
  _queue = null;
}
