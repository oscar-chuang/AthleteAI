import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  Pressable,
  PanResponder,
} from "react-native";
import Svg, { Line, Path, Polyline, Circle, Rect, Text as SvgText, G } from "react-native-svg";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyses as analysesApi, drills as drillsApi, jointTrends, type TipRecord, type DrillRecord, type RiskRecord, type JointTrendsResponse, type JointDataPoint, type FrameTick } from "@/lib/api";
import JointHistorySheet from "@/components/JointHistorySheet";
import { scheduleImprovementNotification } from "@/utils/notifications";
import { useAuth } from "@/lib/authContext";
import {
  computeFlaggedJoints,
  computeWorstLvl,
  type JointKey,
  type RiskMap,
  type AngleMap,
  computeConflictedJoints,
  sortInjuryTips,
  sortPerformanceTips,
} from "@/utils/analysisUtils";
import {
  type Capture,
  RISK_COLORS,
  RISK_WORD,
  JOINT_LABEL,
  pickHeroCapture,
  captureForJoints,
  riskMatchesJoints,
  computeScanQuality,
  containRect,
} from "@/utils/skeleton";
import FrozenSkeleton from "@/components/FrozenSkeleton";

const PENDING_CHAT_KEY = "pendingChatMessage";

// ─── Scrubber helpers ────────────────────────────────────────────────────────

function bsearchTick(ticks: FrameTick[], t: number): FrameTick | null {
  if (!ticks.length) return null;
  let lo = 0;
  let hi = ticks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((ticks[mid]?.t ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return ticks[0] ?? null;
  const a = ticks[lo - 1]!;
  const b = ticks[lo]!;
  return Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b;
}

function formatScrubTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SCRUB_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
];

const SCRUB_JOINT_IDX: Partial<Record<string, number>> = {
  leftKnee: 25, rightKnee: 26, leftHip: 23, rightHip: 24, leftElbow: 13, rightElbow: 14,
};

const SCRUB_KEY_LM = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

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

// ─── Headless scanner HTML ───────────────────────────────────────────────────
// This WebView is mounted off-screen (1×1, opacity 0) and never shown to the user.
// It runs MediaPipe Pose ONCE over the selected crop, seeking frame-by-frame to
// measure joint angles, and posts back per-joint "worst" frames (a downscaled crop
// image + that frame's landmarks + readings) plus the original scanComplete PATCH
// payload. The native UI then redraws everything from those static captures — there
// is no live tracking during viewing, so the skeleton can never switch to another
// person.
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
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000}
video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain}
#oc{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}
</style>
</head>
<body>
${videoUri ? `<video id="v" playsinline webkit-playsinline muted preload="auto"></video><canvas id="oc"></canvas>` : ""}
<script src="${MEDIAPIPE_BASE}/pose.js" crossorigin="anonymous"
  onerror="try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'scanComplete',angles:{},risks:{leftKnee:0,rightKnee:0,leftHip:0,rightHip:0,leftElbow:0,rightElbow:0},frame:''}));}catch(e){}">
</script>
<script>
(function(){
  const VIDEO_URI = ${videoUri ? JSON.stringify(videoUri) : "null"};
  if(!VIDEO_URI){ return; }

  // ── Research-backed thresholds for ${sport || "this sport"} ──
  // lvl(angle, loRisk, loWarn, hiWarn, hiRisk) → 0=safe 1=caution 2=risk
  const KN  = [${knLR}, ${knLW}, ${knHW}, ${knHR}];
  const HIP = [${hipLR}, ${hipLW}, ${hipHW}, ${hipHR}];
  const ELB = [${elbLR}, ${elbLW}, ${elbHW}, ${elbHR}];

  function lvl(a, lR, lW, hW, hR){
    if(lR >= 0 && a <= lR) return 2;
    if(hR <= 998 && a >= hR) return 2;
    if(lW >= 0 && a <= lW) return 1;
    if(hW <= 998 && a >= hW) return 1;
    return 0;
  }
  function ang(a,b,c){
    const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
    return Math.round(Math.atan2(Math.abs(ab.x*cb.y-ab.y*cb.x),ab.x*cb.x+ab.y*cb.y)*180/Math.PI);
  }

  // Joint landmark index → named key (the six tracked joints).
  const J2K={25:"leftKnee",26:"rightKnee",23:"leftHip",24:"rightHip",13:"leftElbow",14:"rightElbow"};
  const TRACK=[25,26,23,24,13,14];

  const video=document.getElementById("v");
  const capCanvas=document.createElement("canvas"), capCtx=capCanvas.getContext("2d");
  const fullCanvas=document.createElement("canvas"), fullCtx=fullCanvas.getContext("2d");
  const offCanvas=document.createElement("canvas"), offCtx=offCanvas.getContext("2d");
  const liveCanvas=document.getElementById("oc"), liveCtx=liveCanvas?liveCanvas.getContext("2d"):null;

  function post(o){ try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){} }

  // ── Canvas size tracking via ResizeObserver ───────────────────────────────────
  // offsetWidth/offsetHeight can be 0 on the first few onResults calls if the
  // WebView hasn't finished layout yet. Using those stale values produces an
  // incorrect letterbox rect and causes the skeleton to drift from the video on
  // non-standard aspect ratios. We track the true rendered size through a
  // ResizeObserver and defer any draw that arrives before the first layout event.
  let liveW=0, liveH=0, pendingRes=null, layoutFired=false;
  function applyResize(w,h){
    if(w<=0||h<=0)return;
    liveW=w; liveH=h;
    // Update the canvas buffer dimensions now, outside of any active draw,
    // so resizing never discards an in-progress frame.
    if(liveCanvas){liveCanvas.width=w;liveCanvas.height=h;}
    // Tell the native layer the canvas is measured so it can hide the
    // "Preparing scan…" placeholder and show real progress.
    if(!layoutFired){layoutFired=true;post({type:"layoutReady"});}
    // Flush a skeleton draw that arrived before layout was ready.
    if(pendingRes){var r=pendingRes;pendingRes=null;drawSkeleton(r);}
  }
  if(liveCanvas){
    if(typeof ResizeObserver!=='undefined'){
      new ResizeObserver(function(entries){
        var e=entries[0]; if(!e)return;
        var r=e.contentRect;
        applyResize(Math.round(r.width),Math.round(r.height));
      }).observe(liveCanvas);
    } else {
      // Fallback for environments without ResizeObserver: poll until layout is ready.
      var _poll=setInterval(function(){
        var w=liveCanvas.offsetWidth,h=liveCanvas.offsetHeight;
        if(w>0&&h>0){clearInterval(_poll);applyResize(w,h);}
      },50);
    }
  }

  // ── Live skeleton overlay drawn on each processed frame ──────────────────────
  // Landmarks from MediaPipe are crop-local (0..1 within the crop) when
  // personLocked=true, or full-frame when not yet locked. We map them back to
  // full-frame normalised coords before projecting onto the visible canvas.
  function drawSkeleton(res){
    if(!liveCanvas||!liveCtx)return;
    // Defer until the ResizeObserver has measured the canvas at least once.
    if(liveW<=0||liveH<=0){pendingRes=res;return;}
    const cW=liveW, cH=liveH;
    liveCtx.clearRect(0,0,cW,cH);
    const lm=res.poseLandmarks; if(!lm)return;
    const VW=video.videoWidth||640, VH=video.videoHeight||360;
    const vAR=VW/VH, cAR=cW/cH;
    let vX,vY,vW,vH;
    if(vAR>cAR){vW=cW;vH=cW/vAR;vX=0;vY=(cH-vH)/2;}
    else{vH=cH;vW=cH*vAR;vX=(cW-vW)/2;vY=0;}
    function toFull(p){
      if(!p||(p.visibility||0)<0.30)return null;
      const fx=personLocked?(p.x*cropW+cropX0)/Math.max(1,VW):p.x;
      const fy=personLocked?(p.y*cropH+cropY0)/Math.max(1,VH):p.y;
      return{x:vX+fx*vW,y:vY+fy*vH};
    }
    if(personLocked){
      const bx=vX+cropX0/VW*vW,by=vY+cropY0/VH*vH,bw=cropW/VW*vW,bh=cropH/VH*vH;
      liveCtx.strokeStyle='rgba(108,99,255,0.40)';liveCtx.lineWidth=1.5;
      liveCtx.setLineDash([4,4]);liveCtx.strokeRect(bx,by,bw,bh);liveCtx.setLineDash([]);
    }
    const CONNS=[[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[15,17],[12,14],[14,16],[16,18],[23,25],[25,27],[24,26],[26,28]];
    CONNS.forEach(function(pair){
      const pa=toFull(lm[pair[0]]),pb=toFull(lm[pair[1]]); if(!pa||!pb)return;
      liveCtx.beginPath();liveCtx.moveTo(pa.x,pa.y);liveCtx.lineTo(pb.x,pb.y);
      liveCtx.strokeStyle='rgba(108,99,255,0.80)';liveCtx.lineWidth=2;liveCtx.stroke();
    });
    var KEYS=[0,11,12,13,14,15,16,23,24,25,26,27,28];
    KEYS.forEach(function(i){
      const p=toFull(lm[i]); if(!p)return;
      liveCtx.beginPath();liveCtx.arc(p.x,p.y,4,0,Math.PI*2);
      liveCtx.fillStyle='#a78bfa';liveCtx.fill();
    });
  }

  // ── Crop state (fixed selection or auto-locked first person) ────────────────
  const INIT_CROP=${initCrop ? JSON.stringify(initCrop) : "null"};
  let personLocked=INIT_CROP!=null;
  let focusNX=INIT_CROP?INIT_CROP.nx+INIT_CROP.nw/2:0.5;
  let focusNY=INIT_CROP?INIT_CROP.ny+INIT_CROP.nh/2:0.5;
  let cropHalfX=INIT_CROP?INIT_CROP.nw/2:0.40;
  let cropHalfY=INIT_CROP?INIT_CROP.nh/2:0.40;
  let cropX0=0,cropY0=0,cropW=0,cropH=0;

  function computeCrop(W,H){
    if(!personLocked){ cropX0=0;cropY0=0;cropW=W;cropH=H;return; }
    const halfW=cropHalfX*W, halfH=cropHalfY*H;
    cropX0=Math.max(0,focusNX*W-halfW);
    cropY0=Math.max(0,focusNY*H-halfH);
    const x1=Math.min(W,focusNX*W+halfW), y1=Math.min(H,focusNY*H+halfH);
    cropW=x1-cropX0; cropH=y1-cropY0;
    if(cropW<8){cropX0=0;cropW=W;} if(cropH<8){cropY0=0;cropH=H;}
  }
  // ── Padded crop bounds (15% margin clamped to video bounds) ─────────────────
  // Used by both snapCrop and lmRemapped so the stored image and landmarks stay in sync.
  function paddedBounds(){
    const W=video.videoWidth||640, H=video.videoHeight||360;
    const px=cropW*0.15, py=cropH*0.15;
    const sx=Math.max(0,cropX0-px), sy=Math.max(0,cropY0-py);
    const ex=Math.min(W,cropX0+cropW+px), ey=Math.min(H,cropY0+cropH+py);
    return{sx,sy,sw:Math.max(1,ex-sx),sh:Math.max(1,ey-sy)};
  }
  function snapCrop(){
    const{sx,sy,sw,sh}=paddedBounds();
    const maxW=480; const s=Math.min(1,maxW/sw);
    const cw=Math.max(1,Math.round(sw*s)), ch=Math.max(1,Math.round(sh*s));
    capCanvas.width=cw; capCanvas.height=ch;
    try{ capCtx.drawImage(video,sx,sy,sw,sh,0,0,cw,ch); }catch(e){}
    return capCanvas.toDataURL("image/jpeg",0.6);
  }
  function snapFull(){
    const W=video.videoWidth||640,H=video.videoHeight||360;
    fullCanvas.width=Math.min(W,640); fullCanvas.height=Math.min(H,360);
    try{ fullCtx.drawImage(video,0,0,fullCanvas.width,fullCanvas.height); }catch(e){}
    return fullCanvas.toDataURL("image/jpeg",0.45);
  }
  // Remap crop-local landmarks (0..1 within cropX0/Y0/W/H) to padded-crop-local
  // coords so they stay aligned with the padded image stored in the Capture.
  function lmRemapped(rawLm){
    const{sx,sy,sw,sh}=paddedBounds();
    return rawLm.map(function(p){
      return{
        x:+(((p.x*cropW+cropX0-sx)/sw)).toFixed(4),
        y:+(((p.y*cropH+cropY0-sy)/sh)).toFixed(4),
        v:+((p.visibility||0)).toFixed(3)
      };
    });
  }
  function buildCapture(rawLm,jr,maxLvl){
    const{sw,sh}=paddedBounds();
    const joints=[],jrOut={};
    Object.keys(jr).forEach(k=>{const jk=J2K[k];if(jk){jrOut[jk]={deg:jr[k].deg,lvl:jr[k].lvl};if(jr[k].lvl>=1)joints.push(jk);}});
    joints.sort((a,b)=>jrOut[b].lvl-jrOut[a].lvl);
    return {
      id:"cap"+(capId++),
      kind:"joint",
      time:+(video.currentTime||0).toFixed(2),
      aspect:(sw>0&&sh>0)?sw/sh:((video.videoWidth||16)/(video.videoHeight||9)),
      frame:snapCrop(),
      lm:lmRemapped(rawLm),
      jr:jrOut,
      joints,
      maxLvl,
    };
  }

  // ── Capture accumulators ────────────────────────────────────────────────────
  let capId=0;
  let worstScore=0, worstSeenTime=-1, worstJr={}, worstFrameB64="", worstCap=null;
  let bestByJoint={};                       // idx -> {lvl, cap}
  let clearest={vis:-1, jr:{}, cap:null, full:""};

  function processFrame(res){
    const rawLm=res.poseLandmarks; if(!rawLm) return;
    // Angles from crop-local pixel coords. Angle is translation-invariant, so this
    // matches the original full-frame computation exactly (the +cropX0/+cropY0
    // offset cancels), keeping the scanComplete PATCH payload identical.
    const v=i=>(rawLm[i]&&(rawLm[i].visibility||0)>0.40);
    const p=i=>({x:rawLm[i].x*cropW,y:rawLm[i].y*cropH});
    const jr={};
    if(v(23)&&v(25)&&v(27)){const a=ang(p(23),p(25),p(27));jr[25]={deg:a,lvl:lvl(a,KN[0],KN[1],KN[2],KN[3])};}
    if(v(24)&&v(26)&&v(28)){const a=ang(p(24),p(26),p(28));jr[26]={deg:a,lvl:lvl(a,KN[0],KN[1],KN[2],KN[3])};}
    if(v(11)&&v(23)&&v(25)){const a=ang(p(11),p(23),p(25));jr[23]={deg:a,lvl:lvl(a,HIP[0],HIP[1],HIP[2],HIP[3])};}
    if(v(12)&&v(24)&&v(26)){const a=ang(p(12),p(24),p(26));jr[24]={deg:a,lvl:lvl(a,HIP[0],HIP[1],HIP[2],HIP[3])};}
    if(v(11)&&v(13)&&v(15)){const a=ang(p(11),p(13),p(15));jr[13]={deg:a,lvl:lvl(a,ELB[0],ELB[1],ELB[2],ELB[3])};}
    if(v(12)&&v(14)&&v(16)){const a=ang(p(12),p(14),p(16));jr[14]={deg:a,lvl:lvl(a,ELB[0],ELB[1],ELB[2],ELB[3])};}
    let maxLvl=0;Object.keys(jr).forEach(k=>{if(jr[k].lvl>maxLvl)maxLvl=jr[k].lvl;});

    // Accumulate the worst frame, per-joint worst frames and the clearest frame.
    const frameScore=Object.values(jr).reduce((s,j)=>s+(j.lvl===2?3:j.lvl===1?1:0),0);
    if(frameScore>0&&frameScore>worstScore){
      worstScore=frameScore; worstSeenTime=video.currentTime; worstJr=Object.assign({},jr);
      worstFrameB64=snapFull();
      worstCap=buildCapture(rawLm,jr,maxLvl); worstCap.kind="worst";
    }
    TRACK.forEach(idx=>{
      const r=jr[idx]; if(!r||r.lvl<1)return;
      const prev=bestByJoint[idx];
      if(!prev||r.lvl>prev.lvl){ bestByJoint[idx]={lvl:r.lvl, cap:buildCapture(rawLm,jr,maxLvl)}; }
    });
    let visSum=0; rawLm.forEach(q=>visSum+=(q.visibility||0));
    if(visSum>clearest.vis){
      clearest={vis:visSum, jr:Object.assign({},jr), cap:buildCapture(rawLm,jr,maxLvl), full:snapFull()};
      clearest.cap.kind="clear";
    }

    // ── Lock the crop ONCE, then never move it ──────────────────────────────────
    // A user-selected crop (INIT_CROP) is locked from the very first frame; with no
    // selection we lock onto the first reliably detected person. Crucially we do NOT
    // chase the athlete afterwards — the crop stays pinned for the whole scan, so the
    // pose can never drift onto, or snap to, a different person mid-clip. Staying on
    // the selected person is a hard requirement; losing a few frames when they move
    // out of the fixed crop is an acceptable trade.
    if(!personLocked){
      const vis=rawLm.filter(q=>(q.visibility||0)>0.45);
      if(vis.length>=8){
        const xs=vis.map(q=>q.x),ys=vis.map(q=>q.y);
        const minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs);
        const minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys);
        const mx=Math.max(0.10,(maxX-minX)*0.35),my=Math.max(0.10,(maxY-minY)*0.35);
        const bx=Math.max(0,minX-mx),by=Math.max(0,minY-my);
        const bw=Math.min(1,Math.max(Math.min(1,maxX+mx)-bx,0.50));
        const bh=Math.min(1,Math.max(Math.min(1,maxY+my)-by,0.65));
        if(bw>0.08&&bh>0.10){ focusNX=bx+bw/2;focusNY=by+bh/2;cropHalfX=bw/2;cropHalfY=bh/2;personLocked=true; }
      }
    }
    // ── Store full-frame normalised landmark tick for live playback ─────────
    try{
      const VW=video.videoWidth||640, VH=video.videoHeight||360;
      frameTicks.push({
        t:+(video.currentTime||0).toFixed(3),
        lm:rawLm.map(function(p){
          var fx=personLocked?(p.x*cropW+cropX0)/Math.max(1,VW):p.x;
          var fy=personLocked?(p.y*cropH+cropY0)/Math.max(1,VH):p.y;
          return{x:+fx.toFixed(4),y:+fy.toFixed(4),v:+((p.visibility||0)).toFixed(3)};
        }),
        angles:{leftKnee:jr[25]?jr[25].deg:undefined,rightKnee:jr[26]?jr[26].deg:undefined,leftHip:jr[23]?jr[23].deg:undefined,rightHip:jr[24]?jr[24].deg:undefined,leftElbow:jr[13]?jr[13].deg:undefined,rightElbow:jr[14]?jr[14].deg:undefined},
        jr:{leftKnee:jr[25]?{deg:jr[25].deg,lvl:jr[25].lvl}:undefined,rightKnee:jr[26]?{deg:jr[26].deg,lvl:jr[26].lvl}:undefined,leftHip:jr[23]?{deg:jr[23].deg,lvl:jr[23].lvl}:undefined,rightHip:jr[24]?{deg:jr[24].deg,lvl:jr[24].lvl}:undefined,leftElbow:jr[13]?{deg:jr[13].deg,lvl:jr[13].lvl}:undefined,rightElbow:jr[14]?{deg:jr[14].deg,lvl:jr[14].lvl}:undefined}
      });
    }catch(e){}
  }

  function detect(){
    if(busy||!video.readyState)return; busy=true;
    const W=video.videoWidth||640,H=video.videoHeight||360; computeCrop(W,H);
    if(personLocked){
      offCanvas.width=cropW; offCanvas.height=cropH;
      try{ offCtx.drawImage(video,cropX0,cropY0,cropW,cropH,0,0,cropW,cropH); }catch(e){ busy=false; return; }
      pose.send({image:offCanvas}).catch(()=>{busy=false;});
    } else {
      pose.send({image:video}).catch(()=>{busy=false;});
    }
  }

  // ── Seek-driven scan ────────────────────────────────────────────────────────
  let frameTicks=[];
  let busy=false, scanning=false, singleFrame=false, scanPos=0, duration=0, stepTimer=0;
  const SCAN_STEP=0.4;

  function gotoStep(){
    clearTimeout(stepTimer); if(!scanning)return;
    if(scanPos>duration+0.001){ finishScan(); return; }
    const target=Math.max(0,Math.min(duration,scanPos));
    // Watchdog: if a seek produces no frame within 1.8s, skip ahead so we never hang.
    stepTimer=setTimeout(()=>{ busy=false; scanPos+=SCAN_STEP; gotoStep(); }, 1800);
    if(Math.abs((video.currentTime||0)-target)<0.02){ detect(); }
    else { try{ video.currentTime=target; }catch(e){ detect(); } }
  }

  function onResults(res){
    busy=false; if(!scanning)return; clearTimeout(stepTimer);
    try{ drawSkeleton(res); }catch(e){}
    try{ processFrame(res); }catch(e){}
    if(singleFrame){ post({type:"progress",value:1}); finishScan(); return; }
    post({type:"progress",value:duration>0?Math.min(1,scanPos/duration):1});
    scanPos+=SCAN_STEP; gotoStep();
  }

  let finished=false;
  function finishScan(){
    if(finished)return; finished=true;
    scanning=false; clearTimeout(stepTimer);
    const caps=[];
    if(worstCap)caps.push(worstCap);
    Object.keys(bestByJoint).sort((a,b)=>bestByJoint[b].lvl-bestByJoint[a].lvl).forEach(idx=>{
      const c=bestByJoint[idx].cap; if(!c)return;
      if(caps.some(x=>Math.abs(x.time-c.time)<0.25))return; // de-dup near-identical frames
      caps.push(c);
    });
    if(caps.length===0&&clearest.cap)caps.push(clearest.cap);
    caps.slice(0,5).forEach(c=>post({type:"capture",capture:c}));
    // scanComplete contract is UNCHANGED: {angles, risks, frame} → PATCH {jointAngles,jointRisks,frameBase64}
    const baseJr = worstSeenTime>=0 ? worstJr : clearest.jr;
    const angles={leftKnee:baseJr[25]?baseJr[25].deg:undefined,rightKnee:baseJr[26]?baseJr[26].deg:undefined,leftHip:baseJr[23]?baseJr[23].deg:undefined,rightHip:baseJr[24]?baseJr[24].deg:undefined,leftElbow:baseJr[13]?baseJr[13].deg:undefined,rightElbow:baseJr[14]?baseJr[14].deg:undefined};
    const risks={leftKnee:baseJr[25]?baseJr[25].lvl:0,rightKnee:baseJr[26]?baseJr[26].lvl:0,leftHip:baseJr[23]?baseJr[23].lvl:0,rightHip:baseJr[24]?baseJr[24].lvl:0,leftElbow:baseJr[13]?baseJr[13].lvl:0,rightElbow:baseJr[14]?baseJr[14].lvl:0};
    // Include per-landmark visibility scores so the native layer can compute a scan quality badge.
    const visibility=clearest.cap&&clearest.cap.lm?clearest.cap.lm.map(l=>l.v??0):[];
    // Sub-sample to max 150 ticks evenly so payload stays < 500 KB.
    var MAX_FT=150;
    var sampledTicks=frameTicks.length<=MAX_FT?frameTicks:Array.from({length:MAX_FT},function(_,i){return frameTicks[Math.round(i*(frameTicks.length-1)/(MAX_FT-1))];});
    post({type:"scanComplete",angles,risks,frame:worstFrameB64||clearest.full||"",visibility,frameTicks:sampledTicks});
  }

  // ── MediaPipe init + gating ──────────────────────────────────────────────────
  const BASE="${MEDIAPIPE_BASE}";
  const pose=new Pose({locateFile:f=>BASE+"/"+f});
  pose.setOptions({modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.60,minTrackingConfidence:.50});
  pose.onResults(onResults);

  let poseReady=false, dataReady=false, primed=false;
  function maybeScan(){ if(!poseReady||!dataReady||!primed||scanning)return; setTimeout(()=>{ if(!scanning) startScan(); }, 120); }
  function startScan(){
    if(scanning)return;
    duration=video.duration||0;
    if(!isFinite(duration)||duration<0.05){ singleFrame=true; scanning=true; scanPos=0; if((video.currentTime||0)<0.001) detect(); else { try{video.currentTime=0;}catch(e){detect();} } return; }
    scanning=true; scanPos=0; gotoStep();
  }

  pose.initialize().then(()=>{ poseReady=true; maybeScan(); })
    .catch(()=>{ finishScan(); });

  video.addEventListener("seeked",()=>{ if(scanning) detect(); });
  video.addEventListener("loadedmetadata",()=>{ post({type:"meta",vw:video.videoWidth,vh:video.videoHeight,dur:video.duration}); });
  video.addEventListener("loadeddata",()=>{
    // Prime the decoder with a brief muted play so subsequent seeks yield frames.
    const done=()=>{ primed=true; try{video.pause();}catch(e){} try{video.currentTime=0;}catch(e){} dataReady=true; maybeScan(); };
    const pr=video.play();
    if(pr&&pr.then){ pr.then(()=>setTimeout(done,60)).catch(done); } else { done(); }
  });
  video.addEventListener("error",()=>{ finishScan(); });

  video.src=VIDEO_URI; video.load();

  // Global safety net: never leave the native UI stuck in "scanning".
  setTimeout(()=>{ if(!finished) finishScan(); }, 45000);
})();
</script>
</body>
</html>`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
// JointHistorySheet is imported from @/components/JointHistorySheet
export default function SkeletonScreen() {
  const { id, nx: initNx, ny: initNy, nw: initNw, nh: initNh, highlightJoint } = useLocalSearchParams<{
    id: string; nx?: string; ny?: string; nw?: string; nh?: string; highlightJoint?: string;
  }>();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { profile } = useAuth();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const webviewRef = useRef<WebView>(null);
  const scrollRef  = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  const pollRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Identifies the analysis currently loaded; an in-flight poll/GET from a previous
  // id must never write tips/groundedReady for the analysis the user navigated away from.
  const currentIdRef = useRef<string | undefined>(undefined);
  // Monotonic per-scan token. currentIdRef only protects across *different* analyses;
  // re-scanning the *same* analysis while a previous poll is still in flight shares the
  // id, so an older poll could clobber the newer scan. Each runBiomechanics call captures
  // a fresh token and only writes state while it is still the latest.
  const runTokenRef = useRef(0);
  const checkInHourRef = useRef<number | undefined>(profile?.checkInHour);
  useEffect(() => { checkInHourRef.current = profile?.checkInHour; }, [profile?.checkInHour]);

  const [videoUri, setVideoUri]         = useState<string | undefined>();
  const [sport, setSport]               = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [tips, setTips]                 = useState<TipRecord[]>([]);
  const [injuryRisks, setInjuryRisks]   = useState<RiskRecord[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [qualityBannerDismissed, setQualityBannerDismissed] = useState(false);

  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`scanQualityDismissed_${id}`).then((val) => {
      if (val === "1") setQualityBannerDismissed(true);
    });
  }, [id]);

  const [scanResult,  setScanResult]  = useState<{ angles: Partial<AngleMap>; risks: RiskMap } | null>(null);
  const [captures,    setCaptures]    = useState<Capture[]>([]);
  const [scanDone,    setScanDone]    = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [layoutReady, setLayoutReady]   = useState(false);
  const [hasFrameTicks, setHasFrameTicks] = useState(false);
  const [frameTicks, setFrameTicks] = useState<FrameTick[]>([]);
  const [scrubRatio, setScrubRatio] = useState(0);
  // Current frozen frame shown in the hero + which joints are emphasised on it.
  const [hero, setHero] = useState<{ capture: Capture; emphasize: JointKey[] } | null>(null);
  const [expandedTipId, setExpandedTipId] = useState<string | null>(null);
  // Ensures a deep-linked joint highlight (from the detail screen) fires only once.
  const didDeepLinkRef = useRef(false);
  const [refining,    setRefining]    = useState(false);
  // True only when `tips` in state reflect a server biomechanicsApplied=true result.
  // Gates injury/performance tip rendering so stale create-time tips never show.
  const [groundedReady, setGroundedReady] = useState(false);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [preparing,   setPreparing]   = useState(true);
  const [htmlFileUri, setHtmlFileUri] = useState<string | null>(null);
  const [prevAngles,  setPrevAngles]  = useState<Partial<Record<string, number>>>({});
  const [prevRisks,   setPrevRisks]   = useState<Partial<Record<string, number>>>({});
  const [jointTrendsData, setJointTrendsData] = useState<JointTrendsResponse | null>(null);
  const [historyJoint, setHistoryJoint] = useState<string | null>(null);
  const [completedDrills, setCompletedDrills] = useState<Set<string>>(new Set());

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Load analysis data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // id-scoped reset: a new analysis must never inherit the previous one's grounded
    // tips or an in-flight poll. groundedReady is reset HERE (not in the HTML-rebuild
    // effect, which is keyed on video/sport and would otherwise clobber a grounded load).
    currentIdRef.current = id;
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    setRefining(false);
    setGroundedReady(false);
    setTips([]);
    setInjuryRisks([]);
    // Drop the previous analysis's video so the scanner can never build/scan with a
    // stale clip for the new id. The undefined→new-uri transition also re-runs the
    // HTML-build effect, which resets all scan state (scanResult/captures/hero/scanDone)
    // even when two analyses happen to share a video URI and sport.
    setVideoUri(undefined);
    AsyncStorage.getItem(`video_uri_${id}`).then((uri) => { if (!cancelled && uri) setVideoUri(uri); });
    analysesApi.get(id).then(({ analysis, tips: t, injuryRisks: r }) => {
      if (cancelled) return;
      setSport(analysis.sport ?? "");
      setThumbnailUrl(analysis.thumbnailUrl ?? null);
      setTips(t ?? []);
      setInjuryRisks(r ?? []);
      // If this analysis was already grounded on a prior scan, the loaded tips are
      // grounded — surface them immediately instead of waiting for a fresh scan.
      if (analysis.biomechanicsApplied) setGroundedReady(true);
    }).catch(() => {});

    // Fetch joint trend history to compute "vs last session" delta badges.
    setPrevAngles({});
    setPrevRisks({});
    setJointTrendsData(null);
    jointTrends.get().then((trends: JointTrendsResponse) => {
      if (cancelled) return;
      setJointTrendsData(trends);
      const newPrevAngles: Partial<Record<string, number>> = {};
      const newPrevRisks: Partial<Record<string, number>> = {};
      Object.entries(trends.joints).forEach(([joint, points]) => {
        const sorted = [...points].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const idx = sorted.findIndex((p) => p.analysisId === id);
        if (idx > 0) {
          newPrevAngles[joint] = sorted[idx - 1].angle;
          newPrevRisks[joint]  = sorted[idx - 1].risk;
        }
      });
      setPrevAngles(newPrevAngles);
      setPrevRisks(newPrevRisks);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [id]);

  // ── Load + persist completed drills per-analysis ─────────────────────────────
  // AsyncStorage is the source of truth for the current session UI; the server
  // is the persistence layer so the AI coach always knows the full history.
  useEffect(() => {
    if (!id) return;
    setCompletedDrills(new Set());

    const loadLocal = AsyncStorage.getItem(`drill_done_${id}`).then((raw) => {
      if (raw) {
        try { return new Set(JSON.parse(raw) as string[]); } catch {}
      }
      return new Set<string>();
    }).catch(() => new Set<string>());

    const loadRemote = drillsApi.getCompleted(id).then((r) => new Set(r.completedTipIds)).catch(() => new Set<string>());

    Promise.all([loadLocal, loadRemote]).then(([local, remote]) => {
      const merged = new Set([...local, ...remote]);
      setCompletedDrills(merged);
      if (merged.size > 0 && id) {
        AsyncStorage.setItem(`drill_done_${id}`, JSON.stringify([...merged])).catch(() => {});
      }
    }).catch(() => {});
  }, [id]);

  const toggleDrillDone = useCallback((tipId: string, drillName?: string) => {
    setCompletedDrills((prev) => {
      const next = new Set(prev);
      const marking = !next.has(tipId);
      if (marking) { next.add(tipId); } else { next.delete(tipId); }
      if (id) {
        AsyncStorage.setItem(`drill_done_${id}`, JSON.stringify([...next])).catch(() => {});
        if (marking) {
          drillsApi.markDone(id, tipId, drillName).catch(() => {});
        } else {
          drillsApi.markUndone(id, tipId).catch(() => {});
        }
      }
      return next;
    });
  }, [id]);

  // Track mount so the biomechanics poll loop never calls setState after unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // After a scan we PATCH the measured worst-frame data, then poll the analysis
  // until the server re-grounds the AI tips on that data (biomechanicsApplied).
  // This is the race fix: tips only swap in once they reflect *this* scan.
  const runBiomechanics = useCallback((analysisId: string, payload: {
    jointAngles: Partial<AngleMap>; jointRisks: RiskMap; frameBase64?: string;
  }, sportName: string) => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    // Capture a fresh token for this scan. A previous scan's in-flight request (already
    // dispatched, so clearing pollRef's timeout can't stop it) will see a stale token and
    // bail before writing, so an older overlapping scan can never clobber this newer one.
    const token = ++runTokenRef.current;
    const isCurrent = () => mountedRef.current && currentIdRef.current === analysisId && runTokenRef.current === token;
    setRefining(true);
    analysesApi.update(analysisId, payload)
      .then(({ improvements }) => {
        if (improvements?.length) {
          scheduleImprovementNotification(improvements, sportName, checkInHourRef.current).catch(() => {});
        }
        if (!isCurrent()) return;
        let attempts = 0;
        const poll = () => {
          attempts += 1;
          analysesApi.get(analysisId)
            .then(({ analysis, tips: t, injuryRisks: r }) => {
              if (!isCurrent()) return;
              if (analysis.biomechanicsApplied) {
                setTips(t ?? []);
                setInjuryRisks(r ?? []);
                setGroundedReady(true);
                setRefining(false);
                pollRef.current = null;
                AsyncStorage.removeItem(`drill_done_${analysisId}`).catch(() => {});
                setCompletedDrills(new Set());
              } else if (attempts < 20) {
                pollRef.current = setTimeout(poll, 1800);
              } else {
                setRefining(false);
              }
            })
            .catch(() => {
              if (!isCurrent()) return;
              if (attempts < 20) pollRef.current = setTimeout(poll, 1800);
              else setRefining(false);
            });
        };
        pollRef.current = setTimeout(poll, 2000);
      })
      .catch(() => { if (isCurrent()) setRefining(false); });
  }, []);

  // ── Messages from the headless scanner ──────────────────────────────────────
  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "meta" && msg.vw > 0 && msg.vh > 0) {
        setVideoAspect(msg.vw / msg.vh);
        if (id) AsyncStorage.setItem(`videoAspect_${id}`, String(msg.vw / msg.vh)).catch(() => {});
        return;
      }
      if (msg.type === "layoutReady") {
        setLayoutReady(true);
        return;
      }
      if (msg.type === "progress") {
        if (typeof msg.value === "number") setScanProgress(Math.max(0, Math.min(1, msg.value)));
        return;
      }
      if (msg.type === "capture" && msg.capture && msg.capture.id) {
        const cap = msg.capture as Capture;
        setCaptures((prev) => (prev.some((c) => c.id === cap.id) ? prev : [...prev, cap]));
        return;
      }
      if (msg.type === "scanComplete") {
        setScanProgress(1);
        setScanDone(true);
        // A scan only counts as real data when at least one joint angle was actually
        // measured. Model-load / video-decode / watchdog failures still post a
        // scanComplete, but with empty angles ({} or all-undefined). Treating that as a
        // result would PATCH bogus biomechanics and ground AI tips on a pose that was
        // never measured. On no measurement we leave tips ungrounded and let the hero
        // fall back to its "couldn't detect the athlete" state.
        const angles = (msg.angles ?? {}) as Partial<AngleMap>;
        const measured = Object.values(angles).some((v) => typeof v === "number" && Number.isFinite(v));
        if (!measured || !msg.risks) return;
        setScanResult({ angles, risks: msg.risks as RiskMap });
        // Derive scan quality from average landmark visibility (0..1) in the payload.
        if (Array.isArray(msg.visibility) && msg.visibility.length > 0) {
          // No longer using scanQuality state — computeScanQuality is called inline in render.
        }
        // Already-grounded revisit: the fresh scan only refreshes the frozen frames,
        // so don't re-PATCH/re-poll — that would flip `refining` on and momentarily
        // hide the grounded tips behind the refinement spinner. Only first-time scans
        // (not yet grounded) need to ground the AI tips on the measured data.
        if (id) {
          const ticks = msg.frameTicks ?? [];
          AsyncStorage.setItem(`frameTicks_${id}`, JSON.stringify(ticks)).catch(() => {});
          if (Array.isArray(ticks) && ticks.length > 0) {
            setHasFrameTicks(true);
            setFrameTicks(ticks);
            setScrubRatio(0);
          }
        }
        if (id && !groundedReady) {
          runBiomechanics(id, {
            jointAngles: angles,
            jointRisks: msg.risks as RiskMap,
            frameBase64: msg.frame || undefined,
          }, sport);
        }
        return;
      }
    } catch {}
  }

  // ── Default hero: highest-risk capture, emphasising its worst joints ─────────
  useEffect(() => {
    if (hero) return;
    if (!captures.length) return;
    const h = pickHeroCapture(captures);
    if (h) setHero({ capture: h, emphasize: h.joints.slice(0, 2) });
  }, [captures, hero]);

  // ── Load frameTicks for scrubber (from AsyncStorage after scan or on mount) ──
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`frameTicks_${id}`).then((raw) => {
      if (!raw) return;
      try {
        const ticks = JSON.parse(raw) as FrameTick[];
        if (Array.isArray(ticks) && ticks.length > 0) {
          setFrameTicks(ticks);
          setHasFrameTicks(true);
        }
      } catch {}
    }).catch(() => {});
  }, [id]);

  // ── Scrubber: derive active tick from ratio ──────────────────────────────────
  const scrubTick = useMemo(() => {
    if (!frameTicks.length) return null;
    const t0 = frameTicks[0]?.t ?? 0;
    const t1 = frameTicks[frameTicks.length - 1]?.t ?? 0;
    const duration = t1 - t0;
    if (duration <= 0) return frameTicks[0] ?? null;
    return bsearchTick(frameTicks, t0 + scrubRatio * duration);
  }, [frameTicks, scrubRatio]);

  const scrubDuration = useMemo(() => {
    if (frameTicks.length < 2) return 0;
    return (frameTicks[frameTicks.length - 1]?.t ?? 0) - (frameTicks[0]?.t ?? 0);
  }, [frameTicks]);

  const scrubTrackWidthRef = useRef(1);

  const scrubPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => frameTicks.length > 0,
        onMoveShouldSetPanResponder: () => frameTicks.length > 0,
        onPanResponderGrant: (evt) => {
          const x = evt.nativeEvent.locationX;
          setScrubRatio(Math.max(0, Math.min(1, x / scrubTrackWidthRef.current)));
        },
        onPanResponderMove: (evt) => {
          const x = evt.nativeEvent.locationX;
          setScrubRatio(Math.max(0, Math.min(1, x / scrubTrackWidthRef.current)));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameTicks.length],
  );

  // ── Build HTML to disk ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPreparing(true);
    setHtmlFileUri(null);
    setScanResult(null);
    setCaptures([]);
    setHero(null);
    setScanDone(false);
    setScanProgress(0);
    setLayoutReady(false);
    setExpandedTipId(null);
    didDeepLinkRef.current = false;
    setRefining(false);
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    setVideoAspect(16 / 9);

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
        const htmlPath = cacheDir + "pose-scanner.html";
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

  // ── Tips & derived values ───────────────────────────────────────────────────
  const injuryTips      = useMemo(() => tips.filter((t) => t.tipType === "injury" || t.severity === "warning" || t.severity === "critical"), [tips]);
  const performanceTips = useMemo(() => tips.filter((t) => t.tipType === "performance" && t.severity === "info"), [tips]);

  // Joints that appear in BOTH an injury tip AND a performance tip — these pairs
  // give contradictory instructions. We flag them so the UI can label the injury
  // tip "Fix this first" and warn the performance tip to wait until it's resolved.
  const conflictedJoints = useMemo<Set<string>>(
    () => computeConflictedJoints(tips),
    [tips],
  );

  // Sorted tip lists derived from conflict data:
  //   • Injury section  — conflicted tips rise to the top ("Fix this first" banner already labels them)
  //   • Performance section — conflicted tips sink to the bottom ("After injury resolution" banner already labels them)
  const sortedInjuryTips = useMemo(
    () => sortInjuryTips(injuryTips, conflictedJoints),
    [injuryTips, conflictedJoints],
  );
  const sortedPerformanceTips = useMemo(
    () => sortPerformanceTips(performanceTips, conflictedJoints),
    [performanceTips, conflictedJoints],
  );

  // Joints the scan flagged (level ≥ 1) — the ground truth the injury section and
  // joint chips correspond to. Sorted worst-first.
  const flaggedJoints = useMemo(
    () => scanResult ? computeFlaggedJoints(scanResult.risks) : ([] as JointKey[]),
    [scanResult],
  );
  const worstLvl = useMemo(
    () => computeWorstLvl(flaggedJoints, scanResult?.risks ?? {} as RiskMap),
    [flaggedJoints, scanResult],
  );

  // ── Interactions: pick which frozen frame the hero shows ─────────────────────
  const selectJoint = useCallback((j: JointKey) => {
    const cap = captureForJoints(captures, [j]);
    if (cap) setHero({ capture: cap, emphasize: [j] });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [captures]);

  const openTip = useCallback((tip: TipRecord) => {
    const willExpand = expandedTipId !== tip.id;
    setExpandedTipId(willExpand ? tip.id : null);
    if (willExpand) {
      const js = (tip.joints ?? []).filter((j) => j in JOINT_LABEL) as JointKey[];
      const cap = captureForJoints(captures, js);
      if (cap) setHero({ capture: cap, emphasize: js });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [captures, expandedTipId]);

  const askCoach = useCallback(async (tip: TipRecord) => {
    const js = (tip.joints ?? []).filter((j) => j in JOINT_LABEL) as JointKey[];
    const jointStr = js.map((j) => JOINT_LABEL[j]).join(", ");
    const readings = js
      .map((j) => {
        const d = scanResult?.angles?.[j];
        const l = scanResult?.risks?.[j] ?? 0;
        return typeof d === "number" ? `${JOINT_LABEL[j]} ${Math.round(d)}° (${RISK_WORD[l]})` : null;
      })
      .filter(Boolean)
      .join(", ");
    const isConflictedPerformanceTip =
      tip.tipType === "performance" &&
      (tip.joints ?? []).some((j) => conflictedJoints.has(j));
    const conflictWarning = isConflictedPerformanceTip
      ? "Note: there is an open injury risk on this joint — please address that first. "
      : "";

    // Build completed-drills context so the coach knows what has already been done.
    const allTips = [...injuryTips, ...performanceTips];
    const thisDrillDone = completedDrills.has(tip.id);
    const otherDoneDrillNames = allTips
      .filter((t) => t.id !== tip.id && completedDrills.has(t.id) && t.drill?.name)
      .map((t) => t.drill!.name);

    let completedCtx = "";
    if (thisDrillDone && otherDoneDrillNames.length > 0) {
      completedCtx =
        ` I have already completed this drill. Other drills I've finished this session: ${otherDoneDrillNames.join(", ")}.` +
        ` Please suggest a progression rather than repeating what I've done.`;
    } else if (thisDrillDone) {
      completedCtx = ` I have already completed this drill — please suggest what to work on next as a progression.`;
    } else if (otherDoneDrillNames.length > 0) {
      completedCtx = ` Other drills I've already completed this session: ${otherDoneDrillNames.join(", ")}.`;
    }

    const msg =
      conflictWarning +
      `I'm working on my ${sport || "training"} form. My coaching report flagged "${tip.title}"` +
      `${jointStr ? ` around my ${jointStr}` : ""}.` +
      `${readings ? ` Measured from my video: ${readings}.` : ""}` +
      `${tip.description ? ` ${tip.description}` : ""}` +
      completedCtx +
      ` How do I fix this, and what should I focus on first?`;
    await AsyncStorage.setItem(PENDING_CHAT_KEY, msg);
    router.push("/(tabs)/chat" as any);
  }, [scanResult, sport, router, conflictedJoints, completedDrills, injuryTips, performanceTips]);

  // ── Deep link from the detail screen: open the tapped joint's frozen frame ───
  useEffect(() => {
    if (didDeepLinkRef.current) return;
    if (!scanDone || !captures.length) return;
    if (!highlightJoint || !(highlightJoint in JOINT_LABEL)) return;
    didDeepLinkRef.current = true;
    const cap = captureForJoints(captures, [highlightJoint as JointKey]);
    if (cap) setHero({ capture: cap, emphasize: [highlightJoint as JointKey] });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scanDone, captures, highlightJoint]);

  // Once tips are grounded, expand the deep-linked joint's tip (if any).
  useEffect(() => {
    if (!highlightJoint || !groundedReady) return;
    const hit =
      injuryTips.find((t) => (t.joints ?? []).includes(highlightJoint as JointKey)) ??
      performanceTips.find((t) => (t.joints ?? []).includes(highlightJoint as JointKey));
    if (hit) setExpandedTipId((prev) => prev ?? hit.id);
  }, [groundedReady, highlightJoint, injuryTips, performanceTips]);

  // ── "vs last session" delta badge ───────────────────────────────────────────
  function renderDeltaBadge(joint: string, currentDeg: number | undefined, currentRisk: number) {
    if (typeof currentDeg !== "number") return null;
    const pDeg  = prevAngles[joint];
    const pRisk = prevRisks[joint];
    if (typeof pDeg !== "number") return null;
    const delta = Math.round(currentDeg - pDeg);
    if (delta === 0) return null;
    let badgeColor = "#f59e0b";
    if (typeof pRisk === "number") {
      if (currentRisk < pRisk)      badgeColor = "#22c55e";
      else if (currentRisk > pRisk) badgeColor = "#ef4444";
    }
    const sign = delta > 0 ? "+" : "";
    const hasHistory = !!(jointTrendsData?.joints[joint]?.length);
    if (hasHistory) {
      return (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); setHistoryJoint(joint); }}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[ss.deltaBadge, ss.deltaBadgeTappable, { color: badgeColor, borderColor: badgeColor + "88", backgroundColor: badgeColor + "18" }]}>
            {sign}{delta}°
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <Text style={[ss.deltaBadge, { color: badgeColor, borderColor: badgeColor + "55", backgroundColor: badgeColor + "18" }]}>
        {sign}{delta}°
      </Text>
    );
  }

  // ── Joint chips: measured angle + risk colour, tap to inspect / see history ───
  function renderJointChips(joints?: string[]) {
    const arr = (joints ?? []).filter((j) => j in JOINT_LABEL) as JointKey[];
    if (arr.length === 0) return null;
    return (
      <View style={ss.chipRow}>
        {arr.map((j) => {
          const lvl = scanResult?.risks?.[j];
          const deg = scanResult?.angles?.[j];
          const color = typeof lvl === "number" ? RISK_COLORS[lvl] : "#6c63ff";
          const hasHistory = !!(jointTrendsData?.joints[j]?.length);
          return (
            <TouchableOpacity
              key={j}
              style={[ss.chip, { borderColor: color + "66", backgroundColor: color + "14" }]}
              onPress={() => {
                if (hasHistory) {
                  setHistoryJoint(j);
                } else {
                  selectJoint(j);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[ss.chipDot, { backgroundColor: color }]} />
              <Text style={[ss.chipText, { color }]}>
                {JOINT_LABEL[j]}{typeof deg === "number" ? ` · ${Math.round(deg)}°` : ""}
              </Text>
              {renderDeltaBadge(j, deg, typeof lvl === "number" ? lvl : 0)}
              {hasHistory && !prevAngles[j] && (
                <Feather name="bar-chart-2" size={10} color={color + "99"} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ── Expandable coaching card ─────────────────────────────────────────────────
  const miniW = screenW - 64;
  function buildNextStepCue(drill: DrillRecord | string, kind: "injury" | "performance"): string {
    if (typeof drill === "object" && drill !== null) {
      const setsNum = parseInt((drill as DrillRecord).sets, 10);
      if (!isNaN(setsNum)) {
        return kind === "performance"
          ? `Try ${setsNum + 1} sets next session, or cut rest to 45 s between rounds.`
          : `Progress to ${setsNum + 1} sets, or slow the eccentric to 3 seconds per rep.`;
      }
      return kind === "performance"
        ? `Add one more round, or reduce rest time to increase the training stimulus.`
        : `Increase volume gradually, or add a 2-second pause at end range.`;
    }
    return kind === "performance"
      ? `Build on this by adding one more round or advancing to a harder variation.`
      : `Increase volume gradually, or add a 2-second end-range pause each rep.`;
  }

  function renderTip(tip: TipRecord, kind: "injury" | "performance") {
    const tjoints = (tip.joints ?? []).filter((j) => j in JOINT_LABEL) as JointKey[];
    const lvls = tjoints.map((j) => scanResult?.risks?.[j]).filter((v): v is number => typeof v === "number");
    const color = kind === "performance"
      ? "#6c63ff"
      : (lvls.length ? RISK_COLORS[Math.max(...lvls)] : (tip.severity === "critical" ? RISK_COLORS[2] : tip.severity === "warning" ? RISK_COLORS[1] : "#f59e0b"));
    const expanded = expandedTipId === tip.id;
    const matchedRisk = injuryRisks.find((r) => riskMatchesJoints(r.joint, tjoints));
    const mini = expanded ? captureForJoints(captures, tjoints) : null;

    // Conflict detection: does this tip share a joint with a tip of the opposite type?
    const hasConflict = tjoints.some((j) => conflictedJoints.has(j));

    return (
      <View key={tip.id} style={[ss.tipCard, kind === "performance" ? ss.perfCard : { borderColor: color + "44" }]}>
        {/* Conflict priority banner */}
        {hasConflict && kind === "injury" && (
          <View style={ss.conflictBannerInjury}>
            <Feather name="alert-triangle" size={11} color="#f59e0b" />
            <Text style={ss.conflictBannerInjuryText}>⚠ Fix this first</Text>
          </View>
        )}
        {hasConflict && kind === "performance" && (
          <View style={ss.conflictBannerPerf}>
            <Feather name="clock" size={11} color="#8888aa" />
            <Text style={ss.conflictBannerPerfText}>After injury risk is resolved</Text>
          </View>
        )}
        <TouchableOpacity activeOpacity={0.85} onPress={() => openTip(tip)}>
          <View style={ss.tipHeader}>
            <View style={[ss.tipIcon, { backgroundColor: color + "1a" }]}>
              <Feather name={kind === "performance" ? "trending-up" : (color === RISK_COLORS[2] ? "alert-triangle" : "alert-circle")} size={14} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ss.tipCategory, { color }]}>{tip.category}</Text>
              <Text style={ss.tipTitle}>{tip.title}</Text>
            </View>
            {tip.drill && completedDrills.has(tip.id) && (
              <View style={ss.drillDoneBadge}>
                <Feather name="check" size={10} color="#22c55e" />
                <Text style={ss.drillDoneBadgeText}>Done</Text>
              </View>
            )}
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#55556e" />
          </View>
        </TouchableOpacity>

        {tjoints.length > 0 && renderJointChips(tjoints)}

        {expanded && (
          <View style={{ gap: 11, marginTop: 2 }}>
            {mini && (
              <View style={ss.miniWrap}>
                <FrozenSkeleton capture={mini} width={miniW} height={Math.round(Math.min(miniW / mini.aspect, 260))} emphasize={tjoints} />
                <View style={ss.miniTag}>
                  <Feather name="crosshair" size={9} color="#fff" />
                  <Text style={ss.miniTagText}>Your frame · worst moment</Text>
                </View>
              </View>
            )}
            {tip.videoObservation ? <Text style={ss.tipObs}>“{tip.videoObservation}”</Text> : null}
            <Text style={ss.tipDesc}>{tip.description}</Text>
            {tip.whyItMatters ? (
              <View style={ss.whyBox}>
                <Text style={ss.whyLabel}>WHY THIS MATTERS</Text>
                <Text style={ss.whyText}>{tip.whyItMatters}</Text>
              </View>
            ) : null}

            {tjoints.length > 0 && (
              <View style={ss.readingRow}>
                {tjoints.map((j) => {
                  const d = scanResult?.angles?.[j];
                  const l = scanResult?.risks?.[j] ?? 0;
                  const c = RISK_COLORS[l];
                  return (
                    <View key={j} style={[ss.readingPill, { borderColor: c + "55" }]}>
                      <View style={[ss.chipDot, { backgroundColor: c }]} />
                      <Text style={[ss.readingText, { color: c }]}>
                        {JOINT_LABEL[j]} {typeof d === "number" ? `${Math.round(d)}°` : "--"} · {RISK_WORD[l]}
                      </Text>
                      {renderDeltaBadge(j, d, l)}
                    </View>
                  );
                })}
              </View>
            )}

            {matchedRisk && (
              <View style={ss.riskBox}>
                <View style={ss.riskHead}>
                  <Feather name="activity" size={12} color="#ef4444" />
                  <Text style={ss.riskTitle}>{matchedRisk.joint} · {Math.round(matchedRisk.riskPercent)}% injury risk</Text>
                </View>
                <View style={ss.riskBarTrack}>
                  <View style={[ss.riskBarFill, { width: `${Math.max(4, Math.min(100, matchedRisk.riskPercent))}%` }]} />
                </View>
                <Text style={ss.riskDesc}>{matchedRisk.description}</Text>
                {matchedRisk.prevention ? (
                  <>
                    <Text style={ss.riskPrevLabel}>PREVENTION</Text>
                    <Text style={ss.riskPrev}>{matchedRisk.prevention}</Text>
                  </>
                ) : null}
              </View>
            )}

            {tip.drill ? (() => {
              const drill = tip.drill as DrillRecord | string;
              const isStructured = typeof drill === "object" && drill !== null;
              const accentColor = kind === "performance" ? "#6c63ff" : "#f59e0b";
              return (
                <View style={[ss.drillBox, { borderColor: accentColor + "40", backgroundColor: kind === "performance" ? "#0e0e28" : "#16140e" }]}>
                  <Text style={[ss.drillLabel, { color: accentColor }]}>
                    {kind === "performance" ? "PERFORMANCE DRILL" : "CORRECTIVE ROUTINE"}
                  </Text>
                  {isStructured ? (
                    <View style={ss.drillStructured}>
                      <Text style={ss.drillName}>{(drill as DrillRecord).name}</Text>
                      <View style={ss.drillMeta}>
                        <View style={ss.drillMetaPill}>
                          <Text style={[ss.drillMetaLabel, { color: accentColor }]}>SETS</Text>
                          <Text style={ss.drillMetaValue}>{(drill as DrillRecord).sets}</Text>
                        </View>
                        <View style={ss.drillMetaPill}>
                          <Text style={[ss.drillMetaLabel, { color: accentColor }]}>REPS</Text>
                          <Text style={ss.drillMetaValue}>{(drill as DrillRecord).reps}</Text>
                        </View>
                      </View>
                      <View style={ss.drillCueRow}>
                        <Feather name="message-square" size={11} color={accentColor} />
                        <Text style={ss.drillCueText}>{(drill as DrillRecord).cue}</Text>
                      </View>
                      {(drill as DrillRecord).drillFeelCue ? (
                        <View style={ss.drillFeelRow}>
                          <Feather name="activity" size={11} color={accentColor + "99"} />
                          <Text style={[ss.drillFeelText, { color: accentColor + "cc" }]}>
                            {"Feel: "}{(drill as DrillRecord).drillFeelCue}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={ss.drillText}>{drill as string}</Text>
                  )}
                  <TouchableOpacity
                    style={[ss.markDoneBtn, completedDrills.has(tip.id) && ss.markDoneBtnDone]}
                    activeOpacity={0.8}
                    onPress={() => toggleDrillDone(tip.id, tip.drill?.name)}
                  >
                    <Feather
                      name={completedDrills.has(tip.id) ? "check-circle" : "circle"}
                      size={14}
                      color={completedDrills.has(tip.id) ? "#22c55e" : accentColor + "99"}
                    />
                    <Text style={[ss.markDoneBtnText, completedDrills.has(tip.id) && ss.markDoneBtnTextDone]}>
                      {completedDrills.has(tip.id) ? "Completed" : "Mark done"}
                    </Text>
                  </TouchableOpacity>
                  {completedDrills.has(tip.id) && (
                    <View style={ss.nextStepCard}>
                      <View style={ss.nextStepHeader}>
                        <Feather name="arrow-right-circle" size={13} color="#22c55e" />
                        <Text style={ss.nextStepLabel}>WHAT'S NEXT?</Text>
                      </View>
                      <Text style={ss.nextStepCue}>
                        {buildNextStepCue(drill, kind)}
                      </Text>
                      <TouchableOpacity
                        style={ss.nextStepAskBtn}
                        activeOpacity={0.8}
                        onPress={() => askCoach(tip)}
                      >
                        <Feather name="message-circle" size={12} color="#22c55e" />
                        <Text style={ss.nextStepAskBtnText}>Ask Coach to plan my progression</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })() : null}

            {tip.source ? (
              <View style={ss.citeRow}>
                <Feather name="book-open" size={10} color="#55556e" />
                <Text style={ss.citeText}>{tip.source}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={ss.askBtn} activeOpacity={0.85} onPress={() => askCoach(tip)}>
              <Feather name="message-circle" size={14} color="#fff" />
              <Text style={ss.askBtnText}>Ask Coach about this</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Hero sizing ──────────────────────────────────────────────────────────────
  const heroAspect = hero?.capture.aspect ?? videoAspect;
  const heroBoxW = screenW;
  const heroBoxH = Math.round(Math.max(240, Math.min(screenW / heroAspect, screenH * 0.52)));
  const heroLvl = hero?.capture.maxLvl ?? 0;
  const heroPrimary = hero?.capture.joints[0];
  const heroScanQuality = hero ? computeScanQuality(hero.capture) : null;

  // scanner is embedded in heroBlock below; this is kept as null to avoid
  // accidentally mounting a second WebView instance.
  const scanner = null;

  // ── Hero block ───────────────────────────────────────────────────────────────
  const heroBlock = !videoUri ? null : preparing ? (
    <View style={[ss.heroSlot, { height: heroBoxH }]}>
      <ActivityIndicator color="#6c63ff" size="large" />
      <Text style={ss.preparingText}>Preparing your clip…</Text>
    </View>
  ) : !scanDone ? (
    // Live scanner WebView fills the hero slot — user sees each seek-frame with
    // the skeleton overlay drawn on top. Progress bar floats at the bottom.
    <View style={{ width: heroBoxW, height: heroBoxH, backgroundColor: "#05050c" }} pointerEvents="none">
      {(!preparing && htmlFileUri) ? (
        <WebView
          ref={webviewRef}
          source={{ uri: htmlFileUri }}
          style={{ width: heroBoxW, height: heroBoxH }}
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
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator color="#6c63ff" size="large" />
          <Text style={ss.preparingText}>Preparing your clip…</Text>
        </View>
      )}
      {/* Progress overlay */}
      <View style={ss.scanOverlay}>
        <Text style={ss.scanOverlayTitle}>
          {layoutReady ? "Tracking your movement" : "Preparing scan…"}
        </Text>
        <View style={ss.progTrack}>
          <View style={[ss.progFill, { width: `${Math.round(scanProgress * 100)}%` }]} />
        </View>
        <Text style={ss.scanOverlaySub}>
          {layoutReady
            ? `${Math.round(scanProgress * 100)}% — measuring joints`
            : "Waiting for first frame…"}
        </Text>
      </View>
    </View>
  ) : hero ? (
    <View>
      {/* Static freeze frame with optional scrub overlay */}
      <View style={{ width: heroBoxW, height: heroBoxH }}>
        <FrozenSkeleton capture={hero.capture} width={heroBoxW} height={heroBoxH} emphasize={scrubTick ? [] : hero.emphasize} />
        {scrubTick && scrubTick.lm.length > 0 && (() => {
          const rect = containRect(heroBoxW, heroBoxH, heroAspect);
          const proj = (idx: number) => {
            const lm = scrubTick.lm[idx];
            if (!lm || lm.v < 0.3) return null;
            return { x: rect.left + lm.x * rect.width, y: rect.top + lm.y * rect.height };
          };
          const lmRisk: Record<number, number> = {};
          for (const [jKey, jIdx] of Object.entries(SCRUB_JOINT_IDX)) {
            lmRisk[jIdx as number] = scrubTick.jr[jKey as keyof typeof scrubTick.jr]?.lvl ?? 0;
          }
          const bones = SCRUB_CONNECTIONS.map(([a, b], i) => {
            const pa = proj(a);
            const pb = proj(b);
            if (!pa || !pb) return null;
            const risk = Math.max(lmRisk[a] ?? 0, lmRisk[b] ?? 0);
            const color = risk >= 2 ? "#ef4444aa" : risk >= 1 ? "#f59e0baa" : "#6c63ffaa";
            return <Line key={`sb${i}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={3} strokeLinecap="round" />;
          }).filter(Boolean);
          const dots = SCRUB_KEY_LM.map((idx) => {
            const p = proj(idx);
            if (!p) return null;
            const risk = lmRisk[idx] ?? 0;
            const color = risk >= 2 ? "#ef4444" : risk >= 1 ? "#f59e0b" : "#f8fafc";
            const r = risk >= 1 ? 6 : 4;
            return (
              <G key={`sd${idx}`}>
                {risk >= 1 && <Circle cx={p.x} cy={p.y} r={r + 5} fill={color + "28"} />}
                <Circle cx={p.x} cy={p.y} r={r} fill={color} stroke="rgba(7,7,15,0.85)" strokeWidth={1.2} />
              </G>
            );
          }).filter(Boolean);
          const angleLabels = (Object.keys(SCRUB_JOINT_IDX) as (keyof typeof SCRUB_JOINT_IDX)[]).map((jKey) => {
            const jr = scrubTick.jr[jKey as keyof typeof scrubTick.jr];
            if (!jr || jr.lvl < 1) return null;
            const idx = SCRUB_JOINT_IDX[jKey];
            if (idx === undefined) return null;
            const p = proj(idx);
            if (!p) return null;
            const color = RISK_COLORS[Math.min(2, jr.lvl)];
            const label = `${JOINT_LABEL[jKey as keyof typeof JOINT_LABEL]}  ${Math.round(jr.deg)}°`;
            const scale = Math.max(0.7, Math.min(rect.width, rect.height) / 320);
            const w = (label.length * 6.4 + 14) * scale;
            const h = 19 * scale;
            const onLeft = p.x > rect.left + rect.width * 0.55;
            const bx = onLeft ? p.x - w - 9 * scale : p.x + 9 * scale;
            const by = Math.max(rect.top + 2, p.y - h / 2);
            return (
              <G key={`sl${jKey}`}>
                <Rect x={bx} y={by} width={w} height={h} rx={h / 2} fill="rgba(7,7,15,0.82)" stroke={color} strokeWidth={1.2 * scale} />
                <SvgText x={bx + w / 2} y={by + h / 2 + 3.6 * scale} fill="#f8fafc" fontSize={11 * scale} fontWeight="700" textAnchor="middle">{label}</SvgText>
              </G>
            );
          }).filter(Boolean);
          return (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {bones}
              {dots}
              {angleLabels}
            </Svg>
          );
        })()}
      </View>
      <View style={ss.heroBanner} pointerEvents="none">
        <View style={[ss.heroBadge, { backgroundColor: RISK_COLORS[heroLvl] + "26", borderColor: RISK_COLORS[heroLvl] + "80" }]}>
          <View style={[ss.chipDot, { backgroundColor: RISK_COLORS[heroLvl] }]} />
          <Text style={[ss.heroBadgeText, { color: RISK_COLORS[heroLvl] }]}>
            {heroPrimary
              ? `${RISK_WORD[heroLvl]} · ${JOINT_LABEL[heroPrimary]} ${Math.round(hero.capture.jr[heroPrimary]?.deg ?? 0)}°`
              : "FORM LOOKS CLEAN"}
          </Text>
        </View>
        {(() => {
          const qColor = heroScanQuality === "high" ? "#22c55e" : heroScanQuality === "medium" ? "#f59e0b" : "#6b7280";
          return (
            <View style={[ss.scanQualityBadge, { borderColor: qColor + "60" }]}>
              <Feather
                name={heroScanQuality === "high" ? "shield" : heroScanQuality === "medium" ? "shield" : "alert-circle"}
                size={10}
                color={qColor}
                style={{ opacity: heroScanQuality === "medium" ? 0.65 : 1 }}
              />
              <Text style={[ss.scanQualityText, { color: qColor }]}>
                {heroScanQuality === "high" ? "High confidence" : heroScanQuality === "medium" ? "Medium confidence" : "Low confidence"}
              </Text>
            </View>
          );
        })()}
      </View>

      {/* Low-confidence dismissible banner */}
      {heroScanQuality === "low" && !qualityBannerDismissed && (
        <View style={ss.scanQualityLowBanner}>
          <Feather name="alert-circle" size={15} color="#ef4444" style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ss.scanQualityLowBannerTitle}>Athlete not clearly visible</Text>
            <Text style={ss.scanQualityLowBannerBody}>
              The skeleton had trouble tracking the athlete. Try re-selecting them or re-recording in better lighting for more accurate results.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/analysis/person-select/${id}` as any)}
            >
              <Text style={ss.scanQualityLowBannerLink}>Re-select athlete →</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            testID="scan-quality-banner-dismiss"
            onPress={() => {
              setQualityBannerDismissed(true);
              if (id) AsyncStorage.setItem(`scanQualityDismissed_${id}`, "1");
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="x" size={14} color="#ef444466" />
          </TouchableOpacity>
        </View>
      )}

      {/* Medium-confidence inline note */}
      {heroScanQuality === "medium" && (
        <View style={ss.scanQualityMedNote}>
          <Feather name="info" size={11} color="#f59e0b" style={{ opacity: 0.75 }} />
          <Text style={ss.scanQualityMedNoteText}>
            Some joints weren't fully visible — a few readings may be estimated.
          </Text>
        </View>
      )}

      {/* Frame scrubber — only when frameTicks are available */}
      {frameTicks.length > 0 && (
        <View style={ss.scrubberWrap}>
          <View style={ss.scrubberHeader}>
            <Feather name="film" size={10} color="#6c63ff" />
            <Text style={ss.scrubberLabel}>FRAME SCRUBBER</Text>
            <Text style={ss.scrubberTime}>
              {scrubTick ? formatScrubTime(scrubTick.t) : "—"}
              {scrubDuration > 0 ? ` / ${formatScrubTime(scrubDuration)}` : ""}
            </Text>
          </View>
          <View
            style={ss.scrubberTrack}
            onLayout={(e) => { scrubTrackWidthRef.current = e.nativeEvent.layout.width; }}
            {...scrubPanResponder.panHandlers}
          >
            <View style={ss.scrubberFill}>
              <View style={[ss.scrubberProgress, { flex: scrubRatio }]} />
              <View style={{ flex: 1 - scrubRatio }} />
            </View>
            {/* Tick marks for risk moments */}
            {frameTicks.map((tick, idx) => {
              const hasRisk = Object.values(tick.jr).some((jr) => (jr?.lvl ?? 0) >= 1);
              if (!hasRisk) return null;
              const t0 = frameTicks[0]?.t ?? 0;
              const td = scrubDuration > 0 ? scrubDuration : 1;
              const pos = (tick.t - t0) / td;
              const color = Object.values(tick.jr).some((jr) => (jr?.lvl ?? 0) >= 2) ? "#ef4444" : "#f59e0b";
              return (
                <View key={idx} style={[ss.scrubberTickMark, { left: `${Math.round(pos * 100)}%` as any, backgroundColor: color }]} />
              );
            })}
            {/* Thumb */}
            <View style={[ss.scrubberThumb, { left: `${Math.round(scrubRatio * 100)}%` as any }]} />
          </View>
          <Text style={ss.scrubberHint}>Drag to scrub through frames</Text>
        </View>
      )}
    </View>
  ) : (
    <View style={[ss.heroSlot, { height: heroBoxH }]}>
      <Feather name="user-x" size={26} color="#3a3a5c" />
      <Text style={ss.scanTitle}>Couldn’t detect the athlete clearly</Text>
      <Text style={ss.scanSub}>Try re-selecting the person in your clip.</Text>
      <TouchableOpacity style={ss.reselectBtn} activeOpacity={0.85} onPress={() => router.push(`/analysis/person-select/${id}` as any)}>
        <Feather name="users" size={13} color="#fff" />
        <Text style={ss.reselectText}>Re-select athlete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={ss.root}>
      {scanner}

      {/* Joint angle history bottom sheet */}
      {historyJoint && jointTrendsData?.joints[historyJoint] && id && (
        <JointHistorySheet
          joint={historyJoint}
          data={[...(jointTrendsData.joints[historyJoint] ?? [])].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )}
          currentAnalysisId={id}
          onClose={() => setHistoryJoint(null)}
        />
      )}
      <View style={[ss.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={ss.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color="#8888aa" />
        </TouchableOpacity>

        {/* Small thumbnail preview — visible before a skeleton frame is ready */}
        {!!thumbnailUrl && !scanDone && (
          <Image
            source={{ uri: thumbnailUrl }}
            style={ss.headerThumb}
            contentFit="cover"
            transition={150}
          />
        )}

        <View style={{ flex: 1 }}>
          <Text style={ss.headerTitle} numberOfLines={1}>
            {sport || "Form"} · Coach Report
          </Text>
          {videoUri && (
            <Text style={{ fontSize: 10, color: scanDone ? "#22c55e" : "#8888aa", fontFamily: "Inter_400Regular" }}>
              {scanDone ? "● Analysis complete" : "Scanning video…"}
            </Text>
          )}
        </View>
        {videoUri && scanDone && hasFrameTicks && (
          <TouchableOpacity
            style={[ss.headerBtn, { backgroundColor: "#6c63ff22", borderColor: "#6c63ff55" }]}
            onPress={() => router.push(`/analysis/live/${id}` as any)}
            activeOpacity={0.8}
          >
            <Feather name="play-circle" size={13} color="#a78bfa" />
            <Text style={[ss.headerBtnText, { color: "#a78bfa" }]}>Breakdown</Text>
          </TouchableOpacity>
        )}
        {videoUri && scanDone && (
          <TouchableOpacity style={ss.headerBtn} onPress={() => router.push(`/analysis/person-select/${id}` as any)} activeOpacity={0.8}>
            <Feather name="users" size={13} color="#fff" />
            <Text style={ss.headerBtnText}>Athlete</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
      >
        {heroBlock}

        {/* Hero joint chips + hint */}
        {scanDone && hero && flaggedJoints.length > 0 && (
          <View style={ss.heroChips}>
            {renderJointChips(flaggedJoints)}
            <View style={ss.tapHintRow}>
              <Feather name={Object.keys(jointTrendsData?.joints ?? {}).length > 0 ? "bar-chart-2" : "crosshair"} size={10} color="#6c63ff" />
              <Text style={ss.tapHint}>
                {Object.keys(jointTrendsData?.joints ?? {}).length > 0
                  ? "Tap a joint to see its full angle history"
                  : "Tap a joint or a tip below to inspect it on your frame"}
              </Text>
            </View>
          </View>
        )}

        {/* ── SECTION 1: Injury Prevention ──
            Grounded tips take priority so a revisit (already-grounded, scan still
            running) shows them immediately. The measured fallback / "all safe" card
            only render once this scan produced a REAL result (scanResult), so a failed
            scan never shows a misleading "all safe" — the hero shows the failure state. */}
        {videoUri && (groundedReady || (scanDone && !!scanResult)) && (
          <View style={ss.tipSection}>
            <View style={ss.tipLabelRow}>
              <Feather name="shield" size={10} color="#ef4444" />
              <Text style={[ss.sectionLabel, { color: "#ef444488" }]}>INJURY PREVENTION</Text>
            </View>

            {groundedReady && sortedInjuryTips.length > 0 ? (
              sortedInjuryTips.map((tip) => renderTip(tip, "injury"))
            ) : refining ? (
              <View style={ss.refiningCard}>
                <ActivityIndicator size="small" color="#6c63ff" />
                <View style={{ flex: 1 }}>
                  <Text style={ss.refiningTitle}>Generating coaching from your scan…</Text>
                  <Text style={ss.refiningBody}>Grounding AI tips in the joint angles measured from your video.</Text>
                </View>
              </View>
            ) : scanResult && flaggedJoints.length === 0 ? (
              <View style={ss.okCard}>
                <Feather name="shield" size={18} color="#22c55e" />
                <View style={{ flex: 1 }}>
                  <Text style={ss.okTitle}>No injury risks detected across the scan</Text>
                  <Text style={ss.okBody}>
                    Every measured joint stayed within safe ranges for {sport || "this sport"} throughout the clip.
                  </Text>
                </View>
              </View>
            ) : scanResult ? (
              <View style={[ss.tipCard, { borderColor: RISK_COLORS[worstLvl] + "44" }]}>
                <View style={ss.tipHeader}>
                  <View style={[ss.tipIcon, { backgroundColor: RISK_COLORS[worstLvl] + "1a" }]}>
                    <Feather name={worstLvl === 2 ? "alert-triangle" : "alert-circle"} size={14} color={RISK_COLORS[worstLvl]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ss.tipCategory, { color: RISK_COLORS[worstLvl] }]}>Elevated joint load</Text>
                    <Text style={ss.tipTitle}>Review the flagged joints</Text>
                  </View>
                </View>
                <Text style={ss.tipDesc}>
                  The scan measured {RISK_WORD[worstLvl].toLowerCase()} angles at the joints below. Tap one to see the exact moment on your frame.
                </Text>
                {renderJointChips(flaggedJoints)}
              </View>
            ) : null}
          </View>
        )}

        {/* ── SECTION 2: Performance & Efficiency (grounded tips only) ── */}
        {videoUri && groundedReady && !refining && performanceTips.length > 0 && (
          <View style={ss.tipSection}>
            <View style={ss.tipLabelRow}>
              <Feather name="zap" size={10} color="#6c63ff" />
              <Text style={[ss.sectionLabel, { color: "#6c63ffaa" }]}>PERFORMANCE COACHING</Text>
            </View>
            {sortedPerformanceTips.map((tip) => renderTip(tip, "performance"))}
          </View>
        )}

        {/* ── Citations panel ── */}
        {(scanDone || groundedReady) && (
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
    </View>
  );
}

const ss = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#07070f" },
  hiddenScanner: { position: "absolute", width: 1, height: 1, top: 0, left: 0, opacity: 0 },
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#18182a", gap: 12 },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: "#111118", borderWidth: 1, borderColor: "#18182a", alignItems: "center", justifyContent: "center" },
  headerThumb:   { width: 52, height: 36, borderRadius: 7, borderWidth: 1, borderColor: "#18182a" },
  headerTitle:   { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#f0f0f8", textTransform: "capitalize" },
  headerBtn:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6c63ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  headerBtnText: { fontSize: 12, color: "#fff", fontFamily: "Inter_600SemiBold" },
  sectionLabel:  { fontSize: 10, color: "#8888aa", fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },

  heroSlot:      { backgroundColor: "#05050c", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 30 },
  scanTitle:     { fontSize: 14, color: "#cfcdf2", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  scanSub:       { fontSize: 12, color: "#8888aa", fontFamily: "Inter_400Regular", textAlign: "center" },
  progTrack:     { width: "70%", height: 4, borderRadius: 3, backgroundColor: "rgba(28,28,46,0.85)", overflow: "hidden", marginTop: 4 },
  progFill:      { height: "100%", borderRadius: 3, backgroundColor: "#6c63ff" },
  preparingText: { fontSize: 12, color: "#8888aa", fontFamily: "Inter_400Regular" },
  scanOverlay:   { position: "absolute", bottom: 16, left: 0, right: 0, alignItems: "center", gap: 5, pointerEvents: "none" } as any,
  scanOverlayTitle: { fontSize: 12, color: "rgba(255,255,255,0.82)", fontFamily: "Inter_600SemiBold", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  scanOverlaySub:   { fontSize: 10, color: "rgba(255,255,255,0.50)", fontFamily: "Inter_400Regular" },
  reselectBtn:   { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#6c63ff", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9, marginTop: 6 },
  reselectText:  { fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" },

  heroBanner:    { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center" },
  heroBadge:     { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 22, paddingHorizontal: 13, paddingVertical: 6 },
  heroBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  heroChips:     { paddingHorizontal: 18, paddingTop: 12, gap: 8 },

  tipSection:    { paddingHorizontal: 18, paddingTop: 14 },
  tipLabelRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  tipCard:       { backgroundColor: "#0f0f1c", borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, marginBottom: 10 },
  tipHeader:     { flexDirection: "row", alignItems: "center", gap: 12 },
  tipIcon:       { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipCategory:   { fontSize: 10, color: "#6c63ff", fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  tipTitle:      { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#f0f0f8", marginTop: 1 },
  tipDesc:       { fontSize: 13, color: "#a0a0bc", fontFamily: "Inter_400Regular", lineHeight: 19 },
  drillBox:        { borderRadius: 10, borderWidth: 1, padding: 11, gap: 6 },
  drillLabel:      { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  drillText:       { fontSize: 12, color: "#c0c0d8", fontFamily: "Inter_400Regular", lineHeight: 17 },
  drillStructured: { gap: 8 },
  drillName:       { fontSize: 13, color: "#f0f0f8", fontFamily: "Inter_600SemiBold" },
  drillMeta:       { flexDirection: "row", gap: 8 },
  drillMetaPill:   { backgroundColor: "#07070f", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, gap: 2, alignItems: "center" },
  drillMetaLabel:  { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  drillMetaValue:  { fontSize: 13, color: "#e8e8f8", fontFamily: "Inter_600SemiBold" },
  drillCueRow:     { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingTop: 2 },
  drillCueText:    { flex: 1, fontSize: 12, color: "#c0c0d8", fontFamily: "Inter_400Regular", lineHeight: 17, fontStyle: "italic" },
  drillFeelRow:    { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#ffffff0f", marginTop: 4 },
  drillFeelText:   { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, fontStyle: "italic" },
  markDoneBtn:     { flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, borderTopColor: "#ffffff0f", marginTop: 6, paddingTop: 9, paddingBottom: 1 },
  markDoneBtnDone: { borderTopColor: "#22c55e18" },
  markDoneBtnText: { fontSize: 12, color: "#6060a0", fontFamily: "Inter_600SemiBold" },
  markDoneBtnTextDone: { color: "#22c55e" },
  drillDoneBadge:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0d2010", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#22c55e33" },
  drillDoneBadgeText: { fontSize: 10, color: "#22c55e", fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  nextStepCard:       { marginTop: 8, backgroundColor: "#0a1e0f", borderRadius: 10, borderWidth: 1, borderColor: "#22c55e33", padding: 10, gap: 6 },
  nextStepHeader:     { flexDirection: "row", alignItems: "center", gap: 6 },
  nextStepLabel:      { fontSize: 9, color: "#22c55e", fontFamily: "Inter_700Bold", letterSpacing: 1 },
  nextStepCue:        { fontSize: 12, color: "#9adba8", fontFamily: "Inter_400Regular", lineHeight: 17 },
  nextStepAskBtn:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0d2010", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: "#22c55e55", alignSelf: "flex-start", marginTop: 2 },
  nextStepAskBtnText: { fontSize: 11, color: "#22c55e", fontFamily: "Inter_600SemiBold" },
  qualityBadge:    { marginTop: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  qualityText:     { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  okCard:        { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#0f1c12", borderWidth: 1, borderColor: "#22c55e33", borderRadius: 14, padding: 14 },
  okTitle:       { fontSize: 13, color: "#d8f5e0", fontFamily: "Inter_600SemiBold" },
  okBody:        { fontSize: 12, color: "#7a9a82", fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  tipObs:        { fontSize: 12, color: "#9a9ac4", fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 17 },
  whyBox:        { backgroundColor: "#0c0c20", borderRadius: 8, borderWidth: 1, borderColor: "#2a2a44", paddingHorizontal: 10, paddingVertical: 8, gap: 3 },
  whyLabel:      { fontSize: 9, color: "#6c63ff", fontFamily: "Inter_700Bold", letterSpacing: 1 },
  whyText:       { fontSize: 12, color: "#b0b0cc", fontFamily: "Inter_400Regular", lineHeight: 17 },
  scanQualityBadge: { marginTop: 6, borderWidth: 1, borderRadius: 22, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(7,7,15,0.72)", flexDirection: "row", alignItems: "center", gap: 5 },
  scanQualityText:  { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  scanQualityLowBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#1a0a0a", borderWidth: 1, borderColor: "#ef444440", paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 18, marginTop: 10, borderRadius: 12 },
  scanQualityLowBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#f5b8b8" },
  scanQualityLowBannerBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#c09090", lineHeight: 17 },
  scanQualityLowBannerLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#ef4444", marginTop: 2 },
  scanQualityMedNote: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 18, marginTop: 8, backgroundColor: "#181208", borderRadius: 10, borderWidth: 1, borderColor: "#f59e0b28" },
  scanQualityMedNoteText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#a08060", lineHeight: 15 },
  chipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip:          { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  chipDot:       { width: 6, height: 6, borderRadius: 3 },
  chipText:      { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  deltaBadge:        { fontSize: 10, fontFamily: "Inter_700Bold", borderWidth: 1, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  deltaBadgeTappable: { borderWidth: 1.5, paddingHorizontal: 6 },
  tapHintRow:    { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  tapHint:       { fontSize: 10, color: "#6c63ff", fontFamily: "Inter_600SemiBold" },

  miniWrap:      { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#1e1e30", alignSelf: "center" },
  miniTag:       { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(7,7,15,0.78)", borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  miniTagText:   { fontSize: 9, color: "#fff", fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  readingRow:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  readingPill:   { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#0c0c18" },
  readingText:   { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  riskBox:       { backgroundColor: "#1a0e12", borderRadius: 10, borderWidth: 1, borderColor: "#ef444433", padding: 12, gap: 6 },
  riskHead:      { flexDirection: "row", alignItems: "center", gap: 7 },
  riskTitle:     { fontSize: 12, color: "#f5b8c0", fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  riskBarTrack:  { height: 6, borderRadius: 4, backgroundColor: "#2a1418", overflow: "hidden" },
  riskBarFill:   { height: "100%", borderRadius: 4, backgroundColor: "#ef4444" },
  riskDesc:      { fontSize: 12, color: "#c8a0a8", fontFamily: "Inter_400Regular", lineHeight: 17 },
  riskPrevLabel: { fontSize: 9, color: "#ef444499", fontFamily: "Inter_700Bold", letterSpacing: 1, marginTop: 2 },
  riskPrev:      { fontSize: 12, color: "#d8c0c4", fontFamily: "Inter_400Regular", lineHeight: 17 },
  citeRow:       { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingTop: 2 },
  citeText:      { flex: 1, fontSize: 10, color: "#55556e", fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 14 },
  askBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#6c63ff", borderRadius: 12, paddingVertical: 11, marginTop: 2 },
  askBtnText:    { fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" },

  refiningCard:  { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#0f0f1c", borderWidth: 1, borderColor: "#6c63ff33", borderRadius: 14, padding: 14 },
  refiningTitle: { fontSize: 13, color: "#cfcdf2", fontFamily: "Inter_600SemiBold" },
  refiningBody:  { fontSize: 11, color: "#8888aa", fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  sourcesSection:      { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 },
  sourcesToggle:       { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  sourcesToggleText:   { fontSize: 11, color: "#55556e", fontFamily: "Inter_400Regular", flex: 1 },
  sourcesCard:         { backgroundColor: "#0a0a18", borderRadius: 12, borderWidth: 1, borderColor: "#1e1e30", padding: 14, marginTop: 8, gap: 12 },
  sourcesHeading:      { fontSize: 13, fontFamily: "Inter_700Bold", color: "#c0c0d8" },
  sourcesSubheading:   { fontSize: 11, color: "#55556e", fontFamily: "Inter_400Regular", lineHeight: 16, fontStyle: "italic" },
  sourcesGroupLabel:   { fontSize: 10, color: "#ef444488", fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 4 },
  perfCard:            { borderColor: "#6c63ff33" },
  conflictBannerInjury:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#2a1a00", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 2, alignSelf: "flex-start" },
  conflictBannerInjuryText: { fontSize: 11, color: "#f59e0b", fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  conflictBannerPerf:       { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#12121e", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 2, alignSelf: "flex-start", borderWidth: 1, borderColor: "#2a2a44" },
  conflictBannerPerfText:   { fontSize: 11, color: "#8888aa", fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
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

  scrubberWrap:     { backgroundColor: "#0a0a16", borderTopWidth: 1, borderTopColor: "#18182a", paddingHorizontal: 16, paddingTop: 11, paddingBottom: 13 },
  scrubberHeader:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  scrubberLabel:    { fontSize: 9, color: "#6c63ff", fontFamily: "Inter_700Bold", letterSpacing: 1.2, flex: 1 },
  scrubberTime:     { fontSize: 10, color: "#8888aa", fontFamily: "Inter_500Medium" },
  scrubberTrack:    { height: 28, justifyContent: "center", position: "relative" },
  scrubberFill:     { height: 4, borderRadius: 2, backgroundColor: "#1e1e30", overflow: "hidden", flexDirection: "row" },
  scrubberProgress: { height: "100%", backgroundColor: "#6c63ff", borderRadius: 2 },
  scrubberTickMark: { position: "absolute", top: "50%", width: 2, height: 10, marginTop: -5, borderRadius: 1, transform: [{ translateX: -1 }] } as any,
  scrubberThumb:    { position: "absolute", top: "50%", width: 14, height: 14, borderRadius: 7, backgroundColor: "#6c63ff", borderWidth: 2, borderColor: "#0a0a16", marginTop: -7, transform: [{ translateX: -7 }] } as any,
  scrubberHint:     { fontSize: 9, color: "#3a3a5c", fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6 },
});
