#!/bin/bash
# Run once on your dev machine to repackage sherpa-onnx Piper models as .zip
# then upload the resulting .zip files to GitHub releases.
#
# Usage:
#   bash scripts/package-tts-models.sh          # packages all models
#   bash scripts/package-tts-models.sh en        # packages English models only
#   bash scripts/package-tts-models.sh fr de     # packages French and German
#
# After packaging:
#   gh release create tts-models tts-zips/*.zip --title "TTS Models" \
#     --notes "Piper VITS model archives for OrganicReader"

set -e

BASE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models"
OUT_DIR="./tts-zips"
mkdir -p "$OUT_DIR"

package_model() {
  local name="$1"
  local out="${OUT_DIR}/${name}.zip"

  if [ -f "$out" ]; then
    echo "    Skipping $name (already packaged)"
    return
  fi

  echo "==> Downloading $name ..."
  curl -L -o "/tmp/${name}.tar.bz2" "${BASE_URL}/${name}.tar.bz2"

  echo "==> Extracting ..."
  tar xf "/tmp/${name}.tar.bz2" -C /tmp/

  echo "==> Repackaging as .zip ..."
  (cd /tmp && zip -r "${OLDPWD}/${out}" "${name}/")

  echo "==> Cleaning up ..."
  rm -rf "/tmp/${name}" "/tmp/${name}.tar.bz2"
  echo "    Done → ${out}"
}

package_lang() {
  local lang="$1"
  case "$lang" in
    en)
      package_model "vits-piper-en_US-ryan-medium"
      package_model "vits-piper-en_US-lessac-medium"
      package_model "vits-piper-en_US-joe-medium"
      package_model "vits-piper-en_US-hfc_female-medium"
      package_model "vits-piper-en_GB-alan-medium"
      package_model "vits-piper-en_GB-alba-medium"
      ;;
    fr)
      package_model "vits-piper-fr_FR-siwis-medium"
      package_model "vits-piper-fr_FR-upmc-medium"
      package_model "vits-piper-fr_FR-tom-medium"
      package_model "vits-piper-fr_FR-miro-high"
      ;;
    de)
      package_model "vits-piper-de_DE-thorsten-medium"
      package_model "vits-piper-de_DE-miro-high"
      ;;
    es)
      package_model "vits-piper-es_ES-davefx-medium"
      package_model "vits-piper-es_ES-sharvard-medium"
      package_model "vits-piper-es_MX-ald-medium"
      ;;
    it)
      package_model "vits-piper-it_IT-paola-medium"
      package_model "vits-piper-it_IT-miro-high"
      ;;
    pt)
      package_model "vits-piper-pt_BR-faber-medium"
      package_model "vits-piper-pt_BR-cadu-medium"
      package_model "vits-piper-pt_PT-tugao-medium"
      ;;
    ru)
      package_model "vits-piper-ru_RU-irina-medium"
      package_model "vits-piper-ru_RU-denis-medium"
      package_model "vits-piper-ru_RU-dmitri-medium"
      ;;
    zh)
      package_model "vits-piper-zh_CN-huayan-medium"
      ;;
    ar)
      package_model "vits-piper-ar_JO-kareem-medium"
      ;;
    hi)
      package_model "vits-piper-hi_IN-pratham-medium"
      package_model "vits-piper-hi_IN-rohan-medium"
      ;;
    *)
      echo "Unknown lang: $lang. Options: en fr de es it pt ru zh ar hi"
      exit 1
      ;;
  esac
}

if [ $# -eq 0 ]; then
  for lang in en fr de es it pt ru zh ar hi; do
    package_lang "$lang"
  done
else
  for lang in "$@"; do
    package_lang "$lang"
  done
fi

echo ""
echo "Done! Zips are in ${OUT_DIR}/"
echo ""
echo "To upload to GitHub releases:"
echo "  gh release create tts-models ${OUT_DIR}/*.zip \\"
echo "    --title \"TTS Models\" --notes \"Piper VITS model archives\""
