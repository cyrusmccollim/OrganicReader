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

/** Simple broadcast: all current waiters are woken on notify(). */
class Signal {
  private waiters: Array<() => void> = [];

  wait(): Promise<void> {
    return new Promise(resolve => this.waiters.push(resolve));
  }

  notify() {
    const w = this.waiters.splice(0);
    w.forEach(fn => fn());
  }
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

  private signal = new Signal();

  private completionSub: EmitterSubscription | null = null;
  private errorSub: EmitterSubscription | null = null;

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
    this.cumulativeMs = fromMs;

    this.completionSub = SimpleAudio.onComplete(() => {
      if (this.cancelled) return;
      this.isPlaying = false;
      this.signal.notify();
      this.playNextReady();
    });
    this.errorSub = SimpleAudio.onError((err) => {
      if (!this.cancelled) this.onError(new Error(err));
    });

    this.runLoop();
  }

  private playNextReady() {
    if (this.isPlaying || this.readySegments.length === 0 || this.cancelled) return;
    const next = this.readySegments.shift()!;
    this.isPlaying = true;

    this.onSegmentReady({ sentenceIndex: next.index, timing: next.timing, audioPath: next.path });
    SimpleAudio.play(next.path).catch((e) => {
      this.isPlaying = false;
      if (!this.cancelled) this.onError(e instanceof Error ? e : new Error(String(e)));
    });
  }

  private async synthesizeOne(sentence: Sentence): Promise<SynthResult | undefined> {
    try {
      const segment = await synthesize(sentence.ttsText, this.sampleRate);
      if (this.cancelled) {
        deleteTempFile(segment.audioPath).catch(() => {});
        return undefined;
      }
      this.generatedPaths.push(segment.audioPath);
      return { audioPath: segment.audioPath, durationMs: segment.durationMs, sentence };
    } catch (e) {
      if (!this.cancelled) this.onError(e instanceof Error ? e : new Error(String(e)));
      return undefined;
    }
  }

  private async runLoop() {
    if (this.running || this.cancelled) return;
    this.running = true;

    const results = new Map<number, SynthResult>();
    let nextFlushIdx = this.nextGenIndex;

    const worker = async () => {
      while (!this.cancelled) {
        // Back off while ready queue is full
        while (this.readySegments.length >= LOOKAHEAD && !this.cancelled) {
          await this.signal.wait();
        }
        if (this.cancelled) break;

        const idx = this.nextGenIndex;
        if (idx >= this.sentences.length) break;
        this.nextGenIndex++;

        const result = await this.synthesizeOne(this.sentences[idx]);
        if (result) results.set(idx, result);

        this.signal.notify(); // wake flusher + other workers
      }
    };

    const flusher = async () => {
      while (!this.cancelled && nextFlushIdx < this.sentences.length) {
        // Flush as many in-order results as possible
        while (results.has(nextFlushIdx)) {
          const r = results.get(nextFlushIdx)!;
          results.delete(nextFlushIdx);
          nextFlushIdx++;

          const timing = buildSentenceTiming(r.sentence, this.cumulativeMs, r.durationMs);
          this.cumulativeMs += r.durationMs;
          this.readySegments.push({ index: r.sentence.index, timing, path: r.audioPath });
          this.playNextReady();
        }

        if (nextFlushIdx >= this.sentences.length) break;
        await this.signal.wait();
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all([...workers, flusher()]);

    this.running = false;
  }

  flush() {
    this.cancelled = true;
    this.running = false;
    this.isPlaying = false;
    this.signal.notify(); // unblock all waiters
    this.completionSub?.remove();
    this.completionSub = null;
    this.errorSub?.remove();
    this.errorSub = null;

    const paths = [...this.generatedPaths];
    this.generatedPaths = [];
    this.readySegments = [];
    this.nextGenIndex = 0;
    this.cumulativeMs = 0;

    SimpleAudio.stop().catch(() => {});
    paths.forEach(p => deleteTempFile(p).catch(() => {}));
  }

  destroy() { this.flush(); }
}
