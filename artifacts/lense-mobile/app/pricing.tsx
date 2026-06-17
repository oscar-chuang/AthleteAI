import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth, useTier } from "@/lib/authContext";
import { stripeApi, type StripeTierInfo } from "@/lib/api";

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const currentTier = useTier();

  const [tiers, setTiers] = useState<StripeTierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    stripeApi.getConfig()
      .then((r) => { setTiers(r.tiers); })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, []);

  async function handleSelectTier(tier: StripeTierInfo) {
    if (tier.id === currentTier) return;

    if (tier.id === "free") {
      // Navigating away to free is handled by the portal or just go back
      router.back();
      return;
    }

    setUpgrading(tier.id);
    try {
      const { url } = await stripeApi.createCheckout(tier.id as "pro" | "elite");
      const result = await WebBrowser.openBrowserAsync(url);

      if (result.type === "success" || result.type === "dismiss") {
        // Refresh subscription status after returning from checkout
        await refreshProfile();
        router.back();
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setUpgrading(null);
    }
  }

  async function handleManageSubscription() {
    setUpgrading("manage");
    try {
      const { url } = await stripeApi.createPortal();
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.error("Portal failed:", err);
    } finally {
      setUpgrading(null);
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeBtn: { padding: 4 },
    headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: bottomPad + 24 },
    heroText: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
      marginBottom: 8,
    },
    heroSub: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginBottom: 28,
    },
    planCard: {
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 20,
      marginBottom: 16,
      position: "relative",
      overflow: "hidden",
    },
    planCardPopular: {
      borderColor: colors.primary,
    },
    popularBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    popularBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.5,
    },
    currentBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: colors.success + "22",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.success,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    currentBadgeText: {
      color: colors.success,
      fontSize: 10,
      fontFamily: "Inter_700Bold",
    },
    planName: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground },
    planDesc: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 14, marginBottom: 16, gap: 2 },
    priceDollar: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 4 },
    priceAmount: { fontSize: 36, fontFamily: "Inter_700Bold", color: colors.foreground },
    pricePeriod: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 6 },
    featureRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 8,
    },
    featureText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
    selectBtn: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      marginTop: 4,
    },
    selectBtnPrimary: { backgroundColor: colors.primary },
    selectBtnOutline: { borderWidth: 1.5, borderColor: colors.border },
    selectBtnCurrent: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.success },
    selectBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    selectBtnTextPrimary: { color: "#fff" },
    selectBtnTextOutline: { color: colors.foreground },
    selectBtnTextCurrent: { color: colors.success },
    manageBtn: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      marginTop: 4,
    },
    manageBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    faq: {
      marginTop: 8,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    faqTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 12 },
    faqItem: { marginBottom: 10 },
    faqQ: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 2 },
    faqA: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 17 },
  });

  if (loading) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Mark Pro as popular
  const tiersWithPopular = tiers.map((t) => ({
    ...t,
    isPopular: t.id === "pro",
  }));

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={s.heroText}>Unlock Your{"\n"}Full Potential</Text>
        <Text style={s.heroSub}>Elite AI coaching, unlimited analyses,{"\n"}and injury prevention — all in one app.</Text>

        {tiersWithPopular.map(({ ...tier }) => {
          const isCurrent = tier.id === currentTier;
          const isPopular = tier.isPopular;
          const isUpgrading = upgrading === tier.id;
          const price = tier.priceCents / 100;

          return (
            <View key={tier.id} style={[s.planCard, isPopular && !isCurrent && s.planCardPopular]}>
              {isPopular && !isCurrent && (
                <View style={s.popularBadge}>
                  <Text style={s.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}
              {isCurrent && (
                <View style={s.currentBadge}>
                  <Text style={s.currentBadgeText}>CURRENT</Text>
                </View>
              )}

              <Text style={s.planName}>{tier.name}</Text>

              <View style={s.priceRow}>
                {price > 0 && <Text style={s.priceDollar}>$</Text>}
                <Text style={s.priceAmount}>{price === 0 ? "Free" : price.toFixed(2)}</Text>
                {price > 0 && <Text style={s.pricePeriod}>/month</Text>}
              </View>

              <View style={s.divider} />

              {tier.features.map((f: string) => (
                <View key={f} style={s.featureRow}>
                  <Feather name="check-circle" size={15} color={colors.success} style={{ marginTop: 1 }} />
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}

              {isCurrent && currentTier !== "free" ? (
                <TouchableOpacity
                  style={s.manageBtn}
                  onPress={handleManageSubscription}
                  disabled={!!upgrading}
                  activeOpacity={0.85}
                >
                  {upgrading === "manage" ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text style={s.manageBtnText}>Manage Subscription</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    s.selectBtn,
                    isCurrent ? s.selectBtnCurrent : isPopular ? s.selectBtnPrimary : s.selectBtnOutline,
                  ]}
                  onPress={() => handleSelectTier(tier)}
                  disabled={isCurrent || !!upgrading}
                  activeOpacity={0.85}
                >
                  {isUpgrading ? (
                    <ActivityIndicator color={isPopular ? "#fff" : colors.primary} size="small" />
                  ) : (
                    <>
                      {isCurrent && <Feather name="check" size={16} color={colors.success} />}
                      <Text
                        style={[
                          s.selectBtnText,
                          isCurrent ? s.selectBtnTextCurrent : isPopular ? s.selectBtnTextPrimary : s.selectBtnTextOutline,
                        ]}
                      >
                        {isCurrent ? "Current Plan" : tier.id === "free" ? "Free Plan" : `Get ${tier.name}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={s.faq}>
          <Text style={s.faqTitle}>Frequently Asked Questions</Text>
          {[
            {
              q: "Can I cancel anytime?",
              a: "Yes. Cancel from the Stripe customer portal. Your plan stays active until the end of the billing period.",
            },
            {
              q: "Is my payment secure?",
              a: "All payments are processed securely by Stripe. We never store your card details on our servers.",
            },
            {
              q: "What happens to my analyses if I downgrade?",
              a: "Your existing analyses are always accessible. You just won't be able to create new ones beyond the free plan limit.",
            },
          ].map(({ q, a }) => (
            <View key={q} style={s.faqItem}>
              <Text style={s.faqQ}>{q}</Text>
              <Text style={s.faqA}>{a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}