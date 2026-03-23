# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

NotebookLM-style research assistant plugin for Claude Code. Ingest PDFs/text into a local vector store, then generate 8 output types (flashcards, quiz, report, slide deck, mind map, infographic, data table, audio overview) through a 3-agent pipeline.

## Commands

```bash
# Ingest sources
bun skills/ingest/scripts/ingest.mjs <file.pdf>
node skills/ingest/scripts/list.mjs

# Query vector store
bun skills/ingest/scripts/query.mjs "question" --top-k 15

# Generate outputs (each takes -i <json> -o <dir> --name <prefix>)
node skills/generate/scripts/flashcards.mjs -i input.json -o output
node skills/generate/scripts/quiz.mjs -i input.json -o output
bun skills/generate/scripts/report.mjs -i input.json -o output --format both
bun skills/generate/scripts/slide-deck.mjs -i input.json -o output
node skills/generate/scripts/mind-map.mjs -i input.json -o output
node skills/generate/scripts/infographic.mjs -i input.json -o output
bun skills/generate/scripts/data-table.mjs -i input.json -o output
uv run --script skills/generate/scripts/audio-overview.py -i input.json -o output

# Launch dashboard
node skills/ui/scripts/dashboard.mjs -o output --port 3456
```

## Runtime Split

- **`#!/usr/bin/env bun`** — scripts with npm dependencies (Bun auto-installs on import): ingest, query, report, slide-deck, data-table
- **`#!/usr/bin/env node`** — zero-dependency scripts: list, flashcards, quiz, mind-map, infographic, dashboard
- **`#!/usr/bin/env -S uv run --script`** — Python with inline PEP 723 deps: audio-overview.py (Kokoro-82M TTS)

Never use `NODE_PATH` or hardcoded `node_modules` paths. Bun handles dependency resolution automatically.

## Architecture

### 3-Agent Pipeline

**Researcher** (read-only, Sonnet) → **Writer** (write access, Sonnet) → **Critic** (read-only, Sonnet)

Researcher runs 5-10 RAG queries to analyze sources. Writer generates artifacts from findings. Critic reviews against source material. Writer revises if needed. Definitions live in `agents/`.

### RAG Pipeline

PDF parsing (pdf-parse + Tesseract.js OCR) → semantic chunking (2000 chars, 200 overlap) → embeddings (@huggingface/transformers, all-MiniLM-L6-v2, 384d) → Vectra vector store at `~/.notebook-plugin/stores/<md5-of-cwd>/`.

### Dashboard

Pure Node.js HTTP server (zero npm deps). Reads `skills/ui/dashboard/index.html` and injects `index.css` via `{{CSS}}` placeholder. SSE for live updates. Single Claude session with `--resume` for sequential generation jobs.

### Skills

Each skill has `SKILL.md` (definition with YAML frontmatter), `scripts/`, and optional `references/` and `assets/`. JSON input templates are in `skills/generate/assets/`.

## Environment Variables

- `CLAUDE_PLUGIN_ROOT` — plugin source directory
- `CLAUDE_PLUGIN_DATA` — persistent data dir (shared across updates)
- `CLAUDE_SKILL_DIR` — current skill directory
- `BUN_BIN` — override bun binary path (defaults to `~/.bun/bin/bun`)
- `CLAUDE_BIN` — claude binary path

## Key Patterns

- Generator scripts accept structured JSON input (`-i`) and produce multiple output formats
- Temp input files use `output/_<type>_input.json` pattern (auto-cleaned after generation)
- Audio overview uses Kokoro-82M voices (`af_heart` female, `am_fenrir` male) with macOS `afconvert` for AIFF→WAV transcode
- Vector store is per-project (hashed by cwd) and persists across sessions
- `SessionStart` hook in `hooks/hooks.json` syncs and installs npm dependencies automatically
