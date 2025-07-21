import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { LibraryFile } from '../types';
import { useLibrary } from '../context/LibraryContext';
import { MoreVerticalIcon, Search01Icon } from 'hugeicons-react-native';

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
        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
        <View style={styles.fileMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{file.type}</Text>
          </View>
          <Text style={styles.fileDate}>{file.dateAdded}</Text>
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
          {isComplete ? 'Complete' : `${pct}%`}
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
  const { files } = useLibrary();
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');

  const filtered = files.filter(f => {
    const matchType = filter === 'All' || f.type === filter;
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
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
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterPill,
              filter === f && { backgroundColor: theme.colors.primary },
            ]}
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
          <Text style={styles.emptyText}>No documents found</Text>
        </View>
      ) : (
        <View style={styles.filesList}>
          {filtered.map((file, idx) => (
            <React.Fragment key={file.id}>
              <FileItem
                file={file}
                onOptions={() => {}}
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
    fileName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
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
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 50 + spacing.lg + spacing.md,
    },
    emptyState: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { color: colors.textSecondary, fontSize: 14 },
  });
}

export default LibraryScreen;
