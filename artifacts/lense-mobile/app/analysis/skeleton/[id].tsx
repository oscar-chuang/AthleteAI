import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as ScreenOrientation from "expo-screen-orientation";
import * as FileSystem from "expo-file-system/legacy";

import { useAnalyses } from "@/lib/analysesStore";

// ─── Types ───────────────────────────────────────────────────────────────────
interface JointAngles {
  leftKnee: number; rightKnee: number;
  leftHip: number;  rightHip: number;
  leftElbow: number; rightElbow: number;
}

// 0 = safe, 1 = caution, 2 = injury risk (matches the WebView risk model)
type RiskMap = Record<keyof JointAngles, number>;

const RISK_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

type OverlayMode = "safety" | "form" | "clean";

const OVERLAY_MODES: { mode: OverlayMode; label: string; icon: "shield" | "bar-chart-2" | "eye" }[] = [
  { mode: "safety", label: "Safety", icon: "shield" },
  { mode: "form",   label: "Form",   icon: "bar-chart-2" },
  { mode: "clean",  label: "Clean",  icon: "eye" },
];

// Ideal biomechanical ranges per joint (degrees). Angles outside these bounds
// are flagged in Form mode. Separate from injury-risk thresholds — an angle
// can be suboptimal without reaching injury territory.
const IDEAL_RANGES: Record<keyof JointAngles, { min: number; max: number }> = {
  leftKnee:   { min: 90,  max: 165 },
  rightKnee:  { min: 90,  max: 165 },
  leftHip:    { min: 70,  max: 170 },
  rightHip:   { min: 70,  max: 170 },
  leftElbow:  { min: 70,  max: 165 },
  rightElbow: { min: 70,  max: 165 },
};

// Returns form feedback when the angle sits outside IDEAL_RANGES.
function formInsight(key: string, deg: number): { title: string; body: string } | null {
  const range = IDEAL_RANGES[key as keyof JointAngles];
  if (!range || deg <= 0) return null;
  if (deg >= range.min && deg <= range.max) return null;

  const side = key.startsWith("left") ? "Left" : "Right";
  const dist = Math.min(Math.abs(deg - range.min), Math.abs(deg - range.max));
  const degree = dist > 20 ? "significantly" : "slightly";

  if (key.includes("Knee")) {
    if (deg < range.min)
      return {
        title: `${side} knee — excessive flex (${deg}°)`,
        body: `The knee is ${degree} deeper than the ideal ${range.min}–${range.max}° range. Work on controlled descent and stopping at parallel.`,
      };
    return {
      title: `${side} knee — near full extension (${deg}°)`,
      body: `At ${deg}°, the knee is ${degree} past ideal range. Keep a soft bend to maintain active joint loading.`,
    };
  }
  if (key.includes("Hip")) {
    if (deg < range.min)
      return {
        title: `${side} hip — deep hinge (${deg}°)`,
        body: `Hip flexion at ${deg}° is ${degree} beyond the ideal ${range.min}–${range.max}° range. Brace your core and maintain a neutral spine.`,
      };
    return {
      title: `${side} hip — limited hinge (${deg}°)`,
      body: `Hip angle at ${deg}° suggests restricted hip hinge mobility. Work on hip-flexor and hamstring flexibility.`,
    };
  }
  if (key.includes("Elbow")) {
    if (deg > range.max)
      return {
        title: `${side} elbow — near lock-out (${deg}°)`,
        body: `Elbow at ${deg}°, ${degree} past ideal range. Maintain a slight bend to protect tendons and joint structures.`,
      };
    return {
      title: `${side} elbow — limited extension (${deg}°)`,
      body: `Elbow at ${deg}°, below the ideal ${range.min}–${range.max}° range. Check for shoulder-girdle mobility restrictions.`,
    };
  }
  return null;
}

// Is angle `a` a more extreme (worse) pattern than `b` for this joint?
// Knees fail at both ends (deep bend / hyperextension) so we measure distance
// from a neutral mid-angle; hips fail on deep flexion (lower is worse); elbows
// fail on hyperextension (higher is worse).
function moreExtreme(key: string, a: number, b: number): boolean {
  if (key.includes("Knee")) return Math.abs(a - 130) > Math.abs(b - 130);
  if (key.includes("Hip")) return a < b;
  return a > b;
}

// Plain-language issue + coaching advice for a flagged joint, based on the
// joint and the angle observed at its worst moment.
function jointInsight(key: string, deg: number): { title: string; body: string } {
  const side = key.startsWith("left") ? "Left" : "Right";
  if (key.includes("Knee")) {
    if (deg <= 95)
      return {
        title: `${side} knee — deep bend`,
        body: "The knee flexes very deep under load, stressing the patellar tendon and ACL. Control your descent, keep the knee tracking over your toes (don't let it cave inward), and build quad and glute strength.",
      };
    return {
      title: `${side} knee — hyperextension`,
      body: "The knee locks out near full extension. Keep a soft micro-bend at lockout so the joint and ligaments absorb load instead of the bone.",
    };
  }
  if (key.includes("Hip")) {
    return {
      title: `${side} hip — deep flexion`,
      body: "A very deep hip hinge can round the lower back. Brace your core, keep a neutral spine, and hinge from the hips rather than collapsing the torso.",
    };
  }
  if (key.includes("Elbow")) {
    return {
      title: `${side} elbow — hyperextension`,
      body: "The elbow locks out fully. Keep a slight bend through the movement to protect the joint and surrounding tendons.",
    };
  }
  return { title: side, body: "" };
}

// ─── HTML builder ─────────────────────────────────────────────────────────────
// The entire pose-tracking UI lives inside the WebView.
// MediaPipe runs in the phone's browser engine (WebAssembly + WebGL),
// which means real, per-frame joint detection — no native build needed.
function buildHtml(videoUri: string | undefined): string {
  const MEDIAPIPE_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;background:#07070f;font-family:-apple-system,sans-serif;color:#f0f0f8}

/* ── Video area ── */
#wrap{position:relative;width:100%;background:#000}
video,canvas{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain}
canvas{pointer-events:none}

/* ── Badge ── */
#badge{position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:6px;
  background:rgba(4,4,12,.88);border:1px solid rgba(34,211,238,.30);
  border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;color:#22d3ee}
#dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex-shrink:0}

/* ── No video placeholder ── */
#empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:10px;color:#3a3a5c;font-size:13px}

/* ── Loading overlay ── */
#loading{position:fixed;inset:0;z-index:99;background:rgba(4,4,12,.92);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
#loading.hide{display:none}
.spin{width:38px;height:38px;border:3px solid #6c63ff33;border-top-color:#6c63ff;
  border-radius:50%;animation:sp .75s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.load-text{font-size:14px;font-weight:600}
.load-sub{font-size:11px;color:#8888aa}

/* ── Controls bar ── */
#ctrl{position:fixed;bottom:0;left:0;right:0;background:rgba(4,4,12,.96);
  padding:10px 14px 14px;display:flex;flex-direction:column;gap:9px}
.row{display:flex;align-items:center;gap:8px}

/* Scrub */
#timeL,#timeR{font-size:11px;color:#8888aa;font-variant-numeric:tabular-nums;min-width:32px}
#timeR{text-align:right}
#scrub{flex:1;height:4px;accent-color:#6c63ff;cursor:pointer}

/* Buttons */
.tbtn{background:#1c1c2e;border:none;border-radius:10px;color:#e0e0f0;
  display:flex;align-items:center;justify-content:center;cursor:pointer}
#playBtn{width:42px;height:42px;background:#6c63ff;border-radius:13px;
  box-shadow:0 0 18px #6c63ff77}
.step{width:34px;height:34px;font-size:16px}

/* Speed pills */
#speeds{display:flex;gap:2px;background:#1c1c2e;padding:4px;border-radius:10px}
.spd{border:none;background:transparent;color:#8888aa;font-size:11px;font-weight:700;
  padding:4px 9px;border-radius:7px;cursor:pointer;transition:all .15s}
.spd.on{background:#6c63ff;color:#fff}

/* Skeleton toggle */
#skelBtn{padding:6px 11px;font-size:11px;font-weight:700;border-radius:9px;cursor:pointer;
  border:1px solid transparent;transition:all .15s}
#skelBtn.on{background:rgba(34,211,238,.12);color:#22d3ee;border-color:rgba(34,211,238,.28)}
#skelBtn.off{background:#1c1c2e;color:#8888aa}

/* Risk legend */
#legend{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:5px;
  background:rgba(4,4,12,.82);border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:8px 11px}
.lg{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:700;color:#c0c0d0;letter-spacing:.3px}
.ld{width:9px;height:9px;border-radius:50%;flex-shrink:0}
</style>
</head>
<body>
<div id="wrap">
  ${videoUri
    ? `<video id="v" playsinline webkit-playsinline muted loop preload="auto"></video>
       <canvas id="c"></canvas>
       <div id="badge"><div id="dot"></div><span id="btxt">Loading AI…</span></div>
       <div id="legend">
         <div class="lg"><span class="ld" style="background:#22c55e"></span>SAFE</div>
         <div class="lg"><span class="ld" style="background:#f59e0b"></span>CAUTION</div>
         <div class="lg"><span class="ld" style="background:#ef4444"></span>RISK</div>
       </div>`
    : `<div id="empty">
         <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3a3a5c" stroke-width="1.5" stroke-linecap="round">
           <rect x="2" y="6" width="20" height="12" rx="2"/><path d="m9 10 5 2-5 2z"/>
         </svg>
         <p>Upload a video from the Analysis page</p>
         <p style="font-size:11px;color:#2a2a3c">to see real-time pose tracking</p>
       </div>`}
</div>

${videoUri ? `
<div id="ctrl">
  <div class="row">
    <span id="timeL">0:00</span>
    <input id="scrub" type="range" min="0" max="100" step="0.1" value="0">
    <span id="timeR">0:00</span>
  </div>
  <div class="row" style="justify-content:space-between">
    <div class="row" style="gap:6px">
      <button class="tbtn step" id="bk">&#9664;</button>
      <button class="tbtn" id="playBtn">&#9654;</button>
      <button class="tbtn step" id="fw">&#9654;&#9654;</button>
    </div>
    <div class="row" style="gap:6px">
      <div id="speeds">
        <button class="spd" data-s="0.1">0.1×</button>
        <button class="spd" data-s="0.25">0.25×</button>
        <button class="spd" data-s="0.5">0.5×</button>
        <button class="spd on" data-s="1">1×</button>
      </div>
      <button class="tbtn on" id="skelBtn">Skeleton</button>
    </div>
  </div>
</div>
` : ''}

<div id="loading">
  <div class="spin"></div>
  <p class="load-text">Loading AI pose model…</p>
  <p class="load-sub">First load ~5 s · downloads ~6 MB</p>
</div>

<script src="${MEDIAPIPE_BASE}/pose.js" crossorigin="anonymous"
  onerror="document.getElementById('loading').innerHTML='<p style=color:#f43f5e>Could not load pose model.<br>Check your internet connection.</p>'">
</script>
<script>
(function(){
  const VIDEO_URI = ${videoUri ? JSON.stringify(videoUri) : "null"};

  /* If no video, hide loading and stop */
  if(!VIDEO_URI){
    document.getElementById("loading").classList.add("hide");
    return;
  }

  const video   = document.getElementById("v");
  const canvas  = document.getElementById("c");
  const ctx     = canvas.getContext("2d");
  const loading = document.getElementById("loading");
  const btxt    = document.getElementById("btxt");
  const scrub   = document.getElementById("scrub");
  const timeL   = document.getElementById("timeL");
  const timeR   = document.getElementById("timeR");
  const playBtn = document.getElementById("playBtn");
  const skelBtn = document.getElementById("skelBtn");

  let busy=false, playing=false, showSkel=true;
  window.__mode='safety';

  /* ── Ideal form ranges (mirrors React Native IDEAL_RANGES) ── */
  const IDEAL={25:{min:90,max:165},26:{min:90,max:165},23:{min:70,max:170},24:{min:70,max:170},13:{min:70,max:165},14:{min:70,max:165}};

  /* ── Helpers ── */
  function fmt(t){const s=Math.floor(t);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}

  /* ── Size video container to leave room for controls ── */
  function sizeWrap(){
    const ctrlH = document.getElementById("ctrl")?.offsetHeight || 110;
    document.getElementById("wrap").style.height=(window.innerHeight-ctrlH)+"px";
  }
  window.addEventListener("resize",sizeWrap);

  /* ── MediaPipe connections ── */
  const CONN=[[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[15,17],[15,19],[17,19],[12,14],[14,16],[16,18],[16,20],[18,20],[23,25],[25,27],[27,29],[27,31],[29,31],[24,26],[26,28],[28,30],[28,32],[30,32]];
  const LI=new Set([11,13,15,17,19,21,23,25,27,29,31]);
  const RI=new Set([12,14,16,18,20,22,24,26,28,30,32]);
  const KJ=[0,11,12,13,14,15,16,23,24,25,26,27,28];

  function ang(a,b,c){
    const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
    return Math.round(Math.atan2(Math.abs(ab.x*cb.y-ab.y*cb.x),ab.x*cb.x+ab.y*cb.y)*180/Math.PI);
  }

  function label(x,y,txt,col){
    ctx.save();
    ctx.font="bold 15px -apple-system,sans-serif";
    const w=ctx.measureText(txt).width+16;
    ctx.fillStyle="rgba(4,4,12,.9)";
    ctx.beginPath();ctx.roundRect(x-w/2,y-15,w,28,7);ctx.fill();
    ctx.fillStyle=col;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(txt,x,y);
    ctx.restore();
  }

  /* Risk colors: 0 safe, 1 caution, 2 risk */
  const RL=["#22c55e","#f59e0b","#ef4444"];
  /* Map an angle to a risk level given low/high caution+risk thresholds */
  function lvl(a,loRisk,loWarn,hiWarn,hiRisk){
    if(a<=loRisk||a>=hiRisk)return 2;
    if(a<=loWarn||a>=hiWarn)return 1;
    return 0;
  }

  /* ── Form-deviation level: 0 in-range, 1 slightly off, 2 significantly off ── */
  function fLvl(idx,deg){
    const r=IDEAL[idx];if(!r)return 0;
    if(deg>=r.min&&deg<=r.max)return 0;
    const d=Math.min(Math.abs(deg-r.min),Math.abs(deg-r.max));
    return d>20?2:1;
  }

  /* ── Draw results ── */
  function onResults(res){
    busy=false;
    const W=video.videoWidth||640,H=video.videoHeight||360;
    canvas.width=W;canvas.height=H;
    ctx.clearRect(0,0,W,H);
    const lm=res.poseLandmarks;
    if(!lm||!showSkel)return;
    const v=i=>(lm[i]?.visibility||0)>0.35;
    const p=i=>({x:lm[i].x*W,y:lm[i].y*H});
    const mode=window.__mode||'safety';

    /* ── Compute joint data ── */
    const jr={}; // safety: index -> {deg, lvl}
    const jf={}; // form:   index -> {deg, lvl}
    function computeJoint(a,b,c,idx,loRisk,loWarn,hiWarn,hiRisk){
      if(!v(a)||!v(b)||!v(c))return;
      const d=ang(p(a),p(b),p(c));
      jr[idx]={deg:d,lvl:lvl(d,loRisk,loWarn,hiWarn,hiRisk)};
      jf[idx]={deg:d,lvl:fLvl(idx,d)};
    }
    computeJoint(23,25,27,25,70,90,175,178);
    computeJoint(24,26,28,26,70,90,175,178);
    computeJoint(11,23,25,23,55,80,999,999);
    computeJoint(12,24,26,24,55,80,999,999);
    computeJoint(11,13,15,13,-1,-1,160,172);
    computeJoint(12,14,16,14,-1,-1,160,172);
    const jActive=mode==='form'?jf:mode==='safety'?jr:{};
    let maxLvl=0;Object.keys(jActive).forEach(k=>{if(jActive[k].lvl>maxLvl)maxLvl=jActive[k].lvl;});

    /* Bone color helper */
    function boneCol(a,b){
      if(mode==='clean')return LI.has(a)&&LI.has(b)?"rgba(34,211,238,.55)":RI.has(a)&&RI.has(b)?"rgba(167,139,250,.55)":"rgba(255,255,255,.3)";
      const rm=Math.max(jActive[a]?jActive[a].lvl:-1,jActive[b]?jActive[b].lvl:-1);
      if(rm>=1)return RL[rm];
      return LI.has(a)&&LI.has(b)?"#22d3ee":RI.has(a)&&RI.has(b)?"#a78bfa":"rgba(255,255,255,.5)";
    }

    /* Bones */
    CONN.forEach(([a,b])=>{
      if(!v(a)||!v(b))return;
      const pA=p(a),pB=p(b);
      const col=boneCol(a,b);
      const rm=mode!=='clean'?Math.max(jActive[a]?jActive[a].lvl:-1,jActive[b]?jActive[b].lvl:-1):-1;
      ctx.save();
      ctx.strokeStyle=col;ctx.lineWidth=rm>=1?4.5:3.5;ctx.lineCap="round";
      ctx.shadowBlur=rm>=2?17:mode==='clean'?5:10;ctx.shadowColor=col;ctx.globalAlpha=.92;
      ctx.beginPath();ctx.moveTo(pA.x,pA.y);ctx.lineTo(pB.x,pB.y);ctx.stroke();
      ctx.restore();
    });

    /* Joints */
    let seen=0;
    KJ.forEach(i=>{
      if(!v(i))return;seen++;
      const pt=p(i);
      const jd=jActive[i];
      let col;
      if(mode==='clean') col=LI.has(i)?"rgba(34,211,238,.7)":RI.has(i)?"rgba(167,139,250,.7)":"rgba(255,255,255,.6)";
      else col=jd?RL[jd.lvl]:(LI.has(i)?"#22d3ee":RI.has(i)?"#a78bfa":"#fff");
      const r=jd&&jd.lvl===2?9:jd&&jd.lvl===1?7.5:6.5;
      ctx.save();
      if(jd&&jd.lvl===2&&mode!=='clean'){
        ctx.strokeStyle=col;ctx.globalAlpha=.45;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(pt.x,pt.y,r+5,0,Math.PI*2);ctx.stroke();
        ctx.globalAlpha=1;
      }
      ctx.shadowBlur=jd&&jd.lvl===2?18:mode==='clean'?5:14;ctx.shadowColor=col;
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#07070f";ctx.beginPath();ctx.arc(pt.x,pt.y,3,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
    btxt.textContent=seen>0?seen+" joints tracked":"Pose active";

    /* Angle labels: only safety + form modes */
    if(mode!=='clean'){
      function angLabel(i,dx,dy){const j=jActive[i];if(!j)return;label(p(i).x+dx,p(i).y+dy,j.deg+"\u00b0",RL[j.lvl]);}
      angLabel(25,34,0);angLabel(26,-34,0);
      angLabel(23,38,-12);angLabel(24,-38,-12);
    }

    /* Mode-specific banners */
    if(mode==='safety'&&maxLvl===2){
      ctx.save();
      ctx.font="bold 16px -apple-system,sans-serif";
      const t="\u26A0 INJURY RISK";
      const w=ctx.measureText(t).width+26;
      ctx.fillStyle="rgba(239,68,68,.92)";
      ctx.beginPath();ctx.roundRect(W/2-w/2,12,w,32,9);ctx.fill();
      ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(t,W/2,29);
      ctx.restore();
    } else if(mode==='form'&&maxLvl>=1){
      ctx.save();
      ctx.font="bold 15px -apple-system,sans-serif";
      const t=maxLvl===2?"\u25b2 Outside ideal range":"\u2022 Minor form deviation";
      const w=ctx.measureText(t).width+24;
      ctx.fillStyle=maxLvl===2?"rgba(239,68,68,.88)":"rgba(245,158,11,.88)";
      ctx.beginPath();ctx.roundRect(W/2-w/2,12,w,30,9);ctx.fill();
      ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(t,W/2,28);
      ctx.restore();
    }

    /* Post angles + risk to React Native */
    if(Object.keys(jr).length){
      try{
        window.ReactNativeWebView.postMessage(JSON.stringify({type:"angles",
          data:{
            leftKnee:  jr[25]?jr[25].deg:0,rightKnee:jr[26]?jr[26].deg:0,
            leftHip:   jr[23]?jr[23].deg:0,rightHip: jr[24]?jr[24].deg:0,
            leftElbow: jr[13]?jr[13].deg:0,rightElbow:jr[14]?jr[14].deg:0,
          },
          risk:{
            leftKnee:  jr[25]?jr[25].lvl:0,rightKnee:jr[26]?jr[26].lvl:0,
            leftHip:   jr[23]?jr[23].lvl:0,rightHip: jr[24]?jr[24].lvl:0,
            leftElbow: jr[13]?jr[13].lvl:0,rightElbow:jr[14]?jr[14].lvl:0,
          },
          form:{
            leftKnee:  jf[25]?jf[25].lvl:0,rightKnee:jf[26]?jf[26].lvl:0,
            leftHip:   jf[23]?jf[23].lvl:0,rightHip: jf[24]?jf[24].lvl:0,
            leftElbow: jf[13]?jf[13].lvl:0,rightElbow:jf[14]?jf[14].lvl:0,
          },
          maxLvl}));
      }catch(e){}
    }
  }

  /* ── Init pose ── */
  const BASE="${MEDIAPIPE_BASE}";
  const pose=new Pose({locateFile:f=>BASE+"/"+f});
  pose.setOptions({modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.5,minTrackingConfidence:.5});
  pose.onResults(onResults);
  pose.initialize().then(()=>{
    loading.classList.add("hide");
    sizeWrap();
    setTimeout(detect,100);
  }).catch(()=>loading.classList.add("hide"));

  /* ── Detect one frame ── */
  function detect(){
    if(busy||!video.readyState)return;
    busy=true;
    pose.send({image:video}).catch(()=>{busy=false;});
  }

  /* ── Playback loop ── */
  let raf=0;
  function loop(){
    if(!playing||video.paused||video.ended)return;
    detect();
    raf=requestAnimationFrame(loop);
  }

  /* ── Video ── */
  video.src=VIDEO_URI;
  video.load();
  video.addEventListener("loadedmetadata",()=>{
    scrub.max=video.duration;
    timeR.textContent=fmt(video.duration);
    sizeWrap();
    try{window.ReactNativeWebView.postMessage(JSON.stringify({
      type:"meta",vw:video.videoWidth,vh:video.videoHeight,dur:video.duration}));}catch(e){}
  });
  video.addEventListener("loadeddata",()=>setTimeout(detect,80));
  video.addEventListener("seeked",detect);
  video.addEventListener("timeupdate",()=>{
    timeL.textContent=fmt(video.currentTime);
    scrub.value=video.currentTime;
  });
  video.addEventListener("ended",()=>{playing=false;playBtn.innerHTML="&#9654;";cancelAnimationFrame(raf);});

  /* ── Controls ── */
  function play(){video.play();playing=true;playBtn.innerHTML="&#9646;&#9646;";loop();}
  function pause(){video.pause();playing=false;playBtn.innerHTML="&#9654;";cancelAnimationFrame(raf);}

  playBtn.onclick=()=>playing?pause():play();

  document.getElementById("bk").onclick=()=>{
    pause();
    video.currentTime=Math.max(0,video.currentTime-1/30);
  };
  document.getElementById("fw").onclick=()=>{
    pause();
    video.currentTime=Math.min(video.duration||99,video.currentTime+1/30);
  };

  scrub.addEventListener("input",e=>{
    video.currentTime=parseFloat(e.target.value);
    setTimeout(detect,40);
  });

  document.querySelectorAll(".spd").forEach(btn=>{
    btn.onclick=()=>{
      video.playbackRate=parseFloat(btn.dataset.s);
      document.querySelectorAll(".spd").forEach(b=>b.classList.remove("on"));
      btn.classList.add("on");
    };
  });

  skelBtn.onclick=()=>{
    showSkel=!showSkel;
    skelBtn.className="tbtn "+(showSkel?"on":"off");
    if(!showSkel){ctx.clearRect(0,0,canvas.width,canvas.height);}
  };
})();
</script>
</body>
</html>`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SkeletonScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const webviewRef = useRef<WebView>(null);

  const { analyses, videoUris } = useAnalyses();
  const analysis  = analyses.find((a) => a.id === id);
  const videoUri  = id ? videoUris[id] : undefined;

  const isLandscape = screenW > screenH;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [angles,      setAngles]      = useState<JointAngles | null>(null);
  const [risk,        setRisk]        = useState<RiskMap | null>(null);
  const [formRisk,    setFormRisk]    = useState<RiskMap | null>(null);
  const [maxLvl,      setMaxLvl]      = useState(0);
  const [peak,        setPeak]        = useState<Record<string, { lvl: number; deg: number }>>({});
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [modelReady,  setModelReady]  = useState(false);
  const [preparing,   setPreparing]   = useState(true);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("safety");

  // ── Sync overlay mode to WebView ───────────────────────────────────────────
  useEffect(() => {
    webviewRef.current?.injectJavaScript(`window.__mode='${overlayMode}';true;`);
  }, [overlayMode]);

  // ── Orientation ────────────────────────────────────────────────────────────
  async function toggleOrientation() {
    try {
      if (isLandscape) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      else await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    } catch {}
  }
  useEffect(() => () => { ScreenOrientation.unlockAsync().catch(() => {}); }, []);

  // ── Messages from WebView ──────────────────────────────────────────────────
  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "meta" && msg.vw > 0 && msg.vh > 0) {
        setVideoAspect(msg.vw / msg.vh);
        return;
      }
      if (msg.type === "angles") {
        const data = msg.data as JointAngles;
        setAngles(data);
        if (msg.form) setFormRisk(msg.form as RiskMap);
        if (msg.risk) {
          const r = msg.risk as RiskMap;
          setRisk(r);
          // Track the worst risk level seen for each joint over the session
          setPeak((prev) => {
            let changed = false;
            const next = { ...prev };
            (Object.keys(r) as (keyof RiskMap)[]).forEach((k) => {
              const lvl = r[k];
              const deg = data[k];
              if (lvl < 1) return;
              const cur = next[k];
              // Keep the worst level; at the same level keep the most extreme
              // angle so the advice reflects the true peak pattern.
              if (!cur || lvl > cur.lvl || (lvl === cur.lvl && moreExtreme(k, deg, cur.deg))) {
                next[k] = { lvl, deg };
                changed = true;
              }
            });
            return changed ? next : prev;
          });
        }
        setMaxLvl(typeof msg.maxLvl === "number" ? msg.maxLvl : 0);
        if (!modelReady) setModelReady(true);
      }
    } catch {}
  }

  // ── Prepare HTML + video on disk ──────────────────────────────────────────
  // WebView loads from file:// so it gets a real origin (required for the
  // MediaPipe CDN WASM fetch). WKWebView's allowingReadAccessTo covers only
  // the HTML file's directory, so we copy the video into the same folder
  // before rendering.
  const [htmlFileUri, setHtmlFileUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPreparing(true);
    setHtmlFileUri(null);
    // Reset per-video analysis state
    setAngles(null);
    setRisk(null);
    setMaxLvl(0);
    setPeak({});
    setVideoAspect(16 / 9);
    setModelReady(false);

    (async () => {
      try {
        const cacheDir = FileSystem.cacheDirectory ?? "";

        // Resolve a video URI that sits inside cacheDir (same dir as the HTML)
        let resolvedVideo: string | undefined = videoUri;
        if (videoUri) {
          const ext = (videoUri.split(".").pop() ?? "mp4").split(/[?#]/)[0];
          const localVideo = cacheDir + "pose-video." + ext;
          try {
            // copyAsync silently overwrites if dest already exists
            await FileSystem.copyAsync({ from: videoUri, to: localVideo });
            resolvedVideo = localVideo;
          } catch (copyErr) {
            // On Android content:// URIs may not need copying — keep original
            console.warn("Video copy skipped:", copyErr);
          }
        }

        const htmlPath = cacheDir + "pose-tracker.html";
        await FileSystem.writeAsStringAsync(htmlPath, buildHtml(resolvedVideo), {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (!cancelled) setHtmlFileUri(htmlPath);
      } catch (e) {
        console.warn("Pose setup failed:", e);
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [videoUri]);

  // ── Angle display helpers ──────────────────────────────────────────────────
  // Color comes from the WebView's per-joint risk model (green/amber/red).
  const angleCards = angles ? ([
    { label: "L Knee",  deg: angles.leftKnee,   key: "leftKnee"   },
    { label: "R Knee",  deg: angles.rightKnee,  key: "rightKnee"  },
    { label: "L Hip",   deg: angles.leftHip,    key: "leftHip"    },
    { label: "R Hip",   deg: angles.rightHip,   key: "rightHip"   },
    { label: "L Elbow", deg: angles.leftElbow,  key: "leftElbow"  },
    { label: "R Elbow", deg: angles.rightElbow, key: "rightElbow" },
  ] as const) : [];

  // ── Injury-risk summary (worst level seen per joint over the session) ───────
  const insights = Object.entries(peak)
    .filter(([, v]) => v.lvl >= 1)
    .sort((a, b) => b[1].lvl - a[1].lvl)
    .map(([key, v]) => ({ key, lvl: v.lvl, ...jointInsight(key, v.deg) }));

  // ── Form insights: joints currently outside ideal ranges ──────────────────
  const formInsights = angles
    ? (Object.keys(IDEAL_RANGES) as (keyof JointAngles)[])
        .map((k) => ({ k, ins: formInsight(k, angles[k]) }))
        .filter((x): x is { k: keyof JointAngles; ins: NonNullable<ReturnType<typeof formInsight>> } => x.ins !== null)
    : [];

  // ── Status card content driven by overlay mode ────────────────────────────
  const statusCard = (() => {
    if (!modelReady) return null;
    if (overlayMode === "safety") {
      const label = maxLvl === 2 ? "Injury risk detected" : maxLvl === 1 ? "Caution — watch these joints" : "All joints safe";
      const color = RISK_COLORS[maxLvl];
      const icon = maxLvl === 2 ? "alert-triangle" : maxLvl === 1 ? "alert-circle" : "check-circle";
      return { label, color, icon } as const;
    }
    if (overlayMode === "form") {
      const off = formInsights.length;
      const label = off === 0 ? "All joints in ideal range" : `${off} joint${off > 1 ? "s" : ""} outside ideal range`;
      const color = off === 0 ? "#22c55e" : off >= 3 ? "#ef4444" : "#f59e0b";
      const icon = off === 0 ? "check-circle" : "bar-chart-2";
      return { label, color, icon } as const;
    }
    // clean
    const tracked = angleCards.filter((c) => c.deg > 0).length;
    return { label: `${tracked} joints tracked`, color: "#22d3ee", icon: "eye" } as const;
  })();

  // ── Adaptive video height ──────────────────────────────────────────────────
  // Match the WebView height to the video's aspect ratio so portrait, square,
  // and wide clips all display without awkward letterboxing. The internal
  // controls bar (~CTRL_H) sits below the video inside the WebView.
  const CTRL_H = 112;
  // Fit the video to its native aspect; cap tall clips at 62% of the screen and
  // keep a small floor so ultra-wide clips stay usable without forced letterboxing.
  const videoAreaH = Math.max(120, Math.min(screenW / videoAspect, screenH * 0.62));
  const portraitWebH = Math.round(videoAreaH + CTRL_H);

  // Shared video/WebView block — fills the screen in landscape, aspect-fitted
  // height in portrait (so the angle cards below it stay scrollable into view).
  const mediaBlock = preparing ? (
    <View style={[ss.webviewSlot, { height: isLandscape ? undefined : portraitWebH, flex: isLandscape ? 1 : undefined }]}>
      <ActivityIndicator color="#6c63ff" size="large" />
      <Text style={ss.preparingText}>Preparing video…</Text>
    </View>
  ) : htmlFileUri ? (
    <WebView
      ref={webviewRef}
      source={{ uri: htmlFileUri }}
      style={{ flex: isLandscape ? 1 : undefined, height: isLandscape ? undefined : portraitWebH }}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      allowingReadAccessToURL={FileSystem.cacheDirectory ?? "file:///"}
      mixedContentMode="always"
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*", "file://*"]}
      scrollEnabled={false}
      onMessage={handleMessage}
    />
  ) : null;

  return (
    <View style={ss.root}>
      {/* ── Header ── */}
      {!isLandscape && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: "#18182a" }}>
          <View style={[ss.header, { paddingTop: topPad + 8, borderBottomWidth: 0 }]}>
            <TouchableOpacity style={ss.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color="#8888aa" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle} numberOfLines={1}>
                {analysis?.sport ?? "Pose"} · AI Tracking
              </Text>
              {modelReady && (
                <Text style={{ fontSize: 10, color: "#22c55e", fontFamily: "Inter_400Regular" }}>
                  ● MediaPipe active
                </Text>
              )}
            </View>
            <TouchableOpacity style={ss.rotateBtn} onPress={toggleOrientation} activeOpacity={0.8}>
              <Feather name="maximize" size={13} color="#fff" />
              <Text style={ss.rotateBtnText}>Fullscreen</Text>
            </TouchableOpacity>
          </View>

          {/* ── Mode toggle pills ── */}
          <View style={ss.modePills}>
            {OVERLAY_MODES.map(({ mode, label, icon }) => {
              const active = overlayMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[ss.modePill, active && ss.modePillActive]}
                  onPress={() => setOverlayMode(mode)}
                  activeOpacity={0.75}
                >
                  <Feather name={icon} size={12} color={active ? "#fff" : "#8888aa"} />
                  <Text style={[ss.modePillText, { color: active ? "#fff" : "#8888aa" }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Status card ── */}
          {statusCard && (
            <View style={[ss.statusCard, { borderColor: statusCard.color + "44" }]}>
              <Feather name={statusCard.icon} size={13} color={statusCard.color} />
              <Text style={[ss.statusCardText, { color: statusCard.color }]}>{statusCard.label}</Text>
            </View>
          )}
        </View>
      )}

      {isLandscape ? (
        /* ── Landscape: full-bleed video + floating controls ── */
        <>
          {mediaBlock}
          {/* Floating mode pills in landscape */}
          <View style={ss.landscapePills}>
            {OVERLAY_MODES.map(({ mode, label }) => {
              const active = overlayMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[ss.modePill, active && ss.modePillActive, { paddingHorizontal: 10, paddingVertical: 5 }]}
                  onPress={() => setOverlayMode(mode)}
                  activeOpacity={0.75}
                >
                  <Text style={[ss.modePillText, { color: active ? "#fff" : "#8888aa" }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={toggleOrientation} style={ss.portraitBtn} activeOpacity={0.8}>
            <Feather name="smartphone" size={13} color="#fff" />
            <Text style={ss.rotateBtnText}>Portrait</Text>
          </TouchableOpacity>
        </>
      ) : (
        /* ── Portrait: scrollable video + angle cards ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
          showsVerticalScrollIndicator={false}
        >
          {mediaBlock}

          {/* Angle cards */}
          {angleCards.length > 0 && (
            <View style={ss.angleSection}>
              <View style={ss.angleHeaderRow}>
                <Text style={ss.sectionLabel}>LIVE JOINT ANGLES</Text>
                {maxLvl === 2 ? (
                  <View style={[ss.riskPill, { backgroundColor: "#ef444422", borderColor: "#ef444455" }]}>
                    <Feather name="alert-triangle" size={11} color="#ef4444" />
                    <Text style={[ss.riskPillText, { color: "#ef4444" }]}>Injury risk</Text>
                  </View>
                ) : maxLvl === 1 ? (
                  <View style={[ss.riskPill, { backgroundColor: "#f59e0b22", borderColor: "#f59e0b55" }]}>
                    <Feather name="alert-circle" size={11} color="#f59e0b" />
                    <Text style={[ss.riskPillText, { color: "#f59e0b" }]}>Caution</Text>
                  </View>
                ) : (
                  <View style={[ss.riskPill, { backgroundColor: "#22c55e22", borderColor: "#22c55e55" }]}>
                    <Feather name="check-circle" size={11} color="#22c55e" />
                    <Text style={[ss.riskPillText, { color: "#22c55e" }]}>Good form</Text>
                  </View>
                )}
              </View>
              <View style={ss.angleGrid}>
                {angleCards.filter(a => a.deg > 0).map(({ label, deg, key }) => {
                  const lvl = Math.max(0, Math.min(2, risk ? (risk[key] ?? 0) : 0));
                  const c = RISK_COLORS[lvl];
                  return (
                    <View key={label} style={[ss.angleCard, { borderColor: c + "55", backgroundColor: lvl === 2 ? "#ef44440f" : "#0f0f1c" }]}>
                      <Text style={[ss.angleDeg, { color: c }]}>{deg}°</Text>
                      <Text style={ss.angleLabel}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Injury-risk summary + coaching advice */}
          {modelReady && videoUri && overlayMode !== "clean" && (
            <View style={ss.summarySection}>
              {overlayMode === "safety" ? (
                <>
                  <Text style={ss.sectionLabel}>INJURY RISK SUMMARY</Text>
                  {insights.length === 0 ? (
                    <View style={ss.okCard}>
                      <Feather name="check-circle" size={18} color="#22c55e" />
                      <View style={{ flex: 1 }}>
                        <Text style={ss.okTitle}>No injury-risk patterns detected</Text>
                        <Text style={ss.okBody}>Your joint angles stayed within safe ranges so far. Keep playing the clip to analyze the full movement.</Text>
                      </View>
                    </View>
                  ) : (
                    insights.map(({ key, lvl, title, body }) => {
                      const c = RISK_COLORS[lvl];
                      return (
                        <View key={key} style={[ss.insightCard, { borderLeftColor: c }]}>
                          <View style={ss.insightHead}>
                            <Feather name={lvl === 2 ? "alert-triangle" : "alert-circle"} size={14} color={c} />
                            <Text style={[ss.insightTitle, { color: c }]}>{title}</Text>
                            <Text style={[ss.insightTag, { color: c, borderColor: c + "55" }]}>
                              {lvl === 2 ? "RISK" : "CAUTION"}
                            </Text>
                          </View>
                          <Text style={ss.insightBody}>{body}</Text>
                        </View>
                      );
                    })
                  )}
                </>
              ) : (
                <>
                  <Text style={ss.sectionLabel}>FORM ANALYSIS</Text>
                  {formInsights.length === 0 ? (
                    <View style={ss.okCard}>
                      <Feather name="check-circle" size={18} color="#22c55e" />
                      <View style={{ flex: 1 }}>
                        <Text style={ss.okTitle}>All joints within ideal ranges</Text>
                        <Text style={ss.okBody}>Your joint angles are tracking within optimal form ranges. Keep playing to analyze the full movement.</Text>
                      </View>
                    </View>
                  ) : (
                    formInsights.map(({ k, ins }) => {
                      const lvl = formRisk ? Math.max(0, Math.min(2, formRisk[k] ?? 0)) : 1;
                      const c = RISK_COLORS[lvl];
                      return (
                        <View key={k} style={[ss.insightCard, { borderLeftColor: c }]}>
                          <View style={ss.insightHead}>
                            <Feather name="bar-chart-2" size={14} color={c} />
                            <Text style={[ss.insightTitle, { color: c }]}>{ins.title}</Text>
                            <Text style={[ss.insightTag, { color: c, borderColor: c + "55" }]}>FORM</Text>
                          </View>
                          <Text style={ss.insightBody}>{ins.body}</Text>
                        </View>
                      );
                    })
                  )}
                </>
              )}
              <Text style={ss.disclaimer}>
                Automated movement guidance — not a medical diagnosis. Consult a coach or physio for persistent pain.
              </Text>
            </View>
          )}

          {/* No video prompt */}
          {!videoUri && (
            <View style={ss.noVideo}>
              <Feather name="upload" size={28} color="#3a3a5c" />
              <Text style={ss.noVideoText}>Upload a video from the Analysis screen</Text>
              <Text style={ss.noVideoSub}>Tap the Upload button at the top of the Analysis page</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#07070f" },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#18182a", gap: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: "#111118", borderWidth: 1, borderColor: "#18182a", alignItems: "center", justifyContent: "center" },
  headerTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#f0f0f8", textTransform: "capitalize" },
  rotateBtn:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6c63ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  rotateBtnText:{ fontSize: 12, color: "#fff", fontFamily: "Inter_600SemiBold" },
  portraitBtn:  { position: "absolute", top: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6c63ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  angleSection: { paddingHorizontal: 18, paddingTop: 16 },
  angleHeaderRow:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionLabel: { fontSize: 10, color: "#8888aa", fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  riskPill:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  riskPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  angleGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  angleCard:    { width: "30%", flexGrow: 1, backgroundColor: "#0f0f1c", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  angleDeg:     { fontSize: 22, fontFamily: "Inter_700Bold" },
  angleLabel:   { fontSize: 10, color: "#8888aa", fontFamily: "Inter_400Regular", marginTop: 3 },
  noVideo:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  noVideoText:   { fontSize: 14, color: "#4a4a6a", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  noVideoSub:    { fontSize: 12, color: "#3a3a5c", fontFamily: "Inter_400Regular", textAlign: "center" },
  webviewSlot:   { backgroundColor: "#07070f", alignItems: "center", justifyContent: "center", gap: 10 },
  preparingText: { fontSize: 12, color: "#8888aa", fontFamily: "Inter_400Regular" },
  summarySection:{ paddingHorizontal: 18, paddingTop: 22, gap: 10 },
  okCard:        { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#0f1c12", borderWidth: 1, borderColor: "#22c55e33", borderRadius: 14, padding: 14 },
  okTitle:       { fontSize: 13, color: "#d8f5e0", fontFamily: "Inter_600SemiBold" },
  okBody:        { fontSize: 12, color: "#7a9a82", fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  insightCard:    { backgroundColor: "#0f0f1c", borderRadius: 12, borderLeftWidth: 3, padding: 14, gap: 7 },
  insightHead:    { flexDirection: "row", alignItems: "center", gap: 7 },
  insightTitle:   { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  insightTag:     { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" },
  insightBody:    { fontSize: 12, color: "#a0a0bc", fontFamily: "Inter_400Regular", lineHeight: 18 },
  disclaimer:     { fontSize: 10, color: "#55556e", fontFamily: "Inter_400Regular", lineHeight: 14, marginTop: 4, fontStyle: "italic" },
  modePills:      { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
  modePill:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1c1c2e", borderWidth: 1, borderColor: "#2a2a3c" },
  modePillActive: { backgroundColor: "#6c63ff", borderColor: "#6c63ff" },
  modePillText:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statusCard:     { flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#0f0f1c", borderWidth: 1 },
  statusCardText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  landscapePills: { position: "absolute", top: 14, left: 14, flexDirection: "row", gap: 6 },
});
