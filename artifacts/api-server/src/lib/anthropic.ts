// Re-export everything from the split ai/ modules.
// This file exists solely for backward compatibility — all callers that imported
// from "../lib/anthropic" continue to work without any import path changes.
export * from "./ai/index";
