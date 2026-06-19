module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: [
    "**/app/**/__tests__/**/*.test.{ts,tsx}",
    "**/components/**/__tests__/**/*.test.{ts,tsx}",
  ],
  testTimeout: 30000,
  forceExit: true,
};
