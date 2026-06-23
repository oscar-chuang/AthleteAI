import { useState } from "react";
import { ChevronLeft, Share2, AlertTriangle, ChevronDown, ChevronUp, Zap, CheckCircle, BookOpen } from "lucide-react";

const FRAMES = [
  { t: "0:03", label: "Setup",    riskColor: "#22C55E", kneeLx: 122, kneeLy: 293, hipLy: 198, angle: "162°", desc: "Good setup — spine neutral, knees tracking over toes." },
  { t: "0:06", label: "Descent",  riskColor: "#f97316", kneeLx: 132, kneeLy: 298, hipLy: 204, angle: "148°", desc: "Early descent — slight knee drift beginning inward." },
  { t: "0:08", label: "Bottom",   riskColor: "#ef4444", kneeLx: 140, kneeLy: 304, hipLy: 212, angle: "145°", desc: "Worst moment. Left knee collapses at peak load depth." },
  { t: "0:10", label: "Ascent",   riskColor: "#f97316", kneeLx: 134, kneeLy: 299, hipLy: 206, angle: "150°", desc: "Recovering — knee drift reduces on the way up." },
  { t: "0:13", label: "Lockout",  riskColor: "#22C55E", kneeLx: 122, kneeLy: 292, hipLy: 197, angle: "168°", desc: "Good lockout — knee aligned, hips fully extended." },
];

const JOINTS = [
  { label: "L. Knee",  angle: "145°", color: "#ef4444" },
  { label: "R. Hip",   angle: "52°",  color: "#f97316" },
  { label: "L. Elbow", angle: "162°", color: "#2F7BFF" },
  { label: "R. Knee",  angle: "138°", color: "#22C55E" },
];

const TIPS = [
  {
    joint: "Left Knee", color: "#ef4444", risk: 82,
    title: "Knee valgus at peak load",
    body: "Your left knee collapses inward during the descent phase. This stresses the ACL and medial collateral ligament.",
    drill: "Single-leg glute bridges (3×12) — activate glute med before your next session.",
    source: "Hewett et al. (2005) Am J Sports Med",
  },
  {
    joint: "Right Hip", color: "#f97316", risk: 58,
    title: "Hip hinge depth limited",
    body: "Hip flexion peaks at 52° — below the 55–65° optimal range. Tight hip flexors are likely limiting your depth.",
    drill: "90/90 hip stretch (2 min each side) daily before training.",
    source: "Schoenfeld (2010) J Strength Cond Res",
  },
];

function SkeletonSVG({ frame, size = 300 }: { frame: typeof FRAMES[0]; size?: number }) {
  const scale = size / 300;
  const s = (n: number) => n * scale;
  const kx = s(frame.kneeLx), ky = s(frame.kneeLy), hy = s(frame.hipLy);
  const c = frame.riskColor;
  const isWorst = frame.riskColor === "#ef4444";

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size * 1.4}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="bg3" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#050810" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width={size} height={size * 1.4} fill="url(#bg3)"/>
      {/* Spine */}
      <line x1={s(150)} y1={s(98)} x2={s(150)} y2={hy + s(12)} stroke="rgba(255,255,255,0.22)" strokeWidth={s(3)} strokeLinecap="round"/>
      {/* Shoulders */}
      <line x1={s(110)} y1={s(118)} x2={s(190)} y2={s(118)} stroke="rgba(255,255,255,0.22)" strokeWidth={s(3)} strokeLinecap="round"/>
      {/* Left arm */}
      <line x1={s(110)} y1={s(118)} x2={s(88)} y2={s(178)} stroke="#a78bfa" strokeWidth={s(3)} strokeLinecap="round"/>
      <line x1={s(88)}  y1={s(178)} x2={s(72)} y2={s(224)} stroke="#a78bfa" strokeWidth={s(3)} strokeLinecap="round"/>
      {/* Right arm */}
      <line x1={s(190)} y1={s(118)} x2={s(212)} y2={s(178)} stroke="#60a5fa" strokeWidth={s(3)} strokeLinecap="round"/>
      <line x1={s(212)} y1={s(178)} x2={s(228)} y2={s(224)} stroke="#60a5fa" strokeWidth={s(3)} strokeLinecap="round"/>
      {/* Hips */}
      <line x1={s(120)} y1={hy + s(12)} x2={s(180)} y2={hy + s(12)} stroke="rgba(255,255,255,0.22)" strokeWidth={s(3)} strokeLinecap="round"/>
      {/* Left leg — risk coloured */}
      <line x1={s(120)} y1={hy + s(12)} x2={kx}         y2={ky}         stroke={c} strokeWidth={s(4)} strokeLinecap="round"/>
      <line x1={kx}     y1={ky}         x2={kx - s(14)} y2={ky + s(82)} stroke={c} strokeWidth={s(4)} strokeLinecap="round"/>
      {/* Right leg */}
      <line x1={s(180)} y1={hy + s(12)} x2={s(172)}       y2={ky - s(4)}  stroke="#a78bfa" strokeWidth={s(3)} strokeLinecap="round"/>
      <line x1={s(172)} y1={ky - s(4)}  x2={s(178)}       y2={ky + s(78)} stroke="#a78bfa" strokeWidth={s(3)} strokeLinecap="round"/>
      {/* Joints */}
      <circle cx={s(150)} cy={s(96)} r={s(5)} fill="rgba(255,255,255,0.45)"/>
      <circle cx={s(110)} cy={s(118)} r={s(4)} fill="#60a5fa"/>
      <circle cx={s(190)} cy={s(118)} r={s(4)} fill="#a78bfa"/>
      <circle cx={s(150)} cy={hy + s(12)} r={s(6)} fill="#f97316"/>
      {isWorst && <circle cx={kx} cy={ky} r={s(15)} fill={c} opacity="0.18"/>}
      <circle cx={kx} cy={ky} r={isWorst ? s(9) : s(6)} fill={c} opacity="0.92"/>
      <circle cx={s(172)} cy={ky - s(4)} r={s(5)} fill="#22C55E"/>
      <circle cx={s(72)} cy={s(224)} r={s(4)} fill="#a78bfa"/>
      <circle cx={s(228)} cy={s(224)} r={s(4)} fill="#60a5fa"/>
      {/* Angle callout */}
      <rect x={kx + s(14)} y={ky - s(14)} width={s(62)} height={s(23)} rx={s(6)} fill={c} opacity="0.92"/>
      <text x={kx + s(45)} y={ky + s(4)} textAnchor="middle" fill="white" fontSize={s(12)} fontWeight="700">{frame.angle}</text>
    </svg>
  );
}

export function Combined() {
  const [active, setActive]   = useState(2);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [done, setDone]       = useState<Record<number, boolean>>({});
  const fr = FRAMES[active]!;

  return (
    <div style={{ background: "#09090f", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff", maxWidth: 390, margin: "0 auto", overflowY: "auto" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", paddingBottom: 8, paddingInline: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: "auto" }}>9:41</span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>●●●</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", paddingInline: 16, paddingBottom: 12, gap: 12 }}>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="#fff"/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Movement Analysis</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Weightlifting · Back Squat</div>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Share2 size={16} color="#fff"/>
        </button>
      </div>

      {/* ── Hero freeze frame ─────────────────────────────────────── */}
      <div style={{
        marginInline: 16, borderRadius: 20, overflow: "hidden",
        position: "relative", aspectRatio: "9/11",
        background: "linear-gradient(160deg, #141428 0%, #09090f 100%)",
        border: `1px solid ${fr.riskColor}44`,
        transition: "border-color 0.25s",
      }}>
        <SkeletonSVG frame={fr}/>

        {/* Risk badge */}
        {fr.riskColor === "#ef4444" && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(239,68,68,0.14)", backdropFilter: "blur(14px)",
            border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10,
            padding: "5px 10px", display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertTriangle size={12} color="#ef4444"/>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>WORST FRAME</span>
          </div>
        )}

        {/* Score badge */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
          padding: "5px 10px", display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#2F7BFF" }}>75</span>
          <span style={{ fontSize: 10, color: "#6b7280" }}>/100</span>
        </div>

        {/* Frame caption */}
        <div style={{
          position: "absolute", bottom: 10, left: 10, right: 10,
          background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)",
          borderRadius: 10, padding: "7px 12px",
          transition: "opacity 0.2s",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#e5e7eb", lineHeight: 1.45 }}>{fr.desc}</p>
        </div>
      </div>

      {/* ── Key-moments filmstrip ─────────────────────────────────── */}
      <div style={{ paddingInline: 16, marginTop: 12 }}>
        <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Key Moments — tap to explore
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {FRAMES.map((f, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                flex: 1, height: 68, borderRadius: 12, overflow: "hidden",
                position: "relative",
                background: "linear-gradient(135deg, #141428, #09090f)",
                border: `2px solid ${active === i ? f.riskColor : "rgba(255,255,255,0.07)"}`,
                cursor: "pointer", padding: 0,
                boxShadow: active === i ? `0 0 10px ${f.riskColor}44` : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              {/* Mini skeleton */}
              <svg width="100%" height="52" viewBox="0 0 56 52">
                <circle cx="28" cy="8" r="4" fill="rgba(255,255,255,0.28)"/>
                <line x1="28" y1="12" x2="28" y2="28" stroke="rgba(255,255,255,0.18)" strokeWidth="2"/>
                <line x1="18" y1="17" x2="38" y2="17" stroke="rgba(255,255,255,0.18)" strokeWidth="2"/>
                <line x1="18" y1="17" x2="12" y2="29" stroke="#a78bfa" strokeWidth="1.5"/>
                <line x1="38" y1="17" x2="44" y2="29" stroke="#60a5fa" strokeWidth="1.5"/>
                <line x1="22" y1="28" x2="34" y2="28" stroke="rgba(255,255,255,0.18)" strokeWidth="2"/>
                {/* Left leg with risk colour */}
                <line x1="22" y1="28" x2={i === 2 ? 26 : 21} y2="40" stroke={f.riskColor} strokeWidth="2"/>
                <line x1={i === 2 ? 26 : 21} y1="40" x2={i === 2 ? 20 : 18} y2="50" stroke={f.riskColor} strokeWidth="2"/>
                <line x1="34" y1="28" x2="36" y2="40" stroke="#a78bfa" strokeWidth="1.5"/>
                <line x1="36" y1="40" x2="37" y2="50" stroke="#a78bfa" strokeWidth="1.5"/>
                <circle cx={i === 2 ? 26 : 21} cy="40" r={i === 2 ? 3.5 : 2.5} fill={f.riskColor} opacity="0.9"/>
              </svg>
              {/* Timestamp */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "rgba(0,0,0,0.72)", padding: "2px 0", textAlign: "center",
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: active === i ? f.riskColor : "#6b7280" }}>{f.t}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Joint angle pills ────────────────────────────────────── */}
      <div style={{ paddingInline: 16, marginTop: 14 }}>
        <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Joint Angles</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {JOINTS.map((j) => (
            <div key={j.label} style={{
              background: j.color + "16", border: `1px solid ${j.color}40`,
              borderRadius: 20, padding: "6px 12px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: j.color }}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: j.color }}>{j.angle}</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{j.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Coaching tips ────────────────────────────────────────── */}
      <div style={{ paddingInline: 16, marginTop: 18, paddingBottom: 32 }}>
        <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Coaching Tips</div>

        {TIPS.map((tip, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.035)",
            border: `1px solid ${expanded === i ? tip.color + "50" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 16, marginBottom: 10, overflow: "hidden",
            transition: "border-color 0.2s",
          }}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                width: "100%", padding: "13px 15px",
                display: "flex", alignItems: "center", gap: 11,
                background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: tip.color + "20",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <AlertTriangle size={15} color={tip.color}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{tip.title}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{tip.joint} · {tip.risk}% risk</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                <div style={{ width: 38, height: 4, background: "rgba(255,255,255,0.09)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${tip.risk}%`, height: "100%", background: tip.color, borderRadius: 2 }}/>
                </div>
                {expanded === i ? <ChevronUp size={13} color="#4b5563"/> : <ChevronDown size={13} color="#4b5563"/>}
              </div>
            </button>

            {expanded === i && (
              <div style={{ padding: "0 15px 15px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>{tip.body}</p>

                <div style={{
                  background: "rgba(47,123,255,0.08)", border: "1px solid rgba(47,123,255,0.2)",
                  borderRadius: 12, padding: "10px 12px",
                  display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 10,
                }}>
                  <Zap size={13} color="#2F7BFF" style={{ marginTop: 1, flexShrink: 0 }}/>
                  <div>
                    <div style={{ fontSize: 10, color: "#2F7BFF", fontWeight: 700, marginBottom: 3, letterSpacing: "0.04em" }}>TRY THIS DRILL</div>
                    <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5 }}>{tip.drill}</div>
                  </div>
                </div>

                <button
                  onClick={() => setDone(d => ({ ...d, [i]: !d[i] }))}
                  style={{
                    width: "100%", padding: "9px 14px", borderRadius: 10,
                    background: done[i] ? "#22C55E1a" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${done[i] ? "#22C55E50" : "rgba(255,255,255,0.09)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    cursor: "pointer", color: done[i] ? "#22C55E" : "#9ca3af",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  <CheckCircle size={13}/>
                  {done[i] ? "Drill completed ✓" : "Mark drill done"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
                  <BookOpen size={10} color="#374151"/>
                  <span style={{ fontSize: 10, color: "#374151" }}>{tip.source}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Ask coach */}
        <button style={{
          width: "100%", padding: "13px 20px",
          background: "linear-gradient(135deg, #2F7BFF1a, #2F7BFF0d)",
          border: "1px solid rgba(47,123,255,0.28)",
          borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer", marginTop: 4,
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
