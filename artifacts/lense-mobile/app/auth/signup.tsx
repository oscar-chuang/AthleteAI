import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/authContext";
import { Button } from "@/components/ui";
import { SPACING, RADIUS } from "@/constants/spacing";

export default function SignupScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { signup } = useAuth();

  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [nameFocused,  setNameFocused]  = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused,  setPassFocused]  = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 40,  useNativeDriver: true }),
    ]).start();
  }

  async function handleSignup() {
    if (!name.trim() || !email.trim() || password.length < 8) return;
    setError(null);
    setLoading(true);
    try {
      await signup(email.trim(), password, name.trim());
      router.replace("/onboarding");
    } catch (e: any) {
      setError(e.message ?? "Sign up failed");
      shake();
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.inner, { paddingTop: topPad + SPACING.lg, paddingBottom: bottomPad + SPACING.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <View style={[s.backIcon, { backgroundColor: colors.surface3 }]}>
            <Feather name="arrow-left" size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Wordmark */}
        <View style={s.wordmarkRow}>
          <View style={[s.logoIcon, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55" }]}>
            <Feather name="zap" size={22} color={colors.primary} />
          </View>
          <Text style={[s.wordmark, { color: colors.textPrimary }]}>AthleteAI</Text>
        </View>

        <Text style={[s.heading, { color: colors.textPrimary }]}>Create your account</Text>
        <Text style={[s.sub, { color: colors.textTertiary }]}>Start training smarter with AI coaching</Text>

        {error ? (
          <Animated.View
            style={[s.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44", transform: [{ translateX: shakeAnim }] }]}
          >
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
          </Animated.View>
        ) : null}

        <Text style={[s.label, { color: colors.textSecondary }]}>Full name</Text>
        <View style={[s.inputWrap, { backgroundColor: colors.surface3, borderColor: nameFocused ? colors.primary : colors.border }]}>
          <Feather name="user" size={16} color={nameFocused ? colors.primary : colors.textTertiary} style={s.inputIcon} />
          <TextInput
            style={[s.input, { color: colors.textPrimary, flex: 1 }]}
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Alex Johnson"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
            autoComplete="name"
          />
        </View>

        <Text style={[s.label, { color: colors.textSecondary }]}>Email</Text>
        <View style={[s.inputWrap, { backgroundColor: colors.surface3, borderColor: emailFocused ? colors.primary : colors.border }]}>
          <Feather name="mail" size={16} color={emailFocused ? colors.primary : colors.textTertiary} style={s.inputIcon} />
          <TextInput
            style={[s.input, { color: colors.textPrimary, flex: 1 }]}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder="you@example.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />
        </View>

        <Text style={[s.label, { color: colors.textSecondary }]}>Password</Text>
        <View style={[s.inputWrap, { backgroundColor: colors.surface3, borderColor: passFocused ? colors.primary : colors.border }]}>
          <Feather name="lock" size={16} color={passFocused ? colors.primary : colors.textTertiary} style={s.inputIcon} />
          <TextInput
            style={[s.input, { color: colors.textPrimary, flex: 1 }]}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPassFocused(true)}
            onBlur={() => setPassFocused(false)}
            placeholder="8+ characters"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        {password.length > 0 && password.length < 8 && (
          <Text style={[s.hint, { color: colors.textTertiary }]}>Password must be at least 8 characters</Text>
        )}

        <Button
          label="Create Account"
          onPress={handleSignup}
          loading={loading}
          disabled={!canSubmit}
          fullWidth
          size="lg"
          icon="user-plus"
        />

        <View style={s.dividerRow}>
          <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[s.dividerText, { color: colors.textTertiary }]}>or</Text>
          <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity
          style={[s.altBtn, { borderColor: colors.borderStrong }]}
          onPress={() => router.push("/auth/login")}
          activeOpacity={0.8}
        >
          <Text style={[s.altBtnText, { color: colors.textPrimary }]}>Sign in instead</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  inner: {
    paddingHorizontal: SPACING.lg,
  },
  backBtn: {
    marginBottom: SPACING.xl,
    alignSelf: "flex-start",
  },
  backIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm + 2,
    marginBottom: SPACING.xl,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  heading: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    marginBottom: SPACING.sm,
  },
  sub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: SPACING.sm,
    letterSpacing: 0.2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  eyeBtn: {
    padding: 4,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  altBtn: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  altBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
