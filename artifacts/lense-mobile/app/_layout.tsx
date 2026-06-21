import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkeletonBox } from "@/components/ui/SkeletonLoader";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { ThemeProvider, useTheme } from "@/lib/themeContext";
import { handleNotificationResponse } from "@/utils/notificationHandler";

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 80 }}>
        <SkeletonBox height={24} width="40%" radius={8} style={{ marginBottom: 12 }} />
        <SkeletonBox height={36} width="70%" radius={8} style={{ marginBottom: 32 }} />
        <SkeletonBox height={100} radius={14} style={{ marginBottom: 16 }} />
        <SkeletonBox height={80}  radius={14} style={{ marginBottom: 16 }} />
        <SkeletonBox height={160} radius={14} />
      </View>
    );
  }

  return <>{children}</>;
}


export function NotificationListener() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => handleNotificationResponse(response, router))
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, router);
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

function RootLayoutNav() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/signup" />
      <Stack.Screen name="pricing" options={{ presentation: "modal" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="analysis/[id]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitle: "Analysis",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="analysis/skeleton/[id]"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="analysis/person-select/[id]"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="analysis/live/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="profile-settings"
        options={{ headerShown: false, presentation: "modal" }}
      />
    </Stack>
  );
}

function AppContent() {
  const { colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardProvider>
        <AuthGate>
          <NotificationListener />
          <RootLayoutNav />
        </AuthGate>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <AppContent />
            </QueryClientProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
