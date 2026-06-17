"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Check } from "lucide-react";

/* ─── Step data ─────────────────────────────────────────────────────────── */
const SPORTS = [
  "Powerlifting","Olympic Weightlifting","Running","Swimming",
  "Basketball","Soccer","Tennis","Golf","CrossFit",
  "Gymnastics","Boxing","Cycling","Yoga","Pilates",
  "Football","Baseball","Volleyball","Martial Arts","Other",
];

const LEVELS = [
  { label:"Beginner",     sub:"Just starting out"               },
  { label:"Intermediate", sub:"1–3 years experience"            },
  { label:"Advanced",     sub:"3+ years, competing"             },
  { label:"Elite",        sub:"Professional / competitive athlete"},
];

const GOALS = [
  "Improve technique","Prevent injuries","Increase performance",
  "Learn new movements","Recovery & rehab","Competition prep",
];

const INJURIES = [
  "No current injuries","Lower back","Knee","Shoulder",
  "Hip","Ankle","Elbow","Neck",
];

/* ─── Shared animation ─────────────────────────────────────────────────── */
const variants = {
  enter:  { opacity:0, x: 40 },
  center: { opacity:1, x:  0 },
  exit:   { opacity:0, x:-40 },
};

interface State {
  sport:    string;
  level:    string;
  goals:    string[];
  injuries: string[];
}

const TOTAL = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]   = useState(1);
  const [state, setState] = useState<State>({ sport:"", level:"", goals:[], injuries:[] });

  const canContinue = () => {
    if (step === 1) return !!state.sport;
    if (step === 2) return !!state.level;
    if (step === 3) return state.goals.length > 0;
    if (step === 4) return state.injuries.length > 0;
    return true;
  };

  const next = () => {
    if (step < TOTAL) setStep(s => s + 1);
    else router.push("/dashboard");
  };
  const back = () => { if (step > 1) setStep(s => s - 1); };

  const toggle = (key: "goals"|"injuries", val: string) => {
    setState(prev => ({
      ...prev,
      [key]: prev[key].includes(val)
        ? prev[key].filter(v => v !== val)
        : [...prev[key], val],
    }));
  };

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background:"var(--bg)", color:"var(--text-primary)" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4 px-5 pt-14 pb-4 shrink-0">
        {step > 1 ? (
          <button onClick={back} className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
            <ChevronLeft className="w-4 h-4" style={{ color:"var(--text-secondary)" }} />
          </button>
        ) : <div className="w-8" />}

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color:"var(--text-tertiary)" }}>
              {step} / {TOTAL}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 rounded-full" style={{ background:"var(--surface-3)" }}>
            <motion.div className="h-full rounded-full" style={{ background:"var(--accent)" }}
              animate={{ width:`${(step/TOTAL)*100}%` }}
              transition={{ duration:0.35, ease:"easeOut" }} />
          </div>
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration:0.28, ease:[0.4,0,0.2,1] }}
            className="absolute inset-0 overflow-y-auto px-5 pt-4 pb-4">

            {step === 1 && (
              <StepWrapper title="What's your sport?" sub="We'll tailor feedback to your discipline.">
                <div className="flex flex-wrap gap-2">
                  {SPORTS.map(s => (
                    <Chip key={s} label={s} selected={state.sport===s}
                      onSelect={()=>setState(p=>({...p,sport:s}))} />
                  ))}
                </div>
              </StepWrapper>
            )}

            {step === 2 && (
              <StepWrapper title="What's your level?" sub="This helps calibrate how we frame feedback.">
                <div className="space-y-3">
                  {LEVELS.map(l => (
                    <LevelCard key={l.label} label={l.label} sub={l.sub}
                      selected={state.level===l.label}
                      onSelect={()=>setState(p=>({...p,level:l.label}))} />
                  ))}
                </div>
              </StepWrapper>
            )}

            {step === 3 && (
              <StepWrapper title="What are your goals?" sub="Select all that apply.">
                <div className="flex flex-wrap gap-2">
                  {GOALS.map(g => (
                    <Chip key={g} label={g} selected={state.goals.includes(g)}
                      onSelect={()=>toggle("goals",g)} />
                  ))}
                </div>
              </StepWrapper>
            )}

            {step === 4 && (
              <StepWrapper title="Any injury concerns?" sub="We'll factor these into feedback and drill recommendations.">
                <div className="space-y-3">
                  {INJURIES.map(inj => (
                    <LevelCard key={inj} label={inj} sub=""
                      selected={state.injuries.includes(inj)}
                      onSelect={()=>toggle("injuries",inj)}
                      multi />
                  ))}
                </div>
              </StepWrapper>
            )}

            {step === 5 && (
              <StepWrapper title="You're all set! 🎉" sub="Your personalized coaching profile is ready.">
                <div className="space-y-3 mt-2">
                  {[
                    { label:"Sport",    value: state.sport || "—" },
                    { label:"Level",    value: state.level || "—" },
                    { label:"Goals",    value: state.goals.join(", ") || "—" },
                    { label:"Injuries", value: state.injuries.join(", ") || "—" },
                  ].map(row => (
                    <div key={row.label} className="flex items-start justify-between gap-4 py-3"
                      style={{ borderBottom:"1px solid var(--border)" }}>
                      <span className="text-sm" style={{ color:"var(--text-secondary)" }}>{row.label}</span>
                      <span className="text-sm font-semibold text-right" style={{ color:"var(--text-primary)" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </StepWrapper>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Continue button ── */}
      <div className="shrink-0 px-5 py-5 pb-safe"
        style={{ borderTop:"1px solid var(--border)" }}>
        <motion.button whileTap={{scale:0.97}} onClick={next}
          disabled={!canContinue()}
          className="w-full py-4 rounded-2xl font-bold text-base transition-opacity disabled:opacity-35"
          style={{ background:"var(--accent)", color:"#fff" }}>
          {step === TOTAL ? "Go to Dashboard →" : "Continue"}
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */
function StepWrapper({ title, sub, children }: { title:string; sub:string; children:React.ReactNode }) {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight mb-2" style={{ color:"var(--text-primary)" }}>{title}</h1>
      <p className="text-base mb-6" style={{ color:"var(--text-secondary)" }}>{sub}</p>
      {children}
    </div>
  );
}

function Chip({ label, selected, onSelect }: { label:string; selected:boolean; onSelect:()=>void }) {
  return (
    <motion.button whileTap={{scale:0.95}} onClick={onSelect}
      className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: selected ? "rgba(108,99,255,0.12)" : "var(--surface-2)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
      }}>
      {label}
    </motion.button>
  );
}

function LevelCard({ label, sub, selected, onSelect, multi }:
  { label:string; sub:string; selected:boolean; onSelect:()=>void; multi?:boolean }) {
  return (
    <motion.button whileTap={{scale:0.98}} onClick={onSelect}
      className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-all"
      style={{
        background: selected ? "rgba(108,99,255,0.09)" : "var(--surface)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
      }}>
      <div>
        <p className="font-bold text-base" style={{ color:"var(--text-primary)" }}>{label}</p>
        {sub && <p className="text-sm mt-0.5" style={{ color:"var(--text-secondary)" }}>{sub}</p>}
      </div>
      {selected && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ background:"var(--accent)" }}>
          <Check className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </motion.button>
  );
}
