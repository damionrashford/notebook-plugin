#!/usr/bin/env node
/**
 * Generate a report in Markdown and/or DOCX format.
 * Usage: node generate.mjs -i <input.json> -o <output-dir> [--name report] [--format md|docx|both]
 *
 * Input JSON (markdown): { "content": "# Full markdown content..." }
 * Input JSON (docx):     { "title": "...", "sections": [{ "heading": "...", "body": "..." }] }
 *
 * Outputs: .md and/or .docx
 * Requires: docx (installed via skill's package.json) — only for DOCX output
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, outputDir: './output', name: 'report', format: 'both' };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) opts.input = args[++i];
    else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) opts.outputDir = args[++i];
    else if ((args[i] === '--name') && args[i + 1]) opts.name = args[++i];
    else if ((args[i] === '--format') && args[i + 1]) opts.format = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate.mjs -i <input.json> -o <output-dir> [--name report] [--format md|docx|both]');
      process.exit(0);
    }
  }
  return opts;
}

async function generateDocx(data, outDir, name) {
  const docxPath = join(SKILL_DIR, 'node_modules', 'docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import(docxPath);

  const children = [
    new Paragraph({ text: data.title, heading: HeadingLevel.TITLE, spacing: { after: 400 } }),
  ];

  for (const section of data.sections) {
    children.push(
      new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
    );
    for (const para of section.body.split('\n\n')) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: para.trim(), size: 24 })], spacing: { after: 200 } })
      );
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buffer = await Packer.toBuffer(doc);
  const outputPath = join(outDir, `${name}.docx`);
  writeFileSync(outputPath, buffer);
  return outputPath;
}

async function main() {
  const opts = parseArgs();
  if (!opts.input) { console.error('Error: -i <input.json> required'); process.exit(1); }

  const data = JSON.parse(readFileSync(resolve(opts.input), 'utf-8'));
  const outDir = resolve(opts.outputDir);
  mkdirSync(outDir, { recursive: true });

  const result = { status: 'success' };

  // Markdown output
  if (opts.format === 'md' || opts.format === 'both') {
    let mdContent = data.content;
    if (!mdContent && data.title && data.sections) {
      mdContent = `# ${data.title}\n\n`;
      for (const s of data.sections) {
        mdContent += `## ${s.heading}\n\n${s.body}\n\n`;
      }
    }
    if (mdContent) {
      const mdPath = join(outDir, `${opts.name}.md`);
      writeFileSync(mdPath, mdContent);
      result.markdown = mdPath;
    }
  }

  // DOCX output
  if ((opts.format === 'docx' || opts.format === 'both') && data.title && data.sections) {
    const docxPath = await generateDocx(data, outDir, opts.name);
    result.docx = docxPath;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => { console.error('Report generation failed:', err.message); process.exit(1); });
