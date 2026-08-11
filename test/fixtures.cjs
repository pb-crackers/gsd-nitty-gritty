/**
 * Fixture builders for the gsd-tools regression harness.
 *
 * These mirror the real shapes seen in the wild rather than the shapes the
 * templates emit — the whole point of the harness is that hand-edited files
 * are the normal case, not the exception.
 */

const { makeProject } = require('./harness.cjs');

/**
 * A roadmap with a progress table, a checklist and phase detail sections.
 *
 * @param {object} opts
 * @param {string} opts.rowPhase      how phase 7.5 is spelled in the table row + checklist
 * @param {string} opts.headingPhase  how phase 7.5 is spelled in the "### Phase N:" heading
 * @param {number} opts.tickedPhases  how many "- [x] **Phase" checkboxes to emit
 */
function roadmap(opts = {}) {
  const rowPhase = opts.rowPhase || '7.5';
  const headingPhase = opts.headingPhase || '07.5';
  const ticked = opts.tickedPhases === undefined ? 1 : opts.tickedPhases;

  const checklist = [
    `- [${ticked >= 1 ? 'x' : ' '}] **Phase 1: Foundations** - the base`,
    `- [${ticked >= 2 ? 'x' : ' '}] **Phase 2: Pipeline** - the pipe`,
    `- [${ticked >= 3 ? 'x' : ' '}] **Phase ${rowPhase}: Media Assertions** (INSERTED) - the checks`,
  ].join('\n');

  return `# Roadmap

## v1.0 Milestone: First Cut

### Progress

| Phase | Plans | Status      | Completed |
|-------|-------|-------------|-----------|
| 1 Foundations | 2/2 | Complete    | 2026-01-01 |
| 2 Pipeline | 1/1 | Complete    | 2026-01-02 |
| ${rowPhase} Media Assertions (INSERTED) | 0/6 | Planned     |            |

### Phases

${checklist}

### Phase 1: Foundations

**Goal:** Lay the base.
**Plans:** 2/2 plans complete

### Phase 2: Pipeline

**Goal:** Build the pipe.
**Plans:** 1/1 plans complete

### Phase ${headingPhase}: Media Assertions (INSERTED)

**Goal:** The pipeline checks the footage it is handed.
**Requirements:** [MEDIA-01, MEDIA-02]
**Plans:** 0/6 plans planned
`;
}

/**
 * A STATE.md.
 *
 * @param {object} opts
 * @param {string} opts.status         the "**Status:**" prose in § Current Position
 * @param {string} opts.currentPlan    the "**Current Plan:**" value
 * @param {string} opts.totalPlans     the "**Total Plans in Phase:**" value
 * @param {string} opts.comment        an HTML comment block to place above the body
 * @param {object} opts.frontmatter    raw frontmatter YAML lines (string), or null for none
 */
function state(opts = {}) {
  const status = opts.status || 'Ready to execute';
  const currentPlan = opts.currentPlan || '1';
  const totalPlans = opts.totalPlans || '6';
  const comment = opts.comment ? `${opts.comment}\n\n` : '';
  const fm = opts.frontmatter === null ? '' : `---\n${opts.frontmatter || defaultFrontmatter()}\n---\n\n`;

  return `${fm}${comment}# Project State

## Current Position

**Current Phase:** 07.5
**Current Phase Name:** Media Assertions
**Total Phases:** 3
**Current Plan:** ${currentPlan}
**Total Plans in Phase:** ${totalPlans}
**Status:** ${status}
**Progress:** [██████████] 100%
**Last Activity:** 2026-08-01
**Last Activity Description:** Executed a plan

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 1 | Use ffmpeg | It is there |

## Blockers

None

## Performance Metrics

| Phase | Duration | Tasks | Files |
|-------|----------|-------|-------|
| None yet | - | - | - |

## Session

**Last Date:** 2026-08-01T00:00:00Z
**Stopped At:** Finished a plan
**Resume File:** None
`;
}

function defaultFrontmatter() {
  return `gsd_state_version: 1.0
milestone: v1.0
milestone_name: First Cut
current_phase: 07.5
current_plan: 1
status: executing
last_updated: "2026-08-01T00:00:00Z"
last_activity: 2026-08-01
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 9
  completed_plans: 3
  percent: 33`;
}

function requirements() {
  return `# Requirements

## Media

- [ ] **MEDIA-01** — Still equals render
- [ ] **MEDIA-02** — The gate names the footage

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEDIA-01 | Phase 07.5 | Pending |
| MEDIA-02 | Phase 07.5 | Pending |
`;
}

/**
 * Build a full throwaway project.
 *
 * @param {object} opts
 * @param {object} opts.roadmap   options forwarded to roadmap()
 * @param {object} opts.state     options forwarded to state()
 * @param {number} opts.plans     PLAN.md files in phase 07.5
 * @param {number} opts.summaries SUMMARY.md files in phase 07.5
 * @param {object} opts.phases    extra phases: {dirName: {plans, summaries}}
 */
function project(opts = {}) {
  const files = {
    '.planning/ROADMAP.md': roadmap(opts.roadmap),
    '.planning/STATE.md': state(opts.state),
    '.planning/REQUIREMENTS.md': requirements(),
    '.planning/config.json': JSON.stringify({ model_profile: 'balanced' }, null, 2),
  };

  const phases = Object.assign(
    { '07.5-media-assertions': { plans: opts.plans === undefined ? 6 : opts.plans, summaries: opts.summaries === undefined ? 6 : opts.summaries } },
    opts.phases || {}
  );

  for (const [dir, counts] of Object.entries(phases)) {
    const prefix = dir.match(/^([\d.]+[A-Za-z]?)/)[1];
    for (let i = 1; i <= counts.plans; i++) {
      const id = `${prefix}-${String(i).padStart(2, '0')}`;
      files[`.planning/phases/${dir}/${id}-PLAN.md`] = `---\nphase: ${prefix}\nplan: ${i}\n---\n\n# Plan ${i}\n`;
    }
    for (let i = 1; i <= counts.summaries; i++) {
      const id = `${prefix}-${String(i).padStart(2, '0')}`;
      files[`.planning/phases/${dir}/${id}-SUMMARY.md`] = `---\nphase: ${prefix}\nplan: ${i}\n---\n\n# Summary ${i}\n`;
    }
  }

  return makeProject(files);
}

module.exports = { project, roadmap, state, requirements, defaultFrontmatter };
