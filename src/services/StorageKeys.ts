/**
 * Central registry of AsyncStorage keys.
 * Keys are versioned (v1, v2…) so schema migrations can be introduced without
 * corrupting data from previous app versions.
 */
export const StorageKeys = {
  LIBRARY: '@organicreader/library/v1',
  SETTINGS: '@organicreader/settings/v1',
} as const;
