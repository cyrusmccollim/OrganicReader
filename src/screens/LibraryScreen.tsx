import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { LibraryFile } from '../types';
import { useLibrary } from '../context/LibraryContext';
import { formatLastOpened } from '../utils/formatDate';
import {
  MoreVerticalIcon,
  Search01Icon,
  Delete01Icon,
  Cancel01Icon,
  Bookmark01Icon,
} from 'hugeicons-react-native';

type Filter = 'All' | 'PDF' | 'DOCX' | 'TXT' | 'EPUB';
const FILTERS: Filter[] = ['All', 'PDF', 'DOCX', 'TXT', 'EPUB'];

function FileItem({
  file,
  onOptions,
  onOpen,
  styles,
  accentColor,
  iconColor,
}: {
  file: LibraryFile;
  onOptions: () => void;
  onOpen: () => void;
  styles: ReturnType<typeof makeStyles>;
  accentColor: string;
  iconColor: string;
}) {
  const pct = Math.round(file.progress * 100);
  const isComplete = file.progress >= 1;

  return (
    <TouchableOpacity style={styles.fileItem} activeOpacity={0.8} onPress={onOpen}>
      <View style={styles.fileThumbnail}>
        <Text style={styles.thumbnailEmoji}>{file.thumbnail}</Text>
      </View>
      <View style={styles.fileInfo}>
        <View style={styles.fileNameRow}>
          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          {file.bookmarks?.length > 0 && (
            <Bookmark01Icon size={14} color={accentColor} />
          )}
        </View>
        <View style={styles.fileMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{file.type}</Text>
          </View>
          <Text style={styles.fileDate}>
            {file.lastOpenedAt
              ? `Opened ${formatLastOpened(file.lastOpenedAt)}`
              : `Added ${file.dateAdded}`}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${pct}%` as any,
                backgroundColor: isComplete ? accentColor + 'aa' : accentColor,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {isComplete ? 'Complete' : pct > 0 ? `${pct}%` : 'Not started'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.optionsBtn}
        onPress={onOptions}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MoreVerticalIcon size={20} color={iconColor} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function LibraryScreen({ onOpenFile }: { onOpenFile?: (file: LibraryFile) => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { files, softDeleteFile } = useLibrary();
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<LibraryFile | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeOptions = () => { setShowOptions(false); setSelectedFile(null); };
  const { translateY: optionsTY, panResponder: optionsPR } = useSwipeToDismiss(closeOptions);

  // Show toast helper
  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  };

  const filtered = useMemo(
    () =>
      files.filter((f) => {
        const matchType = filter === 'All' || f.type === filter;
        const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
        return matchType && matchSearch;
      }),
    [files, filter, search]
  );

  const openOptions = (file: LibraryFile) => {
    setSelectedFile(file);
    setShowOptions(true);
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    const fileName = selectedFile.name;
    setShowOptions(false);
    await softDeleteFile(selectedFile);
    setSelectedFile(null);
    showToast(`"${fileName}" moved to Deleted Files`);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Library</Text>
          <Text style={styles.headerCount}>{filtered.length} documents</Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Search01Icon size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            selectionColor={theme.colors.primary}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Cancel01Icon size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, filter === f && { backgroundColor: theme.colors.primary }]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filter === f && { color: theme.colors.darkBg },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Files list */}
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {search || filter !== 'All' ? 'No matching documents' : 'No documents yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {!search && filter === 'All' ? 'Import a file from the Home screen.' : ''}
            </Text>
          </View>
        ) : (
          <View style={styles.filesList}>
            {filtered.map((file, idx) => (
              <React.Fragment key={file.id}>
                <FileItem
                  file={file}
                  onOptions={() => openOptions(file)}
                  onOpen={() => onOpenFile?.(file)}
                  styles={styles}
                  accentColor={theme.colors.primary}
                  iconColor={theme.colors.textSecondary}
                />
                {idx < filtered.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      {/* File Options Sheet */}
      <Modal visible={showOptions} transparent animationType="slide" onRequestClose={closeOptions}>
        <Pressable style={styles.modalOverlay} onPress={closeOptions}>
          <Animated.View
            style={[styles.modalSheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: optionsTY }] }]}
            {...optionsPR.panHandlers}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandleWrap}>
              <View style={[styles.modalHandle, { backgroundColor: theme.colors.border }]} />
            </View>
            {selectedFile && (
              <View style={styles.optionsFileHeader}>
                <Text style={styles.optionsFileEmoji}>{selectedFile.thumbnail}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionsFileName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={[styles.optionsFileMeta, { color: theme.colors.textSecondary }]}>
                    {selectedFile.type} · Added {selectedFile.dateAdded}
                  </Text>
                </View>
              </View>
            )}
            <View style={[styles.optionsSep, { backgroundColor: theme.colors.border }]} />
            <TouchableOpacity style={styles.optionRow} onPress={handleDelete}>
              <Delete01Icon size={20} color="#e05555" />
              <Text style={[styles.optionLabel, { color: '#e05555' }]}>Move to Deleted Files</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Toast */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.toastText, { color: theme.colors.textPrimary }]}>{toastMessage}</Text>
        </Animated.View>
      )}
    </>
  );
}

function makeStyles(theme: Theme) {
  const { colors, spacing, borderRadius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.darkBg },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: colors.primary },
    headerCount: { fontSize: 13, color: colors.textSecondary },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      gap: spacing.sm,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
    filterRow: { gap: spacing.sm, paddingBottom: spacing.md },
    filterPill: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    filesList: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    fileItem: {
      flexDirection: 'row',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    fileThumbnail: {
      width: 50,
      height: 50,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.darkerBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    thumbnailEmoji: { fontSize: 26 },
    fileInfo: { flex: 1, gap: 3 },
    fileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    fileName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
    fileMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    typeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.darkerBg,
    },
    typeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
    fileDate: { fontSize: 11, color: colors.textSecondary },
    progressTrack: {
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: 4,
    },
    progressFill: { height: 3, borderRadius: 2 },
    progressLabel: { fontSize: 10, color: colors.textSecondary },
    optionsBtn: { paddingLeft: spacing.sm },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 50 + spacing.lg + spacing.md,
    },
    emptyState: { paddingVertical: 48, alignItems: 'center', gap: 8 },
    emptyText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
    emptySubtext: { color: colors.textSecondary, fontSize: 13 },
    // Options sheet
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      paddingTop: 0,
    },
    modalHandleWrap: {
      paddingTop: 14, paddingBottom: 8,
      alignItems: 'center',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
    },
    optionsFileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    optionsFileEmoji: { fontSize: 32 },
    optionsFileName: { fontSize: 15, fontWeight: '700' },
    optionsFileMeta: { fontSize: 12, marginTop: 2 },
    optionsSep: { height: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 14,
    },
    optionLabel: { fontSize: 16, fontWeight: '500' },
    // Toast
    toast: {
      position: 'absolute',
      bottom: 100,
      left: '50%',
      transform: [{ translateX: -150 }],
      width: 300,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: borderRadius.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    toastText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  });
}

export default LibraryScreen;
