import TrackPlayer from 'react-native-track-player';
import { Sentence } from './TextSegmenter';
import { SentenceTiming, buildSentenceTiming } from './TimingAccumulator';
import { synthesize, deleteTempFile } from './TTSEngine';

export interface BufferSegment {
  sentenceIndex: number;
  timing: SentenceTiming;
  audioPath: string;
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
  private generatedPaths: string[] = [];

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
    this.runLoop();
  }

  onSegmentConsumed() {
    if (!this.cancelled && !this.running) this.runLoop();
  }

  private async runLoop() {
    if (this.running || this.cancelled) return;
    this.running = true;

    while (!this.cancelled && this.nextGenIndex < this.sentences.length) {
      const sentence = this.sentences[this.nextGenIndex];
      const startMs = this.cumulativeMs;

      try {
        const segment = await synthesize(sentence.text, this.sampleRate);
        if (this.cancelled) {
          await deleteTempFile(segment.audioPath);
          break;
        }

        this.generatedPaths.push(segment.audioPath);
        const timing = buildSentenceTiming(sentence, startMs, segment.durationMs);
        this.cumulativeMs += segment.durationMs;
        this.nextGenIndex++;

        await TrackPlayer.add({
          id: `seg_${sentence.index}`,
          url: `file://${segment.audioPath}`,
          title: `Sentence ${sentence.index}`,
          artist: 'TTS',
          duration: segment.durationMs / 1000,
        });

        this.onSegmentReady({ sentenceIndex: sentence.index, timing, audioPath: segment.audioPath });
      } catch (err) {
        if (!this.cancelled) {
          this.onError(err instanceof Error ? err : new Error(String(err)));
        }
        break;
      }
    }

    this.running = false;
  }

  flush() {
    this.cancelled = true;
    this.running = false;
    const paths = [...this.generatedPaths];
    this.generatedPaths = [];
    this.nextGenIndex = 0;
    this.cumulativeMs = 0;
    paths.forEach(p => deleteTempFile(p).catch(() => {}));
  }

  destroy() {
    this.flush();
  }
}
