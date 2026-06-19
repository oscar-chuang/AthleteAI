import { useTheme } from "@/lib/themeContext";

export function useColors() {
  const { colors } = useTheme();
  return colors;
}
