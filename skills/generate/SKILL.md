---
name: generate
description: Generate rich outputs from ingested sources — flashcards, quizzes, reports, slide decks, mind maps, infographics, data tables, or audio overviews. Use when the user wants to create any output from their documents.
argument-hint: "<type> [topic]"
compatibility: Requires Bun 1.0+ and Node.js 18+. Audio requires macOS (uses `say` command).
allowed-tools: Bash(bash *) Bash(bun *) Bash(node *) Write Read
effort: high
---

# Generate Output

Generate one of 8 output types from ingested document sources.

## Output types

| Type | Command | Output files |
|------|---------|-------------|
| `flashcards` | `/notebook:generate flashcards [topic]` | .json + .md + .html (interactive flip cards) |
| `quiz` | `/notebook:generate quiz [topic]` | .json + .md + .html (50 Qs, live scoring) |
| `report` | `/notebook:generate report [topic]` | .md + .docx |
| `slide-deck` | `/notebook:generate slide-deck [topic]` | .pptx |
| `mind-map` | `/notebook:generate mind-map [topic]` | .mmd + .html (Mermaid viewer) |
| `infographic` | `/notebook:generate infographic [topic]` | .html |
| `data-table` | `/notebook:generate data-table [topic]` | .csv + .json + .md + .html (sortable/filterable) |
| `audio-overview` | `/notebook:generate audio-overview [topic]` | .wav (Kokoro TTS) |

## Workflow

1. **Retrieve context** — query ingested sources:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/ingest/scripts/query.mjs" "$ARGUMENTS" --top-k 15
```

2. **Build input JSON** — see the relevant template in [assets/](assets/) for the schema:

| Type | Template | Input key fields |
|------|----------|-----------------|
| flashcards | [assets/flashcards.json](assets/flashcards.json) | `[{ "front", "back", "tags" }]` |
| quiz | [assets/quiz.json](assets/quiz.json) | `{ "title", "questions": [{ "question", "type", "options", "answer", "explanation" }] }` |
| report | [assets/report-docx.json](assets/report-docx.json) | `{ "title", "sections": [{ "heading", "content" }] }` |
| slide-deck | [assets/slide-deck.json](assets/slide-deck.json) | `{ "title", "slides": [{ "title", "bullets"/"body", "notes" }] }` |
| mind-map | [assets/mind-map.mmd](assets/mind-map.mmd) | `{ "label", "children": [...] }` or raw Mermaid |
| infographic | [assets/infographic.json](assets/infographic.json) | `{ "title", "sections": [{ "heading", "content", "icon", "stat" }] }` |
| data-table | [assets/data-table.json](assets/data-table.json) | `{ "headers": [...], "rows": [[...]] }` |
| audio-overview | [assets/audio-overview.json](assets/audio-overview.json) | `{ "segments": [{ "text", "voice" }] }` |

Write input JSON to `output/_<type>_input.json`.

3. **Run the generator**:

```bash
# Flashcards (zero-dep)
node "${CLAUDE_SKILL_DIR}/scripts/flashcards.mjs" -i <input> -o output --name flashcards

# Quiz (zero-dep)
node "${CLAUDE_SKILL_DIR}/scripts/quiz.mjs" -i <input> -o output --name quiz

# Report (bun auto-installs deps)
bun "${CLAUDE_SKILL_DIR}/scripts/report.mjs" -i <input> -o output --name report --format both

# Slide deck (bun auto-installs deps)
bun "${CLAUDE_SKILL_DIR}/scripts/slide-deck.mjs" -i <input> -o output --name slide-deck

# Mind map (zero-dep)
node "${CLAUDE_SKILL_DIR}/scripts/mind-map.mjs" -i <input> -o output --name mind-map

# Infographic (zero-dep)
node "${CLAUDE_SKILL_DIR}/scripts/infographic.mjs" -i <input> -o output --name infographic

# Data table (bun auto-installs deps)
bun "${CLAUDE_SKILL_DIR}/scripts/data-table.mjs" -i <input> -o output --name data-table

# Audio overview (Kokoro TTS neural voice via uv, falls back to macOS say)
uv run --script "${CLAUDE_SKILL_DIR}/scripts/audio-overview.py" -i <input> -o output --name audio-overview
```

4. Report output paths. For HTML outputs, tell user: `open output/<name>.html`

## Quality gates

- **Flashcards**: 15-30 cards, no yes/no questions, tagged by topic
- **Quiz**: 50 questions, 70% MC / 30% SA, explanations for all
- **Report**: executive summary, evidence-backed findings, actionable conclusions
- **Slide deck**: 8-15 content slides, 3-5 bullets each, speaker notes
- **Mind map**: 3-6 main branches, 2-4 sub-topics each, concise labels
- **Infographic**: 5-8 sections, stats highlighted, concise
- **Data table**: specific data points, consistent column formatting
- **Audio**: 8-15 alternating segments, conversational tone, 2-4 sentences each

## Gotchas

- Always query sources first — ground all content in source material
- Slide deck: `bullets` and `body` are mutually exclusive per slide
- Audio: uses Kokoro TTS (82M neural model). Best voices: `af_heart` (female, A-grade), `am_fenrir` (male, C+). Falls back to macOS `say` if Kokoro not installed. Strip URLs and special characters.
- Mind map: Mermaid syntax is indentation-sensitive, avoid `()[]` in labels
- Report DOCX: supports paragraphs and headings only (no tables/images)
- Quiz MC: `answer` field is the letter (A/B/C/D), not the full text

## Additional resources

- Voice options for audio: [references/voices.md](references/voices.md)

$ARGUMENTS
