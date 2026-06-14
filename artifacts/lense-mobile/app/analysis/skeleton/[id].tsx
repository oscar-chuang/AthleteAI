import React, { useRef, useState, useEffect, useMemo } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyses as analysesApi, type TipRecord } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────
type JointKey = "leftKnee" | "rightKnee" | "leftHip" | "rightHip" | "leftElbow" | "rightElbow";
type RiskMap = Record<JointKey, number>;
type AngleMap = Record<JointKey, number>;

const RISK_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

function moreExtreme(key: string, a: number, b: number): boolean {
  if (key.includes("Knee")) return Math.abs(a - 130) > Math.abs(b - 130);
  if (key.includes("Hip")) return a < b;
  return a > b;
}

// ─── Research-backed sport thresholds ────────────────────────────────────────
// Each entry: [kneeLoRisk, kneeLoWarn, kneeHiWarn, kneeHiRisk,
//              hipLoRisk,  hipLoWarn,  hipHiWarn,  hipHiRisk,
//              elbowLoRisk, elbowLoWarn, elbowHiWarn, elbowHiRisk]
//
// Sources:
//  - Escamilla et al. (2001) J Sports Sci — squat knee biomechanics
//  - Schoenfeld (2010) J Strength Cond Res — deep squat patellar tendon
//  - Hales et al. (2009) JSCR — powerlifting spine neutral (hip >45°)
//  - Heiderscheit et al. (2011) JOSPT — running gait & overuse injury
//  - Novacheck (1998) Gait & Posture — running biomechanics review
//  - Hewett et al. (2005) Am J Sports Med — ACL risk, knee valgus/stiff landing
//  - Decker et al. (2003) J Athl Train — basketball landing mechanics
//  - Norkin & White (2009) Measurement of Joint Motion — normal ROM
const SPORT_THRESHOLD_DB: Record<string, number[]> = {
  // [kneeLoRisk, kneeLoWarn, kneeHiWarn, kneeHiRisk, hipLoRisk, hipLoWarn, hipHiWarn, hipHiRisk, elbLoRisk, elbLoWarn, elbHiWarn, elbHiRisk]
  weightlifting: [58, 72, 155, 172,  38, 50, 999, 999,  -1, -1, 158, 170],
  powerlifting:  [58, 72, 155, 172,  38, 50, 999, 999,  -1, -1, 158, 170],
  crossfit:      [60, 75, 158, 172,  40, 55, 999, 999,  -1, -1, 158, 170],
  running:       [128,145, 174, 178, 145,158, 188, 198,  -1, -1, 999, 999],
  basketball:    [88, 108, 158, 168,  40, 55, 999, 999,  -1, -1, 999, 999],
  soccer:        [88, 108, 162, 174,  40, 55, 999, 999,  -1, -1, 999, 999],
  football:      [75,  90, 160, 172,  40, 55, 999, 999,  -1, -1, 999, 999],
  volleyball:    [90, 110, 158, 168,  42, 57, 999, 999,  -1, -1, 999, 999],
  tennis:        [98, 118, 162, 172,  44, 59, 999, 999,  -1, -1, 162, 172],
  baseball:      [90, 110, 162, 172,  42, 57, 999, 999,  -1, -1, 162, 172],
  swimming:      [100,120, 172, 178,  44, 59, 999, 999,  -1, -1, 158, 170],
  gymnastics:    [55,  68, 175, 180,  35, 45, 999, 999,  -1, -1, 172, 180],
  cycling:       [68,  80, 152, 163,  44, 57, 999, 999,  -1, -1, 152, 165],
  fencing:       [78,  92, 165, 174,  38, 52, 999, 999,  -1, -1, 155, 168],
  hockey:        [82, 100, 162, 172,  40, 55, 999, 999,  -1, -1, 999, 999],
  lacrosse:      [88, 108, 162, 172,  42, 57, 999, 999,  -1, -1, 162, 172],
  rugby:         [78,  95, 162, 172,  40, 55, 999, 999,  -1, -1, 999, 999],
  rowing:        [75,  90, 162, 172,  38, 52, 999, 999,  -1, -1, 155, 168],
  boxing:        [85, 105, 160, 170,  40, 55, 999, 999,  -1, -1, 145, 160],
  wrestling:     [70,  85, 158, 170,  38, 52, 999, 999,  -1, -1, 148, 162],
  badminton:     [80, 100, 162, 172,  40, 55, 999, 999,  -1, -1, 155, 168],
  golf:          [95, 115, 162, 172,  42, 57, 999, 999,  -1, -1, 155, 168],
  skiing:        [65,  80, 158, 170,  38, 52, 999, 999,  -1, -1, 999, 999],
  default:       [65,  80, 165, 175,  40, 55, 999, 999,  -1, -1, 158, 170],
};

// ─── HTML builder ─────────────────────────────────────────────────────────────
interface InitCrop { nx: number; ny: number; nw: number; nh: number; }

function buildHtml(videoUri: string | undefined, sport: string, initCrop?: InitCrop | null): string {
  const MEDIAPIPE_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";
  const thresholds = SPORT_THRESHOLD_DB[sport.toLowerCase()] ?? SPORT_THRESHOLD_DB.default;
  const [knLR, knLW, knHW, knHR, hipLR, hipLW, hipHW, hipHR, elbLR, elbLW, elbHW, elbHR] = thresholds;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;background:#07070f;font-family:-apple-system,sans-serif;color:#f0f0f8}
#wrap{position:relative;width:100%;background:#000}
video,canvas{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain}
canvas{pointer-events:none}
#badge{position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:6px;
  background:rgba(4,4,12,.88);border:1px solid rgba(34,211,238,.30);
  border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;color:#22d3ee}
#dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex-shrink:0}
#empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:10px;color:#3a3a5c;font-size:13px}
#loading{position:fixed;inset:0;z-index:99;background:rgba(4,4,12,.92);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
#loading.hide{display:none}
.spin{width:38px;height:38px;border:3px solid #6c63ff33;border-top-color:#6c63ff;
  border-radius:50%;animation:sp .75s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.load-text{font-size:14px;font-weight:600}
.load-sub{font-size:11px;color:#8888aa}
#ctrl{position:fixed;bottom:0;left:0;right:0;background:rgba(4,4,12,.96);
  padding:10px 14px 14px;display:flex;flex-direction:column;gap:8px}
.row{display:flex;align-items:center;gap:8px}
#timeL,#timeR{font-size:11px;color:#8888aa;font-variant-numeric:tabular-nums;min-width:32px}
#timeR{text-align:right}
#scrub{flex:1;height:4px;accent-color:#6c63ff;cursor:pointer}
.tbtn{background:#1c1c2e;border:none;border-radius:10px;color:#e0e0f0;
  display:flex;align-items:center;justify-content:center;cursor:pointer}
#playBtn{width:42px;height:42px;background:#6c63ff;border-radius:13px;
  box-shadow:0 0 18px #6c63ff77}
.step{width:34px;height:34px;font-size:16px}
#speeds{display:flex;gap:2px;background:#1c1c2e;padding:4px;border-radius:10px}
.spd{border:none;background:transparent;color:#8888aa;font-size:11px;font-weight:700;
  padding:4px 8px;border-radius:7px;cursor:pointer;transition:all .15s}
.spd.on{background:#6c63ff;color:#fff}
#skelBtn,#personBtn{padding:6px 13px;font-size:12px;font-weight:700;border-radius:9px;
  cursor:pointer;border:1px solid transparent;transition:all .15s;white-space:nowrap;flex:1}
#skelBtn.on{background:rgba(34,211,238,.12);color:#22d3ee;border-color:rgba(34,211,238,.28)}
#skelBtn.off{background:#1c1c2e;color:#8888aa}
#legend{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:5px;
  background:rgba(4,4,12,.82);border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:8px 11px}
.lg{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:700;color:#c0c0d0;letter-spacing:.3px}
.ld{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.p-off{background:#1c1c2e;color:#8888aa}
.p-sel{background:rgba(251,191,36,.18);color:#fbbf24;border-color:rgba(251,191,36,.5);
  animation:pls .9s ease-in-out infinite}
@keyframes pls{0%,100%{opacity:1}50%{opacity:.55}}
.p-lock{background:rgba(251,191,36,.1);color:#fbbf24;border-color:rgba(251,191,36,.35)}
#selHint{position:absolute;top:14px;left:50%;transform:translateX(-50%);
  background:rgba(4,4,12,.9);border:1px solid rgba(251,191,36,.45);border-radius:12px;
  padding:9px 18px;text-align:center;pointer-events:none;display:none;z-index:10;
  white-space:nowrap}
#selHint p{font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:2px}
#selHint small{font-size:10px;color:#8888aa}
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
       </div>
       <div id="selHint"><p id="shTitle">Detecting people…</p><small id="shSub">First use downloads ~3 MB</small></div>`
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
  <!-- Row 1: scrubber -->
  <div class="row">
    <span id="timeL">0:00</span>
    <input id="scrub" type="range" min="0" max="100" step="0.1" value="0">
    <span id="timeR">0:00</span>
  </div>
  <!-- Row 2: playback controls + speed -->
  <div class="row" style="justify-content:space-between">
    <div class="row" style="gap:6px">
      <button class="tbtn step" id="bk">&#8249;&#8249;</button>
      <button class="tbtn" id="playBtn">&#9654;</button>
      <button class="tbtn step" id="fw">&#8250;&#8250;</button>
    </div>
    <div id="speeds">
      <button class="spd" data-s="0.1">0.1×</button>
      <button class="spd" data-s="0.25">0.25×</button>
      <button class="spd" data-s="0.5">0.5×</button>
      <button class="spd on" data-s="1">1×</button>
    </div>
  </div>
  <!-- Row 3: utility buttons — always visible on own row -->
  <div class="row" style="gap:8px">
    <button class="tbtn on" id="skelBtn">Skeleton</button>
    <button class="tbtn p-off" id="personBtn">Select Person</button>
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
  if(!VIDEO_URI){
    document.getElementById("loading").classList.add("hide");
    return;
  }

  // ── Research-backed thresholds for ${sport || "this sport"} ──
  // lvl(angle, loRisk, loWarn, hiWarn, hiRisk) → 0=safe 1=caution 2=risk
  const KN = [${knLR}, ${knLW}, ${knHW}, ${knHR}];
  const HIP= [${hipLR}, ${hipLW}, ${hipHW}, ${hipHR}];
  const ELB= [${elbLR}, ${elbLW}, ${elbHW}, ${elbHR}];

  function lvl(a, lR, lW, hW, hR){
    if(lR >= 0 && a <= lR) return 2;
    if(hR <= 998 && a >= hR) return 2;
    if(lW >= 0 && a <= lW) return 1;
    if(hW <= 998 && a >= hW) return 1;
    return 0;
  }

  const video     = document.getElementById("v");
  const canvas    = document.getElementById("c");
  const ctx       = canvas.getContext("2d");
  const loading   = document.getElementById("loading");
  const btxt      = document.getElementById("btxt");
  const scrub     = document.getElementById("scrub");
  const timeL     = document.getElementById("timeL");
  const timeR     = document.getElementById("timeR");
  const playBtn   = document.getElementById("playBtn");
  const skelBtn   = document.getElementById("skelBtn");
  const personBtn = document.getElementById("personBtn");
  const selHint   = document.getElementById("selHint");
  const wrap      = document.getElementById("wrap");

  let busy=false, playing=false, showSkel=true;
  let worstScore=0, worstSeenTime=0, worstJr={}, worstFrameB64="";

  // ── Person-select state ────────────────────────────────────────────────────
  // Strategy: lazy-load COCO-SSD on first tap of "Select Person".
  // It detects every person in the current frame and draws a colored glow-box
  // around each one. User taps a box → that person's bbox becomes the crop
  // region sent to MediaPipe on every frame. Landmarks are remapped back to
  // full-frame coords so the skeleton overlays correctly.
  const BOX_COLORS=['#a78bfa','#22d3ee','#f59e0b','#22c55e','#f43f5e'];
  const INIT_CROP=${initCrop ? JSON.stringify(initCrop) : "null"};
  let selectMode=false;
  let personLocked=INIT_CROP!=null;
  let focusNX=INIT_CROP?INIT_CROP.nx+INIT_CROP.nw/2:0.5;
  let focusNY=INIT_CROP?INIT_CROP.ny+INIT_CROP.nh/2:0.5;
  let cropHalfX=INIT_CROP?INIT_CROP.nw/2:0.38;
  let cropHalfY=INIT_CROP?INIT_CROP.nh/2:0.38;
  let cropX0=0, cropY0=0, cropW=0, cropH=0;
  let lockedColor='#fbbf24';
  let detectedBoxes=[];  // [{x,y,w,h,color}] in video-pixel space
  let cocoModel=null, tfLoaded=false;

  const offCanvas=document.createElement("canvas");
  const offCtx=offCanvas.getContext("2d");

  function computeCrop(W,H){
    const halfW=cropHalfX*W, halfH=cropHalfY*H;
    cropX0=Math.max(0,focusNX*W-halfW);
    cropY0=Math.max(0,focusNY*H-halfH);
    const x1=Math.min(W,focusNX*W+halfW);
    const y1=Math.min(H,focusNY*H+halfH);
    cropW=x1-cropX0; cropH=y1-cropY0;
  }

  function remapLm(lm,W,H){
    if(!personLocked||cropW===0)return lm;
    return lm.map(p=>({...p,x:(p.x*cropW+cropX0)/W,y:(p.y*cropH+cropY0)/H}));
  }

  // Lazy-load TF.js + COCO-SSD scripts only when needed
  function loadScript(src){
    return new Promise((res,rej)=>{
      const s=document.createElement("script");
      s.src=src; s.crossOrigin="anonymous";
      s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
  }
  async function ensureTf(){
    if(tfLoaded)return true;
    try{
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
      tfLoaded=true; return true;
    }catch(e){return false;}
  }

  // Map a clientX/Y click to video-pixel coordinates (handles letterboxing)
  function clickToVideoXY(cx,cy){
    const wRect=wrap.getBoundingClientRect();
    const vAR=(video.videoWidth||640)/(video.videoHeight||360);
    const cAR=wRect.width/wRect.height;
    let vLeft,vTop,vWidth,vHeight;
    if(vAR>cAR){
      vWidth=wRect.width; vHeight=wRect.width/vAR;
      vLeft=0; vTop=(wRect.height-vHeight)/2;
    } else {
      vHeight=wRect.height; vWidth=wRect.height*vAR;
      vLeft=(wRect.width-vWidth)/2; vTop=0;
    }
    return {
      vx:((cx-wRect.left-vLeft)/vWidth)*(video.videoWidth||640),
      vy:((cy-wRect.top -vTop )/vHeight)*(video.videoHeight||360)
    };
  }

  // Draw colored glow boxes for detected people during select mode
  function drawDetectionBoxes(){
    const W=video.videoWidth||640,H=video.videoHeight||360;
    canvas.width=W; canvas.height=H;
    ctx.clearRect(0,0,W,H);
    detectedBoxes.forEach((b,i)=>{
      ctx.save();
      ctx.shadowBlur=22; ctx.shadowColor=b.color;
      ctx.strokeStyle=b.color; ctx.lineWidth=3.5;
      ctx.globalAlpha=0.92;
      ctx.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);
      // label pill
      ctx.globalAlpha=1;
      ctx.fillStyle=b.color;
      const label="Person "+(i+1);
      ctx.font="bold 13px -apple-system,sans-serif";
      const lw=ctx.measureText(label).width+18;
      ctx.beginPath(); ctx.roundRect(b.x,b.y-30,lw,26,5); ctx.fill();
      ctx.fillStyle="#07070f"; ctx.textBaseline="middle";
      ctx.fillText(label,b.x+9,b.y-17);
      ctx.restore();
    });
    if(detectedBoxes.length===0){
      ctx.save();
      ctx.font="bold 13px -apple-system,sans-serif";
      ctx.fillStyle="rgba(251,191,36,.9)"; ctx.textAlign="center";
      ctx.fillText("No people found — tap anywhere to set focus",W/2,H/2);
      ctx.restore();
    }
  }

  // Run COCO-SSD on the current video frame and show person outlines
  async function runPersonDetection(){
    document.getElementById("shTitle").textContent="Detecting people…";
    document.getElementById("shSub").textContent="First use ~3 MB download";
    selHint.style.display="block";
    const ok=await ensureTf();
    if(!ok){
      // TF.js failed to load — fall back to free-tap mode
      document.getElementById("shTitle").textContent="Tap person to track";
      document.getElementById("shSub").textContent="";
      detectedBoxes=[];
      drawDetectionBoxes();
      return;
    }
    try{
      if(!cocoModel) cocoModel=await cocoSsd.load({base:"lite_mobilenet_v2"});
      // Snapshot current frame for detection
      const snap=document.createElement("canvas");
      snap.width=video.videoWidth||640; snap.height=video.videoHeight||360;
      snap.getContext("2d").drawImage(video,0,0,snap.width,snap.height);
      const preds=await cocoModel.detect(snap);
      detectedBoxes=preds
        .filter(p=>p.class==="person"&&p.score>0.35)
        .map((p,i)=>({x:p.bbox[0],y:p.bbox[1],w:p.bbox[2],h:p.bbox[3],color:BOX_COLORS[i%BOX_COLORS.length]}));
      drawDetectionBoxes();
      if(detectedBoxes.length>0){
        document.getElementById("shTitle").textContent="Tap a person";
        document.getElementById("shSub").textContent=detectedBoxes.length+" detected";
      } else {
        document.getElementById("shTitle").textContent="Tap anywhere to focus";
        document.getElementById("shSub").textContent="No people auto-detected";
      }
    }catch(e){
      detectedBoxes=[];
      drawDetectionBoxes();
      document.getElementById("shTitle").textContent="Tap person to track";
      document.getElementById("shSub").textContent="";
    }
  }

  function cancelSelect(){
    selectMode=false;
    detectedBoxes=[];
    wrap.style.cursor="default";
    selHint.style.display="none";
    personBtn.textContent="Select Person";
    personBtn.className="tbtn p-off";
    personBtn.style.color="";
    personBtn.style.borderColor="";
  }

  // ── Auto-scan ──────────────────────────────────────────────────────────────
  let scanning=false, scanPos=0;
  const SCAN_STEP=0.5;

  function startScan(){
    if(scanning||playing||!video.duration)return;
    worstScore=0; worstSeenTime=0;
    scanning=true; scanPos=0; video.currentTime=0;
  }

  function postScanComplete(){
    if(worstSeenTime<=0)return;
    const angles={leftKnee:worstJr[25]?.deg,rightKnee:worstJr[26]?.deg,leftHip:worstJr[23]?.deg,rightHip:worstJr[24]?.deg,leftElbow:worstJr[13]?.deg,rightElbow:worstJr[14]?.deg};
    const risks={leftKnee:worstJr[25]?.lvl??0,rightKnee:worstJr[26]?.lvl??0,leftHip:worstJr[23]?.lvl??0,rightHip:worstJr[24]?.lvl??0,leftElbow:worstJr[13]?.lvl??0,rightElbow:worstJr[14]?.lvl??0};
    try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"scanComplete",time:worstSeenTime,score:worstScore,angles,risks,frame:worstFrameB64}));}catch(e){}
  }

  function advanceScan(){
    scanPos+=SCAN_STEP;
    if(!video.duration||scanPos>video.duration){
      scanning=false;
      postScanComplete();
      video.currentTime=0;
      return;
    }
    video.currentTime=scanPos;
  }

  function fmt(t){const s=Math.floor(t);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}

  function sizeWrap(){
    const ctrlH=document.getElementById("ctrl")?.offsetHeight||110;
    wrap.style.height=(window.innerHeight-ctrlH)+"px";
  }
  window.addEventListener("resize",sizeWrap);

  const CONN=[[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[15,17],[15,19],[17,19],[12,14],[14,16],[16,18],[16,20],[18,20],[23,25],[25,27],[27,29],[27,31],[29,31],[24,26],[26,28],[28,30],[28,32],[30,32]];
  const LI=new Set([11,13,15,17,19,21,23,25,27,29,31]);
  const RI=new Set([12,14,16,18,20,22,24,26,28,30,32]);
  const KJ=[0,11,12,13,14,15,16,23,24,25,26,27,28];

  function ang(a,b,c){
    const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
    return Math.round(Math.atan2(Math.abs(ab.x*cb.y-ab.y*cb.x),ab.x*cb.x+ab.y*cb.y)*180/Math.PI);
  }

  const RL=["#22c55e","#f59e0b","#ef4444"];

  function onResults(res){
    busy=false;
    // If still in select mode, don't overwrite the detection boxes canvas
    if(selectMode)return;
    const W=video.videoWidth||640,H=video.videoHeight||360;
    const rawLm=res.poseLandmarks;
    const lm=rawLm?remapLm(rawLm,W,H):null;

    // ── Dynamic tracking: shift the crop window to follow the person ──────
    // After each frame MediaPipe returns landmarks already in full-frame
    // normalised space (0-1). We compute the torso center and use an
    // exponential moving average to smoothly chase the person.
    if(personLocked&&lm){
      const tj=[11,12,23,24]; // shoulders + hips
      let sx=0,sy=0,n=0;
      tj.forEach(i=>{if((lm[i]?.visibility||0)>0.35){sx+=lm[i].x;sy+=lm[i].y;n++;}});
      // Fall back to any visible joint if torso not visible
      if(!n) lm.forEach(p=>{if((p.visibility||0)>0.35){sx+=p.x;sy+=p.y;n++;}});
      if(n){
        // 55/45 EMA: responsive enough to track fast movement, smooth enough to avoid jitter
        focusNX=focusNX*0.55+(sx/n)*0.45;
        focusNY=focusNY*0.55+(sy/n)*0.45;
      }
    }

    // ── Phase 1: always compute joint risks ───────────────────────────────
    const jr={};
    if(lm){
      const v=i=>(lm[i]?.visibility||0)>0.35;
      const p=i=>({x:lm[i].x*W,y:lm[i].y*H});
      if(v(23)&&v(25)&&v(27)){const a=ang(p(23),p(25),p(27));jr[25]={deg:a,lvl:lvl(a,...KN)};}
      if(v(24)&&v(26)&&v(28)){const a=ang(p(24),p(26),p(28));jr[26]={deg:a,lvl:lvl(a,...KN)};}
      if(v(11)&&v(23)&&v(25)){const a=ang(p(11),p(23),p(25));jr[23]={deg:a,lvl:lvl(a,...HIP)};}
      if(v(12)&&v(24)&&v(26)){const a=ang(p(12),p(24),p(26));jr[24]={deg:a,lvl:lvl(a,...HIP)};}
      if(v(11)&&v(13)&&v(15)){const a=ang(p(11),p(13),p(15));jr[13]={deg:a,lvl:lvl(a,...ELB)};}
      if(v(12)&&v(14)&&v(16)){const a=ang(p(12),p(14),p(16));jr[14]={deg:a,lvl:lvl(a,...ELB)};}
    }
    let maxLvl=0;Object.keys(jr).forEach(k=>{if(jr[k].lvl>maxLvl)maxLvl=jr[k].lvl;});

    // ── Phase 2: track worst frame ─────────────────────────────────────────
    const frameScore=Object.values(jr).reduce((s,j)=>s+(j.lvl===2?3:j.lvl===1?1:0),0);
    if(frameScore>0&&frameScore>worstScore){
      worstScore=frameScore; worstSeenTime=video.currentTime;
      worstJr=Object.assign({},jr);
      // Capture this frame so Claude can see the actual movement
      try{
        const fsnap=document.createElement('canvas');
        fsnap.width=Math.min(W,640); fsnap.height=Math.min(H,360);
        fsnap.getContext('2d').drawImage(video,0,0,fsnap.width,fsnap.height);
        worstFrameB64=fsnap.toDataURL('image/jpeg',0.45);
      }catch(e){}
      if(!scanning){
        try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"worst",time:worstSeenTime,score:worstScore}));}catch(e){}
      }
    }

    // ── Phase 3: if scanning, advance — no drawing ─────────────────────────
    if(scanning){advanceScan();return;}

    // ── Phase 4: draw skeleton ─────────────────────────────────────────────
    canvas.width=W; canvas.height=H;
    ctx.clearRect(0,0,W,H);
    if(!lm||!showSkel)return;
    const v2=i=>(lm[i]?.visibility||0)>0.35;
    const p2=i=>({x:lm[i].x*W,y:lm[i].y*H});

    CONN.forEach(([a,b])=>{
      if(!v2(a)||!v2(b))return;
      const pA=p2(a),pB=p2(b);
      const rm=Math.max(jr[a]?jr[a].lvl:-1,jr[b]?jr[b].lvl:-1);
      const col=rm>=1?RL[rm]:LI.has(a)&&LI.has(b)?"#22d3ee":RI.has(a)&&RI.has(b)?"#a78bfa":"rgba(255,255,255,.5)";
      ctx.save();
      ctx.strokeStyle=col;ctx.lineWidth=rm>=1?4.5:3.5;ctx.lineCap="round";
      ctx.shadowBlur=rm>=2?17:10;ctx.shadowColor=col;ctx.globalAlpha=.92;
      ctx.beginPath();ctx.moveTo(pA.x,pA.y);ctx.lineTo(pB.x,pB.y);ctx.stroke();
      ctx.restore();
    });

    let seen=0;
    KJ.forEach(i=>{
      if(!v2(i))return;seen++;
      const pt=p2(i);
      const risk=jr[i];
      const col=risk?RL[risk.lvl]:(LI.has(i)?"#22d3ee":RI.has(i)?"#a78bfa":"#fff");
      const r=risk&&risk.lvl===2?9:risk&&risk.lvl===1?7.5:6.5;
      ctx.save();
      if(risk&&risk.lvl===2){
        ctx.strokeStyle=col;ctx.globalAlpha=.45;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(pt.x,pt.y,r+5,0,Math.PI*2);ctx.stroke();
        ctx.globalAlpha=1;
      }
      ctx.shadowBlur=risk&&risk.lvl===2?18:14;ctx.shadowColor=col;
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#07070f";ctx.beginPath();ctx.arc(pt.x,pt.y,3,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
    btxt.textContent=seen>0?seen+" joints tracked":"Pose active";

    if(maxLvl===2){
      ctx.save();
      ctx.font="bold 16px -apple-system,sans-serif";
      const t="\u26A0 INJURY RISK";
      const w=ctx.measureText(t).width+26;
      ctx.fillStyle="rgba(239,68,68,.92)";
      ctx.beginPath();ctx.roundRect(W/2-w/2,12,w,32,9);ctx.fill();
      ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(t,W/2,29);
      ctx.restore();
    }

    // ── Locked-person crop indicator ───────────────────────────────────────
    if(personLocked){
      ctx.save();
      ctx.strokeStyle=lockedColor+"b3";
      ctx.lineWidth=2; ctx.setLineDash([8,4]);
      ctx.shadowBlur=10; ctx.shadowColor=lockedColor+"66";
      ctx.strokeRect(cropX0+3,cropY0+3,cropW-6,cropH-6);
      ctx.setLineDash([]);
      ctx.font="bold 10px -apple-system,sans-serif";
      ctx.fillStyle=lockedColor+"dd";
      ctx.fillText("TRACKING",cropX0+10,cropY0+18);
      ctx.restore();
    }

    if(Object.keys(jr).length){
      try{
        window.ReactNativeWebView.postMessage(JSON.stringify({type:"angles",
          data:{leftKnee:jr[25]?jr[25].deg:0,rightKnee:jr[26]?jr[26].deg:0,leftHip:jr[23]?jr[23].deg:0,rightHip:jr[24]?jr[24].deg:0,leftElbow:jr[13]?jr[13].deg:0,rightElbow:jr[14]?jr[14].deg:0},
          risk:{leftKnee:jr[25]?jr[25].lvl:0,rightKnee:jr[26]?jr[26].lvl:0,leftHip:jr[23]?jr[23].lvl:0,rightHip:jr[24]?jr[24].lvl:0,leftElbow:jr[13]?jr[13].lvl:0,rightElbow:jr[14]?jr[14].lvl:0},
          maxLvl}));
      }catch(e){}
    }
  }

  // Gate scan start on BOTH video loaded AND pose model ready
  let videoDataReady=false, poseModelReady=false;
  function maybeScan(){
    if(!videoDataReady||!poseModelReady||scanning||playing)return;
    setTimeout(()=>{if(!scanning&&!playing&&video.duration)startScan();},200);
  }

  const BASE="${MEDIAPIPE_BASE}";
  const pose=new Pose({locateFile:f=>BASE+"/"+f});
  pose.setOptions({modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.5,minTrackingConfidence:.5});
  pose.onResults(onResults);
  pose.initialize().then(()=>{
    poseModelReady=true;
    loading.classList.add("hide");
    sizeWrap();
    maybeScan();
  }).catch(()=>loading.classList.add("hide"));

  function detect(){
    if(busy||!video.readyState)return;
    busy=true;
    const W=video.videoWidth||640,H=video.videoHeight||360;
    if(personLocked){
      computeCrop(W,H);
      offCanvas.width=cropW; offCanvas.height=cropH;
      offCtx.drawImage(video,cropX0,cropY0,cropW,cropH,0,0,cropW,cropH);
      pose.send({image:offCanvas}).catch(()=>{busy=false;});
    } else {
      cropX0=0; cropY0=0; cropW=W; cropH=H;
      pose.send({image:video}).catch(()=>{busy=false;});
    }
  }

  let raf=0;
  function loop(){if(!playing||video.paused||video.ended)return;detect();raf=requestAnimationFrame(loop);}

  video.src=VIDEO_URI;
  video.load();
  video.addEventListener("loadedmetadata",()=>{
    scrub.max=video.duration;
    timeR.textContent=fmt(video.duration);
    sizeWrap();
    try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"meta",vw:video.videoWidth,vh:video.videoHeight,dur:video.duration}));}catch(e){}
  });
  video.addEventListener("loadeddata",()=>{videoDataReady=true;maybeScan();});
  video.addEventListener("seeked",()=>{if(!selectMode)detect();});
  let prevVideoTime=0;
  video.addEventListener("timeupdate",()=>{
    const ct=video.currentTime;
    // Detect video loop (was near end, jumped back to near 0) and reset crop to initial selection
    if(personLocked&&INIT_CROP&&prevVideoTime>(video.duration||999)*0.7&&ct<0.5){
      focusNX=INIT_CROP.nx+INIT_CROP.nw/2;
      focusNY=INIT_CROP.ny+INIT_CROP.nh/2;
      cropHalfX=INIT_CROP.nw/2;
      cropHalfY=INIT_CROP.nh/2;
    }
    prevVideoTime=ct;
    timeL.textContent=fmt(ct);
    scrub.value=ct;
  });
  video.addEventListener("ended",()=>{playing=false;playBtn.textContent="&#9654;";cancelAnimationFrame(raf);});

  function play(){
    if(selectMode)cancelSelect();
    if(scanning){
      scanning=false;
      postScanComplete();
    }
    video.play();playing=true;playBtn.textContent="II";loop();
  }
  function pause(){video.pause();playing=false;playBtn.textContent="&#9654;";cancelAnimationFrame(raf);}

  window.__seekTo=function(t){pause();video.currentTime=Math.max(0,Math.min(t,video.duration||t));};

  // ── Tap handler: either lock onto a detected person or free-tap ───────────
  wrap.addEventListener("click",function(e){
    if(!selectMode)return;
    e.stopPropagation();
    const {vx,vy}=clickToVideoXY(e.clientX,e.clientY);
    const W=video.videoWidth||640,H=video.videoHeight||360;

    // Check if tap hit a detected person box
    const hit=detectedBoxes.find(b=>vx>=b.x&&vx<=b.x+b.w&&vy>=b.y&&vy<=b.y+b.h);

    if(hit){
      // Use the detected bounding box — crop is proportional to person size (+20% margin)
      focusNX=(hit.x+hit.w/2)/W;
      focusNY=(hit.y+hit.h/2)/H;
      cropHalfX=Math.min(0.55,(hit.w/2/W)*1.25);
      cropHalfY=Math.min(0.55,(hit.h/2/H)*1.25);
      lockedColor=hit.color;
    } else if(detectedBoxes.length===0){
      // No detection — free-tap fallback
      focusNX=Math.max(0.28,Math.min(0.72,vx/W));
      focusNY=Math.max(0.28,Math.min(0.72,vy/H));
      cropHalfX=0.38; cropHalfY=0.38;
      lockedColor='#fbbf24';
    } else {
      // Tap missed all boxes — ignore
      return;
    }

    personLocked=true;
    selectMode=false;
    detectedBoxes=[];
    wrap.style.cursor="default";
    selHint.style.display="none";
    personBtn.textContent="Locked";
    personBtn.className="tbtn p-lock";
    personBtn.style.color=lockedColor;
    personBtn.style.borderColor=lockedColor+"55";

    if(!playing){setTimeout(()=>{if(!scanning)startScan();},100);}
    setTimeout(detect,50);
  });

  // ── Person button ──────────────────────────────────────────────────────────
  personBtn.onclick=()=>{
    if(personLocked){
      personLocked=false; cropHalfX=0.38; cropHalfY=0.38;
      cancelSelect();
    } else if(selectMode){
      cancelSelect();
    } else {
      if(playing)pause();
      selectMode=true;
      personBtn.textContent="✕ Cancel";
      personBtn.className="tbtn p-sel";
      personBtn.style.color=""; personBtn.style.borderColor="";
      runPersonDetection();
    }
  };

  playBtn.onclick=()=>playing?pause():play();
  document.getElementById("bk").onclick=()=>{pause();video.currentTime=Math.max(0,video.currentTime-1/30);};
  document.getElementById("fw").onclick=()=>{pause();video.currentTime=Math.min(video.duration||99,video.currentTime+1/30);};
  scrub.addEventListener("input",e=>{video.currentTime=parseFloat(e.target.value);if(!selectMode)setTimeout(detect,40);});
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
  const { id, nx: initNx, ny: initNy, nw: initNw, nh: initNh } = useLocalSearchParams<{
    id: string; nx?: string; ny?: string; nw?: string; nh?: string;
  }>();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const webviewRef = useRef<WebView>(null);

  const [videoUri, setVideoUri]   = useState<string | undefined>();
  const [sport, setSport]         = useState("");
  const [tips, setTips]           = useState<TipRecord[]>([]);
  const [showSources, setShowSources] = useState(false);

  const [risk,        setRisk]        = useState<RiskMap | null>(null);
  const [maxLvl,      setMaxLvl]      = useState(0);
  const [peak,        setPeak]        = useState<Record<string, { lvl: number; deg: number }>>({});
  const [worstTime,   setWorstTime]   = useState<number | null>(null);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [modelReady,  setModelReady]  = useState(false);
  const [preparing,   setPreparing]   = useState(true);
  const [htmlFileUri, setHtmlFileUri] = useState<string | null>(null);

  const isLandscape = screenW > screenH;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Load analysis data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`video_uri_${id}`).then((uri) => { if (uri) setVideoUri(uri); });
    analysesApi.get(id).then(({ analysis, tips: t }) => {
      setSport(analysis.sport ?? "");
      setTips(t ?? []);
    }).catch(() => {});
  }, [id]);

  // ── Orientation ─────────────────────────────────────────────────────────────
  async function toggleOrientation() {
    try {
      if (isLandscape) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      else await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    } catch {}
  }
  useEffect(() => () => { ScreenOrientation.unlockAsync().catch(() => {}); }, []);

  // ── Messages from WebView ───────────────────────────────────────────────────
  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "meta" && msg.vw > 0 && msg.vh > 0) {
        setVideoAspect(msg.vw / msg.vh);
        return;
      }
      if (msg.type === "worst") {
        setWorstTime(msg.time as number);
        return;
      }
      if (msg.type === "scanComplete") {
        setWorstTime(msg.time as number);
        if (id && msg.angles) {
          analysesApi.update(id, {
            jointAngles: msg.angles,
            jointRisks: msg.risks,
            frameBase64: msg.frame || undefined,
          }).catch(() => {});
        }
        return;
      }
      if (msg.type === "angles") {
        const data = msg.data as AngleMap;
        if (msg.risk) {
          const r = msg.risk as RiskMap;
          setRisk(r);
          setPeak((prev) => {
            let changed = false;
            const next = { ...prev };
            (Object.keys(r) as JointKey[]).forEach((k) => {
              const lvlVal = r[k];
              const deg = data[k];
              if (lvlVal < 1) return;
              const cur = next[k];
              if (!cur || lvlVal > cur.lvl || (lvlVal === cur.lvl && moreExtreme(k, deg, cur.deg))) {
                next[k] = { lvl: lvlVal, deg };
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

  // ── Jump to worst moment ────────────────────────────────────────────────────
  function jumpToWorst() {
    if (worstTime === null) return;
    // __seekTo is exposed inside the IIFE so it has access to the internal
    // playing/pause state — much more reliable than manipulating the video directly.
    webviewRef.current?.injectJavaScript(
      `if(typeof window.__seekTo==='function'){window.__seekTo(${worstTime});}else{var v=document.getElementById('v');if(v){v.pause();v.currentTime=${worstTime};}} true;`
    );
  }

  // ── Split tips into injury vs performance ───────────────────────────────────
  const injuryTips     = useMemo(() => tips.filter((t) => t.tipType === "injury"   || t.severity === "warning" || t.severity === "critical"), [tips]);
  const performanceTips = useMemo(() => tips.filter((t) => t.tipType === "performance" && t.severity === "info"), [tips]);

  // When a joint goes red/amber, surface the most relevant injury tip
  const activeInjuryTip = useMemo((): TipRecord | null => {
    if (maxLvl < 1 || injuryTips.length === 0) return null;
    const riskJoints = risk
      ? (Object.keys(risk) as (keyof RiskMap)[]).filter((k) => risk[k] >= 1)
      : [];
    const isKneeRisk  = riskJoints.some((k) => k.toLowerCase().includes("knee"));
    const isHipRisk   = riskJoints.some((k) => k.toLowerCase().includes("hip"));
    const isElbowRisk = riskJoints.some((k) => k.toLowerCase().includes("elbow"));
    if (isKneeRisk || isHipRisk) {
      const match = injuryTips.find((t) => t.category === "Injury Prevention" || t.category === "Form");
      if (match) return match;
    }
    if (isElbowRisk) {
      const match = injuryTips.find((t) => t.category === "Form");
      if (match) return match;
    }
    return injuryTips[0] ?? null;
  }, [maxLvl, risk, injuryTips]);

  // ── Build HTML to disk ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPreparing(true);
    setHtmlFileUri(null);
    setRisk(null);
    setMaxLvl(0);
    setPeak({});
    setWorstTime(null);
    setVideoAspect(16 / 9);
    setModelReady(false);

    (async () => {
      try {
        const cacheDir = FileSystem.cacheDirectory ?? "";
        let resolvedVideo: string | undefined = videoUri;
        if (videoUri) {
          const ext = (videoUri.split(".").pop() ?? "mp4").split(/[?#]/)[0];
          const localVideo = cacheDir + "pose-video." + ext;
          try {
            await FileSystem.copyAsync({ from: videoUri, to: localVideo });
            resolvedVideo = localVideo;
          } catch {
            // On Android content:// URIs may not need copying
          }
        }
        const cropParam = (initNx && initNy && initNw && initNh)
          ? { nx: parseFloat(initNx), ny: parseFloat(initNy), nw: parseFloat(initNw), nh: parseFloat(initNh) }
          : null;
        const htmlPath = cacheDir + "pose-tracker.html";
        await FileSystem.writeAsStringAsync(htmlPath, buildHtml(resolvedVideo, sport, cropParam), {
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
  }, [videoUri, sport, initNx, initNy, initNw, initNh]);

  // ── Adaptive video height ───────────────────────────────────────────────────
  const CTRL_H = 112;
  const videoAreaH = Math.max(120, Math.min(screenW / videoAspect, screenH * 0.62));
  const portraitWebH = Math.round(videoAreaH + CTRL_H);

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
      {!isLandscape && (
        <View style={[ss.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity style={ss.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Feather name="chevron-left" size={18} color="#8888aa" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={ss.headerTitle} numberOfLines={1}>
              {sport || "Pose"} · AI Tracking
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
      )}

      {isLandscape ? (
        <>
          {mediaBlock}
          <TouchableOpacity onPress={toggleOrientation} style={ss.portraitBtn} activeOpacity={0.8}>
            <Feather name="smartphone" size={13} color="#fff" />
            <Text style={ss.rotateBtnText}>Portrait</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
          showsVerticalScrollIndicator={false}
        >
          {mediaBlock}

          {/* ── Jump to worst moment button ── */}
          {modelReady && videoUri && worstTime !== null && (
            <View style={ss.worstSection}>
              <TouchableOpacity style={ss.worstBtn} onPress={jumpToWorst} activeOpacity={0.8}>
                <View style={ss.worstBtnGlow} />
                <Feather name="alert-triangle" size={16} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={ss.worstBtnTitle}>Jump to Worst Moment</Text>
                  <Text style={ss.worstBtnSub}>
                    Scrubs to the frame with highest injury risk
                  </Text>
                </View>
                <Feather name="skip-forward" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── SECTION 1: Injury Prevention ── */}
          {modelReady && videoUri && (
            <View style={ss.tipSection}>
              <View style={ss.tipLabelRow}>
                <Feather name="shield" size={10} color="#ef4444" />
                <Text style={[ss.sectionLabel, { color: "#ef444488" }]}>INJURY PREVENTION</Text>
              </View>

              {activeInjuryTip ? (
                <View style={[ss.tipCard, { borderColor: maxLvl === 2 ? "#ef444444" : "#f59e0b44" }]}>
                  <View style={ss.tipHeader}>
                    <View style={[ss.tipIcon, { backgroundColor: maxLvl === 2 ? "#ef44441a" : "#f59e0b1a" }]}>
                      <Feather
                        name={maxLvl === 2 ? "alert-triangle" : "alert-circle"}
                        size={14}
                        color={maxLvl === 2 ? "#ef4444" : "#f59e0b"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.tipCategory, { color: maxLvl === 2 ? "#ef4444" : "#f59e0b" }]}>{activeInjuryTip.category}</Text>
                      <Text style={ss.tipTitle}>{activeInjuryTip.title}</Text>
                    </View>
                  </View>
                  <Text style={ss.tipDesc}>{activeInjuryTip.description}</Text>
                  {activeInjuryTip.drill && (
                    <View style={ss.drillBox}>
                      <Text style={ss.drillLabel}>CORRECTIVE DRILL</Text>
                      <Text style={ss.drillText}>{activeInjuryTip.drill}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={ss.okCard}>
                  <Feather name="shield" size={18} color="#22c55e" />
                  <View style={{ flex: 1 }}>
                    <Text style={ss.okTitle}>No injury risks detected</Text>
                    <Text style={ss.okBody}>
                      Joint angles are within safe ranges for {sport || "this sport"}. Risk alerts will appear here if a dangerous pattern is detected.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── SECTION 2: Performance & Efficiency ── */}
          {modelReady && videoUri && performanceTips.length > 0 && (
            <View style={ss.tipSection}>
              <View style={ss.tipLabelRow}>
                <Feather name="zap" size={10} color="#6c63ff" />
                <Text style={[ss.sectionLabel, { color: "#6c63ffaa" }]}>PERFORMANCE COACHING</Text>
              </View>
              {performanceTips.map((tip, i) => (
                <View key={tip.id ?? i} style={[ss.tipCard, ss.perfCard]}>
                  <View style={ss.tipHeader}>
                    <View style={[ss.tipIcon, { backgroundColor: "#6c63ff1a" }]}>
                      <Feather name="trending-up" size={14} color="#6c63ff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.tipCategory, { color: "#6c63ff" }]}>{tip.category}</Text>
                      <Text style={ss.tipTitle}>{tip.title}</Text>
                    </View>
                  </View>
                  <Text style={ss.tipDesc}>{tip.description}</Text>
                  {tip.drill && (
                    <View style={[ss.drillBox, { backgroundColor: "#0e0e28" }]}>
                      <Text style={[ss.drillLabel, { color: "#6c63ff" }]}>PERFORMANCE DRILL</Text>
                      <Text style={ss.drillText}>{tip.drill}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ── Citations panel ── */}
          {modelReady && (
            <View style={ss.sourcesSection}>
              <TouchableOpacity
                style={ss.sourcesToggle}
                onPress={() => setShowSources((s) => !s)}
                activeOpacity={0.75}
              >
                <Feather name="book-open" size={12} color="#55556e" />
                <Text style={ss.sourcesToggleText}>Peer-reviewed sources</Text>
                <Feather name={showSources ? "chevron-up" : "chevron-down"} size={12} color="#55556e" />
              </TouchableOpacity>

              {showSources && (
                <View style={ss.sourcesCard}>
                  <Text style={ss.sourcesHeading}>Scientific References</Text>
                  <Text style={ss.sourcesSubheading}>
                    Joint angle thresholds and AI coaching tips are grounded in peer-reviewed sports science. Research covers 20+ sports. AI content is generated by Anthropic Claude — not a substitute for professional medical or coaching advice.
                  </Text>

                  {/* ── Shared / Cross-sport ── */}
                  <Text style={ss.sourcesGroupLabel}>🛡 Injury Prevention — All Sports</Text>
                  {([
                    { ref: "Hewett TE et al.", year: "2005", title: "Biomechanical measures of neuromuscular control and valgus loading of the knee predict ACL injury risk.", journal: "Am J Sports Med", detail: "33(4):492–501" },
                    { ref: "Heiderscheit BC et al.", year: "2011", title: "Effects of step rate manipulation on joint mechanics during running.", journal: "J Orthop Sports Phys Ther", detail: "41(4):229–238" },
                    { ref: "Decker MJ et al.", year: "2003", title: "Lower extremity kinematics, kinetics and energy absorption during landing.", journal: "Clin Biomech", detail: "18(7):662–669" },
                    { ref: "Norkin CC, White DJ.", year: "2009", title: "Measurement of Joint Motion: A Guide to Goniometry (4th ed.).", journal: "F.A. Davis Company", detail: "" },
                    { ref: "Meeuwisse WH.", year: "1994", title: "Assessing causation in sport injury: a multifactorial model.", journal: "Clin J Sport Med", detail: "4(3):166–170" },
                    { ref: "Kibler WB, Press J, Sciascia A.", year: "2006", title: "The role of core stability in athletic function.", journal: "Sports Med", detail: "36(3):189–198" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={ss.sourceNum}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Running / Cycling / Triathlon ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Running · Cycling · Triathlon</Text>
                  {([
                    { ref: "Moore IS.", year: "2016", title: "Is there an economical running technique? A review of modifiable biomechanical factors affecting running economy.", journal: "Sports Med", detail: "46(6):793–807" },
                    { ref: "Saunders PU et al.", year: "2004", title: "Factors affecting running economy in trained distance runners.", journal: "Sports Med", detail: "34(7):465–485" },
                    { ref: "Novacheck TF.", year: "1998", title: "The biomechanics of running.", journal: "Gait Posture", detail: "7(1):77–95" },
                    { ref: "Weyand PG et al.", year: "2000", title: "Faster top running speeds are achieved with greater ground forces not more rapid leg movements.", journal: "J Appl Physiol", detail: "89(5):1991–1999" },
                    { ref: "Cavanagh PR, Williams KR.", year: "1982", title: "The effect of stride length variation on oxygen uptake during distance running.", journal: "Med Sci Sports Exerc", detail: "14(1):30–35" },
                    { ref: "van Gent RN et al.", year: "2007", title: "Incidence and determinants of lower extremity running injuries in long distance runners.", journal: "Br J Sports Med", detail: "41(8):469–480" },
                    { ref: "Faria EW, Parker DL, Faria IE.", year: "2005", title: "The science of cycling: physiology and training — part 1.", journal: "Sports Med", detail: "35(4):285–312" },
                    { ref: "Bini RR, Hume PA.", year: "2014", title: "Assessment of optimal pedalling cadence and saddle height in cyclists.", journal: "J Sci Cycling", detail: "3(1):6–12" },
                    { ref: "Lucia A et al.", year: "2001", title: "Preferred pedalling cadence in professional cycling.", journal: "Med Sci Sports Exerc", detail: "33(8):1361–1366" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Weightlifting / Powerlifting / CrossFit ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Weightlifting · Powerlifting · CrossFit</Text>
                  {([
                    { ref: "Escamilla RF et al.", year: "2001", title: "Knee biomechanics of the dynamic squat exercise.", journal: "Med Sci Sports Exerc", detail: "33(1):127–141" },
                    { ref: "Schoenfeld BJ.", year: "2010", title: "Squatting kinematics and kinetics and their application to exercise performance.", journal: "J Strength Cond Res", detail: "24(12):3497–3506" },
                    { ref: "Hales ME et al.", year: "2009", title: "Kinematic analysis of the powerlifting style squat and conventional deadlift during competition.", journal: "J Strength Cond Res", detail: "23(9):2574–2580" },
                    { ref: "Glassbrook DJ et al.", year: "2017", title: "A review of the biomechanical differences between the high-bar and low-bar back squat.", journal: "J Strength Cond Res", detail: "31(9):2618–2634" },
                    { ref: "Garhammer J.", year: "1993", title: "A review of power output studies of Olympic and powerlifting.", journal: "J Strength Cond Res", detail: "7(2):76–89" },
                    { ref: "Stone MH et al.", year: "2006", title: "Weightlifting: A brief overview.", journal: "Strength Cond J", detail: "28(1):50–66" },
                    { ref: "Comfort P et al.", year: "2012", title: "Kinetic and kinematic differences between power cleans and power snatches in moderately trained males.", journal: "J Strength Cond Res", detail: "26(10):2885–2891" },
                    { ref: "Weisenthal BM et al.", year: "2014", title: "Injury rate and patterns among CrossFit athletes.", journal: "Orthop J Sports Med", detail: "2(4)" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Basketball / Volleyball ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Basketball · Volleyball</Text>
                  {([
                    { ref: "Struzik A et al.", year: "2014", title: "Biomechanical analysis of the jump shot in basketball.", journal: "J Hum Kinet", detail: "42:73–79" },
                    { ref: "Pojskic H et al.", year: "2014", title: "Relationship between basketball performance indicators and shooting accuracy.", journal: "J Hum Kinet", detail: "41:55–64" },
                    { ref: "Abdelkrim NB et al.", year: "2007", title: "Time-motion characteristics and physiological responses during elite under-19 basketball competition.", journal: "Br J Sports Med", detail: "41(2):69–75" },
                    { ref: "Ziv G, Lidor R.", year: "2009", title: "Physical attributes, physiological characteristics, on-court performances and nutritional strategies of female and male basketball players.", journal: "J Strength Cond Res", detail: "23(9):2702–2717" },
                    { ref: "Sheppard JM et al.", year: "2008", title: "Reliability of the running anaerobic sprint test and its relationship to jumping and short sprint performance.", journal: "J Strength Cond Res", detail: "22(4):1093–1099" },
                    { ref: "Palao JM et al.", year: "2014", title: "Effect of level of competition on the use and efficacy of volleyball game actions.", journal: "Int J Sports Sci Coach", detail: "9(5):895–904" },
                    { ref: "Wagner H et al.", year: "2009", title: "Individual and team performance in team-handball.", journal: "J Sports Sci Med", detail: "8(2):235–244" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Soccer / Football / Rugby / Lacrosse ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Soccer · Football · Rugby · Lacrosse</Text>
                  {([
                    { ref: "Kellis E, Katis A.", year: "2007", title: "Biomechanical characteristics and determinants of instep soccer kick.", journal: "J Sports Sci Med", detail: "6(2):154–165" },
                    { ref: "Stølen T et al.", year: "2005", title: "Physiology of soccer: an update.", journal: "Sports Med", detail: "35(6):501–536" },
                    { ref: "Ekstrand J et al.", year: "2011", title: "Hamstring muscle injuries in professional football: the correlation of MRI findings with return to play.", journal: "Br J Sports Med", detail: "46(2):112–117" },
                    { ref: "Brechue WF.", year: "2011", title: "Structure-function relationships that determine sprint performance and event classification in elite football players.", journal: "Int J Sports Physiol Perform", detail: "6(1):4–21" },
                    { ref: "Gabbett TJ.", year: "2016", title: "The training-injury prevention paradox: should athletes be training smarter and harder?", journal: "Br J Sports Med", detail: "50(5):273–280" },
                    { ref: "Duthie G, Pyne D, Hooper S.", year: "2003", title: "Applied physiology and game analysis of rugby union.", journal: "Sports Med", detail: "33(13):973–991" },
                    { ref: "Brooks JHM, Fuller CW.", year: "2006", title: "The influence of methodological issues on the results and conclusions from epidemiological studies of sports injuries.", journal: "Sports Med", detail: "36(6):459–472" },
                    { ref: "Kerr ZY et al.", year: "2015", title: "Epidemiology of National Collegiate Athletic Association men's and women's lacrosse injuries.", journal: "Orthop J Sports Med", detail: "3(6)" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Tennis / Baseball / Softball ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Tennis · Baseball · Softball</Text>
                  {([
                    { ref: "Elliott B.", year: "2006", title: "Biomechanics and tennis.", journal: "Br J Sports Med", detail: "40(5):392–396" },
                    { ref: "Reid M, Elliott B, Alderson J.", year: "2008", title: "Lower-limb coordination and shoulder joint mechanics in the tennis serve.", journal: "Med Sci Sports Exerc", detail: "40(2):308–315" },
                    { ref: "Fernandez J et al.", year: "2006", title: "Intensity of tennis match play.", journal: "Br J Sports Med", detail: "40(5):387–391" },
                    { ref: "Fleisig GS et al.", year: "1995", title: "Kinetics of baseball pitching with implications about injury mechanisms.", journal: "Am J Sports Med", detail: "23(2):233–239" },
                    { ref: "Dillman CJ, Fleisig GS, Andrews JR.", year: "1993", title: "Biomechanics of pitching with emphasis on shoulder kinematics.", journal: "J Orthop Sports Phys Ther", detail: "18(2):402–408" },
                    { ref: "Werner SL et al.", year: "2002", title: "Relationships between throwing mechanics and elbow valgus in collegiate baseball pitchers.", journal: "J Shoulder Elbow Surg", detail: "11(2):140–145" },
                    { ref: "Escamilla RF, Andrews JR.", year: "2009", title: "Shoulder muscle recruitment patterns and related biomechanics during upper extremity sports.", journal: "Sports Med", detail: "39(7):569–590" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Swimming / Gymnastics / Diving ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Swimming · Gymnastics · Diving</Text>
                  {([
                    { ref: "Toussaint HM, Beek PJ.", year: "1992", title: "Biomechanics of competitive front crawl swimming.", journal: "Sports Med", detail: "13(1):8–24" },
                    { ref: "Zamparo P et al.", year: "2005", title: "An energy balance of front crawl.", journal: "Eur J Appl Physiol", detail: "94(1–2):134–144" },
                    { ref: "Bak K.", year: "2010", title: "The practical management of swimmer's painful shoulder: etiology, diagnosis, and treatment.", journal: "Clin J Sport Med", detail: "20(5):386–390" },
                    { ref: "Wanivenhaus F et al.", year: "2012", title: "Epidemiology of injuries and prevention strategies in competitive swimmers.", journal: "Sports Health", detail: "4(3):246–251" },
                    { ref: "Arampatzis A, Brüggemann GP.", year: "1999", title: "Mechanical energetic processes during the giant swing exercise before dismounts and release elements on the high bar.", journal: "J Biomech", detail: "32(8):811–820" },
                    { ref: "Caine D et al.", year: "2003", title: "Gymnastics injuries: a critical review of the literature 1975–2005.", journal: "Sports Med", detail: "33(14):1019–1045" },
                    { ref: "DiFiori JP et al.", year: "2012", title: "Overuse injuries and burnout in youth sports: a position statement from the American Medical Society for Sports Medicine.", journal: "Br J Sports Med", detail: "48(4):287–288" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Fencing / Boxing / Wrestling / Martial Arts ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Fencing · Boxing · Wrestling · Martial Arts</Text>
                  {([
                    { ref: "Roi GS, Bianchedi D.", year: "2008", title: "The science of fencing: implications for performance and injury prevention.", journal: "Sports Med", detail: "38(6):465–481" },
                    { ref: "Harmer PA.", year: "2008", title: "Getting to the point: injury patterns and medical care in competitive fencing.", journal: "Curr Sports Med Rep", detail: "7(5):303–307" },
                    { ref: "Turner A.", year: "2009", title: "Strength and conditioning for muay thai athletes.", journal: "Strength Cond J", detail: "31(6):78–92" },
                    { ref: "Bledsoe GH et al.", year: "2005", title: "Incidence of injury in professional mixed martial arts competitions.", journal: "J Sports Sci Med", detail: "4(CSSI):136–142" },
                    { ref: "Zazryn TR et al.", year: "2003", title: "A 16 year study of injuries to professional boxers in the state of Victoria, Australia.", journal: "Br J Sports Med", detail: "37(4):321–324" },
                    { ref: "Chaabène H et al.", year: "2017", title: "Physical and physiological profile of elite karate athletes.", journal: "Sports Med", detail: "42(10):829–843" },
                    { ref: "Yard EE, Comstock RD.", year: "2008", title: "Injury patterns by body site, school level, and gender in United States high school wrestling.", journal: "J Athl Train", detail: "43(6):588–596" },
                    { ref: "Horswill CA.", year: "1992", title: "Applied physiology of amateur wrestling.", journal: "Sports Med", detail: "14(2):114–143" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Rowing / Hockey / Badminton / Golf ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Rowing · Hockey · Badminton · Golf</Text>
                  {([
                    { ref: "Soper C, Hume PA.", year: "2004", title: "Towards an ideal rowing technique for performance: the contributions from biomechanics.", journal: "Sports Med", detail: "34(12):825–848" },
                    { ref: "Rumball JS et al.", year: "2005", title: "Rowing injuries.", journal: "Sports Med", detail: "35(6):537–555" },
                    { ref: "Bracko MR.", year: "2004", title: "Biomechanics powers ice hockey performance.", journal: "ACSM Health Fitness J", detail: "8(1):15–19" },
                    { ref: "Molsa J et al.", year: "2003", title: "Injury profile in ice hockey from the 1970s through the 1990s in Finland.", journal: "Am J Sports Med", detail: "31(3):320–324" },
                    { ref: "Kuntze G et al.", year: "2010", title: "Biomechanical analysis of common lunge tasks in badminton.", journal: "J Sports Sci", detail: "28(2):183–191" },
                    { ref: "Phomsoupha M, Laffaye G.", year: "2015", title: "The science of badminton: game characteristics, anthropometry, physiology, visual fitness and biomechanics.", journal: "Sports Med", detail: "45(4):473–495" },
                    { ref: "Hume PA et al.", year: "2005", title: "Biomechanics of the golf swing: a literature review.", journal: "Sports Med", detail: "35(5):385–409" },
                    { ref: "McHardy A et al.", year: "2006", title: "Golf-related lower back injuries: a review of the literature.", journal: "J Chiropr Med", detail: "5(1):26–35" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── Track & Field / Skiing / Snowboarding ── */}
                  <Text style={[ss.sourcesGroupLabel, { color: "#6c63ffaa", marginTop: 14 }]}>⚡ Track & Field · Skiing · Snow Sports</Text>
                  {([
                    { ref: "Mann RA, Herman J.", year: "1985", title: "Kinematic analysis of Olympic sprint performance: men's 200 metres.", journal: "Int J Sport Biomech", detail: "1(2):151–162" },
                    { ref: "Hunter JP et al.", year: "2004", title: "Interaction of step length and step rate during sprint running.", journal: "Med Sci Sports Exerc", detail: "36(2):261–271" },
                    { ref: "Hay JG.", year: "1993", title: "The Biomechanics of Sports Techniques (4th ed.).", journal: "Prentice Hall", detail: "" },
                    { ref: "Deibert MC et al.", year: "1998", title: "Skiing injuries in children, teenagers, and adults.", journal: "J Bone Joint Surg Am", detail: "80(1):25–32" },
                    { ref: "Ettlinger CF et al.", year: "1995", title: "A method to help reduce the risk of serious knee sprains incurred in alpine skiing.", journal: "Am J Sports Med", detail: "23(5):531–537" },
                    { ref: "Müller E, Schwameder H.", year: "2003", title: "Biomechanical aspects of new techniques in alpine skiing and ski jumping.", journal: "J Sports Sci", detail: "21(9):679–692" },
                  ] as const).map((s, i) => (
                    <View key={i} style={ss.sourceRow}>
                      <Text style={[ss.sourceNum, { color: "#6c63ff" }]}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.sourceRef}>{s.ref} <Text style={ss.sourceYear}>({s.year})</Text></Text>
                        <Text style={ss.sourceTitle}>{s.title}</Text>
                        <Text style={ss.sourceJournal}>{s.journal}{s.detail ? `, ${s.detail}` : ""}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={ss.aiDisclaimer}>
                    <Feather name="cpu" size={11} color="#6c63ff" />
                    <Text style={ss.aiDisclaimerText}>
                      Coaching tips are AI-generated based on sport and movement context. They are educational only and do not constitute medical or professional coaching advice.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

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
  root:          { flex: 1, backgroundColor: "#07070f" },
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#18182a", gap: 12 },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: "#111118", borderWidth: 1, borderColor: "#18182a", alignItems: "center", justifyContent: "center" },
  headerTitle:   { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#f0f0f8", textTransform: "capitalize" },
  rotateBtn:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6c63ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  rotateBtnText: { fontSize: 12, color: "#fff", fontFamily: "Inter_600SemiBold" },
  portraitBtn:   { position: "absolute", top: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6c63ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  sectionLabel:  { fontSize: 10, color: "#8888aa", fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  statusPill:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusPillText:{ fontSize: 11, fontFamily: "Inter_600SemiBold" },
  worstSection:  { paddingHorizontal: 18, paddingTop: 14 },
  worstBtn:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1a0a0a", borderRadius: 14, borderWidth: 1.5, borderColor: "#ef444455", padding: 14, overflow: "hidden" },
  worstBtnGlow:  { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#ef44440a" },
  worstBtnTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#ef4444" },
  worstBtnSub:   { fontSize: 11, color: "#884444", fontFamily: "Inter_400Regular", marginTop: 1 },
  tipSection:    { paddingHorizontal: 18, paddingTop: 14 },
  tipLabelRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  tipCard:       { backgroundColor: "#0f0f1c", borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  tipHeader:     { flexDirection: "row", alignItems: "center", gap: 12 },
  tipIcon:       { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipCategory:   { fontSize: 10, color: "#6c63ff", fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  tipTitle:      { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#f0f0f8", marginTop: 1 },
  tipDesc:       { fontSize: 13, color: "#a0a0bc", fontFamily: "Inter_400Regular", lineHeight: 19 },
  drillBox:      { backgroundColor: "#161628", borderRadius: 10, padding: 11, gap: 4 },
  drillLabel:    { fontSize: 9, color: "#6c63ff", fontFamily: "Inter_700Bold", letterSpacing: 1 },
  drillText:     { fontSize: 12, color: "#c0c0d8", fontFamily: "Inter_400Regular", lineHeight: 17 },
  okCard:        { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#0f1c12", borderWidth: 1, borderColor: "#22c55e33", borderRadius: 14, padding: 14 },
  okTitle:       { fontSize: 13, color: "#d8f5e0", fontFamily: "Inter_600SemiBold" },
  okBody:        { fontSize: 12, color: "#7a9a82", fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  sourcesSection:      { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 },
  sourcesToggle:       { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  sourcesToggleText:   { fontSize: 11, color: "#55556e", fontFamily: "Inter_400Regular", flex: 1 },
  sourcesCard:         { backgroundColor: "#0a0a18", borderRadius: 12, borderWidth: 1, borderColor: "#1e1e30", padding: 14, marginTop: 8, gap: 12 },
  sourcesHeading:      { fontSize: 13, fontFamily: "Inter_700Bold", color: "#c0c0d8" },
  sourcesSubheading:   { fontSize: 11, color: "#55556e", fontFamily: "Inter_400Regular", lineHeight: 16, fontStyle: "italic" },
  sourcesGroupLabel:   { fontSize: 10, color: "#ef444488", fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 4 },
  perfCard:            { borderColor: "#6c63ff33", marginTop: 10 },
  sourceRow:           { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  sourceNum:           { fontSize: 11, color: "#6c63ff", fontFamily: "Inter_700Bold", width: 16, paddingTop: 1 },
  sourceRef:           { fontSize: 11, color: "#c0c0d8", fontFamily: "Inter_600SemiBold" },
  sourceYear:          { fontSize: 11, color: "#7070a0", fontFamily: "Inter_400Regular" },
  sourceTitle:         { fontSize: 11, color: "#9090b8", fontFamily: "Inter_400Regular", lineHeight: 15, marginTop: 1 },
  sourceJournal:       { fontSize: 10, color: "#55556e", fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 1 },
  aiDisclaimer:        { flexDirection: "row", gap: 7, alignItems: "flex-start", backgroundColor: "#110e2a", borderRadius: 8, padding: 10, marginTop: 4 },
  aiDisclaimerText:    { fontSize: 10, color: "#6060a0", fontFamily: "Inter_400Regular", lineHeight: 15, flex: 1 },
  noVideo:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40, paddingTop: 60 },
  noVideoText:   { fontSize: 14, color: "#4a4a6a", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  noVideoSub:    { fontSize: 12, color: "#3a3a5c", fontFamily: "Inter_400Regular", textAlign: "center" },
  webviewSlot:   { backgroundColor: "#07070f", alignItems: "center", justifyContent: "center", gap: 10 },
  preparingText: { fontSize: 12, color: "#8888aa", fontFamily: "Inter_400Regular" },
});
