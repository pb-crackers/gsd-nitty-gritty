#!/usr/bin/env node

/**
 * Install GSD from this repo into a Claude Code runtime directory.
 *
 * This repo is the source of truth. Claude Code only sees commands in
 * <runtime>/commands/gsd/ and agents in <runtime>/agents/, so those have to be
 * put there — either as symlinks back to the repo (for whoever maintains it) or
 * as copies (for anyone who cloned it).
 *
 *   node bin/install.cjs              symlink — repo edits are live immediately
 *   node bin/install.cjs --copy       copy — snapshot, re-run after pulling
 *   node bin/install.cjs --dry-run    show what would happen
 *   node bin/install.cjs --runtime ~/.config/opencode
 *
 * Anything it replaces is backed up to <runtime>/gsd-backup-<n>/ first.
 * `workflows/`, `references/`, `templates/` and `bin/` are NOT installed — the
 * command files reference them by absolute path inside this repo.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const args = process.argv.slice(2);
const mode = args.includes('--copy') ? 'copy' : 'link';
const dryRun = args.includes('--dry-run');
const runtimeArg = args.indexOf('--runtime');
const runtime = runtimeArg !== -1 && args[runtimeArg + 1]
  ? path.resolve(args[runtimeArg + 1].replace(/^~/, os.homedir()))
  : path.join(os.homedir(), '.claude');

const log = (msg) => process.stdout.write(msg + '\n');
const plan = [];

function backupDir() {
  let n = 1;
  while (fs.existsSync(path.join(runtime, `gsd-backup-${n}`))) n++;
  return path.join(runtime, `gsd-backup-${n}`);
}

/** Move an existing path into the backup dir, preserving its relative name. */
function preserve(target, backup, relName) {
  if (!fs.existsSync(target) && !fs.lstatSync(target, { throwIfNoEntry: false })) return;
  if (dryRun) { plan.push(`backup   ${relName}`); return; }
  fs.mkdirSync(backup, { recursive: true });
  fs.renameSync(target, path.join(backup, relName));
}

function installCommands(backup) {
  const src = path.join(repoRoot, 'commands', 'gsd');
  const dest = path.join(runtime, 'commands', 'gsd');
  if (fs.lstatSync(dest, { throwIfNoEntry: false })) preserve(dest, backup, 'commands-gsd');
  if (dryRun) { plan.push(`${mode.padEnd(8)} commands/gsd/ -> ${dest}`); return; }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (mode === 'link') {
    fs.symlinkSync(src, dest, 'dir');
  } else {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
}

function installAgents(backup) {
  const src = path.join(repoRoot, 'agents');
  const dest = path.join(runtime, 'agents');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src).filter(n => n.endsWith('.md'))) {
    const target = path.join(dest, f);
    // Agents share a directory with the user's own, so replace file by file.
    if (fs.lstatSync(target, { throwIfNoEntry: false })) preserve(target, backup, f);
    if (dryRun) { plan.push(`${mode.padEnd(8)} agents/${f}`); continue; }
    if (mode === 'link') fs.symlinkSync(path.join(src, f), target);
    else fs.copyFileSync(path.join(src, f), target);
  }
}

if (!fs.existsSync(path.join(repoRoot, 'commands', 'gsd'))) {
  process.stderr.write('No commands/gsd/ in this repo — nothing to install.\n');
  process.exit(1);
}

const backup = backupDir();
log(`GSD ${fs.readFileSync(path.join(repoRoot, 'VERSION'), 'utf-8').trim()}`);
log(`  source:  ${repoRoot}`);
log(`  runtime: ${runtime}`);
log(`  mode:    ${mode}${dryRun ? ' (dry run)' : ''}\n`);

installCommands(backup);
installAgents(backup);

if (dryRun) {
  for (const line of plan) log('  ' + line);
  log(`\n${plan.length} operations. Re-run without --dry-run to apply.`);
} else {
  const commands = fs.readdirSync(path.join(repoRoot, 'commands', 'gsd')).length;
  const agents = fs.readdirSync(path.join(repoRoot, 'agents')).filter(n => n.endsWith('.md')).length;
  log(`  ${commands} commands, ${agents} agents installed.`);
  if (fs.existsSync(backup)) log(`  Replaced files backed up to ${backup}`);
  log(mode === 'link'
    ? '\n  Symlinked — edits in this repo are live immediately.'
    : '\n  Copied — re-run after pulling changes.');
}
