export type DayDotStatus = "trained" | "rest" | "missed" | "today" | "future";

export interface DayDot {
  dateStr: string;
  dayIdx: number;
  status: DayDotStatus;
}

/**
 * Classify each of the seven days in a rolling window ending today.
 *
 * @param lastSevenDays   ISO date strings, oldest first, length 7
 * @param todayStr        ISO date string for today
 * @param trainedDaysSet  Set of ISO date strings on which sessions were completed
 * @param trainingDaysSet Set of week-day indices (0=Sun … 6=Sat) that are scheduled training days
 */
export function classifyWeekDots(
  lastSevenDays: string[],
  todayStr: string,
  trainedDaysSet: Set<string>,
  trainingDaysSet: Set<number>,
): DayDot[] {
  return lastSevenDays.map((day) => {
    const dayIdx = new Date(day + "T12:00:00").getDay();
    const trained = trainedDaysSet.has(day);
    const isToday = day === todayStr;
    const isRestDay = !trainingDaysSet.has(dayIdx);
    const isPast = day < todayStr;
    const isMissed = isPast && !trained && !isRestDay;

    let status: DayDotStatus;
    if (trained) {
      status = "trained";
    } else if (isRestDay) {
      status = "rest";
    } else if (isToday) {
      status = "today";
    } else if (isMissed) {
      status = "missed";
    } else {
      status = "future";
    }

    return { dateStr: day, dayIdx, status };
  });
}
