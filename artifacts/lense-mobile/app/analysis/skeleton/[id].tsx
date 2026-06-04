import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  StyleSheet,
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

// ─── HTML builder ─────────────────────────────────────────────────────────────
// The entire pose-tracking UI lives inside the WebView.
// MediaPipe runs in the phone's browser engine (WebAssembly + WebGL),
// which means real, per-frame joint detection — no native build needed.
function buildHtml(videoUri: string | undefined): string {
  const MEDIAPIPE_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";

  return `<!DOCTYPE html>
<html lang="en">
<head>
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
</style>
</head>
<body>
<div id="wrap">
  ${videoUri
    ? `<video id="v" playsinline webkit-playsinline muted loop preload="auto"></video>
       <canvas id="c"></canvas>
       <div id="badge"><div id="dot"></div><span id="btxt">Loading AI…</span></div>`
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

    /* Bones */
    CONN.forEach(([a,b])=>{
      if(!v(a)||!v(b))return;
      const pA=p(a),pB=p(b);
      const col=LI.has(a)&&LI.has(b)?"#22d3ee":RI.has(a)&&RI.has(b)?"#a78bfa":"rgba(255,255,255,.5)";
      ctx.save();
      ctx.strokeStyle=col;ctx.lineWidth=3.5;ctx.lineCap="round";
      ctx.shadowBlur=10;ctx.shadowColor=col;ctx.globalAlpha=.9;
      ctx.beginPath();ctx.moveTo(pA.x,pA.y);ctx.lineTo(pB.x,pB.y);ctx.stroke();
      ctx.restore();
    });

    /* Joints */
    let seen=0;
    KJ.forEach(i=>{
      if(!v(i))return;seen++;
      const pt=p(i);
      const col=LI.has(i)?"#22d3ee":RI.has(i)?"#a78bfa":"#fff";
      ctx.save();
      ctx.shadowBlur=14;ctx.shadowColor=col;
      ctx.fillStyle=col+"cc";ctx.beginPath();ctx.arc(pt.x,pt.y,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#07070f";ctx.beginPath();ctx.arc(pt.x,pt.y,3.2,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
    btxt.textContent=seen>0?seen+" joints tracked":"Pose active";

    /* Angle labels */
    if(v(23)&&v(25)&&v(27)) label(p(25).x+32,p(25).y,ang(p(23),p(25),p(27))+"°","#22d3ee");
    if(v(24)&&v(26)&&v(28)) label(p(26).x-32,p(26).y,ang(p(24),p(26),p(28))+"°","#a78bfa");
    if(v(11)&&v(23)&&v(25)) label(p(23).x+36,p(23).y-12,ang(p(11),p(23),p(25))+"°","#f59e0b");

    /* Post angles to React Native */
    if(v(23)&&v(25)&&v(27)&&v(24)&&v(26)&&v(28)){
      try{
        window.ReactNativeWebView.postMessage(JSON.stringify({type:"angles",data:{
          leftKnee: ang(p(23),p(25),p(27)),
          rightKnee:ang(p(24),p(26),p(28)),
          leftHip:  v(11)?ang(p(11),p(23),p(25)):0,
          rightHip: v(12)?ang(p(12),p(24),p(26)):0,
          leftElbow: v(11)&&v(13)&&v(15)?ang(p(11),p(13),p(15)):0,
          rightElbow:v(12)&&v(14)&&v(16)?ang(p(12),p(14),p(16)):0,
        }}));
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

  const [angles,     setAngles]     = useState<JointAngles | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [preparing,  setPreparing]  = useState(true);

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
      if (msg.type === "angles") {
        setAngles(msg.data as JointAngles);
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
  function angleColor(deg: number) {
    return deg < 100 ? "#ef4444" : deg < 130 ? "#f59e0b" : "#22c55e";
  }

  const angleCards = angles ? [
    { label: "L Knee",  deg: angles.leftKnee  },
    { label: "R Knee",  deg: angles.rightKnee },
    { label: "L Hip",   deg: angles.leftHip   },
    { label: "R Hip",   deg: angles.rightHip  },
    { label: "L Elbow", deg: angles.leftElbow },
    { label: "R Elbow", deg: angles.rightElbow},
  ] : [];

  return (
    <View style={ss.root}>
      {/* ── Header ── */}
      {!isLandscape && (
        <View style={[ss.header, { paddingTop: topPad + 8 }]}>
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
      )}

      {/* ── WebView (MediaPipe runs here) ── */}
      {preparing ? (
        <View style={[ss.webviewSlot, { height: isLandscape ? undefined : Math.min(screenH * 0.52, 340), flex: isLandscape ? 1 : undefined }]}>
          <ActivityIndicator color="#6c63ff" size="large" />
          <Text style={ss.preparingText}>Preparing video…</Text>
        </View>
      ) : htmlFileUri ? (
        <WebView
          ref={webviewRef}
          source={{ uri: htmlFileUri }}
          style={{ flex: isLandscape ? 1 : undefined, height: isLandscape ? undefined : Math.min(screenH * 0.52, 340) }}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={FileSystem.cacheDirectory ?? "file:///"}
          mixedContentMode="always"
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*", "file://*"]}
          scrollEnabled={false}
          onMessage={handleMessage}
          backgroundColor="#07070f"
        />
      ) : null}

      {/* ── Portrait: angle cards ── */}
      {!isLandscape && angleCards.length > 0 && (
        <View style={ss.angleSection}>
          <Text style={ss.sectionLabel}>LIVE JOINT ANGLES</Text>
          <View style={ss.angleGrid}>
            {angleCards.filter(a => a.deg > 0).map(({ label, deg }) => {
              const c = angleColor(deg);
              return (
                <View key={label} style={[ss.angleCard, { borderColor: c + "44" }]}>
                  <Text style={[ss.angleDeg, { color: c }]}>{deg}°</Text>
                  <Text style={ss.angleLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Portrait: no video prompt ── */}
      {!isLandscape && !videoUri && (
        <View style={ss.noVideo}>
          <Feather name="upload" size={28} color="#3a3a5c" />
          <Text style={ss.noVideoText}>Upload a video from the Analysis screen</Text>
          <Text style={ss.noVideoSub}>Tap the Upload button at the top of the Analysis page</Text>
        </View>
      )}

      {/* ── Landscape: Portrait button overlay ── */}
      {isLandscape && (
        <TouchableOpacity onPress={toggleOrientation} style={ss.portraitBtn} activeOpacity={0.8}>
          <Feather name="smartphone" size={13} color="#fff" />
          <Text style={ss.rotateBtnText}>Portrait</Text>
        </TouchableOpacity>
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
  sectionLabel: { fontSize: 10, color: "#8888aa", fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 10 },
  angleGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  angleCard:    { width: "30%", flexGrow: 1, backgroundColor: "#0f0f1c", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  angleDeg:     { fontSize: 22, fontFamily: "Inter_700Bold" },
  angleLabel:   { fontSize: 10, color: "#8888aa", fontFamily: "Inter_400Regular", marginTop: 3 },
  noVideo:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  noVideoText:   { fontSize: 14, color: "#4a4a6a", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  noVideoSub:    { fontSize: 12, color: "#3a3a5c", fontFamily: "Inter_400Regular", textAlign: "center" },
  webviewSlot:   { backgroundColor: "#07070f", alignItems: "center", justifyContent: "center", gap: 10 },
  preparingText: { fontSize: 12, color: "#8888aa", fontFamily: "Inter_400Regular" },
});
