import { useState } from "react";
import { ChevronLeft, ChevronRight, Zap, CheckCircle } from "lucide-react";

function SkeletonFull({ riskKnee = false }: { riskKnee?: boolean }) {
  const kc = riskKnee ? "#ef4444" : "#22C55E";
  return (
    <svg width="100%" height="100%" viewBox="0 0 200 280" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="glow" cx="50%" cy="40%" r="45%">
          <stop offset="0%" stopColor={kc} stopOpacity="0.12"/>
          <stop offset="100%" stopColor={kc} stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width={200} height={280} fill="url(#glow)"/>
      {/* Head */}
      <circle cx={100} cy={34} r={13} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2.5}/>
      {/* Spine */}
      <line x1={100} y1={47} x2={100} y2={118} stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} strokeLinecap="round"/>
      {/* Shoulders */}
      <line x1={68} y1={72} x2={132} y2={72} stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} strokeLinecap="round"/>
      {/* Left arm */}
      <line x1={68} y1={72}  x2={50} y2={112} stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round"/>
      <line x1={50} y1={112} x2={36} y2={148} stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round"/>
      {/* Right arm */}
      <line x1={132} y1={72}  x2={150} y2={112} stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round"/>
      <line x1={150} y1={112} x2={164} y2={148} stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round"/>
      {/* Hips */}
      <line x1={76} y1={118} x2={124} y2={118} stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} strokeLinecap="round"/>
      {/* Left leg */}
      <line x1={76}  y1={118} x2={riskKnee ? 88 : 72} y2={178} stroke={kc} strokeWidth={3} strokeLinecap="round"/>
      <line x1={riskKnee ? 88 : 72} y1={178} x2={riskKnee ? 74 : 65} y2={242} stroke={kc} strokeWidth={3} strokeLinecap="round"/>
      {/* Right leg */}
      <line x1={124} y1={118} x2={128} y2={178} stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round"/>
      <line x1={128} y1={178} x2={132} y2={242} stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round"/>
      {/* Key joints */}
      <circle cx={100} cy={118} r={7} fill="#f97316" opacity={0.9}/>
      <circle cx={riskKnee ? 88 : 72} cy={178} r={riskKnee ? 12 : 6} fill={kc} opacity={0.85}/>
      {riskKnee && <circle cx={88} cy={178} r={20} fill={kc} opacity={0.1}/>}
      {/* Angle callout */}
      {riskKnee && (
        <>
          <rect x={102} y={162} width={54} height={22} rx={7} fill={kc} opacity={0.9}/>
          <text x={129} y={177} textAnchor="middle" fill="white" fontSize={12} fontWeight={800}>145° knee</text>
        </>
      )}
    </svg>
  );
}

const CARDS = [
  {
    type: "overview",
    bg: "linear-gradient(160deg, #0d0d1a 0%, #0a0a14 100%)",
    accent: "#2F7BFF",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "32px 28px 28px" }}>
        <div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          Back Squat · Weightlifting
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 32 }}>Jun 23, 2026</div>

        {/* Score ring */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width={200} height={200} viewBox="0 0 200 200">
            <circle cx={100} cy={100} r={80} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={14}/>
            <circle cx={100} cy={100} r={80} fill="none" stroke="#f97316" strokeWidth={14} strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 80 * 0.75} ${2 * Math.PI * 80}`}
              transform="rotate(-90 100 100)"/>
            <text x={100} y={93} textAnchor="middle" fill="white" fontSize={52} fontWeight={900} fontFamily="Inter, sans-serif">75</text>
            <text x={100} y={113} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={12} fontFamily="Inter, sans-serif" fontWeight={600} letterSpacing="0.05em">FORM SCORE</text>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f97316" }}>Needs Improvement</div>
          <div style={{ fontSize: 13, color: "#4b5563" }}>2 issues identified</div>
        </div>

        <div style={{
          marginTop: "auto",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 13, color: "#6b7280", flex: 1 }}>Swipe to review findings</span>
          <ChevronRight size={16} color="#4b5563"/>
        </div>
      </div>
    ),
  },
  {
    type: "finding",
    bg: "linear-gradient(160deg, #170808 0%, #0a0a14 100%)",
    accent: "#ef4444",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Skeleton */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <SkeletonFull riskKnee/>
          <div style={{
            position: "absolute", top: 16, left: 16,
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 10, padding: "5px 10px",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>FINDING 01 · 0:08</span>
          </div>
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "30%",
            background: "linear-gradient(to top, #170808, transparent)",
          }}/>
        </div>

        {/* Text */}
        <div style={{ padding: "20px 24px 28px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.25, marginBottom: 8 }}>
            Knee valgus<br/>at peak load
          </div>
          <div style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6, marginBottom: 16 }}>
            Left knee collapses inward at the bottom of your squat. This places dangerous stress on your ACL and MCL.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ background: "#ef444420", border: "1px solid #ef444440", borderRadius: 10, padding: "6px 14px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>Left Knee · 82% risk</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 14px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>145° angle</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    type: "drill",
    bg: "linear-gradient(160deg, #060f1a 0%, #0a0a14 100%)",
    accent: "#2F7BFF",
    render: (done: boolean, setDone: (v: boolean) => void) => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "32px 24px 28px" }}>
        <div style={{ fontSize: 11, color: "#2F7BFF", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
          Fix for Finding 01
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.2, marginBottom: 8 }}>
          Single-leg<br/>glute bridges
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>3 sets · 12 reps each side</div>

        {/* Illustration */}
        <div style={{
          flex: 1,
          background: "rgba(47,123,255,0.05)", border: "1px solid rgba(47,123,255,0.1)",
          borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12, marginBottom: 24, padding: 20,
        }}>
          <div style={{ fontSize: 48 }}>🏃</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Activate glute med</div>
            <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>Lie on your back, one knee bent. Drive hip up, hold 2s, lower. Keep hips square.</div>
          </div>
          <div style={{
            background: "rgba(47,123,255,0.08)", borderRadius: 10, padding: "8px 14px",
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <Zap size={12} color="#2F7BFF"/>
            <span style={{ fontSize: 11, color: "#60a5fa" }}>Do this before every squat session</span>
          </div>
        </div>

        <button
          onClick={() => setDone(!done)}
          style={{
            width: "100%", padding: "15px",
            background: done ? "#22C55E" : "rgba(255,255,255,0.06)",
            border: `1px solid ${done ? "#22C55E" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            cursor: "pointer", transition: "all 0.2s",
          }}
        >
          <CheckCircle size={16} color={done ? "#fff" : "#6b7280"}/>
          <span style={{ fontSize: 14, fontWeight: 700, color: done ? "#fff" : "#6b7280" }}>
            {done ? "Drill completed ✓" : "Mark drill done"}
          </span>
        </button>
      </div>
    ),
  },
  {
    type: "finding2",
    bg: "linear-gradient(160deg, #140a00 0%, #0a0a14 100%)",
    accent: "#f97316",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "32px 24px 28px" }}>
        <div style={{ fontSize: 11, color: "#f97316", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>
          Finding 02 · Right Hip
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.2, marginBottom: 10 }}>
          Hip depth<br/>limited
        </div>
        <div style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.65, marginBottom: 24 }}>
          Hip flexion peaks at 52° — below the 55–65° optimal range. Tight hip flexors are likely limiting your squat depth and forcing compensation patterns.
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <div style={{ background: "#f9731620", border: "1px solid #f9731640", borderRadius: 10, padding: "6px 14px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>Right Hip · 58% risk</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 14px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>52° flexion</span>
          </div>
        </div>

        <div style={{
          background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 16, padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 11, color: "#f97316", fontWeight: 700, letterSpacing: "0.06em" }}>PRESCRIBED FIX</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>90/90 Hip Stretch</div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.55 }}>2 minutes each side, daily. Prioritise before lower-body sessions.</div>
          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>📖 Schoenfeld (2010) J Strength Cond Res</div>
        </div>
      </div>
    ),
  },
  {
    type: "coach",
    bg: "linear-gradient(160deg, #060e1f 0%, #0a0a14 100%)",
    accent: "#2F7BFF",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "32px 24px 28px", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 36, background: "linear-gradient(135deg, #2F7BFF, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🤖</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Ask AI Coach</div>
          <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.65 }}>
            Dive deeper into your analysis. Ask about your form, injury risk, or get a custom training plan.
          </div>
        </div>
        <button style={{
          padding: "15px 32px", background: "#2F7BFF", border: "none", borderRadius: 16,
          fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", width: "100%",
        }}>
          Start conversation
        </button>
        <div style={{ fontSize: 11, color: "#374151" }}>Powered by Claude · Evidence-based</div>
      </div>
    ),
  },
];

export function StoryMode() {
  const [card, setCard]   = useState(0);
  const [done1, setDone1] = useState(false);
  const total = CARDS.length;
  const c = CARDS[card]!;

  const goNext = () => setCard(v => Math.min(v + 1, total - 1));
  const goPrev = () => setCard(v => Math.max(v - 1, 0));

  return (
    <div style={{ background: "#0a0a14", height: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff", maxWidth: 390, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", paddingBottom: 8, paddingInline: 20, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: "auto" }}>9:41</span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>●●●</span>
      </div>

      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", paddingInline: 16, paddingBottom: 12, gap: 10, flexShrink: 0 }}>
        <button style={{ width: 34, height: 34, borderRadius: 17, background: "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={18} color="#fff"/>
        </button>
        <div style={{ flex: 1 }}>
          {/* Progress bar */}
          <div style={{ display: "flex", gap: 4 }}>
            {CARDS.map((_, i) => (
              <div
                key={i}
                onClick={() => setCard(i)}
                style={{
                  flex: 1, height: 3, borderRadius: 2, cursor: "pointer",
                  background: i <= card ? c.accent : "rgba(255,255,255,0.12)",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 5 }}>{card + 1} of {total}</div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        flex: 1, marginInline: 12, borderRadius: 24, overflow: "hidden",
        background: c.bg, position: "relative",
        border: `1px solid ${c.accent}20`,
        transition: "background 0.35s",
      }}>
        {c.type === "drill"
          ? c.render(done1, setDone1)
          : (c.render as () => React.ReactNode)()
        }
      </div>

      {/* Bottom nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 24px", flexShrink: 0 }}>
        <button
          onClick={goPrev}
          disabled={card === 0}
          style={{
            width: 48, height: 48, borderRadius: 24,
            background: card === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.09)",
            border: "none", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: card === 0 ? "default" : "pointer", opacity: card === 0 ? 0.3 : 1,
          }}
        >
          <ChevronLeft size={20} color="#fff"/>
        </button>
        <button
          onClick={goNext}
          disabled={card === total - 1}
          style={{
            flex: 1, height: 48, borderRadius: 24,
            background: card === total - 1 ? "rgba(255,255,255,0.03)" : c.accent,
            border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            cursor: card === total - 1 ? "default" : "pointer",
            opacity: card === total - 1 ? 0.3 : 1,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            {card === 0 ? "View findings" : card === total - 2 ? "Ask Coach" : "Next"}
          </span>
          <ChevronRight size={16} color="#fff"/>
        </button>
      </div>
    </div>
  );
}
