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

/** Estimate syllable count for a Latin-script word. Non-Latin falls back to char count. */
function estimateSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) {
    // Non-Latin or pure punctuation: use character count as proxy
    const chars = word.replace(/\s/g, '');
    return Math.max(1, chars.length);
  }
  const groups = clean.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (clean.endsWith('e') && count > 1) count--;
  return Math.max(1, count);
}

export function buildSentenceTiming(
  sentence: Sentence,
  startMs: number,
  durationMs: number,
): SentenceTiming {
  const words = sentence.ttsText.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.map(estimateSyllables);
  const totalSyllables = syllables.reduce((s, n) => s + n, 0);
  const wordTimings: WordTiming[] = [];

  let cursor = startMs;
  for (let i = 0; i < words.length; i++) {
    const fraction = totalSyllables > 0 ? syllables[i] / totalSyllables : 1 / words.length;
    const wordDuration = durationMs * fraction;
    wordTimings.push({ word: words[i], startMs: cursor, endMs: cursor + wordDuration });
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
