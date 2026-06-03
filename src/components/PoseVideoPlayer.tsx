"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Layers, Video, Loader2, AlertCircle } from "lucide-react";

// MediaPipe Pose landmark indices
const CONNECTIONS: [number, number][] = [
  // Torso (white)
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm (cyan)
  [11, 13], [13, 15], [15, 17], [15, 19], [17, 19],
  // Right arm (purple)
  [12, 14], [14, 16], [16, 18], [16, 20], [18, 20],
  // Left leg (cyan)
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Right leg (purple)
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

const LEFT  = new Set([11,13,15,17,19,21,23,25,27,29,31]);
const RIGHT = new Set([12,14,16,18,20,22,24,26,28,30,32]);
const CORE  = new Set([0,7,8,9,10,11,12,23,24]);

const KEY_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export interface JointAngles {
  leftKnee:  number;
  rightKnee: number;
  leftHip:   number;
  rightHip:  number;
  leftElbow: number;
  rightElbow: number;
  spineAngle: number;
}

function angle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot   = ab.x * cb.x + ab.y * cb.y;
  const cross = Math.abs(ab.x * cb.y - ab.y * cb.x);
  return Math.round(Math.atan2(cross, dot) * (180 / Math.PI));
}

function connColor(a: number, b: number): string {
  if (LEFT.has(a)  && LEFT.has(b))  return "#06b6d4";
  if (RIGHT.has(a) && RIGHT.has(b)) return "#a78bfa";
  return "rgba(255,255,255,0.7)";
}

function jointColor(i: number): string {
  if (LEFT.has(i))  return "#22d3ee";
  if (RIGHT.has(i)) return "#a78bfa";
  return "#ffffff";
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  color: string
) {
  ctx.font = "bold 13px system-ui";
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = "rgba(6,10,16,0.75)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 11, w, 20, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

interface Props {
  videoFile: File | null;
  onAngles?: (a: JointAngles) => void;
}

export function PoseVideoPlayer({ videoFile, onAngles }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef   = useRef<any>(null);
  const rafRef    = useRef<number>(0);

  const [status, setStatus]       = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [playing, setPlaying]     = useState(false);
  const [showSkel, setShowSkel]   = useState(true);
  const [speed, setSpeed]         = useState(1);
  const [progress, setProgress]   = useState(0);
  const [duration, setDuration]   = useState(0);

  // ── Load video ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoFile || !videoRef.current) return;
    const url = URL.createObjectURL(videoFile);
    videoRef.current.src = url;
    videoRef.current.load();
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  // ── Load MediaPipe from CDN ───────────────────────────────────────────────
  useEffect(() => {
    if (!videoFile) return;
    let cancelled = false;

    const init = async () => {
      setStatus("loading");
      try {
        const base = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";
        await loadScript(`${base}/pose.js`);

        if (cancelled) return;

        const pose = new (window as any).Pose({
          locateFile: (file: string) => `${base}/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults(handleResults);
        poseRef.current = pose;
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("MediaPipe load failed:", err);
        if (!cancelled) setStatus("error");
      }
    };

    init();
    return () => { cancelled = true; };
  }, [videoFile]);

  // ── Draw results ──────────────────────────────────────────────────────────
  const handleResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = video.videoWidth  || 640;
    const H = video.videoHeight || 360;
    canvas.width  = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const lm = results.poseLandmarks;
    if (!lm || !showSkel) return;

    const pt = (i: number) => ({ x: lm[i].x * W, y: lm[i].y * H });
    const vis = (i: number) => (lm[i]?.visibility ?? 0) > 0.35;

    // Connections
    CONNECTIONS.forEach(([a, b]) => {
      if (!vis(a) || !vis(b)) return;
      const pA = pt(a), pB = pt(b);
      ctx.save();
      ctx.strokeStyle  = connColor(a, b);
      ctx.lineWidth    = 2.5;
      ctx.lineCap      = "round";
      ctx.globalAlpha  = 0.85;
      ctx.shadowBlur   = 4;
      ctx.shadowColor  = connColor(a, b);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
      ctx.restore();
    });

    // Joints
    KEY_JOINTS.forEach((i) => {
      if (!vis(i)) return;
      const p = pt(i);
      const c = jointColor(i);
      ctx.save();
      ctx.shadowBlur  = 10;
      ctx.shadowColor = c;
      ctx.fillStyle   = c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Angles at key joints
    if (vis(23) && vis(25) && vis(27)) {
      const lKnee = angle(pt(23), pt(25), pt(27));
      drawLabel(ctx, pt(25).x + 20, pt(25).y, `${lKnee}°`, "#22d3ee");
    }
    if (vis(24) && vis(26) && vis(28)) {
      const rKnee = angle(pt(24), pt(26), pt(28));
      drawLabel(ctx, pt(26).x - 20, pt(26).y, `${rKnee}°`, "#a78bfa");
    }
    if (vis(11) && vis(23) && vis(25)) {
      const lHip = angle(pt(11), pt(23), pt(25));
      drawLabel(ctx, pt(23).x + 22, pt(23).y, `${lHip}°`, "#f59e0b");
    }

    // Emit angles
    if (onAngles && vis(23) && vis(25) && vis(27) && vis(24) && vis(26) && vis(28)) {
      onAngles({
        leftKnee:   angle(pt(23), pt(25), pt(27)),
        rightKnee:  angle(pt(24), pt(26), pt(28)),
        leftHip:    vis(11) ? angle(pt(11), pt(23), pt(25)) : 0,
        rightHip:   vis(12) ? angle(pt(12), pt(24), pt(26)) : 0,
        leftElbow:  vis(11) && vis(13) && vis(15) ? angle(pt(11), pt(13), pt(15)) : 0,
        rightElbow: vis(12) && vis(14) && vis(16) ? angle(pt(12), pt(14), pt(16)) : 0,
        spineAngle: (() => {
          if (!vis(11) || !vis(12) || !vis(23) || !vis(24)) return 0;
          const smx = (pt(11).x + pt(12).x) / 2;
          const smy = (pt(11).y + pt(12).y) / 2;
          const hmx = (pt(23).x + pt(24).x) / 2;
          const hmy = (pt(23).y + pt(24).y) / 2;
          const dx = hmx - smx, dy = hmy - smy;
          return Math.round(Math.abs(Math.atan2(dx, dy) * 180 / Math.PI));
        })(),
      });
    }
  }, [showSkel, onAngles]);

  // ── Frame loop ────────────────────────────────────────────────────────────
  const sendFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !poseRef.current || video.paused || video.ended) return;
    try { await poseRef.current.send({ image: video }); } catch {}
    rafRef.current = requestAnimationFrame(sendFrame);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const handlePlay = () => {
    videoRef.current?.play();
    setPlaying(true);
    sendFrame();
  };

  const handlePause = () => {
    videoRef.current?.pause();
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  };

  const handleSpeedChange = (s: number) => {
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSpeed(s);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setProgress(t);
  };

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!videoFile) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl"
        style={{ height: 260, background: "var(--surface)", border: "2px dashed rgba(6,182,212,0.2)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(6,182,212,0.1)" }}>
          <Video className="w-7 h-7" style={{ color: "#06b6d4" }} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Upload a video for live pose analysis</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>MP4, MOV, AVI · up to 5 min</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#000" }}>
      {/* Video + canvas stack */}
      <div className="relative" style={{ aspectRatio: "16/9", background: "#000" }}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onTimeUpdate={() => setProgress(videoRef.current?.currentTime ?? 0)}
          onEnded={() => { setPlaying(false); cancelAnimationFrame(rafRef.current); }}
        />
        {/* Pose canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ display: showSkel ? "block" : "none" }}
        />

        {/* Loading overlay */}
        <AnimatePresence>
          {status === "loading" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(6,10,16,0.85)", backdropFilter: "blur(4px)" }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#06b6d4" }} />
              <div className="text-center">
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Loading AI pose model…</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>First load takes ~5 seconds</p>
              </div>
            </motion.div>
          )}
          {status === "error" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background: "rgba(6,10,16,0.85)" }}>
              <AlertCircle className="w-7 h-7" style={{ color: "#f43f5e" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Pose model unavailable — check your connection
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 space-y-2" style={{ background: "rgba(6,10,16,0.95)" }}>
        {/* Scrubber */}
        <input type="range" min={0} max={duration || 1} step={0.01} value={progress}
          onChange={handleSeek}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: "#06b6d4" }}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: "var(--text-secondary)" }}>
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <motion.button whileTap={{ scale: 0.88 }}
              onClick={playing ? handlePause : handlePlay}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#06b6d4,#0891b2)", boxShadow: "0 0 12px rgba(6,182,212,0.4)" }}>
              {playing
                ? <Pause className="w-4 h-4 text-white" />
                : <Play className="w-4 h-4 text-white ml-0.5" />}
            </motion.button>

            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: "var(--text-secondary)" }}>
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
              {fmt(progress)} / {fmt(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speed */}
            {[0.25, 0.5, 1].map((s) => (
              <button key={s} onClick={() => handleSpeedChange(s)}
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{
                  background: speed === s ? "rgba(6,182,212,0.2)" : "transparent",
                  color: speed === s ? "#22d3ee" : "var(--text-tertiary)",
                }}>
                {s}x
              </button>
            ))}

            {/* Skeleton toggle */}
            <button onClick={() => setShowSkel(!showSkel)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ml-1"
              style={{
                background: showSkel ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.05)",
                color: showSkel ? "#22d3ee" : "var(--text-tertiary)",
                border: `1px solid ${showSkel ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.07)"}`,
              }}>
              <Layers className="w-3 h-3" /> AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
