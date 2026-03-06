#!/bin/bash
# Run once to package espeak-ng-data as a .zip, then commit it to /docs/.
# This is the only file you need to host — voice models download directly
# from HuggingFace (csukuangfj/vits-piper-*).
#
# After running, upload to github.com/cyrusmccollim/OrganicReaderAssets:
#   cd ~/path/to/OrganicReaderAssets
#   mv ~/path/to/OrganicReader/espeak-ng-data.zip .
#   git add espeak-ng-data.zip && git commit -m "Add espeak-ng-data" && git push
#
# Then enable GitHub Pages on OrganicReaderAssets: Settings → Pages → main → / (root)

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
