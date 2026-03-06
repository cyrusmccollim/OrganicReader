export interface PiperModelEntry {
  langCode: string;       // ISO 639-1, e.g. 'en', 'fr'
  detectionCode: string;  // used by LanguageDetector
  label: string;          // language label, e.g. 'English'
  voiceLabel: string;     // specific voice, e.g. 'Ryan (US)'
  voiceDirName: string;   // local storage dir + HuggingFace repo name (unique key)
  modelOnnxName: string;  // e.g. "en_US-ryan-medium.onnx"
  modelSizeBytes: number;
  sampleRate: number;
}

const HF = 'https://huggingface.co/csukuangfj';

export function onnxUrl(entry: PiperModelEntry): string {
  return `${HF}/${entry.voiceDirName}/resolve/main/${entry.modelOnnxName}`;
}

export function tokensUrl(entry: PiperModelEntry): string {
  return `${HF}/${entry.voiceDirName}/resolve/main/tokens.txt`;
}

// espeak-ng-data is shared across all voices.
// To populate: run scripts/package-espeak.sh, commit espeak-ng-data.zip to
// /OrganicReaderAssets, and enable Pages on that repo.
export const ESPEAK_ZIP_URL =
  'https://cyrusmccollim.github.io/OrganicReaderAssets/espeak-ng-data.zip';

function entry(
  langCode: string,
  detectionCode: string,
  label: string,
  voiceLabel: string,
  name: string,
  onnx: string,
  bytes: number,
  rate: number,
): PiperModelEntry {
  return {
    langCode, detectionCode, label, voiceLabel,
    voiceDirName: `vits-piper-${name}`,
    modelOnnxName: onnx,
    modelSizeBytes: bytes,
    sampleRate: rate,
  };
}

export const PIPER_MODELS: PiperModelEntry[] = [
  // ── English ──────────────────────────────────────────────────────────────
  entry('en', 'en', 'English', 'Ryan (US)',           'en_US-ryan-medium',              'en_US-ryan-medium.onnx',              64_000_000, 22050),
  entry('en', 'en', 'English', 'Lessac (US)',         'en_US-lessac-medium',            'en_US-lessac-medium.onnx',            64_000_000, 22050),
  entry('en', 'en', 'English', 'Joe (US)',             'en_US-joe-medium',               'en_US-joe-medium.onnx',               64_000_000, 22050),
  entry('en', 'en', 'English', 'Piper (US)',        'en_US-hfc_female-medium',        'en_US-hfc_female-medium.onnx',        64_000_000, 22050),
  entry('en', 'en', 'English', 'Arctic (US)',         'en_US-arctic-medium',            'en_US-arctic-medium.onnx',            63_000_000, 22050),
  entry('en', 'en', 'English', 'Alan (UK)',            'en_GB-alan-medium',              'en_GB-alan-medium.onnx',              64_000_000, 22050),
  entry('en', 'en', 'English', 'Alba (UK)',            'en_GB-alba-medium',              'en_GB-alba-medium.onnx',              64_000_000, 22050),
  entry('en', 'en', 'English', 'Jenny Dioco (UK)',    'en_GB-jenny_dioco-medium',       'en_GB-jenny_dioco-medium.onnx',       63_000_000, 22050),
  entry('en', 'en', 'English', 'Northern Male (UK)',  'en_GB-northern_english_male-medium', 'en_GB-northern_english_male-medium.onnx', 63_000_000, 22050),
  entry('en', 'en', 'English', 'Cori (UK)',           'en_GB-cori-medium',              'en_GB-cori-medium.onnx',              63_000_000, 22050),

  // ── French ───────────────────────────────────────────────────────────────
  entry('fr', 'fr', 'French', 'Siwis',      'fr_FR-siwis-medium', 'fr_FR-siwis-medium.onnx', 64_000_000, 22050),
  entry('fr', 'fr', 'French', 'UPMC',       'fr_FR-upmc-medium',  'fr_FR-upmc-medium.onnx',  64_000_000, 22050),
  entry('fr', 'fr', 'French', 'Tom',        'fr_FR-tom-medium',   'fr_FR-tom-medium.onnx',   64_000_000, 22050),
  entry('fr', 'fr', 'French', 'Miro',       'fr_FR-miro-high',    'fr_FR-miro-high.onnx',    85_000_000, 22050),
  entry('fr', 'fr', 'French', 'Gilles (FR)','fr_FR-gilles-low',   'fr_FR-gilles-low.onnx',   16_000_000, 16000),

  // ── German ───────────────────────────────────────────────────────────────
  entry('de', 'de', 'German', 'Thorsten', 'de_DE-thorsten-medium', 'de_DE-thorsten-medium.onnx', 64_000_000, 22050),
  entry('de', 'de', 'German', 'Miro',     'de_DE-miro-high',       'de_DE-miro-high.onnx',       85_000_000, 22050),
  entry('de', 'de', 'German', 'Eva (DE)',   'de_DE-eva_k-x_low',   'de_DE-eva_k-x_low.onnx',    5_000_000, 16000),
  entry('de', 'de', 'German', 'Karlsson (DE)','de_DE-karlsson-low',  'de_DE-karlsson-low.onnx',   16_000_000, 16000),
  entry('de', 'de', 'German', 'Kerstin (DE)', 'de_DE-kerstin-low',   'de_DE-kerstin-low.onnx',    16_000_000, 16000),

  // ── Spanish ──────────────────────────────────────────────────────────────
  entry('es', 'es', 'Spanish', 'Dave (ES)',     'es_ES-davefx-medium',   'es_ES-davefx-medium.onnx',   64_000_000, 22050),
  entry('es', 'es', 'Spanish', 'Sharvard (ES)', 'es_ES-sharvard-medium', 'es_ES-sharvard-medium.onnx', 64_000_000, 22050),
  entry('es', 'es', 'Spanish', 'Ald (MX)',      'es_MX-ald-medium',      'es_MX-ald-medium.onnx',      64_000_000, 22050),
  entry('es', 'es', 'Spanish', 'Carlfm (ES)',   'es_ES-carlfm-x_low',    'es_ES-carlfm-x_low.onnx',    5_000_000,  16000),

  // ── Italian ──────────────────────────────────────────────────────────────
  entry('it', 'it', 'Italian', 'Paola',        'it_IT-paola-medium', 'it_IT-paola-medium.onnx', 64_000_000, 22050),
  entry('it', 'it', 'Italian', 'Miro',         'it_IT-miro-high',    'it_IT-miro-high.onnx',    85_000_000, 22050),
  entry('it', 'it', 'Italian', 'Riccardo (IT)','it_IT-riccardo-x_low','it_IT-riccardo-x_low.onnx', 5_000_000, 16000),

  // ── Portuguese ───────────────────────────────────────────────────────────
  entry('pt', 'pt', 'Portuguese', 'Faber (BR)',    'pt_BR-faber-medium',   'pt_BR-faber-medium.onnx',   64_000_000, 22050),
  entry('pt', 'pt', 'Portuguese', 'Cadu (BR)',     'pt_BR-cadu-medium',    'pt_BR-cadu-medium.onnx',    64_000_000, 22050),
  entry('pt', 'pt', 'Portuguese', 'Tugao (PT)',    'pt_PT-tugao-medium',   'pt_PT-tugao-medium.onnx',   64_000_000, 22050),
  entry('pt', 'pt', 'Portuguese', 'Edresson (BR)','pt_BR-edresson-low',   'pt_BR-edresson-low.onnx',   16_000_000, 16000),

  // ── Russian ──────────────────────────────────────────────────────────────
  entry('ru', 'ru', 'Russian', 'Irina',  'ru_RU-irina-medium',  'ru_RU-irina-medium.onnx',  64_000_000, 22050),
  entry('ru', 'ru', 'Russian', 'Denis',  'ru_RU-denis-medium',  'ru_RU-denis-medium.onnx',  64_000_000, 22050),
  entry('ru', 'ru', 'Russian', 'Dmitri', 'ru_RU-dmitri-medium', 'ru_RU-dmitri-medium.onnx', 64_000_000, 22050),

  // ── Chinese ──────────────────────────────────────────────────────────────
  entry('zh', 'zh', 'Chinese', 'Huayan', 'zh_CN-huayan-medium', 'zh_CN-huayan-medium.onnx', 64_000_000, 22050),

  // ── Arabic ───────────────────────────────────────────────────────────────
  entry('ar', 'ar', 'Arabic', 'Kareem', 'ar_JO-kareem-medium', 'ar_JO-kareem-medium.onnx', 64_000_000, 22050),

  // ── Hindi ────────────────────────────────────────────────────────────────
  entry('hi', 'hi', 'Hindi', 'Pratham', 'hi_IN-pratham-medium', 'hi_IN-pratham-medium.onnx', 64_000_000, 22050),
  entry('hi', 'hi', 'Hindi', 'Rohan',   'hi_IN-rohan-medium',   'hi_IN-rohan-medium.onnx',   64_000_000, 22050),

  // ── Dutch ─────────────────────────────────────────────────────────────────
  entry('nl', 'nl', 'Dutch', 'MLS (NL)', 'nl_NL-mls-medium',  'nl_NL-mls-medium.onnx',  63_000_000, 22050),
  entry('nl', 'nl', 'Dutch', 'Rdh (BE)', 'nl_BE-rdh-medium',  'nl_BE-rdh-medium.onnx',  63_000_000, 22050),

  // ── Polish ────────────────────────────────────────────────────────────────
  entry('pl', 'pl', 'Polish', 'Darkman (PL)', 'pl_PL-darkman-medium', 'pl_PL-darkman-medium.onnx', 63_000_000, 22050),
  entry('pl', 'pl', 'Polish', 'Gosia (PL)',   'pl_PL-gosia-medium',   'pl_PL-gosia-medium.onnx',   63_000_000, 22050),

  // ── Ukrainian ────────────────────────────────────────────────────────────
  entry('uk', 'uk', 'Ukrainian', 'Lada (UA)',           'uk_UA-lada-x_low',            'uk_UA-lada-x_low.onnx',            5_000_000,  16000),
  entry('uk', 'uk', 'Ukrainian', 'Ukrainian TTS (UA)', 'uk_UA-ukrainian_tts-medium',  'uk_UA-ukrainian_tts-medium.onnx',  63_000_000, 22050),

  // ── Czech ─────────────────────────────────────────────────────────────────
  entry('cs', 'cs', 'Czech', 'Jirka (CZ)', 'cs_CZ-jirka-medium', 'cs_CZ-jirka-medium.onnx', 63_000_000, 22050),
  entry('cs', 'cs', 'Czech', 'Mirka (CZ)', 'cs_CZ-mirka-low',    'cs_CZ-mirka-low.onnx',    16_000_000, 16000),

  // ── Slovak ────────────────────────────────────────────────────────────────
  entry('sk', 'sk', 'Slovak', 'Lili (SK)', 'sk_SK-lili-medium', 'sk_SK-lili-medium.onnx', 63_000_000, 22050),

  // ── Romanian ─────────────────────────────────────────────────────────────
  entry('ro', 'ro', 'Romanian', 'Mihai (RO)', 'ro_RO-mihai-medium', 'ro_RO-mihai-medium.onnx', 63_000_000, 22050),

  // ── Hungarian ────────────────────────────────────────────────────────────
  entry('hu', 'hu', 'Hungarian', 'Anna (HU)',  'hu_HU-anna-medium',  'hu_HU-anna-medium.onnx',  63_000_000, 22050),
  entry('hu', 'hu', 'Hungarian', 'Berta (HU)', 'hu_HU-berta-medium', 'hu_HU-berta-medium.onnx', 63_000_000, 22050),

  // ── Finnish ──────────────────────────────────────────────────────────────
  entry('fi', 'fi', 'Finnish', 'Harri (FI)', 'fi_FI-harri-medium', 'fi_FI-harri-medium.onnx', 63_000_000, 22050),

  // ── Swedish ──────────────────────────────────────────────────────────────
  entry('sv', 'sv', 'Swedish', 'Lars (SE)', 'sv_SE-nst-medium', 'sv_SE-nst-medium.onnx', 63_000_000, 22050),

  // ── Norwegian ────────────────────────────────────────────────────────────
  entry('no', 'no', 'Norwegian', 'Talesyntese (NO)', 'no_NO-talesyntese-medium', 'no_NO-talesyntese-medium.onnx', 63_000_000, 22050),

  // ── Turkish ──────────────────────────────────────────────────────────────
  entry('tr', 'tr', 'Turkish', 'DFKI (TR)', 'tr_TR-dfki-medium', 'tr_TR-dfki-medium.onnx', 63_000_000, 22050),

  // ── Catalan ──────────────────────────────────────────────────────────────
  entry('ca', 'ca', 'Catalan', 'Pau (ES)', 'ca_ES-upc_pau-x_low', 'ca_ES-upc_pau-x_low.onnx', 5_000_000, 16000),
  entry('ca', 'ca', 'Catalan', 'Ona (ES)', 'ca_ES-upc_ona-x_low', 'ca_ES-upc_ona-x_low.onnx', 5_000_000, 16000),

  // ── Georgian ─────────────────────────────────────────────────────────────
  entry('ka', 'ka', 'Georgian', 'Natia (GE)', 'ka_GE-natia-medium', 'ka_GE-natia-medium.onnx', 63_000_000, 22050),

  // ── Vietnamese ───────────────────────────────────────────────────────────
  entry('vi', 'vi', 'Vietnamese', 'Vivos (VN)', 'vi_VN-vivos-x_low', 'vi_VN-vivos-x_low.onnx', 5_000_000, 16000),

  // ── Nepali ───────────────────────────────────────────────────────────────
  entry('ne', 'ne', 'Nepali', 'Google (NP)', 'ne_NP-google-medium', 'ne_NP-google-medium.onnx', 63_000_000, 22050),
];

export function findModel(langCode: string): PiperModelEntry {
  return PIPER_MODELS.find(m => m.langCode === langCode) ?? PIPER_MODELS[0];
}

export function getLanguageLabels(): string[] {
  return [...new Set(PIPER_MODELS.map(m => m.label))].sort();
}
