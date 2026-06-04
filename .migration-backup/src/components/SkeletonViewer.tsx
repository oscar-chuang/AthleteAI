"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface SkeletonViewerProps {
  sport?: string;
  highlightJoints?: string[];
  className?: string;
  animated?: boolean;
  variant?: "deadlift" | "basketball" | "sprint" | "golf";
}

const POSES: Record<string, { keypoints: [number, number][]; label?: string }> = {
  deadlift: {
    keypoints: [
      [200, 60],   // 0 nose
      [194, 52],   // 1 left_eye
      [206, 52],   // 2 right_eye
      [185, 58],   // 3 left_ear
      [215, 58],   // 4 right_ear
      [175, 110],  // 5 left_shoulder
      [225, 110],  // 6 right_shoulder
      [162, 160],  // 7 left_elbow
      [238, 160],  // 8 right_elbow
      [150, 210],  // 9 left_wrist
      [250, 210],  // 10 right_wrist
      [180, 210],  // 11 left_hip
      [220, 210],  // 12 right_hip
      [178, 280],  // 13 left_knee
      [222, 280],  // 14 right_knee
      [175, 350],  // 15 left_ankle
      [225, 350],  // 16 right_ankle
    ],
  },
  basketball: {
    keypoints: [
      [200, 50],   // 0 nose
      [194, 43],   // 1 left_eye
      [206, 43],   // 2 right_eye
      [185, 48],   // 3 left_ear
      [215, 48],   // 4 right_ear
      [168, 110],  // 5 left_shoulder
      [232, 110],  // 6 right_shoulder
      [155, 165],  // 7 left_elbow
      [240, 145],  // 8 right_elbow — raised for shot
      [160, 215],  // 9 left_wrist
      [248, 105],  // 10 right_wrist — at release height
      [175, 210],  // 11 left_hip
      [225, 210],  // 12 right_hip
      [170, 285],  // 13 left_knee
      [230, 275],  // 14 right_knee — bent for jump
      [168, 355],  // 15 left_ankle
      [232, 350],  // 16 right_ankle
    ],
  },
  sprint: {
    keypoints: [
      [200, 55],   // 0 nose
      [194, 48],   // 1 left_eye
      [206, 48],   // 2 right_eye
      [185, 53],   // 3 left_ear
      [215, 53],   // 4 right_ear
      [180, 105],  // 5 left_shoulder
      [220, 100],  // 6 right_shoulder — forward
      [155, 150],  // 7 left_elbow — pumping back
      [240, 130],  // 8 right_elbow — pumping forward
      [145, 175],  // 9 left_wrist
      [250, 105],  // 10 right_wrist
      [185, 200],  // 11 left_hip
      [215, 198],  // 12 right_hip
      [200, 270],  // 13 left_knee — high drive
      [205, 285],  // 14 right_knee — push off
      [200, 340],  // 15 left_ankle
      [218, 355],  // 16 right_ankle
    ],
  },
  golf: {
    keypoints: [
      [200, 55],   // 0 nose
      [193, 48],   // 1 left_eye
      [207, 48],   // 2 right_eye
      [185, 53],   // 3 left_ear
      [215, 53],   // 4 right_ear
      [165, 115],  // 5 left_shoulder
      [235, 110],  // 6 right_shoulder
      [145, 170],  // 7 left_elbow
      [250, 155],  // 8 right_elbow — backswing
      [128, 210],  // 9 left_wrist — club head
      [258, 135],  // 10 right_wrist
      [180, 220],  // 11 left_hip
      [218, 218],  // 12 right_hip
      [175, 295],  // 13 left_knee
      [225, 290],  // 14 right_knee
      [170, 365],  // 15 left_ankle
      [230, 362],  // 16 right_ankle
    ],
  },
};

const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4], // head
  [5, 6],                            // shoulders
  [5, 7], [7, 9],                   // left arm
  [6, 8], [8, 10],                  // right arm
  [5, 11], [6, 12],                 // torso
  [11, 12],                          // hips
  [11, 13], [13, 15],               // left leg
  [12, 14], [14, 16],               // right leg
  [0, 5], [0, 6],                   // neck to shoulders (simplified)
];

const HIGHLIGHT_CONNECTIONS: Record<string, number[][]> = {
  "Lumbar Spine": [[5, 11], [6, 12], [11, 12]],
  "Left Knee": [[11, 13], [13, 15]],
  "Right Knee": [[12, 14], [14, 16]],
  "Left Hip Flexor": [[11, 13]],
  "Lead Elbow": [[5, 7], [7, 9]],
};

export function SkeletonViewer({
  sport = "deadlift",
  highlightJoints = [],
  className = "",
  animated = false,
  variant,
}: SkeletonViewerProps) {
  const [scanY, setScanY] = useState(0);
  const poseKey = variant || (sport as keyof typeof POSES) || "deadlift";
  const pose = POSES[poseKey] || POSES.deadlift;
  const kp = pose.keypoints;

  useEffect(() => {
    if (!animated) return;
    let start: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = ((ts - start) % 2000) / 2000;
      setScanY(progress * 400);
      requestAnimationFrame(animate);
    };
    const raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [animated]);

  const highlightedConnections = new Set<string>();
  highlightJoints.forEach((joint) => {
    const conns = HIGHLIGHT_CONNECTIONS[joint];
    if (conns) conns.forEach((c) => highlightedConnections.add(c.join("-")));
  });

  const highlightedJoints = new Set<number>();
  highlightJoints.forEach((joint) => {
    const conns = HIGHLIGHT_CONNECTIONS[joint];
    if (conns) conns.forEach(([a, b]) => { highlightedJoints.add(a); highlightedJoints.add(b); });
  });

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Grid background */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.06 }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Scan line */}
      {animated && (
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{
            top: scanY,
            background: "linear-gradient(90deg, transparent, #38bdf8, transparent)",
            opacity: 0.6,
            boxShadow: "0 0 8px #38bdf8",
          }}
        />
      )}

      {/* Skeleton SVG */}
      <svg viewBox="0 0 400 420" className="w-full h-full" style={{ minHeight: 300 }}>
        {/* Connections */}
        {SKELETON_CONNECTIONS.map(([a, b], i) => {
          const key = `${a}-${b}`;
          const isHighlighted = highlightedConnections.has(key) || highlightedConnections.has(`${b}-${a}`);
          return (
            <line
              key={i}
              x1={kp[a][0]}
              y1={kp[a][1]}
              x2={kp[b][0]}
              y2={kp[b][1]}
              stroke={isHighlighted ? "#ef4444" : "#38bdf8"}
              strokeWidth={isHighlighted ? 3 : 2}
              strokeLinecap="round"
              opacity={isHighlighted ? 1 : 0.7}
              style={isHighlighted ? { filter: "drop-shadow(0 0 4px #ef4444)" } : {}}
            />
          );
        })}

        {/* Joint dots */}
        {kp.map(([x, y], i) => {
          const isHighlighted = highlightedJoints.has(i);
          return (
            <g key={i}>
              {isHighlighted && (
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill="#ef444420"
                  stroke="#ef444440"
                  strokeWidth={1}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={isHighlighted ? 5 : 4}
                fill={isHighlighted ? "#ef4444" : "#0ea5e9"}
                stroke={isHighlighted ? "#fca5a5" : "#38bdf8"}
                strokeWidth={1.5}
                style={{
                  filter: isHighlighted
                    ? "drop-shadow(0 0 5px #ef4444)"
                    : "drop-shadow(0 0 3px #0ea5e9)",
                }}
              />
            </g>
          );
        })}

        {/* Angle indicators (simplified) */}
        {variant === "deadlift" && (
          <g opacity={0.8}>
            <text x={235} y={220} fontSize={10} fill="#eab308" fontFamily="system-ui">
              18° ⚠
            </text>
          </g>
        )}
      </svg>

      {/* Sport label */}
      <div
        className="absolute bottom-3 left-3 px-2 py-1 rounded-lg text-xs font-medium"
        style={{ background: "rgba(14,165,233,0.15)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.3)" }}
      >
        {sport.charAt(0).toUpperCase() + sport.slice(1)}
      </div>
    </div>
  );
}
