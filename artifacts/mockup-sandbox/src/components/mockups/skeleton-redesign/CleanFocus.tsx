import { useState } from "react";
import { ChevronLeft, Share2, AlertTriangle, ChevronDown, ChevronUp, Zap, BookOpen, CheckCircle } from "lucide-react";

const JOINTS = [
  { label: "Left Knee", angle: "145°", level: 2, color: "#ef4444", bg: "#ef444422" },
  { label: "Right Hip", angle: "52°", level: 1, color: "#f97316", bg: "#f9731622" },
  { label: "Left Elbow", angle: "162°", level: 0, color: "#2F7BFF", bg: "#2F7BFF22" },
  { label: "Right Knee", angle: "138°", level: 0, color: "#22C55E", bg: "#22C55E22" },
];

const TIPS = [
  {
    joint: "Left Knee",
    color: "#ef4444",
    risk: 82,
    title: "Knee valgus at peak load",
    body: "Your left knee collapses inward during the descent phase. This places significant stress on the ACL and medial collateral ligament.",
    drill: "Single-leg glute bridges (3×12) — activate the glute med before your next session.",
    source: "Hewett et al. (2005) Am J Sports Med",
  },
  {
    joint: "Right Hip",
    color: "#f97316",
    risk: 58,
    title: "Hip hinge depth limited",
    body: "Hip flexion peaks at 52° — below the 55–65° optimal range for squatting. Tight hip flexors are likely limiting your depth.",
    drill: "90/90 hip stretch (2 min each side) — daily before training.",
    source: "Schoenfeld (2010) J Strength Cond Res",
  },
];

export function CleanFocus() {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [drillDone, setDrillDone] = useState<Record<number, boolean>>({});

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff", maxWidth: 390, margin: "0 auto", overflowY: "auto" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", paddingBottom: 8, paddingInline: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginRight: "auto" }}>9:41</span>
        <span style={{ fontSize: 12, color: "#fff", opacity: 0.6 }}>●●●</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", paddingInline: 16, paddingBottom: 12, gap: 12 }}>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>Movement Analysis</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Weightlifting · Back Squat</div>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Share2 size={16} color="#fff" />
        </button>
      </div>

      {/* Hero — worst frame with skeleton overlay */}
      <div style={{ marginInline: 16, borderRadius: 20, overflow: "hidden", position: "relative", aspectRatio: "9/13", background: "linear-gradient(160deg, #1a1a2e 0%, #0d1117 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Simulated athlete silhouette */}
        <svg width="100%" height="100%" viewBox="0 0 300 430" style={{ position: "absolute", inset: 0 }}>
          {/* Background gradient */}
          <defs>
            <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="300" height="430" fill="url(#bgGrad)" />

          {/* Skeleton bones */}
          {/* Torso */}
          <line x1="150" y1="100" x2="150" y2="210" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round"/>
          {/* Shoulders */}
          <line x1="110" y1="120" x2="190" y2="120" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round"/>
          {/* Left arm */}
          <line x1="110" y1="120" x2="90" y2="180" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="90" y1="180" x2="75" y2="230" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>
          {/* Right arm */}
          <line x1="190" y1="120" x2="210" y2="180" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="210" y1="180" x2="225" y2="230" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round"/>
          {/* Hips */}
          <line x1="120" y1="210" x2="180" y2="210" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round"/>
          {/* Left leg — knee valgus (highlighted red) */}
          <line x1="120" y1="210" x2="138" y2="300" stroke="#ef4444" strokeWidth="4" strokeLinecap="round"/>
          <line x1="138" y1="300" x2="122" y2="390" stroke="#ef4444" strokeWidth="4" strokeLinecap="round"/>
          {/* Right leg */}
          <line x1="180" y1="210" x2="172" y2="300" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="172" y1="300" x2="178" y2="390" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>

          {/* Joint dots */}
          <circle cx="150" cy="98" r="5" fill="rgba(255,255,255,0.5)"/>
          <circle cx="110" cy="120" r="4" fill="#60a5fa"/>
          <circle cx="190" cy="120" r="4" fill="#a78bfa"/>
          <circle cx="150" cy="210" r="5" fill="#f97316"/>
          {/* Left knee — red (flagged) */}
          <circle cx="138" cy="300" r="9" fill="#ef4444" opacity="0.9"/>
          <circle cx="138" cy="300" r="14" fill="#ef4444" opacity="0.2"/>
          <circle cx="172" cy="300" r="6" fill="#22C55E"/>
          <circle cx="75" cy="230" r="4" fill="#60a5fa"/>
          <circle cx="225" cy="230" r="4" fill="#a78bfa"/>

          {/* Angle callout for left knee */}
          <rect x="155" y="284" width="68" height="24" rx="6" fill="#ef4444" opacity="0.9"/>
          <text x="189" y="300" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">145° knee</text>
        </svg>

        {/* Risk badge overlay */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          background: "rgba(239,68,68,0.15)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 10, padding: "5px 10px",
          display: "flex", alignItems: "center", gap: 6
        }}>
          <AlertTriangle size={13} color="#ef4444" />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>HIGH RISK · Left Knee</span>
        </div>

        {/* Score badge */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "5px 10px",
          display: "flex", alignItems: "center", gap: 6
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#2F7BFF" }}>75</span>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>/ 100</span>
        </div>

        {/* Bottom label */}
        <div style={{
          position: "absolute", bottom: 12, left: 12, right: 12,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
          borderRadius: 10, padding: "6px 10px",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>Worst form captured</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>0:08</span>
        </div>
      </div>

      {/* Joint pills */}
      <div style={{ paddingInline: 16, marginTop: 14 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Joint Angles</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {JOINTS.map((j) => (
            <div key={j.label} style={{
              background: j.bg,
              border: `1px solid ${j.color}44`,
              borderRadius: 20, padding: "6px 12px",
              display: "flex", alignItems: "center", gap: 6
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: j.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: j.color }}>{j.angle}</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{j.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coaching tips */}
      <div style={{ paddingInline: 16, marginTop: 20, paddingBottom: 32 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Coaching Tips</div>

        {TIPS.map((tip, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${expanded === i ? tip.color + "55" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 16, marginBottom: 10, overflow: "hidden",
            transition: "border-color 0.2s"
          }}>
            {/* Header row */}
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                width: "100%", padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
                background: "transparent", border: "none", cursor: "pointer", textAlign: "left"
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: tip.color + "22",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <AlertTriangle size={16} color={tip.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{tip.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{tip.joint} · {tip.risk}% risk</div>
              </div>
              {/* Risk bar */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${tip.risk}%`, height: "100%", background: tip.color, borderRadius: 2 }} />
                </div>
                {expanded === i ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
              </div>
            </button>

            {/* Expanded content */}
            {expanded === i && (
              <div style={{ padding: "0 16px 16px" }}>
                <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, marginBottom: 12 }}>{tip.body}</div>

                {/* Drill card */}
                <div style={{
                  background: "rgba(47,123,255,0.08)", border: "1px solid rgba(47,123,255,0.2)",
                  borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "flex-start",
                  marginBottom: 10
                }}>
                  <Zap size={14} color="#2F7BFF" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#2F7BFF", fontWeight: 700, marginBottom: 3 }}>TRY THIS DRILL</div>
                    <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5 }}>{tip.drill}</div>
                  </div>
                </div>

                {/* Mark done button */}
                <button
                  onClick={() => setDrillDone(d => ({ ...d, [i]: !d[i] }))}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 10,
                    background: drillDone[i] ? "#22C55E22" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${drillDone[i] ? "#22C55E55" : "rgba(255,255,255,0.1)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    cursor: "pointer", color: drillDone[i] ? "#22C55E" : "#9ca3af", fontSize: 13, fontWeight: 600
                  }}
                >
                  <CheckCircle size={14} />
                  {drillDone[i] ? "Drill completed!" : "Mark drill done"}
                </button>

                {/* Source */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
                  <BookOpen size={10} color="#4b5563" />
                  <span style={{ fontSize: 10, color: "#4b5563" }}>{tip.source}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Ask coach CTA */}
        <button style={{
          width: "100%", padding: "14px 20px",
          background: "linear-gradient(135deg, #2F7BFF22, #2F7BFF11)",
          border: "1px solid rgba(47,123,255,0.3)",
          borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer", marginTop: 4
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: "#2F7BFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 14 }}>🤖</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2F7BFF" }}>Ask AI Coach</span>
        </button>
      </div>
    </div>
  );
}
