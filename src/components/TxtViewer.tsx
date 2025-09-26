import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../ThemeContext';
import { usePlayback, FONT_FAMILIES } from '../context/PlaybackContext';
import { Theme } from '../theme';
import { ViewerHandle } from '../types';
import { Sentence } from '../services/tts/TextSegmenter';

const THEME_COLORS: Record<string, { bg: string; text: string }> = {
  light:   { bg: '#ffffff', text: '#1a1a1a' },
  dark:    { bg: '#121212', text: '#e0e0e0' },
  sepia:   { bg: '#f4ecd8', text: '#5b4636' },
  organic: { bg: '#0d1a0e', text: '#c4d8b4' },
};

interface Props {
  uri?: string;
  text?: string;
  refreshKey?: number;
  onSearchResult?: (count: number, current: number) => void;
  onViewerMessage?: (msg: Record<string, any>) => void;
  // TTS highlight mode
  ttsMode?: boolean;
  sentences?: Sentence[];
  activeSentenceIndex?: number;
  activeWordIndex?: number;
  onSentenceTap?: (index: number) => void;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TxtViewer = forwardRef<ViewerHandle, Props>(({
  uri, text: textProp, refreshKey,
  onSearchResult, onViewerMessage,
  ttsMode, sentences, activeSentenceIndex, activeWordIndex, onSentenceTap,
}, ref) => {
  const { theme } = useTheme();
  const { appearance } = usePlayback();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const readerTheme = THEME_COLORS[appearance.theme] ?? THEME_COLORS.organic;
  const fontFamily  = FONT_FAMILIES[appearance.fontStyle];
  const fontSize    = appearance.fontSize;
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState('');
  const [searchCurrent, setSearchCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const sentenceLayoutsRef = useRef<number[]>([]);

  // Normalize line endings to \n so TTS sentence positions (computed on normalized text) align
  const normalize = (t: string) => t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  useEffect(() => {
    if (textProp !== undefined) {
      setContent(normalize(textProp));
      onViewerMessage?.({ type: 'ready' });
      return;
    }
    if (!uri) return;
    const path = uri.replace(/^file:\/\//, '');
    RNFS.readFile(path, 'utf8')
      .then(t => { setContent(normalize(t)); onViewerMessage?.({ type: 'ready' }); })
      .catch(e => setError('Could not read file: ' + e.message));
  }, [uri, textProp, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll: only when highlighted sentence passes 75% of the visible viewport
  useEffect(() => {
    if (!ttsMode || activeSentenceIndex === undefined) return;
    const sentY = sentenceLayoutsRef.current[activeSentenceIndex];
    if (sentY === undefined) return;
    const offset = scrollOffsetRef.current;
    const height = scrollViewHeightRef.current;
    if (height === 0) return;
    if (sentY > offset + height * 0.75) {
      scrollRef.current?.scrollTo({ y: Math.max(0, sentY - height * 0.45), animated: true });
    }
  }, [ttsMode, activeSentenceIndex]);

  // Compute match positions for search
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

  useEffect(() => {
    if (!activeSearch.trim()) {
      onSearchResult?.(0, 0);
      return;
    }
    onSearchResult?.(matchPositions.length, matchPositions.length > 0 ? searchCurrent + 1 : 0);
  }, [matchPositions.length, searchCurrent, activeSearch, onSearchResult]);

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

  const renderTTSContent = useCallback(() => {
    if (!sentences || sentences.length === 0 || !content) return null;

    const textStyle = [
      styles.text,
      { fontSize, lineHeight: fontSize * 1.65, color: readerTheme.text },
      fontFamily ? { fontFamily } : null,
    ];

    // Strategy: split full content on paragraph breaks (\n\n or \n).
    // For each line, determine which sentence(s) it contains and render
    // those sentences inline. This preserves newline structure since each
    // line is its own <Text> block inside a <View>.

    // Build a flat array of "runs": either a sentence ref or a literal string.
    type Run = { type: 'sent'; si: number } | { type: 'text'; str: string };
    const runs: Run[] = [];
    let cursor = 0;

    for (let si = 0; si < sentences.length; si++) {
      const sent = sentences[si];
      if (sent.charStart > cursor) {
        runs.push({ type: 'text', str: content.slice(cursor, sent.charStart) });
      }
      runs.push({ type: 'sent', si });
      cursor = sent.charEnd;
    }
    if (cursor < content.length) {
      runs.push({ type: 'text', str: content.slice(cursor) });
    }

    // Now split runs on newlines, producing an array of lines where each
    // line is an array of inline nodes. Splitting a text run on \n produces
    // multiple lines; sentence runs stay on a single line (never split mid-sentence).
    // Normalize \r\n to \n so Windows-format content doesn't produce stray \r characters.
    type InlineNode = { kind: 'literal'; text: string } | { kind: 'sent'; si: number };
    const lines: InlineNode[][] = [[]];

    for (const run of runs) {
      if (run.type === 'sent') {
        lines[lines.length - 1].push({ kind: 'sent', si: run.si });
      } else {
        const parts = run.str.replace(/\r\n/g, '\n').split('\n');
        for (let pi = 0; pi < parts.length; pi++) {
          if (pi > 0) lines.push([]);
          if (parts[pi].length > 0) {
            lines[lines.length - 1].push({ kind: 'literal', text: parts[pi] });
          }
        }
      }
    }

    return (
      <View>
        {lines.map((line, li) => {
          if (line.length === 0) {
            return <View key={`line-${li}`} style={{ height: fontSize * 0.8 }} />;
          }

          // Collect active sentence indices in this line to track in the View's onLayout
          const sentIndicesInLine = line
            .filter((n): n is { kind: 'sent'; si: number } => n.kind === 'sent')
            .map(n => n.si);

          return (
            // <View> wrapper: onLayout here gives Y relative to the scroll content — reliable for auto-scroll
            <View
              key={`line-${li}`}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                for (const si of sentIndicesInLine) {
                  sentenceLayoutsRef.current[si] = y;
                }
              }}
            >
              <Text style={textStyle}>
                {line.map((node, ni) => {
                  if (node.kind === 'literal') {
                    return <Text key={`lit-${li}-${ni}`}>{node.text}</Text>;
                  }
                  const si = node.si;
                  const sent = sentences[si];
                  const isActive = si === activeSentenceIndex;
                  // Normalize any residual newlines to spaces for inline rendering
                  const displayText = sent.text.replace(/\n/g, ' ');

                  if (isActive) {
                    const words = displayText.split(/(\s+)/);
                    return (
                      <Text key={`s-${sent.index}`} suppressHighlighting onPress={() => onSentenceTap?.(si)}>
                        {words.map((word, wi) => {
                          const wordIdx = Math.floor(wi / 2);
                          const isActiveWord = wordIdx === activeWordIndex && wi % 2 === 0;
                          if (wi % 2 === 1) return <Text key={wi}>{word}</Text>;
                          return (
                            <Text key={wi} style={isActiveWord ? styles.ttsWordHighlight : undefined}>
                              {word}
                            </Text>
                          );
                        })}
                      </Text>
                    );
                  }

                  return (
                    <Text
                      key={`s-${sent.index}`}
                      suppressHighlighting
                      onPress={() => onSentenceTap?.(si)}
                      style={{ opacity: 0.65 }}
                    >
                      {displayText}
                    </Text>
                  );
                })}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }, [sentences, content, activeSentenceIndex, activeWordIndex, onSentenceTap, styles, fontSize, readerTheme, fontFamily]);

  const renderSearchContent = useCallback(() => {
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
              <Text key={key} style={isActive ? styles.highlightActive : styles.highlight}>
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
      scrollEventThrottle={100}
      onLayout={(e) => { scrollViewHeightRef.current = e.nativeEvent.layout.height; }}
      onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
      onContentSizeChange={(_, h) => { contentHeightRef.current = h; }}
    >
      {ttsMode && sentences ? renderTTSContent() : renderSearchContent()}
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
    ttsWordHighlight: {
      backgroundColor: 'rgba(100,200,100,0.38)',
      borderRadius: 3,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#e05555', fontSize: 14, textAlign: 'center', padding: 20 },
  });
}
