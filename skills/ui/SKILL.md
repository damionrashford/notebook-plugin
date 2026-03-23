---
name: dashboard
description: Generate an interactive NotebookLM-style dashboard for managing sources and outputs. Use when the user wants a visual interface, dashboard, or UI for their notebook.
argument-hint: "[--refresh]"
compatibility: Requires Node.js 18+.
allowed-tools: Bash(bash *) Bash(node *) Write Read
---

# Notebook Dashboard

Generate an enterprise-grade interactive HTML dashboard that mirrors NotebookLM's interface.

## Workflow

1. **Gather state** — list ingested sources and scan for existing outputs:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ingest/scripts/list.mjs"
ls -la output/ 2>/dev/null || echo "No outputs yet"
```

2. **Generate dashboard**:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/dashboard.mjs" -o output --name notebook
```

3. Tell user: `open output/notebook.html`

## Dashboard features

The generated HTML is a fully self-contained single-page app:

- **Sources panel** — lists all ingested documents with page counts and chunk counts
- **Generate panel** — cards for each output type with one-click descriptions
- **Outputs panel** — shows all generated files with timestamps and file sizes
- **Status bar** — vector store location, total chunks, model info
- **Dark theme** — matches NotebookLM's professional aesthetic

## Gotchas

- The dashboard is a static snapshot — re-generate to refresh after new ingests or outputs.
- All CSS and JS are inline — no external dependencies, works offline.
- Pass `--refresh` to regenerate with updated source/output state.

$ARGUMENTS
