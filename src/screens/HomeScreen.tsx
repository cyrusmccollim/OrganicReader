import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { LibraryFile } from '../types';
import { useLibrary } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';
import { useDocumentPicker } from '../hooks/useDocumentPicker';
import { formatLastOpened } from '../utils/formatDate';
import { getUserInitials, calculateReadingTime, calculateStreak } from '../utils/readingStats';
import {
  Folder01Icon,
  KeyboardIcon,
  Camera01Icon,
  Image01Icon,
  Link02Icon,
  GridIcon,
  FireIcon,
  Clock01Icon,
  BookOpen01Icon,
} from 'hugeicons-react-native';

interface ImportOption {
  id: string;
  label: string;
  IconComponent: React.ComponentType<any>;
}

const importOptions: ImportOption[] = [
  { id: 'files',  label: 'Files',  IconComponent: Folder01Icon },
  { id: 'text',   label: 'Type',   IconComponent: KeyboardIcon },
  { id: 'scan',   label: 'Scan',   IconComponent: Camera01Icon },
  { id: 'photos', label: 'Photos', IconComponent: Image01Icon },
  { id: 'link',   label: 'Link',   IconComponent: Link02Icon },
  { id: 'more',   label: 'More',   IconComponent: GridIcon },
];

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props {
  onOpenFile?: (file: LibraryFile) => void;
  onSelectOption?: (id: string) => void;
  onNavigateToProfile?: () => void;
}

export function HomeScreen({ onOpenFile, onSelectOption, onNavigateToProfile }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { files } = useLibrary();
  const { user } = useAuth();
  const { pickDocument } = useDocumentPicker();

  const weekActivity = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    return WEEK_LABELS.map((label, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayStr = day.toDateString();
      const active = files.some(f => f.lastOpenedAt && new Date(f.lastOpenedAt).toDateString() === dayStr);
      return { label, active };
    });
  }, [files]);

  const continueReading = useMemo(() => {
    if (files.length === 0) return null;
    return [...files].sort((a, b) => {
      const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
      return dateB - dateA;
    })[0];
  }, [files]);

  const handleImport = async (id: string) => {
    if (id === 'files') {
      const file = await pickDocument();
      if (file && onOpenFile) {
        onOpenFile(file);
      }
    } else {
      onSelectOption?.(id);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.appName}>{user?.name?.split(' ')[0] || 'Reader'}</Text>
        </View>
        <TouchableOpacity style={styles.avatarBubble} onPress={onNavigateToProfile} activeOpacity={0.8}>
          <Text style={styles.avatarInitials}>{getUserInitials(user?.name)}</Text>
        </TouchableOpacity>
      </View>

      {/* Streak + Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.streakCard, { borderLeftColor: theme.colors.primary }]}>
          <View style={styles.streakTop}>
            <FireIcon size={20} color={theme.colors.primary} />
            <Text style={styles.streakCount}>{calculateStreak(files)}</Text>
          </View>
          <Text style={styles.streakLabel}>Day Streak</Text>
          <View style={styles.streakDays}>
            {weekActivity.map(({ label, active }, i) => (
              <View
                key={i}
                style={[
                  styles.streakDot,
                  { backgroundColor: active ? theme.colors.primary : theme.colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.streakDayLabel,
                    { color: active ? theme.colors.darkBg : theme.colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsCol}>
          <View style={[styles.statMini, { borderLeftColor: theme.colors.primary }]}>
            <Clock01Icon size={16} color={theme.colors.primary} />
            <Text style={styles.statMiniValue}>{calculateReadingTime(files)}</Text>
            <Text style={styles.statMiniLabel}>This week</Text>
          </View>
          <View style={[styles.statMini, { borderLeftColor: theme.colors.primaryLight }]}>
            <BookOpen01Icon size={16} color={theme.colors.primaryLight} />
            <Text style={styles.statMiniValue}>{files.length}</Text>
            <Text style={styles.statMiniLabel}>Documents</Text>
          </View>
        </View>
      </View>

      {/* Continue Reading */}
      {continueReading && (
        <>
          <Text style={styles.sectionTitle}>Continue Reading</Text>
          <TouchableOpacity
            style={styles.continueCard}
            activeOpacity={0.85}
            onPress={() => onOpenFile?.(continueReading)}
          >
            <View style={styles.continueThumbnail}>
              <Text style={styles.continueEmoji}>{continueReading.thumbnail}</Text>
            </View>
            <View style={styles.continueInfo}>
              <Text style={styles.continueTitle} numberOfLines={1}>{continueReading.name}</Text>
              <Text style={styles.continueAuthor}>
                {continueReading.type}
                {continueReading.bookmarks?.length > 0 && ` · ${continueReading.bookmarks.slice(-1)[0].label}`}
              </Text>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.round(continueReading.progress * 100)}%` as any,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.continueProgress}>
                  {Math.round(continueReading.progress * 100)}% complete
                </Text>
                <Text style={styles.lastReadTime}>{formatLastOpened(continueReading.lastOpenedAt)}</Text>
              </View>
            </View>
            <View style={[styles.continueBtn, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.continueBtnText, { color: theme.colors.darkBg }]}>Read</Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Import */}
      <Text style={styles.sectionTitle}>Import</Text>
      <View style={styles.importGrid}>
        {importOptions.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={styles.importBtn}
            activeOpacity={0.75}
            onPress={() => handleImport(opt.id)}
          >
            <View style={[styles.importIconBg, { backgroundColor: theme.colors.darkerBg }]}>
              <opt.IconComponent size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.importLabel}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    greeting: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
    appName: { fontSize: 24, fontWeight: '800', color: colors.primary },
    avatarBubble: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitials: { fontSize: 14, fontWeight: '700', color: colors.primary },
    statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
    streakCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderLeftWidth: 3,
      gap: 4,
    },
    streakTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    streakCount: { fontSize: 22, fontWeight: '800', color: colors.primary },
    streakLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
    streakDays: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    streakDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
    },
    streakDayLabel: { fontSize: 8, fontWeight: '700' },
    statsCol: { gap: spacing.md, justifyContent: 'space-between' },
    statMini: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderLeftWidth: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    statMiniValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    statMiniLabel: { fontSize: 10, color: colors.textSecondary },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
    },
    continueCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.xxl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    continueThumbnail: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.darkerBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    continueEmoji: { fontSize: 28 },
    continueInfo: { flex: 1, gap: 3 },
    continueTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    continueAuthor: { fontSize: 12, color: colors.textSecondary },
    progressBarTrack: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 4,
      overflow: 'hidden',
    },
    progressBarFill: { height: 4, borderRadius: 2 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    continueProgress: { fontSize: 11, color: colors.textSecondary },
    lastReadTime: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
    continueBtn: {
      borderRadius: borderRadius.sm,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    continueBtnText: { fontSize: 13, fontWeight: '700' },
    importGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    importBtn: {
      flexBasis: '30%',
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    importIconBg: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    importLabel: {
      fontSize: 11,
      color: colors.textPrimary,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
}
