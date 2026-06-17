import React, { createContext, useContext, useState } from "react";
import { MOCK_ATHLETE } from "./athleteData";
import type { VideoAnalysis } from "./types";

interface AnalysesStore {
  analyses: VideoAnalysis[];
  videoUris: Record<string, string>;
  addAnalysis: (a: VideoAnalysis, videoUri?: string) => void;
}

const Ctx = createContext<AnalysesStore>({
  analyses: MOCK_ATHLETE.analyses,
  videoUris: {},
  addAnalysis: () => {},
});

export function AnalysesProvider({ children }: { children: React.ReactNode }) {
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>(MOCK_ATHLETE.analyses);
  const [videoUris, setVideoUris] = useState<Record<string, string>>({});

  function addAnalysis(a: VideoAnalysis, videoUri?: string) {
    setAnalyses((prev) => [a, ...prev]);
    if (videoUri) setVideoUris((prev) => ({ ...prev, [a.id]: videoUri }));
  }

  return <Ctx.Provider value={{ analyses, videoUris, addAnalysis }}>{children}</Ctx.Provider>;
}

export function useAnalyses() {
  return useContext(Ctx);
}
