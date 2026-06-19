/**
 * Lightweight alerting sink for operational events.
 *
 * - Always increments an in-process counter so metrics are available within the process.
 * - When ALERT_WEBHOOK_URL is set, POSTs a Slack-compatible payload so the on-call
 *   engineer is notified without having to watch logs.
 *
 * Failures in the alerting path are swallowed and logged — they must never affect
 * the caller's main control flow.
 */

const _counters: Record<string, number> = {};

/** Returns how many times an event has been emitted since process start. */
export function getAlertCounter(event: string): number {
  return _counters[event] ?? 0;
}

/** Reset counter — only intended for use in tests. */
export function _resetAlertCounters(): void {
  for (const key of Object.keys(_counters)) {
    delete _counters[key];
  }
}

export interface ThumbnailResizeAlertPayload {
  error: string;
  inputBytes: number;
  inputKB: number;
}

/**
 * Emit a `thumbnail_resize_failed` alert.
 *
 * Called by `resizeThumbnail()` when sharp cannot process the frame.
 * The caller already logs a structured warning — this function is responsible
 * only for forwarding the event to an external sink.
 */
export async function emitThumbnailResizeAlert(
  payload: ThumbnailResizeAlertPayload
): Promise<void> {
  _counters["thumbnail_resize_failed"] =
    (_counters["thumbnail_resize_failed"] ?? 0) + 1;

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
