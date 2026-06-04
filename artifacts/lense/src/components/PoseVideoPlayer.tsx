"use client";

import { useRef, useEffect, useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, ChevronLeft, ChevronRight,
  Layers, Video, Loader2, AlertCircle,
} from "lucide-react";

/* ─── MediaPipe landmark indices & connections ──────────────────────────── */
const CONNECTIONS: [number, number][] = [
  [11,12],[11,23],[12,24],[23,24],           // torso
  [11,13],[13,15],[15,17],[15,19],[17,19],   // left arm
  [12,14],[14,16],[16,18],[16,20],[18,20],   // right arm
  [23,25],[25,27],[27,29],[27,31],[29,31],   // left leg
  [24,26],[26,28],[28,30],[28,32],[30,32],   // right leg
];
const LEFT_IDX  = new Set([11,13,15,17,19,21,23,25,27,29,31]);
const RIGHT_IDX = new Set([12,14,16,18,20,22,24,26,28,30,32]);
const KEY_JOINTS = [0,11,12,13,14,15,16,23,24,25,26,27,28];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function calcAngle(
  a:{x:number;y:number}, b:{x:number;y:number}, c:{x:number;y:number},
): number {
  const ab={x:a.x-b.x,y:a.y-b.y}, cb={x:c.x-b.x,y:c.y-b.y};
  const dot=ab.x*cb.x+ab.y*cb.y, cross=Math.abs(ab.x*cb.y-ab.y*cb.x);
  return Math.round(Math.atan2(cross,dot)*180/Math.PI);
}

function drawLabel(
  ctx:CanvasRenderingContext2D, x:number, y:number, text:string, color:string,
) {
  ctx.save();
  ctx.font="bold 13px -apple-system,sans-serif";
  const w=ctx.measureText(text).width+14;
  ctx.fillStyle="rgba(8,8,18,0.88)";
  ctx.beginPath(); ctx.roundRect(x-w/2,y-13,w,24,6); ctx.fill();
  ctx.fillStyle=color; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(text,x,y);
  ctx.restore();
}

function loadScript(src:string):Promise<void> {
  return new Promise((res,rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){res();return;}
    const s=document.createElement("script");
    s.src=src; s.crossOrigin="anonymous";
    s.onload=()=>res(); s.onerror=()=>rej(new Error(`Failed: ${src}`));
    document.head.appendChild(s);
  });
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface JointAngles {
  leftKnee:number; rightKnee:number;
  leftHip:number;  rightHip:number;
  leftElbow:number; rightElbow:number;
  spineAngle:number;
}

interface Props {
  videoFile: File|null;
  onAngles?: (a:JointAngles)=>void;
}

const SPEEDS = [0.1, 0.25, 0.5, 1];

/* ─── Component ──────────────────────────────────────────────────────────── */
export function PoseVideoPlayer({ videoFile, onAngles }: Props) {
  const inputId   = useId();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef   = useRef<any>(null);
  const rafRef    = useRef<number>(0);
  const busyRef   = useRef(false);   // true while MediaPipe is processing a frame

  /* stable ref wrapper so MediaPipe always uses the latest drawResults */
  const drawResultsRef = useRef<(r:any)=>void>(()=>{});

  const [status,    setStatus]    = useState<"idle"|"loading"|"ready"|"error">("idle");
  const [playing,   setPlaying]   = useState(false);
  const [showSkel,  setShowSkel]  = useState(true);
  const [speed,     setSpeed]     = useState(1);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [trackedN,  setTrackedN]  = useState(0); // number of visible joints

  /* ── Draw skeleton results from MediaPipe ── */
  const drawResults = useCallback((results:any)=>{
    busyRef.current = false;
    const canvas=canvasRef.current, video=videoRef.current;
    if(!canvas||!video) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    const W=video.videoWidth||640, H=video.videoHeight||360;
    canvas.width=W; canvas.height=H;
    ctx.clearRect(0,0,W,H);
    const lm=results.poseLandmarks;
    if(!lm) return;

    const vis=(i:number)=>(lm[i]?.visibility??0)>0.35;
    const pt=(i:number)=>({x:lm[i].x*W, y:lm[i].y*H});

    if(!showSkel) { setTrackedN(0); return; }

    /* Glow connections */
    CONNECTIONS.forEach(([a,b])=>{
      if(!vis(a)||!vis(b)) return;
      const pA=pt(a),pB=pt(b);
      const col = LEFT_IDX.has(a)&&LEFT_IDX.has(b)   ? "#22d3ee"
                : RIGHT_IDX.has(a)&&RIGHT_IDX.has(b) ? "#a78bfa"
                : "rgba(255,255,255,0.55)";
      ctx.save();
      ctx.strokeStyle=col; ctx.lineWidth=3; ctx.lineCap="round";
      ctx.shadowBlur=8; ctx.shadowColor=col; ctx.globalAlpha=0.88;
      ctx.beginPath(); ctx.moveTo(pA.x,pA.y); ctx.lineTo(pB.x,pB.y); ctx.stroke();
      ctx.restore();
    });

    /* Joint dots */
    let seen=0;
    KEY_JOINTS.forEach(i=>{
      if(!vis(i)) return;
      seen++;
      const p=pt(i);
      const c=LEFT_IDX.has(i)?"#22d3ee":RIGHT_IDX.has(i)?"#a78bfa":"#ffffff";
      ctx.save();
      ctx.shadowBlur=14; ctx.shadowColor=c;
      ctx.fillStyle=c+"cc";
      ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#07070f";
      ctx.beginPath(); ctx.arc(p.x,p.y,2.8,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
    setTrackedN(seen);

    /* Angle labels */
    if(vis(23)&&vis(25)&&vis(27))
      drawLabel(ctx,pt(25).x+26,pt(25).y,`${calcAngle(pt(23),pt(25),pt(27))}°`,"#22d3ee");
    if(vis(24)&&vis(26)&&vis(28))
      drawLabel(ctx,pt(26).x-26,pt(26).y,`${calcAngle(pt(24),pt(26),pt(28))}°`,"#a78bfa");
    if(vis(11)&&vis(23)&&vis(25))
      drawLabel(ctx,pt(23).x+28,pt(23).y-8,`${calcAngle(pt(11),pt(23),pt(25))}°`,"#f59e0b");

    /* Emit angles */
    if(onAngles&&vis(23)&&vis(25)&&vis(27)&&vis(24)&&vis(26)&&vis(28)) {
      const smx=(pt(11).x+pt(12).x)/2, smy=(pt(11).y+pt(12).y)/2;
      const hmx=(pt(23).x+pt(24).x)/2, hmy=(pt(23).y+pt(24).y)/2;
      onAngles({
        leftKnee:   calcAngle(pt(23),pt(25),pt(27)),
        rightKnee:  calcAngle(pt(24),pt(26),pt(28)),
        leftHip:    vis(11)?calcAngle(pt(11),pt(23),pt(25)):0,
        rightHip:   vis(12)?calcAngle(pt(12),pt(24),pt(26)):0,
        leftElbow:  vis(11)&&vis(13)&&vis(15)?calcAngle(pt(11),pt(13),pt(15)):0,
        rightElbow: vis(12)&&vis(14)&&vis(16)?calcAngle(pt(12),pt(14),pt(16)):0,
        spineAngle: Math.round(Math.abs(Math.atan2(hmx-smx,hmy-smy)*180/Math.PI)),
      });
    }
  }, [showSkel, onAngles]);

  /* Keep the ref pointing at the latest drawResults so MediaPipe doesn't stale */
  useEffect(()=>{ drawResultsRef.current=drawResults; },[drawResults]);

  /* ── Init MediaPipe (once per video file) ── */
  const initPose = useCallback(async()=>{
    setStatus("loading");
    try {
      const base="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";
      await loadScript(`${base}/pose.js`);
      const pose=new (window as any).Pose({ locateFile:(f:string)=>`${base}/${f}` });
      pose.setOptions({
        modelComplexity:1, smoothLandmarks:true,
        enableSegmentation:false,
        minDetectionConfidence:0.5, minTrackingConfidence:0.5,
      });
      // Always delegate to the latest drawResults via the ref — no stale closure
      pose.onResults((r:any)=>drawResultsRef.current(r));
      poseRef.current=pose;
      setStatus("ready");
    } catch(e) {
      console.error(e); setStatus("error");
    }
  },[]);

  /* ── Send a single frame to MediaPipe (for scrub / seek / step) ── */
  const detectFrame = useCallback(()=>{
    const video=videoRef.current;
    if(!video||!poseRef.current||busyRef.current) return;
    busyRef.current=true;
    poseRef.current.send({image:video}).catch(()=>{ busyRef.current=false; });
  },[]);

  /* ── Continuous playback loop ── */
  const sendFrame = useCallback(()=>{
    const video=videoRef.current;
    if(!video||!poseRef.current||video.paused||video.ended) return;
    if(!busyRef.current) {
      busyRef.current=true;
      poseRef.current.send({image:video}).catch(()=>{ busyRef.current=false; });
    }
    rafRef.current=requestAnimationFrame(sendFrame);
  },[]);

  /* ── Load video when file changes ── */
  useEffect(()=>{
    if(!videoFile||!videoRef.current) return;
    const url=URL.createObjectURL(videoFile);
    videoRef.current.src=url;
    videoRef.current.load();
    initPose();
    return()=>URL.revokeObjectURL(url);
  },[videoFile, initPose]);

  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[]);

  /* ── Transport ── */
  const play  = ()=>{ videoRef.current?.play(); setPlaying(true); sendFrame(); };
  const pause = ()=>{ videoRef.current?.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current); };

  const stepFrame=(dir:number)=>{
    if(!videoRef.current) return;
    pause();
    videoRef.current.currentTime=Math.max(0,Math.min(duration,videoRef.current.currentTime+dir*(1/30)));
    // Detect pose on the stepped frame
    setTimeout(detectFrame,40); // small delay lets the video decode the frame
  };

  const setSpeedVal=(s:number)=>{
    if(videoRef.current) videoRef.current.playbackRate=s;
    setSpeed(s);
  };

  const handleScrub=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const t=Number(e.target.value);
    if(videoRef.current) videoRef.current.currentTime=t;
    setProgress(t);
    // Detect pose on the scrubbed frame
    setTimeout(detectFrame,40);
  };

  const fmt=(t:number)=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,"0")}`;

  /* ─── Empty / upload state ──────────────────────────────────────────── */
  if(!videoFile) {
    return (
      <label htmlFor={inputId} className="block cursor-pointer">
        <input id={inputId} type="file" accept="video/*" className="sr-only"
          onChange={()=>{}} /* upload handled by parent — this is never shown when parent wires its own input */ />
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl py-16"
          style={{ background:"var(--surface)", border:"2px dashed rgba(108,99,255,0.22)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background:"rgba(108,99,255,0.1)" }}>
            <Video className="w-8 h-8" style={{ color:"var(--accent)" }} />
          </div>
          <div className="text-center px-6">
            <p className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>
              Upload video for real-time pose tracking
            </p>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color:"var(--text-tertiary)" }}>
              MediaPipe detects your joints frame-by-frame · MP4, MOV
            </p>
          </div>
        </div>
      </label>
    );
  }

  /* ─── Player ─────────────────────────────────────────────────────────── */
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background:"#000" }}>

      {/* Video + canvas stack */}
      <div className="relative" style={{ aspectRatio:"16/9", background:"#07070f" }}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          onLoadedMetadata={()=>{ setDuration(videoRef.current?.duration??0); }}
          onLoadedData={()=>{ setTimeout(detectFrame,80); }} /* show skeleton on first frame */
          onSeeked={detectFrame}                             /* update skeleton after any seek */
          onTimeUpdate={()=>setProgress(videoRef.current?.currentTime??0)}
          onEnded={()=>{ setPlaying(false); cancelAnimationFrame(rafRef.current); }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ display:showSkel?"block":"none" }}
        />

        {/* Overlays */}
        <AnimatePresence>
          {status==="loading" && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background:"rgba(7,7,15,0.88)", backdropFilter:"blur(4px)" }}>
              <Loader2 className="w-9 h-9 animate-spin" style={{ color:"var(--accent)" }} />
              <div className="text-center">
                <p className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Loading AI pose model…</p>
                <p className="text-xs mt-1" style={{ color:"var(--text-secondary)" }}>First load ~5 s · downloads ~5 MB</p>
              </div>
            </motion.div>
          )}
          {status==="error" && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background:"rgba(7,7,15,0.88)" }}>
              <AlertCircle className="w-7 h-7" style={{ color:"#f43f5e" }} />
              <p className="text-sm text-center px-6" style={{ color:"var(--text-secondary)" }}>
                Pose model unavailable — check your connection
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status badge */}
        {status==="ready" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background:"rgba(7,7,15,0.82)", backdropFilter:"blur(8px)", border:"1px solid rgba(34,211,238,0.2)" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" style={{ boxShadow:"0 0 6px #34d399" }} />
            <span className="text-xs font-semibold" style={{ color:"#22d3ee" }}>
              {trackedN>0 ? `${trackedN} joints tracked` : "Pose active"}
            </span>
          </div>
        )}
      </div>

      {/* ─── Controls ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2.5" style={{ background:"rgba(7,7,15,0.97)" }}>

        {/* Scrub bar — fires pose detection on every change */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono w-10 text-right shrink-0"
            style={{ color:"var(--text-tertiary)" }}>{fmt(progress)}</span>
          <input
            type="range" min={0} max={duration||1} step={0.033} value={progress}
            onChange={handleScrub}
            className="flex-1"
            style={{ accentColor:"var(--accent)" }}
          />
          <span className="text-xs font-mono w-10 shrink-0"
            style={{ color:"var(--text-tertiary)" }}>{fmt(duration)}</span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-between">

          {/* Transport buttons */}
          <div className="flex items-center gap-2">
            <button onClick={()=>stepFrame(-1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background:"var(--surface-2)", color:"var(--text-secondary)" }}
              title="Step back 1 frame">
              <ChevronLeft className="w-4 h-4" />
            </button>

            <motion.button whileTap={{scale:0.88}} onClick={playing?pause:play}
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background:"var(--accent)", boxShadow:"0 0 18px var(--accent-glow)" }}>
              {playing
                ? <Pause className="w-4 h-4 text-white" />
                : <Play  className="w-4 h-4 text-white ml-0.5" />}
            </motion.button>

            <button onClick={()=>stepFrame(1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background:"var(--surface-2)", color:"var(--text-secondary)" }}
              title="Step forward 1 frame">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Speed + skeleton toggle */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 p-1 rounded-xl"
              style={{ background:"var(--surface-2)" }}>
              {SPEEDS.map(s=>(
                <button key={s} onClick={()=>setSpeedVal(s)}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                  style={{
                    background: speed===s?"var(--accent)":"transparent",
                    color:      speed===s?"#fff":"var(--text-tertiary)",
                  }}>
                  {s}×
                </button>
              ))}
            </div>

            <button onClick={()=>setShowSkel(!showSkel)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: showSkel?"rgba(34,211,238,0.12)":"var(--surface-2)",
                color:      showSkel?"#22d3ee":"var(--text-tertiary)",
                border:`1px solid ${showSkel?"rgba(34,211,238,0.25)":"transparent"}`,
              }}>
              <Layers className="w-3 h-3" />
              {showSkel?"Skeleton":"Skeleton"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
