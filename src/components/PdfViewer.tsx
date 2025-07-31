import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Image, ActivityIndicator } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import RNFS from 'react-native-fs';
import { useTheme } from '../ThemeContext';
import { usePlayback } from '../context/PlaybackContext';
import { ViewerHandle } from '../types';

const { resolveAssetSource } = Image;
const HTML_ASSET = resolveAssetSource(require('../assets/pdf-viewer/viewer.html'));

interface Props {
  uri: string;
  onSearchResult?: (count: number, current: number) => void;
  onViewerMessage?: (msg: Record<string, any>) => void;
}

const injectCall = (type: string, payload: Record<string, any>) =>
  `handleMessage(${JSON.stringify({ type, ...payload })}); true;`;

export const PdfViewer = forwardRef<ViewerHandle, Props>(({ uri, onSearchResult, onViewerMessage }, ref) => {
  const { theme } = useTheme();
  const { appearance } = usePlayback();
  const webViewRef = useRef<WebView>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);

  useImperativeHandle(ref, () => ({
    search: (query) => webViewRef.current?.injectJavaScript(injectCall('search', { query })),
    searchNext: () => webViewRef.current?.injectJavaScript(injectCall('searchNext', {})),
    searchPrev: () => webViewRef.current?.injectJavaScript(injectCall('searchPrev', {})),
    clearSearch: () => webViewRef.current?.injectJavaScript(injectCall('clearSearch', {})),
  }), []);

  useEffect(() => {
    setBase64(null);
    setWebViewReady(false);
    const path = uri.replace(/^file:\/\//, '');
    RNFS.readFile(path, 'base64')
      .then(b64 => setBase64(b64))
      .catch(() => setBase64(''));
  }, [uri]);

  const sendPayload = useCallback((b64: string) => {
    webViewRef.current?.injectJavaScript(injectCall('load', { base64: b64, appearance }));
  }, [appearance]);

  const updateAppearance = useCallback(() => {
    webViewRef.current?.injectJavaScript(injectCall('updateAppearance', { appearance }));
  }, [appearance]);

  useEffect(() => {
    if (webViewReady && base64 !== null) sendPayload(base64);
  }, [webViewReady, base64, sendPayload]);

  useEffect(() => {
    if (webViewReady) updateAppearance();
  }, [appearance, webViewReady, updateAppearance]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'searchResult') {
        onSearchResult?.(msg.count, msg.current);
      } else if (msg.type === 'ready' || msg.type === 'paragraphChanged') {
        onViewerMessage?.(msg);
      }
    } catch {}
  }, [onSearchResult, onViewerMessage]);

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
        style={[styles.webview, { backgroundColor: 'transparent' }]}
        originWhitelist={['*']}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        mixedContentMode="always"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoad={() => setWebViewReady(true)}
        onMessage={handleMessage}
        scrollEnabled
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
});
