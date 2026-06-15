import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/authContext";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: topPad + 24,
      paddingBottom: bottomPad + 24,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 32,
    },
    backText: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" },
    logo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 },
    logoIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + "22",
      borderWidth: 1.5,
      borderColor: colors.primary + "44",
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    heading: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8 },
    subheading: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 32 },
    label: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 6 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      paddingHorizontal: 14,
    },
    inputWrapFocused: { borderColor: colors.primary },
    input: {
      flex: 1,
      paddingVertical: 14,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    eyeBtn: { padding: 4 },
    errorBox: {
      backgroundColor: "#ff444422",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#ff4444",
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    errorText: { color: "#ff6666", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginVertical: 24,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" },
    signupBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
    },
    signupText: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_500Medium" },
  });

  const canSubmit = email.trim().length > 0 && password.length >= 8;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <View style={s.logo}>
          <View style={s.logoIcon}>
            <Feather name="zap" size={20} color={colors.primary} />
          </View>
          <Text style={s.logoText}>AthleteAI</Text>
        </View>

        <Text style={s.heading}>Welcome back</Text>
        <Text style={s.subheading}>Sign in to continue your training</Text>

        {error && (
          <View style={s.errorBox}>
            <Feather name="alert-circle" size={14} color="#ff6666" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <Text style={s.label}>Email</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />
        </View>

        <Text style={s.label}>Password</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoComplete="password"
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={18}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.primaryBtn, (!canSubmit || loading) && s.primaryBtnDisabled]}
          onPress={handleLogin}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="log-in" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>Sign In</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity
          style={s.signupBtn}
          onPress={() => router.push("/auth/signup")}
          activeOpacity={0.8}
        >
          <Text style={s.signupText}>Create an account</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
