<purpose>
Verify phase goal achievement through goal-backward analysis. Check that the codebase delivers what the phase promised, not just that tasks completed.

Executed by a verification subagent spawned from execute-phase.md.
</purpose>

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — but the goal "working chat interface" was not achieved.

Goal-backward verification:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</core_principle>

<required_reading>
@/Users/phillipdougherty/.claude/get-shit-done/references/verification-patterns.md
@/Users/phillipdougherty/.claude/get-shit-done/templates/verification-report.md
</required_reading>

<process>

<step name="load_context" priority="first">
Load phase operation context:

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Then load phase details and list plans/summaries:
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md 2>/dev/null
```

Extract **phase goal** from ROADMAP.md (the outcome to verify, not tasks) and **requirements** from REQUIREMENTS.md if it exists.
</step>

<step name="establish_must_haves">
**Option A: Must-haves in PLAN frontmatter**

Use gsd-tools to extract must_haves from each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

Returns JSON: `{ truths: [...], artifacts: [...], key_links: [...] }`

Aggregate all must_haves across plans for phase-level verification.

**Option B: Use Success Criteria from ROADMAP.md**

If no must_haves in frontmatter (MUST_HAVES returns error or empty), check for Success Criteria:

```bash
PHASE_DATA=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${phase_number}" --raw)
```

Parse the `success_criteria` array from the JSON output. If non-empty:
1. Use each Success Criterion directly as a **truth** (they are already written as observable, testable behaviors)
2. Derive **artifacts** (concrete file paths for each truth)
3. Derive **key links** (critical wiring where stubs hide)
4. Document the must-haves before proceeding

Success Criteria from ROADMAP.md are the contract — they override PLAN-level must_haves when both exist.

**Option C: Derive from phase goal (fallback)**

If no must_haves in frontmatter AND no Success Criteria in ROADMAP:
1. State the goal from ROADMAP.md
2. Derive **truths** (3-7 observable behaviors, each testable)
3. Derive **artifacts** (concrete file paths for each truth)
4. Derive **key links** (critical wiring where stubs hide)
5. Document derived must-haves before proceeding
</step>

<step name="verify_truths">
For each observable truth, determine if the codebase enables it.

**Status:** ✓ VERIFIED (all supporting artifacts pass) | ✗ FAILED (artifact missing/stub/unwired) | ? UNCERTAIN (needs human)

For each truth: identify supporting artifacts → check artifact status → check wiring → determine truth status.

**Example:** Truth "User can see existing messages" depends on Chat.tsx (renders), /api/chat GET (provides), Message model (schema). If Chat.tsx is a stub or API returns hardcoded [] → FAILED. If all exist, are substantive, and connected → VERIFIED.
</step>

<step name="verify_artifacts">
Use gsd-tools for artifact verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" verify artifacts "$plan")
  echo "=== $plan ===" && echo "$ARTIFACT_RESULT"
done
```

Parse JSON result: `{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

**Artifact status from result:**
- `exists=false` → MISSING
- `issues` not empty → STUB (check issues for "Only N lines" or "Missing pattern")
- `passed=true` → VERIFIED (Levels 1-2 pass)

**Level 3 — Wired (manual check for artifacts that pass Levels 1-2):**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx"  # IMPORTED
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import"  # USED
```
WIRED = imported AND used. ORPHANED = exists but not imported/used.

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |
</step>

<step name="verify_wiring">
Use gsd-tools for key link verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" verify key-links "$plan")
  echo "=== $plan ===" && echo "$LINKS_RESULT"
done
```

Parse JSON result: `{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

**Link status from result:**
- `verified=true` → WIRED
- `verified=false` with "not found" → NOT_WIRED
- `verified=false` with "Pattern not found" → PARTIAL

**Fallback patterns (if key_links not in must_haves):**

| Pattern | Check | Status |
|---------|-------|--------|
| Component → API | fetch/axios call to API path, response used (await/.then/setState) | WIRED / PARTIAL (call but unused response) / NOT_WIRED |
| API → Database | Prisma/DB query on model, result returned via res.json() | WIRED / PARTIAL (query but not returned) / NOT_WIRED |
| Form → Handler | onSubmit with real implementation (fetch/axios/mutate/dispatch), not console.log/empty | WIRED / STUB (log-only/empty) / NOT_WIRED |
| State → Render | useState variable appears in JSX (`{stateVar}` or `{stateVar.property}`) | WIRED / NOT_WIRED |

Record status and evidence for each key link.
</step>

<step name="verify_requirements">
If REQUIREMENTS.md exists:
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement: parse description → identify supporting truths/artifacts → status: ✓ SATISFIED / ✗ BLOCKED / ? NEEDS HUMAN.
</step>

<step name="scan_antipatterns">
Extract files modified in this phase from SUMMARY.md, scan each:

| Pattern | Search | Severity |
|---------|--------|----------|
| TODO/FIXME/XXX/HACK | `grep -n -E "TODO\|FIXME\|XXX\|HACK"` | ⚠️ Warning |
| Placeholder content | `grep -n -iE "placeholder\|coming soon\|will be here"` | 🛑 Blocker |
| Empty returns | `grep -n -E "return null\|return \{\}\|return \[\]\|=> \{\}"` | ⚠️ Warning |
| Log-only functions | Functions containing only console.log | ⚠️ Warning |

Categorize: 🛑 Blocker (prevents goal) | ⚠️ Warning (incomplete) | ℹ️ Info (notable).
</step>

<step name="scan_standards_compliance">
**Verify phase code complies with project standards artifacts.** Generic anti-pattern scanning catches obvious stubs, but it does not catch code that's complete yet violates the project's own documented policies (e.g., an endpoint that ships without rate limiting when SECURITY.md requires it, or a migration without `IF EXISTS` guards when APIS.md mandates idempotent migrations).

**Load standards artifacts** (each is optional — skip any that don't exist):

```bash
SECURITY_EXISTS=$(test -f .planning/SECURITY.md && echo "true" || echo "false")
APIS_EXISTS=$(test -f .planning/APIS.md && echo "true" || echo "false")
TESTING_STRATEGY_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
ERROR_HANDLING_EXISTS=$(test -f .planning/ERROR-HANDLING.md && echo "true" || echo "false")
DESIGN_SYSTEM_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")
```

For each existing artifact, cat its contents and extract the enforceable policies (bullets with concrete rules — not philosophical framing).

**Classify each phase-modified file by domain** to decide which artifacts apply:

| File domain | Signals | Relevant artifacts |
|-------------|---------|--------------------|
| Auth/authz | `session`, `jwt`, `cookie`, `login`, `logout`, `authorize`, `permission`, auth middleware | SECURITY.md |
| API endpoint | route handlers, REST/GraphQL resolvers, request/response schemas | APIS.md, SECURITY.md (auth on endpoint), ERROR-HANDLING.md |
| DB query / migration | Prisma/Sequelize/Drizzle calls, raw SQL, migration files | APIS.md (data access + migration safety) |
| Error paths | try/catch blocks, error middleware, error classes | ERROR-HANDLING.md |
| Test files | `.test.`, `.spec.`, `__tests__/`, test runners | TESTING-STRATEGY.md |
| UI / frontend | `.tsx`, `.jsx`, component files, styles | DESIGN-SYSTEM.md |
| Logging / observability | logger calls, metric emission, trace instrumentation | SECURITY.md (no sensitive data in logs), ERROR-HANDLING.md |

**For each classified file, spot-check against the relevant artifact(s). Record findings:**

| Finding type | Example | Severity |
|--------------|---------|----------|
| Policy violation | SECURITY.md requires CSRF protection on state-changing endpoints — new POST handler has no CSRF check | 🛑 Blocker |
| Policy missing | APIS.md mandates idempotent migrations — new migration lacks `IF NOT EXISTS` / `IF EXISTS` guards | 🛑 Blocker |
| Policy violation | TESTING-STRATEGY.md forbids mocking owned code — new test file imports `jest.mock` for a project-owned service | 🛑 Blocker |
| Policy partial | ERROR-HANDLING.md requires correlation IDs in error logs — new error path logs stack but not correlation ID | ⚠️ Warning |
| Policy drift | DESIGN-SYSTEM.md requires hover/focus/disabled states for interactive elements — new button only implements default + hover | ⚠️ Warning |
| Standard absent | No SECURITY.md exists, but phase added auth code — recommend generating SECURITY.md via `/gsd:new-milestone` | ℹ️ Info |

**Scan technique per artifact:**

- **SECURITY.md** — For auth/authz files: grep for the auth primitives the doc mandates (CSRF tokens, session validation, input sanitization). Flag absent primitives on files that should have them.
- **APIS.md** — For DB files: grep for `IF NOT EXISTS`, `IF EXISTS`, bare `DROP`, `N+1`-shaped queries (loops with DB calls inside), transaction scoping. For endpoint files: grep for pagination, input validation, versioning markers.
- **TESTING-STRATEGY.md** — For test files: grep for mocking library imports against owned code paths. Any `jest.mock('../services/foo')`, `vi.mock('@/db/client')`, `sinon.stub(userRepo, ...)`, or equivalent targeting project-owned modules is a blocker.
- **ERROR-HANDLING.md** — For error-path files: check for correlation IDs in error logs, error classification (operational vs programmer), user-facing vs internal error separation.
- **DESIGN-SYSTEM.md** — For UI files: check for all required interaction states (default/hover/focus/active/disabled/loading/error/empty), a11y attributes (`aria-label`, `role`, semantic HTML), responsive handling.

**Output:** Add findings to the VERIFICATION.md report under a new section "Standards Compliance". Schema:

```yaml
standards_compliance:
  artifacts_checked:
    - SECURITY.md
    - APIS.md
    - TESTING-STRATEGY.md
  artifacts_missing:
    - ERROR-HANDLING.md  # present in project? if not, note "not yet generated"
  findings:
    - artifact: SECURITY.md
      file: src/api/checkout.ts
      policy: "CSRF protection on state-changing endpoints"
      status: violated
      severity: blocker
      evidence: "POST handler at line 42 does not invoke csrf middleware present in src/middleware/csrf.ts"
    - artifact: TESTING-STRATEGY.md
      file: src/services/user.test.ts
      policy: "No mocks of owned code"
      status: violated
      severity: blocker
      evidence: "Line 8: jest.mock('../repos/userRepo') stubs an owned repository"
```

**Any 🛑 Blocker standards-compliance finding forces phase status to `gaps_found`** — same rule as anti-pattern blockers. ⚠️ Warnings feed into phase tech debt. ℹ️ Info entries are advisory.
</step>

<step name="identify_human_verification">
**Always needs human:** Visual appearance, user flow completion, real-time behavior (WebSocket/SSE), external service integration, performance feel, error message clarity.

**Needs human if uncertain:** Complex wiring grep can't trace, dynamic state-dependent behavior, edge cases.

Format each as: Test Name → What to do → Expected result → Why can't verify programmatically.
</step>

<step name="determine_status">
**passed:** All truths VERIFIED, all artifacts pass levels 1-3, all key links WIRED, no blocker anti-patterns, no blocker standards-compliance findings.

**gaps_found:** Any truth FAILED, artifact MISSING/STUB, key link NOT_WIRED, blocker anti-pattern found, or blocker standards-compliance finding.

**human_needed:** All automated checks pass but human verification items remain.

**Score:** `verified_truths / total_truths`
</step>

<step name="generate_fix_plans">
If gaps_found:

1. **Cluster related gaps:** API stub + component unwired → "Wire frontend to backend". Multiple missing → "Complete core implementation". Wiring only → "Connect existing components".

2. **Generate plan per cluster:** Objective, 2-3 tasks (files/action/verify each), re-verify step. Keep focused: single concern per plan.

3. **Order by dependency:** Fix missing → fix stubs → fix wiring → verify.
</step>

<step name="create_report">
```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Fill template sections: frontmatter (phase/timestamp/status/score), goal achievement, artifact table, wiring table, requirements coverage, anti-patterns, human verification, gaps summary, fix plans (if gaps_found), metadata.

See /Users/phillipdougherty/.claude/get-shit-done/templates/verification-report.md for complete template.
</step>

<step name="return_to_orchestrator">
Return status (`passed` | `gaps_found` | `human_needed`), score (N/M must-haves), report path.

If gaps_found: list gaps + recommended fix plan names.
If human_needed: list items requiring human testing.

Orchestrator routes: `passed` → update_roadmap | `gaps_found` → create/execute fixes, re-verify | `human_needed` → present to user.
</step>

</process>

<success_criteria>
- [ ] Must-haves established (from frontmatter or derived)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] Anti-patterns scanned and categorized
- [ ] Standards compliance scanned against existing project artifacts (SECURITY.md / APIS.md / TESTING-STRATEGY.md / ERROR-HANDLING.md / DESIGN-SYSTEM.md)
- [ ] Standards-compliance findings recorded in VERIFICATION.md with severity
- [ ] Blocker standards findings force gaps_found status
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] VERIFICATION.md created with complete report
- [ ] Results returned to orchestrator
</success_criteria>
