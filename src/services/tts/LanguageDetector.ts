const CYRILLIC = /[\u0400-\u04FF]/;
const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const HIRAGANA_KATAKANA = /[\u3040-\u30FF]/;
const HANGUL = /[\uAC00-\uD7AF\u1100-\u11FF]/;

// Common function words per language - we check the most frequent ones
const FR_WORDS = /\b(le|la|les|de|du|un|une|des|et|est|en|qui|que|pour|dans|sur|au|ou|ne|pas|je|tu|il|nous|vous|ils)\b/gi;
const DE_WORDS = /\b(der|die|das|und|ist|in|von|zu|mit|auf|für|den|dem|ein|eine|ich|sie|er|wir|auch|an|sich|wird)\b/gi;
const ES_WORDS = /\b(el|la|los|las|de|del|un|una|y|es|en|que|se|para|con|por|su|lo|al|como|pero|más|no)\b/gi;
const IT_WORDS = /\b(il|la|le|di|del|un|una|e|è|in|che|per|con|si|ho|sono|ma|non|se|da|al|una|lo|gli)\b/gi;
const PT_WORDS = /\b(o|a|os|as|de|do|da|um|uma|e|é|em|que|se|para|com|por|sua|ao|como|mas|não)\b/gi;
const NL_WORDS = /\b(de|het|een|van|in|is|en|op|te|dat|die|zijn|voor|aan|met|als|ook|bij|kan|wordt|ze)\b/gi;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 2000);

  if (CYRILLIC.test(sample)) return 'ru';
  if (ARABIC.test(sample)) return 'ar';
  if (HIRAGANA_KATAKANA.test(sample)) return 'ja';
  if (HANGUL.test(sample)) return 'ko';
  if (CJK.test(sample)) return 'zh';

  // Latin-based language scoring
  const scores: Record<string, number> = {
    fr: countMatches(sample, FR_WORDS),
    de: countMatches(sample, DE_WORDS),
    es: countMatches(sample, ES_WORDS),
    it: countMatches(sample, IT_WORDS),
    pt: countMatches(sample, PT_WORDS),
    nl: countMatches(sample, NL_WORDS),
  };

  const best = Object.entries(scores).reduce(
    (acc, [lang, score]) => (score > acc[1] ? [lang, score] : acc),
    ['en', 0] as [string, number],
  );

  // Only override English if there's a meaningful signal
  if (best[1] >= 5) return best[0];
  return 'en';
}
