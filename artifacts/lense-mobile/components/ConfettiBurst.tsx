import React, { useEffect, useRef } from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");

const PALETTE = [
  "#f59e0b", "#2F7BFF", "#22c55e", "#ef4444",
  "#38bdf8", "#FF6B35", "#fb923c", "#ec4899",
  "#fbbf24", "#34d399", "#60a5fa", "#f472b6",
];

const PARTICLE_COUNT = 56;
const MAX_DELAY_MS   = 450;
const MIN_DURATION   = 1100;
const MAX_DURATION   = 1900;

interface ParticleDef {
  id:       number;
  startX:   number;
  drift:    number;
  color:    string;
  size:     number;
  delay:    number;
  duration: number;
  spin:     number;
  isRect:   boolean;
}

function seedParticles(): ParticleDef[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id:       i,
    startX:   Math.random() * SCREEN_W,
    drift:    (Math.random() - 0.5) * 140,
    color:    PALETTE[i % PALETTE.length]!,
    size:     6 + Math.random() * 9,
    delay:    Math.random() * MAX_DELAY_MS,
    duration: MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION),
    spin:     (Math.random() - 0.5) * 900,
    isRect:   Math.random() > 0.45,
  }));
}

const PARTICLES = seedParticles();

function Particle({ p }: { p: ParticleDef }) {
  const ty      = useSharedValue(0);
  const tx      = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate  = useSharedValue(0);

  useEffect(() => {
    const fallDist = Dimensions.get("window").height * 0.72 + Math.random() * 160;
    const fadeStart = p.delay + p.duration * 0.65;
    const fadeDur   = p.duration * 0.35;

    ty.value = withDelay(
      p.delay,
      withTiming(fallDist, { duration: p.duration, easing: Easing.in(Easing.quad) }),
    );
    tx.value = withDelay(
      p.delay,
      withTiming(p.drift, { duration: p.duration, easing: Easing.out(Easing.sin) }),
    );
    rotate.value = withDelay(
      p.delay,
      withTiming(p.spin, { duration: p.duration }),
    );
    opacity.value = withDelay(
      fadeStart,
      withTiming(0, { duration: fadeDur }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position:        "absolute",
          left:            p.startX,
          top:             -p.size,
          width:           p.size,
          height:          p.isRect ? p.size * 0.5 : p.size,
          backgroundColor: p.color,
          borderRadius:    p.isRect ? 2 : p.size * 0.5,
        },
      ]}
    />
  );
}

interface Props {
  onComplete?: () => void;
}

export function ConfettiBurst({ onComplete }: Props) {
  const calledRef = useRef(false);

  useEffect(() => {
    const totalMs = MAX_DELAY_MS + MAX_DURATION + 400;
    const timer = setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        onComplete?.();
      }
    }, totalMs);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {PARTICLES.map((p) => (
        <Particle key={p.id} p={p} />
      ))}
    </View>
  );
}
