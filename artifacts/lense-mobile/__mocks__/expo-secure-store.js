// Jest mock for expo-secure-store — provides the same in-memory key/value
// interface as the real SecureStore so token reads/writes work in tests
// without touching the native Keychain / Android Keystore.

const store = new Map();

module.exports = {
  getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
  setItemAsync: jest.fn(async (key, value) => { store.set(key, value); }),
  deleteItemAsync: jest.fn(async (key) => { store.delete(key); }),
  // Reset helper — not part of the real API; useful in beforeEach
  __reset: () => store.clear(),
};
