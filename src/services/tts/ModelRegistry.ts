import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import { PIPER_MODELS, PiperModelEntry, findModel } from '../../config/ttsModels';

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/tts-models`;

export interface ActiveModel {
  entry: PiperModelEntry;
  modelPath: string;
  tokensPath: string;
  dataDirPath: string;
}

async function ensureDir(path: string) {
  const exists = await RNFS.exists(path);
  if (!exists) await RNFS.mkdir(path);
}

function voiceDir(entry: PiperModelEntry): string {
  return `${MODELS_DIR}/${entry.voiceDirName}`;
}

function archivePath(entry: PiperModelEntry): string {
  return `${MODELS_DIR}/${entry.voiceDirName}.archive`;
}

async function isModelExtracted(entry: PiperModelEntry): Promise<boolean> {
  const onnxPath = `${voiceDir(entry)}/${entry.modelOnnxName}`;
  return RNFS.exists(onnxPath);
}

export async function ensureModel(
  langCode: string,
  onProgress?: (fraction: number) => void,
): Promise<ActiveModel> {
  const entry = findModel(langCode);
  await ensureDir(MODELS_DIR);

  const extracted = await isModelExtracted(entry);
  if (!extracted) {
    const archive = archivePath(entry);
    const archiveExists = await RNFS.exists(archive);

    if (!archiveExists) {
      // Download with progress
      await new Promise<void>((resolve, reject) => {
        const { jobId, promise } = RNFS.downloadFile({
          fromUrl: entry.zipUrl,
          toFile: archive,
          background: true,
          progressInterval: 500,
          progress: (res) => {
            if (res.contentLength > 0) {
              onProgress?.(res.bytesWritten / res.contentLength * 0.7);
            }
          },
        });
        promise
          .then(() => resolve())
          .catch(reject);
        // suppress unused jobId warning
        void jobId;
      });
    }

    onProgress?.(0.75);
    // Unzip archive
    await unzip(archive, MODELS_DIR);
    onProgress?.(0.95);

    // Delete archive after extraction to save space
    await RNFS.unlink(archive).catch(() => {});
    onProgress?.(1.0);
  }

  const base = voiceDir(entry);
  const modelPath = `${base}/${entry.modelOnnxName}`;
  const tokensPath = `${base}/tokens.txt`;
  const dataDirPath = `${base}/espeak-ng-data`;

  const cfg = JSON.stringify({ modelPath, tokensPath, dataDirPath });
  await TTSManager.initialize(cfg);

  return { entry, modelPath, tokensPath, dataDirPath };
}

export function isDownloaded(_langCode: string): boolean {
  // Synchronous check not possible with RNFS — use isDownloadedAsync for accuracy
  return false;
}

export async function isDownloadedAsync(langCode: string): Promise<boolean> {
  return isModelExtracted(findModel(langCode));
}

export function listAll(): PiperModelEntry[] {
  return PIPER_MODELS;
}

export async function deleteModel(langCode: string): Promise<void> {
  const entry = findModel(langCode);
  const dir = voiceDir(entry);
  const exists = await RNFS.exists(dir);
  if (exists) await RNFS.unlink(dir);
}
