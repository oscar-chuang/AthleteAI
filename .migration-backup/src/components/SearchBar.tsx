"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Sparkles, Clock, TrendingUp, Zap, Mic } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { SEARCH_SUGGESTIONS } from "@/lib/mockData";

const PLACEHOLDER_TEXTS = [
  "Find photos of me at the beach...",
  "Show my best landscape shots...",
  "Photos from Italy with sunglasses...",
  "Find the red sports car at night...",
  "Show birthday celebrations...",
  "Photos with my dog at the park...",
];

export function SearchBar() {
  const { searchQuery, setSearchQuery, performSearch, clearSearch, isSearching } = useAppStore();
  const [focused, setFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [inputValue, setInputValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused && !inputValue) {
      const timer = setInterval(() => {
        setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_TEXTS.length);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [focused, inputValue]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      performSearch(inputValue.trim());
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setInputValue("");
    clearSearch();
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (text: string) => {
    setInputValue(text);
    performSearch(text);
    setFocused(false);
  };

  const recentSearches = SEARCH_SUGGESTIONS.filter((s) => s.type === "recent");
  const trending = SEARCH_SUGGESTIONS.filter((s) => s.type === "trending");
  const aiSuggestions = SEARCH_SUGGESTIONS.filter((s) => s.type === "ai");

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit}>
        <motion.div
          animate={{
            boxShadow: focused
              ? "0 0 0 2px rgba(124,106,247,0.5), 0 20px 60px rgba(0,0,0,0.5)"
              : "0 4px 24px rgba(0,0,0,0.3)",
          }}
          transition={{ duration: 0.2 }}
          className="relative flex items-center rounded-2xl overflow-hidden"
          style={{
            background: focused ? "rgba(20,20,30,0.95)" : "rgba(17,17,24,0.8)",
            border: `1px solid ${focused ? "rgba(124,106,247,0.4)" : "rgba(255,255,255,0.07)"}`,
          }}
        >
          {/* Search icon / loading */}
          <div className="pl-5 pr-3 shrink-0">
            <AnimatePresence mode="wait">
              {isSearching ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0 }}
                  className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#7c6af7", borderTopColor: "transparent" }}
                />
              ) : (
                <motion.div
                  key="search"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {focused ? (
                    <Sparkles className="w-5 h-5" style={{ color: "#a78bfa" }} />
                  ) : (
                    <Search className="w-5 h-5" style={{ color: "#55556a" }} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="flex-1 relative">
            {!inputValue && !focused && (
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholderIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center text-sm pointer-events-none"
                  style={{ color: "#55556a" }}
                >
                  {PLACEHOLDER_TEXTS[placeholderIdx]}
                </motion.span>
              </AnimatePresence>
            )}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => e.key === "Escape" && (handleClear(), setFocused(false))}
              className="w-full bg-transparent py-4 text-sm outline-none text-white"
              style={{ caretColor: "#a78bfa" }}
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 pr-3">
            <AnimatePresence>
              {inputValue && (
                <motion.button
                  key="clear"
                  type="button"
                  onClick={handleClear}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: "#55556a" }}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "#55556a" }}
            >
              <Mic className="w-4 h-4" />
            </motion.button>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="ml-1 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
              style={{
                background: inputValue
                  ? "linear-gradient(135deg, #7c6af7, #a78bfa)"
                  : "rgba(255,255,255,0.06)",
                color: inputValue ? "white" : "#55556a",
              }}
            >
              Search
            </motion.button>
          </div>
        </motion.div>
      </form>

      {/* Dropdown suggestions */}
      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden z-50"
            style={{
              background: "rgba(14, 14, 20, 0.98)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              backdropFilter: "blur(40px)",
            }}
          >
            <div className="p-3 flex flex-col gap-4">
              {/* Recent */}
              <section>
                <div className="flex items-center gap-2 px-2 mb-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "#55556a" }} />
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#55556a" }}>
                    Recent Searches
                  </span>
                </div>
                {recentSearches.map((s, i) => (
                  <SuggestionItem key={i} text={s.text} onClick={() => handleSuggestionClick(s.text)} />
                ))}
              </section>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

              {/* Trending */}
              <section>
                <div className="flex items-center gap-2 px-2 mb-1.5">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: "#55556a" }} />
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#55556a" }}>
                    Trending
                  </span>
                </div>
                {trending.map((s, i) => (
                  <SuggestionItem key={i} text={s.text} onClick={() => handleSuggestionClick(s.text)} />
                ))}
              </section>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

              {/* AI */}
              <section>
                <div className="flex items-center gap-2 px-2 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                    AI Suggestions
                  </span>
                </div>
                {aiSuggestions.map((s, i) => (
                  <SuggestionItem key={i} text={s.text} onClick={() => handleSuggestionClick(s.text)} isAI />
                ))}
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuggestionItem({
  text,
  onClick,
  isAI,
}: {
  text: string;
  onClick: () => void;
  isAI?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      className="flex items-center gap-3 w-full px-2 py-2 rounded-xl text-sm text-left transition-colors group"
      style={{ color: "#8888aa" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {isAI ? (
        <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "#a78bfa" }} />
      ) : (
        <Search className="w-3.5 h-3.5 shrink-0 opacity-40" />
      )}
      <span className="group-hover:text-white transition-colors">{text}</span>
    </motion.button>
  );
}
