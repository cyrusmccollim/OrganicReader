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
  Pressable,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { LibraryFile, Bookmark, ViewerHandle } from '../types';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { DocumentViewer } from '../components/DocumentViewer';
import { TextEditModal } from '../components/TextEditModal';
import { useLibrary } from '../context/LibraryContext';
import { usePlayback, ReaderTheme, ReaderFont } from '../context/PlaybackContext';
import { useTextFileCreator } from '../hooks/useTextFileCreator';
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
} from 'hugeicons-react-native';

interface Props {
  file: LibraryFile;
  onBack: () => void;
  onBringToChat?: (file: LibraryFile) => void;
}

const VOICES = [
  { id: 'sarah',  label: 'Sarah',  subtitle: 'Natural · English (US)' },
  { id: 'james',  label: 'James',  subtitle: 'Natural · English (US)' },
  { id: 'emma',   label: 'Emma',   subtitle: 'Classic · English (UK)' },
  { id: 'marcus', label: 'Marcus', subtitle: 'Classic · English (US)' },
];

const FONTS: ReaderFont[] = ['System', 'Serif', 'Sans', 'Mono', 'Modern', 'Classic'];
const THEMES: { id: ReaderTheme; label: string; color: string; text: string }[] = [
  { id: 'light',   label: 'Light',   color: '#ffffff', text: '#1a1a1a' },
  { id: 'dark',    label: 'Dark',    color: '#121212', text: '#e0e0e0' },
  { id: 'sepia',   label: 'Sepia',   color: '#f4ecd8', text: '#5b4636' },
  { id: 'organic', label: 'Organic', color: '#0a1410', text: '#c8e6d0' },
];

const FONT_S_MIN = 12;
const FONT_S_MAX = 36;
const TOTAL_SECONDS = 9368;

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

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}


export function PlaybackScreen({ file, onBack, onBringToChat }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { files, addBookmark, removeBookmark, updateProgress, markOpened, updateFile } = useLibrary();
  const {
    appearance, updateAppearance,
    autoSkip, updateAutoSkip, playerSettings, updatePlayerSettings,
  } = usePlayback();
  const { createTextFile } = useTextFileCreator();

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(file.progress);

  // Edit mode
  const [showEdit, setShowEdit] = useState(false);
  const [editText, setEditText] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [viewerRefreshKey, setViewerRefreshKey] = useState(0);

  // Live file data from context (avoids stale prop snapshot for bookmarks)
  const liveFile = useMemo(
    () => files.find(f => f.id === file.id) ?? file,
    [files, file]
  );
  const bookmarks: Bookmark[] = liveFile.bookmarks ?? [];

  // Document position tracking (reported from WebView)
  const [docPage, setDocPage] = useState(1);
  const [docTotalPages, setDocTotalPages] = useState<number | null>(null);
  const [docParagraph, setDocParagraph] = useState(1);
  const [docTotalParagraphs, setDocTotalParagraphs] = useState<number | null>(null);

  // Inline search
  const documentRef = useRef<ViewerHandle>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ count: 0, current: 0 });
  const searchInputRef = useRef<TextInput>(null);

  // Progress bar scrub
  const progressTrackWidth = useRef(0);
  const scrubPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        if (progressTrackWidth.current > 0) {
          const newProgress = Math.max(0, Math.min(1, x / progressTrackWidth.current));
          setProgress(newProgress);
          updateProgress(file.id, newProgress);
        }
      },
      onPanResponderMove: () => {
        // superseded by scrubAwarePR which uses absolute pageX
      },
    })
  ).current;

  const trackLayoutRef = useRef({ x: 0, width: 0 });

  // Separate scrub PanResponder that uses absolute position
  const scrubAwarePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { pageX } = evt.nativeEvent;
        const w = trackLayoutRef.current.width;
        const x0 = trackLayoutRef.current.x;
        if (w > 0) {
          const p = Math.max(0, Math.min(1, (pageX - x0) / w));
          setProgress(p);
        }
      },
      onPanResponderMove: (evt) => {
        const { pageX } = evt.nativeEvent;
        const w = trackLayoutRef.current.width;
        const x0 = trackLayoutRef.current.x;
        if (w > 0) {
          const p = Math.max(0, Math.min(1, (pageX - x0) / w));
          setProgress(p);
        }
      },
      onPanResponderRelease: (evt) => {
        const { pageX } = evt.nativeEvent;
        const w = trackLayoutRef.current.width;
        const x0 = trackLayoutRef.current.x;
        if (w > 0) {
          const p = Math.max(0, Math.min(1, (pageX - x0) / w));
          setProgress(p);
          updateProgress(file.id, p);
        }
      },
    })
  ).current;

  void scrubPanResponder; // unused but kept for clarity

  useEffect(() => { markOpened(file.id); }, [file.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setProgress(file.progress); }, [file.progress]);

  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showAutoSkip, setShowAutoSkip] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarkFlash, setBookmarkFlash] = useState(false);
  const bookmarkFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (bookmarkFlashTimer.current) clearTimeout(bookmarkFlashTimer.current); }, []);

  const moreDismiss       = useSwipeToDismiss(() => setShowMore(false));
  const autoSkipDismiss   = useSwipeToDismiss(() => setShowAutoSkip(false));
  const bookmarksDismiss  = useSwipeToDismiss(() => setShowBookmarks(false));
  const voiceDismiss      = useSwipeToDismiss(() => setShowVoicePicker(false));
  const appearanceDismiss = useSwipeToDismiss(() => setShowAppearance(false));

  const currentSeconds = Math.round(progress * TOTAL_SECONDS);

  // Page indicator - real data from viewer
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

  // Bookmark current position - called from toolbar button directly
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
    setShowBookmarks(false);
  };

  const updateProgressThrottled = (newVal: number) => {
    setProgress(newVal);
    updateProgress(file.id, newVal);
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

  // Handle messages from all viewer WebViews (page numbers, paragraph counts)
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

  const toggleProps = {
    primaryColor: theme.colors.primary,
    borderColor: theme.colors.border,
    textColor: theme.colors.textPrimary,
    rowStyle: styles.toggleRow,
    labelStyle: styles.toggleLabel,
  };

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
        />
      </View>

      {/* ── TTS Panel ── */}
      {!playerSettings.autoHidePlayer && (
        <View style={[styles.ttsPanel, { backgroundColor: theme.colors.darkBg, borderTopColor: theme.colors.border }]}>
          {/* Scrubbable progress bar */}
          <View style={styles.progressRow}>
            <Text style={styles.timeText}>{formatTime(currentSeconds)}</Text>
            <View
              style={styles.progressTrackWrap}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                trackLayoutRef.current = { x, width };
                progressTrackWidth.current = width;
              }}
              {...scrubAwarePR.panHandlers}
            >
              <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: theme.colors.primary }]} />
              </View>
              {/* Thumb knob */}
              <View style={[styles.progressThumb, { left: `${progress * 100}%` as any, backgroundColor: theme.colors.primary }]} />
            </View>
            <Text style={styles.timeText}>{formatTime(TOTAL_SECONDS)}</Text>
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
              onPress={() => updateProgressThrottled(Math.max(0, progress - 10 / TOTAL_SECONDS))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <GoBackward10SecIcon size={36} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.playBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setIsPlaying(p => !p)} activeOpacity={0.85}>
              {isPlaying
                ? <PauseIcon size={28} color={theme.colors.darkBg} />
                : <PlayIcon size={28} color={theme.colors.darkBg} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn}
              onPress={() => updateProgressThrottled(Math.min(1, progress + 10 / TOTAL_SECONDS))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <GoForward10SecIcon size={36} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.speedBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              activeOpacity={0.8}>
              <Text style={[styles.speedText, { color: theme.colors.textPrimary }]}>{playerSettings.playbackSpeed}</Text>
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
                    // Load text content for editing
                    if (file.type === 'TXT' && file.uri) {
                      const RNFS = require('react-native-fs');
                      const path = file.uri.replace(/^file:\/\//, '');
                      const text = await RNFS.readFile(path, 'utf8');
                      setEditText(text);
                    } else {
                      // For PDF/DOCX/EPUB, we need to extract text
                      // The DocumentViewer already does this, but we'll do it again here
                      const { extractPdfText, extractDocxText, extractEpubText } = require('../utils/extractText');
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

      {/* ── Voice Picker Modal ── */}
      <Modal visible={showVoicePicker} transparent animationType="slide" onRequestClose={() => setShowVoicePicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowVoicePicker(false)}>
          <Animated.View style={[styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: voiceDismiss.translateY }] }]} {...voiceDismiss.panResponder.panHandlers}
            onStartShouldSetResponder={() => true}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Select AI Voice</Text>
            {VOICES.map(v => (
              <TouchableOpacity key={v.id}
                style={[styles.voiceOption, { backgroundColor: theme.colors.darkerBg }]}
                onPress={() => setShowVoicePicker(false)}>
                <View style={[styles.voiceAvatar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <VoiceIcon size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.voiceName, { color: theme.colors.textPrimary }]}>{v.label}</Text>
                  <Text style={[styles.voiceSub, { color: theme.colors.textSecondary }]}>{v.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
                    <Text style={[styles.fontPreview, { color: appearance.fontStyle === f ? theme.colors.primary : theme.colors.textPrimary }]}>Aa</Text>
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
            const RNFS = require('react-native-fs');
            const path = file.uri.replace(/^file:\/\//, '');
            await RNFS.writeFile(path, content, 'utf8');
            updateFile(file.id, { name: title });
          } else {
            await createTextFile(title, content);
          }
          setShowEdit(false);
          setEditText(null);
          setViewerRefreshKey(k => k + 1); // Refresh the viewer
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
    voiceAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
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
    handleWrap: {
      paddingTop: 14, paddingBottom: 8,
      alignItems: 'center',
    },
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
    emptyText: { fontSize: 14, fontWeight: '600' },

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
    voiceName: { fontSize: 15, fontWeight: '700' },
    voiceSub: { fontSize: 12 },
  });
}

export default PlaybackScreen;
