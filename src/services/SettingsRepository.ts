/**
 * SettingsRepository — local implementation of the app settings data layer.
 *
 * Architecture note
 * -----------------
 * Matches the ISettingsRepository interface, allowing a future remote
 * implementation (tied to a user account) to be substituted without
 * touching ThemeContext or any other consumer.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AccentColor, ACCENT_COLORS } from '../theme';
import { StorageKeys } from './StorageKeys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppSettings {
  isDark: boolean;
  accent: AccentColor;
}

export interface ISettingsRepository {
  load(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: AppSettings = {
  isDark: true,
  accent: ACCENT_COLORS[0],
};

// ---------------------------------------------------------------------------
// Local (AsyncStorage) implementation
// ---------------------------------------------------------------------------

async function load(): Promise<AppSettings> {
  try {
    const json = await AsyncStorage.getItem(StorageKeys.SETTINGS);
    if (!json) return DEFAULTS;
    // Merge with defaults so new fields added in future schema versions
    // don't arrive as undefined for existing users.
    return { ...DEFAULTS, ...JSON.parse(json) };
  } catch {
    return DEFAULTS;
  }
}

async function save(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.warn('Settings save failed:', error);
    // Silently fail — settings will just not persist across reloads
  }
}

export const SettingsRepository: ISettingsRepository = { load, save };
