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
// github.com/cyrusmccollim/OrganicReaderAssets, and enable Pages on that repo.
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
  entry('en', 'en', 'English', 'Ryan (US)',       'en_US-ryan-medium',       'en_US-ryan-medium.onnx',       64_000_000, 22050),
  entry('en', 'en', 'English', 'Lessac (US)',     'en_US-lessac-medium',     'en_US-lessac-medium.onnx',     64_000_000, 22050),
  entry('en', 'en', 'English', 'Joe (US)',         'en_US-joe-medium',        'en_US-joe-medium.onnx',        64_000_000, 22050),
  entry('en', 'en', 'English', 'HFC Female (US)', 'en_US-hfc_female-medium', 'en_US-hfc_female-medium.onnx', 64_000_000, 22050),
  entry('en', 'en', 'English', 'Alan (UK)',        'en_GB-alan-medium',       'en_GB-alan-medium.onnx',       64_000_000, 22050),
  entry('en', 'en', 'English', 'Alba (UK)',        'en_GB-alba-medium',       'en_GB-alba-medium.onnx',       64_000_000, 22050),

  // ── French ───────────────────────────────────────────────────────────────
  entry('fr', 'fr', 'French', 'Siwis', 'fr_FR-siwis-medium', 'fr_FR-siwis-medium.onnx', 64_000_000, 22050),
  entry('fr', 'fr', 'French', 'UPMC',  'fr_FR-upmc-medium',  'fr_FR-upmc-medium.onnx',  64_000_000, 22050),
  entry('fr', 'fr', 'French', 'Tom',   'fr_FR-tom-medium',   'fr_FR-tom-medium.onnx',   64_000_000, 22050),
  entry('fr', 'fr', 'French', 'Miro',  'fr_FR-miro-high',    'fr_FR-miro-high.onnx',    85_000_000, 22050),

  // ── German ───────────────────────────────────────────────────────────────
  entry('de', 'de', 'German', 'Thorsten', 'de_DE-thorsten-medium', 'de_DE-thorsten-medium.onnx', 64_000_000, 22050),
  entry('de', 'de', 'German', 'Miro',     'de_DE-miro-high',       'de_DE-miro-high.onnx',       85_000_000, 22050),

  // ── Spanish ──────────────────────────────────────────────────────────────
  entry('es', 'es', 'Spanish', 'Dave (ES)',     'es_ES-davefx-medium',   'es_ES-davefx-medium.onnx',   64_000_000, 22050),
  entry('es', 'es', 'Spanish', 'Sharvard (ES)', 'es_ES-sharvard-medium', 'es_ES-sharvard-medium.onnx', 64_000_000, 22050),
  entry('es', 'es', 'Spanish', 'Ald (MX)',      'es_MX-ald-medium',      'es_MX-ald-medium.onnx',      64_000_000, 22050),

  // ── Italian ──────────────────────────────────────────────────────────────
  entry('it', 'it', 'Italian', 'Paola', 'it_IT-paola-medium', 'it_IT-paola-medium.onnx', 64_000_000, 22050),
  entry('it', 'it', 'Italian', 'Miro',  'it_IT-miro-high',    'it_IT-miro-high.onnx',    85_000_000, 22050),

  // ── Portuguese ───────────────────────────────────────────────────────────
  entry('pt', 'pt', 'Portuguese', 'Faber (BR)', 'pt_BR-faber-medium', 'pt_BR-faber-medium.onnx', 64_000_000, 22050),
  entry('pt', 'pt', 'Portuguese', 'Cadu (BR)',  'pt_BR-cadu-medium',  'pt_BR-cadu-medium.onnx',  64_000_000, 22050),
  entry('pt', 'pt', 'Portuguese', 'Tugão (PT)', 'pt_PT-tugao-medium', 'pt_PT-tugao-medium.onnx', 64_000_000, 22050),

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
];

export function findModel(langCode: string): PiperModelEntry {
  return PIPER_MODELS.find(m => m.langCode === langCode) ?? PIPER_MODELS[0];
}
