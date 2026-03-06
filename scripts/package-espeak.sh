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
echo "Next steps:"
echo "  cd ~/path/to/OrganicReaderAssets"
echo "  mv ~/path/to/OrganicReader/espeak-ng-data.zip ."
echo "  git add espeak-ng-data.zip && git commit -m 'Add espeak-ng-data' && git push"
echo "  Enable Pages: Settings → Pages → main → / (root)"
