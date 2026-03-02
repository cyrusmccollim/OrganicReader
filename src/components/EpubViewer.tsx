import React, { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { ViewerHandle } from '../types';

interface Props {
  uri: string;
  onSearchResult?: (count: number, current: number) => void;
  onViewerMessage?: (msg: Record<string, any>) => void;
}

export const EpubViewer = forwardRef<ViewerHandle, Props>(
  (_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      search:      () => {},
      searchNext:  () => {},
      searchPrev:  () => {},
      clearSearch: () => {},
    }));

    const { theme } = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.darkBg }]}>
        <Text style={styles.title}>EPUB Viewer</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    );
  },
);

function makeStyles(theme: Theme) {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  });
}
