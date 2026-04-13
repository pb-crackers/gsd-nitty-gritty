<purpose>
Audit Nyquist validation gaps for a completed phase. Generate missing tests. Update VALIDATION.md.
</purpose>

<required_reading>
@/Users/phillipdougherty/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<process>

## 0. Initialize

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`.

```bash
AUDITOR_MODEL=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-nyquist-auditor --raw)
NYQUIST_CFG=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config get workflow.nyquist_validation --raw)
```

If `NYQUIST_CFG` is `false`: exit with "Nyquist validation is disabled. Enable via /gsd:settings."

Display banner: `GSD > VALIDATE PHASE {N}: {name}`

## 1. Detect Input State

```bash
VALIDATION_FILE=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
```

- **State A** (`VALIDATION_FILE` non-empty): Audit existing
- **State B** (`VALIDATION_FILE` empty, `SUMMARY_FILES` non-empty): Reconstruct from artifacts
- **State C** (`SUMMARY_FILES` empty): Exit — "Phase {N} not executed. Run /gsd:execute-phase {N} first."

## 2. Discovery

### 2a. Read Phase Artifacts

Read all PLAN and SUMMARY files. Extract: task lists, requirement IDs, key-files changed, verify blocks.

### 2b. Build Requirement-to-Task Map

Per task: `{ task_id, plan_id, wave, requirement_ids, has_automated_command }`

### 2c. Detect Test Infrastructure

State A: Parse from existing VALIDATION.md Test Infrastructure table.
State B: Filesystem scan:

```bash
find . -name "pytest.ini" -o -name "jest.config.*" -o -name "vitest.config.*" -o -name "pyproject.toml" 2>/dev/null | head -10
find . \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" \) -not -path "*/node_modules/*" 2>/dev/null | head -40
```

### 2d. Cross-Reference

Match each requirement to existing tests by filename, imports, test descriptions. Record: requirement → test_file → status.

## 3. Gap Analysis

Classify each requirement:

| Status | Criteria |
|--------|----------|
| COVERED | Test exists, targets behavior, runs green |
| PARTIAL | Test exists, failing or incomplete |
| MISSING | No test found |

Build: `{ task_id, requirement, gap_type, suggested_test_path, suggested_command }`

No gaps → skip to Step 6, set `nyquist_compliant: true`.

## 4. Present Gap Plan

Call AskUserQuestion with gap table and options:
1. "Fix all gaps" → Step 5
2. "Skip — mark manual-only" → add to Manual-Only, Step 6
3. "Cancel" → exit

## 4.5. Load Testing Philosophy

Before spawning the auditor, load the project's testing strategy so generated tests honor the project's documented policy.

```bash
TESTING_STRATEGY_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
if [[ "$TESTING_STRATEGY_EXISTS" == "true" ]]; then
  cat .planning/TESTING-STRATEGY.md
fi
```

**If TESTING-STRATEGY.md exists:** Extract the Core Principle, Acceptable Mock Boundaries, and per-tier definitions. Pass these verbatim into the auditor's prompt.

**If TESTING-STRATEGY.md does not exist:** Apply the GSD default no-mocks philosophy — the same fallback described in `add-tests.md` under the `load_testing_strategy` step:

> We are building production applications. Do not mock anything you own or control. The only acceptable mock boundary is external third-party services you cannot run locally — and even there, prefer vendor test modes, sandbox environments, or contract tests over hand-rolled mocks. Acceptable mock boundaries (the short list): (1) external paid APIs with no sandbox, (2) time/clock for deterministic scheduling tests, (3) random number generators for deterministic output tests. Everything else runs for real. Every mock must be justified in a code comment naming its boundary category.

The auditor MUST honor this rule when generating tests. If a gap can only be closed by mocking owned code, the auditor must escalate (not generate the mocked test).

## 5. Spawn gsd-nyquist-auditor

```
Task(
  prompt="Read /Users/phillipdougherty/.claude/agents/gsd-nyquist-auditor.md for instructions.\n\n" +
    "<files_to_read>{PLAN, SUMMARY, impl files, VALIDATION.md, .planning/TESTING-STRATEGY.md if exists}</files_to_read>" +
    "<gaps>{gap list}</gaps>" +
    "<test_infrastructure>{framework, config, commands}</test_infrastructure>" +
    "<testing_philosophy>{TESTING-STRATEGY.md contents verbatim if exists, otherwise the GSD default no-mocks fallback from step 4.5}</testing_philosophy>" +
    "<constraints>Never modify impl files. Max 3 debug iterations. Escalate impl bugs. " +
      "NO MOCKS of owned code — do not import jest.mock, vi.mock, sinon, unittest.mock, Moq, NSubstitute, or equivalent to stub the project's own functions, services, repositories, controllers, or DB clients. " +
      "Tests must run against real dependencies (real DB via test container or dedicated test DB, real HTTP stack, real services). " +
      "Only acceptable mocks: external paid APIs without sandbox, clock, RNG — each must carry a code comment naming its boundary category and why a real alternative is not feasible. " +
      "If a gap cannot be closed without mocking owned code, escalate the gap rather than generating the test.</constraints>",
  subagent_type="gsd-nyquist-auditor",
  model="{AUDITOR_MODEL}",
  description="Fill validation gaps for Phase {N}"
)
```

Handle return:
- `## GAPS FILLED` → record tests + map updates, Step 6
- `## PARTIAL` → record resolved, move escalated to manual-only, Step 6
- `## ESCALATE` → move all to manual-only, Step 6

## 6. Generate/Update VALIDATION.md

**State B (create):**
1. Read template from `/Users/phillipdougherty/.claude/get-shit-done/templates/VALIDATION.md`
2. Fill: frontmatter, Test Infrastructure, Per-Task Map, Manual-Only, Sign-Off
3. Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`

**State A (update):**
1. Update Per-Task Map statuses, add escalated to Manual-Only, update frontmatter
2. Append audit trail:

```markdown
## Validation Audit {date}
| Metric | Count |
|--------|-------|
| Gaps found | {N} |
| Resolved | {M} |
| Escalated | {K} |
```

## 7. Commit

```bash
git add {test_files}
git commit -m "test(phase-${PHASE}): add Nyquist validation tests"

node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-${PHASE}): add/update validation strategy"
```

## 8. Results + Routing

**Compliant:**
```
GSD > PHASE {N} IS NYQUIST-COMPLIANT
All requirements have automated verification.
▶ Next: /gsd:audit-milestone
```

**Partial:**
```
GSD > PHASE {N} VALIDATED (PARTIAL)
{M} automated, {K} manual-only.
▶ Retry: /gsd:validate-phase {N}
```

Display `/clear` reminder.

</process>

<success_criteria>
- [ ] Nyquist config checked (exit if disabled)
- [ ] Input state detected (A/B/C)
- [ ] State C exits cleanly
- [ ] PLAN/SUMMARY files read, requirement map built
- [ ] Test infrastructure detected
- [ ] Gaps classified (COVERED/PARTIAL/MISSING)
- [ ] TESTING-STRATEGY.md loaded (or GSD default no-mocks philosophy applied)
- [ ] User gate with gap table
- [ ] Auditor spawned with complete context AND testing philosophy
- [ ] Generated tests verified to use real dependencies (no mocks of owned code)
- [ ] Gaps requiring mocks of owned code escalated (not silently filled)
- [ ] All three return formats handled
- [ ] VALIDATION.md created or updated
- [ ] Test files committed separately
- [ ] Results with routing presented
</success_criteria>
