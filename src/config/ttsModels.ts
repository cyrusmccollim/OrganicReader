export interface TTSModelEntry {
  langCode: string;       // ISO 639-1, e.g. 'en', 'fr'
  detectionCode: string;  // used by LanguageDetector
  label: string;          // language label, e.g. 'English'
  voiceLabel: string;     // specific voice, e.g. 'Ryan (US)'
  voiceDirName: string;   // local storage dir name (shared across accents for melo)
  modelOnnxName: string;  // e.g. "en_US-ryan-medium.onnx"
  modelSizeBytes: number;
  sampleRate: number;
  engine: 'piper' | 'melo';
  speakerId?: number;       // default 0
  lexiconName?: string;     // e.g. 'lexicon.txt'
  dictDirName?: string;     // e.g. 'dict' (Chinese only)
}

// Unique key for a model entry (voiceDirName alone is not unique for melo accents)
export function modelKey(entry: TTSModelEntry): string {
  return entry.speakerId ? `${entry.voiceDirName}:${entry.speakerId}` : entry.voiceDirName;
}

const HF = 'https://huggingface.co/csukuangfj';
const ASSETS = 'https://cyrusmccollim.github.io/OrganicReaderAssets';

export function onnxUrl(entry: TTSModelEntry): string {
  return `${HF}/${entry.voiceDirName}/resolve/main/${entry.modelOnnxName}`;
}

export function tokensUrl(entry: TTSModelEntry): string {
  return `${HF}/${entry.voiceDirName}/resolve/main/tokens.txt`;
}

export function meloZipUrl(entry: TTSModelEntry): string {
  return `${ASSETS}/${entry.voiceDirName}.zip`;
}

// espeak-ng-data is shared across all Piper voices.
export const ESPEAK_ZIP_URL = `${ASSETS}/espeak-ng-data.zip`;

// ── Piper helpers ────────────────────────────────────────────────────────────

function piper(
  langCode: string,
  detectionCode: string,
  label: string,
  voiceLabel: string,
  name: string,
  onnx: string,
  bytes: number,
  rate: number,
): TTSModelEntry {
  return {
    langCode, detectionCode, label, voiceLabel,
    voiceDirName: `vits-piper-${name}`,
    modelOnnxName: onnx,
    modelSizeBytes: bytes,
    sampleRate: rate,
    engine: 'piper',
  };
}

// ── MeloTTS helpers ──────────────────────────────────────────────────────────

function melo(
  langCode: string,
  detectionCode: string,
  label: string,
  voiceLabel: string,
  voiceDirName: string,
  onnx: string,
  bytes: number,
  speakerId: number,
  opts?: { dictDirName?: string },
): TTSModelEntry {
  return {
    langCode, detectionCode, label, voiceLabel,
    voiceDirName,
    modelOnnxName: onnx,
    modelSizeBytes: bytes,
    sampleRate: 44100,
    engine: 'melo',
    speakerId,
    lexiconName: 'lexicon.txt',
    dictDirName: opts?.dictDirName,
  };
}

// ── MeloTTS models (listed first — higher quality) ──────────────────────────

export const MELO_MODELS: TTSModelEntry[] = [
  // English — 5 accents, shared voiceDirName
  melo('en', 'en', 'English', 'Amanda (US)',  'melo-tts-en', 'model.onnx', 115_000_000, 0),
  melo('en', 'en', 'English', 'Elise (UK)',   'melo-tts-en', 'model.onnx', 115_000_000, 1),
  melo('en', 'en', 'English', 'Priya (IN)',   'melo-tts-en', 'model.onnx', 115_000_000, 2),
  melo('en', 'en', 'English', 'Olivia (AU)',  'melo-tts-en', 'model.onnx', 115_000_000, 3),
  melo('en', 'en', 'English', 'Luna',         'melo-tts-en', 'model.onnx', 115_000_000, 4),

  // Chinese + English
  melo('zh', 'zh', 'Chinese', 'Mei Lin', 'melo-tts-zh_en', 'model.onnx', 115_000_000, 0, { dictDirName: 'dict' }),

  // Other languages
  melo('es', 'es', 'Spanish',  'Isabella',  'melo-tts-es', 'model.onnx', 115_000_000, 0),
  melo('fr', 'fr', 'French',   'Camille',   'melo-tts-fr', 'model.onnx', 115_000_000, 0),
  melo('ja', 'ja', 'Japanese', 'Haruka',    'melo-tts-ja', 'model.onnx', 115_000_000, 0),
  melo('ko', 'ko', 'Korean',   'Yuna',      'melo-tts-ko', 'model.onnx', 115_000_000, 0),
];

// ── Piper models ─────────────────────────────────────────────────────────────

export const PIPER_MODELS: TTSModelEntry[] = [
  // ── English ──────────────────────────────────────────────────────────────
  piper('en', 'en', 'English', 'Ryan (US)',           'en_US-ryan-medium',              'en_US-ryan-medium.onnx',              64_000_000, 22050),
  piper('en', 'en', 'English', 'Lessac (US)',         'en_US-lessac-medium',            'en_US-lessac-medium.onnx',            64_000_000, 22050),
  piper('en', 'en', 'English', 'Joe (US)',             'en_US-joe-medium',               'en_US-joe-medium.onnx',               64_000_000, 22050),
  piper('en', 'en', 'English', 'Clara (US)',          'en_US-hfc_female-medium',        'en_US-hfc_female-medium.onnx',        64_000_000, 22050),
  piper('en', 'en', 'English', 'James (US)',          'en_US-arctic-medium',            'en_US-arctic-medium.onnx',            63_000_000, 22050),
  piper('en', 'en', 'English', 'Alan (UK)',            'en_GB-alan-medium',              'en_GB-alan-medium.onnx',              64_000_000, 22050),
  piper('en', 'en', 'English', 'Alba (UK)',            'en_GB-alba-medium',              'en_GB-alba-medium.onnx',              64_000_000, 22050),
  piper('en', 'en', 'English', 'Jenny Dioco (UK)',    'en_GB-jenny_dioco-medium',       'en_GB-jenny_dioco-medium.onnx',       63_000_000, 22050),
  piper('en', 'en', 'English', 'Owen (UK)',           'en_GB-northern_english_male-medium', 'en_GB-northern_english_male-medium.onnx', 63_000_000, 22050),
  piper('en', 'en', 'English', 'Cori (UK)',           'en_GB-cori-medium',              'en_GB-cori-medium.onnx',              63_000_000, 22050),

  // ── French ───────────────────────────────────────────────────────────────
  piper('fr', 'fr', 'French', 'Sophie',     'fr_FR-siwis-medium', 'fr_FR-siwis-medium.onnx', 64_000_000, 22050),
  piper('fr', 'fr', 'French', 'Laurent',    'fr_FR-upmc-medium',  'fr_FR-upmc-medium.onnx',  64_000_000, 22050),
  piper('fr', 'fr', 'French', 'Tom',        'fr_FR-tom-medium',   'fr_FR-tom-medium.onnx',   64_000_000, 22050),
  piper('fr', 'fr', 'French', 'Miro',       'fr_FR-miro-high',    'fr_FR-miro-high.onnx',    85_000_000, 22050),
  piper('fr', 'fr', 'French', 'Gilles (FR)','fr_FR-gilles-low',   'fr_FR-gilles-low.onnx',   16_000_000, 16000),

  // ── German ───────────────────────────────────────────────────────────────
  piper('de', 'de', 'German', 'Thorsten', 'de_DE-thorsten-medium', 'de_DE-thorsten-medium.onnx', 64_000_000, 22050),
  piper('de', 'de', 'German', 'Miro',     'de_DE-miro-high',       'de_DE-miro-high.onnx',       85_000_000, 22050),
  piper('de', 'de', 'German', 'Eva (DE)',   'de_DE-eva_k-x_low',   'de_DE-eva_k-x_low.onnx',    5_000_000, 16000),
  piper('de', 'de', 'German', 'Karlsson (DE)','de_DE-karlsson-low',  'de_DE-karlsson-low.onnx',   16_000_000, 16000),
  piper('de', 'de', 'German', 'Kerstin (DE)', 'de_DE-kerstin-low',   'de_DE-kerstin-low.onnx',    16_000_000, 16000),

  // ── Spanish ──────────────────────────────────────────────────────────────
  piper('es', 'es', 'Spanish', 'Dave (ES)',     'es_ES-davefx-medium',   'es_ES-davefx-medium.onnx',   64_000_000, 22050),
  piper('es', 'es', 'Spanish', 'Sharvard (ES)', 'es_ES-sharvard-medium', 'es_ES-sharvard-medium.onnx', 64_000_000, 22050),
  piper('es', 'es', 'Spanish', 'Alejandro (MX)','es_MX-ald-medium',      'es_MX-ald-medium.onnx',      64_000_000, 22050),
  piper('es', 'es', 'Spanish', 'Carlos (ES)',   'es_ES-carlfm-x_low',    'es_ES-carlfm-x_low.onnx',    5_000_000,  16000),

  // ── Italian ──────────────────────────────────────────────────────────────
  piper('it', 'it', 'Italian', 'Paola',        'it_IT-paola-medium', 'it_IT-paola-medium.onnx', 64_000_000, 22050),
  piper('it', 'it', 'Italian', 'Miro',         'it_IT-miro-high',    'it_IT-miro-high.onnx',    85_000_000, 22050),
  piper('it', 'it', 'Italian', 'Riccardo (IT)','it_IT-riccardo-x_low','it_IT-riccardo-x_low.onnx', 5_000_000, 16000),

  // ── Portuguese ───────────────────────────────────────────────────────────
  piper('pt', 'pt', 'Portuguese', 'Faber (BR)',    'pt_BR-faber-medium',   'pt_BR-faber-medium.onnx',   64_000_000, 22050),
  piper('pt', 'pt', 'Portuguese', 'Cadu (BR)',     'pt_BR-cadu-medium',    'pt_BR-cadu-medium.onnx',    64_000_000, 22050),
  piper('pt', 'pt', 'Portuguese', 'Tugao (PT)',    'pt_PT-tugao-medium',   'pt_PT-tugao-medium.onnx',   64_000_000, 22050),
  piper('pt', 'pt', 'Portuguese', 'Edresson (BR)','pt_BR-edresson-low',   'pt_BR-edresson-low.onnx',   16_000_000, 16000),

  // ── Russian ──────────────────────────────────────────────────────────────
  piper('ru', 'ru', 'Russian', 'Irina',  'ru_RU-irina-medium',  'ru_RU-irina-medium.onnx',  64_000_000, 22050),
  piper('ru', 'ru', 'Russian', 'Denis',  'ru_RU-denis-medium',  'ru_RU-denis-medium.onnx',  64_000_000, 22050),
  piper('ru', 'ru', 'Russian', 'Dmitri', 'ru_RU-dmitri-medium', 'ru_RU-dmitri-medium.onnx', 64_000_000, 22050),

  // ── Chinese ──────────────────────────────────────────────────────────────
  piper('zh', 'zh', 'Chinese', 'Huayan', 'zh_CN-huayan-medium', 'zh_CN-huayan-medium.onnx', 64_000_000, 22050),

  // ── Arabic ───────────────────────────────────────────────────────────────
  piper('ar', 'ar', 'Arabic', 'Kareem', 'ar_JO-kareem-medium', 'ar_JO-kareem-medium.onnx', 64_000_000, 22050),

  // ── Hindi ────────────────────────────────────────────────────────────────
  piper('hi', 'hi', 'Hindi', 'Pratham', 'hi_IN-pratham-medium', 'hi_IN-pratham-medium.onnx', 64_000_000, 22050),
  piper('hi', 'hi', 'Hindi', 'Rohan',   'hi_IN-rohan-medium',   'hi_IN-rohan-medium.onnx',   64_000_000, 22050),

  // ── Dutch ─────────────────────────────────────────────────────────────────
  piper('nl', 'nl', 'Dutch', 'Femke (NL)', 'nl_NL-mls-medium',  'nl_NL-mls-medium.onnx',  63_000_000, 22050),
  piper('nl', 'nl', 'Dutch', 'Lotte (BE)', 'nl_BE-rdh-medium',  'nl_BE-rdh-medium.onnx',  63_000_000, 22050),

  // ── Polish ────────────────────────────────────────────────────────────────
  piper('pl', 'pl', 'Polish', 'Marek (PL)',   'pl_PL-darkman-medium', 'pl_PL-darkman-medium.onnx', 63_000_000, 22050),
  piper('pl', 'pl', 'Polish', 'Gosia (PL)',   'pl_PL-gosia-medium',   'pl_PL-gosia-medium.onnx',   63_000_000, 22050),

  // ── Ukrainian ────────────────────────────────────────────────────────────
  piper('uk', 'uk', 'Ukrainian', 'Lada (UA)',           'uk_UA-lada-x_low',            'uk_UA-lada-x_low.onnx',            5_000_000,  16000),
  piper('uk', 'uk', 'Ukrainian', 'Olena (UA)',         'uk_UA-ukrainian_tts-medium',  'uk_UA-ukrainian_tts-medium.onnx',  63_000_000, 22050),

  // ── Czech ─────────────────────────────────────────────────────────────────
  piper('cs', 'cs', 'Czech', 'Jirka (CZ)', 'cs_CZ-jirka-medium', 'cs_CZ-jirka-medium.onnx', 63_000_000, 22050),
  piper('cs', 'cs', 'Czech', 'Mirka (CZ)', 'cs_CZ-mirka-low',    'cs_CZ-mirka-low.onnx',    16_000_000, 16000),

  // ── Slovak ────────────────────────────────────────────────────────────────
  piper('sk', 'sk', 'Slovak', 'Lili (SK)', 'sk_SK-lili-medium', 'sk_SK-lili-medium.onnx', 63_000_000, 22050),

  // ── Romanian ─────────────────────────────────────────────────────────────
  piper('ro', 'ro', 'Romanian', 'Mihai (RO)', 'ro_RO-mihai-medium', 'ro_RO-mihai-medium.onnx', 63_000_000, 22050),

  // ── Hungarian ────────────────────────────────────────────────────────────
  piper('hu', 'hu', 'Hungarian', 'Anna (HU)',  'hu_HU-anna-medium',  'hu_HU-anna-medium.onnx',  63_000_000, 22050),
  piper('hu', 'hu', 'Hungarian', 'Berta (HU)', 'hu_HU-berta-medium', 'hu_HU-berta-medium.onnx', 63_000_000, 22050),

  // ── Finnish ──────────────────────────────────────────────────────────────
  piper('fi', 'fi', 'Finnish', 'Harri (FI)', 'fi_FI-harri-medium', 'fi_FI-harri-medium.onnx', 63_000_000, 22050),

  // ── Swedish ──────────────────────────────────────────────────────────────
  piper('sv', 'sv', 'Swedish', 'Lars (SE)', 'sv_SE-nst-medium', 'sv_SE-nst-medium.onnx', 63_000_000, 22050),

  // ── Norwegian ────────────────────────────────────────────────────────────
  piper('no', 'no', 'Norwegian', 'Erik (NO)',        'no_NO-talesyntese-medium', 'no_NO-talesyntese-medium.onnx', 63_000_000, 22050),

  // ── Turkish ──────────────────────────────────────────────────────────────
  piper('tr', 'tr', 'Turkish', 'Emre (TR)', 'tr_TR-dfki-medium', 'tr_TR-dfki-medium.onnx', 63_000_000, 22050),

  // ── Catalan ──────────────────────────────────────────────────────────────
  piper('ca', 'ca', 'Catalan', 'Pau (ES)', 'ca_ES-upc_pau-x_low', 'ca_ES-upc_pau-x_low.onnx', 5_000_000, 16000),
  piper('ca', 'ca', 'Catalan', 'Ona (ES)', 'ca_ES-upc_ona-x_low', 'ca_ES-upc_ona-x_low.onnx', 5_000_000, 16000),

  // ── Georgian ─────────────────────────────────────────────────────────────
  piper('ka', 'ka', 'Georgian', 'Natia (GE)', 'ka_GE-natia-medium', 'ka_GE-natia-medium.onnx', 63_000_000, 22050),

  // ── Vietnamese ───────────────────────────────────────────────────────────
  piper('vi', 'vi', 'Vietnamese', 'Linh (VN)',  'vi_VN-vivos-x_low', 'vi_VN-vivos-x_low.onnx', 5_000_000, 16000),

  // ── Japanese ─────────────────────────────────────────────────────────────
  // (no Piper Japanese voices)

  // ── Korean ───────────────────────────────────────────────────────────────
  // (no Piper Korean voices)

  // ── Nepali ───────────────────────────────────────────────────────────────
  piper('ne', 'ne', 'Nepali', 'Sita (NP)',   'ne_NP-google-medium', 'ne_NP-google-medium.onnx', 63_000_000, 22050),
];

// Combined list — MeloTTS first (higher quality)
export const ALL_MODELS: TTSModelEntry[] = [...MELO_MODELS, ...PIPER_MODELS];

// Auto-detection only picks Piper voices (no surprise downloads).
// MeloTTS is only used when the user explicitly selects it.
export function findModel(langCode: string): TTSModelEntry {
  return PIPER_MODELS.find(m => m.langCode === langCode) ?? PIPER_MODELS[0];
}

export function getLanguageLabels(): string[] {
  return [...new Set(ALL_MODELS.map(m => m.label))].sort();
}
