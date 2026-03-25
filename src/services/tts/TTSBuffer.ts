import { EmitterSubscription } from 'react-native';
import { Sentence } from './TextSegmenter';
import { SentenceTiming, buildSentenceTiming } from './TimingAccumulator';
import { synthesize, deleteTempFile, bumpEpoch, currentEpoch } from './TTSEngine';
import { SimpleAudio } from './SimpleAudio';

export interface BufferSegment {
  sentenceIndex: number;
  timing: SentenceTiming;
  audioPath: string;
}

// How many segments to keep synthesized ahead of the current playback position.
const LOOKAHEAD = 3;

export class TTSBuffer {
  private sentences: Sentence[];
  private sampleRate: number;
  private onSegmentReady: (segment: BufferSegment) => void;
  private onSegmentGenerated: (timing: SentenceTiming) => void;
  private onError: (err: Error) => void;

  private cancelled = false;
  private running = false;
  private nextGenIndex = 0;
  private cumulativeMs = 0;

  private readySegments: Array<{ index: number; timing: SentenceTiming; path: string }> = [];
  private isPlaying = false;
  private generatedPaths: string[] = [];

  // When set, the loop will skip all ready segments before this sentence index,
  // and play from here as soon as it arrives — without flushing/restarting.
  private pendingSeekIndex: number | null = null;

  // Resolved whenever a segment finishes playing (freeing a LOOKAHEAD slot)
  private loopSignal: (() => void) | null = null;

  private completionSub: EmitterSubscription | null = null;
  private errorSub: EmitterSubscription | null = null;

  constructor(
    sentences: Sentence[],
    sampleRate: number,
    onSegmentReady: (segment: BufferSegment) => void,
    onSegmentGenerated: (timing: SentenceTiming) => void,
    onError: (err: Error) => void,
  ) {
    this.sentences = sentences;
    this.sampleRate = sampleRate;
    this.onSegmentReady = onSegmentReady;
    this.onSegmentGenerated = onSegmentGenerated;
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

  // Seek to a sentence. Two fast paths, one slow path:
  //   1. Already in readySegments → drain to it and play immediately (instant).
  //   2. Within the next LOOKAHEAD sentences being generated → set pendingSeekIndex,
  //      play as soon as synthesis completes (~1 sentence synthesis time, not a full restart).
  //   Returns false only if the target is far enough back that we must flush+restart.
  seekTo(sentenceIndex: number): boolean {
    // Fast path: already synthesized and queued.
    const idx = this.readySegments.findIndex(s => s.index === sentenceIndex);
    if (idx !== -1) {
      const skipped = this.readySegments.splice(0, idx);
      skipped.forEach(s => deleteTempFile(s.path).catch(() => {}));
      this.isPlaying = false;
      SimpleAudio.stop().catch(() => {});
      this.loopSignal?.();
      this.loopSignal = null;
      this.playNextReady();
      return true;
    }

    // Semi-fast path: target is ahead of current generation position (we'll get there soon)
    // OR target is the sentence currently being synthesized in native.
    // In both cases: set pendingSeekIndex and let the loop handle it without a full restart.
    if (sentenceIndex >= this.nextGenIndex) {
      // Target is ahead — generation will reach it. Mark it as the seek target.
      // Stop audio and clear ready segments that are behind the target.
      this.pendingSeekIndex = sentenceIndex;
      this.isPlaying = false;
      SimpleAudio.stop().catch(() => {});
      // Drain and delete all ready segments before the target
      const stale = this.readySegments.splice(0);
      stale.forEach(s => deleteTempFile(s.path).catch(() => {}));
      // Unblock loop if it was waiting for a LOOKAHEAD slot
      this.loopSignal?.();
      this.loopSignal = null;
      return true;
    }

    // Target is behind current generation — must flush and restart from there.
    return false;
  }

  private handleComplete() {
    this.isPlaying = false;
    this.loopSignal?.();
    this.playNextReady();
  }

  private playNextReady() {
    if (this.isPlaying || this.cancelled) return;

    // If there's a pending seek, discard segments before the target.
    if (this.pendingSeekIndex !== null) {
      const targetIdx = this.readySegments.findIndex(s => s.index >= this.pendingSeekIndex!);
      if (targetIdx === -1) return; // target not synthesized yet — loop will call us when ready
      const skipped = this.readySegments.splice(0, targetIdx);
      skipped.forEach(s => deleteTempFile(s.path).catch(() => {}));
      this.pendingSeekIndex = null;
    }

    if (this.readySegments.length === 0) return;

    const next = this.readySegments.shift()!;
    this.isPlaying = true;

    this.onSegmentReady({ sentenceIndex: next.index, timing: next.timing, audioPath: next.path });
    SimpleAudio.play(next.path).catch((e) => {
      this.isPlaying = false;
      if (!this.cancelled) this.onError(e instanceof Error ? e : new Error(String(e)));
    });

    const upcoming = this.readySegments[0];
    if (upcoming) SimpleAudio.preWarm(upcoming.path);
  }

  private async runLoop() {
    if (this.running || this.cancelled) return;
    this.running = true;

    const epoch = currentEpoch();

    while (!this.cancelled && this.nextGenIndex < this.sentences.length) {
      if (this.readySegments.length >= LOOKAHEAD && this.pendingSeekIndex === null) {
        await new Promise<void>(resolve => { this.loopSignal = resolve; });
        this.loopSignal = null;
        continue;
      }

      const sentence = this.sentences[this.nextGenIndex];
      const startMs = this.cumulativeMs;

      try {
        const segment = await synthesize(sentence.ttsText, this.sampleRate, epoch);
        if (segment === null || this.cancelled) break;

        this.generatedPaths.push(segment.audioPath);
        const timing = buildSentenceTiming(sentence, startMs, segment.durationMs);
        this.cumulativeMs += segment.durationMs;
        this.nextGenIndex++;

        this.onSegmentGenerated(timing);

        this.readySegments.push({ index: sentence.index, timing, path: segment.audioPath });
        this.playNextReady();
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
    this.pendingSeekIndex = null;
    bumpEpoch();
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
