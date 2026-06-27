"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { ReactNode } from "react";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  right?: ReactNode;
  transparent?: boolean;
}

export function TopBar({ title, showBack = false, right, transparent = false }: TopBarProps) {
  const router = useRouter();

  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14"
      style={
        transparent
          ? {}
          : {
              background: "rgba(6,10,16,0.88)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }
      }
    >
      {showBack && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => router.back()}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
        </motion.button>
      )}

      {title && (
        <h1 className="flex-1 font-bold text-base tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
      )}

      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
