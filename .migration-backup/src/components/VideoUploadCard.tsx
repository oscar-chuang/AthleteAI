"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Video, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoUploadCardProps {
  onUpload?: (file: File) => void;
  label?: string;
  compact?: boolean;
}

export function VideoUploadCard({ onUpload, label = "Upload Video", compact = false }: VideoUploadCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setDone(true);
      onUpload?.(f);
    }, 2200);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) handleFile(f);
  };

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setUploading(false);
    setDone(false);
  };

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => !file && inputRef.current?.click()}
        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
        style={{
          background: done ? "rgba(34,197,94,0.1)" : dragOver ? "rgba(14,165,233,0.15)" : "rgba(14,165,233,0.08)",
          border: `1px solid ${done ? "rgba(34,197,94,0.3)" : "rgba(14,165,233,0.2)"}`,
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#0ea5e9" }} />
        ) : done ? (
          <Check className="w-4 h-4" style={{ color: "#22c55e" }} />
        ) : (
          <Upload className="w-4 h-4" style={{ color: "#0ea5e9" }} />
        )}
        <span className="text-sm font-medium" style={{ color: done ? "#22c55e" : "#0ea5e9" }}>
          {uploading ? "Analyzing…" : done ? file?.name.slice(0, 28) + "…" : label}
        </span>
        {done && (
          <button onClick={reset} className="ml-auto">
            <X className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <div
      onClick={() => !file && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all",
        !file && "hover:border-sky-500/40"
      )}
      style={{
        minHeight: 200,
        border: `2px dashed ${dragOver ? "rgba(14,165,233,0.6)" : file ? "rgba(14,165,233,0.3)" : "rgba(56,189,248,0.15)"}`,
        background: dragOver ? "rgba(14,165,233,0.05)" : "rgba(14,21,36,0.5)",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <AnimatePresence mode="wait">
        {!file && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-3 p-8 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}
            >
              <Video className="w-8 h-8" style={{ color: "#38bdf8" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
                Drop a video or click to browse
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                MP4, MOV, AVI up to 300MB (5 min)
              </p>
            </div>
          </motion.div>
        )}

        {file && uploading && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 p-8"
          >
            <div className="relative w-16 h-16">
              <div
                className="w-16 h-16 rounded-full"
                style={{ border: "3px solid rgba(14,165,233,0.2)" }}
              />
              <svg className="absolute inset-0 w-16 h-16 -rotate-90">
                <circle cx={32} cy={32} r={29} fill="none" stroke="#0ea5e9" strokeWidth={3} strokeLinecap="round"
                  strokeDasharray={182} strokeDashoffset={182 * 0.35}
                  style={{ transition: "stroke-dashoffset 2s linear" }}
                />
              </svg>
              <Loader2 className="absolute inset-0 m-auto w-7 h-7 animate-spin" style={{ color: "#0ea5e9" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Analyzing motion…</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Running pose estimation</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {["Detecting pose", "Measuring joints", "AI coaching"].map((s, i) => (
                <motion.span
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.4 }}
                  className="text-xs px-2 py-1 rounded-full"
                  style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.2)" }}
                >
                  {s}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {file && done && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 p-8 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <Check className="w-8 h-8" style={{ color: "#22c55e" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "#22c55e" }}>Analysis complete!</p>
              <p className="text-sm mt-1 max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>
                {file.name}
              </p>
            </div>
            <button
              onClick={reset}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}
            >
              Upload another
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
