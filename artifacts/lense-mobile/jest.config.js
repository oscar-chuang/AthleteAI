module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js",
    "^expo-intent-launcher$": "<rootDir>/__mocks__/expo-intent-launcher.js",
    "^expo-file-system$":     "<rootDir>/__mocks__/expo-file-system.js",
    "^expo-media-library$": "<rootDir>/__mocks__/expo-media-library.js",
    "^expo-image-manipulator$": "<rootDir>/__mocks__/expo-image-manipulator.js",
  },
  testMatch: [
    "**/app/**/__tests__/**/*.test.{ts,tsx}",
    "**/components/**/__tests__/**/*.test.{ts,tsx}",
    "**/lib/**/__tests__/**/*.test.{ts,tsx}",
  ],
  testTimeout: 30000,
  forceExit: true,
};
