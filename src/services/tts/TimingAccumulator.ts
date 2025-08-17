import { Sentence } from './TextSegmenter';

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SentenceTiming {
  sentenceIndex: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  wordTimings: WordTiming[];
}

export function buildSentenceTiming(
  sentence: Sentence,
  startMs: number,
  durationMs: number,
): SentenceTiming {
  const words = sentence.text.split(/\s+/).filter(w => w.length > 0);
  const totalChars = words.reduce((s, w) => s + w.length, 0);
  const wordTimings: WordTiming[] = [];

  let cursor = startMs;
  for (const word of words) {
    const fraction = totalChars > 0 ? word.length / totalChars : 1 / words.length;
    const wordDuration = durationMs * fraction;
    wordTimings.push({ word, startMs: cursor, endMs: cursor + wordDuration });
    cursor += wordDuration;
  }

  return {
    sentenceIndex: sentence.index,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    wordTimings,
  };
}
