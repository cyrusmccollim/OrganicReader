import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';

const Native = NativeModules.SimpleAudio as {
  play(filePath: string): Promise<void>;
  queueNext(filePath: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seekTo(ms: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  getPosition(): Promise<number>;
};

export const SimpleAudio = {
  play: (filePath: string) => Native.play(filePath),
  queueNext: (filePath: string) => Native.queueNext(filePath),
  pause: () => Native.pause(),
  resume: () => Native.resume(),
  stop: () => Native.stop(),
  seekTo: (ms: number) => Native.seekTo(ms),
  setRate: (rate: number) => Native.setRate(rate),
  getPosition: (): Promise<number> => Native.getPosition(),
  onComplete: (cb: () => void): EmitterSubscription =>
    DeviceEventEmitter.addListener('AudioPlaybackComplete', cb),
  onProgress: (cb: (position: number) => void): EmitterSubscription =>
    DeviceEventEmitter.addListener('AudioProgress', ({ position }: { position: number }) => cb(position)),
  onError: (cb: (err: string) => void): EmitterSubscription =>
    DeviceEventEmitter.addListener('AudioPlaybackError', ({ error }: { error: string }) => cb(error)),
};
