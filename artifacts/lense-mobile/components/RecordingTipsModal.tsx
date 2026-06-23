import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
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

const SCROLL_READ_THRESHOLD = 300;

interface Props {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
  loading?: boolean;
  bestPractices?: typeof BEST_PRACTICES;
  commonMistakes?: typeof COMMON_MISTAKES;
  exampleCards?: typeof EXAMPLE_CARDS;
}

export default function RecordingTipsModal({
  visible,
  onClose,
  onContinue,
  loading = false,
  bestPractices = BEST_PRACTICES,
  commonMistakes = COMMON_MISTAKES,
  exampleCards = EXAMPLE_CARDS,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [acknowledged, setAcknowledged] = useState(false);
  const [hasScrolledToContent, setHasScrolledToContent] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const canContinue = acknowledged || hasScrolledToContent;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!hasScrolledToContent && e.nativeEvent.contentOffset.y >= SCROLL_READ_THRESHOLD) {
      setHasScrolledToContent(true);
    }
  }

  function handleContinue() {
    if (!canContinue) return;
    setAcknowledged(false);
    setHasScrolledToContent(false);
    onContinue();
  }

  function handleClose() {
    setAcknowledged(false);
    setHasScrolledToContent(false);
    onClose();
  }

  const isEmpty = !loading && bestPractices.length === 0 && commonMistakes.length === 0;

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
    continueBtnText:{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
    skeletonCol:    { gap: 14 },
    emptyWrap:      { alignItems: "center", paddingVertical: 40, gap: 12 },
    emptyText:      { fontSize: 15, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={s.modal}>
        <View style={s.header}>
          <View style={{ width: 30 }} />
          <Text style={s.headerTitle}>Recording Tips</Text>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityHint="Aborts upload and closes this screen"
          >
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <GuidanceHeroBlock
            iconName="video"
            title="Get the Most Accurate Analysis"
            subtitle={"Great pose detection starts with a great video.\nFollow these tips for the best biomechanics results."}
          />

          {loading ? (
            <View style={s.skeletonCol}>
              <SkeletonBox height={14} width="40%" />
              <SkeletonBox height={44} />
              <SkeletonBox height={44} />
              <SkeletonBox height={44} />
              <View style={s.divider} />
              <SkeletonBox height={14} width="40%" />
              <SkeletonBox height={44} />
              <SkeletonBox height={44} />
            </View>
          ) : isEmpty ? (
            <View style={s.emptyWrap}>
              <Feather name="info" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No tips available right now.{"\n"}Check back later for guidance.</Text>
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
            accessibilityState={{ disabled: !canContinue }}
          >
            <Text style={s.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
