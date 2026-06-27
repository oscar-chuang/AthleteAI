"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Flame, Trophy, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { LineChart } from "@/components/LineChart";
import { MOCK_PROGRESS, MOCK_ACHIEVEMENTS, MOCK_ANALYSES } from "@/lib/athleteData";

type Key = "overall"|"technique"|"power"|"balance"|"consistency"|"mobility";

const METRICS: { key: Key; label: string; color: string }[] = [
  { key: "overall",     label: "Overall",     color: "#06b6d4" },
  { key: "technique",   label: "Technique",   color: "#8b5cf6" },
  { key: "power",       label: "Power",       color: "#10b981" },
  { key: "balance",     label: "Balance",     color: "#22d3ee" },
  { key: "consistency", label: "Consistency", color: "#f97316" },
  { key: "mobility",    label: "Mobility",    color: "#f59e0b" },
];

const SPORT_EMOJI: Record<string, string> = {
  weightlifting: "🏋️", basketball: "🏀", running: "🏃", golf: "⛳",
};

export default function ProgressPage() {
  const [activeKey,  setActiveKey]  = useState<Key>("overall");
  const [timeRange,  setTimeRange]  = useState<"1m"|"3m"|"all">("all");

  const metric = METRICS.find(m => m.key === activeKey)!;
  const allData = MOCK_PROGRESS.map(p => ({ date: p.date, value: p.scores[activeKey] }));

  const filtered = (() => {
    const now = new Date("2026-06-01");
    const days: Record<string, number> = { "1m": 30, "3m": 90, all: 999 };
    return allData.filter(d => (now.getTime() - new Date(d.date).getTime()) / 86400000 <= days[timeRange]);
  })();

  const first = filtered[0]?.value ?? 0;
  const last  = filtered[filtered.length - 1]?.value ?? 0;
  const delta = last - first;
  const unlockedAch = MOCK_ACHIEVEMENTS.filter(a => a.unlockedAt);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 90 }}>

      {/* ── Header ── */}
      <div className="px-5 pt-12 pb-5">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Progress</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>Your performance over time</p>
      </div>

      <div className="px-4 space-y-3">

        {/* ── Top stats ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: "📊", label: "Current Score", value: String(last), color: "#06b6d4" },
            { icon: "📈", label: "Total Gain",    value: `+${delta}`, color: "#10b981" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="text-xl">{s.icon}</span>
              <p className="text-3xl font-black mt-2 tabular-nums" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Streak + achievements */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.14)" }}>
            <Flame className="w-5 h-5 shrink-0" style={{ color: "#f97316" }} />
            <div>
              <p className="text-2xl font-black" style={{ color: "#f97316" }}>14</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Day Streak</p>
            </div>
          </div>
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.14)" }}>
            <Trophy className="w-5 h-5 shrink-0" style={{ color: "#f59e0b" }} />
            <div>
              <p className="text-2xl font-black" style={{ color: "#f59e0b" }}>{unlockedAch.length}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Unlocked</p>
            </div>
          </div>
        </div>

        {/* ── Trend chart ── */}
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {/* Header row */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-1"
                style={{ color: "var(--text-tertiary)" }}>Performance Trend</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black tabular-nums" style={{ color: metric.color }}>{last}</span>
                <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>/100</span>
                <div className="flex items-center gap-1 ml-2">
                  <ArrowUpRight className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
                  <span className="text-xs font-bold" style={{ color: "#10b981" }}>+{delta}</span>
                </div>
              </div>
            </div>
            {/* Time range */}
            <div className="flex items-center gap-1 p-1 rounded-lg"
              style={{ background: "var(--surface-2)" }}>
              {(["1m","3m","all"] as const).map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  className="text-xs px-2.5 py-1 rounded-md font-semibold transition-all"
                  style={{
                    background: timeRange === r ? metric.color + "22" : "transparent",
                    color: timeRange === r ? metric.color : "var(--text-tertiary)",
                  }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Metric pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
            {METRICS.map(m => (
              <button key={m.key} onClick={() => setActiveKey(m.key)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                style={{
                  background: activeKey === m.key ? `${m.color}1a` : "var(--surface-2)",
                  color: activeKey === m.key ? m.color : "var(--text-tertiary)",
                  border: `1px solid ${activeKey === m.key ? `${m.color}33` : "transparent"}`,
                }}>{m.label}</button>
            ))}
          </div>

          <LineChart data={filtered} color={metric.color} height={180} />
        </div>

        {/* ── Skills breakdown ── */}
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: "var(--text-tertiary)" }}>Skills Breakdown</p>
          <div className="space-y-4">
            {METRICS.slice(1).map(m => {
              const curr = MOCK_PROGRESS[MOCK_PROGRESS.length - 1].scores[m.key];
              const prev = MOCK_PROGRESS[MOCK_PROGRESS.length - 4].scores[m.key];
              const d    = curr - prev;
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{m.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold"
                        style={{ color: d >= 0 ? "#10b981" : "#f43f5e" }}>
                        {d >= 0 ? "+" : ""}{d}
                      </span>
                      <span className="text-sm font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{curr}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${curr}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg,${m.color}88,${m.color})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Session history ── */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-3 px-1"
            style={{ color: "var(--text-tertiary)" }}>Session History</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {MOCK_ANALYSES.map((a, i) => (
              <Link key={a.id} href={`/analysis/${a.id}`}>
                <div className="flex items-center gap-3.5 px-4 py-3.5 active:bg-white/5"
                  style={{ borderBottom: i < MOCK_ANALYSES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: "var(--surface-2)" }}>
                    {SPORT_EMOJI[a.sport] || "🏅"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(a.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="text-lg font-black tabular-nums shrink-0" style={{ color: "var(--accent)" }}>
                    {a.scores.overall}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Achievements ── */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-3 px-1"
            style={{ color: "var(--text-tertiary)" }}>Achievements</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {MOCK_ACHIEVEMENTS.map((ach, i) => (
              <div key={ach.id} className="flex items-center gap-3.5 px-4 py-3.5"
                style={{
                  borderBottom: i < MOCK_ACHIEVEMENTS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  opacity: ach.unlockedAt ? 1 : 0.4,
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{
                    background: ach.unlockedAt ? "rgba(245,158,11,0.1)" : "var(--surface-2)",
                    filter: ach.unlockedAt ? "none" : "grayscale(1)",
                  }}>
                  {ach.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{ach.title}</p>
                  {!ach.unlockedAt && (
                    <div className="mt-1">
                      <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(ach.progress/ach.total)*100}%`, background: "#06b6d4" }} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{ach.progress}/{ach.total}</p>
                    </div>
                  )}
                </div>
                {ach.unlockedAt && <span style={{ color: "#f59e0b" }}>✓</span>}
              </div>
            ))}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
