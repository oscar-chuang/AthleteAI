import { useState } from "react";
import { ChevronLeft, Share2, AlertTriangle, ChevronDown, ChevronUp, Zap, CheckCircle, BookOpen } from "lucide-react";

const FRAMES = [
  { t: "0:03", label: "Setup", riskColor: "#22C55E", angle: 162, joint: "Knee", active: false },
  { t: "0:06", label: "Descent", riskColor: "#f97316", angle: 148, joint: "Knee", active: false },
  { t: "0:08", label: "Bottom ⚠️", riskColor: "#ef4444", angle: 145, joint: "Knee", active: true },
  { t: "0:10", label: "Ascent", riskColor: "#f97316", angle: 150, joint: "Knee", active: false },
  { t: "0:13", label: "Lockout", riskColor: "#22C55E", angle: 168, joint: "Knee", active: false },
];

const SKELETON_DATA = [
  {
    // setup
    kneeLx: 128, kneeLy: 295, hipLy: 200, kneeLcolor: "#22C55E",
    desc: "Good setup position. Spine neutral, knees tracking over toes.",
    angle: "162°"
  },
  {
    kneeLx: 134, kneeLy: 298, hipLy: 205, kneeLcolor: "#f97316",
    desc: "Early descent — slight knee drift beginning. Watch your tracking.",
    angle: "148°"
  },
  {
    kneeLx: 140, kneeLy: 302, hipLy: 212, kneeLcolor: "#ef4444",
    desc: "Worst frame. Left knee collapses inward at peak load depth.",
    angle: "145°"
  },
  {
    kneeLx: 136, kneeLy: 299, hipLy: 207, kneeLcolor: "#f97316",
    desc: "Recovering. Knee drift reduces on the way up.",
    angle: "150°"
  },
  {
    kneeLx: 128, kneeLy: 294, hipLy: 198, kneeLcolor: "#22C55E",
    desc: "Good lockout. Knee aligned, hips fully extended.",
    angle: "168°"
  },
];

const JOINTS = [
  { label: "L. Knee", angle: "145°", color: "#ef4444" },
  { label: "R. Hip", angle: "52°", color: "#f97316" },
  { label: "L. Elbow", angle: "162°", color: "#2F7BFF" },
  { label: "R. Knee", angle: "138°", color: "#22C55E" },
];

export function FrameGallery() {
  const [activeFrame, setActiveFrame] = useState(2);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [drillDone, setDrillDone] = useState(false);
  const sk = SKELETON_DATA[activeFrame]!;
  const fr = FRAMES[activeFrame]!;

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

      {/* Hero freeze frame */}
      <div style={{ marginInline: 16, borderRadius: 20, overflow: "hidden", position: "relative", aspectRatio: "9/11", background: "linear-gradient(160deg, #1a1a2e 0%, #0d1117 100%)", border: `1px solid ${fr.riskColor}33` }}>
        <svg width="100%" height="100%" viewBox="0 0 300 380" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="bg2" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width="300" height="380" fill="url(#bg2)"/>

          {/* Dynamic skeleton based on frame */}
          <line x1="150" y1="95" x2="150" y2={sk.hipLy + 10} stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round"/>
          <line x1="110" y1="115" x2="190" y2="115" stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round"/>
          <line x1="110" y1="115" x2="90" y2="170" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="90" y1="170" x2="75" y2="215" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="190" y1="115" x2="210" y2="170" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="210" y1="170" x2="225" y2="215" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="120" y1={sk.hipLy + 10} x2="180" y2={sk.hipLy + 10} stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round"/>
          {/* Left leg with dynamic risk color */}
          <line x1="120" y1={sk.hipLy + 10} x2={sk.kneeLx} y2={sk.kneeLy} stroke={sk.kneeLcolor} strokeWidth="4" strokeLinecap="round"/>
          <line x1={sk.kneeLx} y1={sk.kneeLy} x2={sk.kneeLx - 14} y2={sk.kneeLy + 80} stroke={sk.kneeLcolor} strokeWidth="4" strokeLinecap="round"/>
          <line x1="180" y1={sk.hipLy + 10} x2="172" y2={sk.kneeLy - 4} stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>
          <line x1="172" y1={sk.kneeLy - 4} x2="178" y2={sk.kneeLy + 76} stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/>

          {/* Joint dots */}
          <circle cx="150" cy="93" r="5" fill="rgba(255,255,255,0.5)"/>
          <circle cx="110" cy="115" r="4" fill="#60a5fa"/>
          <circle cx="190" cy="115" r="4" fill="#a78bfa"/>
          <circle cx="150" cy={sk.hipLy + 10} r="6" fill="#f97316"/>
          <circle cx={sk.kneeLx} cy={sk.kneeLy} r={sk.kneeLcolor === "#ef4444" ? 9 : 6} fill={sk.kneeLcolor} opacity={sk.kneeLcolor === "#ef4444" ? 0.9 : 0.8}/>
          {sk.kneeLcolor === "#ef4444" && <circle cx={sk.kneeLx} cy={sk.kneeLy} r="15" fill="#ef4444" opacity="0.2"/>}
          <circle cx="172" cy={sk.kneeLy - 4} r="5" fill="#22C55E"/>

          {/* Angle label */}
          <rect x={sk.kneeLx + 14} y={sk.kneeLy - 13} width="58" height="22" rx="6" fill={sk.kneeLcolor} opacity="0.9"/>
          <text x={sk.kneeLx + 43} y={sk.kneeLy + 3} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{sk.angle}</text>
        </svg>

        {/* Risk badge */}
        {fr.riskColor === "#ef4444" && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(239,68,68,0.15)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, padding: "5px 10px",
            display: "flex", alignItems: "center", gap: 6
          }}>
            <AlertTriangle size={12} color="#ef4444" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>WORST FRAME</span>
          </div>
        )}

        {/* Score badge */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "5px 10px",
          display: "flex", alignItems: "center", gap: 5
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#2F7BFF" }}>75</span>
          <span style={{ fontSize: 10, color: "#6b7280" }}>/100</span>
        </div>

        {/* Frame caption */}
        <div style={{
          position: "absolute", bottom: 10, left: 10, right: 10,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
          borderRadius: 10, padding: "6px 12px",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#e5e7eb", lineHeight: 1.4 }}>{sk.desc}</p>
        </div>
      </div>

      {/* ── Frame strip ── */}
      <div style={{ paddingInline: 16, marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Key Moments</span>
          <span style={{ color: "#374151", fontWeight: 400 }}>— tap to explore</span>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {FRAMES.map((f, i) => (
            <button
              key={i}
              onClick={() => setActiveFrame(i)}
              style={{
                flexShrink: 0, width: 64, height: 80,
                borderRadius: 12, overflow: "hidden", position: "relative",
                background: "linear-gradient(135deg, #1a1a2e, #0d1117)",
                border: `2px solid ${activeFrame === i ? f.riskColor : "rgba(255,255,255,0.08)"}`,
                cursor: "pointer", padding: 0,
                transition: "border-color 0.15s",
                boxShadow: activeFrame === i ? `0 0 12px ${f.riskColor}55` : "none"
              }}
            >
              {/* Mini skeleton icon */}
              <svg width="64" height="64" viewBox="0 0 64 64" style={{ display: "block" }}>
                <circle cx="32" cy="12" r="5" fill="rgba(255,255,255,0.3)"/>
                <line x1="32" y1="17" x2="32" y2="38" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
                <line x1="20" y1="22" x2="44" y2="22" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
                <line x1="20" y1="22" x2="14" y2="36" stroke="#a78bfa" strokeWidth="1.5"/>
                <line x1="44" y1="22" x2="50" y2="36" stroke="#60a5fa" strokeWidth="1.5"/>
                <line x1="25" y1="38" x2="35" y2="38" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
                <line x1="25" y1="38" x2={i === 2 ? 29 : 22} y2="52" stroke={f.riskColor} strokeWidth="2"/>
                <line x1={i === 2 ? 29 : 22} y1="52" x2={i === 2 ? 22 : 20} y2="62" stroke={f.riskColor} strokeWidth="2"/>
                <line x1="35" y1="38" x2="38" y2="52" stroke="#a78bfa" strokeWidth="1.5"/>
                <line x1="38" y1="52" x2="40" y2="62" stroke="#a78bfa" strokeWidth="1.5"/>
                <circle cx={i === 2 ? 29 : 22} cy="52" r={i === 2 ? 4 : 2.5} fill={f.riskColor} opacity="0.9"/>
              </svg>
              {/* Label */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "rgba(0,0,0,0.7)", padding: "2px 0",
                textAlign: "center"
              }}>
                <span style={{ fontSize: 9, color: activeFrame === i ? f.riskColor : "#9ca3af", fontWeight: 600 }}>{f.t}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Joint pills */}
      <div style={{ paddingInline: 16, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {JOINTS.map((j) => (
            <div key={j.label} style={{
              background: j.color + "18", border: `1px solid ${j.color}44`,
              borderRadius: 20, padding: "5px 10px",
              display: "flex", alignItems: "center", gap: 5
            }}>
              <div style={{ width: 5, height: 5, borderRadius: 3, background: j.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: j.color }}>{j.angle}</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{j.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coaching tip */}
      <div style={{ paddingInline: 16, marginTop: 16, paddingBottom: 32 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Fix</div>

        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: 16, overflow: "hidden"
        }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: "100%", padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left"
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ef444422", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle size={16} color="#ef4444" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Knee valgus at peak load</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>Left Knee · 82% risk</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: "82%", height: "100%", background: "#ef4444", borderRadius: 2 }} />
              </div>
              {expanded ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
            </div>
          </button>

          {expanded && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, marginBottom: 12 }}>
                Your left knee collapses inward during the descent phase. This places significant stress on the ACL and medial collateral ligament.
              </div>
              <div style={{
                background: "rgba(47,123,255,0.08)", border: "1px solid rgba(47,123,255,0.2)",
                borderRadius: 12, padding: 12, display: "flex", gap: 10, marginBottom: 10
              }}>
                <Zap size={14} color="#2F7BFF" style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: "#2F7BFF", fontWeight: 700, marginBottom: 3 }}>TRY THIS DRILL</div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5 }}>Single-leg glute bridges (3×12) — activate the glute med before your next session.</div>
                </div>
              </div>
              <button
                onClick={() => setDrillDone(!drillDone)}
                style={{
                  width: "100%", padding: "10px", borderRadius: 10,
                  background: drillDone ? "#22C55E22" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${drillDone ? "#22C55E55" : "rgba(255,255,255,0.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  cursor: "pointer", color: drillDone ? "#22C55E" : "#9ca3af", fontSize: 13, fontWeight: 600
                }}
              >
                <CheckCircle size={14} />
                {drillDone ? "Drill completed!" : "Mark drill done"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
                <BookOpen size={10} color="#374151" />
                <span style={{ fontSize: 10, color: "#374151" }}>Hewett et al. (2005) Am J Sports Med</span>
              </div>
            </div>
          )}
        </div>

        <button style={{
          width: "100%", padding: "14px 20px",
          background: "linear-gradient(135deg, #2F7BFF22, #2F7BFF11)",
          border: "1px solid rgba(47,123,255,0.3)",
          borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer", marginTop: 10
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
