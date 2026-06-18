/**
 * add-pending-task — append one task to pending-tasks.json without editing JSON.
 *
 * Usage:
 *   tsx scripts/src/add-pending-task.ts --id "#146" --title "Your task title"
 *
 * The --id and --title flags can appear in any order.
 * If the id already exists the entry is updated (not duplicated).
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, "../../pending-tasks.json");

// ── arg parsing ───────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const id    = arg("--id");
const title = arg("--title");

if (!id || !title) {
  console.error("Usage: tsx add-pending-task.ts --id \"#146\" --title \"Your task title\"");
  process.exit(1);
}

// ── read → update → write ─────────────────────────────────────────────────────

interface Task { id: string; title: string }

let tasks: Task[] = [];
try {
  tasks = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
} catch {
  // file doesn't exist yet — start fresh
}

const existing = tasks.findIndex(t => t.id === id);
if (existing !== -1) {
  tasks[existing] = { id, title };
  console.log(`Updated  ${id}: ${title}`);
} else {
  tasks.push({ id, title });
  console.log(`Added    ${id}: ${title}`);
}

writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2) + "\n");
console.log(`Saved to pending-tasks.json (${tasks.length} tasks total)`);
