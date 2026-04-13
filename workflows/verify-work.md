<purpose>
Validate built features through conversational testing with persistent state. Creates UAT.md that tracks test progress, survives /clear, and feeds gaps into /gsd:plan-phase --gaps.

User tests, Claude records. One test at a time. Plain text responses.
</purpose>

<philosophy>
**Show expected, ask if reality matches.**

Claude presents what SHOULD happen. User confirms or describes what's different.
- "yes" / "y" / "next" / empty → pass
- Anything else → logged as issue, severity inferred

No Pass/Fail buttons. No severity questions. Just: "Here's what should happen. Does it?"
</philosophy>

<template>
@/Users/phillipdougherty/.claude/get-shit-done/templates/UAT.md
</template>

<process>

<step name="initialize" priority="first">
If $ARGUMENTS contains a phase number, load context:

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init verify-work "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `planner_model`, `checker_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `has_verification`.
</step>

<step name="check_active_session">
**First: Check for active UAT sessions**

```bash
find .planning/phases -name "*-UAT.md" -type f 2>/dev/null | head -5
```

**If active sessions exist AND no $ARGUMENTS provided:**

Read each file's frontmatter (status, phase) and Current Test section.

Display inline:

```
## Active UAT Sessions

| # | Phase | Status | Current Test | Progress |
|---|-------|--------|--------------|----------|
| 1 | 04-comments | testing | 3. Reply to Comment | 2/6 |
| 2 | 05-auth | testing | 1. Login Form | 0/4 |

Reply with a number to resume, or provide a phase number to start new.
```

Wait for user response.

- If user replies with number (1, 2) → Load that file, go to `resume_from_file`
- If user replies with phase number → Treat as new session, go to `create_uat_file`

**If active sessions exist AND $ARGUMENTS provided:**

Check if session exists for that phase. If yes, offer to resume or restart.
If no, continue to `create_uat_file`.

**If no active sessions AND no $ARGUMENTS:**

```
No active UAT sessions.

Provide a phase number to start testing (e.g., /gsd:verify-work 4)
```

**If no active sessions AND $ARGUMENTS provided:**

Continue to `create_uat_file`.
</step>

<step name="find_summaries">
**Find what to test:**

Use `phase_dir` from init (or run init if not already done).

```bash
ls "$phase_dir"/*-SUMMARY.md 2>/dev/null
```

Read each SUMMARY.md to extract testable deliverables.
</step>

<step name="extract_tests">
**Extract testable deliverables from SUMMARY.md:**

Parse for:
1. **Accomplishments** - Features/functionality added
2. **User-facing changes** - UI, workflows, interactions

Focus on USER-OBSERVABLE outcomes, not implementation details.

For each deliverable, create a test:
- name: Brief test name
- expected: What the user should see/experience (specific, observable)

Examples:
- Accomplishment: "Added comment threading with infinite nesting"
  → Test: "Reply to a Comment"
  → Expected: "Clicking Reply opens inline composer below comment. Submitting shows reply nested under parent with visual indentation."

Skip internal/non-observable items (refactors, type changes, etc.).

**Cold-start smoke test injection:**

After extracting tests from SUMMARYs, scan the SUMMARY files for modified/created file paths. If ANY path matches these patterns:

`server.ts`, `server.js`, `app.ts`, `app.js`, `index.ts`, `index.js`, `main.ts`, `main.js`, `database/*`, `db/*`, `seed/*`, `seeds/*`, `migrations/*`, `startup*`, `docker-compose*`, `Dockerfile*`

Then **prepend** this test to the test list:

- name: "Cold Start Smoke Test"
- expected: "Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data."

This catches bugs that only manifest on fresh start — race conditions in startup sequences, silent seed failures, missing environment setup — which pass against warm state but break in production.
</step>

<step name="load_project_standards">
**Load the project's standards artifacts before expanding QA tests.**

The project has documented policies for security, APIs, error handling, testing, and UX design. QA tests should verify those specific policies are enforced — not just the generic best-practice templates below. Tests tailored to your project's actual standards catch the bugs that matter; generic tests produce noise.

```bash
SECURITY_EXISTS=$(test -f .planning/SECURITY.md && echo "true" || echo "false")
APIS_EXISTS=$(test -f .planning/APIS.md && echo "true" || echo "false")
TESTING_STRATEGY_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
ERROR_HANDLING_EXISTS=$(test -f .planning/ERROR-HANDLING.md && echo "true" || echo "false")
DESIGN_SYSTEM_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")

if [[ "$SECURITY_EXISTS" == "true" ]]; then cat .planning/SECURITY.md; fi
if [[ "$APIS_EXISTS" == "true" ]]; then cat .planning/APIS.md; fi
if [[ "$TESTING_STRATEGY_EXISTS" == "true" ]]; then cat .planning/TESTING-STRATEGY.md; fi
if [[ "$ERROR_HANDLING_EXISTS" == "true" ]]; then cat .planning/ERROR-HANDLING.md; fi
if [[ "$DESIGN_SYSTEM_EXISTS" == "true" ]]; then cat .planning/DESIGN-SYSTEM.md; fi
```

**Extract the enforceable policies** from each artifact that exists (bullets with concrete rules: "CSRF tokens on state-changing endpoints", "4.5:1 contrast ratio for normal text", "correlation IDs in error logs", etc.). These policies become the *expected behaviors* for the QA tests below.

**If a standards artifact is absent:** fall back to the generic templates below but note in the UAT frontmatter `qa_standards_source: default` so future maintainers know the tests were not tailored to documented project policies.
</step>

<step name="qa_depth_expansion">
**Think like a QA engineer — expand the test list with systematic edge case exploration, grounded in the project's documented standards.**

A happy-path test list is not enough. A senior QA engineer doesn't just verify "the feature works" — they probe the boundaries, poke at failure modes, and ask "what breaks this?". This step walks through systematic QA categories and adds targeted tests for each one that applies to the phase's work.

**The generic templates below are starting points, not end points.** For each category, first check the corresponding standards artifact (loaded in `load_project_standards`) and tailor the tests to verify the *specific* policies documented there. A project with SECURITY.md that mandates "session tokens expire after 30 minutes of inactivity" should get a QA test for that exact timeout — not a generic "test session expiry."

**Read the SUMMARY.md files again to classify what was built:**

- **Input-handling code** (forms, API endpoints, search, filters, file uploads) → Input validation tests
- **State-changing code** (CRUD, workflows, transactions) → State transition and concurrency tests
- **List/collection code** (feeds, tables, pagination, search results) → Boundary tests
- **Network-dependent code** (API calls, data fetching, file uploads) → Failure mode tests
- **UI/frontend code** → Accessibility and cross-device tests
- **Data persistence code** (database writes, caching) → Data integrity tests
- **Auth/permission code** → Security tests
- **Performance-sensitive code** (large datasets, long-running ops) → Load and perceived performance tests

**For each applicable category, append tests to the list. Use these templates as a starting point, tailored to the specific feature:**

### Input Validation Tests (for features that accept user input)
*Standards source: APIS.md (input validation patterns) + SECURITY.md (injection/XSS policies). If APIS.md documents specific validation rules — max lengths, regex patterns, rejected character classes — generate tests for those exact rules. If SECURITY.md lists required sanitization steps, verify each is applied on the inputs this phase added.*
- **Empty input** — "Submit the form with all fields empty. Expected: clear validation errors, no crash, focus moves to first invalid field."
- **Whitespace-only input** — "Submit with only spaces in required text fields. Expected: rejected as empty."
- **Max length** — "Submit input at exactly the max length (e.g., 255 chars). Expected: accepted without truncation."
- **Over max length** — "Submit input exceeding max length. Expected: clearly rejected with helpful message, no silent truncation."
- **Unicode and emoji** — "Submit input containing emoji and non-Latin characters (中文, العربية, 🎉). Expected: stored and displayed correctly."
- **Injection attempts** — "Submit input containing `<script>alert(1)</script>`, `'; DROP TABLE users;--`, and `${jndi:ldap://x}`. Expected: stored as plain text, rendered safely (no script execution), no SQL errors."
- **Invalid format** — "For email field: submit 'not-an-email'. For URL: submit 'not a url'. Expected: format validation rejects with specific error."
- **Boundary numbers** — "For numeric fields: submit 0, -1, max int, min int, decimal where integer expected. Expected: appropriate validation."

### State Transition Tests (for features with state changes)
*Standards source: APIS.md (transaction scoping, idempotency, concurrency patterns) + ERROR-HANDLING.md (how failed transitions surface to users). If APIS.md documents how concurrent writes should be resolved (last-write-wins / optimistic locking / conflict UI), test the phase's implementation of that specific rule.*
- **Double-submit** — "Click the submit button twice rapidly. Expected: only one action occurs (button disables, request deduped, or idempotent)."
- **Concurrent edit** — "Open the same record in two tabs. Edit and save in tab 1, then edit and save in tab 2. Expected: either last-write-wins with clear indication, or conflict detection with resolution UI."
- **Partial completion** — "Start a multi-step operation and abandon halfway (close tab, navigate away). Expected: no orphaned data, resumable or cleanly discarded."
- **State inconsistency probe** — "Try to perform an action in an invalid state (e.g., approve an already-approved item, delete already-deleted). Expected: graceful handling, no crash, clear feedback."

### Boundary Tests (for lists, feeds, pagination, collections)
*Standards source: APIS.md (pagination strategy, query-level limits, aggregation rules). If APIS.md mandates cursor-based pagination over LIMIT/OFFSET for large datasets, verify the phase uses the documented approach and test behavior at the exact page sizes it specifies.*
- **Empty collection** — "Load the feature with zero items. Expected: empty state UI, not a crash or blank screen."
- **Single item** — "Load with exactly one item. Expected: correct rendering, no 'see all' links that go nowhere."
- **Exact page size** — "Load with exactly the page size number of items (e.g., 10 if page size is 10). Expected: no 'load more' button, no duplicate fetch."
- **One over page size** — "Load with page size + 1 items. Expected: correct pagination, 'load more' works."
- **Large collection** — "Load with 1000+ items. Expected: virtualization or pagination prevents UI freeze, scrolling is smooth."

### Failure Mode Tests (for network-dependent code)
*Standards source: ERROR-HANDLING.md (retry strategy, error classification, user-facing vs internal errors, circuit breakers). Tests should verify the phase implements the project's documented retry pattern (exponential backoff parameters, max retry counts, circuit-breaker thresholds) — not generic retry behavior.*
- **Network offline** — "Disable network (DevTools → Offline). Attempt the action. Expected: clear error message, retry option, no silent failure."
- **Slow network** — "Throttle to Slow 3G. Attempt the action. Expected: loading state appears within 200ms, action completes or times out gracefully."
- **Request timeout** — "Simulate a request that takes >30s. Expected: timeout handling, user informed, retry option offered."
- **Server error 500** — "Trigger a backend error (e.g., by sending malformed data or using a known-broken endpoint). Expected: user sees friendly error, internals not leaked, error logged with correlation ID."
- **Partial response** — "Simulate a response that starts but never completes. Expected: eventual timeout, clean state, no hung spinner."

### Accessibility Tests (for any UI work)
*Standards source: DESIGN-SYSTEM.md (WCAG level, required interaction states, touch target sizes, reduced-motion policy, screen reader expectations). Tests should verify the *specific* a11y requirements documented there — e.g., if DESIGN-SYSTEM.md mandates WCAG 2.2 AA and 4.5:1 contrast with a 48×48 touch target minimum, test those exact numbers, not generic WCAG guidance.*
- **Keyboard-only navigation** — "Using only Tab, Shift+Tab, Enter, and Space, complete the feature's primary flow. Expected: every interactive element is reachable, focus is visible, no keyboard traps."
- **Screen reader** — "Using VoiceOver (Mac) / NVDA (Windows) / TalkBack (Android), navigate the feature. Expected: all content is announced, form fields have labels, buttons describe their purpose, status changes are announced."
- **Zoomed text** — "Set browser text size to 200%. Expected: layout doesn't break, content remains readable, no horizontal scroll at standard widths."
- **Reduced motion** — "Enable `prefers-reduced-motion: reduce` (DevTools → Rendering → Emulate). Expected: animations respect the preference (disabled or minimal)."
- **Color contrast** — "Use a contrast checker on primary text/background, button text, and error messages. Expected: all meet WCAG 2.1 AA (4.5:1 normal text, 3:1 large text)."

### Cross-Device/Browser Tests (for any UI work)
*Standards source: DESIGN-SYSTEM.md (breakpoint strategy, mobile-first rules, supported viewports). Use the breakpoints documented in DESIGN-SYSTEM.md, not generic breakpoints. If the project supports specific browsers/devices, test those.*
- **Mobile viewport** — "View at 375px wide (iPhone SE). Expected: content reflows, nothing cut off, touch targets 44×44 min."
- **Tablet viewport** — "View at 768px wide (iPad). Expected: appropriate layout for tablet, neither mobile nor desktop."
- **Desktop wide** — "View at 1920px wide. Expected: content doesn't stretch awkwardly, max-width applied where needed."
- **Touch interaction** — "On a touch device (or touch-emulated), test all interactions. Expected: no hover-only affordances, tap targets sized correctly."

### Security Tests (for auth/permission code)
*Standards source: SECURITY.md (auth mechanism, session policy, CSRF/CORS rules, data protection, input sanitization, rate limiting). Every SECURITY.md policy that applies to this phase should have at least one QA test — unauthorized access, authz bypass, session expiry timing, CSRF token validation, rate-limit thresholds. If SECURITY.md is absent, note the gap and recommend generating it.*
- **Unauthorized access attempt** — "Log out. Try to access a protected route directly via URL. Expected: redirected to login, no data leaked."
- **Authorization bypass probe** — "Log in as User A. Try to access User B's resources via direct URL manipulation (e.g., `/items/{B's ID}`). Expected: 403 or 404, no data leaked."
- **Session expiry** — "Log in, wait for session to expire (or delete the session cookie), attempt an action. Expected: graceful handling, redirect to login with return URL preserved."
- **CSRF probe** — "Trigger a state-changing action from an external origin (or via forged request). Expected: rejected due to CSRF token validation."

### Data Integrity Tests (for persistence code)
*Standards source: APIS.md (data access patterns, transaction scoping, migration safety, backfill rules) + TESTING-STRATEGY.md (test against real DB, not mocks). Integrity tests run against the real test database per TESTING-STRATEGY.md — never against mocks. Verify the phase honors APIS.md's documented transaction boundaries and migration guards.*
- **Refresh after write** — "Perform a write operation. Immediately refresh the page. Expected: the write persisted and is visible."
- **Cross-device sync** — "Perform a write on device A. Check device B (different browser or incognito). Expected: the change is visible after refresh or sync."
- **Delete and restore** — "Delete an item. Check that it's actually gone (not just hidden). Then if restore is supported, restore and verify full state returns."

### Performance Tests (for performance-sensitive code)
*Standards source: APIS.md (query performance, N+1 prevention, index-aware design, connection management). Verify the phase's performance-sensitive code honors APIS.md's documented rules — no loops with DB calls inside, queries use existing indexes, pagination at query level.*
- **Perceived performance** — "From user action to visual feedback: is there feedback within 100ms? If not, is there a loading indicator within 200ms?"
- **Large dataset handling** — "Load the feature with a realistic maximum dataset (e.g., power user with 10,000 items). Expected: no UI freeze, interactions remain responsive."
- **Memory leak probe** — "Repeat the primary action 50 times (e.g., open/close a modal, navigate back and forth). Check DevTools Memory. Expected: no unbounded growth."

---

**For each test you add, be specific and observable.** Do not add generic tests like "test error handling" — instead: "submit form with invalid email 'abc' — expect field-level error message below the email field that says 'Please enter a valid email address'".

**Skip categories that genuinely don't apply** (a phase that only adds a README doesn't need input validation tests). Document the skip in the UAT frontmatter so future maintainers know it was considered:

```yaml
qa_standards_source: tailored  # "tailored" when tests were derived from project standards artifacts; "default" when generic templates were used because artifacts were absent
qa_standards_artifacts_used:
  - .planning/SECURITY.md
  - .planning/DESIGN-SYSTEM.md
  - .planning/APIS.md
  - .planning/ERROR-HANDLING.md
  - .planning/TESTING-STRATEGY.md
qa_categories_considered:
  input_validation: applied (3 tests — derived from APIS.md validation rules)
  state_transitions: applied (2 tests — derived from APIS.md concurrency policy)
  boundaries: applied (4 tests — derived from APIS.md pagination rules)
  failure_modes: applied (2 tests — derived from ERROR-HANDLING.md retry pattern)
  accessibility: applied (5 tests — derived from DESIGN-SYSTEM.md WCAG requirements)
  cross_device: applied (3 tests — derived from DESIGN-SYSTEM.md breakpoints)
  security: N/A — no auth/permission code in this phase
  data_integrity: N/A — no persistence changes
  performance: N/A — small dataset, no long-running ops
```

**Prioritize QA tests that target the biggest risks:**
- If this is auth work → security tests are critical
- If this is a form → input validation tests are critical
- If this is a list view → boundary tests are critical
- If this is real-time data → failure mode tests are critical
- If this is a CRUD UI → data integrity + accessibility are critical

**You are not trying to test everything — you are trying to catch the bugs that would embarrass the team in production.** Quality over quantity. 5 well-chosen edge case tests beat 50 generic ones.
</step>

<step name="create_uat_file">
**Create UAT file with all tests:**

```bash
mkdir -p "$PHASE_DIR"
```

Build test list from extracted deliverables.

Create file:

```markdown
---
status: testing
phase: XX-name
source: [list of SUMMARY.md files]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: [first test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [observable behavior]
result: [pending]

### 2. [Test Name]
expected: [observable behavior]
result: [pending]

...

## Summary

total: [N]
passed: 0
issues: 0
pending: [N]
skipped: 0

## Gaps

[none yet]
```

Write to `.planning/phases/XX-name/{phase_num}-UAT.md`

Proceed to `present_test`.
</step>

<step name="present_test">
**Present current test to user:**

Read Current Test section from UAT file.

Display using checkpoint box format:

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Test {number}: {name}**

{expected}

──────────────────────────────────────────────────────────────
→ Type "pass" or describe what's wrong
──────────────────────────────────────────────────────────────
```

Wait for user response (plain text, no AskUserQuestion).
</step>

<step name="process_response">
**Process user response and update file:**

**If response indicates pass:**
- Empty response, "yes", "y", "ok", "pass", "next", "approved", "✓"

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: pass
```

**If response indicates skip:**
- "skip", "can't test", "n/a"

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: skipped
reason: [user's reason if provided]
```

**If response is anything else:**
- Treat as issue description

Infer severity from description:
- Contains: crash, error, exception, fails, broken, unusable → blocker
- Contains: doesn't work, wrong, missing, can't → major
- Contains: slow, weird, off, minor, small → minor
- Contains: color, font, spacing, alignment, visual → cosmetic
- Default if unclear: major

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: issue
reported: "{verbatim user response}"
severity: {inferred}
```

Append to Gaps section (structured YAML for plan-phase --gaps):
```yaml
- truth: "{expected behavior from test}"
  status: failed
  reason: "User reported: {verbatim user response}"
  severity: {inferred}
  test: {N}
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
```

**After any response:**

Update Summary counts.
Update frontmatter.updated timestamp.

If more tests remain → Update Current Test, go to `present_test`
If no more tests → Go to `complete_session`
</step>

<step name="resume_from_file">
**Resume testing from UAT file:**

Read the full UAT file.

Find first test with `result: [pending]`.

Announce:
```
Resuming: Phase {phase} UAT
Progress: {passed + issues + skipped}/{total}
Issues found so far: {issues count}

Continuing from Test {N}...
```

Update Current Test section with the pending test.
Proceed to `present_test`.
</step>

<step name="complete_session">
**Complete testing and commit:**

Update frontmatter:
- status: complete
- updated: [now]

Clear Current Test section:
```
## Current Test

[testing complete]
```

Commit the UAT file:
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test({phase_num}): complete UAT - {passed} passed, {issues} issues" --files ".planning/phases/XX-name/{phase_num}-UAT.md"
```

Present summary:
```
## UAT Complete: Phase {phase}

| Result | Count |
|--------|-------|
| Passed | {N}   |
| Issues | {N}   |
| Skipped| {N}   |

[If issues > 0:]
### Issues Found

[List from Issues section]
```

**If issues > 0:** Proceed to `diagnose_issues`

**If issues == 0:**
```
All tests passed. Ready to continue.

- `/gsd:plan-phase {next}` — Plan next phase
- `/gsd:execute-phase {next}` — Execute next phase
- `/gsd:ui-review {phase}` — visual quality audit (if frontend files were modified)
```
</step>

<step name="diagnose_issues">
**Diagnose root causes before planning fixes:**

```
---

{N} issues found. Diagnosing root causes...

Spawning parallel debug agents to investigate each issue.
```

- Load diagnose-issues workflow
- Follow @/Users/phillipdougherty/.claude/get-shit-done/workflows/diagnose-issues.md
- Spawn parallel debug agents for each issue
- Collect root causes
- Update UAT.md with root causes
- Proceed to `plan_gap_closure`

Diagnosis runs automatically - no user prompt. Parallel agents investigate simultaneously, so overhead is minimal and fixes are more accurate.
</step>

<step name="plan_gap_closure">
**Auto-plan fixes from diagnosed gaps:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner for gap closure...
```

Spawn gsd-planner in --gaps mode:

```
Task(
  prompt="""
<planning_context>

**Phase:** {phase_number}
**Mode:** gap_closure

<files_to_read>
- {phase_dir}/{phase_num}-UAT.md (UAT with diagnoses)
- .planning/STATE.md (Project State)
- .planning/ROADMAP.md (Roadmap)
</files_to_read>

</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase
Plans must be executable prompts.
</downstream_consumer>
""",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Plan gap fixes for Phase {phase}"
)
```

On return:
- **PLANNING COMPLETE:** Proceed to `verify_gap_plans`
- **PLANNING INCONCLUSIVE:** Report and offer manual intervention
</step>

<step name="verify_gap_plans">
**Verify fix plans with checker:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING FIX PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Initialize: `iteration_count = 1`

Spawn gsd-plan-checker:

```
Task(
  prompt="""
<verification_context>

**Phase:** {phase_number}
**Phase Goal:** Close diagnosed gaps from UAT

<files_to_read>
- {phase_dir}/*-PLAN.md (Plans to verify)
</files_to_read>

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
""",
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} fix plans"
)
```

On return:
- **VERIFICATION PASSED:** Proceed to `present_ready`
- **ISSUES FOUND:** Proceed to `revision_loop`
</step>

<step name="revision_loop">
**Iterate planner ↔ checker until plans pass (max 3):**

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Spawn gsd-planner with revision context:

```
Task(
  prompt="""
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {phase_dir}/*-PLAN.md (Existing plans)
</files_to_read>

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
Read existing PLAN.md files. Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
</instructions>
""",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

After planner returns → spawn checker again (verify_gap_plans logic)
Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain.`

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit, user runs /gsd:plan-phase manually)

Wait for user response.
</step>

<step name="present_ready">
**Present completion and next steps:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► FIXES READY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} gap(s) diagnosed, {M} fix plan(s) created

| Gap | Root Cause | Fix Plan |
|-----|------------|----------|
| {truth 1} | {root_cause} | {phase}-04 |
| {truth 2} | {root_cause} | {phase}-04 |

Plans verified and ready for execution.

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute fixes** — run fix plans

`/clear` then `/gsd:execute-phase {phase} --gaps-only`

───────────────────────────────────────────────────────────────
```
</step>

</process>

<update_rules>
**Batched writes for efficiency:**

Keep results in memory. Write to file only when:
1. **Issue found** — Preserve the problem immediately
2. **Session complete** — Final write before commit
3. **Checkpoint** — Every 5 passed tests (safety net)

| Section | Rule | When Written |
|---------|------|--------------|
| Frontmatter.status | OVERWRITE | Start, complete |
| Frontmatter.updated | OVERWRITE | On any file write |
| Current Test | OVERWRITE | On any file write |
| Tests.{N}.result | OVERWRITE | On any file write |
| Summary | OVERWRITE | On any file write |
| Gaps | APPEND | When issue found |

On context reset: File shows last checkpoint. Resume from there.
</update_rules>

<severity_inference>
**Infer severity from user's natural language:**

| User says | Infer |
|-----------|-------|
| "crashes", "error", "exception", "fails completely" | blocker |
| "doesn't work", "nothing happens", "wrong behavior" | major |
| "works but...", "slow", "weird", "minor issue" | minor |
| "color", "spacing", "alignment", "looks off" | cosmetic |

Default to **major** if unclear. User can correct if needed.

**Never ask "how severe is this?"** - just infer and move on.
</severity_inference>

<success_criteria>
- [ ] UAT file created with all tests from SUMMARY.md
- [ ] Project standards artifacts loaded (SECURITY.md / APIS.md / TESTING-STRATEGY.md / ERROR-HANDLING.md / DESIGN-SYSTEM.md where they exist)
- [ ] QA depth expansion applied — systematic edge case tests added based on what was built
- [ ] QA tests tailored to the specific policies documented in project standards (not just generic templates)
- [ ] qa_standards_source frontmatter recorded (`tailored` when artifacts used, `default` when absent)
- [ ] QA categories considered documented in UAT frontmatter (applied vs N/A with reasoning)
- [ ] Tests presented one at a time with expected behavior
- [ ] User responses processed as pass/issue/skip
- [ ] Severity inferred from description (never asked)
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] Committed on completion
- [ ] If issues: parallel debug agents diagnose root causes
- [ ] If issues: gsd-planner creates fix plans (gap_closure mode)
- [ ] If issues: gsd-plan-checker verifies fix plans
- [ ] If issues: revision loop until plans pass (max 3 iterations)
- [ ] Ready for `/gsd:execute-phase --gaps-only` when complete
</success_criteria>
