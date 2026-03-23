# Available macOS Voices

## Recommended for podcast style
- **Alex** — American male, clear and natural
- **Samantha** — American female, clear and natural

## Other English voices
Run `say -v ?` to list all installed voices.

Common alternatives:
- Daniel — British male
- Karen — Australian female
- Moira — Irish female
- Tessa — South African female

## Voice parameters
- Rate: default ~175 wpm. Adjust with `say -r 200` for faster.
- The `say` command outputs AIFF format by default.
- Convert to M4A: `afconvert -f m4af -d aac input.aiff output.m4a`
- Convert to WAV: `afconvert -f WAVE -d LEI16 input.aiff output.wav`
