import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../ThemeContext';
import { usePlayback, FONT_FAMILIES } from '../context/PlaybackContext';
import { Theme } from '../theme';
import { ViewerHandle } from '../types';
import { Sentence } from '../services/tts/TextSegmenter';
import { SentenceTiming } from '../services/tts/TimingAccumulator';
import { SimpleAudio } from '../services/tts/SimpleAudio';

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
  ttsMode?: boolean;
  sentences?: Sentence[];
  activeSentenceIndex?: number;
  activeSentenceTiming?: SentenceTiming | null;
  onSentenceTap?: (index: number) => void;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type InlineNode = { kind: 'literal'; text: string } | { kind: 'sent'; si: number };

// ─── Active sentence: maintains its own word-index state via direct SimpleAudio subscription.
// Only THIS component re-renders on each AudioProgress tick -- not TxtViewer, not PlaybackScreen.
const ActiveSentence = React.memo(function ActiveSentence({
  displayText,
  timing,
  sentenceHighlightStyle,
  wordHighlightStyle,
  onPress,
}: {
  displayText: string;
  timing: SentenceTiming;
  sentenceHighlightStyle: object;
  wordHighlightStyle: object;
  onPress: () => void;
}) {
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    setWordIdx(0);
    const wt = timing.wordTimings;
    const sub = SimpleAudio.onProgress((posMs) => {
      // Lead offset: highlight the next word ~200ms early so it feels in sync
      const absoluteMs = timing.startMs + posMs + 200;
      // Binary search — O(log n) vs O(n) linear scan
      let lo = 0, hi = wt.length - 1, w = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (wt[mid].startMs <= absoluteMs) { w = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      setWordIdx(w);
    });
    return () => sub.remove();
  }, [timing]);

  const words = displayText.split(/(\s+)/);
  return (
    // Soft sentence-level background -- entire span highlighted
    <Text suppressHighlighting onPress={onPress} style={sentenceHighlightStyle}>
      {words.map((word, wi) => {
        if (wi % 2 === 1) return <Text key={wi}>{word}</Text>;
        const isActiveWord = Math.floor(wi / 2) === wordIdx;
        return (
          <Text key={wi} style={isActiveWord ? wordHighlightStyle : undefined}>
            {word}
          </Text>
        );
      })}
    </Text>
  );
});

const TxtViewerInner = forwardRef<ViewerHandle, Props>(({
  uri, text: textProp, refreshKey,
  onSearchResult, onViewerMessage,
  ttsMode, sentences, activeSentenceIndex, activeSentenceTiming, onSentenceTap,
}, ref) => {
  const { theme } = useTheme();
  const { appearance } = usePlayback();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const readerTheme = THEME_COLORS[appearance.theme] ?? THEME_COLORS.organic;
  const fontFamily  = FONT_FAMILIES[appearance.fontStyle];
  const fontSize    = appearance.fontSize;

  // Per-reader-theme highlight colors.
  // Light/dark: use the accent primary with opacity appended as 8-digit hex.
  // Sepia/organic: fixed colours that complement those palettes.
  const { sentenceHighlightStyle, wordHighlightStyle } = useMemo(() => {
    let sentBg: string;
    let wordBg: string;
    switch (appearance.theme) {
      case 'sepia':
        sentBg = 'rgba(139, 90, 43, 0.16)';   // warm amber wash
        wordBg = 'rgba(139, 90, 43, 0.50)';   // stronger amber
        break;
      case 'organic':
        sentBg = 'rgba(196, 216, 180, 0.13)'; // subtle sage on dark bg
        wordBg = 'rgba(100, 200, 100, 0.40)'; // vivid sage
        break;
      default:
        // light + dark: accent primary at low/higher opacity (8-digit hex RRGGBBAA)
        sentBg = theme.colors.primary + '22'; // ~13 % opacity
        wordBg = theme.colors.primary + '55'; // ~33 % opacity
    }
    return {
      sentenceHighlightStyle: { backgroundColor: sentBg, borderRadius: 3 },
      wordHighlightStyle:     { backgroundColor: wordBg, borderRadius: 3 },
    };
  }, [appearance.theme, theme.colors.primary]);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState('');
  const [searchCurrent, setSearchCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollInnerRef = useRef<View>(null);
  const contentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const lineViewRefs = useRef<Map<number, View>>(new Map());

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

  // Auto-scroll: measure the active line's position and center it.
  useEffect(() => {
    if (!ttsMode || activeSentenceIndex === undefined) return;
    const height = scrollViewHeightRef.current;
    if (height === 0) return;
    const lineView = lineViewRefs.current.get(activeSentenceIndex);
    const inner = scrollInnerRef.current;
    if (!lineView || !inner) return;
    lineView.measureLayout(inner, (_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - height * 0.4), animated: true });
    }, () => {});
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

  // Pre-compute TTS lines -- only recomputes when content or sentences change,
  // never on word/sentence highlight ticks.
  const ttsLines = useMemo((): InlineNode[][] => {
    if (!sentences || sentences.length === 0 || !content) return [];

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

    return lines;
  }, [content, sentences]);

  const renderTTSContent = useCallback(() => {
    if (ttsLines.length === 0) return null;

    const textStyle = [
      styles.text,
      { fontSize, lineHeight: fontSize * 1.65, color: readerTheme.text },
      fontFamily ? { fontFamily } : null,
    ];

    return (
      <View ref={scrollInnerRef}>
        {ttsLines.map((line, li) => {
          if (line.length === 0) {
            return <View key={`line-${li}`} style={{ height: fontSize * 0.8 }} />;
          }

          const sentIndicesInLine = line
            .filter((n): n is { kind: 'sent'; si: number } => n.kind === 'sent')
            .map(n => n.si);

          return (
            <View
              key={`line-${li}`}
              ref={(v) => {
                for (const si of sentIndicesInLine) {
                  if (v) lineViewRefs.current.set(si, v);
                  else lineViewRefs.current.delete(si);
                }
              }}
            >
              <Text style={textStyle}>
                {line.map((node, ni) => {
                  if (node.kind === 'literal') {
                    return <Text key={`lit-${li}-${ni}`}>{node.text}</Text>;
                  }
                  const si = node.si;
                  const sent = sentences![si];
                  const isActive = si === activeSentenceIndex;
                  const displayText = sent.text.replace(/\n/g, ' ');

                  if (isActive && activeSentenceTiming) {
                    return (
                      <ActiveSentence
                        key={`s-${sent.index}`}
                        displayText={displayText}
                        timing={activeSentenceTiming}
                        sentenceHighlightStyle={sentenceHighlightStyle}
                        wordHighlightStyle={wordHighlightStyle}
                        onPress={() => onSentenceTap?.(si)}
                      />
                    );
                  }

                  return (
                    <Text
                      key={`s-${sent.index}`}
                      suppressHighlighting
                      onPress={() => onSentenceTap?.(si)}
                      style={isActive ? undefined : { opacity: 0.65 }}
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
  // activeSentenceTiming replaces activeWordIndex — re-renders only when sentence changes
  }, [ttsLines, activeSentenceIndex, activeSentenceTiming, onSentenceTap, sentences, styles, fontSize, readerTheme, fontFamily, sentenceHighlightStyle, wordHighlightStyle]);

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
      onLayout={(e) => { scrollViewHeightRef.current = e.nativeEvent.layout.height; }}
      onContentSizeChange={(_, h) => { contentHeightRef.current = h; }}
    >
      {ttsMode && sentences ? renderTTSContent() : renderSearchContent()}
    </ScrollView>
  );
});

export const TxtViewer = React.memo(TxtViewerInner);

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
