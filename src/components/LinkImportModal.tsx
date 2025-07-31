import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { CheckmarkSquare02Icon, Cancel01Icon, Link02Icon } from 'hugeicons-react-native';
import { extractWebContent } from '../services/WebExtractor';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
}

export function LinkImportModal({ visible, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setPreviewContent('');
    setPreviewTitle('');

    try {
      const result = await extractWebContent(url.trim());
      setPreviewTitle(result.title);
      setPreviewContent(result.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (previewContent.trim()) {
      onSave(previewTitle || 'Web Article', previewContent);
      handleClose();
    }
  };

  const handleClose = () => {
    setUrl('');
    setPreviewContent('');
    setPreviewTitle('');
    setError(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleClose}>
            <Cancel01Icon size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Import from Link</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={handleSave} disabled={!previewContent.trim()}>
            <CheckmarkSquare02Icon size={24} color={previewContent.trim() ? theme.colors.primary : theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.inputRow, { backgroundColor: theme.colors.surface }]}>
          <Link02Icon size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.urlInput, { color: theme.colors.textPrimary }]}
            value={url}
            onChangeText={setUrl}
            placeholder="Paste a URL..."
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleFetch}
          />
          <TouchableOpacity
            style={[styles.fetchBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleFetch}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.darkBg} />
            ) : (
              <Text style={[styles.fetchBtnText, { color: theme.colors.darkBg }]}>Fetch</Text>
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.errorRow, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView style={[styles.preview, { backgroundColor: theme.colors.darkBg }]} contentContainerStyle={styles.previewContent}>
          {previewTitle ? (
            <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]}>{previewTitle}</Text>
          ) : null}
          {previewContent ? (
            <Text style={[styles.previewText, { color: theme.colors.textSecondary }]}>{previewContent.slice(0, 2000)}{previewContent.length > 2000 ? '...' : ''}</Text>
          ) : (
            <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
              Enter a URL above and tap Fetch to extract the article content.
            </Text>
          )}
        </ScrollView>
      </View>
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
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    urlInput: {
      flex: 1,
      fontSize: 15,
      padding: 0,
    },
    fetchBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    fetchBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    errorRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    errorText: {
      color: '#e05555',
      fontSize: 13,
    },
    preview: {
      flex: 1,
    },
    previewContent: {
      padding: 16,
    },
    previewTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 16,
    },
    previewText: {
      fontSize: 15,
      lineHeight: 24,
    },
    placeholderText: {
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'center',
      marginTop: 40,
    },
  });
}
