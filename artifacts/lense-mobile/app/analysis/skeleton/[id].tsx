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
interface JointAngles {
  leftKnee: number; rightKnee: number;
  leftHip: number;  rightHip: number;
  leftElbow: number; rightElbow: number;
}
type RiskMap = Record<keyof JointAngles, number>;

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
  default:       [65,  80, 165, 175,  40, 55, 999, 999,  -1, -1, 158, 170],
};

// ─── HTML builder ─────────────────────────────────────────────────────────────
function buildHtml(videoUri: string | undefined, sport: string): string {
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
  padding:10px 14px 14px;display:flex;flex-direction:column;gap:9px}
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
  padding:4px 9px;border-radius:7px;cursor:pointer;transition:all .15s}
.spd.on{background:#6c63ff;color:#fff}
#skelBtn{padding:6px 11px;font-size:11px;font-weight:700;border-radius:9px;cursor:pointer;
  border:1px solid transparent;transition:all .15s}
#skelBtn.on{background:rgba(34,211,238,.12);color:#22d3ee;border-color:rgba(34,211,238,.28)}
#skelBtn.off{background:#1c1c2e;color:#8888aa}
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
  let worstSeenLvl=0, worstSeenTime=0;

  function fmt(t){const s=Math.floor(t);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}

  function sizeWrap(){
    const ctrlH = document.getElementById("ctrl")?.offsetHeight || 110;
    document.getElementById("wrap").style.height=(window.innerHeight-ctrlH)+"px";
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

  const RL=["#22c55e","#f59e0b","#ef4444"];

  function onResults(res){
    busy=false;
    const W=video.videoWidth||640,H=video.videoHeight||360;
    canvas.width=W;canvas.height=H;
    ctx.clearRect(0,0,W,H);
    const lm=res.poseLandmarks;
    if(!lm||!showSkel)return;
    const v=i=>(lm[i]?.visibility||0)>0.35;
    const p=i=>({x:lm[i].x*W,y:lm[i].y*H});

    const jr={};
    if(v(23)&&v(25)&&v(27)){const a=ang(p(23),p(25),p(27));jr[25]={deg:a,lvl:lvl(a,...KN)};}
    if(v(24)&&v(26)&&v(28)){const a=ang(p(24),p(26),p(28));jr[26]={deg:a,lvl:lvl(a,...KN)};}
    if(v(11)&&v(23)&&v(25)){const a=ang(p(11),p(23),p(25));jr[23]={deg:a,lvl:lvl(a,...HIP)};}
    if(v(12)&&v(24)&&v(26)){const a=ang(p(12),p(24),p(26));jr[24]={deg:a,lvl:lvl(a,...HIP)};}
    if(v(11)&&v(13)&&v(15)){const a=ang(p(11),p(13),p(15));jr[13]={deg:a,lvl:lvl(a,...ELB)};}
    if(v(12)&&v(14)&&v(16)){const a=ang(p(12),p(14),p(16));jr[14]={deg:a,lvl:lvl(a,...ELB)};}
    let maxLvl=0;Object.keys(jr).forEach(k=>{if(jr[k].lvl>maxLvl)maxLvl=jr[k].lvl;});

    CONN.forEach(([a,b])=>{
      if(!v(a)||!v(b))return;
      const pA=p(a),pB=p(b);
      const rm=Math.max(jr[a]?jr[a].lvl:-1, jr[b]?jr[b].lvl:-1);
      const col=rm>=1?RL[rm]:LI.has(a)&&LI.has(b)?"#22d3ee":RI.has(a)&&RI.has(b)?"#a78bfa":"rgba(255,255,255,.5)";
      ctx.save();
      ctx.strokeStyle=col;ctx.lineWidth=rm>=1?4.5:3.5;ctx.lineCap="round";
      ctx.shadowBlur=rm>=2?17:10;ctx.shadowColor=col;ctx.globalAlpha=.92;
      ctx.beginPath();ctx.moveTo(pA.x,pA.y);ctx.lineTo(pB.x,pB.y);ctx.stroke();
      ctx.restore();
    });

    let seen=0;
    KJ.forEach(i=>{
      if(!v(i))return;seen++;
      const pt=p(i);
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

    function angLabel(i,dx,dy){const j=jr[i];if(!j)return;label(p(i).x+dx,p(i).y+dy,j.deg+"°",RL[j.lvl]);}
    angLabel(25,34,0);angLabel(26,-34,0);angLabel(23,38,-12);angLabel(24,-38,-12);

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

    // Track worst moment timestamp
    if(maxLvl > 0 && (maxLvl > worstSeenLvl || (maxLvl === worstSeenLvl && maxLvl === 2))){
      if(maxLvl > worstSeenLvl) worstSeenLvl = maxLvl;
      worstSeenTime = video.currentTime;
      try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"worst",time:worstSeenTime,lvl:maxLvl}));}catch(e){}
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

  const BASE="${MEDIAPIPE_BASE}";
  const pose=new Pose({locateFile:f=>BASE+"/"+f});
  pose.setOptions({modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.5,minTrackingConfidence:.5});
  pose.onResults(onResults);
  pose.initialize().then(()=>{
    loading.classList.add("hide");
    sizeWrap();
    setTimeout(detect,100);
  }).catch(()=>loading.classList.add("hide"));

  function detect(){if(busy||!video.readyState)return;busy=true;pose.send({image:video}).catch(()=>{busy=false;});}

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
  video.addEventListener("loadeddata",()=>setTimeout(detect,80));
  video.addEventListener("seeked",detect);
  video.addEventListener("timeupdate",()=>{timeL.textContent=fmt(video.currentTime);scrub.value=video.currentTime;});
  video.addEventListener("ended",()=>{playing=false;playBtn.innerHTML="&#9654;";cancelAnimationFrame(raf);});

  function play(){video.play();playing=true;playBtn.innerHTML="&#9646;&#9646;";loop();}
  function pause(){video.pause();playing=false;playBtn.innerHTML="&#9654;";cancelAnimationFrame(raf);}

  playBtn.onclick=()=>playing?pause():play();
  document.getElementById("bk").onclick=()=>{pause();video.currentTime=Math.max(0,video.currentTime-1/30);};
  document.getElementById("fw").onclick=()=>{pause();video.currentTime=Math.min(video.duration||99,video.currentTime+1/30);};
  scrub.addEventListener("input",e=>{video.currentTime=parseFloat(e.target.value);setTimeout(detect,40);});
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

  const [videoUri, setVideoUri]   = useState<string | undefined>();
  const [sport, setSport]         = useState("");
  const [tips, setTips]           = useState<TipRecord[]>([]);
  const [showSources, setShowSources] = useState(false);

  const [angles,      setAngles]      = useState<JointAngles | null>(null);
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
        setWorstTime((prev) => {
          // Keep the worst-risk time; at equal severity, prefer the latest occurrence
          if (prev === null || msg.lvl > (peak ? 0 : 0)) return msg.time as number;
          return msg.time as number;
        });
        return;
      }
      if (msg.type === "angles") {
        const data = msg.data as JointAngles;
        setAngles(data);
        if (msg.risk) {
          const r = msg.risk as RiskMap;
          setRisk(r);
          setPeak((prev) => {
            let changed = false;
            const next = { ...prev };
            (Object.keys(r) as (keyof RiskMap)[]).forEach((k) => {
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
    webviewRef.current?.injectJavaScript(`
      (function(){
        var v = document.getElementById('v');
        var btn = document.getElementById('playBtn');
        if (v) {
          v.pause();
          v.currentTime = ${worstTime};
          if (btn) btn.innerHTML = '&#9654;';
        }
      })(); true;
    `);
  }

  // ── Active AI tip (shown when joint hits risk/caution) ──────────────────────
  const activeTip = useMemo((): TipRecord | null => {
    if (maxLvl < 1 || tips.length === 0) return null;
    const riskJoints = risk
      ? (Object.keys(risk) as (keyof RiskMap)[]).filter((k) => risk[k] >= 1)
      : [];
    const isKneeRisk = riskJoints.some((k) => k.toLowerCase().includes("knee"));
    const isHipRisk  = riskJoints.some((k) => k.toLowerCase().includes("hip"));
    const isElbowRisk = riskJoints.some((k) => k.toLowerCase().includes("elbow"));
    const warningTips = tips.filter((t) => t.severity === "warning" || t.severity === "critical");
    if (isKneeRisk || isHipRisk) {
      const match = warningTips.find((t) =>
        t.category === "Form" || t.category === "Injury Prevention"
      );
      if (match) return match;
    }
    if (isElbowRisk) {
      const match = warningTips.find((t) => t.category === "Form");
      if (match) return match;
    }
    return warningTips[0] ?? tips[0] ?? null;
  }, [maxLvl, risk, tips]);

  // ── Build HTML to disk ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPreparing(true);
    setHtmlFileUri(null);
    setAngles(null);
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
        const htmlPath = cacheDir + "pose-tracker.html";
        await FileSystem.writeAsStringAsync(htmlPath, buildHtml(resolvedVideo, sport), {
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
  }, [videoUri, sport]);

  // ── Angle display ───────────────────────────────────────────────────────────
  const angleCards = angles ? ([
    { label: "L Knee",  deg: angles.leftKnee,   key: "leftKnee"   },
    { label: "R Knee",  deg: angles.rightKnee,  key: "rightKnee"  },
    { label: "L Hip",   deg: angles.leftHip,    key: "leftHip"    },
    { label: "R Hip",   deg: angles.rightHip,   key: "rightHip"   },
    { label: "L Elbow", deg: angles.leftElbow,  key: "leftElbow"  },
    { label: "R Elbow", deg: angles.rightElbow, key: "rightElbow" },
  ] as const) : [];

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

          {/* ── Angle cards ── */}
          {angleCards.length > 0 && (
            <View style={ss.angleSection}>
              <View style={ss.angleHeaderRow}>
                <Text style={ss.sectionLabel}>LIVE JOINT ANGLES</Text>
                {maxLvl === 2 ? (
                  <View style={[ss.statusPill, { backgroundColor: "#ef444422", borderColor: "#ef444455" }]}>
                    <Feather name="alert-triangle" size={11} color="#ef4444" />
                    <Text style={[ss.statusPillText, { color: "#ef4444" }]}>Injury risk</Text>
                  </View>
                ) : maxLvl === 1 ? (
                  <View style={[ss.statusPill, { backgroundColor: "#f59e0b22", borderColor: "#f59e0b55" }]}>
                    <Feather name="alert-circle" size={11} color="#f59e0b" />
                    <Text style={[ss.statusPillText, { color: "#f59e0b" }]}>Caution</Text>
                  </View>
                ) : modelReady ? (
                  <View style={[ss.statusPill, { backgroundColor: "#22c55e22", borderColor: "#22c55e55" }]}>
                    <Feather name="check-circle" size={11} color="#22c55e" />
                    <Text style={[ss.statusPillText, { color: "#22c55e" }]}>Good form</Text>
                  </View>
                ) : null}
              </View>
              <View style={ss.angleGrid}>
                {angleCards.filter(a => a.deg > 0).map(({ label, deg, key }) => {
                  const lvlVal = Math.max(0, Math.min(2, risk ? (risk[key] ?? 0) : 0));
                  const c = RISK_COLORS[lvlVal];
                  return (
                    <View key={label} style={[ss.angleCard, { borderColor: c + "55", backgroundColor: lvlVal === 2 ? "#ef44440f" : "#0f0f1c" }]}>
                      <Text style={[ss.angleDeg, { color: c }]}>{deg}°</Text>
                      <Text style={ss.angleLabel}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

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

          {/* ── AI coaching tip (surfaces when a joint goes red/amber) ── */}
          {modelReady && videoUri && activeTip && (
            <View style={ss.tipSection}>
              <View style={ss.tipLabelRow}>
                <Feather name="cpu" size={10} color="#6c63ff" />
                <Text style={ss.sectionLabel}>AI COACHING TIP</Text>
              </View>
              <View style={[ss.tipCard, { borderColor: maxLvl === 2 ? "#ef444433" : "#f59e0b33" }]}>
                <View style={ss.tipHeader}>
                  <View style={[ss.tipIcon, { backgroundColor: maxLvl === 2 ? "#ef44441a" : "#f59e0b1a" }]}>
                    <Feather
                      name={maxLvl === 2 ? "alert-triangle" : "alert-circle"}
                      size={14}
                      color={maxLvl === 2 ? "#ef4444" : "#f59e0b"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.tipCategory}>{activeTip.category}</Text>
                    <Text style={ss.tipTitle}>{activeTip.title}</Text>
                  </View>
                </View>
                <Text style={ss.tipDesc}>{activeTip.description}</Text>
                {activeTip.drill && (
                  <View style={ss.drillBox}>
                    <Text style={ss.drillLabel}>DRILL</Text>
                    <Text style={ss.drillText}>{activeTip.drill}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Good form state (no risks detected yet) ── */}
          {modelReady && videoUri && !activeTip && (
            <View style={ss.tipSection}>
              <View style={ss.okCard}>
                <Feather name="check-circle" size={18} color="#22c55e" />
                <View style={{ flex: 1 }}>
                  <Text style={ss.okTitle}>Form looks good</Text>
                  <Text style={ss.okBody}>
                    Joint angles are within safe ranges for {sport || "this sport"}. AI coaching tips will appear if risk patterns are detected.
                  </Text>
                </View>
              </View>
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
                    Joint angle thresholds are derived from the following peer-reviewed biomechanics literature. AI coaching content is generated by Anthropic Claude and is not a substitute for professional medical or coaching advice.
                  </Text>
                  {[
                    { num: "1", ref: "Escamilla RF et al.", year: "2001", title: "Knee biomechanics of the dynamic squat exercise.", journal: "Med Sci Sports Exerc", detail: "33(1):127–141" },
                    { num: "2", ref: "Schoenfeld BJ.", year: "2010", title: "Squatting kinematics and kinetics and their application to exercise performance.", journal: "J Strength Cond Res", detail: "24(12):3497–3506" },
                    { num: "3", ref: "Hales ME, Johnson BF, Johnson JT.", year: "2009", title: "Kinematic analysis of the powerlifting style squat and conventional deadlift during competition.", journal: "J Strength Cond Res", detail: "23(9):2574–2580" },
                    { num: "4", ref: "Heiderscheit BC et al.", year: "2011", title: "Effects of step rate manipulation on joint mechanics during running.", journal: "J Orthop Sports Phys Ther", detail: "41(4):229–238" },
                    { num: "5", ref: "Novacheck TF.", year: "1998", title: "The biomechanics of running.", journal: "Gait Posture", detail: "7(1):77–95" },
                    { num: "6", ref: "Hewett TE et al.", year: "2005", title: "Biomechanical measures of neuromuscular control and valgus loading of the knee predict ACL injury risk.", journal: "Am J Sports Med", detail: "33(4):492–501" },
                    { num: "7", ref: "Decker MJ et al.", year: "2003", title: "Lower extremity kinematics, kinetics and energy absorption during landing.", journal: "Clin Biomech", detail: "18(7):662–669" },
                    { num: "8", ref: "Norkin CC, White DJ.", year: "2009", title: "Measurement of Joint Motion: A Guide to Goniometry (4th ed.).", journal: "F.A. Davis Company", detail: "" },
                  ].map((s) => (
                    <View key={s.num} style={ss.sourceRow}>
                      <Text style={ss.sourceNum}>{s.num}</Text>
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
                      Coaching tips are AI-generated by Anthropic Claude claude-opus-4-5 based on the sport and movement context. They are educational only and do not constitute medical advice.
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
  angleSection:  { paddingHorizontal: 18, paddingTop: 16 },
  angleHeaderRow:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionLabel:  { fontSize: 10, color: "#8888aa", fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  statusPill:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusPillText:{ fontSize: 11, fontFamily: "Inter_600SemiBold" },
  angleGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  angleCard:     { width: "30%", flexGrow: 1, backgroundColor: "#0f0f1c", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  angleDeg:      { fontSize: 22, fontFamily: "Inter_700Bold" },
  angleLabel:    { fontSize: 10, color: "#8888aa", fontFamily: "Inter_400Regular", marginTop: 3 },
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
