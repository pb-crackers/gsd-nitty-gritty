/**
 * Minimal regression harness for gsd-tools.
 *
 * No framework, no dependencies. Tests spawn the real CLI against throwaway
 * project directories in os.tmpdir(), because every command ends in
 * process.exit() and cannot be called in-process.
 *
 * Run with: node test/run.cjs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

const tests = [];
const tempDirs = [];

function test(name, fn) {
  tests.push({ name, fn });
}

/** Create a throwaway project dir from a {relativePath: content} map. */
function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-'));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

/** Run gsd-tools in a project dir. Returns {code, stdout, stderr, json}. */
function gsd(dir, args) {
  const result = spawnSync('node', [TOOL, ...args], { cwd: dir, encoding: 'utf-8' });
  let json = null;
  try { json = JSON.parse(result.stdout); } catch { /* raw or error output */ }
  return {
    code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    json,
  };
}

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf-8');
}

function write(dir, rel, content) {
  fs.writeFileSync(path.join(dir, rel), content, 'utf-8');
}

// ─── Assertions ──────────────────────────────────────────────────────────────

class AssertionError extends Error {}

function fail(message) {
  throw new AssertionError(message);
}

function assert(condition, message) {
  if (!condition) fail(message || 'assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(`${message || 'values differ'}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(haystack, needle, message) {
  if (!String(haystack).includes(needle)) {
    fail(`${message || 'substring missing'}\n    expected to find: ${JSON.stringify(needle)}\n    in: ${JSON.stringify(String(haystack).slice(0, 400))}`);
  }
}

function assertNotIncludes(haystack, needle, message) {
  if (String(haystack).includes(needle)) {
    fail(`${message || 'unexpected substring'}\n    expected NOT to find: ${JSON.stringify(needle)}`);
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

function cleanup() {
  for (const dir of tempDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

function runAll() {
  const filter = process.argv[2] || '';
  const selected = filter ? tests.filter(t => t.name.includes(filter)) : tests;

  let passed = 0;
  const failures = [];

  for (const t of selected) {
    try {
      t.fn();
      passed++;
      process.stdout.write(`  [32mok[0m   ${t.name}\n`);
    } catch (err) {
      failures.push({ name: t.name, err });
      process.stdout.write(`  [31mFAIL[0m ${t.name}\n`);
    }
  }

  if (failures.length > 0) {
    process.stdout.write('\n');
    for (const f of failures) {
      process.stdout.write(`[31m${f.name}[0m\n`);
      const msg = f.err instanceof AssertionError ? f.err.message : (f.err.stack || String(f.err));
      process.stdout.write(`    ${msg.split('\n').join('\n    ')}\n\n`);
    }
  }

  process.stdout.write(`\n${passed}/${selected.length} passed\n`);
  cleanup();
  process.exit(failures.length > 0 ? 1 : 0);
}

module.exports = {
  test,
  makeProject,
  gsd,
  read,
  write,
  assert,
  assertEqual,
  assertIncludes,
  assertNotIncludes,
  fail,
  runAll,
};
