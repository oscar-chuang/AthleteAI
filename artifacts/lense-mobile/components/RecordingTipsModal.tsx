import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Image,
  ImageSourcePropType,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";

export const RECORDING_TIPS_KEY = "recording_tips_dismissed";

const BEST_PRACTICES: { icon: React.ComponentProps<typeof Feather>["name"]; text: string }[] = [
  { icon: "user",       text: "Keep your full body visible in frame at all times" },
  { icon: "sun",        text: "Record in good lighting — natural daylight works best" },
  { icon: "maximize",   text: "Use a stable surface or tripod to avoid camera shake" },
  { icon: "eye",        text: "Position the camera at hip or chest height, side-on or front-on" },
  { icon: "film",       text: "Keep the clip under 90 seconds to focus on one movement" },
];

const COMMON_MISTAKES: { icon: React.ComponentProps<typeof Feather>["name"]; text: string }[] = [
  { icon: "zoom-out",   text: "Standing too far away — we can't see your joints clearly" },
  { icon: "crop",       text: "Limbs cut off at the edges — arms or legs leave the frame" },
  { icon: "moon",       text: "Poor lighting or strong backlight — silhouette only, no detail" },
  { icon: "users",      text: "Multiple people in shot — pose detection may track the wrong person" },
];

type ExampleCard = {
  label: string;
  good: boolean;
  image: ImageSourcePropType;
  description: string;
};

const EXAMPLE_CARDS: ExampleCard[] = [
  {
    label: "Full body in frame",
    good: true,
    image: require("@/assets/recording-tips/good.png"),
    description: "Head to toe visible, clear lighting",
  },
  {
    label: "Too far away",
    good: false,
    image: require("@/assets/recording-tips/too-far.png"),
    description: "Joints too small to detect accurately",
  },
  {
    label: "Limbs cropped",
    good: false,
    image: require("@/assets/recording-tips/cropped.png"),
    description: "Arms or legs leave the frame",
  },
  {
    label: "Poor lighting",
    good: false,
    image: require("@/assets/recording-tips/dark.png"),
    description: "Silhouette only — no detail visible",
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export default function RecordingTipsModal({ visible, onClose, onContinue }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [acknowledged, setAcknowledged] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleContinue() {
    if (!acknowledged) return;
    if (dontShowAgain) {
      await AsyncStorage.setItem(RECORDING_TIPS_KEY, "true");
    }
    setAcknowledged(false);
    setDontShowAgain(false);
    onContinue();
  }

  function handleClose() {
    setAcknowledged(false);
    setDontShowAgain(false);
    onClose();
  }

  const s = StyleSheet.create({
    modal:          { flex: 1, backgroundColor: colors.background },
    header:         {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle:    { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground },
    closeBtn:       { padding: 4 },
    scroll:         { flex: 1 },
    scrollContent:  { padding: 20, paddingBottom: 12 },
    heroBlock:      { alignItems: "center", marginBottom: 24 },
    heroIcon:       {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    heroTitle:      { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 6 },
    heroSubtitle:   { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
    sectionLabel:   { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 10, textTransform: "uppercase" },
    tipRow:         { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
    tipIconWrap:    { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
    tipText:        { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20, paddingTop: 6 },
    divider:        { height: 1, backgroundColor: colors.border, marginVertical: 20 },
    cardsGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4, marginBottom: 4 },
    card:           {
      width: "47%",
      borderRadius: 14,
      borderWidth: 1.5,
      padding: 14,
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
    },
    cardImage:      { width: "100%", height: 90, borderRadius: 10, marginBottom: 2 },
    cardLabel:      { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center" },
    cardDesc:       { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 15 },
    cardBadge:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    cardBadgeText:  { fontSize: 11, fontFamily: "Inter_700Bold" },
    footer:         {
      padding: 20,
      paddingBottom: Math.max(insets.bottom + 8, 24),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 14,
    },
    checkRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
    checkBox:       {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    checkLabel:     { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground, lineHeight: 20 },
    dontShowRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dontShowLabel:  { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    continueBtn:    {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
    },
    continueBtnDis: { opacity: 0.4 },
    continueBtnText:{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={s.modal}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ width: 30 }} />
          <Text style={s.headerTitle}>Recording Tips</Text>
          <TouchableOpacity style={s.closeBtn} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close">
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={s.heroBlock}>
            <View style={s.heroIcon}>
              <Feather name="video" size={28} color={colors.primary} />
            </View>
            <Text style={s.heroTitle}>Get the Most Accurate Analysis</Text>
            <Text style={s.heroSubtitle}>
              Great pose detection starts with a great video.{"\n"}
              Follow these tips for the best biomechanics results.
            </Text>
          </View>

          {/* Best Practices */}
          <Text style={[s.sectionLabel, { color: colors.success }]}>Best Practices</Text>
          {BEST_PRACTICES.map((item, i) => (
            <View key={i} style={s.tipRow}>
              <View style={[s.tipIconWrap, { backgroundColor: colors.success + "18" }]}>
                <Feather name={item.icon} size={16} color={colors.success} />
              </View>
              <Text style={s.tipText}>{item.text}</Text>
            </View>
          ))}

          <View style={s.divider} />

          {/* Common Mistakes */}
          <Text style={[s.sectionLabel, { color: colors.destructive }]}>Common Mistakes</Text>
          {COMMON_MISTAKES.map((item, i) => (
            <View key={i} style={s.tipRow}>
              <View style={[s.tipIconWrap, { backgroundColor: colors.destructive + "18" }]}>
                <Feather name={item.icon} size={16} color={colors.destructive} />
              </View>
              <Text style={s.tipText}>{item.text}</Text>
            </View>
          ))}

          <View style={s.divider} />

          {/* Example cards */}
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Examples</Text>
          <View style={s.cardsGrid}>
            {EXAMPLE_CARDS.map((card, i) => (
              <View
                key={i}
                style={[
                  s.card,
                  { borderColor: card.good ? colors.success + "66" : colors.destructive + "44" },
                ]}
              >
                <Image
                  source={card.image}
                  style={s.cardImage}
                  resizeMode="cover"
                  accessible={true}
                  accessibilityRole="image"
                  accessibilityLabel={card.label}
                />
                <Text style={s.cardLabel}>{card.label}</Text>
                <Text style={s.cardDesc}>{card.description}</Text>
                <View
                  style={[
                    s.cardBadge,
                    { backgroundColor: card.good ? colors.success + "22" : colors.destructive + "22" },
                  ]}
                >
                  <Feather
                    name={card.good ? "check" : "x"}
                    size={10}
                    color={card.good ? colors.success : colors.destructive}
                  />
                  <Text
                    style={[
                      s.cardBadgeText,
                      { color: card.good ? colors.success : colors.destructive },
                    ]}
                  >
                    {card.good ? "Do this" : "Avoid"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {/* Acknowledgement checkbox */}
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setAcknowledged((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
          >
            <View
              style={[
                s.checkBox,
                {
                  borderColor: acknowledged ? colors.primary : colors.border,
                  backgroundColor: acknowledged ? colors.primary : "transparent",
                },
              ]}
            >
              {acknowledged && <Feather name="check" size={14} color="#fff" />}
            </View>
            <Text style={s.checkLabel}>I understand these recording guidelines.</Text>
          </TouchableOpacity>

          {/* Don't show again */}
          <View style={s.dontShowRow}>
            <Text style={s.dontShowLabel}>Don't show this again</Text>
            <Switch
              value={dontShowAgain}
              onValueChange={setDontShowAgain}
              trackColor={{ false: colors.border, true: colors.primary + "88" }}
              thumbColor={dontShowAgain ? colors.primary : colors.mutedForeground}
            />
          </View>

          {/* Continue button */}
          <TouchableOpacity
            style={[s.continueBtn, !acknowledged && s.continueBtnDis]}
            onPress={handleContinue}
            disabled={!acknowledged}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: !acknowledged }}
          >
            <Text style={s.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
