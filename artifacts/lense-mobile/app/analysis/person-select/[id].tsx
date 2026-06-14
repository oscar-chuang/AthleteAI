import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystemBase from "expo-file-system";
const FileSystem = FileSystemBase as any;

import { useColors } from "@/hooks/useColors";
import { analyses as analysesApi } from "@/lib/api";

// Equipment class → sport slug mapping (COCO-SSD classes)
const EQUIPMENT_SPORT: Record<string, string> = {
  "tennis racket": "tennis",
  "baseball bat": "baseball",
  "baseball glove": "baseball",
  "skis": "skiing",
  "snowboard": "skiing",
  "surfboard": "swimming",
  "skateboard": "other",
  "frisbee": "other",
  "bicycle": "cycling",
  "horse": "other",
};

// Which sports does a given equipment class suggest? (for mismatch text)
const EQUIPMENT_LABEL: Record<string, string> = {
  "tennis racket": "tennis",
  "baseball bat": "baseball",
  "baseball glove": "baseball",
  "skis": "skiing",
  "snowboard": "snowboarding",
  "surfboard": "surfing",
  "skateboard": "skateboarding",
  "bicycle": "cycling",
};

interface PersonBox {
  nx: number; ny: number; nw: number; nh: number;
  color: string;
  index: number;
}

function buildPersonSelectHtml(videoUri?: string): string {
  const src = videoUri ?? "";
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;background:#07070f;overflow:hidden;}
#container{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
#v{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;pointer-events:none;}
#overlay{position:absolute;top:0;left:0;width:100%;height:100%;}
#status{
  position:absolute;bottom:18px;left:50%;transform:translateX(-50%);
  background:rgba(10,10,22,.82);color:#e0e0f0;
  padding:7px 18px;border-radius:20px;
  font-family:-apple-system,sans-serif;font-size:13px;white-space:nowrap;
  border:1px solid rgba(255,255,255,.1);
}
</style>
</head>
<body>
<div id="container">
  <video id="v" src="${src}" playsinline muted crossorigin="anonymous"></video>
  <canvas id="overlay"></canvas>
  <div id="status">Loading video…</div>
</div>
<script>
(function(){
  const BOX_COLORS=['#a78bfa','#22d3ee','#f59e0b','#22c55e','#f43f5e'];
  const video=document.getElementById("v");
  const canvas=document.getElementById("overlay");
  const ctx=canvas.getContext("2d");
  const status=document.getElementById("status");
  let detectedPersons=[];
  let detectedEquipment=[];
  let tfLoaded=false, cocoModel=null;
  let selectedIndex=-1;
  let videoW=640,videoH=360;

  function post(obj){try{window.ReactNativeWebView.postMessage(JSON.stringify(obj));}catch(e){}}

  function resizeCanvas(){
    canvas.width=canvas.offsetWidth;
    canvas.height=canvas.offsetHeight;
  }
  window.addEventListener("resize",()=>{resizeCanvas();redraw();});

  // Map canvas click → video coords → which box
  function canvasToVideo(cx,cy){
    const cW=canvas.width,cH=canvas.height;
    const vAR=videoW/videoH, cAR=cW/cH;
    let vLeft,vTop,vWidth,vHeight;
    if(vAR>cAR){vWidth=cW;vHeight=cW/vAR;vLeft=0;vTop=(cH-vHeight)/2;}
    else{vHeight=cH;vWidth=cH*vAR;vLeft=(cW-vWidth)/2;vTop=0;}
    const vx=(cx-vLeft)/vWidth*videoW;
    const vy=(cy-vTop)/vHeight*videoH;
    return {vx,vy,vLeft,vTop,vWidth,vHeight};
  }

  function redraw(){
    const cW=canvas.width,cH=canvas.height;
    ctx.clearRect(0,0,cW,cH);
    if(detectedPersons.length===0)return;
    const {vLeft,vTop,vWidth,vHeight}=canvasToVideo(0,0);
    // re-derive display coords
    detectedPersons.forEach((p,i)=>{
      const px=p.nx*videoW,py=p.ny*videoH,pw=p.nw*videoW,ph=p.nh*videoH;
      const dx=vLeft+px/videoW*vWidth,dy=vTop+py/videoH*vHeight;
      const dw=pw/videoW*vWidth,dh=ph/videoH*vHeight;
      const col=p.color;
      const isSelected=(i===selectedIndex);
      ctx.save();
      ctx.shadowBlur=isSelected?30:18;ctx.shadowColor=col;
      ctx.strokeStyle=col;ctx.lineWidth=isSelected?4:2.5;ctx.globalAlpha=isSelected?1:0.8;
      if(isSelected){ctx.fillStyle=col+"18";ctx.fillRect(dx,dy,dw,dh);}
      ctx.strokeRect(dx+1,dy+1,dw-2,dh-2);
      // label
      const label="Person "+(i+1)+(isSelected?" ✓":"");
      ctx.font="bold 12px -apple-system,sans-serif";
      const lw=ctx.measureText(label).width+16;
      ctx.globalAlpha=1;
      ctx.fillStyle=col;
      ctx.beginPath();ctx.roundRect(dx,dy-28,lw,24,5);ctx.fill();
      ctx.fillStyle="#07070f";ctx.textBaseline="middle";
      ctx.fillText(label,dx+8,dy-16);
      ctx.restore();
    });
  }

  canvas.addEventListener("click",function(e){
    if(detectedPersons.length===0)return;
    const rect=canvas.getBoundingClientRect();
    const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
    const {vx,vy}=canvasToVideo(cx,cy);
    let bestI=-1;
    for(let i=0;i<detectedPersons.length;i++){
      const p=detectedPersons[i];
      const px=p.nx*videoW,py=p.ny*videoH,pw=p.nw*videoW,ph=p.nh*videoH;
      if(vx>=px&&vx<=px+pw&&vy>=py&&vy<=py+ph){bestI=i;break;}
    }
    if(bestI>=0){
      selectedIndex=bestI;
      const p=detectedPersons[bestI];
      redraw();
      post({type:"personSelected",nx:p.nx,ny:p.ny,nw:p.nw,nh:p.nh,index:bestI});
    }
  });

  function loadScript(src){
    return new Promise((res,rej)=>{
      const s=document.createElement("script");
      s.src=src;s.crossOrigin="anonymous";
      s.onload=res;s.onerror=rej;
      document.head.appendChild(s);
    });
  }

  async function runDetection(){
    status.textContent="Detecting people… (~3s)";
    try{
      if(!tfLoaded){
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
        tfLoaded=true;
      }
      if(!cocoModel) cocoModel=await cocoSsd.load({base:"lite_mobilenet_v2"});
      const snap=document.createElement("canvas");
      snap.width=videoW;snap.height=videoH;
      snap.getContext("2d").drawImage(video,0,0,videoW,videoH);
      const preds=await cocoModel.detect(snap);
      detectedPersons=preds
        .filter(p=>p.class==="person"&&p.score>0.3)
        .map((p,i)=>({
          nx:p.bbox[0]/videoW,ny:p.bbox[1]/videoH,
          nw:p.bbox[2]/videoW,nh:p.bbox[3]/videoH,
          color:BOX_COLORS[i%BOX_COLORS.length],
          index:i,
        }));
      detectedEquipment=preds
        .filter(p=>p.class!=="person"&&p.score>0.35)
        .map(p=>p.class);
      redraw();
      // Auto-select if only 1 person
      if(detectedPersons.length===1){
        selectedIndex=0;
        redraw();
        post({type:"personSelected",nx:detectedPersons[0].nx,ny:detectedPersons[0].ny,nw:detectedPersons[0].nw,nh:detectedPersons[0].nh,index:0,autoSelected:true});
      }
      post({type:"ready",personCount:detectedPersons.length,equipment:detectedEquipment});
      if(detectedPersons.length===0){
        status.textContent="No people detected — tracking most visible";
      } else if(detectedPersons.length===1){
        status.textContent="1 person found ✓";
      } else {
        status.textContent=detectedPersons.length+" people — tap one to select";
      }
    }catch(e){
      status.textContent="Tap below to choose";
      post({type:"ready",personCount:0,equipment:[],error:true});
    }
  }

  video.addEventListener("loadeddata",function(){
    videoW=video.videoWidth||640;videoH=video.videoHeight||360;
    // Seek to ~1.5 seconds for a representative frame
    video.currentTime=Math.min(1.5,video.duration||1.5);
  });
  video.addEventListener("seeked",function(){
    resizeCanvas();
    runDetection();
  });
  video.load();
})();
</script>
</body>
</html>`;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function PersonSelectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);

  const [videoUri, setVideoUri] = useState<string | undefined>();
  const [sport, setSport] = useState("");
  const [htmlFileUri, setHtmlFileUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);

  const [personCount, setPersonCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ nx: number; ny: number; nw: number; nh: number } | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Load analysis data
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`video_uri_${id}`).then((uri) => { if (uri) setVideoUri(uri); });
    analysesApi.get(id).then(({ analysis }) => {
      setSport(analysis.sport ?? "");
    }).catch(() => {});
  }, [id]);

  // Build the detection WebView HTML and write to disk
  useEffect(() => {
    let cancelled = false;
    setPreparing(true);
    setHtmlFileUri(null);
    setPersonCount(null);
    setSelected(null);
    setMismatch(null);

    (async () => {
      try {
        const cacheDir = FileSystem.cacheDirectory ?? "";
        let resolvedVideo = videoUri;
        if (videoUri) {
          const ext = (videoUri.split(".").pop() ?? "mp4").split(/[?#]/)[0];
          const localVideo = cacheDir + "select-video." + ext;
          try { await FileSystem.copyAsync({ from: videoUri, to: localVideo }); resolvedVideo = localVideo; }
          catch {}
        }
        const htmlPath = cacheDir + "person-select.html";
        await FileSystem.writeAsStringAsync(htmlPath, buildPersonSelectHtml(resolvedVideo), {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (!cancelled) { setHtmlFileUri(htmlPath); setPreparing(false); }
      } catch {
        if (!cancelled) setPreparing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [videoUri]);

  // Handle WebView messages
  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "ready") {
        setPersonCount(msg.personCount ?? 0);
        // Check for sport mismatch
        const equipment: string[] = msg.equipment ?? [];
        let detectedSport: string | null = null;
        for (const eq of equipment) {
          if (EQUIPMENT_SPORT[eq]) { detectedSport = EQUIPMENT_SPORT[eq]; break; }
        }
        if (detectedSport && sport && detectedSport !== sport.toLowerCase()) {
          const eqName = equipment.find((e) => EQUIPMENT_SPORT[e]) ?? "";
          setMismatch(
            `Looks like ${EQUIPMENT_LABEL[eqName] ?? detectedSport} equipment was detected, ` +
            `but this session is set to "${sport}". Check your sport selection if scores seem off.`
          );
        }
        return;
      }

      if (msg.type === "personSelected") {
        setSelected({ nx: msg.nx, ny: msg.ny, nw: msg.nw, nh: msg.nh });
        if (msg.autoSelected) setAutoSelected(true);
      }
    } catch {}
  }, [sport]);

  function proceedToSkeleton(crop?: { nx: number; ny: number; nw: number; nh: number }) {
    if (crop) {
      router.replace(
        `/analysis/skeleton/${id}?nx=${crop.nx.toFixed(4)}&ny=${crop.ny.toFixed(4)}&nw=${crop.nw.toFixed(4)}&nh=${crop.nh.toFixed(4)}` as any
      );
    } else {
      router.replace(`/analysis/skeleton/${id}` as any);
    }
  }

  const videoH = SCREEN_W / (16 / 9);

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#07070f" },
    header: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 14,
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: "#07070f",
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: "rgba(255,255,255,.07)", alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#e8e8f5", flex: 1 },
    subtitle: { fontSize: 11, color: "#55556e", fontFamily: "Inter_400Regular" },
    webviewSlot: {
      width: SCREEN_W, height: videoH,
      backgroundColor: "#000", alignItems: "center", justifyContent: "center",
    },
    infoBar: {
      paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
    },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#c0c0d8" },
    helpText: { fontSize: 12, color: "#55556e", fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 17 },
    // Mismatch warning
    mismatchCard: {
      margin: 16, marginTop: 12, padding: 13,
      backgroundColor: "#f59e0b18", borderRadius: 10,
      borderWidth: 1, borderColor: "#f59e0b44",
      flexDirection: "row", alignItems: "flex-start", gap: 10,
    },
    mismatchText: { flex: 1, fontSize: 12, color: "#f59e0b", fontFamily: "Inter_400Regular", lineHeight: 17 },
    // Buttons
    buttonArea: { padding: 20, gap: 10 },
    primaryBtn: {
      backgroundColor: "#6c63ff", borderRadius: 14,
      paddingVertical: 14, alignItems: "center",
      flexDirection: "row", justifyContent: "center", gap: 8,
    },
    primaryBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
    skipBtn: { alignItems: "center", paddingVertical: 10 },
    skipBtnText: { color: "#55556e", fontFamily: "Inter_400Regular", fontSize: 13 },
  });

  const statusDotColor =
    personCount === null ? "#55556e" :
    personCount === 0 ? "#f59e0b" :
    "#22c55e";

  const statusText =
    personCount === null ? "Detecting people…" :
    personCount === 0 ? "No people detected — will track most visible" :
    personCount === 1 ? "1 person found" :
    `${personCount} people found${selected ? ` — Person ${(selected as any)._index ?? "?"} selected` : " — tap one to select"}`;

  const helpText =
    personCount === null ? "COCO-SSD is scanning the video frame…" :
    personCount === 0 ? "We'll automatically focus on whoever appears most prominent." :
    personCount === 1 ? "Looks good! Tap Analyze to start tracking." :
    "Tap the highlighted person you want to track. Their joint angles will drive the scores.";

  const canProceed = personCount !== null;

  const buttonLabel =
    !selected ? "Analyze (Auto)" :
    autoSelected ? "Analyze This Person" :
    "Analyze Selected Person";

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color="#8888aa" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Who are we scoring?</Text>
          {sport ? (
            <Text style={s.subtitle}>{sport} · tap the person to track</Text>
          ) : null}
        </View>
      </View>

      {/* Video detection WebView */}
      {preparing ? (
        <View style={s.webviewSlot}>
          <ActivityIndicator color="#6c63ff" />
          <Text style={{ color: "#55556e", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 10 }}>
            Preparing…
          </Text>
        </View>
      ) : htmlFileUri ? (
        <WebView
          ref={webviewRef}
          source={{ uri: htmlFileUri }}
          style={{ width: SCREEN_W, height: videoH }}
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
        <View style={s.webviewSlot}>
          <Feather name="video-off" size={28} color="#55556e" />
          <Text style={{ color: "#55556e", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 }}>
            No video available
          </Text>
        </View>
      )}

      {/* Status */}
      <View style={s.infoBar}>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: statusDotColor }]} />
          <Text style={s.statusText}>{statusText}</Text>
        </View>
        <Text style={s.helpText}>{helpText}</Text>
      </View>

      {/* Sport mismatch warning */}
      {mismatch && !mismatchDismissed && (
        <View style={s.mismatchCard}>
          <Feather name="alert-triangle" size={15} color="#f59e0b" style={{ marginTop: 1 }} />
          <Text style={s.mismatchText}>{mismatch}</Text>
          <TouchableOpacity onPress={() => setMismatchDismissed(true)} activeOpacity={0.7}>
            <Feather name="x" size={14} color="#f59e0b" />
          </TouchableOpacity>
        </View>
      )}

      {/* Action buttons */}
      <View style={[s.buttonArea, { paddingBottom: bottomPad + 20 }]}>
        <TouchableOpacity
          style={[s.primaryBtn, !canProceed && { opacity: 0.45 }]}
          onPress={() => canProceed && proceedToSkeleton(selected ?? undefined)}
          activeOpacity={0.85}
          disabled={!canProceed}
        >
          <Feather name="user-check" size={17} color="#fff" />
          <Text style={s.primaryBtnText}>{buttonLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} onPress={() => proceedToSkeleton(undefined)} activeOpacity={0.7}>
          <Text style={s.skipBtnText}>Skip — go straight to skeleton overlay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
