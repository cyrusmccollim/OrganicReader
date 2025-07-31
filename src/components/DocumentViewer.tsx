import React, { forwardRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LibraryFile, ViewerHandle } from '../types';
import { TxtViewer } from './TxtViewer';
import { useTheme } from '../ThemeContext';
import { extractPdfText, extractDocxText, extractEpubText } from '../utils/extractText';

interface Props {
  file: LibraryFile;
  onSearchResult?: (count: number, current: number) => void;
  onViewerMessage?: (msg: Record<string, any>) => void;
}

export const DocumentViewer = forwardRef<ViewerHandle, Props>(({ file, onSearchResult, onViewerMessage }, ref) => {
  const { theme } = useTheme();
  const [extractedText, setExtractedText] = useState<string | undefined>(undefined);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    if (!file.uri || file.type === 'TXT') return;
    setExtracting(true);
    setExtractedText(undefined);
    setExtractError(null);

    const extractors: Record<string, (uri: string) => Promise<string>> = {
      PDF: extractPdfText,
      DOCX: extractDocxText,
      EPUB: extractEpubText,
    };
    const fn = extractors[file.type];
    if (!fn) { setExtracting(false); return; }

    fn(file.uri)
      .then(text => { setExtractedText(text); setExtracting(false); })
      .catch(e => { setExtractError(String(e)); setExtracting(false); });
  }, [file.uri, file.type]);

  if (!file.uri) {
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.colors.surface }]}>
        <Text style={styles.placeholderEmoji}>{file.thumbnail}</Text>
        <Text style={[styles.placeholderTitle, { color: theme.colors.textPrimary }]}>{file.name}</Text>
        <Text style={[styles.placeholderSub, { color: theme.colors.textSecondary }]}>Import this file to read it</Text>
      </View>
    );
  }

  if (file.type === 'TXT') {
    return <TxtViewer ref={ref} uri={file.uri} onSearchResult={onSearchResult} onViewerMessage={onViewerMessage} />;
  }

  if (extractError) {
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.placeholderSub, { color: '#e05555' }]}>{extractError}</Text>
      </View>
    );
  }

  if (extracting || extractedText === undefined) {
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return <TxtViewer ref={ref} text={extractedText} onSearchResult={onSearchResult} onViewerMessage={onViewerMessage} />;
});

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  placeholderEmoji: { fontSize: 56 },
  placeholderTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', paddingHorizontal: 32 },
  placeholderSub: { fontSize: 13, textAlign: 'center' },
});
