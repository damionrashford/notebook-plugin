#!/usr/bin/env bash
# Generate an audio overview using macOS text-to-speech.
#
# Usage: bash generate.sh -i <input.json> -o <output-dir> [--name audio-overview]
#
# Input JSON format (single voice):
#   { "text": "Full script text here" }
#
# Input JSON format (multi-voice podcast):
#   { "segments": [
#       { "text": "Host intro...", "voice": "Alex" },
#       { "text": "Co-host response...", "voice": "Samantha" }
#   ]}
#
# Outputs: .aiff audio file
# Requires: macOS (uses `say` and `afconvert`)

set -euo pipefail

INPUT=""
OUTPUT_DIR="./output"
NAME="audio-overview"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input)  INPUT="$2"; shift 2 ;;
    -o|--output) OUTPUT_DIR="$2"; shift 2 ;;
    --name)      NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: bash generate.sh -i <input.json> -o <output-dir> [--name audio-overview]"
      echo ""
      echo "Generate audio overview using macOS text-to-speech."
      echo "Input: JSON with 'text' (single voice) or 'segments' array (multi-voice)."
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$INPUT" ]; then
  echo "Error: -i <input.json> required" >&2
  exit 1
fi

if ! command -v say &>/dev/null; then
  echo "Error: 'say' command not found. This script requires macOS." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_PATH="$OUTPUT_DIR/$NAME.aiff"

# Parse JSON using node (available on any system with Node)
SEGMENTS_JSON=$(node -e "
  const d = JSON.parse(require('fs').readFileSync('$INPUT','utf-8'));
  if (d.text) {
    console.log(JSON.stringify([{text: d.text, voice: 'Alex'}]));
  } else if (d.segments) {
    console.log(JSON.stringify(d.segments));
  } else {
    console.error('Invalid input: need \"text\" or \"segments\" key');
    process.exit(1);
  }
")

SEGMENT_COUNT=$(node -e "console.log(JSON.parse('$SEGMENTS_JSON').length)")

if [ "$SEGMENT_COUNT" -eq 1 ]; then
  # Single segment — direct render
  TEXT=$(node -e "console.log(JSON.parse('$SEGMENTS_JSON')[0].text)")
  VOICE=$(node -e "console.log(JSON.parse('$SEGMENTS_JSON')[0].voice || 'Alex')")
  TEMP_TXT="$OUTPUT_DIR/_temp_audio.txt"
  echo "$TEXT" > "$TEMP_TXT"
  say -v "$VOICE" -f "$TEMP_TXT" -o "$OUTPUT_PATH"
  rm -f "$TEMP_TXT"
else
  # Multi-segment podcast — render each, concatenate via raw PCM
  TEMP_FILES=()
  RAW_FILES=()
  VOICES=("Alex" "Samantha")

  for i in $(seq 0 $((SEGMENT_COUNT - 1))); do
    TEXT=$(node -e "console.log(JSON.parse('$SEGMENTS_JSON')[$i].text)")
    VOICE=$(node -e "const s=JSON.parse('$SEGMENTS_JSON')[$i]; console.log(s.voice || ['Alex','Samantha'][$i % 2])")

    TEMP_TXT="$OUTPUT_DIR/_temp_seg_${i}.txt"
    TEMP_AIFF="$OUTPUT_DIR/_temp_seg_${i}.aiff"
    TEMP_RAW="$OUTPUT_DIR/_temp_raw_${i}.raw"

    echo "$TEXT" > "$TEMP_TXT"
    say -v "$VOICE" -f "$TEMP_TXT" -o "$TEMP_AIFF"
    afconvert -f caff -d LEI16@22050 -c 1 "$TEMP_AIFF" "$TEMP_RAW"

    TEMP_FILES+=("$TEMP_TXT" "$TEMP_AIFF")
    RAW_FILES+=("$TEMP_RAW")
  done

  # Concatenate raw PCM
  COMBINED="$OUTPUT_DIR/_temp_combined.raw"
  cat "${RAW_FILES[@]}" > "$COMBINED"

  # Convert back to AIFF
  afconvert -f AIFF -d BEI16@22050 -c 1 "$COMBINED" "$OUTPUT_PATH"

  # Cleanup
  rm -f "${TEMP_FILES[@]}" "${RAW_FILES[@]}" "$COMBINED"
fi

echo "{\"status\": \"success\", \"audio\": \"$OUTPUT_PATH\"}"
