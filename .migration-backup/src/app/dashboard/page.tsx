"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Flame, ChevronRight, Zap, Plus, Activity } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ScoreRing } from "@/components/ScoreRing";
import { VideoUploadCard } from "@/components/VideoUploadCard";
import { MOCK_ANALYSES, MOCK_ACHIEVEMENTS, MOCK_ATHLETE } from "@/lib/athleteData";

const SPORT_EMOJI: Record<string, string> = {
  weightlifting: "🏋️", basketball: "🏀", running: "🏃",
  golf: "⛳", fencing: "🤺", tennis: "🎾",
};

export default function Dashboard() {
  const [showUpload, setShowUpload] = useState(false);
  const latest   = MOCK_ANALYSES[0];
  const unlocked = MOCK_ACHIEVEMENTS.filter(a => a.unlockedAt);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 90 }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#06b6d4,#0891b2)", boxShadow: "0 0 12px rgba(6,182,212,0.35)" }}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight" style={{ color: "var(--text-primary)" }}>AthleteAI</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.18)" }}>
            <Flame className="w-3 h-3" style={{ color: "#f97316" }} />
            <span className="text-xs font-bold" style={{ color: "#f97316" }}>14d streak</span>
          </div>
          <button className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Bell className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-3">

        {/* ── Hero card ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #0f2240 0%, #0d1828 60%, #060a10 100%)", border: "1px solid rgba(6,182,212,0.12)" }}>
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
            style={{ background: "radial-gradient(circle at top right, rgba(6,182,212,0.12) 0%, transparent 65%)" }} />

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Good morning,</p>
              <h1 className="text-2xl font-black tracking-tight mt-0.5" style={{ color: "var(--text-primary)" }}>
                Alex Rivera
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold" style={{ color: "#10b981" }}>
                  +3 pts since last session
                </span>
              </div>
            </div>
            <ScoreRing score={latest.scores.overall} size={84} sublabel="/100" />
          </div>

          {/* Weekly goal */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>Weekly Goal</span>
              <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                {MOCK_ATHLETE.weeklyProgress} / {MOCK_ATHLETE.weeklyGoal} sessions
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div initial={{ width: 0 }}
                animate={{ width: `${(MOCK_ATHLETE.weeklyProgress / MOCK_ATHLETE.weeklyGoal) * 100}%` }}
                transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1], delay: 0.3 }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#06b6d4,#22d3ee)", boxShadow: "0 0 8px rgba(6,182,212,0.5)" }} />
            </div>
          </div>
        </motion.div>

        {/* ── Skill tiles ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Technique", value: latest.scores.technique, color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
            { label: "Power",     value: latest.scores.power,     color: "#10b981", bg: "rgba(16,185,129,0.08)" },
            { label: "Balance",   value: latest.scores.balance,   color: "#06b6d4", bg: "rgba(6,182,212,0.08)"  },
          ].map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="rounded-2xl p-3.5 flex flex-col items-center gap-2"
              style={{ background: m.bg, border: `1px solid ${m.color}22` }}>
              <span className="text-2xl font-black tabular-nums" style={{ color: m.color }}>{m.value}</span>
              <div className="w-full h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.color }} />
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{m.label}</span>
            </motion.div>
          ))}
        </div>

        {/* ── Analyze CTA ── */}
        <AnimatePresence mode="wait">
          {showUpload ? (
            <motion.div key="upload" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}>
              <VideoUploadCard label="Upload Training Video"
                onUpload={() => setTimeout(() => setShowUpload(false), 3500)} />
            </motion.div>
          ) : (
            <motion.button key="cta" whileTap={{ scale: 0.98 }} onClick={() => setShowUpload(true)}
              className="w-full flex items-center gap-4 rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 btn-primary">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>New Analysis</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  Upload video for AI pose detection
                </p>
              </div>
              <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ color: "var(--text-tertiary)" }} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Recent sessions ── */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "var(--text-tertiary)" }}>Recent Sessions</span>
            <Link href="/progress">
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>See all</span>
            </Link>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {MOCK_ANALYSES.map((a, i) => (
              <Link key={a.id} href={`/analysis/${a.id}`}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3.5 px-4 py-3.5 active:bg-white/5"
                  style={{ borderBottom: i < MOCK_ANALYSES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: "var(--surface-2)" }}>
                    {SPORT_EMOJI[a.sport] || "🏅"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(a.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      &ensp;·&ensp;{a.duration}s
                      {a.comparedTo && <span className="ml-1.5 px-1.5 py-0.5 rounded-sm text-xs"
                        style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>vs Pro</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xl font-black tabular-nums" style={{ color: "var(--accent)" }}>
                      {a.scores.overall}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Achievements ── */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "var(--text-tertiary)" }}>Achievements</span>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {unlocked.length} / {MOCK_ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {MOCK_ACHIEVEMENTS.map(ach => (
              <div key={ach.id} className="shrink-0 flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: ach.unlockedAt ? "var(--surface-2)" : "var(--surface)",
                    border: `1px solid ${ach.unlockedAt ? "rgba(245,158,11,0.2)" : "var(--border)"}`,
                    filter: ach.unlockedAt ? "none" : "grayscale(1)",
                    opacity: ach.unlockedAt ? 1 : 0.35,
                  }}>
                  {ach.icon}
                </div>
                <span className="text-xs w-12 text-center truncate"
                  style={{ color: ach.unlockedAt ? "var(--text-secondary)" : "var(--text-tertiary)" }}>
                  {ach.title.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── AI Coach ── */}
        <Link href="/chat">
          <motion.div whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 rounded-2xl p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Ask AI Coach</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                "What should I work on this week?"
              </p>
            </div>
            <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ color: "var(--text-tertiary)" }} />
          </motion.div>
        </Link>

      </div>
      <BottomNav />
    </div>
  );
}
