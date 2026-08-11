/**
 * Defect 1 — `roadmap update-plan-progress` reported writes it did not make.
 *
 * The regex was built from the raw argument (`07.5`) while the roadmap row was
 * spelled `7.5`, so every replace no-op'd, the file was rewritten byte-identical,
 * and `updated: true` was returned unconditionally.
 */

const { test, gsd, read, assert, assertEqual, assertIncludes } = require('./harness.cjs');
const { project } = require('./fixtures.cjs');

test('roadmap: unpadded row (7.5) updates when called with padded arg (07.5)', () => {
  const dir = project({ roadmap: { rowPhase: '7.5', headingPhase: '07.5' } });
  const res = gsd(dir, ['roadmap', 'update-plan-progress', '07.5']);

  assertEqual(res.json && res.json.updated, true, 'should report updated');
  const roadmapText = read(dir, '.planning/ROADMAP.md');
  assertIncludes(roadmapText, '| 6/6 ', 'progress table row should carry 6/6');
  assertIncludes(roadmapText, '6/6 plans complete', 'phase detail Plans: line should be updated');
  assertIncludes(roadmapText, '- [x] **Phase 7.5:', 'checklist checkbox should be ticked');
});

test('roadmap: padded row (07.5) updates when called with unpadded arg (7.5)', () => {
  const dir = project({ roadmap: { rowPhase: '07.5', headingPhase: '07.5' } });
  const res = gsd(dir, ['roadmap', 'update-plan-progress', '7.5']);

  assertEqual(res.json && res.json.updated, true, 'should report updated');
  const roadmapText = read(dir, '.planning/ROADMAP.md');
  assertIncludes(roadmapText, '| 6/6 ', 'progress table row should carry 6/6');
  assertIncludes(roadmapText, '- [x] **Phase 07.5:', 'checklist checkbox should be ticked');
});

test('roadmap: partial progress writes In Progress, not Complete', () => {
  const dir = project({ roadmap: { rowPhase: '7.5' }, plans: 6, summaries: 3 });
  const res = gsd(dir, ['roadmap', 'update-plan-progress', '07.5']);

  assertEqual(res.json && res.json.updated, true, 'should report updated');
  const roadmapText = read(dir, '.planning/ROADMAP.md');
  assertIncludes(roadmapText, '| 3/6 ', 'progress table row should carry 3/6');
  assertIncludes(roadmapText, 'In Progress', 'status column should read In Progress');
  assert(!/- \[x\] \*\*Phase 7\.5:/.test(roadmapText), 'checkbox must not be ticked while incomplete');
});

test('roadmap: phase absent from roadmap returns updated:false and does not rewrite the file', () => {
  const dir = project({
    roadmap: { rowPhase: '7.5' },
    phases: { '09-orphan': { plans: 2, summaries: 2 } },
  });
  const before = read(dir, '.planning/ROADMAP.md');
  const res = gsd(dir, ['roadmap', 'update-plan-progress', '09']);

  assertEqual(res.json && res.json.updated, false, 'must not claim a write it did not make');
  assert(res.json && res.json.reason, 'should explain why nothing was updated');
  assertEqual(read(dir, '.planning/ROADMAP.md'), before, 'ROADMAP.md must be byte-identical');
});

test('roadmap: a second identical run reports updated:false (idempotent, honest)', () => {
  const dir = project({ roadmap: { rowPhase: '7.5' } });
  gsd(dir, ['roadmap', 'update-plan-progress', '07.5']);
  const after = read(dir, '.planning/ROADMAP.md');
  const res = gsd(dir, ['roadmap', 'update-plan-progress', '07.5']);

  assertEqual(res.json && res.json.updated, false, 'nothing changed, so updated must be false');
  assertEqual(read(dir, '.planning/ROADMAP.md'), after, 'ROADMAP.md must be byte-identical');
});

test('roadmap: get-phase finds a padded heading from an unpadded argument', () => {
  const dir = project({ roadmap: { rowPhase: '7.5', headingPhase: '07.5' } });
  const res = gsd(dir, ['roadmap', 'get-phase', '7.5']);

  assertEqual(res.json && res.json.found, true, 'padded heading should be found from unpadded arg');
  assert(!(res.json && res.json.error === 'malformed_roadmap'), 'must not report a spurious malformed_roadmap');
});

test('roadmap: analyze reports roadmap_complete for a phase whose checkbox is unpadded', () => {
  const dir = project({ roadmap: { rowPhase: '7.5', headingPhase: '07.5', tickedPhases: 3 } });
  const res = gsd(dir, ['roadmap', 'analyze']);

  const phase = res.json.phases.find(p => p.number === '07.5');
  assert(phase, 'phase 07.5 should be in the analysis');
  assertEqual(phase.roadmap_complete, true, 'unpadded checkbox should be seen by a padded heading');
});

test('roadmap: "already up to date" is distinguished from "no such row"', () => {
  const dir = project({ roadmap: { rowPhase: '7.5' } });
  gsd(dir, ['roadmap', 'update-plan-progress', '07.5']);
  const second = gsd(dir, ['roadmap', 'update-plan-progress', '07.5']);
  assertIncludes(second.json.reason, 'already up to date', 'a matched-but-unchanged row is not a missing row');
  assert(second.json.matched_sections.length > 0, 'should report which sections it did find');
});
