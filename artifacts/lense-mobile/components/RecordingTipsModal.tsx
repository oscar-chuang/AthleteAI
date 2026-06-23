import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
  AccessibilityInfo,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { SkeletonBox } from "@/components/ui/SkeletonLoader";

import { BEST_PRACTICES, COMMON_MISTAKES, EXAMPLE_CARDS } from "./recordingGuidance/config";
import GuidanceTipRow from "./recordingGuidance/GuidanceTipRow";
import ExampleCard from "./recordingGuidance/ExampleCard";
import AcknowledgeCheckbox from "./recordingGuidance/AcknowledgeCheckbox";
import GuidanceHeroBlock from "./recordingGuidance/GuidanceHeroBlock";
import GuidanceSectionHeader from "./recordingGuidance/GuidanceSectionHeader";

interface Props {
  visible: boolean;
  onContinue: () => void;
  loading?: boolean;
  bestPractices?: typeof BEST_PRACTICES;
  commonMistakes?: typeof COMMON_MISTAKES;
  exampleCards?: typeof EXAMPLE_CARDS;
  testID?: string;
}

export default function RecordingTipsModal({
  visible,
  onContinue,
  loading = false,
  bestPractices = BEST_PRACTICES,
  commonMistakes = COMMON_MISTAKES,
  exampleCards = EXAMPLE_CARDS,
  testID,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [acknowledged, setAcknowledged] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const canContinue = acknowledged;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      if (mounted) setReduceMotion(val);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (val) => {
      setReduceMotion(val);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  function handleContinue() {
    if (!canContinue) return;
    setAcknowledged(false);
    onContinue();
  }

  const isEmpty = !loading && bestPractices.length === 0 && commonMistakes.length === 0;

  const s = StyleSheet.create({
    modal:          { flex: 1, backgroundColor: colors.background },
    header:         {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle:    { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground },
    scroll:         { flex: 1 },
    scrollContent:  { padding: 20, paddingBottom: 12 },
    divider:        { height: 1, backgroundColor: colors.border, marginVertical: 20 },
    cardsGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4, marginBottom: 4 },
    footer:         {
      padding: 20,
      paddingBottom: Math.max(insets.bottom + 8, 24),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 14,
    },
    continueBtn:    {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
    },
    continueBtnDis: { opacity: 0.4 },
    continueBtnText:{ color: colors.primaryForeground, fontSize: 16, fontFamily: "Inter_700Bold" },
    skeletonCol:    { gap: 14 },
    staticBox:      { borderRadius: 8, backgroundColor: colors.surface3 },
    emptyWrap:      { alignItems: "center", paddingVertical: 48, gap: 14 },
    emptyIconWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
    emptyHeading:   { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" },
    emptyBody:      { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 20 },
  });

  function renderSkeletonRow(height: number, width: number | string = "100%") {
    if (reduceMotion) {
      return <View style={[s.staticBox, { height, width: width as any }]} />;
    }
    return <SkeletonBox height={height} width={width} />;
  }

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "slide"}
      presentationStyle="pageSheet"
      testID={testID}
    >
      <View style={s.modal}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Recording Tips</Text>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <GuidanceHeroBlock
            iconName="video"
            title="Get the Most Accurate Analysis"
            subtitle={"Great pose detection starts with a great video.\nFollow these tips for the best biomechanics results."}
          />

          {loading ? (
            <View style={s.skeletonCol}>
              {renderSkeletonRow(14, "40%")}
              {renderSkeletonRow(44)}
              {renderSkeletonRow(44)}
              {renderSkeletonRow(44)}
              {renderSkeletonRow(44)}
              {renderSkeletonRow(44)}
              <View style={s.divider} />
              {renderSkeletonRow(14, "40%")}
              {renderSkeletonRow(44)}
              {renderSkeletonRow(44)}
              {renderSkeletonRow(44)}
              {renderSkeletonRow(44)}
            </View>
          ) : isEmpty ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Feather name="info" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={s.emptyHeading}>No tips available right now</Text>
              <Text style={s.emptyBody}>Check back later for recording guidance.</Text>
            </View>
          ) : (
            <>
              <GuidanceSectionHeader label="Best Practices" color={colors.success} />
              {bestPractices.map((tip) => (
                <GuidanceTipRow key={tip.id} tip={tip} variant="good" />
              ))}

              <View style={s.divider} />

              <GuidanceSectionHeader label="Common Mistakes" color={colors.destructive} />
              {commonMistakes.map((tip) => (
                <GuidanceTipRow key={tip.id} tip={tip} variant="bad" />
              ))}

              <View style={s.divider} />

              <GuidanceSectionHeader label="Examples" color={colors.mutedForeground} />
              <View style={s.cardsGrid}>
                {exampleCards.map((card) => (
                  <ExampleCard key={card.id} card={card} />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={s.footer}>
          <AcknowledgeCheckbox
            checked={acknowledged}
            onToggle={() => setAcknowledged((v) => !v)}
            label="I understand these recording guidelines."
          />

          <TouchableOpacity
            style={[s.continueBtn, !canContinue && s.continueBtnDis]}
            onPress={handleContinue}
            disabled={!canContinue}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityHint="Proceed to upload after acknowledging guidelines"
            accessibilityState={{ disabled: !canContinue }}
          >
            <Text style={s.continueBtnText}>Continue to Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
