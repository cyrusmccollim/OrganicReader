const CYRILLIC = /[\u0400-\u04FF]/;
const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const HIRAGANA_KATAKANA = /[\u3040-\u30FF]/;
const HANGUL = /[\uAC00-\uD7AF\u1100-\u11FF]/;
const GEORGIAN = /[\u10D0-\u10FF]/;
const THAI = /[\u0E00-\u0E7F]/;

// Ukrainian-specific Cyrillic characters not used in Russian
// і (U+0456), ї (U+0457), є (U+0454), ґ (U+0491)
const UKRAINIAN_MARKERS = /[\u0456\u0457\u0454\u0491]/;

// Common function words per language - we check the most frequent ones
const FR_WORDS = /\b(le|la|les|de|du|un|une|des|et|est|en|qui|que|pour|dans|sur|au|ou|ne|pas|je|tu|il|nous|vous|ils)\b/gi;
const DE_WORDS = /\b(der|die|das|und|ist|in|von|zu|mit|auf|für|den|dem|ein|eine|ich|sie|er|wir|auch|an|sich|wird)\b/gi;
const ES_WORDS = /\b(los|las|del|una|que|para|con|por|como|pero|más|también|muy|este|esta|cuando|porque|donde|entre|desde|hasta|sobre|después|antes|tiene|están|hacer|puede)\b/gi;
const IT_WORDS = /\b(del|della|delle|degli|che|per|con|sono|come|questo|questa|dopo|quando|perché|anche|molto|fare|può|hanno|della|essere|aveva|tutto)\b/gi;
// Avoid short words shared with English (o, a, as, de, etc.) — use more distinctive PT words
const PT_WORDS = /\b(uma|para|com|por|sua|como|mas|não|este|esta|isso|mais|tem|são|ele|ela|nos|você|muito|depois|quando|porque|também|ainda|já)\b/gi;
// Distinctively Dutch words that don't heavily overlap with English/German
const NL_WORDS = /\b(zijn|hebben|worden|kunnen|mogen|moeten|zij|hun|hen|jullie|mensen|dag|week|jaar|maar|ook|heel|gewoon|eigenlijk|misschien|heb|heeft|had|waren|wordt)\b/gi;
const PL_WORDS = /\b(jest|nie|tak|jak|ale|dla|przez|między|przed|które|który|która|tego|przy|jego|jej|ich|oraz|jako|więcej|może|czy|się|co|na|po|ze|do)\b/gi;
const TR_WORDS = /\b(bir|bu|için|ile|var|olan|olarak|daha|çok|gibi|kadar|sonra|çünkü|ancak|değil|ama|veya|her|biz|onlar|ben|sen|o|benden|senden)\b/gi;
const SV_WORDS = /\b(och|att|det|som|för|med|den|till|är|av|på|om|inte|men|man|kan|vara|han|hon|vi|de|sig|efter|hade|har|ett|ska|vill)\b/gi;
const FI_WORDS = /\b(on|ei|se|hän|ne|tämä|nämä|joka|jotka|olla|myös|kun|että|mutta|kuin|niin|vain|sitten|sekä|vielä|olen|olet|oli|meidän|sinä|minä)\b/gi;
const NO_WORDS = /\b(og|det|er|for|med|den|til|av|på|om|ikke|men|man|kan|som|han|hun|vi|de|seg|etter|da|når|alle|jeg|du|vi|har|var|ville)\b/gi;
const CS_WORDS = /\b(je|na|se|to|ve|ale|pro|jak|jsou|být|být|jeho|její|jejich|také|který|která|které|nebo|jako|než|více|při|do|ze|za)\b/gi;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 2000);

  if (GEORGIAN.test(sample)) return 'ka';
  if (THAI.test(sample)) return 'th';

  if (CYRILLIC.test(sample)) {
    // Check for Ukrainian-specific characters before defaulting to Russian
    if (UKRAINIAN_MARKERS.test(sample)) return 'uk';
    return 'ru';
  }

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
    pl: countMatches(sample, PL_WORDS),
    tr: countMatches(sample, TR_WORDS),
    sv: countMatches(sample, SV_WORDS),
    fi: countMatches(sample, FI_WORDS),
    no: countMatches(sample, NO_WORDS),
    cs: countMatches(sample, CS_WORDS),
  };

  const best = Object.entries(scores).reduce(
    (acc, [lang, score]) => (score > acc[1] ? [lang, score] : acc),
    ['en', 0] as [string, number],
  );

  // Only override English if there's a meaningful signal
  if (best[1] >= 5) return best[0];
  return 'en';
}
