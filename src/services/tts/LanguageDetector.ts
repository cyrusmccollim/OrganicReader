const CYRILLIC = /[\u0400-\u04FF]/;
const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const HIRAGANA_KATAKANA = /[\u3040-\u30FF]/;
const HANGUL = /[\uAC00-\uD7AF\u1100-\u11FF]/;

// Common function words per language - we check the most frequent ones
const FR_WORDS = /\b(le|la|les|de|du|un|une|des|et|est|en|qui|que|pour|dans|sur|au|ou|ne|pas|je|tu|il|nous|vous|ils)\b/gi;
const DE_WORDS = /\b(der|die|das|und|ist|in|von|zu|mit|auf|für|den|dem|ein|eine|ich|sie|er|wir|auch|an|sich|wird)\b/gi;
const ES_WORDS = /\b(los|las|del|una|que|para|con|por|como|pero|más|también|muy|este|esta|cuando|porque|donde|entre|desde|hasta|sobre|después|antes|tiene|están|hacer|puede)\b/gi;
const IT_WORDS = /\b(del|della|delle|degli|che|per|con|sono|come|questo|questa|dopo|quando|perché|anche|molto|fare|può|hanno|della|essere|aveva|tutto)\b/gi;
// Avoid short words shared with English (o, a, as, de, etc.) — use more distinctive PT words
const PT_WORDS = /\b(uma|para|com|por|sua|como|mas|não|este|esta|isso|mais|tem|são|ele|ela|nos|você|muito|depois|quando|porque|também|ainda|já)\b/gi;
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
