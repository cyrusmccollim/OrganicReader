import RNFS from 'react-native-fs';
import TTSManager from 'react-native-sherpa-onnx-offline-tts';

export interface GeneratedSegment {
  durationMs: number;
  audioPath: string;
  sampleRate: number;
}

let segmentCounter = 0;
// Cached once after first successful mkdir — avoids two async FS calls per segment
let tmpDirReady = false;

const TMP_DIR = `${RNFS.CachesDirectoryPath}/tts-tmp`;

// Incremented on every flush/cancel. synthesize() checks this before and after
// the native call — if it changed, the result is stale and gets discarded.
let generationEpoch = 0;
export function bumpEpoch(): number { return ++generationEpoch; }
export function currentEpoch(): number { return generationEpoch; }

async function ensureTmpDir(): Promise<void> {
  if (tmpDirReady) return;
  if (!await RNFS.exists(TMP_DIR)) await RNFS.mkdir(TMP_DIR);
  tmpDirReady = true;
}

// Speed is NOT passed to generateAndSave -- it's handled by SimpleAudio.setRate
// Speaker changes require re-initializing the model via ModelRegistry
export async function synthesize(
  text: string,
  sampleRate: number,
  epoch: number,
): Promise<GeneratedSegment | null> {
  if (generationEpoch !== epoch) return null;
  await ensureTmpDir();

  const outPath = `${TMP_DIR}/seg_${Date.now()}_${segmentCounter++}.wav`;

  const savedPath: string = await TTSManager.generateAndSave(text, outPath, 'wav');
  const actualPath = savedPath ?? outPath;

  // Stale result — another flush happened while we were synthesizing
  if (generationEpoch !== epoch) {
    await RNFS.unlink(actualPath).catch(() => {});
    return null;
  }

  const durationMs = await readWavDurationMs(actualPath, sampleRate);
  return { durationMs, audioPath: actualPath, sampleRate };
}

async function readWavDurationMs(path: string, fallbackSampleRate: number): Promise<number> {
  try {
    // WAV header: bytes 28-31 = byte rate, bytes 40-43 = data chunk size
    const base64Header = await RNFS.read(path, 44, 0, 'base64');
    const bytes = base64ToBytes(base64Header);
    const view = new DataView(bytes.buffer);
    const byteRate = view.getUint32(28, true);
    const dataSize = view.getUint32(40, true);
    if (byteRate > 0 && dataSize > 0) {
      return (dataSize / byteRate) * 1000;
    }
  } catch {
    // fall through to size-based estimate
  }
  try {
    const stat = await RNFS.stat(path);
    const fileSize = Number(stat.size) - 44;
    const bytesPerMs = (fallbackSampleRate * 2) / 1000;
    return fileSize / bytesPerMs;
  } catch {
    return 3000;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function deleteTempFile(path: string): Promise<void> {
  await RNFS.unlink(path).catch(() => {});
}

export async function cleanTmpDir(): Promise<void> {
  tmpDirReady = false;
  const exists = await RNFS.exists(TMP_DIR);
  if (!exists) return;
  const items = await RNFS.readDir(TMP_DIR);
  await Promise.all(items.map(i => RNFS.unlink(i.path).catch(() => {})));
}
