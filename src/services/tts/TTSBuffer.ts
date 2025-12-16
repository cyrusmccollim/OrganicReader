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

// Keep 5 segments ahead — enough buffer that the TTS engine is never idle
// waiting for playback to finish before generating the next sentence.
const LOOKAHEAD = 5;

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

  // Seek to an already-synthesized sentence without re-synthesis.
  // Returns true if the sentence was found in the ready queue (fast path),
  // false if the caller must flush and restart synthesis.
  seekTo(sentenceIndex: number): boolean {
    const idx = this.readySegments.findIndex(s => s.index === sentenceIndex);
    if (idx === -1) return false;

    // Delete files for skipped segments.
    const skipped = this.readySegments.splice(0, idx);
    skipped.forEach(s => deleteTempFile(s.path).catch(() => {}));

    // Stop current audio (does not fire AudioPlaybackComplete).
    this.isPlaying = false;
    SimpleAudio.stop().catch(() => {});

    // Unblock the generation loop if it was waiting for a free slot.
    this.loopSignal?.();
    this.loopSignal = null;

    this.playNextReady();
    return true;
  }

  private handleComplete() {
    this.isPlaying = false;
    // Signal the generation loop that a slot is free
    this.loopSignal?.();
    this.playNextReady();
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

    // Pre-warm the player for the NEXT segment while the current one is playing.
    const upcoming = this.readySegments[0];
    if (upcoming) {
      SimpleAudio.preWarm(upcoming.path);
    }
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

        // Notify TTSContext of the timing as soon as it's generated — this lets
        // jumpSeconds find forward-buffered sentences without waiting for them to play.
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
