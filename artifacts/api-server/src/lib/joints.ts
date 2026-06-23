export interface JointHistoryEntry {
  angle: number;
  risk: number;
}

export interface JointImprovement {
  joint: string;
  deltaDeg: number;
  sessions: number;
  improved: boolean;
}

/**
 * Given a list of sessions (each with jointAngles and jointRisks), compute
 * per-joint delta and improvement flag between the first and last data point.
 * Sessions must be ordered chronologically (oldest first).
 */
export function computeJointImprovements(
  sessions: Array<{
    jointAngles: Record<string, number> | null | undefined;
    jointRisks: Record<string, number> | null | undefined;
  }>
): JointImprovement[] {
  const jointHistory: Record<string, JointHistoryEntry[]> = {};

  for (const session of sessions) {
    if (!session.jointAngles || Object.keys(session.jointAngles).length === 0) continue;
    const angles = session.jointAngles;
    const risks = session.jointRisks ?? {};
    for (const [joint, angle] of Object.entries(angles)) {
      if (!jointHistory[joint]) jointHistory[joint] = [];
      jointHistory[joint]!.push({ angle, risk: risks[joint] ?? 0 });
    }
  }

  const improvements: JointImprovement[] = [];
  for (const [joint, history] of Object.entries(jointHistory)) {
    if (history.length < 2) continue;
    const first = history[0]!;
    const last = history[history.length - 1]!;
    const deltaDeg = Math.round(last.angle - first.angle);
    const riskDelta = first.risk - last.risk;
    const improved = riskDelta > 0 || (riskDelta === 0 && Math.abs(deltaDeg) >= 5 && last.risk < 2);
    if (improved || Math.abs(deltaDeg) >= 3) {
      improvements.push({ joint, deltaDeg, sessions: history.length, improved });
    }
  }
  return improvements;
}
