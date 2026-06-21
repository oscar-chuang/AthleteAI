import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/lib/themeContext";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "expo-router";

const TAB_HEIGHT = Platform.OS === "web" ? 72 : 58;

function TabIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  color: string;
  focused: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.iconWrap}>
      {focused && (
        <View style={[styles.activeBar, { backgroundColor: colors.primary }]} />
      )}
      <Feather name={name} size={23} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated]);

  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      initialRouteName="analyze"
      screenOptions={{
        headerShown:             false,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel:         false,
        tabBarStyle: {
          position:        "absolute",
          backgroundColor: isIOS ? "transparent" : colors.surface2,
          borderTopWidth:  0,
          borderTopColor:  "transparent",
          elevation:       0,
          zIndex:          100,
          height:          TAB_HEIGHT,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? "dark" : "light"}
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark ? "rgba(11,13,15,0.92)" : "rgba(245,247,250,0.92)",
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.borderStrong,
                },
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.surface2,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.borderStrong,
                },
              ]}
            />
          ),
        tabBarItemStyle: {
          paddingVertical: 0,
          height: TAB_HEIGHT,
          justifyContent: "center",
          alignItems: "center",
        },
      }}
    >
      {/* Hidden tabs — routes still work, not shown in tab bar */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          href: null,
        }}
      />

      {/* Visible tabs — Analyze · Progress · Coach · Profile */}
      <Tabs.Screen
        name="analyze"
        options={{
          title: "Analyze",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="activity" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="trending-up" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Coach",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="message-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="user" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: "100%",
    paddingTop: 6,
  },
  activeBar: {
    position: "absolute",
    top: 0,
    width: 28,
    height: 2,
    borderRadius: 2,
  },
});
