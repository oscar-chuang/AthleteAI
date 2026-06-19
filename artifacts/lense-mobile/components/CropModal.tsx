import React, { useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import * as ImageManipulator from "expo-image-manipulator";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const SCREEN = Dimensions.get("window");
const CROP_SIZE = Math.min(SCREEN.width - 48, 320);
const MAX_SCALE = 5;

export interface CropResult {
  uri: string;
  base64: string;
  mimeType: string;
}

interface CropModalProps {
  visible: boolean;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onConfirm: (result: CropResult) => void;
  onCancel: () => void;
}

export function CropModal({
  visible,
  imageUri,
  imageWidth,
  imageHeight,
  onConfirm,
  onCancel,
}: CropModalProps) {
  const colors = useColors();
  const [processing, setProcessing] = React.useState(false);

  const minScale = Math.max(CROP_SIZE / imageWidth, CROP_SIZE / imageHeight);

  const scale = useSharedValue(minScale);
  const savedScale = useSharedValue(minScale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      const initial = Math.max(CROP_SIZE / imageWidth, CROP_SIZE / imageHeight);
      scale.value = initial;
      savedScale.value = initial;
      translateX.value = 0;
      translateY.value = 0;
      savedTX.value = 0;
      savedTY.value = 0;
      setProcessing(false);
    }
  }, [visible, imageWidth, imageHeight]);

  function clampTranslate(tx: number, ty: number, s: number) {
    "worklet";
    const halfExtraW = (imageWidth * s - CROP_SIZE) / 2;
    const halfExtraH = (imageHeight * s - CROP_SIZE) / 2;
    const maxTX = Math.max(0, halfExtraW);
    const maxTY = Math.max(0, halfExtraH);
    return {
      tx: Math.max(-maxTX, Math.min(maxTX, tx)),
      ty: Math.max(-maxTY, Math.min(maxTY, ty)),
    };
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.max(
        minScale,
        Math.min(MAX_SCALE, savedScale.value * e.scale)
      );
      scale.value = newScale;

      const clamped = clampTranslate(translateX.value, translateY.value, newScale);
      translateX.value = clamped.tx;
      translateY.value = clamped.ty;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const clamped = clampTranslate(translateX.value, translateY.value, scale.value);
      translateX.value = withSpring(clamped.tx, { damping: 20, stiffness: 200 });
      translateY.value = withSpring(clamped.ty, { damping: 20, stiffness: 200 });
      savedTX.value = clamped.tx;
      savedTY.value = clamped.ty;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const clamped = clampTranslate(
        savedTX.value + e.translationX,
        savedTY.value + e.translationY,
        scale.value
      );
      translateX.value = clamped.tx;
      translateY.value = clamped.ty;
    })
    .onEnd(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = useCallback(async () => {
    setProcessing(true);
    try {
      const s = scale.value;
      const tx = translateX.value;
      const ty = translateY.value;

      const displayW = imageWidth * s;
      const displayH = imageHeight * s;

      const imgLeft = CROP_SIZE / 2 + tx - displayW / 2;
      const imgTop = CROP_SIZE / 2 + ty - displayH / 2;

      const originX = Math.max(0, Math.round(-imgLeft / s));
      const originY = Math.max(0, Math.round(-imgTop / s));
      const cropW = Math.round(Math.min(CROP_SIZE / s, imageWidth - originX));
      const cropH = Math.round(Math.min(CROP_SIZE / s, imageHeight - originY));

      const safeOriginX = Math.max(0, Math.min(originX, imageWidth - 1));
      const safeOriginY = Math.max(0, Math.min(originY, imageHeight - 1));
      const safeCropW = Math.max(1, Math.min(cropW, imageWidth - safeOriginX));
      const safeCropH = Math.max(1, Math.min(cropH, imageHeight - safeOriginY));

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: safeOriginX,
              originY: safeOriginY,
              width: safeCropW,
              height: safeCropH,
            },
          },
          { resize: { width: 400, height: 400 } },
        ],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      onConfirm({
        uri: result.uri,
        base64: result.base64 ?? "",
        mimeType: "image/jpeg",
      });
    } catch (err) {
      console.error("CropModal: manipulate error", err);
      setProcessing(false);
    }
  }, [imageUri, imageWidth, imageHeight, onConfirm]);

  const CIRCLE_RADIUS = CROP_SIZE / 2;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Move and scale</Text>
          <Text style={styles.hint}>Pinch to zoom · Drag to reposition</Text>
        </View>

        <View style={styles.cropWrapper}>
          <GestureDetector gesture={composedGesture}>
            <View
              style={[
                styles.cropFrame,
                { width: CROP_SIZE, height: CROP_SIZE, borderRadius: CIRCLE_RADIUS },
              ]}
            >
              <Animated.View
                style={[
                  {
                    width: imageWidth,
                    height: imageHeight,
                  },
                  animatedStyle,
                ]}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: imageWidth, height: imageHeight }}
                  contentFit="fill"
                />
              </Animated.View>
            </View>
          </GestureDetector>

          <View
            style={[
              styles.circleOutline,
              {
                width: CROP_SIZE + 2,
                height: CROP_SIZE + 2,
                borderRadius: CIRCLE_RADIUS + 1,
              },
            ]}
            pointerEvents="none"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            disabled={processing}
            activeOpacity={0.75}
          >
            <Feather name="x" size={16} color="#fff" />
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, processing && { opacity: 0.65 }]}
            onPress={handleConfirm}
            disabled={processing}
            activeOpacity={0.85}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="check" size={16} color="#fff" />
            )}
            <Text style={styles.confirmBtnText}>
              {processing ? "Saving…" : "Use Photo"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? 48 : 60,
    paddingBottom: 48,
  },
  topBar: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  cropWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  cropFrame: {
    overflow: "hidden",
    backgroundColor: "#1a1a2e",
  },
  circleOutline: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    pointerEvents: "none",
  } as any,
  actions: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 24,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#6c63ff",
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
