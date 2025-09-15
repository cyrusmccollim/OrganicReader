import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { EmitterSubscription } from 'react-native';
import { ensureModel, deleteModel, isDownloadedAsync, listAll } from '../services/tts/ModelRegistry';
import { detectLanguage } from '../services/tts/LanguageDetector';
import { segmentText, Sentence } from '../services/tts/TextSegmenter';
import { SentenceTiming } from '../services/tts/TimingAccumulator';
import { TTSBuffer, BufferSegment } from '../services/tts/TTSBuffer';
import { cleanTmpDir } from '../services/tts/TTSEngine';
import { SimpleAudio } from '../services/tts/SimpleAudio';
import { usePlayback } from './PlaybackContext';
import { PiperModelEntry, findModel } from '../config/ttsModels';

export type TTSState =
  | 'idle'
  | 'downloading'
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
  seekToFraction: (f: number) => Promise<void>;
  seekToSentence: (index: number) => void;
  jumpSeconds: (delta: number) => void;
  setSpeed: (speed: number) => Promise<void>;
  setVoice: (entry: PiperModelEntry) => void;
  deleteDownloadedModel: (entry: PiperModelEntry) => Promise<void>;
}

const TTSContext = createContext<TTSContextType>(null!);

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
  const overrideEntryRef = useRef<PiperModelEntry | null>(null);
  const sampleRateRef = useRef(22050);
  const bufferRef = useRef<TTSBuffer | null>(null);
  const timingsRef = useRef<SentenceTiming[]>([]);
  const sentencesRef = useRef<Sentence[]>([]);
  const totalCharsRef = useRef(1);

  // Active segment tracking — set when onSegmentReady fires
  const activeTimingRef = useRef<SentenceTiming | null>(null);
  const positionWithinFileRef = useRef(0);

  // Subscriptions
  const progressSubRef = useRef<EmitterSubscription | null>(null);

  const refreshDownloadedModels = useCallback(async () => {
    const all = listAll();
    const checked = await Promise.all(all.map(m => isDownloadedAsync(m)));
    setDownloadedModels(all.filter((_, i) => checked[i]));
  }, []);

  useEffect(() => {
    refreshDownloadedModels();
  }, [refreshDownloadedModels]);

  // Subscribe to AudioProgress for word/sentence highlighting
  useEffect(() => {
    progressSubRef.current?.remove();
    progressSubRef.current = SimpleAudio.onProgress((posMs) => {
      positionWithinFileRef.current = posMs;
      const timing = activeTimingRef.current;
      if (!timing || (ttsState !== 'playing' && ttsState !== 'paused')) return;

      const absoluteMs = timing.startMs + posMs;

      // Word highlighting
      const wordTimings = timing.wordTimings;
      let wordIdx = 0;
      for (let j = 0; j < wordTimings.length; j++) {
        if (absoluteMs >= wordTimings[j].startMs) wordIdx = j;
      }
      setActiveWordIndex(wordIdx);

      // Progress bar
      const sent = sentencesRef.current[timing.sentenceIndex];
      if (sent) setProgressFraction(sent.charStart / totalCharsRef.current);
    });
    return () => {
      progressSubRef.current?.remove();
      progressSubRef.current = null;
    };
  }, [ttsState]);

  const flushBuffer = useCallback(() => {
    bufferRef.current?.flush();
    bufferRef.current = null;
    activeTimingRef.current = null;
    positionWithinFileRef.current = 0;
  }, []);

  const onSegmentReady = useCallback((segment: BufferSegment) => {
    setSentenceTimings(prev => {
      const next = [...prev, segment.timing];
      timingsRef.current = next;
      return next;
    });
    activeTimingRef.current = segment.timing;
    setActiveSentenceIndex(segment.sentenceIndex);
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

    setSentenceTimings([]);
    timingsRef.current = [];
    setActiveSentenceIndex(0);
    setActiveWordIndex(0);
    setProgressFraction(0);

    const detectedLang = detectLanguage(rawText);
    const entry = overrideEntryRef.current ?? findModel(detectedLang);

    const segs = segmentText(rawText, autoSkip);
    setSentences(segs);
    sentencesRef.current = segs;
    totalCharsRef.current = rawText.length || 1;

    if (segs.length === 0) { setTtsState('idle'); return; }

    setTtsState('downloading');
    setDownloadLanguage(entry.voiceLabel);
    setDownloadProgress(0);

    try {
      await SimpleAudio.stop();
      await cleanTmpDir();
      const model = await ensureModel(entry, (f) => setDownloadProgress(f));
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
    await SimpleAudio.resume();
    setTtsState('playing');
  }, [ttsState]);

  const pause = useCallback(async () => {
    await SimpleAudio.pause();
    setTtsState('paused');
  }, []);

  const seekToSentence = useCallback(async (index: number) => {
    const sents = sentencesRef.current;
    if (index < 0 || index >= sents.length) return;

    setTtsState('seeking');
    flushBuffer();

    setSentenceTimings([]);
    timingsRef.current = [];

    bufferRef.current = new TTSBuffer(
      sents.slice(index),
      sampleRateRef.current,
      onSegmentReady,
      onBufferError,
    );
    bufferRef.current.start(0, 0);

    setActiveSentenceIndex(index);
    setProgressFraction(sents[index].charStart / totalCharsRef.current);
  }, [flushBuffer, onSegmentReady, onBufferError]);

  const seekToFraction = useCallback(async (f: number) => {
    const targetChar = f * totalCharsRef.current;
    const sents = sentencesRef.current;
    let targetIdx = 0;
    for (let i = 0; i < sents.length; i++) {
      if (sents[i].charStart <= targetChar) targetIdx = i;
      else break;
    }
    await seekToSentence(targetIdx);
  }, [seekToSentence]);

  const jumpSeconds = useCallback(async (delta: number) => {
    const timing = activeTimingRef.current;
    if (!timing) return;

    const absoluteMs = timing.startMs + positionWithinFileRef.current;
    const targetMs = absoluteMs + delta * 1000;

    // Find sentence containing targetMs
    const timings = timingsRef.current;
    let targetSentIdx = timing.sentenceIndex;
    for (let i = 0; i < timings.length; i++) {
      if (targetMs >= timings[i].startMs && targetMs < timings[i].endMs) {
        targetSentIdx = timings[i].sentenceIndex;
        // Seek within current file if same sentence
        if (timings[i].sentenceIndex === timing.sentenceIndex) {
          await SimpleAudio.seekTo(targetMs - timings[i].startMs);
          return;
        }
        break;
      }
    }
    await seekToSentence(targetSentIdx);
  }, [seekToSentence]);

  const setSpeed = useCallback(async (speed: number) => {
    await SimpleAudio.setRate(speed);
  }, []);

  const setVoice = useCallback((entry: PiperModelEntry) => {
    overrideEntryRef.current = entry;
    if (rawTextRef.current) initTTS(rawTextRef.current);
  }, [initTTS]);

  const deleteDownloadedModel = useCallback(async (entry: PiperModelEntry) => {
    await deleteModel(entry);
    refreshDownloadedModels();
  }, [refreshDownloadedModels]);

  const initTTSRef = useRef(initTTS);
  initTTSRef.current = initTTS;

  return (
    <TTSContext.Provider value={{
      ttsState, downloadProgress, downloadLanguage,
      sentences, sentenceTimings, activeSentenceIndex, activeWordIndex,
      progressFraction, downloadedModels,
      initTTS: (text) => initTTSRef.current(text),
      play, pause, seekToFraction, seekToSentence, jumpSeconds,
      setSpeed, setVoice, deleteDownloadedModel,
    }}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  return useContext(TTSContext);
}
