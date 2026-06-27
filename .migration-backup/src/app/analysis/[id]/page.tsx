"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, ChevronRight, Dumbbell, Share2, GitCompare, Upload } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { ScoreRing } from "@/components/ScoreRing";
import { PoseVideoPlayer, type JointAngles } from "@/components/PoseVideoPlayer";
import { MOCK_ANALYSES } from "@/lib/athleteData";

const SEV = {
  info:     { bg:"rgba(34,211,238,0.07)",  border:"rgba(34,211,238,0.2)",   text:"#22d3ee", Icon:Info },
  warning:  { bg:"rgba(245,158,11,0.07)",  border:"rgba(245,158,11,0.2)",   text:"#f59e0b", Icon:AlertTriangle },
  critical: { bg:"rgba(244,63,94,0.07)",   border:"rgba(244,63,94,0.2)",    text:"#f43f5e", Icon:AlertTriangle },
};

function angleStatus(val:number, type:"knee"|"spine"|"hip"|"elbow"): "good"|"warn"|"danger" {
  if(type==="spine" && val>15) return "danger";
  if(type==="spine" && val>8)  return "warn";
  return "good";
}

export default function AnalysisPage() {
  const inputId    = useId();
  const analysis   = MOCK_ANALYSES[0];
  const [tab, setTab]           = useState<"coaching"|"injury"|"drills">("coaching");
  const [expanded, setExpanded] = useState<string|null>(null);
  const [videoFile, setVideoFile] = useState<File|null>(null);
  const [liveAngles, setLiveAngles] = useState<JointAngles|null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setVideoFile(f);
  };

  const angleRows = liveAngles ? [
    { label:"Left Knee",  value:`${liveAngles.leftKnee}°`,   status:angleStatus(liveAngles.leftKnee,"knee") },
    { label:"Right Knee", value:`${liveAngles.rightKnee}°`,  status:angleStatus(liveAngles.rightKnee,"knee") },
    { label:"Left Hip",   value:`${liveAngles.leftHip}°`,    status:"good" as const },
    { label:"Right Hip",  value:`${liveAngles.rightHip}°`,   status:"good" as const },
    { label:"Spine Lean", value:`${liveAngles.spineAngle}°`, status:angleStatus(liveAngles.spineAngle,"spine") },
    { label:"L Elbow",    value:`${liveAngles.leftElbow}°`,  status:"good" as const },
  ] : [
    { label:"Hip Angle",  value:"112°", status:"warn"   as const },
    { label:"Knee Angle", value:"165°", status:"good"   as const },
    { label:"Lumbar",     value:"18°",  status:"danger" as const },
    { label:"Shoulder",   value:"82°",  status:"good"   as const },
  ];

  const C = { good:"#10b981", warn:"#f59e0b", danger:"#f43f5e" };

  return (
    <div style={{ background:"var(--bg)", minHeight:"100vh", paddingBottom:90 }}>

      {/* Hidden file input — label in TopBar triggers it */}
      <input id={inputId} type="file" accept="video/*" className="sr-only" onChange={handleFile} />

      <TopBar title={videoFile ? "Live Pose Analysis" : analysis.title} showBack
        right={
          <div className="flex items-center gap-2">
            <label htmlFor={inputId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
              style={{ background:"rgba(108,99,255,0.1)", color:"var(--accent-2)", border:"1px solid rgba(108,99,255,0.22)" }}>
              <Upload className="w-3 h-3" /> Upload
            </label>
            <button className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
              <Share2 className="w-4 h-4" style={{ color:"var(--text-tertiary)" }} />
            </button>
          </div>
        }
      />

      <div className="px-4 pt-4 space-y-4 pb-4">

        {/* ── Pose video player ── */}
        <PoseVideoPlayer videoFile={videoFile} onAngles={setLiveAngles} />

        {/* Live indicator */}
        <AnimatePresence>
          {videoFile && liveAngles && (
            <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.18)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-xs font-semibold" style={{ color:"#10b981" }}>
                Live · {Object.values(liveAngles).filter(v=>v>0).length} joints tracked
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Joint angles ── */}
        <div>
          <p className="section-label mb-2">
            Joint Angles {liveAngles ? "· Live" : "· Demo"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {angleRows.map(({label,value,status})=>(
              <div key={label} className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{
                  background:"var(--surface)",
                  border:`1px solid ${status==="danger"?"rgba(244,63,94,0.2)":status==="warn"?"rgba(245,158,11,0.15)":"var(--border)"}`,
                }}>
                <span className="text-xs" style={{ color:"var(--text-secondary)" }}>{label}</span>
                <span className="text-sm font-black tabular-nums" style={{ color:C[status] }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scores ── */}
        <div>
          <p className="section-label mb-3">Performance Scores</p>
          <div className="flex items-center justify-around py-2">
            <ScoreRing score={analysis.scores.overall}   size={80} label="Overall"   sublabel="/100" />
            <ScoreRing score={analysis.scores.technique} size={68} color="#8b5cf6" label="Technique" />
            <ScoreRing score={analysis.scores.power}     size={68} color="#10b981" label="Power" />
            <ScoreRing score={analysis.scores.balance}   size={68} color="#22d3ee" label="Balance" />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background:"var(--surface)" }}>
          {(["coaching","injury","drills"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize"
              style={{
                background: tab===t?"rgba(108,99,255,0.15)":"transparent",
                color: tab===t?"var(--accent-2)":"var(--text-tertiary)",
              }}>
              {t==="injury"?"Injury":t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <AnimatePresence mode="wait">

          {tab==="coaching" && (
            <motion.div key="c" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-3">
              {/* Strengths */}
              <div className="p-4 rounded-2xl"
                style={{ background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.14)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4" style={{ color:"#10b981" }} />
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color:"#10b981" }}>
                    What you&apos;re doing right
                  </span>
                </div>
                {analysis.strengths.map(s=>(
                  <div key={s} className="flex items-start gap-2 mb-2">
                    <div className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background:"#10b981" }} />
                    <p className="text-sm leading-relaxed" style={{ color:"var(--text-secondary)" }}>{s}</p>
                  </div>
                ))}
              </div>
              {/* Tips */}
              {analysis.tips.map(tip=>{
                const {bg,border,text,Icon}=SEV[tip.severity];
                const open=expanded===tip.id;
                return (
                  <motion.div key={tip.id} layout className="rounded-2xl overflow-hidden"
                    style={{ background:bg, border:`1px solid ${border}` }}
                    onClick={()=>setExpanded(open?null:tip.id)}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <Icon className="w-4 h-4 shrink-0" style={{ color:text }} />
                      <span className="text-sm font-semibold flex-1" style={{ color:text }}>{tip.title}</span>
                      <ChevronRight className="w-4 h-4 shrink-0 transition-transform"
                        style={{ color:text, transform:open?"rotate(90deg)":"none" }} />
                    </div>
                    <AnimatePresence>
                      {open && (
                        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
                          className="px-4 pb-4">
                          <p className="text-sm leading-relaxed mb-3" style={{ color:"var(--text-secondary)" }}>{tip.description}</p>
                          {tip.drill && (
                            <div className="p-3 rounded-xl"
                              style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.15)" }}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Dumbbell className="w-3.5 h-3.5" style={{ color:"var(--accent-2)" }} />
                                <span className="text-xs font-bold" style={{ color:"var(--accent-2)" }}>DRILL</span>
                              </div>
                              <p className="text-sm leading-relaxed" style={{ color:"var(--text-secondary)" }}>{tip.drill}</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {tab==="injury" && (
            <motion.div key="i" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-3">
              {analysis.injuryRisks.map(r=>{
                const col=r.risk>50?"#f43f5e":r.risk>30?"#f59e0b":"#10b981";
                const label=r.risk>50?"High Risk":r.risk>30?"Moderate":"Low Risk";
                return (
                  <div key={r.joint} className="p-4 rounded-2xl space-y-3"
                    style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>{r.joint}</p>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background:`${col}15`, color:col, border:`1px solid ${col}30` }}>
                        {label} · {r.risk}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background:"rgba(255,255,255,0.05)" }}>
                      <motion.div initial={{width:0}} animate={{width:`${r.risk}%`}} transition={{duration:0.8}}
                        className="h-full rounded-full" style={{ background:`linear-gradient(90deg,${col}66,${col})` }} />
                    </div>
                    <p className="text-sm" style={{ color:"var(--text-secondary)" }}>{r.description}</p>
                    <div className="flex items-start gap-2 p-2.5 rounded-xl"
                      style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.14)" }}>
                      <Dumbbell className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color:"var(--accent-2)" }} />
                      <p className="text-xs leading-relaxed" style={{ color:"var(--accent-2)" }}>{r.prevention}</p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {tab==="drills" && (
            <motion.div key="d" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-3">
              {analysis.tips.filter(t=>t.drill).map((t,i)=>(
                <div key={t.id} className="p-4 rounded-2xl"
                  style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.15)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background:"rgba(108,99,255,0.2)", color:"var(--accent-2)" }}>{i+1}</div>
                    <span className="text-sm font-semibold" style={{ color:"var(--accent-2)" }}>{t.title}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color:"var(--text-secondary)" }}>{t.drill}</p>
                </div>
              ))}
              {analysis.improvements.map((imp,i)=>(
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{ background:"var(--surface-3)", color:"var(--text-tertiary)" }}>{i+1}</div>
                  <p className="text-sm leading-relaxed" style={{ color:"var(--text-secondary)" }}>{imp}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compare CTA */}
        <Link href="/compare">
          <motion.div whileTap={{scale:0.97}} className="flex items-center gap-4 p-4 rounded-2xl"
            style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background:"rgba(108,99,255,0.12)" }}>
              <GitCompare className="w-5 h-5" style={{ color:"var(--accent-2)" }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>Compare to Pro Athlete</p>
              <p className="text-xs mt-0.5" style={{ color:"var(--text-tertiary)" }}>See how your form stacks up</p>
            </div>
            <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ color:"var(--text-tertiary)" }} />
          </motion.div>
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
