/**
 * classify-tasks — reads pending-tasks.json from the project root and prints
 * a BUILD / ASK FIRST / REJECT table using the rules in replit.md.
 *
 * Usage:
 *   tsx scripts/src/classify-tasks.ts                   # reads pending-tasks.json
 *   tsx scripts/src/classify-tasks.ts path/to/file.json # reads named file
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── types ────────────────────────────────────────────────────────────────────

export type Verdict = "BUILD" | "ASK FIRST" | "REJECT";

export interface Task {
  id: string;
  title: string;
  status?: string;
}

export interface ClassifiedTask extends Task {
  verdict: Verdict;
  reason: string;
}

// ── rule sets ─────────────────────────────────────────────────────────────────
// Checked in order: REJECT → ASK FIRST → BUILD (catch-all).

const REJECT_RULES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bcrop.?follow/i,
    reason: "Architecture violation: per-frame crop-following is explicitly banned in replit.md",
  },
  {
    pattern: /\bsupabase.first\b|\bswitch.*supabase\b/i,
    reason: "Architecture violation: DATABASE_URL must stay primary",
  },
  {
    pattern: /\bbypass.*biomechanics|biomechanics.*guard.*bypass\b/i,
    reason: "Architecture violation: biomechanicsApplied guard must not be bypassed",
  },
  {
    pattern: /\bchange.*jointAngles.*shape|change.*jointRisks.*shape|change.*frameBase64\b/i,
    reason: "Protected contract: shape change requires OpenAPI spec update first",
  },
];

const ASK_FIRST_RULES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bpayment|billing|stripe|revenuecat|subscription|pricing|checkout|monetis/i,
    reason: "Payments / billing",
  },
  {
    pattern: /\bauth(?:entication)?|login|sign.?in|sign.?up|signup|jwt|token storage|clerk\b/i,
    reason: "Authentication",
  },
  {
    pattern: /\bschema|migration|add.*column|drop.*column|rename.*table|new.*table|alter.*table|index change/i,
    reason: "Database schema change",
  },
  {
    pattern: /\bbulk.?delet|purge|wipe.*data|clear.*user.*data|delet.*all.*row/i,
    reason: "Data deletion",
  },
  {
    pattern: /\bmajor redesign|full.?screen.*overhaul|navigation restructure|new design system|ui overhaul/i,
    reason: "Major redesign",
  },
  {
    pattern: /\bnew.*third.?party|new.*oauth|new.*api key|new.*secret|new.*credential|new.*integration\b/i,
    reason: "New third-party integration",
  },
  {
    pattern: /\brate.?limit|cors policy|security audit|auth middleware/i,
    reason: "Security-sensitive change",
  },
  // Large-scope feature flags that touch multiple systems
  {
    pattern: /\bmovement breakdown|live skeleton playback.*coaching|biomechanics.*accuracy.*expand|biomechanics.*hardening|pipeline.*audit/i,
    reason: "Major new feature — verify scope before building",
  },
  {
    pattern: /\bredesign.*progress|progress.*redesign|full.*overhaul/i,
    reason: "Major redesign",
  },
  {
    pattern: /\bmigrate.*avatar|backfill.*avatar|migrate.*existing.*db/i,
    reason: "Bulk data mutation of existing rows",
  },
];

// Everything that reaches here is BUILD.

// ── classifier ────────────────────────────────────────────────────────────────

export function classify(task: Task): ClassifiedTask {
  const text = task.title;

  for (const rule of REJECT_RULES) {
    if (rule.pattern.test(text)) {
      return { ...task, verdict: "REJECT", reason: rule.reason };
    }
  }

  for (const rule of ASK_FIRST_RULES) {
    if (rule.pattern.test(text)) {
      return { ...task, verdict: "ASK FIRST", reason: rule.reason };
    }
  }

  // Derive a human-readable build reason from the title
  let reason = "Safe improvement";
  if (/\btest|spec\b/i.test(text))        reason = "Test coverage";
  else if (/\bfix|crash|broken|bug\b/i.test(text)) reason = "Bug fix";
  else if (/\bperformance|faster|smaller|optimis/i.test(text)) reason = "Performance";
  else if (/\banimat/i.test(text))        reason = "UX / animation";
  else if (/\bpoll?ish|empty state|loading|copy|spacing|access/i.test(text)) reason = "UX / polish";
  else if (/\bnotif/i.test(text))         reason = "Minor feature extension";
  else if (/\btap|swipe|gesture\b/i.test(text)) reason = "UX / interaction";
  else if (/\bshow|display|add.*badge|add.*label|add.*icon/i.test(text)) reason = "UX / display";
  else if (/\bsync|in sync|update.*header|keep.*updated/i.test(text)) reason = "Incomplete scope";

  return { ...task, verdict: "BUILD", reason };
}

// ── formatting ────────────────────────────────────────────────────────────────

const VERDICT_COLOR: Record<Verdict, string> = {
  "BUILD":     "\x1b[32m", // green
  "ASK FIRST": "\x1b[33m", // yellow
  "REJECT":    "\x1b[31m", // red
};
const RESET = "\x1b[0m";

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function printTable(tasks: ClassifiedTask[]) {
  const idW      = Math.max(4, ...tasks.map(t => t.id.length));
  const verdictW = 9;
  const reasonW  = Math.max(6, ...tasks.map(t => t.reason.length));
  const titleW   = Math.max(5, ...tasks.map(t => t.title.length));

  const sep = `+${"-".repeat(idW+2)}+${"-".repeat(verdictW+2)}+${"-".repeat(reasonW+2)}+${"-".repeat(Math.min(titleW, 60)+2)}+`;
  console.log(sep);
  console.log(`| ${pad("ID", idW)} | ${pad("VERDICT", verdictW)} | ${pad("REASON", reasonW)} | ${pad("TITLE", Math.min(titleW, 60))} |`);
  console.log(sep);

  for (const t of tasks) {
    const col   = VERDICT_COLOR[t.verdict];
    const title = t.title.length > 60 ? t.title.slice(0, 57) + "..." : t.title;
    console.log(
      `| ${pad(t.id, idW)} | ${col}${pad(t.verdict, verdictW)}${RESET} | ${pad(t.reason, reasonW)} | ${pad(title, 60)} |`
    );
  }
  console.log(sep);

  const counts = tasks.reduce((acc, t) => {
    acc[t.verdict] = (acc[t.verdict] ?? 0) + 1;
    return acc;
  }, {} as Record<Verdict, number>);

  console.log();
  console.log(`Summary:  ${VERDICT_COLOR["BUILD"]}BUILD ${counts["BUILD"] ?? 0}${RESET}   ${VERDICT_COLOR["ASK FIRST"]}ASK FIRST ${counts["ASK FIRST"] ?? 0}${RESET}   ${VERDICT_COLOR["REJECT"]}REJECT ${counts["REJECT"] ?? 0}${RESET}`);
  console.log();

  const buildTasks = tasks.filter(t => t.verdict === "BUILD");
  if (buildTasks.length) {
    console.log(`BUILD queue (will be worked in order):`);
    buildTasks.forEach((t, i) => console.log(`  ${i + 1}. [${t.id}] ${t.title}`));
    console.log();
  }

  const askTasks = tasks.filter(t => t.verdict === "ASK FIRST");
  if (askTasks.length) {
    console.log(`ASK FIRST — waiting for your approval:`);
    askTasks.forEach(t => console.log(`  • [${t.id}] ${t.title}  (${t.reason})`));
    console.log();
  }

  const rejectTasks = tasks.filter(t => t.verdict === "REJECT");
  if (rejectTasks.length) {
    console.log(`REJECT — will not build:`);
    rejectTasks.forEach(t => console.log(`  ✗ [${t.id}] ${t.title}  (${t.reason})`));
    console.log();
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataFile  = process.argv[2] ?? resolve(__dirname, "../../pending-tasks.json");

let raw: string;
try {
  raw = readFileSync(dataFile, "utf-8");
} catch {
  console.error(`Could not read ${dataFile}`);
  console.error(`Create pending-tasks.json at the project root with an array of { id, title } objects.`);
  process.exit(1);
}

const tasks: Task[] = JSON.parse(raw);
const classified    = tasks.map(classify);
printTable(classified);
