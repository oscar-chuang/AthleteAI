"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Video,
  GitCompare,
  TrendingUp,
  MessageSquare,
  User,
  Zap,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Settings,
  Bell,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/analysis/an-001", icon: Video, label: "Analysis" },
  { href: "/compare", icon: GitCompare, label: "Compare" },
  { href: "/progress", icon: TrendingUp, label: "Progress" },
  { href: "/chat", icon: MessageSquare, label: "AI Coach" },
];

export function Nav() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.nav
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col shrink-0 h-screen overflow-hidden"
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #0ea5e9, #38bdf8)", boxShadow: "0 0 20px rgba(14,165,233,0.4)" }}
        >
          <Zap className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                AthleteAI
              </p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Performance Coach</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Athlete quick stats */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-3 mt-4 mb-2 rounded-xl p-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)", color: "white" }}
              >
                AR
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>Alex Rivera</p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Advanced · Pro Plan</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Flame className="w-3.5 h-3.5" style={{ color: "var(--energy)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--energy)" }}>14-day streak</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1 px-2 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn("nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer", active && "active")}
                style={active ? {} : { color: "var(--text-secondary)" }}
              >
                <item.icon className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="px-2 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <Link href="/profile">
          <div
            className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            <User style={{ width: 18, height: 18 }} className="shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium"
                >
                  Profile
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          style={{ color: "var(--text-tertiary)" }}
        >
          {collapsed ? (
            <ChevronRight style={{ width: 18, height: 18 }} className="shrink-0" />
          ) : (
            <>
              <ChevronLeft style={{ width: 18, height: 18 }} className="shrink-0" />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
              >
                Collapse
              </motion.span>
            </>
          )}
        </button>
      </div>
    </motion.nav>
  );
}
