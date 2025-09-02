#!/bin/bash

set -e

echo "==> Downloading espeak-ng-data ..."
curl -L -o /tmp/espeak-ng-data.tar.bz2 \
  https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/espeak-ng-data.tar.bz2

echo "==> Extracting ..."
tar xf /tmp/espeak-ng-data.tar.bz2 -C /tmp/

echo "==> Zipping ..."
(cd /tmp && zip -r "$OLDPWD/espeak-ng-data.zip" espeak-ng-data/)

echo "==> Cleaning up ..."
rm -rf /tmp/espeak-ng-data /tmp/espeak-ng-data.tar.bz2

echo ""
echo "Done → espeak-ng-data.zip"
echo ""
echo "Upload with:"
echo "  gh release create tts-models espeak-ng-data.zip --title \"TTS Assets\""
