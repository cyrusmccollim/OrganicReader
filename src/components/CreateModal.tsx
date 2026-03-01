import React, { useMemo } from 'react';
import { View, Modal, StyleSheet, Text, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import {
  Folder01Icon,
  CloudIcon,
  Edit02Icon,
  Link02Icon,
  CloudUploadIcon,
  Download01Icon,
} from 'hugeicons-react-native';

interface ImportOption {
  id: string;
  label: string;
  IconComponent: React.ComponentType<any>;
}

const importOptions: ImportOption[] = [
  { id: 'files',    label: 'Files',              IconComponent: Folder01Icon },
  { id: 'gdrive',   label: 'Google Drive',        IconComponent: CloudIcon },
  { id: 'text',     label: 'Type or paste text',  IconComponent: Edit02Icon },
  { id: 'link',     label: 'Paste a link',        IconComponent: Link02Icon },
  { id: 'onedrive', label: 'OneDrive',            IconComponent: CloudUploadIcon },
  { id: 'dropbox',  label: 'Dropbox',             IconComponent: Download01Icon },
];

export default function CreateModal({
  visible,
  onClose,
  onPickFiles,
}: {
  visible: boolean;
  onClose: () => void;
  onPickFiles?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handlePress = (id: string) => {
    onClose();
    if (id === 'files') {
      // Small delay so the modal dismiss animation finishes before the native picker opens
      setTimeout(() => onPickFiles?.(), 300);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add Document</Text>
          <FlatList
            data={importOptions}
            keyExtractor={i => i.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => handlePress(item.id)}>
                <View style={styles.iconBox}>
                  <item.IconComponent size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.rowLabel}>{item.label}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  const { colors, spacing, borderRadius } = theme;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingBottom: 32,
      paddingTop: spacing.md,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.darkBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
    sep: { height: 1, backgroundColor: colors.border },
  });
}
