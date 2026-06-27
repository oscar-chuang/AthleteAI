"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompare, Check, Search, X, ChevronRight, Upload } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { SkeletonViewer } from "@/components/SkeletonViewer";
import { VideoUploadCard } from "@/components/VideoUploadCard";
import { PRO_ATHLETES } from "@/lib/athleteData";

const SPORT_EMOJI: Record<string, string> = {
  golf: "⛳", basketball: "🏀", fencing: "🤺", tennis: "🎾",
  gymnastics: "🤸", running: "🏃", weightlifting: "🏋️",
};

const RESULTS = {
  similarity: 71,
  breakdown: [
    { label: "Elbow Alignment",  you: 87, pro: 88 },
    { label: "Release Height",   you: 78, pro: 95 },
    { label: "Jump Consistency", you: 72, pro: 97 },
    { label: "Wrist Snap",       you: 82, pro: 86 },
    { label: "Hip-Shoulder Sep.",you: 68, pro: 91 },
  ],
  recs: [
    "Straight vertical jump with alignment tape — 50 shots/day",
    "One-hand form shooting at 5 feet — 100 reps daily",
    "Hip rotation drill: hips 45ms before shoulders at apex",
  ],
};

export default function ComparePage() {
  const [selectedPro, setSelectedPro]   = useState<typeof PRO_ATHLETES[0] | null>(null);
  const [showModal, setShowModal]       = useState(false);
  const [filter, setFilter]             = useState("");
  const [uploaded, setUploaded]         = useState(false);
  const [analyzing, setAnalyzing]       = useState(false);
  const [results, setResults]           = useState(false);

  const filtered = PRO_ATHLETES.filter(a =>
    !filter || a.name.toLowerCase().includes(filter.toLowerCase())
  );

  const analyze = () => {
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setResults(true); }, 2800);
  };

  if (results) return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 90 }}>
      <div className="px-5 pt-12 pb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
            You vs Stephen Curry
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>Jump Shot · AI Comparison</p>
        </div>
        <button onClick={() => { setResults(false); setUploaded(false); setSelectedPro(null); }}
          className="text-xs px-3 py-1.5 rounded-xl font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          New
        </button>
      </div>

      <div className="px-4 space-y-3">
        {/* Similarity hero */}
        <div className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(145deg,#140a2e,#0d1828)", border: "1px solid rgba(139,92,246,0.18)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 60%)" }} />
          <p className="text-7xl font-black tabular-nums" style={{ color: "#a78bfa" }}>{RESULTS.similarity}%</p>
          <p className="text-sm mt-1 font-semibold" style={{ color: "var(--text-tertiary)" }}>Similarity Score</p>
          <div className="h-1.5 rounded-full mt-4 mx-4" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${RESULTS.similarity}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#8b5cf6,#06b6d4)" }} />
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
            Top 15% of athletes vs Curry. Your follow-through is nearly pro-level.
          </p>
        </div>

        {/* Side-by-side */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "You", sub: "Score 84", style: { border: "1px solid var(--border)" } },
            { label: "Curry", sub: "Elite", style: { border: "1px solid rgba(245,158,11,0.22)" } },
          ].map((side, i) => (
            <div key={side.label}>
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{side.label}</span>
                <span className="text-xs" style={{ color: i === 1 ? "#f59e0b" : "var(--text-tertiary)" }}>{side.sub}</span>
              </div>
              <div className="rounded-2xl overflow-hidden" style={side.style}>
                <SkeletonViewer sport="basketball" variant="basketball" className="h-44 border-0 rounded-none" />
              </div>
            </div>
          ))}
        </div>

        {/* Metric breakdown */}
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "var(--text-tertiary)" }}>
            Metric Breakdown
          </p>
          <div className="space-y-4">
            {RESULTS.breakdown.map(b => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span style={{ color: "#06b6d4" }}>You {b.you}</span>
                    <span style={{ color: "#f59e0b" }}>Pro {b.pro}</span>
                  </div>
                </div>
                <div className="relative h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="absolute h-full rounded-full opacity-25"
                    style={{ width: `${b.pro}%`, background: "#f59e0b" }} />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${b.you}%` }} transition={{ duration: 0.8 }}
                    className="absolute h-full rounded-full"
                    style={{ background: `linear-gradient(90deg,#06b6d466,#06b6d4)` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "var(--text-tertiary)" }}>
            How to Close the Gap
          </p>
          <div className="space-y-2.5">
            {RESULTS.recs.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{i + 1}</div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 90 }}>
      <div className="px-5 pt-12 pb-5">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Compare</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>Match your form against the best</p>
      </div>

      <div className="px-4 space-y-3">

        {/* Upload */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-2 px-1"
            style={{ color: "var(--text-tertiary)" }}>Your Video</p>
          <VideoUploadCard label="Upload Your Training Video" onUpload={() => setUploaded(true)} />
          {uploaded && (
            <div className="flex items-center gap-2 mt-2 px-1">
              <Check className="w-4 h-4" style={{ color: "#10b981" }} />
              <span className="text-sm font-semibold" style={{ color: "#10b981" }}>Video ready</span>
            </div>
          )}
        </div>

        {/* Pro picker */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-2 px-1"
            style={{ color: "var(--text-tertiary)" }}>Pro Athlete</p>
          {selectedPro ? (
            <div className="flex items-center gap-3.5 p-4 rounded-2xl"
              style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.18)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: "rgba(139,92,246,0.12)" }}>
                {SPORT_EMOJI[selectedPro.sport] || "🏅"}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{selectedPro.name}</p>
                <p className="text-xs mt-0.5 capitalize" style={{ color: "var(--text-tertiary)" }}>{selectedPro.specialty}</p>
              </div>
              <button onClick={() => setSelectedPro(null)}>
                <X className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowModal(true)} className="w-full py-10 rounded-2xl text-center"
              style={{ border: "2px dashed rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.03)" }}>
              <p className="text-3xl mb-2">🏆</p>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Select a Pro Athlete</p>
              <p className="text-xs mt-1 flex items-center justify-center gap-1" style={{ color: "#a78bfa" }}>
                Browse <ChevronRight className="w-3 h-3" />
              </p>
            </button>
          )}
        </div>

        {/* Popular picks */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-2 px-1"
            style={{ color: "var(--text-tertiary)" }}>Popular</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {PRO_ATHLETES.slice(0, 4).map((pro, i) => (
              <motion.button key={pro.id} whileTap={{ scale: 0.98 }} onClick={() => setSelectedPro(pro)}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left"
                style={{
                  background: selectedPro?.id === pro.id ? "rgba(139,92,246,0.08)" : "transparent",
                  borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: "var(--surface-2)" }}>
                  {SPORT_EMOJI[pro.sport] || "🏅"}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{pro.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{pro.specialty}</p>
                </div>
                {selectedPro?.id === pro.id
                  ? <Check className="w-4 h-4 shrink-0" style={{ color: "#a78bfa" }} />
                  : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <motion.button whileTap={{ scale: 0.97 }} disabled={!uploaded || analyzing} onClick={analyze}
          className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 disabled:opacity-40 btn-primary">
          {analyzing ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white" />
              Comparing mechanics…
            </>
          ) : (
            <><GitCompare className="w-5 h-5" /> Run AI Comparison</>
          )}
        </motion.button>

      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full rounded-t-3xl overflow-hidden"
              style={{ background: "var(--surface-2)", maxHeight: "80vh" }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-4"
                style={{ background: "rgba(255,255,255,0.15)" }} />
              <div className="px-4 pb-2">
                <p className="font-bold text-base mb-3" style={{ color: "var(--text-primary)" }}>Choose a Pro Athlete</p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--text-tertiary)" }} />
                  <input className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    placeholder="Search…" value={filter} onChange={e => setFilter(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="overflow-y-auto px-4 pb-10" style={{ maxHeight: "55vh" }}>
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {filtered.map((pro, i) => (
                    <button key={pro.id} onClick={() => { setSelectedPro(pro); setShowModal(false); }}
                      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left"
                      style={{
                        background: selectedPro?.id === pro.id ? "rgba(139,92,246,0.08)" : "var(--surface)",
                        borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: "var(--surface-2)" }}>
                        {SPORT_EMOJI[pro.sport] || "🏅"}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{pro.name}</p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: "var(--text-tertiary)" }}>{pro.sport} · {pro.specialty}</p>
                      </div>
                      {selectedPro?.id === pro.id && <Check className="w-4 h-4" style={{ color: "#a78bfa" }} />}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
