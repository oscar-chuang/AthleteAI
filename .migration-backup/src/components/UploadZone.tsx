"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, CheckCircle, Sparkles } from "lucide-react";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setIsUploading(true);
    setProgress(0);

    // Simulate upload & indexing
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadComplete(true);
          setTimeout(() => setUploadComplete(false), 3000);
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 200);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(20px)" }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-4 p-12 rounded-3xl"
            style={{
              background: "rgba(124,106,247,0.1)",
              border: "2px dashed rgba(124,106,247,0.5)",
            }}
          >
            <motion.div
              animate={{ y: [-8, 0, -8] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Upload className="w-12 h-12" style={{ color: "#a78bfa" }} />
            </motion.div>
            <p className="text-xl font-semibold text-white">Drop photos to upload</p>
            <p className="text-sm" style={{ color: "#8888aa" }}>
              AI will automatically index and tag your photos
            </p>
          </motion.div>
        </motion.div>
      )}

      {isUploading && (
        <motion.div
          key="uploading"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 px-5 py-4 rounded-2xl z-40 min-w-64"
          style={{
            background: "rgba(14,14,20,0.95)",
            border: "1px solid rgba(124,106,247,0.3)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(124,106,247,0.15)" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Indexing photos</p>
              <p className="text-xs" style={{ color: "#55556a" }}>AI analyzing content...</p>
            </div>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #7c6af7, #a78bfa)",
              }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs mt-1.5 text-right" style={{ color: "#55556a" }}>
            {Math.round(progress)}%
          </p>
        </motion.div>
      )}

      {uploadComplete && (
        <motion.div
          key="complete"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 px-5 py-4 rounded-2xl z-40 flex items-center gap-3"
          style={{
            background: "rgba(14,14,20,0.95)",
            border: "1px solid rgba(52,211,153,0.3)",
            backdropFilter: "blur(20px)",
          }}
        >
          <CheckCircle className="w-5 h-5" style={{ color: "#34d399" }} />
          <p className="text-sm font-medium text-white">Photos indexed successfully</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
