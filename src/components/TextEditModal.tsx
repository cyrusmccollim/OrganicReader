import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { CheckmarkSquare02Icon, Cancel01Icon } from 'hugeicons-react-native';

interface Props {
  visible: boolean;
  initialTitle?: string;
  initialContent: string;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
}

export function TextEditModal({ visible, initialTitle = '', initialContent, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setContent(initialContent);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (content.trim()) {
      onSave(title.trim() || 'Untitled', content);
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Cancel01Icon size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Edit</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={handleSave}>
            <CheckmarkSquare02Icon size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.titleRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TextInput
            style={[styles.titleInput, { color: theme.colors.textPrimary }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        <ScrollView style={[styles.editor, { backgroundColor: theme.colors.darkBg }]} contentContainerStyle={styles.editorContent}>
          <TextInput
            style={[styles.textInput, { color: theme.colors.textPrimary }]}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            placeholder="Start typing or paste your text here..."
            placeholderTextColor={theme.colors.textSecondary}
            autoFocus
          />
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.darkBg,
      zIndex: 100,
    },
    safeArea: {
      flex: 1,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    titleRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    titleInput: {
      fontSize: 18,
      fontWeight: '600',
      padding: 0,
    },
    editor: {
      flex: 1,
    },
    editorContent: {
      padding: 16,
    },
    textInput: {
      fontSize: 16,
      lineHeight: 24,
      minHeight: 400,
    },
  });
}
