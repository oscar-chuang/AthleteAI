module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js",
  },
  testMatch: [
    "**/app/**/__tests__/**/*.test.{ts,tsx}",
    "**/components/**/__tests__/**/*.test.{ts,tsx}",
  ],
  testTimeout: 30000,
  forceExit: true,
};
