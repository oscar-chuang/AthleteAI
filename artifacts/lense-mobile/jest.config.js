module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/app/**/__tests__/**/*.test.{ts,tsx}"],
  testTimeout: 30000,
};
