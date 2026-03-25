import { Sentence } from './TextSegmenter';

export interface SentenceTiming {
  sentenceIndex: number;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export function buildSentenceTiming(
  sentence: Sentence,
  startMs: number,
  durationMs: number,
): SentenceTiming {
  return {
    sentenceIndex: sentence.index,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
  };
}
