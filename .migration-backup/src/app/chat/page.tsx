"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Zap, Video, RotateCcw } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MOCK_CHAT } from "@/lib/athleteData";
import type { ChatMessage } from "@/lib/types";

const SUGGESTED = [
  "Why is my lower back tight?",
  "What should I work on this week?",
  "How do I improve my jump shot?",
  "What injury risks should I watch?",
];

const AI_REPLY = `Based on your recent analyses, here's your focus for this week:

**Priority 1 — Lumbar Bracing**
Your lumbar flexion hit 18° in your last heavy session. Before each lift:
• McGill Big 3 × 10 min
• Brace-breath drills with belt

**Priority 2 — Jump Shot Alignment**
Your jump still drifts ~8° left. 3 × 20 shots using alignment tape daily.

**Priority 3 — Ankle Mobility**
2 min wall stretch each side, twice per day before training.

Want me to build a full weekly plan around these?`;

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`, role: "user", content, timestamp: new Date().toISOString(),
    }]);
    setLoading(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: "assistant", content: AI_REPLY, timestamp: new Date().toISOString(),
      }]);
      setLoading(false);
    }, 1800);
  };

  return (
    <div className="flex flex-col" style={{ height: "100svh", background: "var(--bg)" }}>

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-4"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", boxShadow: "0 0 14px rgba(6,182,212,0.3)" }}>
          <Zap style={{ width: 17, height: 17, color: "white" }} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>AI Performance Coach</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ animation: "pulse 2s infinite" }} />
            <span className="text-xs" style={{ color: "#10b981" }}>Online · analyzing your data</span>
          </div>
        </div>
        <button onClick={() => setMessages(MOCK_CHAT.slice(0, 1))}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <RotateCcw className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ paddingBottom: 16 }}>
        {messages.map((msg, i) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.15) }}
            className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-xl shrink-0 mt-0.5 flex items-center justify-center"
              style={msg.role === "assistant"
                ? { background: "linear-gradient(135deg,#06b6d4,#8b5cf6)" }
                : { background: "linear-gradient(135deg,#06b6d4,#0891b2)", fontSize: 11, fontWeight: 700, color: "#fff" }}>
              {msg.role === "assistant"
                ? <Zap style={{ width: 13, height: 13, color: "white" }} />
                : "AR"}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: "80%" }}>
              {msg.referencedAnalysis && (
                <div className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-1 rounded-lg text-xs"
                  style={{ background: "rgba(6,182,212,0.08)", color: "#22d3ee" }}>
                  <Video className="w-3 h-3" /> Referencing analysis
                </div>
              )}
              <div className="px-4 py-3 rounded-2xl"
                style={msg.role === "user"
                  ? { background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.18)", borderTopRightRadius: 6 }
                  : { background: "var(--surface)", border: "1px solid var(--border)", borderTopLeftRadius: 6 }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
                      .replace(/^• /gm, '<span style="color:var(--accent)">• </span>'),
                  }} />
              </div>
              <p className="text-xs mt-1 px-1" style={{ color: "var(--text-tertiary)" }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Typing dots */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex gap-2.5">
              <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)" }}>
                <Zap style={{ width: 13, height: 13, color: "white" }} />
              </div>
              <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTopLeftRadius: 6 }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#06b6d4" }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* ── Suggested questions ── */}
      {messages.length < 4 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {SUGGESTED.map(q => (
              <button key={q} onClick={() => send(q)}
                className="shrink-0 text-xs px-3 py-2 rounded-full"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="shrink-0 px-4 py-3"
        style={{
          borderTop: "1px solid var(--border)",
          paddingBottom: `calc(80px + env(safe-area-inset-bottom, 0px))`,
        }}>
        <div className="flex items-end gap-2.5 px-4 py-2.5 rounded-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask your coach anything…" rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
            style={{ color: "var(--text-primary)", maxHeight: 100 }} />
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => send()} disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 btn-primary disabled:opacity-30">
            <Send className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
