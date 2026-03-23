#!/usr/bin/env node
/**
 * Generate a PowerPoint slide deck from JSON input.
 * Usage: node generate.mjs -i <input.json> -o <output-dir> [--name slide-deck]
 *
 * Input JSON: { "title": "...", "subtitle": "...", "author": "...", "slides": [{ "title": "...", "bullets": [...], "notes": "...", "body": "..." }] }
 * Outputs: .pptx
 *
 * Requires: pptxgenjs (installed via skill's package.json)
 */
import { readFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');

// Resolve pptxgenjs from skill's own node_modules
const PptxGenJS = (await import(join(SKILL_DIR, 'node_modules', 'pptxgenjs', 'dist', 'pptxgenjs.es.js'))).default;

const THEME = {
  bg: '1a1a2e',
  title: 'e94560',
  text: 'eaeaea',
  accent: '0f3460',
  font: 'Helvetica',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, outputDir: './output', name: 'slide-deck' };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) opts.input = args[++i];
    else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) opts.outputDir = args[++i];
    else if ((args[i] === '--name') && args[i + 1]) opts.name = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate.mjs -i <input.json> -o <output-dir> [--name slide-deck]');
      process.exit(0);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  if (!opts.input) { console.error('Error: -i <input.json> required'); process.exit(1); }

  const data = JSON.parse(readFileSync(resolve(opts.input), 'utf-8'));
  const outDir = resolve(opts.outputDir);
  mkdirSync(outDir, { recursive: true });

  const pptx = new PptxGenJS();
  pptx.author = data.author || 'Notebook Plugin';
  pptx.title = data.title;

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: THEME.bg };
  titleSlide.addText(data.title, {
    x: 0.5, y: 1.5, w: 9, h: 2,
    fontSize: 36, fontFace: THEME.font, color: THEME.title, bold: true, align: 'center',
  });
  if (data.subtitle) {
    titleSlide.addText(data.subtitle, {
      x: 0.5, y: 3.5, w: 9, h: 1,
      fontSize: 18, fontFace: THEME.font, color: THEME.text, align: 'center',
    });
  }

  // Content slides
  for (const slide of data.slides) {
    const s = pptx.addSlide();
    s.background = { color: THEME.bg };
    s.addText(slide.title, {
      x: 0.5, y: 0.3, w: 9, h: 0.8,
      fontSize: 24, fontFace: THEME.font, color: THEME.title, bold: true,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.1, w: 9, h: 0.03, fill: { color: THEME.accent },
    });

    if (slide.bullets?.length) {
      s.addText(
        slide.bullets.map((b) => ({
          text: b,
          options: {
            bullet: true, fontSize: 16, fontFace: THEME.font,
            color: THEME.text, breakType: 'break', paraSpaceAfter: 8,
          },
        })),
        { x: 0.8, y: 1.4, w: 8.5, h: 4 }
      );
    } else if (slide.body) {
      s.addText(slide.body, {
        x: 0.8, y: 1.4, w: 8.5, h: 4,
        fontSize: 14, fontFace: THEME.font, color: THEME.text, valign: 'top',
      });
    }

    if (slide.notes) s.addNotes(slide.notes);
  }

  const outputPath = join(outDir, `${opts.name}.pptx`);
  await pptx.writeFile({ fileName: outputPath });

  console.log(JSON.stringify({ status: 'success', pptx: outputPath, slides: data.slides.length + 1 }, null, 2));
}

main().catch((err) => { console.error('Slide generation failed:', err.message); process.exit(1); });
