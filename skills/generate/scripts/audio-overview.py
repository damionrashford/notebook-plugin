#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "kokoro>=0.9.4",
#     "misaki[en]",
#     "soundfile",
#     "numpy",
#     "pip",
# ]
# ///
"""
Generate an audio overview using Kokoro TTS (82M neural voice model).
Falls back to macOS `say` if Kokoro fails to load.

Usage: uv run audio-overview.py -i <input.json> -o <output-dir> [--name audio-overview]

Input JSON (multi-voice podcast):
  { "segments": [
      { "text": "Host intro...", "voice": "af_heart" },
      { "text": "Co-host response...", "voice": "am_fenrir" }
  ]}

Input JSON (single voice):
  { "text": "Full script text here" }

Outputs: .wav audio file (24kHz)
Requires: uv, espeak-ng (brew install espeak-ng)
"""

import argparse
import json
import os
import sys
import subprocess

# ── Kokoro voice mapping ────────────────────────────────────────────
VOICE_MAP = {
    # Primary podcast voices (best quality)
    'host':      'af_heart',     # A-grade female — warm, clear
    'cohost':    'am_fenrir',    # C+ male — conversational
    'narrator':  'bf_emma',      # B- British female — authoritative
    # Old macOS say voices → Kokoro equivalents
    'alex':      'am_fenrir',
    'samantha':  'af_heart',
    'daniel':    'bm_daniel',
    'karen':     'bf_emma',
}

DEFAULT_VOICES = ['af_heart', 'am_fenrir']


def resolve_voice(voice_str, segment_index=0):
    """Resolve a voice string to a Kokoro voice ID."""
    if not voice_str:
        return DEFAULT_VOICES[segment_index % len(DEFAULT_VOICES)]
    v = voice_str.strip().lower()
    if v in VOICE_MAP:
        return VOICE_MAP[v]
    if '_' in v and len(v) < 20:
        return v
    return DEFAULT_VOICES[segment_index % len(DEFAULT_VOICES)]


def generate_kokoro(segments, output_path):
    """Generate audio using Kokoro TTS."""
    import soundfile as sf
    import numpy as np
    from kokoro import KPipeline

    all_audio = []
    silence = np.zeros(int(24000 * 0.4), dtype=np.float32)
    pipelines = {}

    for i, seg in enumerate(segments):
        text = seg['text'].strip()
        if not text:
            continue
        voice = resolve_voice(seg.get('voice'), i)
        lang = voice[0]

        print(f"  Segment {i+1}/{len(segments)}: voice={voice}, {len(text)} chars", file=sys.stderr)

        if lang not in pipelines:
            pipelines[lang] = KPipeline(lang_code=lang)

        seg_audio = []
        for _, _, audio in pipelines[lang](text, voice=voice, speed=1.0):
            if audio is not None:
                seg_audio.append(audio)

        if seg_audio:
            all_audio.append(np.concatenate(seg_audio))
            if i < len(segments) - 1:
                all_audio.append(silence)

    if not all_audio:
        print("Error: No audio generated.", file=sys.stderr)
        sys.exit(1)

    combined = np.concatenate(all_audio)
    sf.write(output_path, combined, 24000)
    print(f"  Wrote {output_path} ({len(combined)/24000:.1f}s)", file=sys.stderr)


def generate_say_fallback(segments, output_path):
    """Fallback: generate audio using macOS `say` command."""
    import tempfile

    print("  Kokoro not available, falling back to macOS say", file=sys.stderr)

    SAY_MAP = {
        'af_heart': 'Samantha', 'af_bella': 'Samantha', 'af_nicole': 'Samantha',
        'am_fenrir': 'Alex', 'am_michael': 'Alex', 'am_puck': 'Alex',
        'bf_emma': 'Karen', 'bm_daniel': 'Daniel',
    }

    aiff_path = output_path.replace('.wav', '.aiff')

    if len(segments) == 1:
        text = segments[0]['text']
        voice = SAY_MAP.get(resolve_voice(segments[0].get('voice'), 0), 'Alex')
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(text)
            f.flush()
            subprocess.run(['say', '-v', voice, '-f', f.name, '-o', aiff_path], check=True)
            os.unlink(f.name)
    else:
        raw_files = []
        temp_files = []
        for i, seg in enumerate(segments):
            voice_id = resolve_voice(seg.get('voice'), i)
            voice = SAY_MAP.get(voice_id, 'Alex')
            txt_f = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
            txt_f.write(seg['text'])
            txt_f.close()
            aiff_f = tempfile.NamedTemporaryFile(suffix='.aiff', delete=False)
            aiff_f.close()
            raw_f = tempfile.NamedTemporaryFile(suffix='.raw', delete=False)
            raw_f.close()

            subprocess.run(['say', '-v', voice, '-f', txt_f.name, '-o', aiff_f.name], check=True)
            subprocess.run(['afconvert', '-f', 'caff', '-d', 'LEI16@22050', '-c', '1',
                            aiff_f.name, raw_f.name], check=True)
            raw_files.append(raw_f.name)
            temp_files.extend([txt_f.name, aiff_f.name])

        combined_f = tempfile.NamedTemporaryFile(suffix='.raw', delete=False)
        combined_f.close()
        with open(combined_f.name, 'wb') as out:
            for rf in raw_files:
                with open(rf, 'rb') as inp:
                    out.write(inp.read())

        subprocess.run(['afconvert', '-f', 'AIFF', '-d', 'BEI16@22050', '-c', '1',
                        combined_f.name, aiff_path], check=True)
        for f in temp_files + raw_files + [combined_f.name]:
            os.unlink(f)

    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', aiff_path, output_path],
                   check=True, capture_output=True)
    os.unlink(aiff_path)
    print(f"  Wrote {output_path} (macOS say fallback)", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description='Generate audio overview with Kokoro TTS')
    parser.add_argument('-i', '--input', required=True, help='Input JSON file')
    parser.add_argument('-o', '--output', default='./output', help='Output directory')
    parser.add_argument('--name', default='audio-overview', help='Output filename (without extension)')
    args = parser.parse_args()

    with open(args.input, 'r') as f:
        data = json.load(f)

    if 'text' in data:
        segments = [{'text': data['text'], 'voice': 'af_heart'}]
    elif 'segments' in data:
        segments = data['segments']
    else:
        print("Error: Input JSON must have 'text' or 'segments' key", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output, exist_ok=True)
    output_path = os.path.join(args.output, f'{args.name}.wav')

    try:
        generate_kokoro(segments, output_path)
    except Exception as e:
        print(f"  Kokoro failed: {e}", file=sys.stderr)
        if sys.platform == 'darwin':
            generate_say_fallback(segments, output_path)
        else:
            raise

    print(json.dumps({"status": "success", "audio": output_path}))


if __name__ == '__main__':
    main()
