import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import { PIPER_MODELS, PiperModelEntry, onnxUrl, tokensUrl, ESPEAK_ZIP_URL } from '../../config/ttsModels';

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/tts-models`;
const ESPEAK_DIR = `${MODELS_DIR}/espeak-ng-data`;

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
  minBytes: number,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  // Remove any leftover partial file
  await RNFS.unlink(dest).catch(() => {});

  const result = await new Promise<{ statusCode: number; bytesWritten: number }>((resolve, reject) => {
    const { jobId, promise } = RNFS.downloadFile({
      fromUrl: url,
      toFile: dest,
      progressInterval: 500,
      connectionTimeout: 30000,
      readTimeout: 120000,
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

  // Validate file size — catches truncated downloads and HTML error pages
  const stat = await RNFS.stat(dest);
  if (Number(stat.size) < minBytes) {
    await RNFS.unlink(dest).catch(() => {});
    throw new Error(`Download too small (${stat.size} bytes, expected ≥${minBytes}) for ${url}`);
  }
}

async function ensureEspeakData(onProgress?: (fraction: number) => void): Promise<void> {
  // Already installed — verify the directory actually contains files
  if (await RNFS.exists(ESPEAK_DIR)) {
    const items = await RNFS.readDir(ESPEAK_DIR).catch(() => []);
    if (items.length > 0) return;
  }

  const archive = `${MODELS_DIR}/espeak-ng-data.zip`;
  // Always re-download — a leftover zip is likely corrupt if the dir is missing
  await RNFS.unlink(archive).catch(() => {});
  await downloadFile(ESPEAK_ZIP_URL, archive, 500_000, onProgress);

  await unzip(archive, MODELS_DIR);
  await RNFS.unlink(archive).catch(() => {});

  // Verify extraction succeeded
  if (!await RNFS.exists(ESPEAK_DIR)) {
    throw new Error('espeak-ng-data extraction failed');
  }
}

function voiceDir(entry: PiperModelEntry): string {
  return `${MODELS_DIR}/${entry.voiceDirName}`;
}

async function isModelDownloaded(entry: PiperModelEntry): Promise<boolean> {
  const onnxPath = `${voiceDir(entry)}/${entry.modelOnnxName}`;
  const tokensPath = `${voiceDir(entry)}/tokens.txt`;
  return await RNFS.exists(onnxPath) && await RNFS.exists(tokensPath);
}

async function isEspeakReady(): Promise<boolean> {
  if (!await RNFS.exists(ESPEAK_DIR)) return false;
  const items = await RNFS.readDir(ESPEAK_DIR).catch(() => []);
  return items.length > 0;
}

export async function ensureModel(
  entry: PiperModelEntry,
  onProgress?: (fraction: number) => void,
): Promise<ActiveModel> {
  await ensureDir(MODELS_DIR);

  const dir = voiceDir(entry);
  const modelPath = `${dir}/${entry.modelOnnxName}`;
  const tPath = `${dir}/tokens.txt`;

  const modelReady = await isModelDownloaded(entry);
  const espeakReady = await isEspeakReady();

  if (!modelReady) {
    await ensureDir(dir);
    await downloadFile(onnxUrl(entry), modelPath, 1_000_000, p => onProgress?.(p * 0.85));
    await downloadFile(tokensUrl(entry), tPath, 100);
    onProgress?.(0.88);
  }

  if (!espeakReady) {
    await ensureEspeakData(p => onProgress?.(modelReady ? p : 0.88 + p * 0.12));
  }

  onProgress?.(1.0);

  const cfg = JSON.stringify({ modelPath, tokensPath: tPath, dataDirPath: ESPEAK_DIR });
  await TTSManager.initialize(cfg);

  return { entry, modelPath, tokensPath: tPath, dataDirPath: ESPEAK_DIR };
}

export async function isDownloadedAsync(entry: PiperModelEntry): Promise<boolean> {
  return await isModelDownloaded(entry) && await isEspeakReady();
}

export function listAll(): PiperModelEntry[] {
  return PIPER_MODELS;
}

export async function deleteModel(entry: PiperModelEntry): Promise<void> {
  const dir = voiceDir(entry);
  if (await RNFS.exists(dir)) await RNFS.unlink(dir);
}
