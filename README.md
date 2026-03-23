# Notebook Plugin for Claude Code

A NotebookLM-style research assistant plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Ingest PDFs and text files, then generate rich outputs from your sources — all from the command line.

## What it does

1. **Ingest** PDFs or text files into a local vector store (with automatic OCR for scanned documents)
2. **Query** your sources using semantic search powered by local embeddings
3. **Generate** 8 different output types grounded in your source material
4. **Review** outputs through a 3-agent pipeline that checks accuracy against sources

### Output types

| Type | Description | Output files |
|------|-------------|-------------|
| Flashcards | Interactive study cards with flip animations, tag filtering, keyboard nav | .json + .md + .html |
| Quiz | 50-question assessment with live scoring, letter grades, answer review | .json + .md + .html |
| Report | Structured analysis with executive summary and evidence-backed findings | .md + .docx |
| Slide Deck | Professional presentation with speaker notes | .pptx |
| Mind Map | Interactive diagram with pan/zoom canvas and Mermaid rendering | .mmd + .html |
| Infographic | Visual summary with scroll animations, floating TOC, and stat callouts | .html |
| Data Table | Sortable/filterable table with search, pagination, and CSV/JSON export | .csv + .json + .md + .html |
| Audio Overview | Podcast-style two-host discussion using macOS text-to-speech | .aiff |

All HTML outputs feature a unified dark theme with Inter typography, Lucide icons, keyboard shortcuts, and responsive design.

## Installation

### From GitHub (marketplace)

```
/plugin marketplace add damionrashford/notebook-plugin
/plugin install notebook@notebook-marketplace
```

### Direct install

```
/plugin install damionrashford/notebook-plugin
```

### Requirements

- **Node.js 18+** (for all generators and the RAG pipeline)
- **macOS** (required only for Audio Overview — uses the `say` command)
- Dependencies install automatically on first session via the SessionStart hook

## Usage

### Ingest sources

```
/notebook:ingest path/to/document.pdf
/notebook:ingest path/to/notes.txt
```

Supports text-based PDFs and scanned PDFs (auto-OCR via Tesseract.js). Multiple files can be ingested into the same store.

### Generate outputs

```
/notebook:generate flashcards
/notebook:generate quiz
/notebook:generate report
/notebook:generate slide-deck
/notebook:generate mind-map
/notebook:generate infographic
/notebook:generate data-table
/notebook:generate audio-overview
```

Add an optional topic to focus the output:

```
/notebook:generate flashcards neural networks
/notebook:generate report transformer architecture
```

### View dashboard

```
/notebook:dashboard
```

Generates a NotebookLM-style HTML dashboard showing your ingested sources, available output types, and generated files.

### Direct CLI access

```bash
# Query the vector store directly
NODE_PATH="~/.claude/plugins/data/notebook/node_modules" node skills/ingest/scripts/query.mjs "your question" --top-k 15

# List ingested sources
node skills/ingest/scripts/list.mjs
```

## Architecture

### 3-Agent pipeline

The plugin uses three orchestrated agents:

| Agent | Role | Access |
|-------|------|--------|
| **Researcher** | Deep document analysis — runs 5-10 queries to explore sources from multiple angles | Read-only |
| **Writer** | Generates all output artifacts from research findings | Full write access |
| **Critic** | Reviews outputs against source material, catches errors and gaps | Read-only |

**Pipeline flow**: Researcher analyzes sources -> Writer generates artifact -> Critic reviews against sources -> Writer revises if needed

### RAG pipeline

- **PDF parsing**: pdf-parse with Tesseract.js OCR fallback for scanned documents
- **Chunking**: Semantic text splitting with configurable overlap
- **Embeddings**: Local model via @huggingface/transformers (all-MiniLM-L6-v2, 384 dimensions)
- **Vector store**: Vectra (local, file-based — no external services needed)
- **Storage**: `~/.notebook-plugin/stores/<project-hash>/` — persists across sessions

### Key paths

| Path | Purpose |
|------|---------|
| `~/.notebook-plugin/` | Vector store and embedding model cache |
| `./output/` | All generated artifacts |
| `~/.claude/plugins/data/notebook/` | Installed npm dependencies (managed by hook) |

## 3 Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| **ingest** | `/notebook:ingest <file>` | PDF/text ingestion with OCR into vector store |
| **generate** | `/notebook:generate <type> [topic]` | Generate any of the 8 output types |
| **dashboard** | `/notebook:dashboard` | Interactive HTML dashboard of sources and outputs |

## Sample sources to get started

Looking for PDFs to test with? Here are free ML/AI/DL textbooks:

- [Free ML, AI, and DL Books (Reddit thread)](https://www.reddit.com/r/learnmachinelearning/comments/1i443cm/free_ml_ai_and_dl_books_google_drive_link/) — community-curated collection
- [Google Drive folder with textbooks](https://drive.google.com/drive/folders/1jIJMyBOeWiVxLCUUtLvEFEFCnWxbh6cs?usp=sharing) — direct download links

Download any PDF, then:

```
/notebook:ingest ~/Downloads/deep-learning-book.pdf
/notebook:generate flashcards deep learning
/notebook:generate quiz neural networks
/notebook:generate report key concepts
```

## Notes

- First ingest downloads a ~23MB embedding model + ~15MB OCR data (cached after first run)
- Large PDFs (100+ pages) may take 2-5 minutes on CPU due to embedding computation
- Vector store persists across sessions — no need to re-ingest
- All outputs go to `./output/` — HTML files can be opened directly in a browser

## License

MIT
