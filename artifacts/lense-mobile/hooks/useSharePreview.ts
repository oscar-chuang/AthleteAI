import { useState } from "react";
import { Alert, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { RefObject } from "react";

export function useSharePreview() {
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharingUnavailable, setSharingUnavailable] = useState(false);

  function handleShare() {
    setSharingUnavailable(false);
    setShowSharePreview(true);
  }

  function handleCancelShare() {
    setSharingUnavailable(false);
    setShowSharePreview(false);
  }

  async function handleDoShare(shareCardRef: RefObject<View | null>) {
    if (sharing) return;
    setSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        setSharingUnavailable(true);
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      setShowSharePreview(false);
      setSharingUnavailable(false);
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your session",
      });
    } catch {
      Alert.alert("Couldn't share", "Something went wrong. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  return {
    showSharePreview,
    sharing,
    sharingUnavailable,
    handleShare,
    handleCancelShare,
    handleDoShare,
  };
}
