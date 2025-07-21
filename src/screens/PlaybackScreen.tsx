import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { LibraryFile } from '../types';
import { DocumentViewer } from '../components/DocumentViewer';
import {
  ArrowDown01Icon,
  Bookmark01Icon,
  TextFontIcon,
  ListViewIcon,
  More01Icon,
  PlayIcon,
  PauseIcon,
  GoBackward10SecIcon,
  GoForward10SecIcon,
  VoiceIcon,
  CheckmarkCircle01Icon,
} from 'hugeicons-react-native';

interface Props {
  file: LibraryFile;
  onBack: () => void;
}

const SPEEDS = ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'];
const VOICES = [
  { id: 'sarah',  label: 'Sarah',  subtitle: 'Natural · English (US)' },
  { id: 'james',  label: 'James',  subtitle: 'Natural · English (US)' },
  { id: 'emma',   label: 'Emma',   subtitle: 'Classic · English (UK)' },
  { id: 'marcus', label: 'Marcus', subtitle: 'Classic · English (US)' },
];

const TOTAL_SECONDS = 9368; // 2:36:08 — matches reference screenshot aesthetic

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function PlaybackScreen({ file, onBack }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(file.progress);
  const [speed, setSpeed] = useState('1x');
  const [activeVoiceId, setActiveVoiceId] = useState('sarah');
  const [bookmarked, setBookmarked] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  const currentSeconds = Math.round(progress * TOTAL_SECONDS);
  const activeVoice = VOICES.find(v => v.id === activeVoiceId)!;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.darkBg }]}>

      {/* ── Top toolbar ── */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowDown01Icon size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.toolbarRight}>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => setBookmarked(b => !b)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Bookmark01Icon
              size={22}
              color={bookmarked ? theme.colors.primary : theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <TextFontIcon size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ListViewIcon size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <More01Icon size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Document viewer — fills all remaining space ── */}
      <View style={styles.docContainer}>
        <DocumentViewer file={file} />
      </View>

      {/* ── Bottom TTS controls panel ── */}
      <View style={[styles.ttsPanel, { backgroundColor: theme.colors.darkBg, borderTopColor: theme.colors.border }]}>

        {/* Progress bar + times */}
        <View style={styles.progressRow}>
          <Text style={styles.timeText}>{formatTime(currentSeconds)}</Text>
          <View style={styles.progressTrackWrap}>
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%` as any, backgroundColor: theme.colors.textSecondary },
                ]}
              />
            </View>
          </View>
          <Text style={styles.timeText}>{formatTime(TOTAL_SECONDS)}</Text>
        </View>

        {/* Page indicator (center) */}
        <Text style={styles.pageIndicator}>
          {`${Math.max(1, Math.round(progress * 85))} of 85`}
        </Text>

        {/* Control row: Voice avatar | Back10 | Play | Fwd10 | Speed */}
        <View style={styles.controlsRow}>
          {/* Voice avatar — left */}
          <TouchableOpacity
            style={styles.voiceAvatarBtn}
            onPress={() => setShowVoicePicker(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.voiceAvatar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <VoiceIcon size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Back 10s */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setProgress(p => Math.max(0, p - 10 / TOTAL_SECONDS))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <GoBackward10SecIcon size={36} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          {/* Play / Pause */}
          <TouchableOpacity
            style={[styles.playBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => setIsPlaying(p => !p)}
            activeOpacity={0.85}
          >
            {isPlaying
              ? <PauseIcon size={28} color={theme.colors.darkBg} />
              : <PlayIcon size={28} color={theme.colors.darkBg} />
            }
          </TouchableOpacity>

          {/* Forward 10s */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setProgress(p => Math.min(1, p + 10 / TOTAL_SECONDS))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <GoForward10SecIcon size={36} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          {/* Speed — right */}
          <TouchableOpacity
            style={[styles.speedBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => setShowSpeedPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.speedText, { color: theme.colors.textPrimary }]}>{speed}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Speed Picker Modal ── */}
      <Modal visible={showSpeedPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSpeedPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Playback Speed</Text>
            {SPEEDS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.modalOption, { borderBottomColor: theme.colors.border }]}
                onPress={() => { setSpeed(s); setShowSpeedPicker(false); }}
              >
                <Text style={[styles.modalOptionText, { color: speed === s ? theme.colors.primary : theme.colors.textPrimary }, speed === s && styles.modalOptionActive]}>
                  {s}
                </Text>
                {speed === s && <CheckmarkCircle01Icon size={20} color={theme.colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Voice Picker Modal ── */}
      <Modal visible={showVoicePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowVoicePicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Select Voice</Text>
            {VOICES.map(v => {
              const isActive = v.id === activeVoiceId;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.voiceOption,
                    {
                      backgroundColor: isActive ? theme.colors.surfaceHigh : theme.colors.surface,
                      borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => { setActiveVoiceId(v.id); setShowVoicePicker(false); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.voiceOptionAvatar, {
                    backgroundColor: isActive ? theme.colors.primary + '22' : theme.colors.darkerBg,
                  }]}>
                    <VoiceIcon size={20} color={isActive ? theme.colors.primary : theme.colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.voiceOptionName, { color: isActive ? theme.colors.primary : theme.colors.textPrimary }]}>
                      {v.label}
                    </Text>
                    <Text style={[styles.voiceOptionSub, { color: theme.colors.textSecondary }]}>
                      {v.subtitle}
                    </Text>
                  </View>
                  {isActive && <CheckmarkCircle01Icon size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(theme: Theme) {
  const { spacing } = theme;
  return StyleSheet.create({
    container: { flex: 1 },

    // Top toolbar
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    toolbarBtn: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toolbarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },

    // Document area
    docContainer: { flex: 1 },

    // Bottom TTS panel
    ttsPanel: {
      paddingTop: 10,
      paddingBottom: 16,
      paddingHorizontal: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 4,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressTrackWrap: { flex: 1 },
    progressTrack: {
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: { height: 3, borderRadius: 2 },
    timeText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary, minWidth: 44 },
    pageIndicator: {
      textAlign: 'center',
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
      marginBottom: 4,
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    voiceAvatarBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
    voiceAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
    playBtn: {
      width: 68,
      height: 68,
      borderRadius: 34,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },
    speedBtn: {
      width: 52,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    speedText: { fontSize: 13, fontWeight: '700' },

    // Modals
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 16,
      textAlign: 'center',
    },
    modalOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
    },
    modalOptionText: { fontSize: 16 },
    modalOptionActive: { fontWeight: '600' },
    voiceOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
    },
    voiceOptionAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    voiceOptionName: { fontSize: 15, fontWeight: '600' },
    voiceOptionSub: { fontSize: 11, marginTop: 2 },
  });
}

export default PlaybackScreen;
