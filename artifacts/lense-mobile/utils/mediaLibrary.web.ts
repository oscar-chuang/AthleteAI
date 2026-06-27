import type { PermissionResponse } from "expo-media-library";

export async function requestPermissionsAsync(): Promise<PermissionResponse> {
  return {
    status: "denied" as PermissionResponse["status"],
    granted: false,
    expires: "never",
    canAskAgain: false,
  };
}

export async function saveToLibraryAsync(_uri: string): Promise<void> {}
