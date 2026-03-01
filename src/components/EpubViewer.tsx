import React, { useRef } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../ThemeContext';

const { resolveAssetSource } = Image;
const HTML_ASSET = resolveAssetSource(require('../assets/epubjs/viewer.html'));

interface Props {
  uri: string;
}

export function EpubViewer({ uri }: Props) {
  const { theme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const onLoad = () => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'load',
      uri,
      bgColor: theme.colors.darkBg,
      textColor: theme.colors.textPrimary,
    }));
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: HTML_ASSET.uri }}
        style={[styles.webview, { backgroundColor: theme.colors.darkBg }]}
        originWhitelist={['*']}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        mixedContentMode="always"
        onLoad={onLoad}
        scrollEnabled
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
});
