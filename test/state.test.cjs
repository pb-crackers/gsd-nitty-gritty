/**
 * Defect 2 — every state command rebuilt the whole frontmatter by scraping prose,
 * so prose landed in a machine-read enum and hand-corrections were reverted.
 *
 * Defect 4 — three disagreeing sources of truth for completed_phases.
 */

const { test, gsd, read, write, assert, assertEqual, assertIncludes, assertNotIncludes } = require('./harness.cjs');
const { project, defaultFrontmatter } = require('./fixtures.cjs');

const PROSE_STATUS = 'All six plans executed, the blocking checkpoint APPROVED, MEDIA-01…06 all ticked';
const VALID_STATUSES = ['planning', 'discussing', 'executing', 'verifying', 'awaiting_verdict', 'paused', 'completed', 'unknown'];

test('state: prose Status never lands in the frontmatter enum', () => {
  const dir = project({ state: { status: PROSE_STATUS } });
  gsd(dir, ['state', 'update-progress']);

  const stateText = read(dir, '.planning/STATE.md');
  const fmBlock = stateText.match(/^---\n([\s\S]*?)\n---/)[1];
  assertNotIncludes(fmBlock, 'blocking checkpoint', 'a sentence must never be written into status:');

  const res = gsd(dir, ['state', 'json']);
  assert(VALID_STATUSES.includes(res.json.status), `status must be a known enum member, got: ${JSON.stringify(res.json.status)}`);
});

test('state: unrecognized prose Status preserves the existing frontmatter status', () => {
  const dir = project({ state: { status: PROSE_STATUS } });
  // Frontmatter fixture carries status: executing — an unparseable body must not clobber it.
  gsd(dir, ['state', 'update-progress']);

  const res = gsd(dir, ['state', 'json']);
  assertEqual(res.json.status, 'executing', 'unparseable prose must fall back to the stored value');
});

test('state: the body prose itself is left alone (it is a human restatement)', () => {
  const dir = project({ state: { status: PROSE_STATUS } });
  gsd(dir, ['state', 'update-progress']);

  const stateText = read(dir, '.planning/STATE.md');
  assertIncludes(stateText, `**Status:** ${PROSE_STATUS}`, 'the markdown body must be untouched');
});

test('state: a hand-corrected frontmatter status survives record-session', () => {
  const dir = project({ state: { status: PROSE_STATUS } });

  // Hand-correct the frontmatter the way the project's agents had to.
  let stateText = read(dir, '.planning/STATE.md');
  stateText = stateText.replace(/^status: .*/m, 'status: completed');
  write(dir, '.planning/STATE.md', stateText);

  gsd(dir, ['state', 'record-session', '--stopped-at', 'Phase closed']);

  const res = gsd(dir, ['state', 'json']);
  assertEqual(res.json.status, 'completed', 'record-session must not revert a hand-correction');
});

test('state: recognized Status prose still normalizes', () => {
  const dir = project({ state: { status: 'Executing plan 4 of 6' } });
  gsd(dir, ['state', 'update-progress']);
  const res = gsd(dir, ['state', 'json']);
  assertEqual(res.json.status, 'executing', 'a Status the tool understands should still drive the enum');
});

test('state: advance-plan parses "3/9" in Total Plans in Phase', () => {
  const dir = project({ state: { currentPlan: '3', totalPlans: '3/9' } });
  const res = gsd(dir, ['state', 'advance-plan']);

  assert(!(res.json && res.json.error), `advance-plan must not error on 3/9, got: ${res.json && res.json.error}`);
  assertEqual(res.json.total_plans, 9, 'the denominator is the total');
  assertEqual(res.json.advanced, true, 'plan 3 of 9 can advance');
  assertEqual(res.json.current_plan, 4, 'should advance to 4');
});

test('state: advance-plan parses "03 of 9" in Current Plan', () => {
  const dir = project({ state: { currentPlan: '03 of 9', totalPlans: '9' } });
  const res = gsd(dir, ['state', 'advance-plan']);

  assert(!(res.json && res.json.error), `advance-plan must not error on "03 of 9", got: ${res.json && res.json.error}`);
  assertEqual(res.json.current_plan, 4, 'should advance 3 → 4');
});

test('state: advance-plan reports which field it could not parse', () => {
  const dir = project({ state: { currentPlan: 'Not started', totalPlans: 'unknown' } });
  const res = gsd(dir, ['state', 'advance-plan']);

  assert(res.json && res.json.error, 'genuinely unparseable input should still error');
  assertIncludes(res.json.error, 'Total Plans in Phase', 'the error should name the offending field');
});

// ─── Defect 4: three sources of truth ────────────────────────────────────────

// Frontmatter round-trips through YAML text, so counts come back as strings.
// The tests care about the value, not the encoding.
function readProgress(dir) {
  const progress = gsd(dir, ['state', 'json']).json.progress || {};
  const numeric = {};
  for (const [key, value] of Object.entries(progress)) {
    numeric[key] = value === undefined ? undefined : Number(value);
  }
  return numeric;
}

test('state: completed_phases follows ROADMAP checkboxes, not disk', () => {
  // Roadmap ticks 2 of 3 phases. Disk has 3 complete phase dirs. Frontmatter claims 2.
  const dir = project({
    roadmap: { rowPhase: '7.5', tickedPhases: 2 },
    phases: {
      '01-foundations': { plans: 2, summaries: 2 },
      '02-pipeline': { plans: 1, summaries: 1 },
    },
  });

  gsd(dir, ['state', 'update-progress']);
  const res = readProgress(dir);

  assertEqual(res.completed_phases, 2, 'roadmap checkboxes are canonical');
});

test('state: a disk/roadmap disagreement is reported, not silently swallowed', () => {
  const dir = project({
    roadmap: { rowPhase: '7.5', tickedPhases: 2 },
    phases: {
      '01-foundations': { plans: 2, summaries: 2 },
      '02-pipeline': { plans: 1, summaries: 1 },
    },
  });

  gsd(dir, ['state', 'update-progress']);
  const res = readProgress(dir);

  assertEqual(res.completed_phases_disk, 3, 'the disk count must remain visible when it disagrees');
});

test('state: agreeing sources produce no discrepancy key', () => {
  const dir = project({
    roadmap: { rowPhase: '7.5', tickedPhases: 3 },
    phases: {
      '01-foundations': { plans: 2, summaries: 2 },
      '02-pipeline': { plans: 1, summaries: 1 },
    },
  });

  gsd(dir, ['state', 'update-progress']);
  const res = readProgress(dir);

  assertEqual(res.completed_phases, 3, 'both agree on 3');
  assertEqual(res.completed_phases_disk, undefined, 'no noise when they agree');
});

test('state: completing a phase never decrements completed_phases', () => {
  const dir = project({
    roadmap: { rowPhase: '7.5', tickedPhases: 2 },
    phases: {
      '01-foundations': { plans: 2, summaries: 2 },
      '02-pipeline': { plans: 1, summaries: 1 },
    },
  });

  const before = readProgress(dir).completed_phases;
  gsd(dir, ['phase', 'complete', '07.5']);
  const after = readProgress(dir).completed_phases;

  assert(after >= before, `completing a phase decremented the count: ${before} → ${after}`);
  assertEqual(after, 3, 'phase complete ticks the third checkbox, so the count rises to 3');
});

test('state: no ROADMAP checkboxes at all falls back to disk', () => {
  const dir = project({ roadmap: { rowPhase: '7.5', tickedPhases: 0 } });
  gsd(dir, ['state', 'update-progress']);
  const res = readProgress(dir);

  assertEqual(res.completed_phases, 0, 'nothing ticked means nothing complete');
});

test('state: a near-miss status written by hand is understood, not discarded', () => {
  const dir = project({ state: { status: PROSE_STATUS } });
  let text = read(dir, '.planning/STATE.md');
  write(dir, '.planning/STATE.md', text.replace(/^status: .*/m, 'status: complete'));

  gsd(dir, ['state', 'update-progress']);

  assertEqual(gsd(dir, ['state', 'json']).json.status, 'completed', 'complete → completed, not unknown');
});

test('init: all_phases_complete follows the roadmap, not "has any summary"', () => {
  // Phase 07.5 has 6 plans but only 1 summary, and the roadmap ticks nothing.
  const dir = project({ roadmap: { rowPhase: '7.5', tickedPhases: 0 }, plans: 6, summaries: 1 });
  const res = gsd(dir, ['init', 'milestone-op']);

  assertEqual(res.json.completed_phases, 0, 'one summary in a six-plan phase is not a complete phase');
  assertEqual(res.json.all_phases_complete, false, 'must not declare a milestone done mid-phase');
});

test('state: "awaiting a human verdict" is its own state, not verifying', () => {
  const dir = project({ state: { status: 'AWAITING the reel-04 human verdict at the blocking checkpoint' } });
  gsd(dir, ['state', 'update-progress']);

  assertEqual(gsd(dir, ['state', 'json']).json.status, 'awaiting_verdict', 'blocked on a human is not verifying');
});

test('state: a hand-written awaiting_verdict survives', () => {
  const dir = project({ state: { status: PROSE_STATUS } });
  const text = read(dir, '.planning/STATE.md');
  write(dir, '.planning/STATE.md', text.replace(/^status: .*/m, 'status: awaiting_verdict'));

  gsd(dir, ['state', 'record-session', '--stopped-at', 'held']);

  assertEqual(gsd(dir, ['state', 'json']).json.status, 'awaiting_verdict', 'must not be normalized away');
});
