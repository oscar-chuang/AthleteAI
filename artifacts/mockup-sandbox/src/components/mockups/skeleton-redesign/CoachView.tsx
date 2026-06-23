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

/* ─── Anatomical muscle map ──────────────────────────────────────────── */
interface MuscleFlags {
  qL?: number; qR?: number;
  hmL?: number; hmR?: number;
  hfL?: number; hfR?: number;
  gL?: number; gR?: number;
  bL?: number; bR?: number;
  tL?: number; tR?: number;
}

function AnatomyMap({ flags }: { flags: MuscleFlags }) {
  const BASE = "#18182a";
  const OUTLINE = "#2e2e50";

  const fill = (k: keyof MuscleFlags) =>
    flags[k] !== undefined ? RISK_COLORS[flags[k]!] + "50" : BASE;
  const stroke = (k: keyof MuscleFlags) =>
    flags[k] !== undefined ? RISK_COLORS[flags[k]!] : OUTLINE;
  const sw = (k: keyof MuscleFlags) =>
    flags[k] !== undefined ? 1.6 : 0.9;
  const glow = (k: keyof MuscleFlags) =>
    flags[k] !== undefined ? `drop-shadow(0 0 3px ${RISK_COLORS[flags[k]!]}88)` : undefined;

  return (
    <svg width={130} height={160} viewBox="0 0 130 160">
      <defs>
        {/* subtle inner glow for highlighted muscles */}
        <filter id="mGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ══════════════ FRONT (centred x=31) ══════════════ */}

      {/* Body silhouette outline */}
      <path
        d="M31,3 a8,8 0 1,0 0.01,0
           M24,19 Q15,21 10,28 Q6,33 9,36
           Q12,34 14,27 L18,24
           Q20,57 20,63 Q18,70 17,78
           L14,96 Q13,115 13,118
           L11,140 Q11,144 14,145 L18,145 Q21,144 21,140
           L22,118 L23,113 L24,118 L24,140
           Q24,144 27,145 L33,145 Q36,144 36,140
           L37,118 L38,113 L39,118 L39,140
           Q39,144 42,145 L46,145 Q49,144 49,140
           L47,118 Q47,115 45,96
           L43,78 Q42,70 40,63 Q40,57 42,24
           L46,27 Q48,34 51,36
           Q54,33 50,28 Q45,21 38,19 Z"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8} strokeLinejoin="round"
      />

      {/* Head */}
      <circle cx={31} cy={10} r={8} fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>
      {/* Neck */}
      <rect x={27.5} y={18} width={7} height={6} rx={2} fill={BASE} stroke={OUTLINE} strokeWidth={0.7}/>

      {/* Left deltoid */}
      <ellipse cx={12} cy={28} rx={6} ry={5} transform="rotate(-20 12 28)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>
      {/* Right deltoid */}
      <ellipse cx={50} cy={28} rx={6} ry={5} transform="rotate(20 50 28)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>

      {/* Left pec */}
      <ellipse cx={23} cy={32} rx={6} ry={7} transform="rotate(-5 23 32)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>
      {/* Right pec */}
      <ellipse cx={39} cy={32} rx={6} ry={7} transform="rotate(5 39 32)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>

      {/* Left bicep */}
      <ellipse cx={10} cy={40} rx={4.5} ry={11} transform="rotate(-10 10 40)"
        fill={fill("bL")} stroke={stroke("bL")} strokeWidth={sw("bL")}
        style={{ filter: glow("bL") }}/>
      {/* Right bicep */}
      <ellipse cx={52} cy={40} rx={4.5} ry={11} transform="rotate(10 52 40)"
        fill={fill("bR")} stroke={stroke("bR")} strokeWidth={sw("bR")}
        style={{ filter: glow("bR") }}/>

      {/* Abs */}
      <rect x={22} y={40} width={18} height={22} rx={5} fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      <line x1={31} y1={40} x2={31} y2={62} stroke={OUTLINE} strokeWidth={0.6}/>
      <line x1={22} y1={48} x2={40} y2={48} stroke={OUTLINE} strokeWidth={0.6}/>
      <line x1={22} y1={55} x2={40} y2={55} stroke={OUTLINE} strokeWidth={0.6}/>

      {/* Left forearm */}
      <ellipse cx={8} cy={58} rx={3.5} ry={9} transform="rotate(10 8 58)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      {/* Right forearm */}
      <ellipse cx={54} cy={58} rx={3.5} ry={9} transform="rotate(-10 54 58)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Hip flexors */}
      <ellipse cx={23} cy={70} rx={7.5} ry={6}
        fill={fill("hfL")} stroke={stroke("hfL")} strokeWidth={sw("hfL")}
        style={{ filter: glow("hfL") }}/>
      <ellipse cx={39} cy={70} rx={7.5} ry={6}
        fill={fill("hfR")} stroke={stroke("hfR")} strokeWidth={sw("hfR")}
        style={{ filter: glow("hfR") }}/>

      {/* Left quad */}
      <ellipse cx={22} cy={95} rx={8} ry={19}
        fill={fill("qL")} stroke={stroke("qL")} strokeWidth={sw("qL")}
        style={{ filter: glow("qL") }}/>
      {/* Right quad */}
      <ellipse cx={40} cy={95} rx={8} ry={19}
        fill={fill("qR")} stroke={stroke("qR")} strokeWidth={sw("qR")}
        style={{ filter: glow("qR") }}/>

      {/* Knee caps */}
      <ellipse cx={22} cy={115} rx={5.5} ry={4} fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      <ellipse cx={40} cy={115} rx={5.5} ry={4} fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Left shin */}
      <ellipse cx={21} cy={131} rx={4.5} ry={12}
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      {/* Right shin */}
      <ellipse cx={39} cy={131} rx={4.5} ry={12}
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Feet */}
      <ellipse cx={22} cy={144} rx={6} ry={2.5} fill={BASE} stroke={OUTLINE} strokeWidth={0.7}/>
      <ellipse cx={39} cy={144} rx={6} ry={2.5} fill={BASE} stroke={OUTLINE} strokeWidth={0.7}/>

      <text x={31} y={154} fontSize={7} fill="#44445a" textAnchor="middle" fontFamily="Inter, sans-serif">FRONT</text>

      {/* ── divider ── */}
      <line x1={65} y1={4} x2={65} y2={150} stroke="#252540" strokeWidth={0.6} strokeDasharray="2 3"/>

      {/* ══════════════ BACK (centred x=96) ══════════════ */}

      {/* Body silhouette outline */}
      <path
        d="M96,3 a8,8 0 1,0 0.01,0
           M89,19 Q80,21 75,28 Q71,33 74,36
           Q77,34 79,27 L83,24
           Q85,50 85,58 Q80,60 78,68
           Q76,75 75,78 L73,96 Q72,115 72,118
           L70,140 Q70,144 73,145 L77,145 Q80,144 80,140
           L81,118 L83,113 L84,118 L84,140
           Q84,144 87,145 L93,145 Q96,144 96,140
           L97,118 L98,113 L99,118 L99,140
           Q99,144 102,145 L106,145 Q109,144 109,140
           L107,118 Q107,115 105,96
           L103,78 Q102,75 100,68
           Q98,60 107,58 Q107,50 109,24
           L113,27 Q115,34 118,36
           Q121,33 117,28 Q112,21 103,19 Z"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8} strokeLinejoin="round"
      />

      {/* Head */}
      <circle cx={96} cy={10} r={8} fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>
      {/* Neck */}
      <rect x={92.5} y={18} width={7} height={6} rx={2} fill={BASE} stroke={OUTLINE} strokeWidth={0.7}/>

      {/* Traps — left / right humps */}
      <ellipse cx={79} cy={26} rx={9} ry={5} transform="rotate(-15 79 26)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>
      <ellipse cx={113} cy={26} rx={9} ry={5} transform="rotate(15 113 26)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>
      {/* Upper trap centre */}
      <ellipse cx={96} cy={25} rx={8} ry={5} fill={BASE} stroke={OUTLINE} strokeWidth={0.9}/>

      {/* Lats */}
      <path d="M89,26 Q80,40 82,58 Q85,63 89,63 L89,26 Z"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      <path d="M103,26 Q112,40 110,58 Q107,63 103,63 L103,26 Z"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Left tricep */}
      <ellipse cx={74} cy={40} rx={4.5} ry={11} transform="rotate(-10 74 40)"
        fill={fill("tL")} stroke={stroke("tL")} strokeWidth={sw("tL")}
        style={{ filter: glow("tL") }}/>
      {/* Right tricep */}
      <ellipse cx={118} cy={40} rx={4.5} ry={11} transform="rotate(10 118 40)"
        fill={fill("tR")} stroke={stroke("tR")} strokeWidth={sw("tR")}
        style={{ filter: glow("tR") }}/>

      {/* Left forearm */}
      <ellipse cx={72} cy={58} rx={3.5} ry={9} transform="rotate(10 72 58)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      {/* Right forearm */}
      <ellipse cx={120} cy={58} rx={3.5} ry={9} transform="rotate(-10 120 58)"
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Lower back / erector spinae */}
      <ellipse cx={92} cy={65} rx={3.5} ry={7} fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      <ellipse cx={100} cy={65} rx={3.5} ry={7} fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Glutes */}
      <ellipse cx={84} cy={81} rx={10} ry={10}
        fill={fill("gL")} stroke={stroke("gL")} strokeWidth={sw("gL")}
        style={{ filter: glow("gL") }}/>
      <ellipse cx={108} cy={81} rx={10} ry={10}
        fill={fill("gR")} stroke={stroke("gR")} strokeWidth={sw("gR")}
        style={{ filter: glow("gR") }}/>

      {/* Left hamstring */}
      <ellipse cx={82} cy={99} rx={8} ry={18}
        fill={fill("hmL")} stroke={stroke("hmL")} strokeWidth={sw("hmL")}
        style={{ filter: glow("hmL") }}/>
      {/* Right hamstring */}
      <ellipse cx={110} cy={99} rx={8} ry={18}
        fill={fill("hmR")} stroke={stroke("hmR")} strokeWidth={sw("hmR")}
        style={{ filter: glow("hmR") }}/>

      {/* Knee backs */}
      <ellipse cx={82} cy={115} rx={5.5} ry={4} fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      <ellipse cx={110} cy={115} rx={5.5} ry={4} fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Calves */}
      <ellipse cx={81} cy={131} rx={5.5} ry={13}
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>
      <ellipse cx={111} cy={131} rx={5.5} ry={13}
        fill={BASE} stroke={OUTLINE} strokeWidth={0.8}/>

      {/* Feet */}
      <ellipse cx={82} cy={144} rx={6} ry={2.5} fill={BASE} stroke={OUTLINE} strokeWidth={0.7}/>
      <ellipse cx={110} cy={144} rx={6} ry={2.5} fill={BASE} stroke={OUTLINE} strokeWidth={0.7}/>

      <text x={96} y={154} fontSize={7} fill="#44445a" textAnchor="middle" fontFamily="Inter, sans-serif">BACK</text>
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
