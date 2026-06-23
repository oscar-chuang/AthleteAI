import { useState } from "react";
import { ChevronLeft, Share2, ChevronRight, Play, BookOpen, MessageCircle } from "lucide-react";

/* ─── Risk colour palette (matches real app RISK_COLORS) ────────────── */
const RISK_COLORS = ["#22C55E", "#FF6B35", "#EF4444"];

/* ─── Annotated skeleton hero ────────────────────────────────────────── */
function AnnotatedSkeleton() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 390 460" preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0 }}>
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
        <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="70%" stopColor="transparent"/>
          <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0.85"/>
        </linearGradient>
      </defs>
      <rect width={390} height={460} fill="url(#gymBg)"/>
      {[60,120,180,240,300,360].map(x => (
        <line key={x} x1={x} y1={0} x2={x} y2={460} stroke="rgba(255,255,255,0.015)" strokeWidth={1}/>
      ))}
      <line x1={0} y1={300} x2={390} y2={300} stroke="rgba(255,255,255,0.03)" strokeWidth={1}/>
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
      {/* Left leg — flagged */}
      <ellipse cx={178} cy={300} rx={28} ry={28} fill="url(#kneeGlow)"/>
      <line x1={162} y1={200} x2={178} y2={300} stroke="#f97316" strokeWidth={4} strokeLinecap="round"/>
      <line x1={178} y1={300} x2={164} y2={400} stroke="#ef4444" strokeWidth={4} strokeLinecap="round"/>
      <circle cx={178} cy={300} r={9} fill="#f97316" opacity={0.95}/>
      <circle cx={178} cy={300} r={16} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="4 3" opacity={0.6}/>
      <circle cx={164} cy={400} r={6} fill="#ef4444" opacity={0.7}/>
      {/* Right leg — safe */}
      <line x1={228} y1={200} x2={218} y2={300} stroke="#22C55E" strokeWidth={3} strokeLinecap="round"/>
      <line x1={218} y1={300} x2={225} y2={400} stroke="#22C55E" strokeWidth={3} strokeLinecap="round"/>
      <circle cx={218} cy={300} r={6} fill="#22C55E" opacity={0.85}/>
      <circle cx={225} cy={400} r={5} fill="#22C55E" opacity={0.65}/>
      {/* Back rounding glow */}
      <ellipse cx={195} cy={148} rx={34} ry={22} fill="url(#backGlow)"/>
      {/* Callout: Rounded Back */}
      <line x1={195} y1={148} x2={86} y2={152} stroke="rgba(239,68,68,0.6)" strokeWidth={1.5} strokeDasharray="4 3"/>
      <circle cx={195} cy={148} r={4} fill="#ef4444" opacity={0.9}/>
      <rect x={14} y={130} width={72} height={44} rx={10} fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.55)" strokeWidth={1.5}/>
      <text x={26} y={148} fill="#ef4444" fontSize={9} fontWeight={800} fontFamily="Inter, sans-serif">⚠ ROUNDED</text>
      <text x={26} y={161} fill="#ef4444" fontSize={9} fontWeight={800} fontFamily="Inter, sans-serif">BACK</text>
      <text x={19} y={171} fill="rgba(255,255,255,0.55)" fontSize={8} fontFamily="Inter, sans-serif">Keep chest up</text>
      {/* Callout: Knee Angle */}
      <line x1={178} y1={300} x2={254} y2={316} stroke="rgba(249,115,22,0.6)" strokeWidth={1.5} strokeDasharray="4 3"/>
      <rect x={254} y={296} width={78} height={44} rx={10} fill="rgba(249,115,22,0.18)" stroke="rgba(249,115,22,0.55)" strokeWidth={1.5}/>
      <text x={264} y={314} fill="#f97316" fontSize={9} fontWeight={800} fontFamily="Inter, sans-serif">⚠ KNEE ANGLE</text>
      <text x={264} y={330} fill="rgba(255,255,255,0.55)" fontSize={8} fontFamily="Inter, sans-serif">145° — collapse</text>
      {/* Callout: Good Depth */}
      <line x1={195} y1={200} x2={286} y2={186} stroke="rgba(34,197,94,0.5)" strokeWidth={1.5} strokeDasharray="4 3"/>
      <rect x={286} y={172} width={68} height={28} rx={8} fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.4)" strokeWidth={1.5}/>
      <text x={296} y={188} fill="#22C55E" fontSize={9} fontWeight={700} fontFamily="Inter, sans-serif">✓ DEPTH OK</text>
      <rect width={390} height={460} fill="url(#floorFade)"/>
    </svg>
  );
}

/* ─── Anatomical muscle map — matches real app renderMuscleMap() ─────── */
// flagged: which muscle groups to highlight and at what risk level
interface MuscleFlags {
  qL?: number; qR?: number;     // quads
  hmL?: number; hmR?: number;   // hamstrings
  hfL?: number; hfR?: number;   // hip flexors
  gL?: number; gR?: number;     // glutes
  bL?: number; bR?: number;     // biceps
  tL?: number; tR?: number;     // triceps
}

function AnatomyMap({ flags }: { flags: MuscleFlags }) {
  const mf = (k: keyof MuscleFlags) =>
    flags[k] !== undefined ? RISK_COLORS[flags[k]!] + "55" : "#1c1c30";
  const ms = (k: keyof MuscleFlags) =>
    flags[k] !== undefined ? RISK_COLORS[flags[k]!] : "#2a2a45";
  const mw = (k: keyof MuscleFlags) =>
    flags[k] !== undefined ? 1.5 : 1;

  return (
    <svg width={120} height={156} viewBox="0 0 120 156">
      {/* ── FRONT ── */}
      <circle cx={25} cy={11} r={9} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <rect x={22} y={20} width={7} height={7} rx={2} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* biceps */}
      <rect x={5} y={27} width={8} height={27} rx={3} fill={mf("bL")} stroke={ms("bL")} strokeWidth={mw("bL")}/>
      <rect x={38} y={27} width={8} height={27} rx={3} fill={mf("bR")} stroke={ms("bR")} strokeWidth={mw("bR")}/>
      {/* chest/torso */}
      <rect x={14} y={27} width={23} height={30} rx={4} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* forearms */}
      <rect x={3} y={56} width={7} height={22} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <rect x={41} y={56} width={7} height={22} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* abs */}
      <rect x={14} y={58} width={23} height={18} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* hip flexors */}
      <rect x={9} y={77} width={13} height={17} rx={3} fill={mf("hfL")} stroke={ms("hfL")} strokeWidth={mw("hfL")}/>
      <rect x={29} y={77} width={13} height={17} rx={3} fill={mf("hfR")} stroke={ms("hfR")} strokeWidth={mw("hfR")}/>
      {/* quads */}
      <rect x={9} y={95} width={12} height={38} rx={4} fill={mf("qL")} stroke={ms("qL")} strokeWidth={mw("qL")}/>
      <rect x={30} y={95} width={12} height={38} rx={4} fill={mf("qR")} stroke={ms("qR")} strokeWidth={mw("qR")}/>
      {/* shins */}
      <rect x={10} y={134} width={10} height={21} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <rect x={31} y={134} width={10} height={21} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <text x={25} y={154} fontSize={7} fill="#44445a" textAnchor="middle" fontFamily="Inter, sans-serif">FRONT</text>
      {/* divider */}
      <line x1={60} y1={4} x2={60} y2={148} stroke="#2a2a45" strokeWidth={0.5} strokeDasharray="2 3"/>
      {/* ── BACK ── */}
      <circle cx={95} cy={11} r={9} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <rect x={92} y={20} width={7} height={7} rx={2} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* triceps */}
      <rect x={75} y={27} width={8} height={27} rx={3} fill={mf("tL")} stroke={ms("tL")} strokeWidth={mw("tL")}/>
      <rect x={108} y={27} width={8} height={27} rx={3} fill={mf("tR")} stroke={ms("tR")} strokeWidth={mw("tR")}/>
      {/* back/traps */}
      <rect x={84} y={27} width={23} height={30} rx={4} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* forearms */}
      <rect x={73} y={56} width={7} height={22} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <rect x={111} y={56} width={7} height={22} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* lower back */}
      <rect x={84} y={58} width={23} height={18} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      {/* glutes */}
      <rect x={79} y={77} width={13} height={17} rx={3} fill={mf("gL")} stroke={ms("gL")} strokeWidth={mw("gL")}/>
      <rect x={99} y={77} width={13} height={17} rx={3} fill={mf("gR")} stroke={ms("gR")} strokeWidth={mw("gR")}/>
      {/* hamstrings */}
      <rect x={79} y={95} width={12} height={38} rx={4} fill={mf("hmL")} stroke={ms("hmL")} strokeWidth={mw("hmL")}/>
      <rect x={100} y={95} width={12} height={38} rx={4} fill={mf("hmR")} stroke={ms("hmR")} strokeWidth={mw("hmR")}/>
      {/* calves */}
      <rect x={80} y={134} width={10} height={21} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <rect x={101} y={134} width={10} height={21} rx={3} fill="#1c1c30" stroke="#2a2a45" strokeWidth={1}/>
      <text x={95} y={154} fontSize={7} fill="#44445a" textAnchor="middle" fontFamily="Inter, sans-serif">BACK</text>
    </svg>
  );
}

/* ─── Score ring — matches real app renderScoreRing() ───────────────── */
function ScoreRing({ score }: { score: number }) {
  const R = 34, cx = 42, cy = 42, sw = 8;
  const circ = 2 * Math.PI * R;
  const arcColor = score >= 75 ? "#22C55E" : score >= 50 ? "#FF6B35" : "#EF4444";
  return (
    <svg width={84} height={84} viewBox="0 0 84 84">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1c1c30" strokeWidth={sw}/>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={arcColor} strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${circ * (score / 100)} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`}/>
      <text x={cx} y={cx + 7} textAnchor="middle" fontSize={20} fill={arcColor}
        fontWeight={900} fontFamily="Inter, sans-serif">{score}</text>
    </svg>
  );
}

/* ─── Feedback data ─────────────────────────────────────────────────── */
const FEEDBACK = [
  {
    label: "Knee Valgus",
    priority: "HIGH",
    color: "#EF4444",
    icon: "⚠",
    desc: "Left knee collapses inward at depth — elevated ACL strain risk.",
    detail: "Activate glute med with single-leg bridges (3×12) before each session. Keep knee tracking over second toe.",
    source: "Hewett TE et al. (2005). Biomechanical measures of neuromuscular control and valgus loading of the knee. Am J Sports Med 33(4):492–501",
  },
  {
    label: "Hip Depth",
    priority: "MED",
    color: "#FF6B35",
    icon: "⚠",
    desc: "Hip angle measuring 98° — aim below parallel for full glute activation.",
    detail: "Tight hip flexors limiting range. Add 90/90 hip stretches daily — 2 min each side — to open the hip flexor chain.",
    source: "Schoenfeld BJ. (2010). Squatting kinematics and kinetics. J Strength Cond Res 24(12):3497–3506",
  },
  {
    label: "Squat Depth",
    priority: "GOOD",
    color: "#22C55E",
    icon: "✓",
    desc: "Great depth consistently — maintain as you add load.",
    detail: "Depth is solid. Focus on maintaining this range when increasing weight.",
    source: "Escamilla RF et al. (2001). Knee biomechanics of the dynamic squat exercise. Med Sci Sports Exerc 33(1):127–141",
  },
];

/* ─── CoachView ─────────────────────────────────────────────────────── */
export function CoachView() {
  const [expanded, setExpanded] = useState<number | null>(0);

  // Demo muscle flags: knees + hips flagged at risk levels 2 and 1
  const muscleFlags: MuscleFlags = { qL: 2, qR: 1, hmL: 2, hmR: 1, gL: 2, gR: 1, hfL: 1, hfR: 1 };

  return (
    <div style={{
      background: "#0a0a0f", minHeight: "100vh",
      fontFamily: "'Inter', sans-serif", color: "#fff",
      maxWidth: 390, margin: "0 auto", overflowY: "auto",
    }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", paddingBottom: 8, paddingInline: 20, position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: "auto" }}>9:41</span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>●●●</span>
      </div>

      {/* Nav bar — no reps counter */}
      <div style={{
        position: "absolute", top: 44, left: 0, right: 0, zIndex: 20,
        display: "flex", alignItems: "center", paddingInline: 16, paddingBottom: 10, gap: 10,
      }}>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="#fff"/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>Weightlifting · Coach Report</div>
          <div style={{ fontSize: 11, color: "#22C55E" }}>● Analysis complete</div>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Share2 size={15} color="#fff"/>
        </button>
      </div>

      {/* ── Hero — annotated skeleton ─────────────────────────────────── */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "390/460" }}>
        <AnnotatedSkeleton/>
      </div>

      {/* ── Score ring + Muscle Focus — matches real app cvRow ──────────── */}
      <div style={{ display: "flex", gap: 12, padding: "14px 18px 0" }}>

        {/* Score card — flex:1, score ring centred, sport label below */}
        <div style={{
          flex: 1,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14, padding: "14px 8px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        }}>
          <div style={{ fontSize: 9, color: "#4b5563", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>AI ANALYSIS</div>
          <ScoreRing score={72}/>
          <div style={{ fontSize: 10, color: "#4b5563", textTransform: "capitalize" }}>Weightlifting</div>
        </div>

        {/* Muscle focus card — flex:1.2, anatomy diagram */}
        <div style={{
          flex: 1.2,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14, padding: "10px 6px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        }}>
          <div style={{ fontSize: 9, color: "#4b5563", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>MUSCLE FOCUS</div>
          <AnatomyMap flags={muscleFlags}/>
        </div>
      </div>

      {/* ── Joint chips ─────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 18px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[
          { label: "Left Knee · 145°", color: "#EF4444" },
          { label: "Right Knee · 138°", color: "#FF6B35" },
          { label: "Left Hip · 98°", color: "#FF6B35" },
          { label: "Right Hip · 102°", color: "#FF6B35" },
        ].map((chip, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 5,
            border: `1px solid ${chip.color}66`, borderRadius: 20,
            padding: "4px 9px", background: chip.color + "14",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: chip.color }}/>
            <span style={{ fontSize: 11, color: chip.color, fontWeight: 600 }}>{chip.label}</span>
          </div>
        ))}
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
          <span style={{ fontSize: 10, color: "#2F7BFF" }}>✦ Tap a joint to inspect it on your frame</span>
        </div>
      </div>

      {/* ── INJURY PREVENTION ───────────────────────────────────────────── */}
      <div style={{ padding: "16px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "#ef444488", fontWeight: 700, letterSpacing: "0.15em" }}>🛡 INJURY PREVENTION</span>
        </div>

        {FEEDBACK.map((f, i) => (
          <button
            key={i}
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              width: "100%", marginBottom: 8,
              background: expanded === i ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${expanded === i ? f.color + "45" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 14, padding: "12px 14px",
              display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", textAlign: "left",
            }}
          >
            {/* Icon circle */}
            <div style={{
              width: 34, height: 34, borderRadius: 17, flexShrink: 0, marginTop: 1,
              background: f.color + "20", border: `1px solid ${f.color}40`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}>{f.icon}</div>

            <div style={{ flex: 1 }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{f.label}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                  color: f.color, background: f.color + "18",
                  border: `1px solid ${f.color}35`, borderRadius: 5, padding: "2px 6px",
                }}>{f.priority}</span>
              </div>
              {/* Description */}
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{f.desc}</div>

              {/* Inline source — always visible */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 5 }}>
                <BookOpen size={10} color="#44445a" style={{ marginTop: 2, flexShrink: 0 }}/>
                <span style={{ fontSize: 10, color: "#44445a", fontStyle: "italic", lineHeight: 1.4 }}>{f.source}</span>
              </div>

              {/* Expanded drill */}
              {expanded === i && (
                <div style={{
                  marginTop: 10, fontSize: 12, color: "#9ca3af", lineHeight: 1.65,
                  borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10,
                }}>
                  {f.detail}
                  <div style={{
                    marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
                    background: "#2F7BFF", borderRadius: 10,
                    padding: "8px 14px", cursor: "pointer",
                  }}>
                    <MessageCircle size={13} color="#fff"/>
                    <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Ask Coach about this</span>
                  </div>
                </div>
              )}
            </div>

            <ChevronRight size={14} color="#374151" style={{
              flexShrink: 0, marginTop: 10,
              transform: expanded === i ? "rotate(90deg)" : "none", transition: "transform 0.2s",
            }}/>
          </button>
        ))}
      </div>

      {/* ── Peer-reviewed sources toggle ────────────────────────────────── */}
      <div style={{ padding: "8px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", cursor: "pointer" }}>
          <BookOpen size={12} color="#55556e"/>
          <span style={{ fontSize: 11, color: "#55556e", flex: 1 }}>Peer-reviewed sources</span>
          <ChevronRight size={12} color="#55556e"/>
        </div>
      </div>

      {/* ── Ask Coach ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 18px 36px" }}>
        <button style={{
          width: "100%", padding: "14px 20px",
          background: "#2F7BFF", border: "none", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer",
        }}>
          <MessageCircle size={16} color="#fff"/>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Ask Coach</span>
        </button>
      </div>
    </div>
  );
}
