import { AutoSkipSettings } from '../../context/PlaybackContext';

export interface Sentence {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
}

// Abbreviations we do NOT want to split on
const ABBREV = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|[A-Z])\.\s*$/;

function splitSentences(raw: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace + capital letter (or end)
  const re = /([.!?]+)(\s+)(?=[A-Z"'])/g;
  const results: string[] = [];
  let last = 0;

  for (const match of raw.matchAll(re)) {
    const end = match.index! + match[0].length;
    const candidate = raw.slice(last, end - match[2].length).trimEnd();
    // Skip if ends with an abbreviation
    if (ABBREV.test(candidate)) continue;
    if (candidate.length > 0) results.push(candidate.trim());
    last = end - match[2].length + 1;
  }

  const remainder = raw.slice(last).trim();
  if (remainder.length > 0) results.push(remainder);

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
    // Short all-caps lines (likely headers)
    const trimmed = text.trim();
    if (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      return true;
    }
  }

  if (settings.footers) {
    // Page numbers: standalone digit sequences
    if (/^\d+$/.test(text.trim())) return true;
  }

  return false;
}

function splitLongSentence(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  // Split at clause boundaries: , ; :
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
  const raw = splitSentences(rawText);
  const sentences: Sentence[] = [];
  let charOffset = 0;
  let idx = 0;

  for (const rawSentence of raw) {
    const processed = applyAutoSkip(rawSentence, autoSkip);

    if (shouldSkipSentence(processed, autoSkip)) {
      charOffset += rawSentence.length + 1;
      continue;
    }

    // Split overly long sentences
    const chunks = splitLongSentence(processed, 400);
    for (const chunk of chunks) {
      // Scan forward from charOffset instead of re-searching from 0
      const idx2 = rawText.indexOf(chunk, charOffset);
      const start = idx2 >= 0 ? idx2 : charOffset;
      sentences.push({ index: idx++, text: chunk, charStart: start, charEnd: start + chunk.length });
    }

    charOffset += rawSentence.length + 1;
  }

  return sentences;
}
