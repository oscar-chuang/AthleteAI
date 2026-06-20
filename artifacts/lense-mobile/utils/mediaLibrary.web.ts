import type { PermissionResponse, PermissionStatus } from "expo-media-library";

export async function requestPermissionsAsync(): Promise<PermissionResponse> {
  return {
    status: "denied" as PermissionStatus,
    granted: false,
    expires: "never",
    canAskAgain: false,
  };
}

export async function saveToLibraryAsync(_uri: string): Promise<void> {}
