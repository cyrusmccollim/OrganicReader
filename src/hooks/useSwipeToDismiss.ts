import { useRef, useCallback } from 'react';
import { Animated, PanResponder } from 'react-native';

const DISMISS_THRESHOLD = 100;

export function useSwipeToDismiss(onDismiss: () => void) {
  const translateY = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  const dismissAnimated = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;

    Animated.timing(translateY, {
      toValue: 700,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
      // Reset after modal is hidden (next tick)
      setTimeout(() => {
        translateY.setValue(0);
        isDismissing.current = false;
      }, 50);
    });
  }, [onDismiss, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Let inner scroll views claim touch start
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only claim if dragging vertically (prioritize downward for dismiss)
        return Math.abs(gs.dy) > Math.abs(gs.dx) && Math.abs(gs.dy) > 3;
      },
      onPanResponderMove: (_, gs) => {
        // Only track downward movement (can't drag up beyond 0)
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        } else {
          translateY.setValue(0);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD) {
          dismissAnimated();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
      // Allow child components (ScrollView, etc.) to capture gestures first
      onPanResponderTerminationRequest: () => true,
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  return { translateY, panResponder, dismissAnimated };
}
