import 'expo-sqlite/localStorage/install';

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
const snapshotCache = new Map<string, { raw: string | null; parsed: unknown }>();

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

export const storage = {
  getString(key: string): string | null {
    return safeGet(key);
  },

  setString(key: string, value: string): void {
    safeSet(key, value);
    listeners.get(key)?.forEach((fn) => fn());
  },

  get<T>(key: string, defaultValue: T): T {
    const raw = safeGet(key);
    if (raw == null) return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    safeSet(key, JSON.stringify(value));
    listeners.get(key)?.forEach((fn) => fn());
  },

  // Stable snapshot reader for `useSyncExternalStore`. Returns the same
  // parsed reference until the underlying raw string changes, so React's
  // `Object.is` comparison won't see spurious updates and trigger an
  // infinite re-render loop.
  getSnapshot<T>(key: string): T | null {
    const raw = safeGet(key);
    const hit = snapshotCache.get(key);
    if (hit && hit.raw === raw) return hit.parsed as T | null;

    let parsed: T | null = null;
    if (raw != null) {
      try {
        parsed = JSON.parse(raw) as T;
      } catch {
        parsed = null;
      }
    }
    snapshotCache.set(key, { raw, parsed });
    return parsed;
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
    listeners.get(key)?.forEach((fn) => fn());
  },

  subscribe(key: string, listener: Listener): () => void {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(listener);
    return () => {
      listeners.get(key)?.delete(listener);
    };
  },
};
