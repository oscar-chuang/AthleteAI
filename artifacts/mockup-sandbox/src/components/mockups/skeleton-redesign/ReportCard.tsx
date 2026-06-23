import { useState } from "react";
import { ChevronLeft, Share2, ChevronDown, ChevronUp, Zap } from "lucide-react";

const SCORE = 75;
const ARC_R = 88;
const ARC_CX = 110;
const ARC_CY = 116;
const CIRCUMFERENCE = Math.PI * ARC_R;

function ScoreArc({ score }: { score: number }) {
  const pct = score / 100;
  const filled = CIRCUMFERENCE * pct;
  const color = score >= 80 ? "#22C55E" : score >= 60 ? "#f97316" : "#ef4444";
  return (
    <svg width={220} height={130} viewBox="0 0 220 130" style={{ overflow: "visible" }}>
      {/* Track */}
      <path
        d={`M ${ARC_CX - ARC_R} ${ARC_CY} A ${ARC_R} ${ARC_R} 0 0 1 ${ARC_CX + ARC_R} ${ARC_CY}`}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={12} strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${ARC_CX - ARC_R} ${ARC_CY} A ${ARC_R} ${ARC_R} 0 0 1 ${ARC_CX + ARC_R} ${ARC_CY}`}
        fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      {/* Score number */}
      <text x={ARC_CX} y={ARC_CY - 18} textAnchor="middle" fill="white" fontSize={46} fontWeight={800} fontFamily="Inter, sans-serif">{score}</text>
      <text x={ARC_CX} y={ARC_CY - 2} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={11} fontWeight={600} fontFamily="Inter, sans-serif" letterSpacing="0.08em">OUT OF 100</text>
    </svg>
  );
}

function MiniSkeleton({ highlight }: { highlight: "knee" | "hip" | null }) {
  return (
    <svg width={52} height={72} viewBox="0 0 52 72">
      <circle cx={26} cy={6} r={5} fill="rgba(255,255,255,0.3)" />
      <line x1={26} y1={11} x2={26} y2={28} stroke="rgba(255,255,255,0.2)" strokeWidth={2}/>
      <line x1={14} y1={17} x2={38} y2={17} stroke="rgba(255,255,255,0.2)" strokeWidth={2}/>
      <line x1={14} y1={17} x2={9}  y2={29} stroke="#a78bfa" strokeWidth={1.5}/>
      <line x1={38} y1={17} x2={43} y2={29} stroke="#60a5fa" strokeWidth={1.5}/>
      <line x1={20} y1={28} x2={32} y2={28} stroke="rgba(255,255,255,0.2)" strokeWidth={2}/>
      <line x1={20} y1={28} x2={24} y2={46} stroke={highlight === "knee" ? "#ef4444" : "#a78bfa"} strokeWidth={highlight === "knee" ? 2.5 : 1.5}/>
      <line x1={24} y1={46} x2={20} y2={64} stroke={highlight === "knee" ? "#ef4444" : "#a78bfa"} strokeWidth={highlight === "knee" ? 2.5 : 1.5}/>
      <line x1={32} y1={28} x2={34} y2={46} stroke="#60a5fa" strokeWidth={1.5}/>
      <line x1={34} y1={46} x2={36} y2={64} stroke="#60a5fa" strokeWidth={1.5}/>
      <circle cx={26} cy={highlight === "hip" ? 28 : 28} r={4} fill={highlight === "hip" ? "#f97316" : "rgba(255,255,255,0.25)"}/>
      <circle cx={24} cy={46} r={highlight === "knee" ? 5 : 3} fill={highlight === "knee" ? "#ef4444" : "#a78bfa"} opacity={0.9}/>
      {highlight === "knee" && <circle cx={24} cy={46} r={9} fill="#ef4444" opacity={0.15}/>}
    </svg>
  );
}

const ISSUES = [
  {
    n: "01", color: "#ef4444", joint: "Left Knee", risk: 82,
    title: "Knee valgus at peak load",
    summary: "Knee collapses inward at peak depth — stresses ACL and MCL.",
    drill: "Single-leg glute bridges 3×12 before next session.",
    highlight: "knee" as const,
  },
  {
    n: "02", color: "#f97316", joint: "Right Hip", risk: 58,
    title: "Hip depth limited",
    summary: "Hip flexion peaks at 52° — below optimal range. Likely tight hip flexors.",
    drill: "90/90 hip stretch, 2 min each side daily.",
    highlight: "hip" as const,
  },
];

const JOINT_BARS = [
  { label: "L. Knee",  pct: 82, color: "#ef4444" },
  { label: "R. Hip",   pct: 58, color: "#f97316" },
  { label: "L. Elbow", pct: 18, color: "#22C55E" },
  { label: "R. Knee",  pct: 22, color: "#22C55E" },
];

export function ReportCard() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div style={{ background: "#070710", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff", maxWidth: 390, margin: "0 auto", overflowY: "auto" }}>
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", paddingBottom: 8, paddingInline: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: "auto" }}>9:41</span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>●●●</span>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", paddingInline: 16, paddingBottom: 8, gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="#fff"/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Weightlifting · Back Squat</div>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Share2 size={15} color="#fff"/>
        </button>
      </div>

      {/* Score hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, paddingBottom: 6 }}>
        <ScoreArc score={SCORE}/>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f97316", letterSpacing: "0.1em", marginTop: 4 }}>NEEDS IMPROVEMENT</div>
        <div style={{ fontSize: 12, color: "#374151", marginTop: 3 }}>Jun 23, 2026 · 0:18 clip</div>
      </div>

      {/* Joint risk heatbar */}
      <div style={{ marginInline: 20, marginTop: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>Joint Risk Overview</div>
        {JOINT_BARS.map(j => (
          <div key={j.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
            <span style={{ width: 60, fontSize: 11, color: "#6b7280", textAlign: "right", flexShrink: 0 }}>{j.label}</span>
            <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${j.pct}%`, height: "100%", background: j.color, borderRadius: 3, transition: "width 0.6s ease" }}/>
            </div>
            <span style={{ width: 32, fontSize: 11, color: j.color, fontWeight: 700, flexShrink: 0 }}>{j.pct}%</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 18 }}/>

      {/* Issues */}
      <div style={{ paddingInline: 16, paddingBottom: 100 }}>
        <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
          {ISSUES.length} Issues Found
        </div>

        {ISSUES.map((issue, i) => (
          <div key={i} style={{
            borderRadius: 18, marginBottom: 12, overflow: "hidden",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${open === i ? issue.color + "40" : "rgba(255,255,255,0.06)"}`,
          }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: "100%", padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
                background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              {/* Number + skeleton */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: issue.color, letterSpacing: "0.04em" }}>{issue.n}</span>
                <MiniSkeleton highlight={issue.highlight}/>
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, color: "#f9fafb" }}>{issue.title}</div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5,
                  background: issue.color + "18", borderRadius: 6, padding: "3px 8px",
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: issue.color }}/>
                  <span style={{ fontSize: 10, fontWeight: 700, color: issue.color }}>{issue.joint} · {issue.risk}%</span>
                </div>
              </div>

              {open === i ? <ChevronUp size={15} color="#4b5563"/> : <ChevronDown size={15} color="#4b5563"/>}
            </button>

            {open === i && (
              <div style={{ padding: "0 16px 16px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#9ca3af", lineHeight: 1.65 }}>{issue.summary}</p>
                <div style={{
                  background: "rgba(47,123,255,0.07)", border: "1px solid rgba(47,123,255,0.18)",
                  borderRadius: 12, padding: "11px 14px", display: "flex", gap: 10,
                }}>
                  <Zap size={13} color="#2F7BFF" style={{ flexShrink: 0, marginTop: 1 }}/>
                  <div>
                    <div style={{ fontSize: 10, color: "#2F7BFF", fontWeight: 700, marginBottom: 3, letterSpacing: "0.06em" }}>PRESCRIBED DRILL</div>
                    <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5 }}>{issue.drill}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticky bottom bar */}
      <div style={{
        position: "sticky", bottom: 0,
        background: "linear-gradient(to top, #070710 60%, transparent)",
        padding: "20px 16px 28px",
      }}>
        <button style={{
          width: "100%", padding: "15px 20px",
          background: "#2F7BFF",
          border: "none", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer",
        }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Ask AI Coach</span>
        </button>
      </div>
    </div>
  );
}
