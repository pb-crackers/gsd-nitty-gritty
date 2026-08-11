/**
 * Lower-priority item — `requirements mark-complete` closed requirements with
 * no evidence, so a requirement closed on a human's verdict lost the verdict.
 * The tick and the evidence must land in one edit.
 *
 * (The "ticks every id" half of that report lives in the workflow, not the tool:
 * the tool has always taken an explicit id list. workflows/execute-plan.md is
 * what told the executor to pass every id in the plan's frontmatter.)
 */

const { test, gsd, read, assertEqual, assertIncludes, assertNotIncludes } = require('./harness.cjs');
const { project } = require('./fixtures.cjs');

test('requirements: marks only the ids it was given', () => {
  const dir = project({});
  const res = gsd(dir, ['requirements', 'mark-complete', 'MEDIA-01']);

  assertEqual(res.json.updated, true, 'should mark MEDIA-01');
  const reqs = read(dir, '.planning/REQUIREMENTS.md');
  assertIncludes(reqs, '- [x] **MEDIA-01**', 'MEDIA-01 should be ticked');
  assertIncludes(reqs, '- [ ] **MEDIA-02**', 'MEDIA-02 must be left open');
});

test('requirements: --evidence lands with the tick, in one edit', () => {
  const dir = project({});
  const verdict = 'Human verdict on reel-04: "I think this looks good"';
  const res = gsd(dir, ['requirements', 'mark-complete', 'MEDIA-01', '--evidence', verdict]);

  assertEqual(res.json.updated, true, 'should mark MEDIA-01');
  assertEqual(res.json.evidence_recorded, true, 'should report that evidence was written');
  const reqs = read(dir, '.planning/REQUIREMENTS.md');
  assertIncludes(reqs, verdict, 'the evidence text must be in the file');
  assertIncludes(reqs, '- [x] **MEDIA-01**', 'and the box must be ticked');
});

test('requirements: closing without evidence is flagged in the output', () => {
  const dir = project({});
  const res = gsd(dir, ['requirements', 'mark-complete', 'MEDIA-01']);

  assertEqual(res.json.evidence_recorded, false, 'callers should be able to see no evidence was carried');
  assertIncludes(String(res.json.warning || ''), 'evidence', 'a warning should name the missing evidence');
});

test('requirements: an unknown id is reported, not silently skipped', () => {
  const dir = project({});
  const res = gsd(dir, ['requirements', 'mark-complete', 'MEDIA-01', 'NOPE-99']);

  assertEqual(res.json.not_found.length, 1, 'NOPE-99 should be reported as not found');
  assertNotIncludes(read(dir, '.planning/REQUIREMENTS.md'), 'NOPE-99', 'nothing should be invented');
});

test('requirements: an already-ticked id is reported as already_complete, not not_found', () => {
  const dir = project({});
  gsd(dir, ['requirements', 'mark-complete', 'MEDIA-01']);
  const res = gsd(dir, ['requirements', 'mark-complete', 'MEDIA-01']);

  assertEqual(res.json.not_found.length, 0, 'the id exists — it is not missing');
  assertEqual((res.json.already_complete || []).length, 1, 'it should be reported as already complete');
});
