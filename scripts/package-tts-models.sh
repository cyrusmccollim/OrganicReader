#!/bin/bash
# Run once on your dev machine to repackage sherpa-onnx Piper models as .zip
# then upload the resulting .zip files to your CDN/GitHub releases.
# Usage: bash scripts/package-tts-models.sh [lang_code]
#   e.g. bash scripts/package-tts-models.sh en
#        bash scripts/package-tts-models.sh    (packages all)

set -e

BASE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models"
OUT_DIR="./tts-zips"
mkdir -p "$OUT_DIR"

package_model() {
  local name="$1"   # e.g. vits-piper-en_US-ryan-medium
  local tarball="${name}.tar.bz2"
  local url="${BASE_URL}/${tarball}"

  echo "==> Downloading $name ..."
  curl -L -o "/tmp/${tarball}" "$url"

  echo "==> Extracting ..."
  tar xf "/tmp/${tarball}" -C /tmp/

  echo "==> Repackaging as .zip ..."
  (cd /tmp && zip -r "${OUT_DIR}/${name}.zip" "${name}/")

  echo "==> Cleaning up ..."
  rm -rf "/tmp/${name}" "/tmp/${tarball}"
  echo "    Done → ${OUT_DIR}/${name}.zip"
}

LANG="${1:-all}"

package_en()  { package_model "vits-piper-en_US-ryan-medium"; }
package_fr()  { package_model "vits-piper-fr_FR-mls-medium"; }
package_de()  { package_model "vits-piper-de_DE-thorsten-high"; }
package_es()  { package_model "vits-piper-es_ES-mls_9972-low"; }
package_it()  { package_model "vits-piper-it_IT-riccardo-x_low"; }
package_pt()  { package_model "vits-piper-pt_BR-faber-medium"; }
package_ru()  { package_model "vits-piper-ru_RU-irinia-medium"; }
package_zh()  { package_model "vits-piper-zh_CN-huayan-medium"; }

case "$LANG" in
  en)  package_en ;;
  fr)  package_fr ;;
  de)  package_de ;;
  es)  package_es ;;
  it)  package_it ;;
  pt)  package_pt ;;
  ru)  package_ru ;;
  zh)  package_zh ;;
  all) package_en; package_fr; package_de; package_es; package_it; package_pt; package_ru; package_zh ;;
  *)   echo "Unknown lang: $LANG. Use en|fr|de|es|it|pt|ru|zh|all"; exit 1 ;;
esac

echo ""
echo "Upload the .zip files in ${OUT_DIR}/ to your CDN/GitHub releases,"
echo "then update BASE in src/config/ttsModels.ts to your hosting URL."
