import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "expo-router";

export default function TabLayout() {
  const colors = useColors();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated]);

  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          position:        "absolute",
          backgroundColor: isIOS ? "transparent" : colors.surface1,
          borderTopWidth:  0,
          borderTopColor:  "transparent",
          elevation:       0,
          zIndex:          100,
          height:          isWeb ? 84 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,15,0.90)", borderTopWidth: 1, borderTopColor: colors.border }]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.surface1, borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            />
          ),
        tabBarLabelStyle: {
          fontSize:    10,
          fontFamily:  "Inter_600SemiBold",
          marginBottom: isWeb ? 16 : 2,
          letterSpacing: 0.3,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Feather name={focused ? "home" : "home"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analyze"
        options={{
          title: "Analyze",
          tabBarIcon: ({ color }) => (
            <Feather name="activity" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color }) => (
            <Feather name="trending-up" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: "Compare",
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Coach",
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
