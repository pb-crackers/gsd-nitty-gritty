<purpose>
Verify milestone achieved its definition of done by aggregating phase verifications, checking cross-phase integration, and assessing requirements coverage. Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 0. Initialize Milestone Context

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init milestone-op)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `commit_docs`.

Resolve integration checker model:
```bash
integration_checker_model=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-integration-checker --raw)
```

## 1. Determine Milestone Scope

```bash
# Get phases in milestone (sorted numerically, handles decimals)
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" phases list
```

- Parse version from arguments or detect current from ROADMAP.md
- Identify all phase directories in scope
- Extract milestone definition of done from ROADMAP.md
- Extract requirements mapped to this milestone from REQUIREMENTS.md

## 2. Read All Phase Verifications

For each phase directory, read the VERIFICATION.md:

```bash
# For each phase, use find-phase to resolve the directory (handles archived phases)
PHASE_INFO=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase 01 --raw)
# Extract directory from JSON, then read VERIFICATION.md from that directory
# Repeat for each phase number from ROADMAP.md
```

From each VERIFICATION.md, extract:
- **Status:** passed | gaps_found
- **Critical gaps:** (if any — these are blockers)
- **Non-critical gaps:** tech debt, deferred items, warnings
- **Anti-patterns found:** TODOs, stubs, placeholders
- **Requirements coverage:** which requirements satisfied/blocked

If a phase is missing VERIFICATION.md, flag it as "unverified phase" — this is a blocker.

## 3. Spawn Integration Checker

With phase context collected:

Extract `MILESTONE_REQ_IDS` from REQUIREMENTS.md traceability table — all REQ-IDs assigned to phases in this milestone.

```
Task(
  prompt="Check cross-phase integration and E2E flows.

Phases: {phase_dirs}
Phase exports: {from SUMMARYs}
API routes: {routes created}

Milestone Requirements:
{MILESTONE_REQ_IDS — list each REQ-ID with description and assigned phase}

MUST map each integration finding to affected requirement IDs where applicable.

Verify cross-phase wiring and E2E user flows.",
  subagent_type="gsd-integration-checker",
  model="{integration_checker_model}"
)
```

## 4. Collect Results

Combine:
- Phase-level gaps and tech debt (from step 2)
- Integration checker's report (wiring gaps, broken flows)

## 5. Check Requirements Coverage (3-Source Cross-Reference)

MUST cross-reference three independent sources for each requirement:

### 5a. Parse REQUIREMENTS.md Traceability Table

Extract all REQ-IDs mapped to milestone phases from the traceability table:
- Requirement ID, description, assigned phase, current status, checked-off state (`[x]` vs `[ ]`)

### 5b. Parse Phase VERIFICATION.md Requirements Tables

For each phase's VERIFICATION.md, extract the expanded requirements table:
- Requirement | Source Plan | Description | Status | Evidence
- Map each entry back to its REQ-ID

### 5c. Extract SUMMARY.md Frontmatter Cross-Check

For each phase's SUMMARY.md, extract `requirements-completed` from YAML frontmatter:
```bash
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" summary-extract "$summary" --fields requirements_completed | jq -r '.requirements_completed'
done
```

### 5d. Status Determination Matrix

For each REQ-ID, determine status using all three sources:

| VERIFICATION.md Status | SUMMARY Frontmatter | REQUIREMENTS.md | → Final Status |
|------------------------|---------------------|-----------------|----------------|
| passed                 | listed              | `[x]`           | **satisfied**  |
| passed                 | listed              | `[ ]`           | **satisfied** (update checkbox) |
| passed                 | missing             | any             | **partial** (verify manually) |
| gaps_found             | any                 | any             | **unsatisfied** |
| missing                | listed              | any             | **partial** (verification gap) |
| missing                | missing             | any             | **unsatisfied** |

### 5e. FAIL Gate and Orphan Detection

**REQUIRED:** Any `unsatisfied` requirement MUST force `gaps_found` status on the milestone audit.

**Orphan detection:** Requirements present in REQUIREMENTS.md traceability table but absent from ALL phase VERIFICATION.md files MUST be flagged as orphaned. Orphaned requirements are treated as `unsatisfied` — they were assigned but never verified by any phase.

## 5.5. Nyquist Compliance Discovery

Skip if `workflow.nyquist_validation` is explicitly `false` (absent = enabled).

```bash
NYQUIST_CONFIG=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config get workflow.nyquist_validation --raw 2>/dev/null)
```

If `false`: skip entirely.

For each phase directory, check `*-VALIDATION.md`. If exists, parse frontmatter (`nyquist_compliant`, `wave_0_complete`).

Classify per phase:

| Status | Condition |
|--------|-----------|
| COMPLIANT | `nyquist_compliant: true` and all tasks green |
| PARTIAL | VALIDATION.md exists, `nyquist_compliant: false` or red/pending |
| MISSING | No VALIDATION.md |

Add to audit YAML: `nyquist: { compliant_phases, partial_phases, missing_phases, overall }`

Discovery only — never auto-calls `/gsd:validate-phase`.

## 5.6. Standards Drift Detection

A milestone can ship with each phase individually passing verification while the cumulative code quietly diverges from SECURITY.md, APIS.md, ERROR-HANDLING.md, TESTING-STRATEGY.md, or DESIGN-SYSTEM.md. This step surfaces drift at the milestone level.

**Skip gracefully** if the project has no standards artifacts (legacy projects pre-dating the Step 7.5 artifact generation). Record `standards: { artifacts_present: false, checked: [], drift: [] }` in the audit YAML.

### 5.6a. Load existing standards artifacts

```bash
SECURITY_EXISTS=$(test -f .planning/SECURITY.md && echo "true" || echo "false")
APIS_EXISTS=$(test -f .planning/APIS.md && echo "true" || echo "false")
TESTING_STRATEGY_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
ERROR_HANDLING_EXISTS=$(test -f .planning/ERROR-HANDLING.md && echo "true" || echo "false")
DESIGN_SYSTEM_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")
```

For each artifact that exists, extract enforceable policies (concrete rules, not philosophical framing).

### 5.6b. Aggregate standards-compliance findings from phase VERIFICATION.md files

Phase-level standards-compliance findings are produced by `verify-phase.md`'s `scan_standards_compliance` step (see Edit 2). Aggregate them:

```bash
for phase_dir in .planning/phases/*/; do
  if [[ -f "$phase_dir"/*-VERIFICATION.md ]]; then
    # Parse standards_compliance.findings from YAML
    # Collect: artifact, file, policy, status, severity, evidence
  fi
done
```

Build a milestone-wide findings table grouped by artifact.

### 5.6c. Cross-phase drift sampling

Some drift only emerges at the milestone scale (inconsistent error codes across phases, inconsistent pagination strategies, inconsistent auth patterns). Sample milestone-touched files against each standards artifact:

- **SECURITY.md** — grep milestone-touched auth/endpoint files for auth primitive consistency (are all state-changing endpoints protected the same way?)
- **APIS.md** — grep milestone migrations for consistent guard usage (`IF NOT EXISTS`); grep endpoint files for pagination consistency
- **ERROR-HANDLING.md** — grep error paths for correlation ID presence, consistent error code ranges, consistent user-facing error format
- **TESTING-STRATEGY.md** — grep new test files for mocking-library imports against owned code (any hit is drift)
- **DESIGN-SYSTEM.md** — spot-check UI files for interaction-state completeness and breakpoint consistency

### 5.6d. Classify per artifact

| Status | Condition |
|--------|-----------|
| COMPLIANT | Artifact exists, no blocker or warning findings across milestone |
| DRIFTED | Artifact exists, warning-severity findings present (phase(s) extended or partially complied with policy without updating the artifact) |
| VIOLATED | Artifact exists, blocker-severity findings present (phase(s) violated documented policy) |
| ABSENT | Artifact does not exist but milestone scope suggests it should (e.g., milestone added auth code but no SECURITY.md) |

### 5.6e. FAIL gate

**Any `VIOLATED` status on a standards artifact MUST force `gaps_found` on the milestone audit** — same rule as unsatisfied requirements. `DRIFTED` entries feed into tech debt. `ABSENT` entries feed into recommended next steps (generate the missing artifact via `/gsd:new-milestone` or the Step 7.5 generation from `new-project.md`).

Discovery only — never auto-regenerates artifacts.

## 6. Aggregate into v{version}-MILESTONE-AUDIT.md

Create `.planning/v{version}-v{version}-MILESTONE-AUDIT.md` with:

```yaml
---
milestone: {version}
audited: {timestamp}
status: passed | gaps_found | tech_debt
scores:
  requirements: N/M
  phases: N/M
  integration: N/M
  flows: N/M
gaps:  # Critical blockers
  requirements:
    - id: "{REQ-ID}"
      status: "unsatisfied | partial | orphaned"
      phase: "{assigned phase}"
      claimed_by_plans: ["{plan files that reference this requirement}"]
      completed_by_plans: ["{plan files whose SUMMARY marks it complete}"]
      verification_status: "passed | gaps_found | missing | orphaned"
      evidence: "{specific evidence or lack thereof}"
  integration: [...]
  flows: [...]
tech_debt:  # Non-critical, deferred
  - phase: 01-auth
    items:
      - "TODO: add rate limiting"
      - "Warning: no password strength validation"
  - phase: 03-dashboard
    items:
      - "Deferred: mobile responsive layout"
standards:  # Milestone-level standards drift detection (5.6)
  artifacts_present: true
  checked:
    - SECURITY.md
    - APIS.md
    - TESTING-STRATEGY.md
    - ERROR-HANDLING.md
    - DESIGN-SYSTEM.md
  missing: []  # e.g. ["SECURITY.md"] if milestone added auth without the artifact
  per_artifact:
    SECURITY.md: compliant  # compliant | drifted | violated | absent
    APIS.md: drifted
    TESTING-STRATEGY.md: violated
    ERROR-HANDLING.md: compliant
    DESIGN-SYSTEM.md: compliant
  violations:  # forces gaps_found
    - artifact: TESTING-STRATEGY.md
      phase: 03-dashboard
      file: src/api/dashboard.test.ts
      policy: "No mocks of owned code"
      evidence: "Line 12: jest.mock('../repos/userRepo') stubs owned repository"
  drift:  # feeds tech_debt
    - artifact: APIS.md
      phase: 02-api
      file: src/migrations/003-add-roles.sql
      policy: "Idempotent migration guards"
      evidence: "Missing IF NOT EXISTS on CREATE TABLE roles"
---
```

Plus full markdown report with tables for requirements, phases, integration, tech debt.

**Status values:**
- `passed` — all requirements met, no critical gaps, no standards violations, minimal tech debt
- `gaps_found` — critical blockers exist (unsatisfied requirements, broken integration, OR standards violations)
- `tech_debt` — no blockers but accumulated deferred items or standards drift need review

## 7. Present Results

Route by status (see `<offer_next>`).

</process>

<offer_next>
Output this markdown directly (not as a code block). Route based on status:

---

**If passed:**

## ✓ Milestone {version} — Audit Passed

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

All requirements covered. Cross-phase integration verified. E2E flows complete.

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Complete milestone** — archive and tag

/gsd:complete-milestone {version}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

---

**If gaps_found:**

## ⚠ Milestone {version} — Gaps Found

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Phase {X})
  - {reason}

### Cross-Phase Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

### Broken Flows

{For each flow gap:}
- **{flow name}:** breaks at {step}

### Nyquist Coverage

| Phase | VALIDATION.md | Compliant | Action |
|-------|---------------|-----------|--------|
| {phase} | exists/missing | true/false/partial | `/gsd:validate-phase {N}` |

Phases needing validation: run `/gsd:validate-phase {N}` for each flagged phase.

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan gap closure** — create phases to complete milestone

/gsd:plan-milestone-gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/v{version}-MILESTONE-AUDIT.md — see full report
- /gsd:complete-milestone {version} — proceed anyway (accept tech debt)

───────────────────────────────────────────────────────────────

---

**If tech_debt (no blockers but accumulated debt):**

## ⚡ Milestone {version} — Tech Debt Review

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

All requirements met. No critical blockers. Accumulated tech debt needs review.

### Tech Debt by Phase

{For each phase with debt:}
**Phase {X}: {name}**
- {item 1}
- {item 2}

### Total: {N} items across {M} phases

───────────────────────────────────────────────────────────────

## ▶ Options

**A. Complete milestone** — accept debt, track in backlog

/gsd:complete-milestone {version}

**B. Plan cleanup phase** — address debt before completing

/gsd:plan-milestone-gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] Milestone scope identified
- [ ] All phase VERIFICATION.md files read
- [ ] SUMMARY.md `requirements-completed` frontmatter extracted for each phase
- [ ] REQUIREMENTS.md traceability table parsed for all milestone REQ-IDs
- [ ] 3-source cross-reference completed (VERIFICATION + SUMMARY + traceability)
- [ ] Orphaned requirements detected (in traceability but absent from all VERIFICATIONs)
- [ ] Tech debt and deferred gaps aggregated
- [ ] Integration checker spawned with milestone requirement IDs
- [ ] v{version}-MILESTONE-AUDIT.md created with structured requirement gap objects
- [ ] FAIL gate enforced — any unsatisfied requirement forces gaps_found status
- [ ] Nyquist compliance scanned for all milestone phases (if enabled)
- [ ] Missing VALIDATION.md phases flagged with validate-phase suggestion
- [ ] Results presented with actionable next steps
</success_criteria>
