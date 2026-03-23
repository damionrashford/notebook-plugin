# Supported Formats

## PDF Files (.pdf)
- Text-based and scanned/image-only PDFs are both supported
- Text-based PDFs are parsed directly via pdf-parse
- Scanned PDFs are automatically detected (< 50 chars/page) and OCR'd via Tesseract.js + pdf-img-convert
- Use `--no-ocr` flag to skip OCR if not needed
- First OCR run downloads ~15MB language data (cached after)
- Extracts text, page count, and metadata (title, author, creator)

## Text Files
- Any plain text file (`.txt`, `.md`, `.csv`, etc.)
- Read as UTF-8

## Chunking Details
- Default chunk size: ~2000 characters
- Overlap: ~200 characters between chunks
- Splits on paragraph boundaries, falls back to sentence boundaries
- Very large single paragraphs are split by sentences

## Embedding Model
- Model: all-MiniLM-L6-v2 (via @huggingface/transformers)
- Dimensions: 384
- Runs locally on CPU via ONNX runtime
- ~23MB download on first use, cached at `~/.cache/huggingface/`
- Max token length: 512 tokens per chunk

## Vector Store
- Uses Vectra (local file-based vector index)
- Stored at `~/.notebook-plugin/stores/<project-hash>/`
- Supports hybrid BM25 + vector search
- No external database required
