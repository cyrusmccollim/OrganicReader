import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { DeletedFile } from '../types';
import { useLibrary } from '../context/LibraryContext';
import {
  ArrowLeft01Icon,
  Delete01Icon,
  RotateLeft01Icon,
} from 'hugeicons-react-native';

interface Props {
  onBack: () => void;
}

export function DeletedFilesScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { deletedFiles, restoreFile, permanentDeleteFile, emptyTrash } = useLibrary();

  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const handleRestore = async (file: DeletedFile) => {
    await restoreFile(file);
  };

  const handlePermanentDelete = async (file: DeletedFile) => {
    await permanentDeleteFile(file);
  };

  const handleEmptyTrash = async () => {
    setShowEmptyConfirm(false);
    await emptyTrash();
  };

  const renderItem = ({ item }: { item: DeletedFile }) => (
    <View style={styles.fileItem}>
      <View style={styles.fileThumbnail}>
        <Text style={styles.thumbnailEmoji}>{item.thumbnail}</Text>
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.fileMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.type}</Text>
          </View>
          <Text style={styles.deletedDate}>Deleted {item.deletedAt}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: `${theme.colors.primary}18` }]}
          onPress={() => handleRestore(item)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <RotateLeft01Icon size={18} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#e0555518' }]}
          onPress={() => handlePermanentDelete(item)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Delete01Icon size={18} color="#e05555" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft01Icon size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Deleted Files</Text>
          {deletedFiles.length > 0 ? (
            <TouchableOpacity
              onPress={() => setShowEmptyConfirm(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.emptyTrashBtn}>Empty</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>

        {deletedFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Delete01Icon size={52} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Deleted Files</Text>
            <Text style={styles.emptySubtext}>
              Files you delete from your library will appear here for recovery.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.hintText}>
              Deleted files are kept until you permanently remove them or empty the trash.
            </Text>
            <FlatList
              data={deletedFiles}
              keyExtractor={(f) => f.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => (
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              )}
            />
          </>
        )}
      </View>

      {/* Empty Trash Confirmation */}
      <Modal visible={showEmptyConfirm} transparent animationType="fade" onRequestClose={() => setShowEmptyConfirm(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setShowEmptyConfirm(false)}>
          <View style={[styles.confirmBox, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#e0555518' }]}>
              <Delete01Icon size={28} color="#e05555" />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.colors.textPrimary }]}>
              Empty Trash?
            </Text>
            <Text style={[styles.confirmBody, { color: theme.colors.textSecondary }]}>
              All {deletedFiles.length} file{deletedFiles.length !== 1 ? 's' : ''} will be permanently deleted and cannot be recovered.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancel, { backgroundColor: theme.colors.darkerBg }]}
                onPress={() => setShowEmptyConfirm(false)}
              >
                <Text style={[styles.confirmCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={handleEmptyTrash}>
                <Text style={styles.confirmDeleteText}>Empty Trash</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(theme: Theme) {
  const { colors, spacing, borderRadius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.darkBg },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
    emptyTrashBtn: { fontSize: 14, fontWeight: '600', color: '#e05555' },
    hintText: {
      fontSize: 12,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    fileItem: {
      flexDirection: 'row',
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    fileThumbnail: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
      opacity: 0.7,
    },
    thumbnailEmoji: { fontSize: 24 },
    fileInfo: { flex: 1, gap: 4 },
    fileName: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    fileMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    typeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.surface,
    },
    typeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
    deletedDate: { fontSize: 11, color: colors.textSecondary },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 + spacing.md },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
      gap: spacing.md,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
    // Confirmation modal
    confirmOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    confirmBox: {
      borderRadius: 20,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 340,
    },
    confirmIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    confirmTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
    confirmBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
    confirmActions: { flexDirection: 'row', gap: spacing.sm },
    confirmCancel: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    confirmCancelText: { fontSize: 15, fontWeight: '600' },
    confirmDelete: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      backgroundColor: '#e05555',
    },
    confirmDeleteText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  });
}

export default DeletedFilesScreen;
