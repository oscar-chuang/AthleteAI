import { useState } from "react";
import { ChevronLeft, Share2, ChevronRight, Play } from "lucide-react";

/* ─── Skeleton overlay with annotation callouts ─────────────────────── */
function AnnotatedSkeleton() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 390 460" preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0 }}>

      {/* Atmospheric gym backdrop tones */}
      <defs>
        <radialGradient id="gymBg" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#1a1a2e" stopOpacity="1"/>
          <stop offset="100%" stopColor="#0a0a0f" stopOpacity="1"/>
        </radialGradient>
        <radialGradient id="kneeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="backGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
        </radialGradient>
        {/* subtle floor/ceiling gradients for depth */}
        <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="70%" stopColor="transparent"/>
          <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0.85"/>
        </linearGradient>
      </defs>

      <rect width={390} height={460} fill="url(#gymBg)"/>

      {/* Simulated gym environment lines for depth */}
      <line x1={0} y1={300} x2={390} y2={300} stroke="rgba(255,255,255,0.03)" strokeWidth={1}/>
      <line x1={195} y1={0} x2={195} y2={460} stroke="rgba(255,255,255,0.02)" strokeWidth={1}/>
      {[60,120,180,240,300,360].map(x => (
        <line key={x} x1={x} y1={0} x2={x} y2={460} stroke="rgba(255,255,255,0.015)" strokeWidth={1}/>
      ))}

      {/* ── Skeleton body ────────────────────────────────────────── */}
      {/* Head */}
      <circle cx={195} cy={78} r={18} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={3}/>

      {/* Spine */}
      <line x1={195} y1={96} x2={195} y2={200} stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeLinecap="round"/>

      {/* Shoulders */}
      <line x1={148} y1={130} x2={242} y2={130} stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeLinecap="round"/>

      {/* Left arm */}
      <line x1={148} y1={130} x2={118} y2={182} stroke="#a78bfa" strokeWidth={3} strokeLinecap="round"/>
      <line x1={118} y1={182} x2={100} y2={230} stroke="#a78bfa" strokeWidth={3} strokeLinecap="round"/>
      <circle cx={118} cy={182} r={5} fill="#a78bfa" opacity={0.8}/>
      <circle cx={100} cy={230} r={5} fill="#a78bfa" opacity={0.7}/>

      {/* Right arm */}
      <line x1={242} y1={130} x2={272} y2={182} stroke="#60a5fa" strokeWidth={3} strokeLinecap="round"/>
      <line x1={272} y1={182} x2={290} y2={230} stroke="#60a5fa" strokeWidth={3} strokeLinecap="round"/>
      <circle cx={272} cy={182} r={5} fill="#60a5fa" opacity={0.8}/>
      <circle cx={290} cy={230} r={5} fill="#60a5fa" opacity={0.7}/>

      {/* Hips */}
      <line x1={162} y1={200} x2={228} y2={200} stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeLinecap="round"/>
      <circle cx={195} cy={200} r={7} fill="#f97316" opacity={0.9}/>

      {/* ── Left leg (red — problem) ────────────────────────────── */}
      {/* glow at knee */}
      <ellipse cx={178} cy={300} rx={28} ry={28} fill="url(#kneeGlow)"/>
      <line x1={162} y1={200} x2={178} y2={300} stroke="#f97316" strokeWidth={4} strokeLinecap="round"/>
      <line x1={178} y1={300} x2={164} y2={400} stroke="#ef4444" strokeWidth={4} strokeLinecap="round"/>
      <circle cx={178} cy={300} r={9} fill="#f97316" opacity={0.95}/>
      <circle cx={178} cy={300} r={16} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="4 3" opacity={0.6}/>
      <circle cx={164} cy={400} r={6} fill="#ef4444" opacity={0.7}/>

      {/* ── Right leg (good) ────────────────────────────────────── */}
      <line x1={228} y1={200} x2={218} y2={300} stroke="#22C55E" strokeWidth={3} strokeLinecap="round"/>
      <line x1={218} y1={300} x2={225} y2={400} stroke="#22C55E" strokeWidth={3} strokeLinecap="round"/>
      <circle cx={218} cy={300} r={6} fill="#22C55E" opacity={0.85}/>
      <circle cx={225} cy={400} r={5} fill="#22C55E" opacity={0.65}/>

      {/* ── Back rounding glow near spine ───────────────────────── */}
      <ellipse cx={195} cy={148} rx={34} ry={22} fill="url(#backGlow)"/>

      {/* ── Callout: Rounded Back ───────────────────────────────── */}
      {/* connector line */}
      <line x1={195} y1={148} x2={86} y2={152} stroke="rgba(239,68,68,0.6)" strokeWidth={1.5} strokeDasharray="4 3"/>
      <circle cx={195} cy={148} r={4} fill="#ef4444" opacity={0.9}/>
      {/* bubble */}
      <rect x={14} y={130} width={72} height={44} rx={10} fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.55)" strokeWidth={1.5}/>
      <text x={26} y={148} fill="#ef4444" fontSize={9} fontWeight={800} fontFamily="Inter, sans-serif">⚠ ROUNDED</text>
      <text x={26} y={161} fill="#ef4444" fontSize={9} fontWeight={800} fontFamily="Inter, sans-serif">BACK</text>
      <text x={19} y={171} fill="rgba(255,255,255,0.55)" fontSize={8} fontFamily="Inter, sans-serif">Keep chest up</text>

      {/* ── Callout: Knee Angle ─────────────────────────────────── */}
      <line x1={178} y1={300} x2={254} y2={316} stroke="rgba(249,115,22,0.6)" strokeWidth={1.5} strokeDasharray="4 3"/>
      {/* bubble */}
      <rect x={254} y={296} width={78} height={44} rx={10} fill="rgba(249,115,22,0.18)" stroke="rgba(249,115,22,0.55)" strokeWidth={1.5}/>
      <text x={264} y={314} fill="#f97316" fontSize={9} fontWeight={800} fontFamily="Inter, sans-serif">⚠ KNEE ANGLE</text>
      <text x={264} y={330} fill="rgba(255,255,255,0.55)" fontSize={8} fontFamily="Inter, sans-serif">145° — collapse</text>

      {/* ── Callout: Good Depth ─────────────────────────────────── */}
      <line x1={195} y1={200} x2={286} y2={186} stroke="rgba(34,197,94,0.5)" strokeWidth={1.5} strokeDasharray="4 3"/>
      <rect x={286} y={172} width={68} height={28} rx={8} fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.4)" strokeWidth={1.5}/>
      <text x={296} y={188} fill="#22C55E" fontSize={9} fontWeight={700} fontFamily="Inter, sans-serif">✓ DEPTH OK</text>

      {/* floor fade overlay */}
      <rect width={390} height={460} fill="url(#floorFade)"/>
    </svg>
  );
}

/* ─── Muscle body silhouette ─────────────────────────────────────────── */
function MuscleMap({ side }: { side: "front" | "back" }) {
  const isFront = side === "front";
  return (
    <svg width={70} height={110} viewBox="0 0 70 110">
      {/* Body outline */}
      <circle cx={35} cy={10} r={8} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}/>
      <rect x={22} y={18} width={26} height={32} rx={6} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}/>
      {/* Arms */}
      <rect x={9}  y={20} width={11} height={26} rx={5} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}/>
      <rect x={50} y={20} width={11} height={26} rx={5} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}/>
      {/* Legs */}
      <rect x={22} y={52} width={11} height={36} rx={5}
        fill={isFront ? "rgba(249,115,22,0.45)" : "rgba(239,68,68,0.35)"}
        stroke={isFront ? "#f97316" : "#ef4444"} strokeWidth={1.5}/>
      <rect x={37} y={52} width={11} height={36} rx={5}
        fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.4)" strokeWidth={1.5}/>
      {/* Glutes (back only) */}
      {!isFront && (
        <>
          <rect x={22} y={50} width={11} height={14} rx={4} fill="rgba(239,68,68,0.45)" stroke="#ef4444" strokeWidth={1.5}/>
          <rect x={37} y={50} width={11} height={14} rx={4} fill="rgba(249,115,22,0.3)" stroke="#f97316" strokeWidth={1.5}/>
        </>
      )}
      {/* Quads/core highlight (front) */}
      {isFront && (
        <rect x={22} y={20} width={26} height={30} rx={5} fill="rgba(249,115,22,0.18)" stroke="rgba(249,115,22,0.35)" strokeWidth={1}/>
      )}
      {/* label */}
      <text x={35} y={106} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="Inter, sans-serif">{isFront ? "Front" : "Back"}</text>
    </svg>
  );
}

/* ─── Form feedback rows ─────────────────────────────────────────────── */
const FEEDBACK = [
  { label: "Knee Valgus",   priority: "high",   color: "#ef4444",  icon: "⚠", desc: "Left knee collapses inward at depth" },
  { label: "Hip Depth",     priority: "medium", color: "#f97316",  icon: "⚠", desc: "Try to get below parallel" },
  { label: "Squat Depth",   priority: "good",   color: "#22C55E",  icon: "✓", desc: "Great depth — keep it up" },
];

const PRIORITY_LABEL: Record<string, string> = {
  high: "High Priority", medium: "Medium Priority", good: "Good",
};

export function CoachView() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff", maxWidth: 390, margin: "0 auto", overflowY: "auto" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", paddingBottom: 8, paddingInline: 20, position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: "auto" }}>9:41</span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>●●●</span>
      </div>

      {/* Nav bar — floating over the hero */}
      <div style={{
        position: "absolute", top: 44, left: 0, right: 0, zIndex: 20,
        display: "flex", alignItems: "center", paddingInline: 16, paddingBottom: 10, gap: 10,
      }}>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="#fff"/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>Back Squat</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Today, 9:41 AM</div>
        </div>
        <div style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 10px" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Reps </span>
          <span style={{ fontSize: 11, fontWeight: 800 }}>8</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>/10</span>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Share2 size={15} color="#fff"/>
        </button>
      </div>

      {/* ── Hero — skeleton on gym scene ─────────────────────────────── */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "390/460" }}>
        <AnnotatedSkeleton/>
      </div>

      {/* ── AI Analysis + Muscle Focus ────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, padding: "14px 14px 0" }}>

        {/* Score card */}
        <div style={{
          flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>AI Analysis</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mini ring */}
            <svg width={58} height={58} viewBox="0 0 58 58" style={{ flexShrink: 0 }}>
              <circle cx={29} cy={29} r={23} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5}/>
              <circle cx={29} cy={29} r={23} fill="none" stroke="#f97316" strokeWidth={5} strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 23 * 0.72} ${2 * Math.PI * 23}`}
                transform="rotate(-90 29 29)"/>
              <text x={29} y={26} textAnchor="middle" fill="white" fontSize={16} fontWeight={900} fontFamily="Inter, sans-serif">72</text>
              <text x={29} y={38} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily="Inter, sans-serif">/100</text>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f97316", marginBottom: 3 }}>Good effort!</div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>Focus on the issues below to improve your form.</div>
            </div>
          </div>
        </div>

        {/* Muscle focus */}
        <div style={{
          width: 120, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18, padding: "14px 10px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>Muscle Focus</div>
          <div style={{ display: "flex", gap: 4 }}>
            <MuscleMap side="front"/>
            <MuscleMap side="back"/>
          </div>
        </div>
      </div>

      {/* ── Form Feedback ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Form Feedback</div>

        {FEEDBACK.map((f, i) => (
          <button
            key={i}
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              width: "100%", marginBottom: 8,
              background: "rgba(255,255,255,0.035)",
              border: `1px solid ${expanded === i ? f.color + "45" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 14, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
            }}
          >
            {/* Icon circle */}
            <div style={{
              width: 34, height: 34, borderRadius: 17, flexShrink: 0,
              background: f.color + "20", border: `1px solid ${f.color}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>{f.icon}</div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{f.label}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                  color: f.color, background: f.color + "18",
                  border: `1px solid ${f.color}35`,
                  borderRadius: 5, padding: "2px 6px",
                }}>{PRIORITY_LABEL[f.priority]}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{f.desc}</div>
              {expanded === i && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                  {f.priority === "high" && "Activate your glute med with single-leg bridges (3×12) before each session. Focus on keeping the knee tracking over the second toe."}
                  {f.priority === "medium" && "Tight hip flexors are limiting your depth. Add 90/90 hip stretches daily — 2 min each side — to open the hip flexor chain."}
                  {f.priority === "good" && "You're hitting good depth consistently. Maintain this as you add load."}
                </div>
              )}
            </div>

            <ChevronRight size={14} color="#374151" style={{ flexShrink: 0, transform: expanded === i ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}/>
          </button>
        ))}
      </div>

      {/* ── Coaching Tips ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Coaching Tips</div>
        <div style={{
          background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "14px",
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <div style={{ flex: 1, fontSize: 13, color: "#d1d5db", lineHeight: 1.65 }}>
            Push through your heels, keep your core tight, and maintain a neutral spine throughout the movement. Drive your knees outward on the ascent.
          </div>
          {/* Video thumbnail */}
          <div style={{
            width: 76, height: 56, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #1a1a3e, #0d1117)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            cursor: "pointer", position: "relative", overflow: "hidden",
          }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={12} color="#fff" fill="#fff"/>
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>0:45</span>
          </div>
        </div>
      </div>

      {/* ── Next Best Exercise ────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Next Best Exercise</div>
        <div style={{
          background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg, #1a2a1a, #0d1a0d)",
            border: "1px solid rgba(34,197,94,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          }}>🏋️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Romanian Deadlift</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>3 sets × 8–10 reps</div>
          </div>
          <ChevronRight size={16} color="#374151"/>
        </div>
      </div>

      {/* ── Ask Coach ─────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 28px" }}>
        <button style={{
          width: "100%", padding: "14px 20px",
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
