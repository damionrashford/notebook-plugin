---
name: dashboard
description: Launch a live NotebookLM-style dashboard for managing sources and generating outputs. Use when the user wants a visual interface, dashboard, or UI for their notebook.
argument-hint: "[--port 3456]"
compatibility: Requires Node.js 18+ and Bun 1.0+.
allowed-tools: Bash(bash *) Bash(bun *) Bash(node *) Write Read
---

# Notebook Dashboard

Live interactive dashboard server that mirrors NotebookLM's interface with real-time updates via SSE.

## Architecture

```
skills/ui/
├── SKILL.md              # This file
├── dashboard/
│   ├── index.html        # SPA markup + client JS ({{CSS}} placeholder)
│   └── index.css         # All styles and design tokens
└── scripts/
    └── dashboard.mjs     # HTTP server, SSE, generation pipeline
```

The server reads `index.html` and `index.css` at runtime, injects CSS via the `{{CSS}}` placeholder, and serves the composed page. Zero npm dependencies — Node.js builtins only.

## Workflow

1. **Launch the dashboard server**:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/dashboard.mjs" -o output [--name notebook] [--port 3456]
```

This starts a local HTTP server and auto-opens the browser.

2. The dashboard is now **live** — it watches the output directory and vector store for changes and pushes updates to the browser via Server-Sent Events.

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `-o <dir>` | `./output` | Output directory for generated files |
| `--name <name>` | `notebook` | Project name |
| `--port <port>` | `3456` | Server port |

## Features

### Live Dashboard (SPA)
- **Sources panel** — lists ingested documents with page/chunk counts, pulled from `~/.notebook-plugin/stores/<hash>/meta.json`
- **Studio panel** — cards for each output type with one-click generation
- **Outputs panel** — shows generated files with inline preview (HTML via iframe, audio player, CSV→table, JSON highlighting, Markdown rendering, binary download cards)
- **Real-time updates** — SSE stream pushes state changes instantly (no polling)
- **Toast notifications** — generation status feedback

### Generation Pipeline
- **Single-session architecture** — first generation creates a Claude session, subsequent ones `--resume` into it so source material stays in context
- **Queue system** — multiple generation requests are queued and processed sequentially
- **Phases**: queued → running (querying → generating → building) → done/error
- **Temp file cleanup** — intermediate `_<type>_input.json` files are removed after generation

### Server API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the dashboard HTML |
| `/api/state` | GET | Current sources, outputs, chunks |
| `/api/events` | GET | SSE stream for real-time updates |
| `/api/generate/<type>` | POST | Enqueue generation (body: `{ topic }`) |
| `/api/jobs` | GET | Current job statuses |
| `/outputs/<file>` | GET | Serve generated output files |

### Supported Output Types

| Type | Script | Description |
|------|--------|-------------|
| `flashcards` | flashcards.mjs | 15-30 study cards |
| `quiz` | quiz.mjs | 50-question assessment |
| `report` | report.mjs | Executive report (DOCX + HTML) |
| `slide-deck` | slide-deck.mjs | 8-15 slide presentation |
| `mind-map` | mind-map.mjs | Mermaid mindmap diagram |
| `infographic` | infographic.mjs | Visual stats infographic |
| `data-table` | data-table.mjs | Structured data extraction |
| `audio-overview` | audio-overview.sh | Conversational audio summary |

## File Responsibilities

### `scripts/dashboard.mjs` (~454 lines)
Server logic only: CLI args, data gathering from vector store metadata, SSE broadcasting, file watcher, generation pipeline (session management, claude invocation, queue processing), HTTP routing, MIME handling.

### `dashboard/index.html`
Full single-page app: HTML structure (header, 3-column layout, sources sidebar, center panel, studio sidebar, toast container), Google Fonts (Outfit + JetBrains Mono), Lucide icons CDN, and all client-side JavaScript (output type definitions, icon helpers, inline preview system, render functions, SSE connection, toast system, tile click handlers).

### `dashboard/index.css`
All styles: CSS custom properties (design tokens for colors, fonts, radii), base resets, layout grid, component styles (cards, tiles, panels, badges, toasts), inline preview overlay, scrollbar theming, animations, and responsive breakpoints.

## Gotchas

- Sources are read from `~/.notebook-plugin/stores/<md5(cwd)>/meta.json` — run ingest first.
- The `claude` binary path defaults to `/opt/homebrew/bin/claude`. Override with `CLAUDE_BIN` env var.
- Generation requires the `skills/generate/` scripts and `skills/ingest/scripts/query.mjs` to be present.
- `report`, `slide-deck`, `data-table`, and ingest/query scripts require Bun (deps auto-installed). Override path with `BUN_BIN` env var.

$ARGUMENTS
