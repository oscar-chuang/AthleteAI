"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Download, MoreHorizontal, Star, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Photo } from "@/lib/mockData";
import { cn } from "@/lib/utils";

function MasonryGrid({ photos }: { photos: Photo[] }) {
  const [columns, setColumns] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width < 600) setColumns(2);
      else if (width < 900) setColumns(3);
      else if (width < 1400) setColumns(4);
      else setColumns(5);
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const cols: Photo[][] = Array.from({ length: columns }, () => []);
  photos.forEach((photo, i) => cols[i % columns].push(photo));

  return (
    <div ref={containerRef} className="flex gap-2 w-full">
      {cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-2 flex-1 min-w-0">
          {col.map((photo, pi) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              index={ci * col.length + pi}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PhotoCard({ photo, index }: { photo: Photo; index: number }) {
  const { selectedPhoto, setSelectedPhoto, toggleFavorite } = useAppStore();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedPhoto?.id === photo.id;

  const aspectRatio = photo.height / photo.width;
  const paddingBottom = `${Math.min(Math.max(aspectRatio * 100, 50), 150)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.8) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setSelectedPhoto(isSelected ? null : photo)}
      className="relative rounded-xl overflow-hidden cursor-pointer group"
      style={{
        outline: isSelected ? "2px solid #7c6af7" : "none",
        outlineOffset: "2px",
        boxShadow: isSelected
          ? "0 0 0 3px rgba(124,106,247,0.3)"
          : hovered
          ? "0 8px 32px rgba(0,0,0,0.5)"
          : "0 2px 8px rgba(0,0,0,0.3)",
        transition: "box-shadow 0.2s, transform 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Image container with aspect ratio */}
      <div className="relative w-full" style={{ paddingBottom }}>
        {/* Shimmer placeholder */}
        {!imgLoaded && (
          <div className="absolute inset-0 shimmer rounded-xl" />
        )}

        <img
          src={photo.thumbnail}
          alt={photo.aiData.caption}
          onLoad={() => setImgLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
          loading="lazy"
        />

        {/* Hover overlay */}
        <motion.div
          animate={{ opacity: hovered || isSelected ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
          }}
        />

        {/* Confidence badge */}
        {photo.confidenceScore !== undefined && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
            style={{
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              color: photo.confidenceScore > 80 ? "#34d399" : photo.confidenceScore > 60 ? "#fbbf24" : "#f87171",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Sparkles className="w-3 h-3" />
            {photo.confidenceScore}%
          </motion.div>
        )}

        {/* Favorite indicator */}
        {photo.isFavorite && (
          <div className="absolute top-2 right-2">
            <Heart className="w-4 h-4 fill-current" style={{ color: "#f87171" }} />
          </div>
        )}

        {/* Bottom actions on hover */}
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 4 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-2 left-2 right-2 flex items-center justify-between"
        >
          <div className="text-xs text-white/80 truncate max-w-[60%]">
            {photo.aiData.caption}
          </div>
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(photo.id);
              }}
              className="p-1.5 rounded-lg"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
            >
              <Heart
                className={cn("w-3.5 h-3.5", photo.isFavorite ? "fill-current" : "")}
                style={{ color: photo.isFavorite ? "#f87171" : "white" }}
              />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-white" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function PhotoGrid() {
  const { filteredPhotos, isSearching, searchQuery, aiResponse, activeSection } = useAppStore();

  const sectionTitles: Record<string, string> = {
    "all-photos": "All Photos",
    favorites: "Favorites",
    people: "People",
    places: "Places",
    trash: "Trash",
    search: `Results for "${searchQuery}"`,
  };

  const title = sectionTitles[activeSection] || activeSection;

  if (isSearching) {
    return <LoadingState query={searchQuery} />;
  }

  if (filteredPhotos.length === 0) {
    return <EmptyState query={searchQuery} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-semibold text-white"
          >
            {title}
          </motion.h1>
          <div className="text-sm mt-0.5" style={{ color: "#55556a" }}>
            {filteredPhotos.length} photos
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#8888aa",
            }}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="quality">Best Quality</option>
          </select>
        </div>
      </div>

      {/* AI Response */}
      <AnimatePresence>
        {aiResponse && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3 shrink-0"
            style={{
              background: "rgba(124,106,247,0.08)",
              border: "1px solid rgba(124,106,247,0.2)",
            }}
          >
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#a78bfa" }} />
            <p className="text-sm" style={{ color: "#c4b5fd" }}>
              {aiResponse}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        <MasonryGrid photos={filteredPhotos} />
      </div>
    </div>
  );
}

function LoadingState({ query }: { query: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="h-6 w-48 rounded-lg shimmer mb-2" />
        <div className="h-4 w-24 rounded-lg shimmer" />
      </div>
      <div className="flex gap-2">
        {[...Array(4)].map((_, ci) => (
          <div key={ci} className="flex flex-col gap-2 flex-1">
            {[...Array(4)].map((_, ri) => (
              <div
                key={ri}
                className="rounded-xl shimmer"
                style={{ paddingBottom: `${60 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-3"
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(124,106,247,0.15)", border: "1px solid rgba(124,106,247,0.3)" }}
          >
            <Sparkles className="w-6 h-6" style={{ color: "#a78bfa" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#a78bfa" }}>
            AI is searching...
          </p>
          <p className="text-xs" style={{ color: "#55556a" }}>
            Analyzing &quot;{query}&quot;
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 text-center max-w-sm"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Sparkles className="w-8 h-8" style={{ color: "#55556a" }} />
        </div>
        <div>
          <p className="text-lg font-medium text-white mb-1">No photos found</p>
          <p className="text-sm" style={{ color: "#55556a" }}>
            {query
              ? `No results for "${query}". Try a different description.`
              : "Your library is empty. Upload some photos to get started."}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
