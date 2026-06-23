// Re-export everything from the split data/ modules.
// This file exists for backward compatibility — callers that import from
// "../lib/athleteData" or "../../lib/athleteData" continue to work unchanged.
export {
  MOCK_ANALYSES,
  MOCK_PROGRESS,
  MOCK_ACHIEVEMENTS,
  MOCK_ATHLETE,
  MOCK_CHAT,
  PRO_ATHLETES,
} from "./data/index";
