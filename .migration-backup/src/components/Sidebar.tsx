"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Image, BookOpen, Users, MapPin, Heart,
  Clock, Trash2, Settings, Sparkles, ChevronRight,
  Plus, Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const NAV_ITEMS = [
  { id: "all-photos", label: "All Photos", icon: Image },
  { id: "albums", label: "Albums", icon: BookOpen },
  { id: "people", label: "People", icon: Users },
  { id: "places", label: "Places", icon: MapPin },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const SMART_COLLECTIONS = [
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "nature", label: "Nature", emoji: "🌿" },
  { id: "food", label: "Food", emoji: "🍽️" },
  { id: "events", label: "Events", emoji: "🎉" },
];

export function Sidebar() {
  const { activeSection, setActiveSection, recentSearches, performSearch } = useAppStore();

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="w-64 h-full flex flex-col gap-1 py-4 px-3 shrink-0"
      style={{
        background: "rgba(10, 10, 15, 0.95)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-3 mb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
            boxShadow: "0 0 20px rgba(124,106,247,0.4)",
          }}
        >
          <Camera className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white tracking-tight text-lg">Lens</span>
        <div
          className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: "rgba(124,106,247,0.15)",
            color: "#a78bfa",
            border: "1px solid rgba(124,106,247,0.3)",
          }}
        >
          AI
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left w-full group relative",
                isActive
                  ? "text-white"
                  : "text-[#8888aa] hover:text-white"
              )}
              style={
                isActive
                  ? {
                      background: "rgba(124,106,247,0.15)",
                      border: "1px solid rgba(124,106,247,0.2)",
                    }
                  : {}
              }
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: "rgba(124,106,247,0.12)",
                    border: "1px solid rgba(124,106,247,0.2)",
                  }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon
                className={cn(
                  "w-4 h-4 relative z-10 transition-colors",
                  isActive ? "text-[#a78bfa]" : "text-[#55556a] group-hover:text-[#8888aa]"
                )}
              />
              <span className="relative z-10">{item.label}</span>
              {item.id === "favorites" && (
                <span
                  className="ml-auto text-xs px-1.5 py-0.5 rounded-md relative z-10"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#8888aa" }}
                >
                  12
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-px mx-3 my-2" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* Smart Collections */}
      <div className="px-3 mb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#55556a" }}>
            Collections
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-4 h-4 flex items-center justify-center rounded"
            style={{ color: "#55556a" }}
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        </div>
        <div className="flex flex-col gap-0.5">
          {SMART_COLLECTIONS.map((col) => (
            <motion.button
              key={col.id}
              onClick={() => setActiveSection(col.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all text-left w-full",
                activeSection === col.id
                  ? "text-white"
                  : "text-[#8888aa] hover:text-white"
              )}
            >
              <span className="text-base">{col.emoji}</span>
              <span>{col.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mx-3 my-2" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* Recent Searches */}
      <div className="px-3 flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3 h-3" style={{ color: "#55556a" }} />
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#55556a" }}>
            Recent
          </span>
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto max-h-40">
          {recentSearches.map((search, i) => (
            <motion.button
              key={i}
              onClick={() => performSearch(search)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left w-full group transition-colors"
              style={{ color: "#55556a" }}
            >
              <Search className="w-3 h-3 shrink-0 opacity-60" />
              <span className="truncate group-hover:text-[#8888aa] transition-colors">{search}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="px-3 mt-auto pt-2">
        <div className="h-px mb-3" style={{ background: "rgba(255,255,255,0.05)" }} />
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-colors"
          style={{ color: "#55556a" }}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </motion.button>

        {/* AI Badge */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="mt-3 px-3 py-3 rounded-xl flex items-center gap-3 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, rgba(124,106,247,0.1), rgba(167,139,250,0.05))",
            border: "1px solid rgba(124,106,247,0.2)",
          }}
        >
          <div className="float">
            <Sparkles className="w-4 h-4" style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <div className="text-xs font-medium text-white">AI Ready</div>
            <div className="text-xs" style={{ color: "#8888aa" }}>80 photos indexed</div>
          </div>
          <ChevronRight className="w-3 h-3 ml-auto" style={{ color: "#55556a" }} />
        </motion.div>
      </div>
    </motion.aside>
  );
}
