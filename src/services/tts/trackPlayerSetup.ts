import TrackPlayer, { Capability } from 'react-native-track-player';

let setupDone = false;
let setupPending: Promise<void> | null = null;

export async function setupTrackPlayer(): Promise<void> {
  if (setupDone) return;
  if (setupPending) return setupPending;
  setupPending = (async () => {
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
      });
      setupDone = true;
    } catch {
      // Player is already set up — safe to ignore
    } finally {
      setupPending = null;
    }
  })();
  return setupPending;
}
