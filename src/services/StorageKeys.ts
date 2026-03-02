/**
 * Central registry of AsyncStorage keys.
 * Keys are versioned (v1, v2…) so schema migrations can be introduced without
 * corrupting data from previous app versions.
 */
export const StorageKeys = {
  LIBRARY: '@organicreader/library/v1',
  DELETED_LIBRARY: '@organicreader/deleted/v1',
  SETTINGS: '@organicreader/settings/v1',
  AUTH: '@organicreader/auth/v1',
} as const;
