#!/usr/bin/env node
/**
 * Measure the instruction load each /gsd: command pulls into context.
 *
 * The size of workflows/ is not the interesting number — what matters is what a
 * single command drags in before doing any work, since a command file
 * @-includes its workflow and templates up front. Run before and after any
 * condensing pass and record the delta.
 *
 * Usage: node bin/dev/measure-workflows.cjs [commandsDir]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// Piping into `head` closes stdout early; that is not an error worth a stack trace.
process.stdout.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0); });

const commandsDir = process.argv[2] || path.join(os.homedir(), '.claude', 'commands', 'gsd');
const repoRoot = path.join(__dirname, '..', '..');

// Rough but stable: bytes/4. Consistent across runs, which is all a delta needs.
const tokens = (bytes) => Math.round(bytes / 4);

function loadFor(commandFile) {
  const text = fs.readFileSync(commandFile, 'utf-8');
  let bytes = Buffer.byteLength(text);
  const includes = [];
  for (const match of text.matchAll(/@(\/\S+\.md)/g)) {
    try {
      bytes += fs.statSync(match[1]).size;
      includes.push(path.basename(match[1]));
    } catch { /* include points somewhere this machine does not have */ }
  }
  return { bytes, includes };
}

function corpus() {
  const dir = path.join(repoRoot, 'workflows');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
  return { files: files.length, bytes };
}

if (!fs.existsSync(commandsDir)) {
  process.stderr.write(`Commands directory not found: ${commandsDir}\n`);
  process.exit(1);
}

const rows = fs.readdirSync(commandsDir)
  .filter(f => f.endsWith('.md'))
  .map(f => ({ name: f.replace(/\.md$/, ''), ...loadFor(path.join(commandsDir, f)) }))
  .sort((a, b) => b.bytes - a.bytes);

const { files, bytes } = corpus();
process.stdout.write(`workflows/: ${files} files, ${bytes} bytes, ~${tokens(bytes)} tok\n\n`);
process.stdout.write('Instruction load per command (command file + @-included files):\n\n');
for (const row of rows) {
  process.stdout.write(`  ${String(tokens(row.bytes)).padStart(6)} tok  /gsd:${row.name}\n`);
}
const sorted = rows.map(r => r.bytes).sort((a, b) => a - b);
process.stdout.write(`\n  median: ${tokens(sorted[Math.floor(sorted.length / 2)])} tok`);
process.stdout.write(`   total: ${tokens(rows.reduce((s, r) => s + r.bytes, 0))} tok\n`);
