import TrackPlayer, { Capability } from 'react-native-track-player';

let setupDone = false;

export async function setupTrackPlayer(): Promise<void> {
  if (setupDone) return;
  try {
    await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SeekTo,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause],
    });
    setupDone = true;
  } catch {
    // Player is already set up — safe to ignore
  }
}
