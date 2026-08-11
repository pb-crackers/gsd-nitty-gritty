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

/**
 * Two figures, because 29 of 38 command files reference their workflow with @
 * twice — once in <execution_context> and once in the prose line "Execute the X
 * workflow from @path". Whether the harness expands both or collapses them is
 * not observable from here, so report both bounds rather than pick one:
 *
 *   bytes    — every @ reference expanded (upper bound)
 *   uniqueBytes — each distinct file counted once (lower bound)
 */
function loadFor(commandFile) {
  const text = fs.readFileSync(commandFile, 'utf-8');
  const base = Buffer.byteLength(text);
  let bytes = base;
  let uniqueBytes = base;
  const seen = new Set();
  const dupes = [];
  for (const match of text.matchAll(/@(\/\S+\.md)/g)) {
    let size;
    try { size = fs.statSync(match[1]).size; } catch { continue; }
    bytes += size;
    if (seen.has(match[1])) dupes.push(path.basename(match[1]));
    else { seen.add(match[1]); uniqueBytes += size; }
  }
  return { bytes, uniqueBytes, dupes };
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
process.stdout.write('Instruction load per command — all @ refs expanded / deduplicated:\n\n');
for (const row of rows) {
  const dupe = row.dupes.length ? `  (dup: ${row.dupes.join(', ')})` : '';
  process.stdout.write(
    `  ${String(tokens(row.bytes)).padStart(6)} / ${String(tokens(row.uniqueBytes)).padStart(6)} tok  /gsd:${row.name}${dupe}\n`
  );
}
const med = (key) => {
  const sorted = rows.map(r => r[key]).sort((a, b) => a - b);
  return tokens(sorted[Math.floor(sorted.length / 2)]);
};
const sum = (key) => tokens(rows.reduce((s, r) => s + r[key], 0));
process.stdout.write(`\n  median: ${med('bytes')} / ${med('uniqueBytes')} tok`);
process.stdout.write(`   total: ${sum('bytes')} / ${sum('uniqueBytes')} tok\n`);
const dup = rows.filter(r => r.dupes.length).length;
process.stdout.write(`  ${dup} of ${rows.length} commands reference a file with @ more than once\n`);
