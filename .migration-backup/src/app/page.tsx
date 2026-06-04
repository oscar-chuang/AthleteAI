"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronRight, Check, Star, Shield, TrendingUp, GitCompare, MessageSquare, Trophy, Video, ArrowRight } from "lucide-react";

const SPORTS = ["Fencing", "Weightlifting", "Basketball", "Golf", "Tennis", "Running", "Swimming", "Gymnastics"];

const FEATURES = [
  { icon: Video,         color: "#06b6d4", title: "AI Motion Analysis",       desc: "Frame-by-frame biomechanics with joint angles, velocity, and posture tracking." },
  { icon: MessageSquare, color: "#8b5cf6", title: "Personal Coach Feedback",  desc: "Plain-language coaching tips and specific drills — like having a $500/hr coach in your pocket." },
  { icon: Shield,        color: "#f97316", title: "Injury Prevention",        desc: "Detect dangerous movement patterns before they hurt you. Real injury risk scores." },
  { icon: GitCompare,    color: "#10b981", title: "Pro Athlete Comparison",   desc: "Upload Stephen Curry, Rory McIlroy, or any pro. Compare your mechanics side-by-side." },
  { icon: TrendingUp,    color: "#22d3ee", title: "Progress Tracking",        desc: "Watch your technique, power, and consistency scores climb week over week." },
  { icon: Trophy,        color: "#f59e0b", title: "Gamified Goals",           desc: "Skill scores, achievement badges, and weekly goals that actually keep you motivated." },
];

const TESTIMONIALS = [
  { name: "Marcus T.", sport: "Powerlifter", quote: "My deadlift went from 180kg to 220kg after fixing the hip mechanics AthleteAI flagged.", score: 94, initials: "MT", color: "#06b6d4" },
  { name: "Priya K.", sport: "Fencer",       quote: "I compared my lunge to Lee Kiefer's and the AI broke down every millisecond of timing difference.", score: 88, initials: "PK", color: "#8b5cf6" },
  { name: "James L.", sport: "Basketball",  quote: "Shooting percentage jumped 12% in one month following the jump alignment drills.", score: 91, initials: "JL", color: "#10b981" },
];

const PRICING = [
  {
    name: "Starter", price: "Free", period: "",
    features: ["3 analyses / month", "Basic coaching feedback", "Overall score", "7-day history"],
    cta: "Get Started Free", highlight: false,
  },
  {
    name: "Pro", price: "$24", period: "/mo",
    features: ["Unlimited analyses", "Full biomechanics breakdown", "Injury risk scores", "Pro comparisons", "AI Coach Chat", "Progress trends", "Drill library"],
    cta: "Start Free Trial", highlight: true,
  },
  {
    name: "Elite", price: "$79", period: "/mo",
    features: ["Everything in Pro", "Team accounts (20 athletes)", "Coach dashboard", "API access", "Custom programs", "Priority support"],
    cta: "Contact Sales", highlight: false,
  },
];

export default function LandingPage() {
  const [sportIdx, setSportIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSportIdx(i => (i + 1) % SPORTS.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-14"
        style={{ background: "rgba(6,10,16,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", boxShadow: "0 0 12px rgba(6,182,212,0.4)" }}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">AthleteAI</span>
        </div>
        <Link href="/dashboard">
          <button className="btn-primary text-xs font-bold px-4 py-2 rounded-xl">
            Get Started
          </button>
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-24 pb-16 text-center overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/4 left-1/4 w-56 h-56 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)" }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#06b6d4" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="relative z-10 w-full max-w-lg mx-auto">

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.28)", color: "#22d3ee" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            AI-Powered Sports Coaching
          </motion.div>

          <h1 className="text-5xl font-black tracking-tight leading-[1.05] mb-4">
            <span className="gradient-text-hero">Elite coaching.</span>
            <br />
            <span style={{ color: "var(--text-primary)" }}>For every </span>
            <span className="inline-block" style={{ minWidth: 180, verticalAlign: "bottom" }}>
              <AnimatePresence mode="wait">
                <motion.span key={SPORTS[sportIdx]}
                  initial={{ y: 36, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -36, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                  className="inline-block gradient-text-energy">
                  {SPORTS[sportIdx]}.
                </motion.span>
              </AnimatePresence>
            </span>
          </h1>

          <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
            Upload any training video. Get frame-by-frame biomechanics analysis, personalized coaching, injury prevention, and pro comparisons — in seconds.
          </p>

          <div className="flex flex-col gap-3 items-center">
            <Link href="/dashboard" className="w-full max-w-xs">
              <motion.button whileTap={{ scale: 0.97 }} className="btn-primary w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" />
                Analyze My Performance
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Free to start · No credit card required</p>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-10">
            {[{ v: "10K+", l: "Athletes" }, { v: "500K+", l: "Analyses" }, { v: "98%", l: "Accuracy" }].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-xl font-black gradient-text">{s.v}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mock app screenshot */}
        <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
          className="relative z-10 mt-12 w-full max-w-sm mx-auto rounded-3xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid rgba(6,182,212,0.14)", boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(6,182,212,0.08)" }}>
          <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: "var(--bg-2)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          </div>
          <div className="p-4">
            <div className="text-xs font-bold mb-3" style={{ color: "#22d3ee" }}>POSE ANALYSIS</div>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <svg viewBox="0 0 100 200" className="w-full opacity-90">
                  <g stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="50" y1="20" x2="50" y2="5"/>
                    <line x1="35" y1="50" x2="65" y2="50"/>
                    <line x1="35" y1="50" x2="25" y2="80"/><line x1="25" y1="80" x2="20" y2="105"/>
                    <line x1="65" y1="50" x2="75" y2="80"/><line x1="75" y1="80" x2="80" y2="105"/>
                    <line x1="35" y1="50" x2="40" y2="100"/><line x1="65" y1="50" x2="60" y2="100"/>
                    <line x1="40" y1="100" x2="60" y2="100"/>
                    <line x1="40" y1="100" x2="38" y2="150"/><line x1="60" y1="100" x2="62" y2="150"/>
                    <line x1="38" y1="150" x2="37" y2="190"/><line x1="62" y1="150" x2="63" y2="190"/>
                  </g>
                  {[[50,5],[35,50],[65,50],[25,80],[75,80],[20,105],[80,105],[40,100],[60,100],[38,150],[62,150],[37,190],[63,190]].map(([x,y],i) => (
                    <circle key={i} cx={x} cy={y} r={3} fill="#0d1828" stroke="#06b6d4" strokeWidth={1.5}
                      style={{ filter: "drop-shadow(0 0 3px #06b6d4)" }}/>
                  ))}
                  <circle cx={40} cy={100} r={8} fill="#f43f5e18" stroke="#f43f5e44"/>
                  <circle cx={40} cy={100} r={3.5} fill="#0d1828" stroke="#f43f5e" strokeWidth={2}
                    style={{ filter: "drop-shadow(0 0 4px #f43f5e)" }}/>
                  <circle cx={50} cy={5} r={8} fill="none" stroke="#06b6d4" strokeWidth={1.5}/>
                </svg>
              </div>
              <div className="col-span-3">
                <div className="text-xs font-bold mb-2" style={{ color: "#22d3ee" }}>SCORES</div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {[{ l: "Overall", v: 78, c: "#06b6d4" }, { l: "Tech", v: 72, c: "#8b5cf6" }, { l: "Power", v: 91, c: "#10b981" }].map(s => (
                    <div key={s.l} className="text-center">
                      <div className="text-xl font-black" style={{ color: s.c }}>{s.v}</div>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {[{ l: "Hip Ext.", v: 72, c: "#f59e0b" }, { l: "Bar Path", v: 94, c: "#10b981" }, { l: "Lumbar", v: 58, c: "#f43f5e" }].map(m => (
                  <div key={m.l} className="mb-1.5">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span style={{ color: "var(--text-secondary)" }}>{m.l}</span>
                      <span style={{ color: m.c }}>{m.v}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${m.v}%`, background: m.c }}/>
                    </div>
                  </div>
                ))}
                <div className="mt-2 p-2 rounded-lg" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
                  <p className="text-xs font-semibold" style={{ color: "#f43f5e" }}>⚠ Injury Risk: Lumbar</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Sports ── */}
      <div className="py-8 overflow-hidden" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-1">
          {["Fencing","Weightlifting","Basketball","Volleyball","Golf","Tennis","Baseball","Soccer","Swimming","Running","Gymnastics","CrossFit","Boxing","Cycling"].map(s => (
            <div key={s} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section className="px-5 py-16">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--accent)" }}>Features</div>
            <h2 className="text-3xl font-black tracking-tight">Everything a world-class coach sees.</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-4 p-4 rounded-2xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}28` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="px-5 py-16" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--accent)" }}>Athletes Love It</div>
            <h2 className="text-3xl font-black tracking-tight">Real results.</h2>
          </div>
          <div className="space-y-4">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-5 rounded-2xl"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div className="flex gap-0.5 mb-3">
                  {Array(5).fill(0).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400"/>)}
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}44` }}>
                    {t.initials}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{t.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{t.sport}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black" style={{ color: t.color }}>{t.score}</div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>score</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="px-5 py-16">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--accent)" }}>Pricing</div>
            <h2 className="text-3xl font-black tracking-tight">Invest in your performance.</h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>Less than one coaching session. Cancel anytime.</p>
          </div>
          <div className="space-y-4">
            {PRICING.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.08 }} className="relative p-5 rounded-2xl"
                style={{
                  background: p.highlight ? "linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.07))" : "var(--surface)",
                  border: p.highlight ? "1px solid rgba(6,182,212,0.35)" : "1px solid var(--border)",
                  boxShadow: p.highlight ? "0 0 40px rgba(6,182,212,0.12)" : "none",
                }}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
                    Most Popular
                  </div>
                )}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black" style={{ color: "var(--text-primary)" }}>{p.price}</span>
                  {p.period && <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{p.period}</span>}
                </div>
                <div className="text-sm font-bold mb-4" style={{ color: p.highlight ? "#22d3ee" : "var(--text-secondary)" }}>{p.name}</div>
                <ul className="space-y-2.5 mb-5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5">
                      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: p.highlight ? "#06b6d4" : "#10b981" }} />
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard">
                  <button className={`w-full py-3 rounded-xl font-bold text-sm ${p.highlight ? "btn-primary" : "btn-glass"}`}>
                    {p.cta}
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 py-16 text-center" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-sm mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-3">Ready to train like a pro?</h2>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>Upload your first video and get your analysis in under 60 seconds.</p>
          <Link href="/dashboard">
            <motion.button whileTap={{ scale: 0.97 }} className="btn-primary w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" /> Start Analyzing Free <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-5 py-8 text-center" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}>
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold text-sm">AthleteAI</span>
        </div>
        <div className="flex justify-center gap-6 text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
          {["Privacy", "Terms", "Contact", "Blog"].map(item => <a key={item} href="#">{item}</a>)}
        </div>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>© 2026 AthleteAI. All rights reserved.</p>
      </footer>
    </div>
  );
}
