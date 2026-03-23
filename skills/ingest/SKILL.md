---
name: ingest
description: Ingest and vectorize PDFs or text files for RAG retrieval. Use when the user provides a PDF, document, or text file they want to analyze, study, or generate content from.
argument-hint: "<file-path>"
compatibility: Requires Bun 1.0+. First run downloads ~23MB embedding model.
allowed-tools: Bash(bash *) Bash(bun *) Bash(node *) Read
---

# Ingest Documents

Ingest a PDF or text file into the local vector store for retrieval-augmented generation.

## Workflow

1. Run the ingest script:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/ingest.mjs" $ARGUMENTS
```

2. Verify ingestion:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/list.mjs"
```

3. Confirm to the user: number of chunks and pages. Suggest next actions: report, flashcards, quiz, slides, audio, mind map, infographic, or data table.

## Querying ingested sources

To retrieve relevant chunks for any generation task:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/query.mjs" "<question>" --top-k 15
```

## Gotchas

- First run downloads the all-MiniLM-L6-v2 model (~23MB). Subsequent runs use cache.
- Large PDFs (100+ pages) take 2-5 minutes on CPU — embedding is the bottleneck.
- Scanned/image-only PDFs are automatically OCR'd via Tesseract.js (first OCR run downloads ~15MB language data). Use `--no-ocr` to skip.
- The store persists at `~/.notebook-plugin/` across sessions. Use `clear` to reset.
- Multiple files can be ingested into the same store — they're all searchable together.

## Additional resources

- For supported formats and embedding details, see [references/formats.md](references/formats.md)
