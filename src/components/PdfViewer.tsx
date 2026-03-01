import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';
import { useTheme } from '../ThemeContext';

const { resolveAssetSource } = Image;
const HTML_ASSET = resolveAssetSource(require('../assets/pdfjs/viewer.html'));

interface Props {
  uri: string;
}

export function PdfViewer({ uri }: Props) {
  const { theme } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);

  useEffect(() => {
    setBase64(null);
    setWebViewReady(false);
    const path = uri.replace(/^file:\/\//, '');
    RNFS.readFile(path, 'base64')
      .then(b64 => setBase64(b64))
      .catch(e => console.error('PdfViewer: failed to read file', e));
  }, [uri]);

  const sendPayload = useCallback((b64: string) => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'load',
      base64: b64,
      bgColor: theme.colors.darkBg,
      textColor: theme.colors.textPrimary,
    }));
  }, [theme.colors.darkBg, theme.colors.textPrimary]);

  useEffect(() => {
    if (webViewReady && base64 !== null) {
      sendPayload(base64);
    }
  }, [webViewReady, base64, sendPayload]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.darkBg }]}>
      {(!webViewReady || base64 === null) && (
        <ActivityIndicator
          style={StyleSheet.absoluteFill}
          color={theme.colors.primary}
          size="large"
        />
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: HTML_ASSET.uri }}
        style={[styles.webview, { backgroundColor: theme.colors.darkBg }]}
        originWhitelist={['*']}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        mixedContentMode="always"
        onLoad={() => setWebViewReady(true)}
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
