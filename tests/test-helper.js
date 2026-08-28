/**
 * Shared Test Helper — Universal Mocks for Browser Globals in Node.js
 */

export function setupTestEnvironment() {
  const store = new Map();

  const mockStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(i) {
      return Array.from(store.keys())[i] || null;
    }
  };

  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true
    });
  } catch {
    global.localStorage = mockStorage;
  }

  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true
    });
  } catch {
    global.navigator = { onLine: true };
  }

  global.window = {
    location: { hostname: 'localhost', href: 'http://localhost:3000' },
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  return { storage: mockStorage, rawMap: store };
}
