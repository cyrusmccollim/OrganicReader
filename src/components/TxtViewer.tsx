import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../ThemeContext';
import { usePlayback } from '../context/PlaybackContext';
import { Theme } from '../theme';
import { ViewerHandle } from '../types';

const THEME_COLORS: Record<string, { bg: string; text: string }> = {
  light:   { bg: '#ffffff', text: '#1a1a1a' },
  dark:    { bg: '#121212', text: '#e0e0e0' },
  sepia:   { bg: '#f4ecd8', text: '#5b4636' },
  organic: { bg: '#0d1a12', text: '#d1e8d5' },
};

const FONT_MAP: Record<string, string | undefined> = {
  System:  undefined,
  Serif:   'Georgia',
  Sans:    undefined,
  Mono:    'Courier New',
  Modern:  undefined,
  Classic: 'Georgia',
};

interface Props {
  uri?: string;
  text?: string;
  refreshKey?: number;
  onSearchResult?: (count: number, current: number) => void;
  onViewerMessage?: (msg: Record<string, any>) => void;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TxtViewer = forwardRef<ViewerHandle, Props>(({ uri, text: textProp, refreshKey, onSearchResult, onViewerMessage }, ref) => {
  const { theme } = useTheme();
  const { appearance } = usePlayback();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const readerTheme = THEME_COLORS[appearance.theme] ?? THEME_COLORS.organic;
  const fontFamily  = FONT_MAP[appearance.fontStyle];
  const fontSize    = appearance.fontSize;
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState('');
  const [searchCurrent, setSearchCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);

  useEffect(() => {
    if (textProp !== undefined) {
      setContent(textProp);
      onViewerMessage?.({ type: 'ready' });
      return;
    }
    if (!uri) return;
    const path = uri.replace(/^file:\/\//, '');
    RNFS.readFile(path, 'utf8')
      .then(t => { setContent(t); onViewerMessage?.({ type: 'ready' }); })
      .catch(e => setError('Could not read file: ' + e.message));
  }, [uri, textProp, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute match positions
  const matchPositions = useMemo(() => {
    if (!content || !activeSearch.trim()) return [];
    const positions: number[] = [];
    const parts = content.split(new RegExp('(' + escapeRegex(activeSearch) + ')', 'gi'));
    let offset = 0;
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) positions.push(offset);
      offset += parts[i].length;
    }
    return positions;
  }, [content, activeSearch]);

  // Report results to parent whenever they change
  useEffect(() => {
    if (!activeSearch.trim()) {
      onSearchResult?.(0, 0);
      return;
    }
    onSearchResult?.(matchPositions.length, matchPositions.length > 0 ? searchCurrent + 1 : 0);
  }, [matchPositions.length, searchCurrent, activeSearch, onSearchResult]);

  // Scroll to current match (proportional approximation)
  useEffect(() => {
    if (!content || matchPositions.length === 0) return;
    const pos = matchPositions[searchCurrent] ?? 0;
    const ratio = pos / content.length;
    const scrollY = Math.max(0, ratio * (contentHeightRef.current - 500));
    scrollRef.current?.scrollTo({ y: scrollY, animated: true });
  }, [searchCurrent, matchPositions, content]);

  useImperativeHandle(ref, () => ({
    search: (query) => { setActiveSearch(query); setSearchCurrent(0); },
    searchNext: () => setSearchCurrent(c => matchPositions.length ? (c + 1) % matchPositions.length : 0),
    searchPrev: () => setSearchCurrent(c => matchPositions.length ? (c - 1 + matchPositions.length) % matchPositions.length : 0),
    clearSearch: () => { setActiveSearch(''); setSearchCurrent(0); },
  }), [matchPositions]);

  const renderContent = useCallback(() => {
    if (!content) return null;

    const textStyle = [
      styles.text,
      { fontSize, lineHeight: fontSize * 1.65, color: readerTheme.text },
      fontFamily ? { fontFamily } : null,
    ];

    if (!activeSearch.trim()) {
      return <Text style={textStyle}>{content}</Text>;
    }

    const captureRe = new RegExp('(' + escapeRegex(activeSearch) + ')', 'gi');
    const parts = content.split(captureRe);
    let matchIdx = 0;

    return (
      <Text style={textStyle}>
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            const isActive = matchIdx === searchCurrent;
            const key = i;
            matchIdx++;
            return (
              <Text
                key={key}
                style={isActive ? styles.highlightActive : styles.highlight}
              >
                {part}
              </Text>
            );
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  }, [content, activeSearch, searchCurrent, styles, fontSize, readerTheme, fontFamily]);

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: readerTheme.bg }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (content === null) {
    return (
      <View style={[styles.centered, { backgroundColor: readerTheme.bg }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, { backgroundColor: readerTheme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={(_, h) => { contentHeightRef.current = h; }}
    >
      {renderContent()}
    </ScrollView>
  );
});

function makeStyles(_theme: Theme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 24, paddingBottom: 48 },
    text: { /* fontSize/lineHeight/color/fontFamily applied dynamically */ },
    highlight: {
      backgroundColor: 'rgba(255,235,59,0.45)',
      borderRadius: 2,
    },
    highlightActive: {
      backgroundColor: 'rgba(255,153,0,0.75)',
      color: '#000',
      borderRadius: 2,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#e05555', fontSize: 14, textAlign: 'center', padding: 20 },
  });
}
