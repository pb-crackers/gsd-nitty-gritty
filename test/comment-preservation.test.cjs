/**
 * Defect 3 — the destructive one.
 *
 * STATE.md field replacements were unanchored and non-global, so the FIRST
 * `**Status:**` in the file won. When an HTML-comment log quoted the live
 * Status string as evidence, the comment sat above § Current Position — so the
 * replace rewrote the historical record and left the live field untouched.
 * Two failures in one: evidence destroyed, and the intended write skipped.
 */

const { test, gsd, read, assert, assertEqual, assertIncludes } = require('./harness.cjs');
const { project } = require('./fixtures.cjs');

const LIVE_STATUS = 'All six plans executed, the blocking checkpoint APPROVED, MEDIA-01…06 all ticked';

// A log that quotes every field phase complete rewrites, exactly as the real one does.
const EVIDENCE_COMMENT = `<!--
  MISFIRE LOG — quoted verbatim as evidence. Must survive every tool run.

 12. **\`state update-progress\` WROTE THE BODY'S PROSE INTO THE FRONTMATTER.**
     § Current Position's \`**Status:** ${LIVE_STATUS}\` was lifted verbatim into
     \`status:\` — a machine-read enum field given a sentence.
 13. It also left \`**Current Plan:** 6\` and \`**Current Phase:** 07.5\` in place,
     and \`**Last Activity:** 2026-08-01\` was stale by then.
-->`;

function extractComment(text) {
  const match = text.match(/<!--[\s\S]*?-->/);
  return match ? match[0] : null;
}

test('comments: phase complete leaves an HTML-comment log byte-identical', () => {
  const dir = project({ state: { status: LIVE_STATUS, comment: EVIDENCE_COMMENT, currentPlan: '6' } });
  const before = extractComment(read(dir, '.planning/STATE.md'));
  assert(before, 'fixture should contain a comment block');

  gsd(dir, ['phase', 'complete', '07.5']);

  const after = extractComment(read(dir, '.planning/STATE.md'));
  assertEqual(after, before, 'the HTML comment must be byte-identical after phase complete');
});

test('comments: phase complete actually updates the live Current Position fields', () => {
  const dir = project({ state: { status: LIVE_STATUS, comment: EVIDENCE_COMMENT, currentPlan: '6' } });
  gsd(dir, ['phase', 'complete', '07.5']);

  const text = read(dir, '.planning/STATE.md');
  const body = text.slice(text.indexOf('# Project State'));
  assertIncludes(body, '**Current Plan:** Not started', 'the live Current Plan must be rewritten');
  assert(!body.includes(`**Status:** ${LIVE_STATUS}`), 'the live Status must be rewritten, not skipped');
});

test('comments: state update does not edit a field inside a comment', () => {
  const dir = project({ state: { status: LIVE_STATUS, comment: EVIDENCE_COMMENT } });
  const before = extractComment(read(dir, '.planning/STATE.md'));

  gsd(dir, ['state', 'update', 'Status', 'Ready to plan']);

  const text = read(dir, '.planning/STATE.md');
  assertEqual(extractComment(text), before, 'state update must not touch the comment');
  assertIncludes(text.slice(text.indexOf('# Project State')), '**Status:** Ready to plan', 'the live field must be updated');
});

test('comments: state patch does not edit fields inside a comment', () => {
  const dir = project({ state: { status: LIVE_STATUS, comment: EVIDENCE_COMMENT, currentPlan: '6' } });
  const before = extractComment(read(dir, '.planning/STATE.md'));

  gsd(dir, ['state', 'patch', '--current-plan', '2', '--status', 'Ready to execute']);

  const text = read(dir, '.planning/STATE.md');
  assertEqual(extractComment(text), before, 'state patch must not touch the comment');
  assertIncludes(text.slice(text.indexOf('# Project State')), '**Current Plan:** 2', 'the live field must be updated');
});

test('comments: advance-plan reads the live section, not the comment', () => {
  // The comment quotes "**Current Plan:** 6"; the live section says 2.
  const dir = project({ state: { comment: EVIDENCE_COMMENT, currentPlan: '2', totalPlans: '6' } });
  const before = extractComment(read(dir, '.planning/STATE.md'));

  const res = gsd(dir, ['state', 'advance-plan']);

  assertEqual(res.json.previous_plan, 2, 'must read the live Current Plan, not the quoted one');
  assertEqual(res.json.current_plan, 3, 'should advance 2 → 3');
  assertEqual(extractComment(read(dir, '.planning/STATE.md')), before, 'advance-plan must not touch the comment');
});

test('comments: record-session does not edit a Stopped At quoted in a comment', () => {
  const comment = `<!--\n  Log: \`**Stopped At:** Finished a plan\` was written by record-session.\n-->`;
  const dir = project({ state: { comment } });
  const before = extractComment(read(dir, '.planning/STATE.md'));

  gsd(dir, ['state', 'record-session', '--stopped-at', 'Phase closed']);

  const text = read(dir, '.planning/STATE.md');
  assertEqual(extractComment(text), before, 'record-session must not touch the comment');
  assertIncludes(text, '**Stopped At:** Phase closed', 'the live Session field must be updated');
});

test('comments: state get reads the live field, not the quoted one', () => {
  const dir = project({ state: { status: 'Ready to execute', comment: EVIDENCE_COMMENT } });
  const res = gsd(dir, ['state', 'get', 'Status']);

  assertEqual(res.json.Status, 'Ready to execute', 'reads must prefer the live section over quoted history');
});
