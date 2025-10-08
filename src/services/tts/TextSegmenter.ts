import { AutoSkipSettings } from '../../context/PlaybackContext';

export interface Sentence {
  index: number;
  text: string;     // original raw slice of rawText -- shown to user
  ttsText: string;  // auto-skip processed version -- fed to TTS engine
  charStart: number;
  charEnd: number;
}

// Abbreviations we do NOT want to split on
const ABBREV = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|[A-Z])\.\s*$/;

interface RawSentence {
  text: string;
  start: number;
  end: number;
}

/**
 * Split a single paragraph of text into sentences, tracking absolute positions
 * within the full normalized rawText (via globalStart offset).
 */
function splitParagraph(text: string, globalStart: number): RawSentence[] {
  const re = /([.!?]+)(\s+)(?=[A-Z"'])/g;
  const results: RawSentence[] = [];
  let last = 0;

  for (const match of text.matchAll(re)) {
    const punctEnd = match.index! + match[1].length;
    const candidate = text.slice(last, punctEnd).trimEnd();
    if (ABBREV.test(candidate)) continue;
    const t = candidate.trim();
    if (!t) continue;
    const localStart = text.indexOf(t, last);
    results.push({
      text: t,
      start: globalStart + localStart,
      end: globalStart + localStart + t.length,
    });
    last = punctEnd + 1;
  }

  const remainder = text.slice(last).trim();
  if (remainder) {
    const localStart = text.indexOf(remainder, last);
    results.push({
      text: remainder,
      start: globalStart + localStart,
      end: globalStart + localStart + remainder.length,
    });
  }

  return results;
}

/**
 * Split the full normalized text into sentences.
 * Paragraph breaks (2+ consecutive newlines) act as hard boundaries so
 * sentences never span across paragraphs.
 */
function splitSentences(normalized: string): RawSentence[] {
  const results: RawSentence[] = [];
  const paraBreakRe = /\n{2,}/g;
  let segStart = 0;

  for (const m of normalized.matchAll(paraBreakRe)) {
    const paraText = normalized.slice(segStart, m.index!);
    if (paraText.trim()) {
      results.push(...splitParagraph(paraText, segStart));
    }
    segStart = m.index! + m[0].length;
  }

  const remaining = normalized.slice(segStart);
  if (remaining.trim()) {
    results.push(...splitParagraph(remaining, segStart));
  }

  return results;
}

function applyAutoSkip(text: string, settings: AutoSkipSettings): string {
  let t = text;
  if (settings.citations) {
    t = t.replace(/\[\d+(?:,\s*\d+)*\]/g, '');
    t = t.replace(/\([\w\s,&.]+\d{4}[a-z]?\)/g, '');
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
  // Normalize line endings so positions in sentences match positions in TxtViewer content
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
