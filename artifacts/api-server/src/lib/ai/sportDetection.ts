import { client, withRetry } from "./types";

export interface SportDetectionResult {
  sport: string;
  movementType: string;
}

export async function detectSportFromFrame(imageBase64: string): Promise<SportDetectionResult> {
  const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
  const message = await withRetry(() => client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 60,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: base64Data },
        },
        {
          type: "text",
          text: 'Identify the sport and specific movement being performed. Reply with ONLY two values separated by a pipe character: the sport name in lowercase, then the specific movement type in Title Case. Examples: "basketball|Jump Shot", "volleyball|Spike Approach", "running|Sprint Start", "weightlifting|Clean and Jerk", "tennis|Forehand Groundstroke", "swimming|Freestyle Stroke", "gymnastics|Back Handspring". Valid sports: fencing, tennis, basketball, running, weightlifting, swimming, gymnastics, wrestling, boxing, golf, cycling, soccer, volleyball, baseball, badminton, rowing, rugby, lacrosse, hockey. If you cannot identify the sport use "unknown|Unknown Movement". No other text.',
        },
      ],
    }]
  }));
  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const pipeIdx = raw.indexOf("|");
  if (pipeIdx === -1) {
    const sport = raw.toLowerCase().replace(/[^a-z\s]/g, "").trim() || "unknown";
    return { sport, movementType: "General" };
  }

  const sport = raw.slice(0, pipeIdx).toLowerCase().replace(/[^a-z\s]/g, "").trim() || "unknown";
  const movementType = raw.slice(pipeIdx + 1).trim().replace(/[^\w\s]/g, "").trim() || "General";
  return { sport, movementType };
}
