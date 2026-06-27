"use client";

import { useRef, useEffect, useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, ChevronLeft, ChevronRight, Layers, Video, Loader2, AlertCircle } from "lucide-react";

/* ─── MediaPipe landmark connections ─────────────────────────────────────── */
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

function calcAngle(
  a:{x:number;y:number}, b:{x:number;y:number}, c:{x:number;y:number}
): number {
  const ab={x:a.x-b.x,y:a.y-b.y}, cb={x:c.x-b.x,y:c.y-b.y};
  const dot=ab.x*cb.x+ab.y*cb.y, cross=Math.abs(ab.x*cb.y-ab.y*cb.x);
  return Math.round(Math.atan2(cross,dot)*180/Math.PI);
}

function drawLabel(ctx:CanvasRenderingContext2D,x:number,y:number,text:string,color:string){
  ctx.font="bold 13px -apple-system,sans-serif";
  const w=ctx.measureText(text).width+12;
  ctx.fillStyle="rgba(10,10,15,0.82)";
  ctx.beginPath(); ctx.roundRect(x-w/2,y-12,w,22,5); ctx.fill();
  ctx.fillStyle=color; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(text,x,y);
}

function loadScript(src:string):Promise<void>{
  return new Promise((res,rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){res();return;}
    const s=document.createElement("script");
    s.src=src; s.crossOrigin="anonymous";
    s.onload=()=>res(); s.onerror=()=>rej(new Error(`Failed: ${src}`));
    document.head.appendChild(s);
  });
}

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

export function PoseVideoPlayer({ videoFile, onAngles }: Props) {
  const inputId = useId();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef   = useRef<any>(null);
  const rafRef    = useRef<number>(0);
  const processingRef = useRef(false);

  const [status, setStatus]   = useState<"idle"|"loading"|"ready"|"error">("idle");
  const [playing, setPlaying] = useState(false);
  const [showSkel, setShowSkel] = useState(true);
  const [speed, setSpeed]     = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  /* Load video */
  useEffect(()=>{
    if(!videoFile||!videoRef.current) return;
    const url=URL.createObjectURL(videoFile);
    videoRef.current.src=url;
    videoRef.current.load();
    initPose();
    return ()=>URL.revokeObjectURL(url);
  },[videoFile]);

  /* Init MediaPipe */
  const initPose = async()=>{
    setStatus("loading");
    try{
      const base="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";
      await loadScript(`${base}/pose.js`);
      const pose=new (window as any).Pose({
        locateFile:(f:string)=>`${base}/${f}`,
      });
      pose.setOptions({
        modelComplexity:1, smoothLandmarks:true,
        enableSegmentation:false,
        minDetectionConfidence:0.5, minTrackingConfidence:0.5,
      });
      pose.onResults(drawResults);
      poseRef.current=pose;
      setStatus("ready");
    }catch(e){
      console.error(e);
      setStatus("error");
    }
  };

  /* Draw skeleton */
  const drawResults = useCallback((results:any)=>{
    processingRef.current=false;
    const canvas=canvasRef.current, video=videoRef.current;
    if(!canvas||!video) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    const W=video.videoWidth||640, H=video.videoHeight||360;
    canvas.width=W; canvas.height=H;
    ctx.clearRect(0,0,W,H);
    const lm=results.poseLandmarks;
    if(!lm||!showSkel) return;
    const vis=(i:number)=>(lm[i]?.visibility??0)>0.35;
    const pt=(i:number)=>({x:lm[i].x*W, y:lm[i].y*H});

    /* Connections */
    CONNECTIONS.forEach(([a,b])=>{
      if(!vis(a)||!vis(b)) return;
      const pA=pt(a),pB=pt(b);
      const col=LEFT_IDX.has(a)&&LEFT_IDX.has(b)?"#22d3ee":
                RIGHT_IDX.has(a)&&RIGHT_IDX.has(b)?"#a78bfa":"rgba(255,255,255,0.6)";
      ctx.save();
      ctx.strokeStyle=col; ctx.lineWidth=2.5; ctx.lineCap="round";
      ctx.globalAlpha=0.85; ctx.shadowBlur=4; ctx.shadowColor=col;
      ctx.beginPath(); ctx.moveTo(pA.x,pA.y); ctx.lineTo(pB.x,pB.y); ctx.stroke();
      ctx.restore();
    });

    /* Joints */
    KEY_JOINTS.forEach(i=>{
      if(!vis(i)) return;
      const p=pt(i);
      const c=LEFT_IDX.has(i)?"#22d3ee":RIGHT_IDX.has(i)?"#a78bfa":"#fff";
      ctx.save();
      ctx.shadowBlur=10; ctx.shadowColor=c;
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#0a0a0f"; ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });

    /* Angle labels */
    if(vis(23)&&vis(25)&&vis(27)){
      const a=calcAngle(pt(23),pt(25),pt(27));
      drawLabel(ctx,pt(25).x+22,pt(25).y,`${a}°`,"#22d3ee");
    }
    if(vis(24)&&vis(26)&&vis(28)){
      const a=calcAngle(pt(24),pt(26),pt(28));
      drawLabel(ctx,pt(26).x-22,pt(26).y,`${a}°`,"#a78bfa");
    }
    if(vis(11)&&vis(23)&&vis(25)){
      const a=calcAngle(pt(11),pt(23),pt(25));
      drawLabel(ctx,pt(23).x+24,pt(23).y-4,`${a}°`,"#f59e0b");
    }

    /* Emit angles */
    if(onAngles&&vis(23)&&vis(25)&&vis(27)&&vis(24)&&vis(26)&&vis(28)){
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
  },[showSkel,onAngles]);

  /* Frame loop */
  const sendFrame = useCallback(async()=>{
    const video=videoRef.current;
    if(!video||!poseRef.current||video.paused||video.ended||processingRef.current) return;
    processingRef.current=true;
    try{ await poseRef.current.send({image:video}); }catch{ processingRef.current=false; }
    rafRef.current=requestAnimationFrame(sendFrame);
  },[]);

  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[]);

  const play=()=>{ videoRef.current?.play(); setPlaying(true); sendFrame(); };
  const pause=()=>{ videoRef.current?.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current); };

  const stepFrame=(dir:number)=>{
    if(!videoRef.current) return;
    pause();
    videoRef.current.currentTime=Math.max(0,Math.min(duration,videoRef.current.currentTime+dir*(1/30)));
    if(poseRef.current) poseRef.current.send({image:videoRef.current}).catch(()=>{});
  };

  const setSpeedVal=(s:number)=>{
    if(videoRef.current) videoRef.current.playbackRate=s;
    setSpeed(s);
  };

  const fmt=(t:number)=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,"0")}`;

  /* ─── Empty state ─────────────────────────────────────────────────────── */
  if(!videoFile){
    return (
      <label htmlFor={inputId} className="block cursor-pointer">
        <input id={inputId} type="file" accept="video/*" className="sr-only"
          onChange={e=>{ const f=e.target.files?.[0]; if(f) return; }} />
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl py-12"
          style={{ background:"var(--surface)", border:"2px dashed rgba(108,99,255,0.25)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background:"rgba(108,99,255,0.1)" }}>
            <Video className="w-7 h-7" style={{ color:"var(--accent)" }} />
          </div>
          <div className="text-center px-4">
            <p className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>
              Tap to upload video for pose analysis
            </p>
            <p className="text-xs mt-1" style={{ color:"var(--text-tertiary)" }}>MP4, MOV · up to 5 min</p>
          </div>
        </div>
      </label>
    );
  }

  /* ─── Player ──────────────────────────────────────────────────────────── */
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background:"#000" }}>
      {/* Video + canvas stack */}
      <div className="relative" style={{ aspectRatio:"16/9", background:"#000" }}>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain"
          playsInline
          onLoadedMetadata={()=>setDuration(videoRef.current?.duration??0)}
          onTimeUpdate={()=>setProgress(videoRef.current?.currentTime??0)}
          onEnded={()=>{ setPlaying(false); cancelAnimationFrame(rafRef.current); }}
        />
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ display: showSkel?"block":"none" }} />

        {/* Overlays */}
        <AnimatePresence>
          {status==="loading" && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background:"rgba(10,10,15,0.85)", backdropFilter:"blur(4px)" }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color:"var(--accent)" }} />
              <div className="text-center">
                <p className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Loading AI pose model…</p>
                <p className="text-xs mt-1" style={{ color:"var(--text-secondary)" }}>First load ~5 seconds</p>
              </div>
            </motion.div>
          )}
          {status==="error" && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background:"rgba(10,10,15,0.85)" }}>
              <AlertCircle className="w-7 h-7" style={{ color:"#f43f5e" }} />
              <p className="text-sm text-center px-6" style={{ color:"var(--text-secondary)" }}>
                Pose model unavailable — check your connection
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ready indicator */}
        {status==="ready" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background:"rgba(10,10,15,0.75)", backdropFilter:"blur(8px)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-xs font-semibold text-white">Pose active</span>
          </div>
        )}
      </div>

      {/* ─── Controls ─────────────────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2.5" style={{ background:"rgba(10,10,15,0.97)" }}>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono w-10 text-right shrink-0"
            style={{ color:"var(--text-tertiary)" }}>{fmt(progress)}</span>
          <input type="range" min={0} max={duration||1} step={0.033} value={progress}
            onChange={e=>{ const t=Number(e.target.value); if(videoRef.current) videoRef.current.currentTime=t; setProgress(t); }}
            className="flex-1" style={{ accentColor:"var(--accent)" }} />
          <span className="text-xs font-mono w-10 shrink-0"
            style={{ color:"var(--text-tertiary)" }}>{fmt(duration)}</span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-between">
          {/* Left: transport */}
          <div className="flex items-center gap-2">
            {/* Step back */}
            <button onClick={()=>stepFrame(-1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background:"var(--surface-2)", color:"var(--text-secondary)" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Play/Pause */}
            <motion.button whileTap={{scale:0.88}} onClick={playing?pause:play}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background:"var(--accent)", boxShadow:"0 0 16px var(--accent-glow)" }}>
              {playing
                ? <Pause className="w-4 h-4 text-white" />
                : <Play  className="w-4 h-4 text-white ml-0.5" />}
            </motion.button>

            {/* Step forward */}
            <button onClick={()=>stepFrame(1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background:"var(--surface-2)", color:"var(--text-secondary)" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: speed + skeleton */}
          <div className="flex items-center gap-1.5">
            {/* Speed selector */}
            <div className="flex items-center gap-0.5 p-1 rounded-lg"
              style={{ background:"var(--surface-2)" }}>
              {SPEEDS.map(s=>(
                <button key={s} onClick={()=>setSpeedVal(s)}
                  className="text-xs px-2 py-1 rounded-md font-semibold transition-all"
                  style={{
                    background: speed===s?"var(--accent)":"transparent",
                    color: speed===s?"#fff":"var(--text-tertiary)",
                  }}>
                  {s}x
                </button>
              ))}
            </div>

            {/* Skeleton toggle */}
            <button onClick={()=>setShowSkel(!showSkel)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: showSkel?"rgba(108,99,255,0.15)":"var(--surface-2)",
                color: showSkel?"var(--accent-2)":"var(--text-tertiary)",
                border:`1px solid ${showSkel?"rgba(108,99,255,0.3)":"transparent"}`,
              }}>
              <Layers className="w-3 h-3" /> AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
