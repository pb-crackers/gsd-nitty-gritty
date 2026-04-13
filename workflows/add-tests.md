<purpose>
Generate unit and E2E tests for a completed phase based on its SUMMARY.md, CONTEXT.md, and implementation. Classifies each changed file into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

Users currently hand-craft `/gsd:quick` prompts for test generation after each phase. This workflow standardizes the process with proper classification, quality gates, and gap reporting.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_arguments">
Parse `$ARGUMENTS` for:
- Phase number (integer, decimal, or letter-suffix) → store as `$PHASE_ARG`
- Remaining text after phase number → store as `$EXTRA_INSTRUCTIONS` (optional)

Example: `/gsd:add-tests 12 focus on edge cases` → `$PHASE_ARG=12`, `$EXTRA_INSTRUCTIONS="focus on edge cases"`

If no phase argument provided:

```
ERROR: Phase number required
Usage: /gsd:add-tests <phase> [additional instructions]
Example: /gsd:add-tests 12
Example: /gsd:add-tests 12 focus on edge cases in the pricing module
```

Exit.
</step>

<step name="init_context">
Load phase operation context:

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`.

Verify the phase directory exists. If not:
```
ERROR: Phase directory not found for phase ${PHASE_ARG}
Ensure the phase exists in .planning/phases/
```
Exit.

Read the phase artifacts (in order of priority):
1. `${phase_dir}/*-SUMMARY.md` — what was implemented, files changed
2. `${phase_dir}/CONTEXT.md` — acceptance criteria, decisions
3. `${phase_dir}/*-VERIFICATION.md` — user-verified scenarios (if UAT was done)

If no SUMMARY.md exists:
```
ERROR: No SUMMARY.md found for phase ${PHASE_ARG}
This command works on completed phases. Run /gsd:execute-phase first.
```
Exit.

Present banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ADD TESTS — Phase ${phase_number}: ${phase_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="analyze_implementation">
Extract the list of files modified by the phase from SUMMARY.md ("Files Changed" or equivalent section).

For each file, classify into one of three categories:

| Category | Criteria | Test Type |
|----------|----------|-----------|
| **TDD** | Pure functions where `expect(fn(input)).toBe(output)` is writable | Unit tests |
| **E2E** | UI behavior verifiable by browser automation | Playwright/E2E tests |
| **Skip** | Not meaningfully testable or already covered | None |

**TDD classification — apply when:**
- Business logic: calculations, pricing, tax rules, validation
- Data transformations: mapping, filtering, aggregation, formatting
- Parsers: CSV, JSON, XML, custom format parsing
- Validators: input validation, schema validation, business rules
- State machines: status transitions, workflow steps
- Utilities: string manipulation, date handling, number formatting

**E2E classification — apply when:**
- Keyboard shortcuts: key bindings, modifier keys, chord sequences
- Navigation: page transitions, routing, breadcrumbs, back/forward
- Form interactions: submit, validation errors, field focus, autocomplete
- Selection: row selection, multi-select, shift-click ranges
- Drag and drop: reordering, moving between containers
- Modal dialogs: open, close, confirm, cancel
- Data grids: sorting, filtering, inline editing, column resize

**Skip classification — apply when:**
- UI layout/styling: CSS classes, visual appearance, responsive breakpoints
- Configuration: config files, environment variables, feature flags
- Glue code: dependency injection setup, middleware registration, routing tables
- Migrations: database migrations, schema changes
- Simple CRUD: basic create/read/update/delete with no business logic
- Type definitions: records, DTOs, interfaces with no logic

Read each file to verify classification. Don't classify based on filename alone.
</step>

<step name="present_classification">
Present the classification to the user for confirmation before proceeding:

```
AskUserQuestion(
  header: "Test Classification",
  question: |
    ## Files classified for testing

    ### TDD (Unit Tests) — {N} files
    {list of files with brief reason}

    ### E2E (Browser Tests) — {M} files
    {list of files with brief reason}

    ### Skip — {K} files
    {list of files with brief reason}

    {if $EXTRA_INSTRUCTIONS: "Additional instructions: ${EXTRA_INSTRUCTIONS}"}

    How would you like to proceed?
  options:
    - "Approve and generate test plan"
    - "Adjust classification (I'll specify changes)"
    - "Cancel"
)
```

If user selects "Adjust classification": apply their changes and re-present.
If user selects "Cancel": exit gracefully.
</step>

<step name="discover_test_structure">
Before generating the test plan, discover the project's existing test structure:

```bash
# Find existing test directories
find . -type d -name "*test*" -o -name "*spec*" -o -name "*__tests__*" 2>/dev/null | head -20
# Find existing test files for convention matching
find . -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "*Tests.fs" -o -name "*Test.fs" \) 2>/dev/null | head -20
# Check for test runners
ls package.json *.sln 2>/dev/null
```

Identify:
- Test directory structure (where unit tests live, where E2E tests live)
- Naming conventions (`.test.ts`, `.spec.ts`, `*Tests.fs`, etc.)
- Test runner commands (how to execute unit tests, how to execute E2E tests)
- Test framework (xUnit, NUnit, Jest, Playwright, etc.)

If test structure is ambiguous, ask the user:
```
AskUserQuestion(
  header: "Test Structure",
  question: "I found multiple test locations. Where should I create tests?",
  options: [list discovered locations]
)
```
</step>

<step name="load_testing_strategy">
Load the project's testing philosophy — this is a **mandatory** read when the file exists.

```bash
cat .planning/TESTING-STRATEGY.md 2>/dev/null
```

**If TESTING-STRATEGY.md exists:** Extract and honor:
- The Core Principle (test real code, not mocks)
- The Acceptable Mock Boundaries list
- The project's unit/integration/E2E boundary definitions
- Any project-specific test data or coverage rules

**If TESTING-STRATEGY.md does not exist:** Apply the GSD default testing philosophy described below. Do not prompt the user — just proceed with these defaults and note in the final report that TESTING-STRATEGY.md should be generated via `/gsd:new-milestone` or by running the Step 7.5 artifact generation from `new-project.md`.

**GSD Default Testing Philosophy (the no-mocks rule):**

> We are building production applications. A test that passes against a mock tells you nothing about whether the code works in production — it only tells you the mock matches the mock. **Do not mock anything you own or control.** Real databases, real internal services, real file systems, real queues, real HTTP handlers, real domain logic.
>
> The only acceptable mock boundary is **external third-party services you cannot run locally** (e.g., Stripe production API, Twilio SMS delivery, a vendor SaaS endpoint) — and even there, prefer vendor-provided test modes, sandbox environments, or contract tests over hand-rolled mocks.
>
> Acceptable mock boundaries (the short list): (1) external paid APIs with no sandbox, (2) time/clock for deterministic scheduling tests, (3) random number generators for deterministic output tests. Everything else runs for real.
>
> If you find yourself reaching for a mock, stop and ask: *can I run the real thing in a container, test mode, or fixture instead?* The answer is almost always yes. Every mock must be justified in a code comment explaining which boundary category it falls under and why a real alternative is not feasible.

Carry this rule into every subsequent step: test plan generation, test code generation, and the final coverage report. If the user's extra instructions (`$EXTRA_INSTRUCTIONS`) conflict with this rule, surface the conflict and ask the user to confirm before proceeding.
</step>

<step name="generate_test_plan">
For each approved file, create a detailed test plan.

**For TDD files**, plan tests following RED-GREEN-REFACTOR:
1. Identify testable functions/methods in the file
2. For each function: list input scenarios, expected outputs, edge cases
3. Note: since code already exists, tests may pass immediately — that's OK, but verify they test the RIGHT behavior
4. **No-mocks check:** For each planned test, explicitly note which dependencies the code under test touches (DB, queue, HTTP, filesystem, internal services). For each dependency, declare how the test will exercise it: *real in-process instance*, *real containerized instance*, *vendor sandbox/test mode*, or *justified mock* (must name the external-boundary category). If a unit test requires any of the above, it's actually an integration test — reclassify it.

**For E2E files**, plan tests following RED-GREEN gates:
1. Identify user scenarios from CONTEXT.md/VERIFICATION.md
2. For each scenario: describe the user action, expected outcome, assertions
3. Note: RED gate means confirming the test would fail if the feature were broken
4. **Real-stack requirement:** E2E tests must run against the real application stack — real DB, real backend process, real browser. No stubbed API responses, no mocked auth, no fake fixtures pretending to be the backend. If the stack is hard to bring up, report that as a blocker rather than substituting mocks.

**Before presenting the plan**, audit it against the testing philosophy loaded in `load_testing_strategy`:
- Does any planned test reach for a mock?
- If yes, is that mock on the acceptable-boundary short list (external paid API without sandbox / clock / RNG)?
- If no, revise the plan to use the real dependency before presenting it.

Present the complete test plan:

```
AskUserQuestion(
  header: "Test Plan",
  question: |
    ## Test Generation Plan

    ### Testing Philosophy
    {one-line: "No mocks except external boundaries — tests run against real dependencies"}

    ### Unit Tests ({N} tests across {M} files)
    {for each file: test file path, list of test cases, dependencies-touched note}

    ### Integration Tests ({I} tests across {J} files)
    {for each file: test file path, real DB/service setup required, test cases}

    ### E2E Tests ({P} tests across {Q} files)
    {for each file: test file path, real-stack setup required, list of test scenarios}

    ### Justified Mocks (must be empty or fully justified)
    {for each mock: dependency, boundary category, why real alternative is not feasible}

    ### Test Commands
    - Unit: {discovered test command}
    - Integration: {discovered integration command, if separate}
    - E2E: {discovered e2e command}

    ### Setup Requirements
    {test containers, sandbox credentials, seed data needed to run against real dependencies}

    Ready to generate?
  options:
    - "Generate all"
    - "Cherry-pick (I'll specify which)"
    - "Adjust plan"
)
```

If "Cherry-pick": ask user which tests to include.
If "Adjust plan": apply changes and re-present.
</step>

<step name="execute_tdd_generation">
For each approved TDD test:

1. **Create test file** following discovered project conventions (directory, naming, imports)

2. **Write test** with clear arrange/act/assert structure:
   ```
   // Arrange — set up inputs and expected outputs (real fixtures, real DB rows, not mocks)
   // Act — call the function under test through its real code path
   // Assert — verify the output matches expectations
   ```

   **No-mocks enforcement during code generation:**
   - Do NOT import mocking libraries (`jest.mock`, `vi.mock`, `sinon`, `unittest.mock`, `Moq`, `NSubstitute`, etc.) to stub code the project owns
   - Do NOT stub internal functions, services, repositories, or controllers — call them for real
   - For DB-touching code: use the real test database (or a test container) discovered in the test structure; if none exists, report a blocker and stop — do not fall back to mocking the DB
   - For HTTP handlers: exercise them through the real router/framework, not by calling handler functions with fake request objects
   - The ONLY acceptable mocks are those pre-approved in the test plan under "Justified Mocks" — each must have a code comment naming the boundary category (external paid API / clock / RNG) and why a real alternative is not feasible
   - If you discover partway through that a real dependency is unavailable, STOP and report it as a blocker rather than silently adding a mock

3. **Run the test**:
   ```bash
   {discovered test command}
   ```

4. **Evaluate result:**
   - **Test passes**: Good — the implementation satisfies the test. Verify the test checks meaningful behavior (not just that it compiles).
   - **Test fails with assertion error**: This may be a genuine bug discovered by the test. Flag it:
     ```
     ⚠️ Potential bug found: {test name}
     Expected: {expected}
     Actual: {actual}
     File: {implementation file}
     ```
     Do NOT fix the implementation — this is a test-generation command, not a fix command. Record the finding.
   - **Test fails with error (import, syntax, etc.)**: This is a test error. Fix the test and re-run.
</step>

<step name="execute_e2e_generation">
For each approved E2E test:

1. **Check for existing tests** covering the same scenario:
   ```bash
   grep -r "{scenario keyword}" {e2e test directory} 2>/dev/null
   ```
   If found, extend rather than duplicate.

2. **Create test file** targeting the user scenario from CONTEXT.md/VERIFICATION.md

3. **Run the E2E test**:
   ```bash
   {discovered e2e command}
   ```

4. **Evaluate result:**
   - **GREEN (passes)**: Record success
   - **RED (fails)**: Determine if it's a test issue or a genuine application bug. Flag bugs:
     ```
     ⚠️ E2E failure: {test name}
     Scenario: {description}
     Error: {error message}
     ```
   - **Cannot run**: Report blocker. Do NOT mark as complete.
     ```
     🛑 E2E blocker: {reason tests cannot run}
     ```

**No-skip rule:** If E2E tests cannot execute (missing dependencies, environment issues), report the blocker and mark the test as incomplete. Never mark success without actually running the test.
</step>

<step name="summary_and_commit">
Create a test coverage report and present to user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST GENERATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Results

| Category | Generated | Passing | Failing | Blocked |
|----------|-----------|---------|---------|---------|
| Unit     | {N}       | {n1}    | {n2}    | {n3}    |
| E2E      | {M}       | {m1}    | {m2}    | {m3}    |

## Files Created/Modified
{list of test files with paths}

## Coverage Gaps
{areas that couldn't be tested and why}

## Bugs Discovered
{any assertion failures that indicate implementation bugs}
```

Record test generation in project state:
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" state-snapshot
```

If there are passing tests to commit:

```bash
git add {test files}
git commit -m "test(phase-${phase_number}): add unit and E2E tests from add-tests command"
```

Present next steps:

```
---

## ▶ Next Up

{if bugs discovered:}
**Fix discovered bugs:** `/gsd:quick fix the {N} test failures discovered in phase ${phase_number}`

{if blocked tests:}
**Resolve test blockers:** {description of what's needed}

{otherwise:}
**All tests passing!** Phase ${phase_number} is fully tested.

---

**Also available:**
- `/gsd:add-tests {next_phase}` — test another phase
- `/gsd:verify-work {phase_number}` — run UAT verification

---
```
</step>

</process>

<success_criteria>
- [ ] Phase artifacts loaded (SUMMARY.md, CONTEXT.md, optionally VERIFICATION.md)
- [ ] All changed files classified into TDD/E2E/Skip categories
- [ ] Classification presented to user and approved
- [ ] Project test structure discovered (directories, conventions, runners)
- [ ] TESTING-STRATEGY.md loaded (or GSD default no-mocks philosophy applied if missing)
- [ ] Test plan audited against no-mocks rule before presenting to user
- [ ] Test plan presented to user and approved
- [ ] TDD tests generated with arrange/act/assert structure using **real dependencies** (no mocks of owned code)
- [ ] Integration tests run against real DB / real services (test containers or dedicated test DBs)
- [ ] E2E tests run against the real application stack (no stubbed backend/API responses)
- [ ] Any mock present in generated test code falls on the acceptable-boundary short list and is justified in a code comment
- [ ] All tests executed — no untested tests marked as passing
- [ ] Bugs discovered by tests flagged (not fixed)
- [ ] Test files committed with proper message
- [ ] Coverage gaps documented (including any areas blocked by unavailable real dependencies)
- [ ] Next steps presented to user
</success_criteria>
