import type { NotificationResponse } from "expo-notifications";
import type { useRouter } from "expo-router";

export function handleNotificationResponse(
  response: NotificationResponse | null | undefined,
  router: ReturnType<typeof useRouter>
): void {
  if (!response) return;
  const data = response.notification.request.content.data as Record<string, unknown>;
  if (data?.screen === "progress") {
    router.navigate({
      pathname: "/(tabs)/progress",
      params: { scrollTo: data.scrollTo as string | undefined },
    } as never);
  }
}
