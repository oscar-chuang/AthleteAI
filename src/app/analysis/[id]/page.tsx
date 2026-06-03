"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, Info, ChevronRight,
  Dumbbell, Share2, GitCompare, Upload, X, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { ScoreRing } from "@/components/ScoreRing";
import { PoseVideoPlayer, type JointAngles } from "@/components/PoseVideoPlayer";
import { MOCK_ANALYSES } from "@/lib/athleteData";

const SEV = {
  info:     { bg: "rgba(6,182,212,0.07)",  border: "rgba(6,182,212,0.2)",   text: "#22d3ee", Icon: Info },
  warning:  { bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.2)",  text: "#f59e0b", Icon: AlertTriangle },
  critical: { bg: "rgba(244,63,94,0.07)",  border: "rgba(244,63,94,0.2)",   text: "#f43f5e", Icon: AlertTriangle },
};

function angleStatus(name: string, val: number): "good" | "warn" | "danger" {
  if (name.includes("Knee") && (val < 100 || val > 180)) return "warn";
  if (name.includes("Spine") && val > 15) return "danger";
  if (name.includes("Spine") && val > 8)  return "warn";
  return "good";
}

export default function AnalysisPage() {
  const analysis = MOCK_ANALYSES[0];
  const [tab, setTab]         = useState<"coaching" | "injury" | "drills">("coaching");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [liveAngles, setLiveAngles] = useState<JointAngles | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build angle rows — real if available, mock otherwise
  const angleRows = liveAngles
    ? [
        { label: "Left Knee",   value: `${liveAngles.leftKnee}°`,   status: angleStatus("Knee", liveAngles.leftKnee) },
        { label: "Right Knee",  value: `${liveAngles.rightKnee}°`,  status: angleStatus("Knee", liveAngles.rightKnee) },
        { label: "Left Hip",    value: `${liveAngles.leftHip}°`,    status: "good" as const },
        { label: "Right Hip",   value: `${liveAngles.rightHip}°`,   status: "good" as const },
        { label: "Spine Lean",  value: `${liveAngles.spineAngle}°`, status: angleStatus("Spine", liveAngles.spineAngle) },
        { label: "Left Elbow",  value: `${liveAngles.leftElbow}°`,  status: "good" as const },
      ]
    : [
        { label: "Hip Angle",   value: "112°", status: "warn" as const },
        { label: "Knee Angle",  value: "165°", status: "good" as const },
        { label: "Lumbar",      value: "18°",  status: "danger" as const },
        { label: "Shoulder",    value: "82°",  status: "good" as const },
      ];

  const statusColor = { good: "#10b981", warn: "#f59e0b", danger: "#f43f5e" };

  return (
    <div className="min-h-screen mb-nav" style={{ background: "var(--bg)" }}>
      <TopBar
        title={videoFile ? "Live Pose Analysis" : analysis.title}
        showBack
        right={
          <div className="flex items-center gap-2">
            {videoFile ? (
              <button onClick={() => { setVideoFile(null); setLiveAngles(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(244,63,94,0.1)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.22)" }}>
                <X className="w-3 h-3" /> Clear
              </button>
            ) : (
              <button onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(6,182,212,0.1)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.22)" }}>
                <Upload className="w-3 h-3" /> Upload
              </button>
            )}
            <input ref={inputRef} type="file" accept="video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setVideoFile(f); }} />
            <button className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <Share2 className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>
        }
      />

      <div className="px-4 pt-4 space-y-4 pb-4">

        {/* ── Video player with pose overlay ── */}
        <PoseVideoPlayer videoFile={videoFile} onAngles={setLiveAngles} />

        {/* Live indicator */}
        {videoFile && liveAngles && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span className="text-xs font-semibold" style={{ color: "#10b981" }}>
              Live pose detection active — {Object.values(liveAngles).filter(v => v > 0).length} joints tracked
            </span>
          </motion.div>
        )}

        {/* ── Joint angles grid ── */}
        <div>
          <h2 className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-tertiary)" }}>
            Joint Angles {liveAngles ? "· Live" : "· Demo"}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {angleRows.map(({ label, value, status }) => (
              <div key={label} className="p-3 rounded-xl flex items-center justify-between"
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${status === "danger" ? "rgba(244,63,94,0.2)" : status === "warn" ? "rgba(245,158,11,0.15)" : "var(--border)"}`,
                }}>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="text-sm font-black" style={{ color: statusColor[status] }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Score row ── */}
        <div className="py-2">
          <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--text-tertiary)" }}>Performance Scores</h2>
          <div className="flex items-center justify-around">
            <ScoreRing score={analysis.scores.overall}   size={80} label="Overall"   sublabel="/100" />
            <ScoreRing score={analysis.scores.technique} size={68} color="#8b5cf6" label="Technique" />
            <ScoreRing score={analysis.scores.power}     size={68} color="#10b981" label="Power" />
            <ScoreRing score={analysis.scores.balance}   size={68} color="#06b6d4" label="Balance" />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface)" }}>
          {(["coaching", "injury", "drills"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize"
              style={{
                background: tab === t ? "rgba(6,182,212,0.15)" : "transparent",
                color: tab === t ? "#22d3ee" : "var(--text-tertiary)",
              }}>
              {t === "injury" ? "Injury" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">

          {/* COACHING */}
          {tab === "coaching" && (
            <motion.div key="coaching" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Strengths */}
              <div className="p-4 rounded-2xl"
                style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
                  <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#10b981" }}>
                    What You&apos;re Doing Right
                  </span>
                </div>
                <div className="space-y-2">
                  {analysis.strengths.map((s) => (
                    <div key={s} className="flex items-start gap-2.5">
                      <div className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: "#10b981" }} />
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="space-y-2">
                <p className="text-xs font-bold tracking-wider uppercase px-1" style={{ color: "var(--text-tertiary)" }}>
                  Coaching Tips
                </p>
                {analysis.tips.map((tip) => {
                  const { bg, border, text, Icon } = SEV[tip.severity];
                  const open = expanded === tip.id;
                  return (
                    <motion.div key={tip.id} layout className="rounded-2xl overflow-hidden"
                      style={{ background: bg, border: `1px solid ${border}` }}
                      onClick={() => setExpanded(open ? null : tip.id)}>
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <Icon className="w-4 h-4 shrink-0" style={{ color: text }} />
                        <span className="text-sm font-semibold flex-1" style={{ color: text }}>{tip.title}</span>
                        <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-200"
                          style={{ color: text, transform: open ? "rotate(90deg)" : "none" }} />
                      </div>
                      <AnimatePresence>
                        {open && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="px-4 pb-4">
                            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>{tip.description}</p>
                            {tip.drill && (
                              <div className="p-3 rounded-xl" style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.14)" }}>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Dumbbell className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
                                  <span className="text-xs font-bold" style={{ color: "#22d3ee" }}>DRILL</span>
                                </div>
                                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{tip.drill}</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* INJURY */}
          {tab === "injury" && (
            <motion.div key="injury" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {analysis.injuryRisks.map((r) => {
                const col = r.risk > 50 ? "#f43f5e" : r.risk > 30 ? "#f59e0b" : "#10b981";
                const label = r.risk > 50 ? "High Risk" : r.risk > 30 ? "Moderate" : "Low Risk";
                return (
                  <div key={r.joint} className="p-4 rounded-2xl space-y-3"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{r.joint}</p>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: `${col}15`, color: col, border: `1px solid ${col}30` }}>
                        {label} · {r.risk}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${r.risk}%` }} transition={{ duration: 0.8 }}
                        className="h-full rounded-full" style={{ background: `linear-gradient(90deg,${col}66,${col})` }} />
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.description}</p>
                    <div className="flex items-start gap-2 p-2.5 rounded-xl"
                      style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.12)" }}>
                      <Dumbbell className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#22d3ee" }} />
                      <p className="text-xs leading-relaxed" style={{ color: "#22d3ee" }}>{r.prevention}</p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* DRILLS */}
          {tab === "drills" && (
            <motion.div key="drills" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {analysis.tips.filter(t => t.drill).map((t, i) => (
                <div key={t.id} className="p-4 rounded-2xl"
                  style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.14)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "rgba(6,182,212,0.15)", color: "#22d3ee" }}>{i + 1}</div>
                    <span className="text-sm font-semibold" style={{ color: "#22d3ee" }}>{t.title}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t.drill}</p>
                </div>
              ))}
              {analysis.improvements.map((imp, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{i + 1}</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{imp}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compare CTA */}
        <Link href="/compare">
          <motion.div whileTap={{ scale: 0.97 }} className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(139,92,246,0.15)" }}>
              <GitCompare className="w-5 h-5" style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#a78bfa" }}>Compare to Pro Athlete</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>See how your form stacks up</p>
            </div>
            <ChevronRight className="w-4 h-4 ml-auto" style={{ color: "#a78bfa" }} />
          </motion.div>
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
