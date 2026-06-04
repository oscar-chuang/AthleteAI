"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X, Heart, Trash2, Download, Share2, MapPin, Calendar,
  Tag, Eye, Sparkles, FileText, Users, Palette, Star,
  ChevronRight, Search, ZoomIn
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Photo } from "@/lib/mockData";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";
import { MOCK_PHOTOS } from "@/lib/mockData";

export function PhotoDetail() {
  const { selectedPhoto, isRightPanelOpen, setSelectedPhoto, setRightPanelOpen, toggleFavorite, moveToTrash, performSearch } = useAppStore();

  return (
    <AnimatePresence>
      {isRightPanelOpen && selectedPhoto && (
        <motion.aside
          key="detail"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-80 shrink-0 h-full flex flex-col overflow-hidden"
          style={{
            background: "rgba(10,10,15,0.98)",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="text-sm font-medium text-white">Details</span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setRightPanelOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: "#55556a" }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Photo Preview */}
            <div className="relative">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.aiData.caption}
                className="w-full object-cover"
                style={{ maxHeight: "280px", objectPosition: "center" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(10,10,15,0.6) 0%, transparent 60%)" }}
              />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-sm font-medium text-white leading-tight">
                  {selectedPhoto.aiData.caption}
                </p>
              </div>
              {/* Zoom button */}
              <button
                className="absolute top-3 right-3 p-2 rounded-xl"
                style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Action bar */}
            <div
              className="flex items-center justify-around px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {[
                {
                  icon: Heart,
                  label: "Favorite",
                  active: selectedPhoto.isFavorite,
                  onClick: () => toggleFavorite(selectedPhoto.id),
                  activeColor: "#f87171",
                },
                { icon: Download, label: "Save", onClick: () => {} },
                { icon: Share2, label: "Share", onClick: () => {} },
                {
                  icon: Trash2,
                  label: "Delete",
                  onClick: () => moveToTrash(selectedPhoto.id),
                  danger: true,
                },
              ].map(({ icon: Icon, label, active, onClick, activeColor, danger }) => (
                <motion.button
                  key={label}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClick}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="p-2 rounded-xl transition-colors"
                    style={{
                      background: active
                        ? "rgba(248,113,113,0.1)"
                        : danger
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Icon
                      className={cn("w-4 h-4", active ? "fill-current" : "")}
                      style={{
                        color: active ? activeColor : danger ? "#f87171" : "#8888aa",
                      }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: "#55556a" }}>{label}</span>
                </motion.button>
              ))}
            </div>

            <div className="px-4 py-4 flex flex-col gap-5">
              {/* AI Description */}
              <Section icon={Sparkles} title="AI Description" accentColor="#a78bfa">
                <p className="text-sm leading-relaxed" style={{ color: "#8888aa" }}>
                  {selectedPhoto.aiData.description}
                </p>
              </Section>

              {/* Metadata */}
              <Section icon={Calendar} title="Details">
                <div className="flex flex-col gap-2">
                  <MetaRow
                    icon={Calendar}
                    label="Date"
                    value={`${formatDate(selectedPhoto.dateTaken)} · ${formatRelativeTime(selectedPhoto.dateTaken)}`}
                  />
                  {selectedPhoto.location && (
                    <MetaRow icon={MapPin} label="Location" value={selectedPhoto.location} />
                  )}
                  <MetaRow icon={FileText} label="File" value={selectedPhoto.filename} />
                  <MetaRow
                    icon={Eye}
                    label="Size"
                    value={`${selectedPhoto.width} × ${selectedPhoto.height}`}
                  />
                  <MetaRow
                    icon={Star}
                    label="Quality"
                    value={`${selectedPhoto.aiData.qualityScore}/100`}
                    valueColor={
                      selectedPhoto.aiData.qualityScore > 85
                        ? "#34d399"
                        : selectedPhoto.aiData.qualityScore > 70
                        ? "#fbbf24"
                        : "#f87171"
                    }
                  />
                </div>
              </Section>

              {/* Objects */}
              <Section icon={Tag} title="Detected Objects">
                <div className="flex flex-wrap gap-1.5">
                  {selectedPhoto.aiData.objects.map((obj) => (
                    <motion.button
                      key={obj}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => performSearch(obj)}
                      className="px-2.5 py-1 rounded-lg text-xs transition-all hover:border-purple-500/40"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        color: "#8888aa",
                      }}
                    >
                      {obj}
                    </motion.button>
                  ))}
                </div>
              </Section>

              {/* People */}
              {selectedPhoto.aiData.people > 0 && (
                <Section icon={Users} title={`People (${selectedPhoto.aiData.people})`}>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPhoto.aiData.faceDescriptors.map((desc, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs"
                        style={{
                          background: "rgba(124,106,247,0.1)",
                          border: "1px solid rgba(124,106,247,0.2)",
                          color: "#a78bfa",
                        }}
                      >
                        {desc}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Colors */}
              <Section icon={Palette} title="Dominant Colors">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedPhoto.aiData.colors.map((color, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-md border border-white/10"
                        style={{ background: COLOR_MAP[color] || "#666" }}
                      />
                      <span className="text-xs capitalize" style={{ color: "#8888aa" }}>
                        {color}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* OCR Text */}
              {selectedPhoto.aiData.ocrText && (
                <Section icon={FileText} title="Text Detected">
                  <div
                    className="px-3 py-2.5 rounded-xl text-sm font-mono"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "#8888aa",
                    }}
                  >
                    {selectedPhoto.aiData.ocrText}
                  </div>
                </Section>
              )}

              {/* Mood + Scene */}
              <Section icon={Sparkles} title="Scene Analysis">
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-xs mb-1" style={{ color: "#55556a" }}>Scene</div>
                    <div className="text-sm font-medium capitalize text-white">
                      {selectedPhoto.aiData.scene}
                    </div>
                  </div>
                  <div
                    className="px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-xs mb-1" style={{ color: "#55556a" }}>Mood</div>
                    <div className="text-sm font-medium capitalize text-white">
                      {selectedPhoto.aiData.mood}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Similar Photos */}
              {selectedPhoto.similarPhotoIds.length > 0 && (
                <Section icon={Search} title="Similar Photos">
                  <div className="grid grid-cols-3 gap-1.5">
                    {selectedPhoto.similarPhotoIds.slice(0, 6).map((id) => {
                      const p = MOCK_PHOTOS.find((x) => x.id === id);
                      if (!p) return null;
                      return (
                        <motion.button
                          key={id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            useAppStore.getState().setSelectedPhoto(p)
                          }
                          className="relative rounded-lg overflow-hidden"
                          style={{ paddingBottom: "75%" }}
                        >
                          <img
                            src={p.thumbnail}
                            alt={p.aiData.caption}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        </motion.button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Suggested searches */}
              <Section icon={Search} title="Suggested Searches">
                <div className="flex flex-col gap-1">
                  {[
                    selectedPhoto.aiData.scene,
                    selectedPhoto.aiData.mood + " photos",
                    ...(selectedPhoto.location ? [selectedPhoto.location.split(",")[0]] : []),
                    selectedPhoto.aiData.objects[0],
                  ]
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((s) => (
                      <motion.button
                        key={s}
                        whileHover={{ x: 2 }}
                        onClick={() => s && performSearch(s)}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors group"
                        style={{ color: "#8888aa" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span className="group-hover:text-white transition-colors capitalize">{s}</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                </div>
              </Section>

              <div className="h-4" />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  accentColor,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon
          className="w-3.5 h-3.5"
          style={{ color: accentColor || "#55556a" }}
        />
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#55556a" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#55556a" }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs block" style={{ color: "#55556a" }}>
          {label}
        </span>
        <span
          className="text-sm truncate block"
          style={{ color: valueColor || "#8888aa" }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#a855f7",
  pink: "#ec4899",
  gold: "#f59e0b",
  white: "#f1f5f9",
  black: "#1e293b",
  grey: "#6b7280",
  gray: "#6b7280",
  brown: "#92400e",
  cyan: "#06b6d4",
  neon: "#a3e635",
  warm: "#fb923c",
  blush: "#fda4af",
  terracotta: "#c2410c",
  cream: "#fef3c7",
  silver: "#94a3b8",
  skin: "#fbbf24",
};
