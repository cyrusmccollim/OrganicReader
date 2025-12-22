import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  TextInput,
  PanResponder,
  Animated,
  Easing,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { LibraryFile, Bookmark, ViewerHandle } from '../types';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { DocumentViewer } from '../components/DocumentViewer';
import { TextEditModal } from '../components/TextEditModal';
import { useLibrary } from '../context/LibraryContext';
import { usePlayback, ReaderTheme, ReaderFont, FONT_FAMILIES } from '../context/PlaybackContext';
import { ALL_MODELS, getLanguageLabels, modelKey } from '../config/ttsModels';
import { useTTS } from '../context/TTSContext';
import { useTextFileCreator } from '../hooks/useTextFileCreator';
import { extractPdfText, extractDocxText, extractEpubText } from '../utils/extractText';
import {
  ArrowDown01Icon,
  Bookmark01Icon,
  TextFontIcon,
  More01Icon,
  PlayIcon,
  PauseIcon,
  GoBackward10SecIcon,
  GoForward10SecIcon,
  VoiceIcon,
  Search01Icon,
  Delete01Icon,
  Settings01Icon,
  Message02Icon,
  Cancel01Icon,
  ArrowUp01Icon,
  Edit02Icon,
  Tick01Icon,
} from 'hugeicons-react-native';

// ── Silhouette sprite avatar ──────────────────────────────────────────────────
// Sprite: 2400×808, 2 rows × 6 cols, alternating M/F (index 0=M,1=F,2=M…)
const SPRITE = require('../assets/set-grey-silhouette-avatars.png');
const SPRITE_COLS = 6;
const SPRITE_CELL_W = 400;
const SPRITE_CELL_H = 404;
const AVATAR_SIZE = 48;
const SCALE = AVATAR_SIZE / SPRITE_CELL_W;

const FEMALE_FIRSTS = new Set([
  'amanda','elise','priya','olivia','luna','mei','sophie','clara',
  'alba','jenny','cori','lada','olena','mirka','lili','anna','berta',
  'femke','lotte','gosia','irina','natia','linh','sita','paola','eva','kerstin',
]);

const MALE_FRAMES   = [0, 2, 4, 7, 9, 11];
const FEMALE_FRAMES = [1, 3, 5, 6, 8, 10];

function spriteIndexForVoice(voiceLabel: string): number {
  const first = voiceLabel.split(/[\s(]/)[0].toLowerCase();
  const isFemale = FEMALE_FIRSTS.has(first);
  let h = 0;
  for (let i = 0; i < voiceLabel.length; i++) h = (Math.imul(31, h) + voiceLabel.charCodeAt(i)) | 0;
  const pool = isFemale ? FEMALE_FRAMES : MALE_FRAMES;
  return pool[Math.abs(h) % pool.length];
}

function SilhouetteAvatar({ voiceLabel, borderColor }: { voiceLabel: string; borderColor: string }) {
  const frameIdx = spriteIndexForVoice(voiceLabel);
  const col = frameIdx % SPRITE_COLS;
  const row = Math.floor(frameIdx / SPRITE_COLS);
  const offsetX = -(col * SPRITE_CELL_W * SCALE);
  const offsetY = -(row * SPRITE_CELL_H * SCALE);
  return (
    <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 1, borderColor, overflow: 'hidden' }}>
      <Image
        source={SPRITE}
        style={{
          width: SPRITE_CELL_W * SCALE * SPRITE_COLS,
          height: SPRITE_CELL_H * SCALE * 2,
          position: 'absolute',
          left: offsetX,
          top: offsetY,
        }}
      />
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  file: LibraryFile;
  onBack: () => void;
  onBringToChat?: (file: LibraryFile) => void;
}

const FONTS: ReaderFont[] = ['System', 'Serif', 'Sans', 'Mono', 'Modern', 'Classic'];
const THEMES: { id: ReaderTheme; label: string; color: string; text: string }[] = [
  { id: 'light',   label: 'Light',   color: '#ffffff', text: '#1a1a1a' },
  { id: 'dark',    label: 'Dark',    color: '#121212', text: '#e0e0e0' },
  { id: 'sepia',   label: 'Sepia',   color: '#f4ecd8', text: '#5b4636' },
  { id: 'organic', label: 'Organic', color: '#0d1a0e', text: '#c4d8b4' },
];

const FONT_S_MIN = 12;
const FONT_S_MAX = 36;

const SPEED_MIN = 0.5;
const SPEED_MAX = 2.0;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Clamp and round to nearest 0.05 step
function snapSpeed(v: number, increment: number): number {
  const steps = Math.round((v - SPEED_MIN) / increment);
  const snapped = SPEED_MIN + steps * increment;
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(snapped * 100) / 100));
}

function SpeedSlider({
  value, onChange, primaryColor, borderColor, trackBg, textColor, labelColor,
}: {
  value: number;
  onChange: (v: number) => void;
  primaryColor: string;
  borderColor: string;
  trackBg: string;
  textColor: string;
  labelColor: string;
}) {
  const trackViewRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);

  const fillFraction = (value - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
  const fillPct = `${fillFraction * 100}%` as any;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        trackViewRef.current?.measure((_fx, _fy, w, _fh, pageX) => {
          trackPageXRef.current = pageX;
          trackWidthRef.current = w;
          const pos = clamp((evt.nativeEvent.pageX - pageX) / w, 0, 1);
          onChange(snapSpeed(SPEED_MIN + pos * (SPEED_MAX - SPEED_MIN), 0.1));
        });
      },
      onPanResponderMove: (evt) => {
        if (trackWidthRef.current > 0) {
          const pos = clamp((evt.nativeEvent.pageX - trackPageXRef.current) / trackWidthRef.current, 0, 1);
          onChange(snapSpeed(SPEED_MIN + pos * (SPEED_MAX - SPEED_MIN), 0.1));
        }
      },
    }),
  ).current;

  // Display: trim trailing zeros e.g. 1.00→"1", 1.50→"1.5", 0.75→"0.75"
  const displayValue = parseFloat(value.toFixed(2));

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <Text style={{ color: textColor, fontSize: 48, fontWeight: '900', textAlign: 'center', letterSpacing: -1, marginBottom: 8 }}>
        {displayValue}x
      </Text>

      {/* Slider row with - and + buttons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity
          onPress={() => onChange(snapSpeed(value - 0.05, 0.05))}
          disabled={value <= SPEED_MIN}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: trackBg, borderWidth: 1, borderColor,
            justifyContent: 'center', alignItems: 'center',
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: value <= SPEED_MIN ? labelColor : textColor, fontSize: 22, fontWeight: '800', lineHeight: 26 }}>−</Text>
        </TouchableOpacity>

        <View
          ref={trackViewRef}
          style={{ flex: 1, height: 48, justifyContent: 'center' }}
          {...panResponder.panHandlers}
        >
          <View style={{ height: 6, backgroundColor: trackBg, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 6, width: fillPct, backgroundColor: primaryColor, borderRadius: 3 }} />
          </View>
          {/* Thumb */}
          <View style={{
            position: 'absolute',
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: primaryColor,
            left: fillPct, marginLeft: -13, top: 11,
            shadowColor: primaryColor, shadowOpacity: 0.45, shadowRadius: 6,
            elevation: 4,
          }} />
        </View>

        <TouchableOpacity
          onPress={() => onChange(snapSpeed(value + 0.05, 0.05))}
          disabled={value >= SPEED_MAX}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: trackBg, borderWidth: 1, borderColor,
            justifyContent: 'center', alignItems: 'center',
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: value >= SPEED_MAX ? labelColor : textColor, fontSize: 22, fontWeight: '800', lineHeight: 26 }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Range labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 56 }}>
        <Text style={{ color: labelColor, fontSize: 11, fontWeight: '700' }}>{SPEED_MIN}x</Text>
        <Text style={{ color: labelColor, fontSize: 11, fontWeight: '700' }}>{SPEED_MAX}x</Text>
      </View>
    </View>
  );
}

function ArtifactToggle({
  label, value, onValueChange, primaryColor, borderColor, textColor, rowStyle, labelStyle,
}: {
  label: string; value: boolean; onValueChange: (v: boolean) => void;
  primaryColor: string; borderColor: string; textColor: string; rowStyle: any; labelStyle: any;
}) {
  return (
    <View style={rowStyle}>
      <Text style={[labelStyle, { color: textColor }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange}
        trackColor={{ true: primaryColor, false: borderColor }} thumbColor="#fff" />
    </View>
  );
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}


const LANGUAGE_LABELS = getLanguageLabels();

export function PlaybackScreen({ file, onBack, onBringToChat }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { files, addBookmark, removeBookmark, updateProgress, markOpened, updateFile } = useLibrary();
  const {
    appearance, updateAppearance,
    autoSkip, updateAutoSkip, playerSettings, updatePlayerSettings,
  } = usePlayback();
  const {
    ttsState, errorMessage, downloadProgress, downloadLanguage,
    sentences, activeSentenceIndex, activeSentenceTiming,
    // activeSentenceTiming used for progress bar animation only
    progressFraction, totalEstimatedMs, totalChars,
    downloadedModels, activeModelEntry,
    initTTS, play, pause, stop, seekToFraction, seekToSentence, jumpSeconds, setSpeed, setVoice, cancelDownload,
  } = useTTS();
  const { createTextFile } = useTextFileCreator();

  const [progress, setProgress] = useState(file.progress);

  // Edit mode
  const [showEdit, setShowEdit] = useState(false);
  const [editText, setEditText] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [viewerRefreshKey, setViewerRefreshKey] = useState(0);

  const liveFile = useMemo(
    () => files.find(f => f.id === file.id) ?? file,
    [files, file]
  );
  const bookmarks: Bookmark[] = liveFile.bookmarks ?? [];

  const [docPage, setDocPage] = useState(1);
  const [docTotalPages, setDocTotalPages] = useState<number | null>(null);
  const [docParagraph, setDocParagraph] = useState(1);
  const [docTotalParagraphs, setDocTotalParagraphs] = useState<number | null>(null);

  const documentRef = useRef<ViewerHandle>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ count: 0, current: 0 });
  const searchInputRef = useRef<TextInput>(null);

  const trackLayoutRef = useRef({ x: 0, width: 0 });

  const isPlaying = ttsState === 'playing';
  const isLoading = ttsState === 'loading' || ttsState === 'seeking';
  const isDownloading = ttsState === 'downloading';

  // Stop playback when navigating away
  useEffect(() => {
    return () => { stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync reading progress fraction (for library persistence)
  useEffect(() => {
    if (progressFraction > 0) setProgress(progressFraction);
  }, [progressFraction]);

  // Scrub bar drag — drives progressAnim directly (no React state = no re-renders during drag).
  const scrubAwarePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        sentAnimRef.current?.stop(); // pause smooth animation during manual drag
        const p = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - trackLayoutRef.current.x) / trackLayoutRef.current.width));
        progressAnim.setValue(p);
        setProgress(p);
      },
      onPanResponderMove: (evt) => {
        const p = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - trackLayoutRef.current.x) / trackLayoutRef.current.width));
        progressAnim.setValue(p);
        setProgress(p);
      },
      onPanResponderRelease: (evt) => {
        const p = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - trackLayoutRef.current.x) / trackLayoutRef.current.width));
        progressAnim.setValue(p);
        setProgress(p);
        updateProgress(file.id, p);
        seekToFraction(p);
      },
    })
  ).current;

  useEffect(() => { markOpened(file.id); }, [file.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showAutoSkip, setShowAutoSkip] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [selectedLangTab, setSelectedLangTab] = useState('All');
  const [bookmarkFlash, setBookmarkFlash] = useState(false);
  const bookmarkFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (bookmarkFlashTimer.current) clearTimeout(bookmarkFlashTimer.current); }, []);

  // Auto-select language tab when voice picker opens
  useEffect(() => {
    if (showVoicePicker) setSelectedLangTab(activeModelEntry?.label ?? 'All');
  }, [showVoicePicker, activeModelEntry?.label]);

  const moreDismiss       = useSwipeToDismiss(() => setShowMore(false));
  const autoSkipDismiss   = useSwipeToDismiss(() => setShowAutoSkip(false));
  const bookmarksDismiss  = useSwipeToDismiss(() => setShowBookmarks(false));
  const voiceDismiss      = useSwipeToDismiss(() => setShowVoicePicker(false));
  const speedDismiss      = useSwipeToDismiss(() => setShowSpeed(false));
  const appearanceDismiss = useSwipeToDismiss(() => setShowAppearance(false));

  // Animated progress bar — driven per-sentence, animates smoothly over sentence duration.
  // Lives outside React state so it never causes PlaybackScreen re-renders on its own.
  const progressAnim = useRef(new Animated.Value(file.progress)).current;
  const sentAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Jump bar to sentence start, then animate linearly to sentence end over its duration.
  useEffect(() => {
    if (!ttsActive || !activeSentenceTiming || totalChars === 0 || sentences.length === 0) return;
    const si = activeSentenceIndex;
    const startFrac = (sentences[si]?.charStart ?? 0) / totalChars;
    const endFrac   = si + 1 < sentences.length
      ? sentences[si + 1].charStart / totalChars
      : (sentences[si]?.charEnd ?? totalChars) / totalChars;
    sentAnimRef.current?.stop();
    progressAnim.setValue(startFrac);
    sentAnimRef.current = Animated.timing(progressAnim, {
      toValue: endFrac,
      duration: activeSentenceTiming.durationMs,
      useNativeDriver: false,
      easing: Easing.linear,
    });
    sentAnimRef.current.start();
  }, [activeSentenceIndex, activeSentenceTiming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause / resume the animation in lock-step with playback state.
  useEffect(() => {
    if (ttsState === 'paused' || ttsState === 'seeking') {
      sentAnimRef.current?.stop();
    } else if (ttsState === 'playing' && sentAnimRef.current) {
      sentAnimRef.current.start();
    }
  }, [ttsState]);

  // Total and elapsed display time (updates at most once per second — no jank).
  const totalMs = totalEstimatedMs;
  const [displayedMs, setDisplayedMs] = useState(0);
  useEffect(() => {
    if (ttsState !== 'playing') return;
    const timer = setInterval(() => {
      const id = progressAnim.addListener(({ value }) => {
        setDisplayedMs(value * totalMs);
        progressAnim.removeListener(id);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ttsState, totalMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentMs = displayedMs;

  const pageLabel = useMemo(() => {
    if (file.type === 'DOCX') {
      if (docTotalParagraphs !== null) return `Paragraph ${docParagraph} of ${docTotalParagraphs}`;
      return null;
    }
    if (file.type === 'EPUB') {
      if (docTotalPages !== null) return `Chapter ${docPage} of ${docTotalPages}`;
      return null;
    }
    if (docTotalPages !== null) return `Page ${docPage} of ${docTotalPages}`;
    return null;
  }, [file.type, docPage, docTotalPages, docParagraph, docTotalParagraphs]);

  const handleBookmarkPress = useCallback(() => {
    let label: string;
    if (file.type === 'DOCX' && docTotalParagraphs !== null) {
      label = `Para ${docParagraph} of ${docTotalParagraphs}`;
    } else if (file.type === 'EPUB' && docTotalPages !== null) {
      label = `Chapter ${docPage} of ${docTotalPages}`;
    } else if (docTotalPages !== null) {
      label = `Page ${docPage} of ${docTotalPages}`;
    } else {
      label = `${Math.round(progress * 100)}%`;
    }
    addBookmark(file.id, { label, progress, page: docTotalPages !== null ? docPage : undefined });
    setBookmarkFlash(true);
    if (bookmarkFlashTimer.current) clearTimeout(bookmarkFlashTimer.current);
    bookmarkFlashTimer.current = setTimeout(() => setBookmarkFlash(false), 1200);
  }, [addBookmark, file.id, file.type, docPage, docTotalPages, docParagraph, docTotalParagraphs, progress]);

  const jumpToBookmark = (b: Bookmark) => {
    setProgress(b.progress);
    updateProgress(file.id, b.progress);
    seekToFraction(b.progress);
    setShowBookmarks(false);
  };

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.trim()) {
      documentRef.current?.search(q);
    } else {
      documentRef.current?.clearSearch();
      setSearchResults({ count: 0, current: 0 });
    }
  }, []);

  const openSearch = () => {
    setShowMore(false);
    setSearchVisible(true);
    setSearchQuery('');
    setSearchResults({ count: 0, current: 0 });
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery('');
    setSearchResults({ count: 0, current: 0 });
    documentRef.current?.clearSearch();
  }, []);

  const handleSearchResult = useCallback((count: number, current: number) => {
    setSearchResults({ count, current });
  }, []);

  const handleViewerMessage = useCallback((msg: Record<string, any>) => {
    if (msg.type === 'ready') {
      if (msg.pages) { setDocTotalPages(msg.pages); setDocPage(1); }
      if (msg.totalChapters) { setDocTotalPages(msg.totalChapters); setDocPage(1); }
      if (msg.totalParagraphs) { setDocTotalParagraphs(msg.totalParagraphs); setDocParagraph(1); }
    } else if (msg.type === 'pageChanged') {
      setDocPage(msg.page);
      if (msg.totalPages) setDocTotalPages(msg.totalPages);
    } else if (msg.type === 'paragraphChanged') {
      setDocParagraph(msg.paragraph);
      if (msg.totalParagraphs) setDocTotalParagraphs(msg.totalParagraphs);
    }
  }, []);

  const handleTextExtracted = useCallback((text: string) => {
    initTTS(text);
  }, [initTTS]);

  // On first play after opening, resume from saved position instead of sentence 0.
  const hasResumedRef = useRef(false);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else if (!hasResumedRef.current && file.progress > 0 && ttsState === 'ready') {
      hasResumedRef.current = true;
      seekToFraction(file.progress);
    } else {
      await play();
    }
  }, [isPlaying, play, pause, ttsState, seekToFraction, file.progress]);

  const handleSpeedChange = useCallback(async (speed: number) => {
    updatePlayerSettings({ playbackSpeed: speed });
    await setSpeed(speed);
  }, [updatePlayerSettings, setSpeed]);

  const toggleProps = {
    primaryColor: theme.colors.primary,
    borderColor: theme.colors.border,
    textColor: theme.colors.textPrimary,
    rowStyle: styles.toggleRow,
    labelStyle: styles.toggleLabel,
  };

  const ttsActive = ttsState !== 'idle' && ttsState !== 'error' && sentences.length > 0;

  // Filtered voices for voice catalog
  const filteredVoices = useMemo(() => {
    const q = voiceSearch.toLowerCase();
    return ALL_MODELS.filter(m => {
      const langMatch = selectedLangTab === 'All' || m.label === selectedLangTab;
      if (!langMatch) return false;
      if (!q) return true;
      return (
        m.voiceLabel.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.langCode.toLowerCase().includes(q)
      );
    });
  }, [voiceSearch, selectedLangTab]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.darkBg }]}>

      {/* ── Top Toolbar ── */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowDown01Icon size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.toolbarRight}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={handleBookmarkPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Bookmark01Icon size={22} color={bookmarkFlash ? theme.colors.primary : (bookmarks.length > 0 ? theme.colors.primary : theme.colors.textPrimary)} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowAppearance(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <TextFontIcon size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowMore(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <More01Icon size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Inline Search Bar ── */}
      {searchVisible && (
        <View style={[styles.inlineSearch, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={[styles.inlineSearchInput, { backgroundColor: theme.colors.darkerBg, borderColor: theme.colors.border }]}>
            <Search01Icon size={16} color={theme.colors.textSecondary} />
            <TextInput
              ref={searchInputRef}
              style={[styles.inlineSearchText, { color: theme.colors.textPrimary }]}
              placeholder="Search in document…"
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              selectionColor={theme.colors.primary}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Cancel01Icon size={14} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.trim().length > 0 && (
            <Text style={[styles.inlineSearchCount, { color: theme.colors.textSecondary }]}>
              {searchResults.count === 0 ? 'No results' : `${searchResults.current} / ${searchResults.count}`}
            </Text>
          )}
          <TouchableOpacity style={styles.inlineNavBtn}
            onPress={() => documentRef.current?.searchPrev()}
            disabled={searchResults.count === 0}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <ArrowUp01Icon size={18} color={searchResults.count > 0 ? theme.colors.textPrimary : theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlineNavBtn}
            onPress={() => documentRef.current?.searchNext()}
            disabled={searchResults.count === 0}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <ArrowDown01Icon size={18} color={searchResults.count > 0 ? theme.colors.textPrimary : theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlineCloseBtn} onPress={closeSearch}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[styles.inlineCloseTxt, { color: theme.colors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Document ── */}
      <View style={styles.docContainer}>
        <DocumentViewer
          ref={documentRef}
          file={liveFile}
          refreshKey={viewerRefreshKey}
          onSearchResult={handleSearchResult}
          onViewerMessage={handleViewerMessage}
          onTextExtracted={handleTextExtracted}
          ttsMode={ttsActive && !searchVisible}
          ttsSentences={sentences}
          ttsActiveSentenceIndex={activeSentenceIndex}
          onSentenceTap={seekToSentence}
          initialProgress={file.progress}
          onScrollProgress={(frac) => { if (!ttsActive) updateProgress(file.id, frac); }}
        />
      </View>

      {/* ── Download Overlay ── */}
      {isDownloading && (
        <View style={[styles.downloadOverlay, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.downloadText, { color: '#fff' }]}>
            Downloading {downloadLanguage} voice model…
          </Text>
          <View style={[styles.downloadBar, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.downloadFill, { width: `${downloadProgress * 100}%` as any, backgroundColor: theme.colors.primary }]} />
          </View>
          <Text style={[styles.downloadPct, { color: theme.colors.textSecondary }]}>
            {Math.round(downloadProgress * 100)}%
          </Text>
          <TouchableOpacity
            onPress={cancelDownload}
            style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Error Overlay ── */}
      {ttsState === 'error' && errorMessage && (
        <View style={[styles.downloadOverlay, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
          <Text style={{ color: '#ff6b6b', fontSize: 28, marginBottom: 8 }}>!</Text>
          <Text style={[styles.downloadText, { color: '#fff' }]}>{errorMessage}</Text>
          <TouchableOpacity
            onPress={stop}
            style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TTS Panel ── */}
      {!playerSettings.autoHidePlayer && (
        <View style={[styles.ttsPanel, { backgroundColor: theme.colors.darkBg, borderTopColor: theme.colors.border }]}>
          {/* Scrubbable progress bar */}
          <View style={styles.progressRow}>
            <Text style={styles.timeText}>{formatTime(currentMs)}</Text>
            <View
              style={styles.progressTrackWrap}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                trackLayoutRef.current = { x, width };
              }}
              {...scrubAwarePR.panHandlers}
            >
              <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                <Animated.View style={[styles.progressFill, {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: theme.colors.primary,
                }]} />
              </View>
              <Animated.View style={[styles.progressThumb, {
                left: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: theme.colors.primary,
              }]} />
            </View>
            <Text style={styles.timeText}>{formatTime(totalMs)}</Text>
          </View>

          {pageLabel && (
            <Text style={styles.pageIndicator}>{pageLabel}</Text>
          )}

          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.voiceAvatarBtn} onPress={() => setShowVoicePicker(true)} activeOpacity={0.8}>
              <View style={[styles.voiceAvatar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <VoiceIcon size={20} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn}
              onPress={() => jumpSeconds(-10)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <GoBackward10SecIcon size={36} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.playBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handlePlayPause} activeOpacity={0.85}>
              {isLoading
                ? <ActivityIndicator size="small" color={theme.colors.darkBg} />
                : isPlaying
                ? <PauseIcon size={28} color={theme.colors.darkBg} />
                : <PlayIcon size={28} color={theme.colors.darkBg} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn}
              onPress={() => jumpSeconds(10)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <GoForward10SecIcon size={36} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.speedBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => setShowSpeed(true)}
              activeOpacity={0.8}>
              <Text style={[styles.speedText, { color: theme.colors.textPrimary }]}>
                {playerSettings.playbackSpeed}x
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── More Modal ── */}
      <Modal visible={showMore} transparent animationType="slide" onRequestClose={() => setShowMore(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowMore(false)}>
          <Animated.View
            style={[styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: moreDismiss.translateY }] }]}
            {...moreDismiss.panResponder.panHandlers}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Options</Text>
            <View style={styles.actionList}>
              <TouchableOpacity style={[styles.actionRow, { backgroundColor: theme.colors.darkerBg }]} onPress={openSearch}>
                <Search01Icon size={20} color={theme.colors.textPrimary} />
                <Text style={[styles.actionText, { color: theme.colors.textPrimary }]}>Search in Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionRow, { backgroundColor: theme.colors.darkerBg }]}
                onPress={() => { setShowMore(false); setShowBookmarks(true); }}>
                <Bookmark01Icon size={20} color={theme.colors.textPrimary} />
                <Text style={[styles.actionText, { color: theme.colors.textPrimary }]}>Bookmarks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionRow, { backgroundColor: theme.colors.darkerBg }]}
                onPress={() => { setShowMore(false); setShowAutoSkip(true); }}>
                <Settings01Icon size={20} color={theme.colors.textPrimary} />
                <Text style={[styles.actionText, { color: theme.colors.textPrimary }]}>Auto-Skip Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionRow, { backgroundColor: theme.colors.darkerBg }]}
                onPress={async () => {
                  setShowMore(false);
                  setEditLoading(true);
                  try {
                    if (file.type === 'TXT' && file.uri) {
                      const path = file.uri.replace(/^file:\/\//, '');
                      const text = await RNFS.readFile(path, 'utf8');
                      setEditText(text);
                    } else {
                      const extractors: Record<string, (uri: string) => Promise<string>> = {
                        PDF: extractPdfText,
                        DOCX: extractDocxText,
                        EPUB: extractEpubText,
                      };
                      const fn = extractors[file.type];
                      if (fn && file.uri) {
                        const text = await fn(file.uri);
                        setEditText(text);
                      } else {
                        setEditText('');
                      }
                    }
                    setShowEdit(true);
                  } catch (e) {
                    console.error('Failed to load text for editing:', e);
                    setEditText('');
                    setShowEdit(true);
                  } finally {
                    setEditLoading(false);
                  }
                }}>
                <Edit02Icon size={20} color={theme.colors.textPrimary} />
                <Text style={[styles.actionText, { color: theme.colors.textPrimary }]}>
                  {editLoading ? 'Loading...' : 'Edit'}
                </Text>
              </TouchableOpacity>
              {onBringToChat && (
                <TouchableOpacity style={[styles.actionRow, { backgroundColor: theme.colors.darkerBg }]}
                  onPress={() => { setShowMore(false); onBringToChat(liveFile); }}>
                  <Message02Icon size={20} color={theme.colors.textPrimary} />
                  <Text style={[styles.actionText, { color: theme.colors.textPrimary }]}>Bring to Chat</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: 20 }]}>PLAYER</Text>
            <View style={styles.settingsCard}>
              <ArtifactToggle {...toggleProps} label="Auto-hide controls during playback"
                value={playerSettings.autoHidePlayer}
                onValueChange={(v) => updatePlayerSettings({ autoHidePlayer: v })} />
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Auto-Skip Modal ── */}
      <Modal visible={showAutoSkip} transparent animationType="slide" onRequestClose={() => setShowAutoSkip(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowAutoSkip(false)}>
          <Animated.View style={[styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: autoSkipDismiss.translateY }] }]} {...autoSkipDismiss.panResponder.panHandlers}
            onStartShouldSetResponder={() => true}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Auto-Skip Settings</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>SKIP ARTIFACTS</Text>
              <View style={styles.settingsCard}>
                <ArtifactToggle {...toggleProps} label="Headers & Footers" value={autoSkip.headers} onValueChange={(v) => updateAutoSkip({ headers: v, footers: v })} />
                <ArtifactToggle {...toggleProps} label="Inline Citations [1], (Author...)" value={autoSkip.citations} onValueChange={(v) => updateAutoSkip({ citations: v })} />
                <ArtifactToggle {...toggleProps} label="Parentheses (...)" value={autoSkip.parentheses} onValueChange={(v) => updateAutoSkip({ parentheses: v })} />
                <ArtifactToggle {...toggleProps} label="Brackets [...]" value={autoSkip.brackets} onValueChange={(v) => updateAutoSkip({ brackets: v })} />
                <ArtifactToggle {...toggleProps} label="Curly Braces {...}" value={autoSkip.braces} onValueChange={(v) => updateAutoSkip({ braces: v })} />
                <ArtifactToggle {...toggleProps} label="Web Links & URLs" value={autoSkip.urls} onValueChange={(v) => updateAutoSkip({ urls: v })} />
              </View>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>PLAYER BEHAVIOR</Text>
              <View style={styles.settingsCard}>
                <ArtifactToggle {...toggleProps} label="Auto-scroll to active text" value={playerSettings.autoScroll} onValueChange={(v) => updatePlayerSettings({ autoScroll: v })} />
              </View>
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Bookmarks Modal ── */}
      <Modal visible={showBookmarks} transparent animationType="slide" onRequestClose={() => setShowBookmarks(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowBookmarks(false)}>
          <Animated.View style={[styles.sheet, styles.tallSheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: bookmarksDismiss.translateY }] }]} {...bookmarksDismiss.panResponder.panHandlers}
            onStartShouldSetResponder={() => true}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Bookmarks</Text>
            <Text style={[styles.bookmarkHint, { color: theme.colors.textSecondary }]}>
              Tap the bookmark icon in the toolbar to save your current position.
            </Text>
            {bookmarks.length === 0 ? (
              <View style={styles.emptyState}>
                <Bookmark01Icon size={40} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No bookmarks yet</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                {bookmarks.map(b => (
                  <View key={b.id} style={[styles.bookmarkRow, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => jumpToBookmark(b)}>
                      <Text style={[styles.bookmarkLabel, { color: theme.colors.textPrimary }]}>{b.label}</Text>
                      <Text style={[styles.bookmarkDate, { color: theme.colors.textSecondary }]}>
                        {new Date(b.createdAt).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeBookmark(file.id, b.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Delete01Icon size={18} color="#e05555" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Voice Catalog Modal ── */}
      <Modal visible={showVoicePicker} transparent animationType="slide" onRequestClose={() => { setShowVoicePicker(false); setVoiceSearch(''); }}>
        <Pressable style={styles.overlay} onPress={() => { setShowVoicePicker(false); setVoiceSearch(''); }}>
          <Animated.View
            style={[styles.sheet, styles.hugeSheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: voiceDismiss.translateY }] }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle responds to swipe-to-dismiss; content scrolls freely */}
            <View style={styles.handleWrap} {...voiceDismiss.panResponder.panHandlers}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Voices</Text>

            {/* Search bar */}
            <View style={[styles.voiceSearchWrap, { backgroundColor: theme.colors.darkerBg, borderColor: theme.colors.border }]}>
              <Search01Icon size={15} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.voiceSearchInput, { color: theme.colors.textPrimary }]}
                placeholder="Search by name, language, or region…"
                placeholderTextColor={theme.colors.textSecondary}
                value={voiceSearch}
                onChangeText={setVoiceSearch}
                autoCorrect={false}
                selectionColor={theme.colors.primary}
              />
              {voiceSearch.length > 0 && (
                <TouchableOpacity onPress={() => setVoiceSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Cancel01Icon size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Language tab bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.langTabBar}
              contentContainerStyle={styles.langTabBarContent}
            >
              {['All', ...LANGUAGE_LABELS].map(lang => {
                const isActive = selectedLangTab === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => setSelectedLangTab(lang)}
                    style={[
                      styles.langTab,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.darkerBg },
                      isActive && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '22' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.langTabText,
                      { color: theme.colors.textSecondary },
                      isActive && { color: theme.colors.primary, fontWeight: '700' },
                    ]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Voice list */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {filteredVoices.length === 0 ? (
                <View style={styles.emptyState}>
                  <VoiceIcon size={36} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No voices found</Text>
                </View>
              ) : (
                <View style={[styles.settingsCard, { marginBottom: 24 }]}>
                  {filteredVoices.map((m, idx) => {
                    const key = modelKey(m);
                    const activeKey = activeModelEntry ? modelKey(activeModelEntry) : '';
                    const isSelected = key === activeKey;
                    const isDownloaded = downloadedModels.some(d => d.voiceDirName === m.voiceDirName);
                    const voiceName = m.voiceLabel.replace(/\s*\([^)]+\)/g, '').trim();
                    const isLast = idx === filteredVoices.length - 1;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.voiceCatalogRow,
                          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                          isSelected && { backgroundColor: theme.colors.primary + '18' },
                        ]}
                        onPress={() => { setVoice(m); setShowVoicePicker(false); setVoiceSearch(''); }}
                        activeOpacity={0.7}
                      >
                        <SilhouetteAvatar
                          voiceLabel={m.voiceLabel}
                          borderColor={isSelected ? theme.colors.primary : isDownloaded ? theme.colors.primary + '60' : theme.colors.border}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[
                              styles.voiceName,
                              { color: isSelected ? theme.colors.primary : theme.colors.textPrimary },
                              isSelected && { fontWeight: '800' },
                            ]}>
                              {voiceName}
                            </Text>
                          </View>
                          <Text style={[styles.voiceSub, { color: theme.colors.textSecondary }]}>
                            {selectedLangTab === 'All' ? `${m.label} · ` : ''}
                            {m.langCode.toUpperCase()}
                            {isDownloaded && !isSelected && (
                              <Text style={{ color: theme.colors.primary + 'AA' }}> · Downloaded</Text>
                            )}
                            {isSelected && (
                              <Text style={{ color: theme.colors.primary }}> · Playing</Text>
                            )}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Tick01Icon size={18} color={theme.colors.primary} />
                        ) : isDownloaded ? (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary + '80' }} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Speed Modal ── */}
      <Modal visible={showSpeed} transparent animationType="slide" onRequestClose={() => setShowSpeed(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSpeed(false)}>
          <Animated.View
            style={[styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: speedDismiss.translateY }] }]}
            {...speedDismiss.panResponder.panHandlers}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Playback Speed</Text>
            <SpeedSlider
              value={playerSettings.playbackSpeed}
              onChange={handleSpeedChange}
              primaryColor={theme.colors.primary}
              borderColor={theme.colors.border}
              trackBg={theme.colors.darkerBg}
              textColor={theme.colors.textPrimary}
              labelColor={theme.colors.textSecondary}
            />
            <View style={{ height: 16 }} />
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Appearance Modal ── */}
      <Modal visible={showAppearance} transparent animationType="slide" onRequestClose={() => setShowAppearance(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowAppearance(false)}>
          <Animated.View style={[styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: appearanceDismiss.translateY }] }]} {...appearanceDismiss.panResponder.panHandlers}
            onStartShouldSetResponder={() => true}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Appearance</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>THEME</Text>
              <View style={styles.themeGrid}>
                {THEMES.map(t => (
                  <TouchableOpacity key={t.id}
                    style={[styles.themeItem, { backgroundColor: t.color },
                      appearance.theme === t.id && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                    onPress={() => updateAppearance({ theme: t.id })}>
                    <Text style={[styles.themeLabel, { color: t.text }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>TEXT SIZE</Text>
              <View style={styles.sizeControl}>
                <TouchableOpacity style={styles.sizeBtn}
                  onPress={() => updateAppearance({ fontSize: Math.max(FONT_S_MIN, appearance.fontSize - 2) })}>
                  <TextFontIcon size={16} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <View style={[styles.sizeFillTrack, { backgroundColor: theme.colors.border }]}>
                  <View style={[styles.sizeFill, {
                    width: `${((appearance.fontSize - FONT_S_MIN) / (FONT_S_MAX - FONT_S_MIN)) * 100}%` as any,
                    backgroundColor: theme.colors.primary,
                  }]} />
                </View>
                <TouchableOpacity style={styles.sizeBtn}
                  onPress={() => updateAppearance({ fontSize: Math.min(FONT_S_MAX, appearance.fontSize + 2) })}>
                  <TextFontIcon size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>TYPOGRAPHY</Text>
              <View style={styles.fontGrid}>
                {FONTS.map(f => (
                  <TouchableOpacity key={f}
                    style={[styles.fontCard, { backgroundColor: theme.colors.darkerBg },
                      appearance.fontStyle === f && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '11' }]}
                    onPress={() => updateAppearance({ fontStyle: f })}>
                    <Text style={[styles.fontPreview, { color: appearance.fontStyle === f ? theme.colors.primary : theme.colors.textPrimary, fontFamily: FONT_FAMILIES[f] }]}>Aa</Text>
                    <Text style={[styles.fontLabel, { color: theme.colors.textSecondary }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Edit Modal ── */}
      <TextEditModal
        visible={showEdit}
        initialTitle={file.name}
        initialContent={editText || ''}
        onClose={() => {
          setShowEdit(false);
          setEditText(null);
        }}
        onSave={async (title, content) => {
          if (file.uri) {
            const path = file.uri.replace(/^file:\/\//, '');
            await RNFS.writeFile(path, content, 'utf8');
            updateFile(file.id, { name: title });
          } else {
            await createTextFile(title, content);
          }
          setShowEdit(false);
          setEditText(null);
          setViewerRefreshKey(k => k + 1);
        }}
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  const { spacing } = theme;
  return StyleSheet.create({
    container: { flex: 1 },
    toolbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    toolbarBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },

    inlineSearch: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth, gap: 6,
    },
    inlineSearchInput: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 6,
    },
    inlineSearchText: { flex: 1, fontSize: 15, padding: 0 },
    inlineSearchCount: { fontSize: 12, fontWeight: '600', minWidth: 42, textAlign: 'center' },
    inlineNavBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    inlineCloseBtn: { paddingHorizontal: 4, height: 32, justifyContent: 'center' },
    inlineCloseTxt: { fontSize: 14, fontWeight: '700' },

    docContainer: { flex: 1 },

    downloadOverlay: {
      position: 'absolute', left: 0, right: 0, bottom: 0, top: 0,
      justifyContent: 'center', alignItems: 'center', gap: 16,
      zIndex: 100,
    },
    downloadText: { fontSize: 15, fontWeight: '600' },
    downloadBar: { width: 240, height: 6, borderRadius: 3, overflow: 'hidden' },
    downloadFill: { height: 6, borderRadius: 3 },
    downloadPct: { fontSize: 13, fontWeight: '700' },

    ttsPanel: {
      paddingTop: 10, paddingBottom: 32, paddingHorizontal: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth, gap: 4,
    },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    progressTrackWrap: { flex: 1, height: 24, justifyContent: 'center' },
    progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2 },
    progressThumb: {
      position: 'absolute',
      width: 14, height: 14, borderRadius: 7,
      marginLeft: -7, top: 5,
    },
    timeText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, minWidth: 44 },
    pageIndicator: { textAlign: 'center', fontSize: 12, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 8 },
    controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    voiceAvatarBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
    voiceAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    skipBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
    playBtn: {
      width: 68, height: 68, borderRadius: 34,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
    },
    speedBtn: { width: 52, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    speedText: { fontSize: 13, fontWeight: '800' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 0, paddingBottom: 40 },
    tallSheet: { maxHeight: '75%' },
    hugeSheet: { maxHeight: '92%' },
    handleWrap: { paddingTop: 14, paddingBottom: 8, alignItems: 'center' },
    handle: { width: 40, height: 4, borderRadius: 2 },
    sheetTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
    sectionLabel: {
      fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
      textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
    },

    actionList: { gap: 10 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14 },
    actionText: { fontSize: 15, fontWeight: '600' },

    settingsCard: { backgroundColor: theme.colors.darkerBg, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    toggleLabel: { fontSize: 14, fontWeight: '600', flex: 1, paddingRight: 12 },

    bookmarkHint: { fontSize: 12, fontWeight: '500', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
    bookmarkRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    bookmarkLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    bookmarkDate: { fontSize: 11 },
    emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

    themeGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    themeItem: {
      flex: 1, height: 56, borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center', alignItems: 'center',
    },
    themeLabel: { fontSize: 13, fontWeight: '700' },
    sizeControl: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
    sizeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.darkerBg, justifyContent: 'center', alignItems: 'center' },
    sizeFillTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    sizeFill: { height: 6, borderRadius: 3 },
    fontGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    fontCard: { width: '31%', aspectRatio: 1, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
    fontPreview: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
    fontLabel: { fontSize: 11, fontWeight: '700' },

    voiceOption: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, marginBottom: 8 },
    voiceCatalogRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    voiceName: { fontSize: 15, fontWeight: '700' },
    voiceSub: { fontSize: 12 },
    voiceSearchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
      marginBottom: 8,
    },
    voiceSearchInput: { flex: 1, fontSize: 14, padding: 0 },
    langTabBar: { flexGrow: 0, flexShrink: 0, minHeight: 42, marginBottom: 4 },
    langTabBarContent: { gap: 8, paddingVertical: 4, paddingHorizontal: 2, alignItems: 'center' as const },
    langTab: {
      flexShrink: 0,
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1,
    },
    langTabText: { fontSize: 13, fontWeight: '600' },
  });
}

export default PlaybackScreen;
