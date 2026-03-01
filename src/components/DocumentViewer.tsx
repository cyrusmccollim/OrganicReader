import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LibraryFile } from '../types';
import { PdfViewer } from './PdfViewer';
import { DocxViewer } from './DocxViewer';
import { TxtViewer } from './TxtViewer';
import { EpubViewer } from './EpubViewer';
import { useTheme } from '../ThemeContext';

interface Props {
  file: LibraryFile;
}

export function DocumentViewer({ file }: Props) {
  const { theme } = useTheme();

  if (!file.uri) {
    // Mock file — no real URI; show a placeholder matching the Speechify aesthetic
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
    case 'PDF':  return <PdfViewer uri={file.uri} />;
    case 'DOCX': return <DocxViewer uri={file.uri} />;
    case 'TXT':  return <TxtViewer uri={file.uri} />;
    case 'EPUB': return <EpubViewer uri={file.uri} />;
    default:     return <TxtViewer uri={file.uri} />;
  }
}

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
