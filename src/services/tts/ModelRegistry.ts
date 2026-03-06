import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import { PIPER_MODELS, PiperModelEntry, onnxUrl, tokensUrl, ESPEAK_ZIP_URL } from '../../config/ttsModels';

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/tts-models`;
const ESPEAK_DIR = `${MODELS_DIR}/espeak-ng-data`;
const ESPEAK_MARKER = `${MODELS_DIR}/.espeak-installed`;

export interface ActiveModel {
  entry: PiperModelEntry;
  modelPath: string;
  tokensPath: string;
  dataDirPath: string;
}

async function ensureDir(path: string) {
  if (!await RNFS.exists(path)) await RNFS.mkdir(path);
}

async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const result = await new Promise<{ statusCode: number }>((resolve, reject) => {
    const { jobId, promise } = RNFS.downloadFile({
      fromUrl: url,
      toFile: dest,
      background: true,
      progressInterval: 500,
      progress: (res) => {
        if (res.contentLength > 0) onProgress?.(res.bytesWritten / res.contentLength);
      },
    });
    promise.then(resolve).catch(reject);
    void jobId;
  });
  if (result.statusCode < 200 || result.statusCode >= 300) {
    await RNFS.unlink(dest).catch(() => {});
    throw new Error(`HTTP ${result.statusCode} fetching ${url}`);
  }
}

async function ensureEspeakData(onProgress?: (fraction: number) => void): Promise<void> {
  if (await RNFS.exists(ESPEAK_MARKER)) return;

  const archive = `${MODELS_DIR}/espeak-ng-data.zip`;
  if (!await RNFS.exists(archive)) {
    await downloadFile(ESPEAK_ZIP_URL, archive, onProgress);
  }

  await unzip(archive, MODELS_DIR);
  await RNFS.unlink(archive).catch(() => {});
  await RNFS.writeFile(ESPEAK_MARKER, '1', 'utf8');
}

function voiceDir(entry: PiperModelEntry): string {
  return `${MODELS_DIR}/${entry.voiceDirName}`;
}

async function isModelDownloaded(entry: PiperModelEntry): Promise<boolean> {
  return RNFS.exists(`${voiceDir(entry)}/${entry.modelOnnxName}`);
}

export async function ensureModel(
  entry: PiperModelEntry,
  onProgress?: (fraction: number) => void,
): Promise<ActiveModel> {
  await ensureDir(MODELS_DIR);

  const dir = voiceDir(entry);
  const modelPath = `${dir}/${entry.modelOnnxName}`;
  const tPath = `${dir}/tokens.txt`;

  if (!await isModelDownloaded(entry)) {
    await ensureDir(dir);
    // .onnx is ~64MB, tokens.txt is ~1KB — apportion progress accordingly
    await downloadFile(onnxUrl(entry), modelPath, p => onProgress?.(p * 0.85));
    await downloadFile(tokensUrl(entry), tPath);
    onProgress?.(0.88);
  }

  // espeak-ng-data is shared; download once for all voices
  await ensureEspeakData(p => onProgress?.(0.88 + p * 0.12));
  onProgress?.(1.0);

  const cfg = JSON.stringify({ modelPath, tokensPath: tPath, dataDirPath: ESPEAK_DIR });
  await TTSManager.initialize(cfg);

  return { entry, modelPath, tokensPath: tPath, dataDirPath: ESPEAK_DIR };
}

export async function isDownloadedAsync(entry: PiperModelEntry): Promise<boolean> {
  return isModelDownloaded(entry);
}

export function listAll(): PiperModelEntry[] {
  return PIPER_MODELS;
}

export async function deleteModel(entry: PiperModelEntry): Promise<void> {
  const dir = voiceDir(entry);
  if (await RNFS.exists(dir)) await RNFS.unlink(dir);
}
