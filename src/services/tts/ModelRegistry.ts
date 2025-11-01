import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import { ALL_MODELS, TTSModelEntry, onnxUrl, tokensUrl, meloFileUrl, ESPEAK_ZIP_URL } from '../../config/ttsModels';

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/tts-models`;
const ESPEAK_DIR = `${MODELS_DIR}/espeak-ng-data`;

export interface ActiveModel {
  entry: TTSModelEntry;
  modelPath: string;
  tokensPath: string;
  dataDirPath: string;
  lexiconPath: string;
  dictDirPath: string;
  speakerId: number;
}

let activeJobId: number | null = null;
let cancelled = false;

async function ensureDir(path: string) {
  if (!await RNFS.exists(path)) await RNFS.mkdir(path);
}

function throwIfCancelled() {
  if (cancelled) throw new Error('Download cancelled');
}

async function downloadFile(
  url: string,
  dest: string,
  minBytes: number,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  throwIfCancelled();
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
    activeJobId = jobId;
    promise.then(resolve).catch(reject);
  });

  activeJobId = null;
  throwIfCancelled();

  if (result.statusCode < 200 || result.statusCode >= 300) {
    await RNFS.unlink(dest).catch(() => {});
    throw new Error(`HTTP ${result.statusCode} fetching ${url}`);
  }

  const stat = await RNFS.stat(dest);
  if (Number(stat.size) < minBytes) {
    await RNFS.unlink(dest).catch(() => {});
    throw new Error(`Download too small (${stat.size} bytes, expected ≥${minBytes}) for ${url}`);
  }
}

export function cancelActiveDownload() {
  cancelled = true;
  if (activeJobId !== null) {
    RNFS.stopDownload(activeJobId);
    activeJobId = null;
  }
}

async function ensureEspeakData(onProgress?: (fraction: number) => void): Promise<void> {
  if (await RNFS.exists(ESPEAK_DIR)) {
    const items = await RNFS.readDir(ESPEAK_DIR).catch(() => []);
    if (items.length > 0) return;
  }

  const archive = `${MODELS_DIR}/espeak-ng-data.zip`;
  await RNFS.unlink(archive).catch(() => {});
  await downloadFile(ESPEAK_ZIP_URL, archive, 500_000, onProgress);

  await unzip(archive, MODELS_DIR);
  await RNFS.unlink(archive).catch(() => {});

  if (!await RNFS.exists(ESPEAK_DIR)) {
    throw new Error('espeak-ng-data extraction failed');
  }
}

function voiceDir(entry: TTSModelEntry): string {
  return `${MODELS_DIR}/${entry.voiceDirName}`;
}

// ── Piper download check ─────────────────────────────────────────────────────

async function isPiperDownloaded(entry: TTSModelEntry): Promise<boolean> {
  const dir = voiceDir(entry);
  return await RNFS.exists(`${dir}/${entry.modelOnnxName}`) && await RNFS.exists(`${dir}/tokens.txt`);
}

async function isEspeakReady(): Promise<boolean> {
  if (!await RNFS.exists(ESPEAK_DIR)) return false;
  const items = await RNFS.readDir(ESPEAK_DIR).catch(() => []);
  return items.length > 0;
}

// ── MeloTTS download check ──────────────────────────────────────────────────

async function isMeloDownloaded(entry: TTSModelEntry): Promise<boolean> {
  const dir = voiceDir(entry);
  if (!await RNFS.exists(`${dir}/${entry.modelOnnxName}`)) return false;
  if (!await RNFS.exists(`${dir}/tokens.txt`)) return false;
  if (entry.lexiconName && !await RNFS.exists(`${dir}/${entry.lexiconName}`)) return false;
  if (entry.dictDirName && !await RNFS.exists(`${dir}/${entry.dictDirName}`)) return false;
  return true;
}

// ── Piper ensure ─────────────────────────────────────────────────────────────

async function ensurePiper(
  entry: TTSModelEntry,
  onProgress?: (fraction: number) => void,
): Promise<ActiveModel> {
  const dir = voiceDir(entry);
  const modelPath = `${dir}/${entry.modelOnnxName}`;
  const tPath = `${dir}/tokens.txt`;

  const modelReady = await isPiperDownloaded(entry);
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

  return {
    entry, modelPath, tokensPath: tPath, dataDirPath: ESPEAK_DIR,
    lexiconPath: '', dictDirPath: '', speakerId: 0,
  };
}

// ── MeloTTS ensure ───────────────────────────────────────────────────────────

async function ensureMeloDictDir(entry: TTSModelEntry, dir: string): Promise<void> {
  if (!entry.dictDirName) return;
  const dictDir = `${dir}/${entry.dictDirName}`;
  if (await RNFS.exists(dictDir)) return;

  // Download dict as zip from OrganicReaderAssets, since it's a directory tree
  const ASSETS = 'https://cyrusmccollim.github.io/OrganicReaderAssets';
  const archive = `${dir}/dict.zip`;
  await downloadFile(`${ASSETS}/${entry.voiceDirName}-dict.zip`, archive, 1_000);
  await unzip(archive, dir);
  await RNFS.unlink(archive).catch(() => {});
}

async function ensureMelo(
  entry: TTSModelEntry,
  onProgress?: (fraction: number) => void,
): Promise<ActiveModel> {
  const dir = voiceDir(entry);

  if (!await isMeloDownloaded(entry)) {
    await ensureDir(dir);

    // Download model.onnx (bulk of the download)
    const modelPath = `${dir}/${entry.modelOnnxName}`;
    if (!await RNFS.exists(modelPath)) {
      await downloadFile(meloFileUrl(entry, entry.modelOnnxName), modelPath, 1_000_000, p => onProgress?.(p * 0.85));
    }

    // Download tokens.txt
    const tPath = `${dir}/tokens.txt`;
    if (!await RNFS.exists(tPath)) {
      await downloadFile(meloFileUrl(entry, 'tokens.txt'), tPath, 100);
    }
    onProgress?.(0.88);

    // Download lexicon
    if (entry.lexiconName) {
      const lexPath = `${dir}/${entry.lexiconName}`;
      if (!await RNFS.exists(lexPath)) {
        await downloadFile(meloFileUrl(entry, entry.lexiconName), lexPath, 1_000);
      }
    }
    onProgress?.(0.90);

    // Download extra files (FSTs etc)
    if (entry.extraFiles) {
      for (const f of entry.extraFiles) {
        const fPath = `${dir}/${f}`;
        if (!await RNFS.exists(fPath)) {
          await downloadFile(meloFileUrl(entry, f), fPath, 100);
        }
      }
    }
    onProgress?.(0.93);

    // Download dict directory (Chinese only — needs zip from OrganicReaderAssets)
    await ensureMeloDictDir(entry, dir);
    onProgress?.(0.95);
  }

  onProgress?.(1.0);

  const modelPath = `${dir}/${entry.modelOnnxName}`;
  const tokensPath = `${dir}/tokens.txt`;
  const lexiconPath = entry.lexiconName ? `${dir}/${entry.lexiconName}` : '';
  const dictDirPath = entry.dictDirName ? `${dir}/${entry.dictDirName}` : '';

  return {
    entry, modelPath, tokensPath, dataDirPath: '',
    lexiconPath, dictDirPath, speakerId: entry.speakerId ?? 0,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function ensureModel(
  entry: TTSModelEntry,
  onProgress?: (fraction: number) => void,
): Promise<ActiveModel> {
  cancelled = false;
  await ensureDir(MODELS_DIR);

  const model = entry.engine === 'melo'
    ? await ensureMelo(entry, onProgress)
    : await ensurePiper(entry, onProgress);

  const cfg = JSON.stringify({
    modelPath: model.modelPath,
    tokensPath: model.tokensPath,
    dataDirPath: model.dataDirPath,
    lexiconPath: model.lexiconPath,
    dictDirPath: model.dictDirPath,
    speakerId: model.speakerId,
  });
  await TTSManager.initialize(cfg);

  return model;
}

export async function isDownloadedAsync(entry: TTSModelEntry): Promise<boolean> {
  if (entry.engine === 'melo') return isMeloDownloaded(entry);
  return await isPiperDownloaded(entry) && await isEspeakReady();
}

export function listAll(): TTSModelEntry[] {
  return ALL_MODELS;
}

export async function deleteModel(entry: TTSModelEntry): Promise<void> {
  const dir = voiceDir(entry);
  if (await RNFS.exists(dir)) await RNFS.unlink(dir);
}
