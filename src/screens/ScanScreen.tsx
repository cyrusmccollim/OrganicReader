import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import MlKitTextRecognition from '@react-native-ml-kit/text-recognition';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { Cancel01Icon, Camera01Icon, FlashIcon } from 'hugeicons-react-native';

interface Props {
  onClose: () => void;
  onTextCaptured: (text: string) => void;
}

export function ScanScreen({ onClose, onTextCaptured }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [processing, setProcessing] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePhoto({
        flash: flash,
      });

      // Perform OCR on the captured image
      const result = await MlKitTextRecognition.recognize(`file://${photo.path}`);

      // Extract all text
      let fullText = '';
      for (const block of result.blocks) {
        fullText += block.text + '\n';
      }

      if (fullText.trim()) {
        onTextCaptured(fullText.trim());
      } else {
        Alert.alert('No Text Found', 'Could not detect any text in the image. Try again with better lighting or focus.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to capture or process image';
      Alert.alert('Error', message);
    } finally {
      setProcessing(false);
    }
  };

  const toggleFlash = () => {
    setFlash(flash === 'off' ? 'on' : 'off');
  };

  // Request permission if not granted
  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.darkBg }]}>
        <SafeAreaView style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Cancel01Icon size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Scan Document</Text>
            <View style={styles.closeBtn} />
          </View>
          <View style={styles.placeholder}>
            <View style={[styles.cameraIconBg, { backgroundColor: theme.colors.surface }]}>
              <Camera01Icon size={64} color={theme.colors.primary} />
            </View>
            <Text style={[styles.placeholderTitle, { color: theme.colors.textPrimary }]}>
              Camera Permission Required
            </Text>
            <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
              Please grant camera access to scan documents.
            </Text>
            <TouchableOpacity
              style={[styles.permissionBtn, { backgroundColor: theme.colors.primary }]}
              onPress={requestPermission}
            >
              <Text style={[styles.permissionBtnText, { color: theme.colors.darkBg }]}>
                Grant Permission
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // No camera device found
  if (!device) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.darkBg }]}>
        <SafeAreaView style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Cancel01Icon size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Scan Document</Text>
            <View style={styles.closeBtn} />
          </View>
          <View style={styles.placeholder}>
            <View style={[styles.cameraIconBg, { backgroundColor: theme.colors.surface }]}>
              <Camera01Icon size={64} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.placeholderTitle, { color: theme.colors.textPrimary }]}>
              No Camera Found
            </Text>
            <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
              This device does not have a camera available.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Cancel01Icon size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.title, { color: '#fff' }]}>Scan Document</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={toggleFlash}>
            <FlashIcon size={24} color={flash === 'on' ? '#FFD700' : '#fff'} />
          </TouchableOpacity>
        </View>

        <View style={styles.scanArea}>
          <View style={styles.scanFrame} />
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.captureBtn, processing && styles.captureBtnDisabled]}
            onPress={handleCapture}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            ) : (
              <View style={[styles.captureBtnInner, { borderColor: theme.colors.primary }]} />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(_theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    overlay: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    closeBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: 22,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
    },
    placeholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    cameraIconBg: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    placeholderTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 16,
      textAlign: 'center',
    },
    placeholderText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 16,
    },
    permissionBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    permissionBtnText: {
      fontSize: 16,
      fontWeight: '600',
    },
    scanArea: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanFrame: {
      width: 280,
      height: 400,
      borderWidth: 2,
      borderColor: '#fff',
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    bottomBar: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    captureBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureBtnDisabled: {
      opacity: 0.6,
    },
    captureBtnInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 4,
      backgroundColor: '#fff',
    },
  });
}