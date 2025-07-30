import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LibraryFile, ViewerHandle } from '../types';
import { PdfViewer } from './PdfViewer';
import { DocxViewer } from './DocxViewer';
import { TxtViewer } from './TxtViewer';
import { EpubViewer } from './EpubViewer';
import { useTheme } from '../ThemeContext';

interface Props {
  file: LibraryFile;
  onSearchResult?: (count: number, current: number) => void;
  onViewerMessage?: (msg: Record<string, any>) => void;
}

export const DocumentViewer = forwardRef<ViewerHandle, Props>(({ file, onSearchResult, onViewerMessage }, ref) => {
  const { theme } = useTheme();

  if (!file.uri) {
    // Mock file - no real URI
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.placeholderEmoji]}>{file.thumbnail}</Text>
        <Text style={[styles.placeholderTitle, { color: theme.colors.textPrimary }]}>
          {file.name}
        </Text>
        <Text style={[styles.placeholderSub, { color: theme.colors.textSecondary }]}>
          Import this file to read it
        </Text>
      </View>
    );
  }

  switch (file.type) {
    case 'PDF':  return <PdfViewer ref={ref} uri={file.uri} onSearchResult={onSearchResult} onViewerMessage={onViewerMessage} />;
    case 'DOCX': return <DocxViewer ref={ref} uri={file.uri} onSearchResult={onSearchResult} onViewerMessage={onViewerMessage} />;
    case 'TXT':  return <TxtViewer ref={ref} uri={file.uri} onSearchResult={onSearchResult} onViewerMessage={onViewerMessage} />;
    case 'EPUB': return <EpubViewer ref={ref} uri={file.uri} onSearchResult={onSearchResult} onViewerMessage={onViewerMessage} />;
    default:     return <TxtViewer ref={ref} uri={file.uri} onSearchResult={onSearchResult} onViewerMessage={onViewerMessage} />;
  }
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
