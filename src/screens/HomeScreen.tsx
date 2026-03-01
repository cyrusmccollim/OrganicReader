import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { LibraryFile } from '../types';
import { useLibrary } from '../context/LibraryContext';
import { useDocumentPicker } from '../hooks/useDocumentPicker';
import {
  Folder01Icon,
  CloudIcon,
  Edit02Icon,
  Link02Icon,
  CloudUploadIcon,
  Download01Icon,
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
  { id: 'files',    label: 'Files',        IconComponent: Folder01Icon },
  { id: 'gdrive',   label: 'Google Drive', IconComponent: CloudIcon },
  { id: 'text',     label: 'Type / Scan',  IconComponent: Edit02Icon },
  { id: 'link',     label: 'Link',         IconComponent: Link02Icon },
  { id: 'onedrive', label: 'OneDrive',     IconComponent: CloudUploadIcon },
  { id: 'dropbox',  label: 'Dropbox',      IconComponent: Download01Icon },
];

const STREAK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STREAK_ACTIVE = [true, true, true, true, true, true, false];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props {
  onOpenFile?: (file: LibraryFile) => void;
}

export function HomeScreen({ onOpenFile }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { files } = useLibrary();
  const { pickDocument } = useDocumentPicker();

  const continueReading = files.find(f => f.progress > 0 && f.progress < 1) ?? files[0];

  const handleImport = async (id: string) => {
    if (id === 'files') {
      const file = await pickDocument();
      if (file && onOpenFile) {
        onOpenFile(file);
      }
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
          <Text style={styles.appName}>OrganicReader</Text>
        </View>
        <View style={styles.avatarBubble}>
          <Text style={styles.avatarInitials}>EX</Text>
        </View>
      </View>

      {/* Streak + Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.streakCard, { borderLeftColor: theme.colors.primary }]}>
          <View style={styles.streakTop}>
            <FireIcon size={20} color={theme.colors.primary} />
            <Text style={styles.streakCount}>6</Text>
          </View>
          <Text style={styles.streakLabel}>Day Streak</Text>
          <View style={styles.streakDays}>
            {STREAK_DAYS.map((day, i) => (
              <View
                key={i}
                style={[
                  styles.streakDot,
                  STREAK_ACTIVE[i]
                    ? { backgroundColor: theme.colors.primary }
                    : { backgroundColor: theme.colors.border },
                ]}
              >
                <Text style={[
                  styles.streakDayLabel,
                  { color: STREAK_ACTIVE[i] ? theme.colors.darkBg : theme.colors.textSecondary },
                ]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsCol}>
          <View style={[styles.statMini, { borderLeftColor: theme.colors.primary }]}>
            <Clock01Icon size={16} color={theme.colors.primary} />
            <Text style={styles.statMiniValue}>12.5h</Text>
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
            onPress={() => continueReading && onOpenFile?.(continueReading)}
          >
            <View style={styles.continueThumbnail}>
              <Text style={styles.continueEmoji}>{continueReading.thumbnail}</Text>
            </View>
            <View style={styles.continueInfo}>
              <Text style={styles.continueTitle} numberOfLines={1}>{continueReading.name}</Text>
              <Text style={styles.continueAuthor}>{continueReading.type}</Text>
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
              <Text style={styles.continueProgress}>
                {Math.round(continueReading.progress * 100)}% complete
              </Text>
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
        {importOptions.map(opt => (
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
    continueProgress: { fontSize: 11, color: colors.textSecondary },
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
