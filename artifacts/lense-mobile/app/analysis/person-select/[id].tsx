import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { useColors } from "@/hooks/useColors";
import { analyses as analysesApi } from "@/lib/api";

// COCO-SSD equipment → sport slug. Only sports where COCO-SSD has class coverage.
// Fencing, gymnastics, martial arts, wrestling etc. have NO detectable equipment.
const EQUIPMENT_SPORT: Record<string, string> = {
  "tennis racket": "tennis",
  "baseball bat": "baseball",
  "baseball glove": "baseball",
  "skis": "skiing",
  "snowboard": "skiing",
  "surfboard": "swimming",
  "skateboard": "other",
  "bicycle": "cycling",
};
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

// Sports whose equipment COCO-SSD CAN detect (used to explain when it can't check)
const DETECTABLE_SPORTS = new Set(Object.values(EQUIPMENT_SPORT));

interface PersonBox {
  nx: number; ny: number; nw: number; nh: number;
  color: string;
}

function buildPersonSelectHtml(videoUri: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;background:#000;overflow:hidden;}
#wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
#v{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;pointer-events:none;}
#cv{position:absolute;top:0;left:0;width:100%;height:100%;}
#st{
  position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
  background:rgba(10,10,22,.85);color:#e0e0f0;
  padding:6px 16px;border-radius:20px;
  font:13px -apple-system,sans-serif;white-space:nowrap;
  border:1px solid rgba(255,255,255,.1);pointer-events:none;
}
</style>
</head>
<body>
<div id="wrap">
  <video id="v" src="${videoUri}" playsinline muted crossorigin="anonymous"></video>
  <canvas id="cv"></canvas>
  <div id="st">Loading…</div>
</div>
<script>
(function(){
  const COLORS=['#a78bfa','#22d3ee','#f59e0b','#22c55e','#f43f5e'];
  const v=document.getElementById('v');
  const cv=document.getElementById('cv');
  const ctx=cv.getContext('2d');
  const st=document.getElementById('st');
  let persons=[], equipment=[], tfLoaded=false, model=null;
  let vW=640,vH=360, selIdx=-1;

  function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}

  function resize(){cv.width=cv.offsetWidth||window.innerWidth;cv.height=cv.offsetHeight||window.innerHeight;}
  window.addEventListener('resize',()=>{resize();draw();});
  resize();

  function videoRect(){
    const cW=cv.width,cH=cv.height;
    const vAR=vW/vH,cAR=cW/cH;
    if(vAR>cAR){const h=cW/vAR;return{l:0,t:(cH-h)/2,w:cW,h};}
    else{const w=cH*vAR;return{l:(cW-w)/2,t:0,w,h:cH};}
  }

  function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);
    if(!persons.length)return;
    const r=videoRect();
    persons.forEach((p,i)=>{
      const dx=r.l+p.nx*vW/vW*r.w, dy=r.t+p.ny*vH/vH*r.h;
      const dw=p.nw*vW/vW*r.w, dh=p.nh*vH/vH*r.h;
      // normalize: dx = r.l + p.nx * r.w
      const x=r.l+p.nx*r.w, y=r.t+p.ny*r.h, w=p.nw*r.w, h=p.nh*r.h;
      const sel=i===selIdx;
      ctx.save();
      ctx.shadowBlur=sel?30:16; ctx.shadowColor=p.color;
      ctx.strokeStyle=p.color; ctx.lineWidth=sel?4:2.5; ctx.globalAlpha=sel?1:0.78;
      if(sel){ctx.fillStyle=p.color+'22';ctx.fillRect(x,y,w,h);}
      ctx.strokeRect(x+1,y+1,w-2,h-2);
      const lbl='Person '+(i+1)+(sel?' ✓':'');
      ctx.font='bold 12px -apple-system,sans-serif';
      const lw=ctx.measureText(lbl).width+16;
      ctx.globalAlpha=1; ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.roundRect(x,y-28,lw,24,5); ctx.fill();
      ctx.fillStyle='#07070f'; ctx.textBaseline='middle';
      ctx.fillText(lbl,x+8,y-16);
      ctx.restore();
    });
  }

  cv.addEventListener('click',function(e){
    if(!persons.length)return;
    const rect=cv.getBoundingClientRect();
    const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
    const r=videoRect();
    // map canvas click → normalized coords
    const nx=(cx-r.l)/r.w, ny=(cy-r.t)/r.h;
    let hit=-1;
    for(let i=0;i<persons.length;i++){
      const p=persons[i];
      if(nx>=p.nx&&nx<=p.nx+p.nw&&ny>=p.ny&&ny<=p.ny+p.nh){hit=i;break;}
    }
    if(hit<0)return;
    selIdx=hit; draw();
    const p=persons[hit];
    post({type:'personSelected',nx:p.nx,ny:p.ny,nw:p.nw,nh:p.nh,index:hit});
  });

  function loadScript(src){
    return new Promise((ok,err)=>{
      const s=document.createElement('script');
      s.src=src; s.crossOrigin='anonymous';
      s.onload=ok; s.onerror=err;
      document.head.appendChild(s);
    });
  }

  async function detect(){
    st.textContent='Detecting people…';
    try{
      if(!tfLoaded){
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
        tfLoaded=true;
      }
      if(!model) model=await cocoSsd.load({base:'lite_mobilenet_v2'});
      const snap=document.createElement('canvas');
      snap.width=vW; snap.height=vH;
      snap.getContext('2d').drawImage(v,0,0,vW,vH);
      const preds=await model.detect(snap);
      persons=preds
        .filter(p=>p.class==='person'&&p.score>0.3)
        .map((p,i)=>({nx:p.bbox[0]/vW,ny:p.bbox[1]/vH,nw:p.bbox[2]/vW,nh:p.bbox[3]/vH,color:COLORS[i%COLORS.length]}));
      equipment=preds.filter(p=>p.class!=='person'&&p.score>0.35).map(p=>p.class);
      draw();
      if(persons.length===1){
        selIdx=0; draw();
        post({type:'personSelected',nx:persons[0].nx,ny:persons[0].ny,nw:persons[0].nw,nh:persons[0].nh,index:0,autoSelected:true});
      }
      post({type:'ready',personCount:persons.length,equipment});
      st.textContent=persons.length===0?'No people detected':persons.length===1?'1 person found ✓':persons.length+' people — tap one';
    }catch(e){
      st.textContent='Detection unavailable';
      post({type:'ready',personCount:0,equipment:[],error:true});
    }
  }

  v.addEventListener('loadeddata',function(){
    vW=v.videoWidth||640; vH=v.videoHeight||360;
    v.currentTime=Math.min(1.5,v.duration||1.5);
  });
  v.addEventListener('seeked',function(){resize();detect();},{ once:true });
  v.addEventListener('error',function(){
    st.textContent='Video load error';
    post({type:'ready',personCount:0,equipment:[],error:true});
  });
  v.load();
})();
</script>
</body>
</html>`;
}

const { width: SCREEN_W } = Dimensions.get("window");

export default function PersonSelectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoChecked, setVideoChecked] = useState(false); // AsyncStorage lookup done?
  const [sport, setSport] = useState("");
  const [htmlFileUri, setHtmlFileUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);

  const [personCount, setPersonCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ nx: number; ny: number; nw: number; nh: number } | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);
  const [detectionUnavailable, setDetectionUnavailable] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Step 1: load the analysis + video URI from AsyncStorage
  useEffect(() => {
    if (!id) return;
    Promise.all([
      AsyncStorage.getItem(`video_uri_${id}`),
      analysesApi.get(id).catch(() => null),
    ]).then(([uri, result]) => {
      setVideoUri(uri); // null if not found
      setVideoChecked(true);
      setSport(result?.analysis?.sport ?? "");
    });
  }, [id]);

  // Step 2: once we know the video URI, build the detection HTML
  useEffect(() => {
    if (!videoChecked) return; // still waiting for AsyncStorage
    if (!videoUri) {
      // No local video stored (older session) — skip detection
      setPreparing(false);
      return;
    }

    let cancelled = false;
    setPreparing(true);
    setHtmlFileUri(null);

    (async () => {
      try {
        const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
        const ext = (videoUri.split(".").pop() ?? "mp4").split(/[?#]/)[0]!;
        const localVideo = cacheDir + "select-video." + ext;
        try { await FileSystem.copyAsync({ from: videoUri, to: localVideo }); }
        catch { /* content:// URIs may work directly */ }
        const resolvedVideo = localVideo;
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
  }, [videoUri, videoChecked]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "ready") {
        setPersonCount(msg.personCount ?? 0);
        if (msg.error) { setDetectionUnavailable(true); return; }

        // Sport mismatch: only flag if COCO-SSD can detect this sport's equipment
        const equipment: string[] = msg.equipment ?? [];
        let detectedSport: string | null = null;
        let matchingEquipment = "";
        for (const eq of equipment) {
          if (EQUIPMENT_SPORT[eq]) {
            detectedSport = EQUIPMENT_SPORT[eq]!;
            matchingEquipment = eq;
            break;
          }
        }
        if (detectedSport && sport && detectedSport !== sport.toLowerCase()) {
          setMismatch(
            `${EQUIPMENT_LABEL[matchingEquipment] ?? detectedSport} equipment detected, ` +
            `but sport is set to "${sport}". Double-check your sport selection — it affects scoring.`
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

  const videoH = Math.round(SCREEN_W / (16 / 9));

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#07070f" },
    header: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 14,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: "rgba(255,255,255,.07)", alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#e8e8f5", flex: 1 },
    sportPill: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: "rgba(108,99,255,.15)", borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: "rgba(108,99,255,.3)",
    },
    sportText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#a78bfa", textTransform: "capitalize" },
    videoSlot: {
      width: SCREEN_W, height: videoH, backgroundColor: "#000",
      alignItems: "center", justifyContent: "center",
    },
    statusRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 20, paddingTop: 14,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#c0c0d8" },
    helpText: {
      fontSize: 12, color: "#55556e", fontFamily: "Inter_400Regular",
      paddingHorizontal: 20, marginTop: 5, lineHeight: 17,
    },
    noVideoCard: {
      margin: 20, padding: 20,
      backgroundColor: "rgba(255,255,255,.04)", borderRadius: 14,
      borderWidth: 1, borderColor: "rgba(255,255,255,.08)",
      gap: 10, alignItems: "center",
    },
    noVideoTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#e8e8f5", textAlign: "center" },
    noVideoBody: { fontSize: 13, color: "#55556e", fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
    noDetectNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      marginHorizontal: 20, marginTop: 10,
      backgroundColor: "rgba(108,99,255,.08)", borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: "rgba(108,99,255,.2)",
    },
    noDetectText: { flex: 1, fontSize: 12, color: "#8888aa", fontFamily: "Inter_400Regular", lineHeight: 17 },
    mismatchCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      marginHorizontal: 20, marginTop: 10, padding: 12,
      backgroundColor: "#f59e0b18", borderRadius: 10,
      borderWidth: 1, borderColor: "#f59e0b44",
    },
    mismatchText: { flex: 1, fontSize: 12, color: "#f59e0b", fontFamily: "Inter_400Regular", lineHeight: 17 },
    buttons: { padding: 20, paddingTop: 14, gap: 10 },
    primaryBtn: {
      backgroundColor: "#6c63ff", borderRadius: 14,
      paddingVertical: 14, alignItems: "center",
      flexDirection: "row", justifyContent: "center", gap: 8,
    },
    primaryBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
    skipBtn: { alignItems: "center", paddingVertical: 8 },
    skipText: { color: "#44445a", fontFamily: "Inter_400Regular", fontSize: 13 },
  });

  const noVideo = videoChecked && !videoUri;
  const showWebView = !preparing && !!htmlFileUri;

  const statusDotColor =
    personCount === null ? "#55556e" :
    personCount === 0    ? "#f59e0b" :
    "#22c55e";

  const statusLabel =
    personCount === null ? "Detecting people…" :
    personCount === 0    ? "No people detected — will auto-track" :
    personCount === 1    ? "1 person found — ready" :
    `${personCount} people — tap one to select`;

  const helpLabel =
    detectionUnavailable ? "Detection failed (no network?). Tap Proceed to use the skeleton overlay manually." :
    personCount === null  ? "COCO-SSD is scanning the frame…" :
    personCount === 0     ? "We'll focus on whoever is most prominent in the frame." :
    personCount === 1     ? "Tap Analyze to start. We'll track this person throughout the video." :
    "Tap the person you want scored. Their joint angles will drive the AI scores.";

  // Explain why sport mismatch can't be checked for this sport
  const sportNotDetectable = sport && !DETECTABLE_SPORTS.has(sport.toLowerCase());

  const buttonLabel =
    !selected               ? "Proceed (Auto-track)" :
    autoSelected            ? "Analyze This Person" :
    "Analyze Selected Person";

  const canProceed = videoChecked && (!videoUri || !preparing);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color="#8888aa" />
        </TouchableOpacity>
        <Text style={s.title}>Who are we scoring?</Text>
        {sport ? (
          <View style={s.sportPill}>
            <Feather name="tag" size={11} color="#a78bfa" />
            <Text style={s.sportText}>{sport}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Video / detection area */}
        {!videoChecked || (videoChecked && videoUri && preparing) ? (
          <View style={s.videoSlot}>
            <ActivityIndicator color="#6c63ff" size="large" />
            <Text style={{ color: "#55556e", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 10 }}>
              {!videoChecked ? "Loading…" : "Preparing video…"}
            </Text>
          </View>
        ) : noVideo ? (
          /* No video stored — explain & let user proceed */
          <View style={s.videoSlot}>
            <Feather name="video-off" size={36} color="#33334a" />
          </View>
        ) : showWebView ? (
          <WebView
            source={{ uri: htmlFileUri! }}
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
          <View style={s.videoSlot}>
            <ActivityIndicator color="#6c63ff" />
          </View>
        )}

        {/* No video explanation */}
        {noVideo && (
          <View style={s.noVideoCard}>
            <Feather name="info" size={22} color="#55556e" />
            <Text style={s.noVideoTitle}>No video found for this session</Text>
            <Text style={s.noVideoBody}>
              This session was analyzed without a locally stored video, so person detection
              isn't available. You can still open the skeleton overlay manually — tap the
              person once it's playing.
            </Text>
          </View>
        )}

        {/* Detection status */}
        {showWebView && (
          <>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: statusDotColor }]} />
              <Text style={s.statusText}>{statusLabel}</Text>
            </View>
            <Text style={s.helpText}>{helpLabel}</Text>
          </>
        )}

        {/* Sport can't be auto-checked note */}
        {showWebView && sportNotDetectable && personCount !== null && !mismatch && (
          <View style={s.noDetectNote}>
            <Feather name="info" size={13} color="#8888aa" style={{ marginTop: 1 }} />
            <Text style={s.noDetectText}>
              Sport mismatch auto-detection only works for sports with visible equipment
              (tennis, baseball, skiing, cycling, etc.). For <Text style={{ color: "#c0c0d8" }}>{sport}</Text>, make sure
              you've selected the right sport before scoring.
            </Text>
          </View>
        )}

        {/* Sport mismatch warning */}
        {mismatch && !mismatchDismissed && (
          <View style={s.mismatchCard}>
            <Feather name="alert-triangle" size={14} color="#f59e0b" style={{ marginTop: 2 }} />
            <Text style={s.mismatchText}>{mismatch}</Text>
            <TouchableOpacity onPress={() => setMismatchDismissed(true)} activeOpacity={0.7}>
              <Feather name="x" size={14} color="#f59e0b" />
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons */}
        <View style={s.buttons}>
          <TouchableOpacity
            style={[s.primaryBtn, !canProceed && { opacity: 0.4 }]}
            onPress={() => canProceed && proceedToSkeleton(selected ?? undefined)}
            activeOpacity={0.85}
            disabled={!canProceed}
          >
            <Feather name="user-check" size={17} color="#fff" />
            <Text style={s.primaryBtnText}>{noVideo ? "Open Skeleton Overlay" : buttonLabel}</Text>
          </TouchableOpacity>

          {!noVideo && (
            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => proceedToSkeleton(undefined)}
              activeOpacity={0.7}
            >
              <Text style={s.skipText}>Skip — go straight to skeleton overlay</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
