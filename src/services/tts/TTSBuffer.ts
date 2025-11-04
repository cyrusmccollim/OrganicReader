import { EmitterSubscription } from 'react-native';
import { Sentence } from './TextSegmenter';
import { SentenceTiming, buildSentenceTiming } from './TimingAccumulator';
import { synthesize, deleteTempFile } from './TTSEngine';
import { SimpleAudio } from './SimpleAudio';

export interface BufferSegment {
  sentenceIndex: number;
  timing: SentenceTiming;
  audioPath: string;
}

const LOOKAHEAD = 3;
const CONCURRENCY = 2;

interface SynthResult {
  audioPath: string;
  durationMs: number;
  sentence: Sentence;
}

export class TTSBuffer {
  private sentences: Sentence[];
  private sampleRate: number;
  private onSegmentReady: (segment: BufferSegment) => void;
  private onError: (err: Error) => void;

  private cancelled = false;
  private running = false;
  private nextGenIndex = 0;
  private cumulativeMs = 0;

  private readySegments: Array<{ index: number; timing: SentenceTiming; path: string }> = [];
  private isPlaying = false;
  private generatedPaths: string[] = [];

  private loopSignal: (() => void) | null = null;

  private completionSub: EmitterSubscription | null = null;
  private errorSub: EmitterSubscription | null = null;

  // Parallel synthesis: inflight promises keyed by sentence array index
  private inflight = new Map<number, Promise<void>>();
  // Resolved results waiting to be flushed in order
  private results = new Map<number, SynthResult>();
  // Next index to flush from results (in-order)
  private nextFlushIndex = 0;

  constructor(
    sentences: Sentence[],
    sampleRate: number,
    onSegmentReady: (segment: BufferSegment) => void,
    onError: (err: Error) => void,
  ) {
    this.sentences = sentences;
    this.sampleRate = sampleRate;
    this.onSegmentReady = onSegmentReady;
    this.onError = onError;
  }

  start(fromIndex: number, fromMs: number) {
    this.cancelled = false;
    this.nextGenIndex = fromIndex;
    this.nextFlushIndex = fromIndex;
    this.cumulativeMs = fromMs;

    this.completionSub = SimpleAudio.onComplete(() => {
      if (!this.cancelled) this.handleComplete();
    });
    this.errorSub = SimpleAudio.onError((err) => {
      if (!this.cancelled) this.onError(new Error(err));
    });

    this.runLoop();
  }

  private handleComplete() {
    this.isPlaying = false;
    this.loopSignal?.();
    this.playNextReady();
  }

  private playNextReady() {
    if (this.isPlaying || this.readySegments.length === 0 || this.cancelled) return;
    const next = this.readySegments.shift()!;
    this.isPlaying = true;

    // Fire onSegmentReady BEFORE play so UI highlights the correct sentence immediately
    this.onSegmentReady({ sentenceIndex: next.index, timing: next.timing, audioPath: next.path });
    SimpleAudio.play(next.path).catch((e) => {
      this.isPlaying = false;
      if (!this.cancelled) this.onError(e instanceof Error ? e : new Error(String(e)));
    });
  }

  /** Flush resolved results in-order into readySegments */
  private flushResults() {
    while (this.results.has(this.nextFlushIndex)) {
      const r = this.results.get(this.nextFlushIndex)!;
      this.results.delete(this.nextFlushIndex);
      this.inflight.delete(this.nextFlushIndex);
      this.nextFlushIndex++;

      const timing = buildSentenceTiming(r.sentence, this.cumulativeMs, r.durationMs);
      this.cumulativeMs += r.durationMs;

      this.readySegments.push({ index: r.sentence.index, timing, path: r.audioPath });
      this.playNextReady();
    }
  }

  private async runLoop() {
    if (this.running || this.cancelled) return;
    this.running = true;

    while (!this.cancelled && this.nextGenIndex < this.sentences.length) {
      // Throttle: don't build up more than LOOKAHEAD ready segments
      if (this.readySegments.length >= LOOKAHEAD) {
        await new Promise<void>(resolve => { this.loopSignal = resolve; });
        this.loopSignal = null;
        continue;
      }

      // Spawn up to CONCURRENCY parallel synthesis calls
      while (
        this.inflight.size < CONCURRENCY &&
        this.nextGenIndex < this.sentences.length &&
        this.readySegments.length + this.inflight.size < LOOKAHEAD
      ) {
        const idx = this.nextGenIndex++;
        const sentence = this.sentences[idx];

        const job = synthesize(sentence.ttsText, this.sampleRate)
          .then(segment => {
            if (this.cancelled) {
              deleteTempFile(segment.audioPath).catch(() => {});
              return;
            }
            this.generatedPaths.push(segment.audioPath);
            this.results.set(idx, {
              audioPath: segment.audioPath,
              durationMs: segment.durationMs,
              sentence,
            });
          })
          .catch(e => {
            if (!this.cancelled) this.onError(e instanceof Error ? e : new Error(String(e)));
          });

        this.inflight.set(idx, job);
      }

      // Wait for at least one inflight job to finish
      if (this.inflight.size > 0) {
        await Promise.race([...this.inflight.values()]);
      }

      this.flushResults();
      if (this.cancelled) break;
    }

    // Drain remaining inflight jobs
    if (this.inflight.size > 0) {
      await Promise.all([...this.inflight.values()]);
      this.flushResults();
    }

    this.running = false;
  }

  flush() {
    this.cancelled = true;
    this.running = false;
    this.isPlaying = false;
    this.loopSignal?.();
    this.loopSignal = null;
    this.completionSub?.remove();
    this.completionSub = null;
    this.errorSub?.remove();
    this.errorSub = null;

    const paths = [...this.generatedPaths];
    this.generatedPaths = [];
    this.readySegments = [];
    this.nextGenIndex = 0;
    this.nextFlushIndex = 0;
    this.cumulativeMs = 0;
    this.inflight.clear();
    this.results.clear();

    SimpleAudio.stop().catch(() => {});
    paths.forEach(p => deleteTempFile(p).catch(() => {}));
  }

  destroy() { this.flush(); }
}
