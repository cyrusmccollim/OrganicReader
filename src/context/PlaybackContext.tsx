import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ViewMode = 'original' | 'text';

export type ReaderTheme = 'light' | 'dark' | 'sepia' | 'organic';
export type ReaderFont = 'System' | 'Serif' | 'Sans' | 'Mono' | 'Modern' | 'Classic';

export const FONT_FAMILIES: Record<ReaderFont, string | undefined> = {
  System:  undefined,
  Serif:   Platform.OS === 'ios' ? 'Georgia'            : 'serif',
  Sans:    Platform.OS === 'ios' ? 'AvenirNext-Regular' : 'sans-serif',
  Mono:    Platform.OS === 'ios' ? 'Menlo'              : 'monospace',
  Modern:  Platform.OS === 'ios' ? 'Futura-Medium'      : 'sans-serif-condensed',
  Classic: Platform.OS === 'ios' ? 'Palatino-Roman'     : 'serif',
};

export interface AppearanceSettings {
  fontSize: number;
  fontStyle: ReaderFont;
  theme: ReaderTheme;
}

export interface AutoSkipSettings {
  headers: boolean;
  footers: boolean;
  citations: boolean;
  parentheses: boolean;
  brackets: boolean;
  braces: boolean;
  urls: boolean;
}

interface PlayerSettings {
  autoHidePlayer: boolean;
  autoScroll: boolean;
  playbackSpeed: string;
}

interface PlaybackContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  appearance: AppearanceSettings;
  updateAppearance: (settings: Partial<AppearanceSettings>) => void;
  autoSkip: AutoSkipSettings;
  updateAutoSkip: (settings: Partial<AutoSkipSettings>) => void;
  playerSettings: PlayerSettings;
  updatePlayerSettings: (settings: Partial<PlayerSettings>) => void;
}

const PlaybackContext = createContext<PlaybackContextType>(null!);

const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 18,
  fontStyle: 'System',
  theme: 'organic',
};

const DEFAULT_AUTO_SKIP: AutoSkipSettings = {
  headers: true,
  footers: true,
  citations: true,
  parentheses: false,
  brackets: false,
  braces: true,
  urls: true,
};

const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  autoHidePlayer: false,
  autoScroll: true,
  playbackSpeed: '1x',
};

const STORAGE_KEYS = {
  APPEARANCE: '@organicreader/playback/appearance/v2',
  AUTO_SKIP: '@organicreader/playback/autoskip/v1',
  PLAYER: '@organicreader/playback/player/v2',
};

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [autoSkip, setAutoSkip] = useState<AutoSkipSettings>(DEFAULT_AUTO_SKIP);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);

  useEffect(() => {
    // Load persisted settings, merging with defaults to handle schema evolution
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.APPEARANCE),
      AsyncStorage.getItem(STORAGE_KEYS.AUTO_SKIP),
      AsyncStorage.getItem(STORAGE_KEYS.PLAYER),
    ]).then(([appJson, skipJson, playerJson]) => {
      if (appJson) setAppearance({ ...DEFAULT_APPEARANCE, ...JSON.parse(appJson) });
      if (skipJson) setAutoSkip({ ...DEFAULT_AUTO_SKIP, ...JSON.parse(skipJson) });
      if (playerJson) setPlayerSettings({ ...DEFAULT_PLAYER_SETTINGS, ...JSON.parse(playerJson) });
    }).catch(() => {
      // Storage read failure - use defaults, which are already set
    });
  }, []);

  const updateAppearance = (settings: Partial<AppearanceSettings>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...settings };
      // Persist after state update - do NOT call setItem inside updater (React may call updater multiple times)
      Promise.resolve().then(() => AsyncStorage.setItem(STORAGE_KEYS.APPEARANCE, JSON.stringify(next)));
      return next;
    });
  };

  const updateAutoSkip = (settings: Partial<AutoSkipSettings>) => {
    setAutoSkip((prev) => {
      const next = { ...prev, ...settings };
      Promise.resolve().then(() => AsyncStorage.setItem(STORAGE_KEYS.AUTO_SKIP, JSON.stringify(next)));
      return next;
    });
  };

  const updatePlayerSettings = (settings: Partial<PlayerSettings>) => {
    setPlayerSettings((prev) => {
      const next = { ...prev, ...settings };
      Promise.resolve().then(() => AsyncStorage.setItem(STORAGE_KEYS.PLAYER, JSON.stringify(next)));
      return next;
    });
  };

  return (
    <PlaybackContext.Provider
      value={{
        viewMode,
        setViewMode,
        appearance,
        updateAppearance,
        autoSkip,
        updateAutoSkip,
        playerSettings,
        updatePlayerSettings,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  return useContext(PlaybackContext);
}
