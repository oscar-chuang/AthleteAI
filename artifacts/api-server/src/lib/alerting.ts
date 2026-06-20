/**
 * Lightweight alerting sink for operational events.
 *
 * - Always increments an in-process counter so metrics are available within the process.
 * - When ALERT_WEBHOOK_URL is set, POSTs a Slack-compatible payload so the on-call
 *   engineer is notified without having to watch logs.
 *
 * Failures in the alerting path are swallowed and logged — they must never affect
 * the caller's main control flow.
 *
 * ## Idempotency / retry safety
 * The caller may pass an `idempotencyKey` to guard against double-counting when the
 * webhook POST fails and the whole alert call is retried.  If the same key is seen
 * within DEDUP_WINDOW_MS the counter is NOT incremented again — only the webhook POST
 * is re-attempted.  When no key is supplied every call is treated as a new event
 * (backward-compatible default).
 */

const _counters: Record<string, number> = {};

/** Idempotency-key → expiry timestamp (ms). */
const _seenKeys = new Map<string, number>();

/** Window within which the same idempotency key is considered a retry, not a new event. */
export const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Returns how many times an event has been emitted since process start. */
export function getAlertCounter(event: string): number {
  return _counters[event] ?? 0;
}

/** Reset counter — only intended for use in tests. */
export function _resetAlertCounters(): void {
  for (const key of Object.keys(_counters)) {
    delete _counters[key];
  }
  _seenKeys.clear();
}

/** Directly increment a counter — only intended for use in tests. */
export function incrementAlertCounter(event: string, by = 1): void {
  _counters[event] = (_counters[event] ?? 0) + by;
}

export interface ThumbnailResizeAlertPayload {
  error: string;
  inputBytes: number;
  inputKB: number;
}

export interface EmitAlertOptions {
  /**
   * Caller-supplied key that uniquely identifies this logical failure event.
   * Pass the same key on every retry so that the in-process counter is only
   * incremented once, even if the webhook POST needs multiple attempts.
   */
  idempotencyKey?: string;
}

/**
 * Emit a `thumbnail_resize_failed` alert.
 *
 * Called by `resizeThumbnail()` when sharp cannot process the frame.
 * The caller already logs a structured warning — this function is responsible
 * only for forwarding the event to an external sink.
 */
export async function emitThumbnailResizeAlert(
  payload: ThumbnailResizeAlertPayload,
  options: EmitAlertOptions = {}
): Promise<void> {
  const { idempotencyKey } = options;
  const now = Date.now();

  // Evict expired keys to avoid unbounded memory growth.
  for (const [k, expiry] of _seenKeys) {
    if (now >= expiry) _seenKeys.delete(k);
  }

  // Only increment the counter when this is a genuinely new event.
  const isRetry =
    idempotencyKey !== undefined && _seenKeys.has(idempotencyKey);

  if (!isRetry) {
    _counters["thumbnail_resize_failed"] =
      (_counters["thumbnail_resize_failed"] ?? 0) + 1;

    if (idempotencyKey !== undefined) {
      _seenKeys.set(idempotencyKey, now + DEDUP_WINDOW_MS);
    }
  }

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const count = _counters["thumbnail_resize_failed"]!;

  try {
    const body = JSON.stringify({
      text: ":warning: *thumbnail_resize_failed* — a video frame was too large to shrink",
      attachments: [
        {
          color: "warning",
          fields: [
            {
              title: "Error",
              value: payload.error,
              short: false,
            },
            {
              title: "Input size",
              value: `${payload.inputKB} KB (${payload.inputBytes} bytes)`,
              short: true,
            },
            {
              title: "Count (this process)",
              value: String(count),
              short: true,
            },
          ],
          footer: "AthleteAI API — resize-thumbnail",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    });

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (webhookErr) {
    console.warn("alert_webhook_failed", {
      event: "thumbnail_resize_failed",
      error: (webhookErr as Error).message,
    });
  }
}
