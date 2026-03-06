export interface PiperModelEntry {
  langCode: string;
  detectionCode: string;
  label: string;
  zipUrl: string;         // URL to .zip archive (run scripts/package-tts-models.sh to create)
  voiceDirName: string;   // inner directory name inside the zip
  modelOnnxName: string;  // e.g. "en_US-ryan-medium.onnx"
  modelSizeBytes: number;
  sampleRate: number;
}

// TODO: Run scripts/package-tts-models.sh then upload the .zip files to your CDN.
//       Replace BASE with your actual hosting URL.
const BASE = 'https://YOUR_CDN_URL/tts-models';

export const PIPER_MODELS: PiperModelEntry[] = [
  {
    langCode: 'en',
    detectionCode: 'en',
    label: 'English (US)',
    zipUrl: `${BASE}/vits-piper-en_US-ryan-medium.zip`,
    voiceDirName: 'vits-piper-en_US-ryan-medium',
    modelOnnxName: 'en_US-ryan-medium.onnx',
    modelSizeBytes: 64_000_000,
    sampleRate: 22050,
  },
  {
    langCode: 'fr',
    detectionCode: 'fr',
    label: 'French',
    zipUrl: `${BASE}/vits-piper-fr_FR-mls-medium.zip`,
    voiceDirName: 'vits-piper-fr_FR-mls-medium',
    modelOnnxName: 'fr_FR-mls-medium.onnx',
    modelSizeBytes: 63_000_000,
    sampleRate: 22050,
  },
  {
    langCode: 'de',
    detectionCode: 'de',
    label: 'German',
    zipUrl: `${BASE}/vits-piper-de_DE-thorsten-high.zip`,
    voiceDirName: 'vits-piper-de_DE-thorsten-high',
    modelOnnxName: 'de_DE-thorsten-high.onnx',
    modelSizeBytes: 85_000_000,
    sampleRate: 22050,
  },
  {
    langCode: 'es',
    detectionCode: 'es',
    label: 'Spanish',
    zipUrl: `${BASE}/vits-piper-es_ES-mls_9972-low.zip`,
    voiceDirName: 'vits-piper-es_ES-mls_9972-low',
    modelOnnxName: 'es_ES-mls_9972-low.onnx',
    modelSizeBytes: 29_000_000,
    sampleRate: 16000,
  },
  {
    langCode: 'it',
    detectionCode: 'it',
    label: 'Italian',
    zipUrl: `${BASE}/vits-piper-it_IT-riccardo-x_low.zip`,
    voiceDirName: 'vits-piper-it_IT-riccardo-x_low',
    modelOnnxName: 'it_IT-riccardo-x_low.onnx',
    modelSizeBytes: 29_000_000,
    sampleRate: 16000,
  },
  {
    langCode: 'pt',
    detectionCode: 'pt',
    label: 'Portuguese',
    zipUrl: `${BASE}/vits-piper-pt_BR-faber-medium.zip`,
    voiceDirName: 'vits-piper-pt_BR-faber-medium',
    modelOnnxName: 'pt_BR-faber-medium.onnx',
    modelSizeBytes: 63_000_000,
    sampleRate: 22050,
  },
  {
    langCode: 'ru',
    detectionCode: 'ru',
    label: 'Russian',
    zipUrl: `${BASE}/vits-piper-ru_RU-irinia-medium.zip`,
    voiceDirName: 'vits-piper-ru_RU-irinia-medium',
    modelOnnxName: 'ru_RU-irinia-medium.onnx',
    modelSizeBytes: 63_000_000,
    sampleRate: 22050,
  },
  {
    langCode: 'zh',
    detectionCode: 'zh',
    label: 'Chinese',
    zipUrl: `${BASE}/vits-piper-zh_CN-huayan-medium.zip`,
    voiceDirName: 'vits-piper-zh_CN-huayan-medium',
    modelOnnxName: 'zh_CN-huayan-medium.onnx',
    modelSizeBytes: 63_000_000,
    sampleRate: 22050,
  },
];

export function findModel(langCode: string): PiperModelEntry {
  return PIPER_MODELS.find(m => m.langCode === langCode) ?? PIPER_MODELS[0];
}
