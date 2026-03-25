import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { EmitterSubscription } from 'react-native';
import { ensureModel, deleteModel, isDownloadedAsync, listAll, cancelActiveDownload } from '../services/tts/ModelRegistry';
import { detectLanguage } from '../services/tts/LanguageDetector';
import { segmentText, Sentence } from '../services/tts/TextSegmenter';
import { SentenceTiming } from '../services/tts/TimingAccumulator';
import { TTSBuffer, BufferSegment } from '../services/tts/TTSBuffer';
import { cleanTmpDir } from '../services/tts/TTSEngine';
import { SimpleAudio } from '../services/tts/SimpleAudio';
import { usePlayback } from './PlaybackContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TTSModelEntry, findModel, modelKey, ALL_MODELS } from '../config/ttsModels';

const LAST_VOICE_KEY = 'tts_last_voice';

export type TTSState =
  | 'idle'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'error';

interface TTSContextType {
  ttsState: TTSState;
  errorMessage: string | null;
  downloadProgress: number;
  downloadLanguage: string | null;
  sentences: Sentence[];
  activeSentenceIndex: number;
  activeSentenceTiming: SentenceTiming | null;
  progressFraction: number;
  totalEstimatedMs: number;
  totalChars: number;
  downloadedModels: TTSModelEntry[];
  activeModelEntry: TTSModelEntry | null;
  initTTS: (rawText: string) => void;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => void;
  seekToFraction: (f: number) => Promise<void>;
  seekToSentence: (index: number) => void;
  jumpSeconds: (delta: number) => void;
  setSpeed: (speed: number) => Promise<void>;
  setVoice: (entry: TTSModelEntry) => void;
  cancelDownload: () => void;
  deleteDownloadedModel: (entry: TTSModelEntry) => Promise<void>;
}

const TTSContext = createContext<TTSContextType>(null!);

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const { autoSkip } = usePlayback();

  const [ttsState, setTtsState] = useState<TTSState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLanguage, setDownloadLanguage] = useState<string | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [activeSentenceTiming, setActiveSentenceTiming] = useState<SentenceTiming | null>(null);
  const [progressFraction, setProgressFraction] = useState(0);
  const [totalEstimatedMs, setTotalEstimatedMs] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [downloadedModels, setDownloadedModels] = useState<TTSModelEntry[]>([]);
  const [activeModelEntry, setActiveModelEntry] = useState<TTSModelEntry | null>(null);

  const rawTextRef = useRef<string>('');
  const overrideEntryRef = useRef<TTSModelEntry | null>(null);
  const sampleRateRef = useRef(22050);
  const bufferRef = useRef<TTSBuffer | null>(null);
  const timingsRef = useRef<SentenceTiming[]>([]);
  const sentencesRef = useRef<Sentence[]>([]);
  const totalCharsRef = useRef(1);
  const totalEstimatedMsRef = useRef(0);
  const modelReadyRef = useRef(false);

  // Active segment tracking
  const activeTimingRef = useRef<SentenceTiming | null>(null);
  // Position within CURRENT audio segment (ms), updated by AudioProgress events.
  // NOT state -- no re-renders.
  const positionWithinFileRef = useRef(0);

  const progressSubRef = useRef<EmitterSubscription | null>(null);

  const refreshDownloadedModels = useCallback(async () => {
    const all = listAll();
    const checked = await Promise.all(all.map(m => isDownloadedAsync(m)));
    setDownloadedModels(all.filter((_, i) => checked[i]));
  }, []);

  useEffect(() => {
    refreshDownloadedModels();
    AsyncStorage.getItem(LAST_VOICE_KEY).then(key => {
      if (!key) return;
      const entry = ALL_MODELS.find(m => modelKey(m) === key);
      if (entry) overrideEntryRef.current = entry;
    });
  }, [refreshDownloadedModels]);

  // Subscribe to AudioProgress -- ONLY update positionWithinFileRef (no setState = no re-renders)
  useEffect(() => {
    progressSubRef.current?.remove();
    progressSubRef.current = SimpleAudio.onProgress((posMs) => {
      positionWithinFileRef.current = posMs;
    });
    return () => {
      progressSubRef.current?.remove();
      progressSubRef.current = null;
    };
  }, []);

  const flushBuffer = useCallback(() => {
    bufferRef.current?.flush();
    bufferRef.current = null;
    activeTimingRef.current = null;
    positionWithinFileRef.current = 0;
  }, []);

  const onSegmentGenerated = useCallback((timing: SentenceTiming) => {
    timingsRef.current.push(timing);
  }, []);

  const onSegmentReady = useCallback((segment: BufferSegment) => {
    activeTimingRef.current = segment.timing;
    setActiveSentenceTiming(segment.timing);
    setActiveSentenceIndex(segment.sentenceIndex);

    const sent = sentencesRef.current[segment.sentenceIndex];
    if (sent) setProgressFraction(sent.charStart / totalCharsRef.current);

    // Estimate total duration ONCE from the first-ever segment timing
    if (totalEstimatedMsRef.current === 0 && segment.timing.durationMs > 0) {
      const segTtsLen = sentencesRef.current[segment.sentenceIndex]?.ttsText.length ?? 1;
      const totalTtsChars = sentencesRef.current.reduce((s, r) => s + r.ttsText.length, 0);
      if (segTtsLen > 0 && totalTtsChars > 0) {
        const msPerChar = segment.timing.durationMs / segTtsLen;
        const estimated = Math.round(msPerChar * totalTtsChars);
        totalEstimatedMsRef.current = estimated;
        setTotalEstimatedMs(estimated);
      }
    }

    setTtsState('playing');
  }, []);

  const onBufferError = useCallback((err: Error) => {
    console.warn('TTS buffer error:', err);
    setTtsState('error');
  }, []);

  const initTTS = useCallback(async (rawText: string) => {
    if (!rawText.trim()) return;

    rawTextRef.current = rawText;
    flushBuffer();
    modelReadyRef.current = false;
    setErrorMessage(null);

    timingsRef.current = [];
    totalEstimatedMsRef.current = 0;
    setTotalEstimatedMs(0);
    setActiveSentenceIndex(0);
    setActiveSentenceTiming(null);
    setProgressFraction(0);

    const detectedLang = detectLanguage(rawText);
    const entry = overrideEntryRef.current ?? findModel(detectedLang);
    setActiveModelEntry(entry);

    const segs = segmentText(rawText, autoSkip);
    setSentences(segs);
    sentencesRef.current = segs;
    const chars = rawText.length || 1;
    totalCharsRef.current = chars;
    setTotalChars(chars);

    if (segs.length === 0) { setTtsState('idle'); return; }

    try {
      await SimpleAudio.stop();
      const [, alreadyDownloaded] = await Promise.all([
        cleanTmpDir(),
        isDownloadedAsync(entry),
      ]);
      if (!alreadyDownloaded) {
        setTtsState('downloading');
        setDownloadLanguage(entry.voiceLabel);
        setDownloadProgress(0);
      } else {
        setTtsState('loading');
      }

      const model = await ensureModel(entry, (f) => {
        if (!alreadyDownloaded) setDownloadProgress(f);
      });
      sampleRateRef.current = model.entry.sampleRate;
      setActiveModelEntry(model.entry);
      await refreshDownloadedModels();
    } catch (err: any) {
      const msg = err?.message?.includes('cancelled')
        ? 'Download cancelled'
        : `Voice download failed: ${err?.message ?? 'unknown error'}`;
      console.warn('TTS model init failed:', err);
      setErrorMessage(msg);
      setTtsState('error');
      return;
    }

    setDownloadLanguage(null);
    modelReadyRef.current = true;
    setTtsState('ready');
  }, [autoSkip, flushBuffer, refreshDownloadedModels]);

  const startBuffer = useCallback((fromIndex: number) => {
    flushBuffer();
    timingsRef.current = [];
    // Don't reset totalEstimatedMs on seek -- keep the estimate we computed from first segment

    const sents = sentencesRef.current;
    bufferRef.current = new TTSBuffer(
      fromIndex > 0 ? sents.slice(fromIndex) : sents,
      sampleRateRef.current,
      onSegmentReady,
      onSegmentGenerated,
      onBufferError,
    );
    bufferRef.current.start(0, 0);
  }, [flushBuffer, onSegmentReady, onSegmentGenerated, onBufferError]);

  const play = useCallback(async () => {
    if (ttsState === 'downloading' || ttsState === 'loading') return;

    // Retry init on error or idle (e.g. after failed Melo init)
    if ((ttsState === 'idle' || ttsState === 'error') && rawTextRef.current) {
      initTTS(rawTextRef.current);
      return;
    }

    if (ttsState === 'ready' || !bufferRef.current) {
      startBuffer(activeSentenceIndex);
      return;
    }

    await SimpleAudio.resume();
    setTtsState('playing');
  }, [ttsState, activeSentenceIndex, startBuffer, initTTS]);

  const pause = useCallback(async () => {
    await SimpleAudio.pause();
    setTtsState('paused');
  }, []);

  const stop = useCallback(() => {
    flushBuffer();
    SimpleAudio.stop().catch(() => {});
    setTtsState(modelReadyRef.current ? 'ready' : 'idle');
    setActiveSentenceIndex(0);
    setActiveSentenceTiming(null);
    setProgressFraction(0);
    timingsRef.current = [];
  }, [flushBuffer]);

  const seekToSentence = useCallback((index: number) => {
    const sents = sentencesRef.current;
    if (index < 0 || index >= sents.length) return;

    // Fast path: segment already synthesized — skip to it instantly, no re-synthesis.
    if (bufferRef.current?.seekTo(index)) {
      setActiveSentenceIndex(index);
      setProgressFraction(sents[index].charStart / totalCharsRef.current);
      return;
    }

    // Slow path: flush and re-synthesize from the target sentence.
    setTtsState('seeking');
    startBuffer(index);
    setActiveSentenceIndex(index);
    setProgressFraction(sents[index].charStart / totalCharsRef.current);
  }, [startBuffer]);

  const seekToFraction = useCallback(async (f: number) => {
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
    const timing = activeTimingRef.current;
    if (!timing) return;

    const absoluteMs = timing.startMs + positionWithinFileRef.current;
    const targetMs = absoluteMs + delta * 1000;

    const timings = timingsRef.current;
    let targetSentIdx = timing.sentenceIndex;
    for (let i = 0; i < timings.length; i++) {
      if (targetMs >= timings[i].startMs && targetMs < timings[i].endMs) {
        targetSentIdx = timings[i].sentenceIndex;
        if (timings[i].sentenceIndex === timing.sentenceIndex) {
          await SimpleAudio.seekTo(targetMs - timings[i].startMs);
          return;
        }
        break;
      }
    }
    seekToSentence(targetSentIdx);
  }, [seekToSentence]);

  const setSpeed = useCallback(async (speed: number) => {
    await SimpleAudio.setRate(speed);
  }, []);

  const setVoice = useCallback((entry: TTSModelEntry) => {
    overrideEntryRef.current = entry;
    AsyncStorage.setItem(LAST_VOICE_KEY, modelKey(entry)).catch(() => {});
    if (rawTextRef.current) initTTS(rawTextRef.current);
  }, [initTTS]);

  const cancelDownload = useCallback(() => {
    cancelActiveDownload();
    setTtsState(modelReadyRef.current ? 'ready' : 'idle');
    setDownloadLanguage(null);
    setDownloadProgress(0);
  }, []);

  const deleteDownloadedModel = useCallback(async (entry: TTSModelEntry) => {
    await deleteModel(entry);
    refreshDownloadedModels();
  }, [refreshDownloadedModels]);

  const initTTSRef = useRef(initTTS);
  initTTSRef.current = initTTS;

  return (
    <TTSContext.Provider value={{
      ttsState, errorMessage, downloadProgress, downloadLanguage,
      sentences, activeSentenceIndex, activeSentenceTiming,
      progressFraction, totalEstimatedMs, totalChars,
      downloadedModels, activeModelEntry,
      initTTS: (text) => initTTSRef.current(text),
      play, pause, stop, seekToFraction, seekToSentence, jumpSeconds,
      setSpeed, setVoice, cancelDownload, deleteDownloadedModel,
    }}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  return useContext(TTSContext);
}
