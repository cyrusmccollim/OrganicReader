import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import TrackPlayer, { Event, State, useProgress, useTrackPlayerEvents } from 'react-native-track-player';
import { ensureModel, deleteModel, isDownloadedAsync, listAll } from '../services/tts/ModelRegistry';
import { detectLanguage } from '../services/tts/LanguageDetector';
import { segmentText, Sentence } from '../services/tts/TextSegmenter';
import { SentenceTiming } from '../services/tts/TimingAccumulator';
import { TTSBuffer, BufferSegment } from '../services/tts/TTSBuffer';
import { cleanTmpDir } from '../services/tts/TTSEngine';
import { setupTrackPlayer } from '../services/tts/trackPlayerSetup';
import { usePlayback } from './PlaybackContext';
import { PiperModelEntry } from '../config/ttsModels';

export type TTSState =
  | 'idle'
  | 'downloading'
  | 'initializing'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'error';

interface TTSContextType {
  ttsState: TTSState;
  downloadProgress: number;
  downloadLanguage: string | null;
  sentences: Sentence[];
  sentenceTimings: SentenceTiming[];
  activeSentenceIndex: number;
  activeWordIndex: number;
  progressFraction: number;
  downloadedModels: PiperModelEntry[];
  initTTS: (rawText: string) => void;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekToFraction: (f: number) => void;
  seekToSentence: (index: number) => void;
  jumpSeconds: (delta: number) => void;
  setSpeed: (speed: number) => Promise<void>;
  setLanguage: (langCode: string) => void;
  deleteDownloadedModel: (langCode: string) => Promise<void>;
}

const TTSContext = createContext<TTSContextType>(null!);

const TRACKED_EVENTS = [Event.PlaybackActiveTrackChanged, Event.PlaybackQueueEnded];

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const { autoSkip } = usePlayback();

  const [ttsState, setTtsState] = useState<TTSState>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLanguage, setDownloadLanguage] = useState<string | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [sentenceTimings, setSentenceTimings] = useState<SentenceTiming[]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [progressFraction, setProgressFraction] = useState(0);
  const [downloadedModels, setDownloadedModels] = useState<PiperModelEntry[]>([]);

  const rawTextRef = useRef<string>('');
  const langCodeRef = useRef<string>('en');
  const overrideLangRef = useRef<string | null>(null);
  const sampleRateRef = useRef(22050);
  const bufferRef = useRef<TTSBuffer | null>(null);
  const timingsRef = useRef<SentenceTiming[]>([]);
  const sentencesRef = useRef<Sentence[]>([]);
  const totalCharsRef = useRef(1);

  // RNTP progress polling
  const { position } = useProgress(250);

  // Track cumulative start times per sentence index in RNTP queue
  const queueStartMsRef = useRef<number[]>([]);

  // Map sentence index → queue index
  const sentenceToQueueRef = useRef<Map<number, number>>(new Map());
  const queueIndexRef = useRef(0);

  const refreshDownloadedModels = useCallback(async () => {
    const all = listAll();
    const checked = await Promise.all(all.map(m => isDownloadedAsync(m.langCode)));
    setDownloadedModels(all.filter((_, i) => checked[i]));
  }, []);

  useEffect(() => {
    setupTrackPlayer().catch(() => {});
    refreshDownloadedModels();
  }, [refreshDownloadedModels]);

  // Update active sentence/word from RNTP position
  useEffect(() => {
    if (ttsState !== 'playing' && ttsState !== 'paused') return;
    if (timingsRef.current.length === 0) return;

    // Find which RNTP track index maps to which sentence
    // Position is within the current track; we need absolute position
    const queueIdx = queueIndexRef.current;
    const trackStartMs = queueStartMsRef.current[queueIdx] ?? 0;
    const absoluteMs = trackStartMs + position * 1000;

    // Find active sentence timing
    const timings = timingsRef.current;
    let activeIdx = 0;
    for (let i = 0; i < timings.length; i++) {
      if (absoluteMs >= timings[i].startMs && absoluteMs < timings[i].endMs) {
        activeIdx = timings[i].sentenceIndex;
        // Find word
        const wordTimings = timings[i].wordTimings;
        let wordIdx = 0;
        for (let j = 0; j < wordTimings.length; j++) {
          if (absoluteMs >= wordTimings[j].startMs) wordIdx = j;
        }
        setActiveWordIndex(wordIdx);
        break;
      }
    }

    setActiveSentenceIndex(activeIdx);

    // Update progress fraction based on char position
    const sent = sentencesRef.current[activeIdx];
    if (sent) {
      setProgressFraction(sent.charStart / totalCharsRef.current);
    }
  }, [position, ttsState]);

  useTrackPlayerEvents(TRACKED_EVENTS, async (event) => {
    if (event.type === Event.PlaybackActiveTrackChanged) {
      const idx = await TrackPlayer.getActiveTrackIndex();
      if (idx !== undefined && idx !== null) {
        queueIndexRef.current = idx;
        // Generate more if buffer is running low
        bufferRef.current?.onSegmentConsumed();
      }
    }
    if (event.type === Event.PlaybackQueueEnded) {
      setTtsState('paused');
    }
  });

  const flushBuffer = useCallback(() => {
    bufferRef.current?.flush();
    bufferRef.current = null;
    queueStartMsRef.current = [];
    sentenceToQueueRef.current = new Map();
    queueIndexRef.current = 0;
  }, []);

  const onSegmentReady = useCallback((segment: BufferSegment) => {
    setSentenceTimings(prev => {
      const next = [...prev, segment.timing];
      timingsRef.current = next;
      return next;
    });
    // Record cumulative start time for this queue entry
    const queueIdx = queueStartMsRef.current.length;
    queueStartMsRef.current.push(segment.timing.startMs);
    sentenceToQueueRef.current.set(segment.sentenceIndex, queueIdx);
  }, []);

  const onBufferError = useCallback((err: Error) => {
    console.warn('TTS buffer error:', err);
    setTtsState('error');
  }, []);

  const initTTS = useCallback(async (rawText: string) => {
    if (!rawText.trim()) return;

    rawTextRef.current = rawText;
    flushBuffer();
    await TrackPlayer.reset();
    await cleanTmpDir();

    setSentenceTimings([]);
    timingsRef.current = [];
    setActiveSentenceIndex(0);
    setActiveWordIndex(0);
    setProgressFraction(0);

    const lang = overrideLangRef.current ?? detectLanguage(rawText);
    langCodeRef.current = lang;

    const segs = segmentText(rawText, autoSkip);
    setSentences(segs);
    sentencesRef.current = segs;
    totalCharsRef.current = rawText.length || 1;

    if (segs.length === 0) {
      setTtsState('idle');
      return;
    }

    setTtsState('downloading');
    setDownloadLanguage(lang);
    setDownloadProgress(0);

    try {
      const model = await ensureModel(lang, (f) => setDownloadProgress(f));
      sampleRateRef.current = model.entry.sampleRate;
      await refreshDownloadedModels();
    } catch (err) {
      console.warn('TTS model init failed:', err);
      setTtsState('error');
      return;
    }

    setTtsState('loading');
    setDownloadLanguage(null);

    bufferRef.current = new TTSBuffer(segs, sampleRateRef.current, onSegmentReady, onBufferError);
    bufferRef.current.start(0, 0);
  }, [autoSkip, flushBuffer, onSegmentReady, onBufferError, refreshDownloadedModels]);

  const play = useCallback(async () => {
    if (ttsState === 'idle' || ttsState === 'error') return;
    await TrackPlayer.play();
    setTtsState('playing');
  }, [ttsState]);

  const pause = useCallback(async () => {
    await TrackPlayer.pause();
    setTtsState('paused');
  }, []);

  const seekToSentence = useCallback(async (index: number) => {
    const sents = sentencesRef.current;
    if (index < 0 || index >= sents.length) return;

    setTtsState('seeking');
    flushBuffer();
    await TrackPlayer.reset();
    setSentenceTimings([]);
    timingsRef.current = [];

    // Calculate cumulative start time up to this sentence
    // Use already-known timings if we have them, else start from 0
    let startMs = 0;
    const existingTiming = timingsRef.current.find(t => t.sentenceIndex === index);
    if (existingTiming) startMs = existingTiming.startMs;

    bufferRef.current = new TTSBuffer(
      sents.slice(index),
      sampleRateRef.current,
      onSegmentReady,
      onBufferError,
    );
    bufferRef.current.start(0, startMs);

    setActiveSentenceIndex(index);
    setProgressFraction(sents[index].charStart / totalCharsRef.current);
    await TrackPlayer.play();
    setTtsState('playing');
  }, [flushBuffer, onSegmentReady, onBufferError]);

  const seekToFraction = useCallback((f: number) => {
    const targetChar = f * totalCharsRef.current;
    const sents = sentencesRef.current;
    let targetIdx = 0;
    for (let i = 0; i < sents.length; i++) {
      if (sents[i].charStart <= targetChar) targetIdx = i;
      else break;
    }
    seekToSentence(targetIdx);
  }, [seekToSentence]);

  const jumpSeconds = useCallback(async (delta: number) => {
    const timings = timingsRef.current;
    if (timings.length === 0) return;

    const queueIdx = queueIndexRef.current;
    const trackStartMs = queueStartMsRef.current[queueIdx] ?? 0;
    const absoluteMs = trackStartMs + position * 1000;
    const targetMs = absoluteMs + delta * 1000;

    // Find sentence containing targetMs
    let targetSentIdx = 0;
    for (let i = 0; i < timings.length; i++) {
      if (targetMs >= timings[i].startMs) targetSentIdx = timings[i].sentenceIndex;
    }

    // Check if the target is in an already-queued segment
    const targetQueueIdx = sentenceToQueueRef.current.get(targetSentIdx);
    if (targetQueueIdx !== undefined) {
      await TrackPlayer.skip(targetQueueIdx);
      const sentTiming = timings.find(t => t.sentenceIndex === targetSentIdx);
      if (sentTiming) {
        const offsetSec = Math.max(0, (targetMs - sentTiming.startMs) / 1000);
        await TrackPlayer.seekTo(offsetSec);
      }
    } else {
      seekToSentence(targetSentIdx);
    }
  }, [position, seekToSentence]);

  const setSpeed = useCallback(async (speed: number) => {
    await TrackPlayer.setRate(speed);
  }, []);

  const setLanguage = useCallback((langCode: string) => {
    overrideLangRef.current = langCode;
    // Re-init TTS with new language if we have text
    if (rawTextRef.current) {
      initTTS(rawTextRef.current);
    }
  }, [initTTS]);

  const deleteDownloadedModel = useCallback(async (langCode: string) => {
    await deleteModel(langCode);
    refreshDownloadedModels();
  }, [refreshDownloadedModels]);

  // Sync ttsState with actual RNTP playback state
  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackState, (e: { state: State }) => {
      if (ttsState === 'seeking' || ttsState === 'downloading' || ttsState === 'initializing') return;
      if (e.state === State.Playing) setTtsState('playing');
      else if (e.state === State.Paused || e.state === State.Stopped) setTtsState('paused');
      else if (e.state === State.Loading || e.state === State.Buffering) setTtsState('loading');
    });
    return () => sub.remove();
  }, [ttsState]);

  // Expose initTTS as stable ref-based wrapper (doesn't need to be in memo deps everywhere)
  const initTTSRef = useRef(initTTS);
  initTTSRef.current = initTTS;

  const value: TTSContextType = {
    ttsState,
    downloadProgress,
    downloadLanguage,
    sentences,
    sentenceTimings,
    activeSentenceIndex,
    activeWordIndex,
    progressFraction,
    downloadedModels,
    initTTS: (text) => initTTSRef.current(text),
    play,
    pause,
    seekToFraction,
    seekToSentence,
    jumpSeconds,
    setSpeed,
    setLanguage,
    deleteDownloadedModel,
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
}

export function useTTS() {
  return useContext(TTSContext);
}
