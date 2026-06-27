"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Video, TrendingUp, User } from "lucide-react";

const TABS = [
  { href: "/dashboard",        icon: Home,       label: "Home"     },
  { href: "/analysis/an-001",  icon: Video,      label: "Analyze"  },
  { href: "/progress",         icon: TrendingUp, label: "Progress" },
  { href: "/compare",          icon: User,       label: "Profile"  },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith("/" + href.split("/")[1] + "/");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(10,10,15,0.96)",
        backdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
      <div className="flex items-center justify-around px-4 py-2.5">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex-1">
              <div className="flex flex-col items-center gap-1.5 py-1 relative">
                {active && (
                  <motion.div layoutId="nav-pill"
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                <tab.icon className="w-5 h-5 transition-all duration-200"
                  style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }} />
                <span className="text-xs font-medium transition-all duration-200"
                  style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
