# Available Voices — Kokoro TTS (82M)

Uses [Kokoro](https://github.com/hexgrad/kokoro) neural TTS. Falls back to macOS `say` if not installed.

## Recommended for podcast style

- **af_heart** — American female, A-grade quality, warm and clear
- **am_fenrir** — American male, C+ grade, conversational
- **bf_emma** — British female, B- grade, authoritative narrator

## All American English voices

### Female (11)
| Voice | Grade | Notes |
|-------|-------|-------|
| `af_heart` | A | Best overall quality |
| `af_bella` | A- | High quality |
| `af_nicole` | B- | High quality |
| `af_sarah` | C+ | |
| `af_aoede` | C+ | |
| `af_kore` | C+ | |
| `af_alloy` | C | |
| `af_nova` | C | |
| `af_sky` | C- | |
| `af_jessica` | D | |
| `af_river` | D | |

### Male (9)
| Voice | Grade | Notes |
|-------|-------|-------|
| `am_fenrir` | C+ | Best male voice |
| `am_puck` | C+ | |
| `am_michael` | C+ | |
| `am_adam` | F+ | |
| `am_echo` | D | |
| `am_eric` | D | |
| `am_liam` | D | |
| `am_onyx` | D | |
| `am_santa` | D- | |

## British English voices
- `bf_emma` (B-), `bf_isabella` (C), `bf_alice` (D), `bf_lily` (D)
- `bm_george` (C), `bm_fable` (C), `bm_lewis` (D+), `bm_daniel` (D)

## Voice naming convention
- First char: language (`a`=American, `b`=British, `e`=Spanish, `f`=French, `j`=Japanese, `z`=Mandarin)
- Second char: gender (`f`=female, `m`=male)
- After underscore: voice name

## Setup
```bash
pip install kokoro soundfile
brew install espeak-ng  # macOS
apt-get install espeak-ng  # Linux
```

## Output
- 24kHz WAV (Kokoro) or AIFF→WAV converted (macOS say fallback)
- Speed adjustable via `speed` parameter (default 1.0)
