import { AutoSkipSettings } from '../../context/PlaybackContext';

export interface Sentence {
  index: number;
  text: string;     // original raw slice of rawText — shown to user
  ttsText: string;  // auto-skip processed version — fed to TTS engine
  charStart: number;
  charEnd: number;
}

interface RawSentence {
  text: string;
  start: number;
  end: number;
}

// Abbreviations we do NOT want to split on
const ABBREV = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|[A-Z])\.\s*$/;

function splitSentences(raw: string): RawSentence[] {
  // Split on sentence-ending punctuation followed by whitespace + capital letter (or end)
  const re = /([.!?]+)(\s+)(?=[A-Z"'])/g;
  const results: RawSentence[] = [];
  let last = 0;

  for (const match of raw.matchAll(re)) {
    const punctEnd = match.index! + match[1].length; // end of punctuation, before whitespace
    const candidate = raw.slice(last, punctEnd).trimEnd();
    if (ABBREV.test(candidate)) continue;
    const text = candidate.trim();
    if (text.length === 0) continue;

    const start = raw.indexOf(text, last);
    results.push({ text, start, end: start + text.length });
    last = punctEnd + 1; // advance past punctuation + 1 whitespace char
  }

  const remainder = raw.slice(last).trim();
  if (remainder.length > 0) {
    const start = raw.indexOf(remainder, last);
    results.push({ text: remainder, start, end: start + remainder.length });
  }

  return results;
}

function applyAutoSkip(text: string, settings: AutoSkipSettings): string {
  let t = text;
  if (settings.citations) {
    t = t.replace(/\[\d+(?:,\s*\d+)*\]/g, '');          // [1], [1,2]
    t = t.replace(/\([\w\s,&.]+\d{4}[a-z]?\)/g, '');    // (Author 2023)
  }
  if (settings.urls) {
    t = t.replace(/https?:\/\/\S+/g, '');
    t = t.replace(/www\.\S+/g, '');
  }
  if (settings.parentheses) {
    t = t.replace(/\([^)]{0,200}\)/g, '');
  }
  if (settings.brackets) {
    t = t.replace(/\[[^\]]{0,200}\]/g, '');
  }
  if (settings.braces) {
    t = t.replace(/\{[^}]{0,200}\}/g, '');
  }
  return t.replace(/\s{2,}/g, ' ').trim();
}

function shouldSkipSentence(text: string, settings: AutoSkipSettings): boolean {
  if (text.length < 3) return true;

  if (settings.headers) {
    const trimmed = text.trim();
    if (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      return true;
    }
  }

  if (settings.footers) {
    if (/^\d+$/.test(text.trim())) return true;
  }

  return false;
}

function splitLongSentence(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const re = /([,;:])(\s+)/g;
  const parts: string[] = [];
  let last = 0;
  for (const match of text.matchAll(re)) {
    const end = match.index! + match[0].length;
    const chunk = text.slice(last, end).trim();
    if (chunk.length > 0) parts.push(chunk);
    last = end;
  }
  const remainder = text.slice(last).trim();
  if (remainder.length > 0) parts.push(remainder);
  return parts.length > 1 ? parts : [text];
}

export function segmentText(rawText: string, autoSkip: AutoSkipSettings): Sentence[] {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const raw = splitSentences(normalized);
  const sentences: Sentence[] = [];
  let idx = 0;

  for (const { text: rawSentence, start: rawStart, end: rawEnd } of raw) {
    const ttsText = applyAutoSkip(rawSentence, autoSkip);

    if (shouldSkipSentence(ttsText, autoSkip)) continue;

    const chunks = splitLongSentence(ttsText, 400);

    if (chunks.length === 1) {
      sentences.push({
        index: idx++,
        text: normalized.slice(rawStart, rawEnd),
        ttsText: chunks[0],
        charStart: rawStart,
        charEnd: rawEnd,
      });
    } else {
      // Distribute raw display range proportionally across TTS chunks
      let chunkCharStart = rawStart;
      for (let ci = 0; ci < chunks.length; ci++) {
        const proportion = chunks[ci].length / ttsText.length;
        const charLen = Math.round((rawEnd - rawStart) * proportion);
        const chunkCharEnd = ci === chunks.length - 1
          ? rawEnd
          : Math.min(chunkCharStart + charLen, rawEnd);
        sentences.push({
          index: idx++,
          text: normalized.slice(chunkCharStart, chunkCharEnd),
          ttsText: chunks[ci],
          charStart: chunkCharStart,
          charEnd: chunkCharEnd,
        });
        chunkCharStart = chunkCharEnd;
      }
    }
  }

  return sentences;
}
