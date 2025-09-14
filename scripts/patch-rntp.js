#!/usr/bin/env node
// Patches RNTP nightly to run as a bridge module instead of a TurboModule.
// The nightly build has a JNI local-ref bug on the mqt_v_native thread (SIGSEGV).
// Setting isTurboModule=false moves it to the bridge interop layer instead.
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../node_modules/react-native-track-player/android/src/main/java',
  'com/doublesymmetry/trackplayer/TrackPlayerPackage.kt',
);

if (!fs.existsSync(file)) process.exit(0);

const src = fs.readFileSync(file, 'utf8');
const patched = src.replace(
  /true\s*\/\/\s*isTurboModule/,
  'false // isTurboModule — disabled: nightly has JNI local-ref bug on mqt_v_native',
);

if (patched !== src) {
  fs.writeFileSync(file, patched);
  console.log('✓ Patched RNTP: isTurboModule=false');
} else {
  console.log('✓ RNTP patch already applied');
}
