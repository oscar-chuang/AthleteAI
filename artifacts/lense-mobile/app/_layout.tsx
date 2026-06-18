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
import { ActivityIndicator, Platform, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/lib/authContext";

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a0a0f", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
  router: ReturnType<typeof useRouter>
) {
  if (!response) return;
  const data = response.notification.request.content.data as Record<string, unknown>;
  if (data?.screen === "progress") {
    router.navigate({
      pathname: "/(tabs)/progress",
      params: { scrollTo: data.scrollTo as string | undefined },
    } as never);
  }
}

function NotificationListener() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Handle tap when app was fully terminated (cold start).
    Notifications.getLastNotificationResponseAsync()
      .then((response) => handleNotificationResponse(response, router))
      .catch(() => {});

    // Handle tap when app is in foreground or background.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, router);
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

function RootLayoutNav() {
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
          headerStyle: { backgroundColor: "#0a0a0f" },
          headerTintColor: "#f0f0f8",
          headerTitle: "Analysis",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="analysis/skeleton/[id]"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="profile-settings"
        options={{ headerShown: false, presentation: "modal" }}
      />
    </Stack>
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
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0a0a0f" }}>
              <KeyboardProvider>
                <AuthGate>
                  <NotificationListener />
                  <RootLayoutNav />
                </AuthGate>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
