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

interface ReadySegment { index: number; timing: SentenceTiming; path: string }

const LOOKAHEAD = 3;

export class TTSBuffer {
  private sentences: Sentence[];
  private sampleRate: number;
  private onSegmentReady: (segment: BufferSegment) => void;
  private onError: (err: Error) => void;

  private cancelled = false;
  private running = false;
  private nextGenIndex = 0;
  private cumulativeMs = 0;

  private readySegments: ReadySegment[] = [];
  private isPlaying = false;
  private generatedPaths: string[] = [];
  // The segment queued in the native player, waiting to auto-start on completion
  private nativeQueued: ReadySegment | null = null;

  private loopSignal: (() => void) | null = null;

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
      if (!this.cancelled) this.handleComplete();
    });
    this.errorSub = SimpleAudio.onError((err) => {
      if (!this.cancelled) this.onError(new Error(err));
    });

    this.runLoop();
  }

  private handleComplete() {
    if (this.nativeQueued) {
      // Native already started playing the queued segment
      const seg = this.nativeQueued;
      this.nativeQueued = null;
      this.onSegmentReady({ sentenceIndex: seg.index, timing: seg.timing, audioPath: seg.path });
      // Queue the next one from the ready queue into native
      this.queueNextNative();
    } else {
      // Nothing was queued — try to play from ready queue
      this.isPlaying = false;
      this.playNextReady();
    }
    this.loopSignal?.();
  }

  /** Queue the next ready segment into the native double-buffer */
  private queueNextNative() {
    if (this.nativeQueued || this.readySegments.length === 0 || this.cancelled) return;
    const next = this.readySegments.shift()!;
    this.nativeQueued = next;
    SimpleAudio.queueNext(next.path).catch((e) => {
      // If queueing fails, fall back to regular play on completion
      this.nativeQueued = null;
      this.readySegments.unshift(next);
      if (!this.cancelled) console.warn('queueNext failed:', e);
    });
  }

  private playNextReady() {
    if (this.isPlaying || this.readySegments.length === 0 || this.cancelled) return;
    const next = this.readySegments.shift()!;
    this.isPlaying = true;

    this.onSegmentReady({ sentenceIndex: next.index, timing: next.timing, audioPath: next.path });
    SimpleAudio.play(next.path).then(() => {
      // First segment is now playing — queue the next one for gapless transition
      this.queueNextNative();
    }).catch((e) => {
      this.isPlaying = false;
      if (!this.cancelled) this.onError(e instanceof Error ? e : new Error(String(e)));
    });
  }

  private async runLoop() {
    if (this.running || this.cancelled) return;
    this.running = true;

    while (!this.cancelled && this.nextGenIndex < this.sentences.length) {
      if (this.readySegments.length >= LOOKAHEAD) {
        await new Promise<void>(resolve => { this.loopSignal = resolve; });
        this.loopSignal = null;
        continue;
      }

      const sentence = this.sentences[this.nextGenIndex];
      const startMs = this.cumulativeMs;

      try {
        const segment = await synthesize(sentence.ttsText, this.sampleRate);
        if (this.cancelled) { await deleteTempFile(segment.audioPath); break; }

        this.generatedPaths.push(segment.audioPath);
        const timing = buildSentenceTiming(sentence, startMs, segment.durationMs);
        this.cumulativeMs += segment.durationMs;
        this.nextGenIndex++;

        this.readySegments.push({ index: sentence.index, timing, path: segment.audioPath });

        if (!this.isPlaying) {
          this.playNextReady();
        } else {
          // Already playing — try to queue into native double-buffer
          this.queueNextNative();
        }
      } catch (e) {
        if (!this.cancelled) this.onError(e instanceof Error ? e : new Error(String(e)));
        break;
      }
    }

    this.running = false;
  }

  flush() {
    this.cancelled = true;
    this.running = false;
    this.isPlaying = false;
    this.nativeQueued = null;
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
    this.cumulativeMs = 0;

    SimpleAudio.stop().catch(() => {});
    paths.forEach(p => deleteTempFile(p).catch(() => {}));
  }

  destroy() { this.flush(); }
}
