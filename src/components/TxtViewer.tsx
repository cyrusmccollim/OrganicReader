import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';

interface Props {
  uri: string;
}

export function TxtViewer({ uri }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = uri.replace(/^file:\/\//, '');
    RNFS.readFile(path, 'utf8')
      .then(text => setContent(text))
      .catch(e => setError('Could not read file: ' + e.message));
  }, [uri]);

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.darkBg }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (content === null) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.darkBg }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.darkBg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.text}>{content}</Text>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 24, paddingBottom: 48 },
    text: {
      fontSize: 16,
      lineHeight: 27,
      color: theme.colors.textPrimary,
      fontFamily: 'Georgia',
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center', padding: 20 },
  });
}
