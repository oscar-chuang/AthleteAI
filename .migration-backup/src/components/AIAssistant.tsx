"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles, User, Bot } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  results?: number;
  timestamp: Date;
}

const AI_RESPONSES: Record<string, { text: string; results: number }> = {
  default: {
    text: "I've searched your photo library and found some matches. Results are ranked by confidence — the top photos are most likely what you're looking for.",
    results: 8,
  },
  beach: {
    text: "I found 14 beach photos in your library. Your most recent beach visit appears to be from Malibu last summer, and there are some stunning sunset shots from San Francisco.",
    results: 14,
  },
  wedding: {
    text: "I found 6 wedding photos. They appear to be from different events — a spring wedding with white flowers and a fall ceremony with golden decorations.",
    results: 6,
  },
  dog: {
    text: "Great news! I found 9 photos featuring your dog. Most are from the park, and there's a lovely series from the beach where they're playing fetch.",
    results: 9,
  },
  italy: {
    text: "I found 11 photos from Italy. They seem to span multiple trips — Rome's cobblestone streets, the Amalfi Coast, and what looks like a Tuscan vineyard.",
    results: 11,
  },
};

function getAIResponse(query: string): { text: string; results: number } {
  const q = query.toLowerCase();
  for (const key of Object.keys(AI_RESPONSES)) {
    if (key !== "default" && q.includes(key)) return AI_RESPONSES[key];
  }
  return AI_RESPONSES.default;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content: "Hi! I'm your Lens AI assistant. Describe any photo in natural language and I'll find it for you. Try: \"Find the photo of me at a wedding\" or \"Show my sunset photos from last year.\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { performSearch } = useAppStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((m) => [...m, userMessage]);
    setInput("");
    setIsTyping(true);

    performSearch(input);

    setTimeout(() => {
      const response = getAIResponse(input);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.text,
        results: response.results,
        timestamp: new Date(),
      };
      setMessages((m) => [...m, aiMessage]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <>
      {/* FAB */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ y: isOpen ? 80 : 0, opacity: isOpen ? 0 : 1 }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center z-40 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
          boxShadow: "0 8px 32px rgba(124,106,247,0.4)",
        }}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 w-96 rounded-3xl overflow-hidden z-50 flex flex-col"
            style={{
              height: "520px",
              background: "rgba(12,12,18,0.98)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
              backdropFilter: "blur(40px)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
                  boxShadow: "0 0 16px rgba(124,106,247,0.4)",
                }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Lens AI</p>
                <p className="text-xs" style={{ color: "#55556a" }}>Photo search assistant</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(false)}
                className="ml-auto p-2 rounded-xl hover:bg-white/5 transition-colors"
                style={{ color: "#55556a" }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center"
                    style={{
                      background:
                        msg.role === "ai"
                          ? "linear-gradient(135deg, #7c6af7, #a78bfa)"
                          : "rgba(255,255,255,0.08)",
                    }}
                  >
                    {msg.role === "ai" ? (
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <User className="w-3.5 h-3.5" style={{ color: "#8888aa" }} />
                    )}
                  </div>

                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"
                    }`}
                    style={
                      msg.role === "user"
                        ? {
                            background: "rgba(124,106,247,0.2)",
                            border: "1px solid rgba(124,106,247,0.3)",
                            color: "#e2d9f3",
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            color: "#8888aa",
                          }
                    }
                  >
                    {msg.content}
                    {msg.results && (
                      <div
                        className="mt-2 px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1"
                        style={{
                          background: "rgba(124,106,247,0.15)",
                          color: "#a78bfa",
                          border: "1px solid rgba(124,106,247,0.2)",
                        }}
                      >
                        <Sparkles className="w-3 h-3" />
                        {msg.results} photos found
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-2.5"
                  >
                    <div
                      className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #7c6af7, #a78bfa)" }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div
                      className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "#55556a" }}
                          animate={{ y: [0, -4, 0] }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="px-4 py-4 shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Describe a photo to find it..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "white", caretColor: "#a78bfa" }}
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-1.5 rounded-xl transition-all"
                  style={{
                    background: input.trim() ? "rgba(124,106,247,0.8)" : "transparent",
                    color: input.trim() ? "white" : "#55556a",
                  }}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
