<purpose>
Orchestrate parallel codebase mapper agents to analyze codebase and produce structured documents in .planning/codebase/

Each agent has fresh context, explores a specific focus area, and **writes documents directly**. The orchestrator only receives confirmation + line counts, then writes a summary.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.
</purpose>

<philosophy>
**Why dedicated mapper agents:**
- Fresh context per domain (no token contamination)
- Agents write documents directly (no context transfer back to orchestrator)
- Orchestrator only summarizes what was created (minimal context usage)
- Faster execution (agents run simultaneously)

**Document quality over length:**
Include enough detail to be useful as reference. Prioritize practical examples (especially code patterns) over arbitrary brevity.

**Always include file paths:**
Documents are reference material for Claude when planning/executing. Always include actual file paths formatted with backticks: `src/services/user.ts`.
</philosophy>

<process>

<step name="init_context" priority="first">
Load codebase mapping context:

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `mapper_model`, `commit_docs`, `codebase_dir`, `existing_maps`, `has_maps`, `codebase_dir_exists`.
</step>

<step name="check_existing">
Check if .planning/codebase/ already exists using `has_maps` from init context.

If `codebase_dir_exists` is true:
```bash
ls -la .planning/codebase/
```

**If exists:**

```
.planning/codebase/ already exists with these documents:
[List files found]

What's next?
1. Refresh - Delete existing and remap codebase
2. Update - Keep existing, only update specific documents
3. Skip - Use existing codebase map as-is
```

Wait for user response.

If "Refresh": Delete .planning/codebase/, continue to create_structure
If "Update": Ask which documents to update, continue to spawn_agents (filtered)
If "Skip": Exit workflow

**If doesn't exist:**
Continue to create_structure.
</step>

<step name="create_structure">
Create .planning/codebase/ directory:

```bash
mkdir -p .planning/codebase
```

**Expected output files:**
- STACK.md (from tech mapper)
- INTEGRATIONS.md (from tech mapper)
- ARCHITECTURE.md (from arch mapper)
- STRUCTURE.md (from arch mapper)
- CONVENTIONS.md (from quality mapper)
- TESTING.md (from quality mapper)
- CONCERNS.md (from concerns mapper)

Continue to spawn_agents.
</step>

<step name="detect_standards_artifacts">
Before spawning mappers, detect which project standards artifacts exist. Quality and Concerns mappers use these to flag drift between documented policy and observed code — high-value signal that's invisible without the comparison.

```bash
SECURITY_EXISTS=$(test -f .planning/SECURITY.md && echo "true" || echo "false")
APIS_EXISTS=$(test -f .planning/APIS.md && echo "true" || echo "false")
TESTING_STRATEGY_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
ERROR_HANDLING_EXISTS=$(test -f .planning/ERROR-HANDLING.md && echo "true" || echo "false")
DESIGN_SYSTEM_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")
```

Build a list of existing artifact paths to pass into Agent 3 (Quality) and Agent 4 (Concerns) prompts. If no artifacts exist, the mappers run as before — drift detection becomes a no-op rather than failing.
</step>

<step name="spawn_agents">
Spawn 4 parallel gsd-codebase-mapper agents.

Use Task tool with `subagent_type="gsd-codebase-mapper"`, `model="{mapper_model}"`, and `run_in_background=true` for parallel execution.

**CRITICAL:** Use the dedicated `gsd-codebase-mapper` agent, NOT `Explore`. The mapper agent writes documents directly.

**Agent 1: Tech Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase tech stack",
  prompt="Focus: tech

Analyze this codebase for technology stack and external integrations.

Write these documents to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks

Explore thoroughly. Write documents directly using templates. Return confirmation only."
)
```

**Agent 2: Architecture Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase architecture",
  prompt="Focus: arch

Analyze this codebase architecture and directory structure.

Write these documents to .planning/codebase/:
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions

Explore thoroughly. Write documents directly using templates. Return confirmation only."
)
```

**Agent 3: Quality Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase conventions",
  prompt="Focus: quality

Analyze this codebase for coding conventions and testing patterns.

Write these documents to .planning/codebase/:
- CONVENTIONS.md - Code style, naming, patterns, error handling
- TESTING.md - Framework, structure, mocking, coverage

{if APIS_EXISTS or ERROR_HANDLING_EXISTS or SECURITY_EXISTS or TESTING_STRATEGY_EXISTS:}
**Standards artifacts to compare against** (read these before writing your output documents):
{if APIS_EXISTS: '- .planning/APIS.md (documented API design & data access standards)'}
{if ERROR_HANDLING_EXISTS: '- .planning/ERROR-HANDLING.md (documented error handling patterns)'}
{if SECURITY_EXISTS: '- .planning/SECURITY.md (documented security standards)'}
{if TESTING_STRATEGY_EXISTS: '- .planning/TESTING-STRATEGY.md (documented testing philosophy — including the no-mocks rule)'}

**Drift detection (mandatory when standards artifacts exist):**

In CONVENTIONS.md, add a 'Documented vs Observed' section that compares:
- ERROR-HANDLING.md policies vs observed error handling in the codebase (correlation IDs, classification, retry patterns)
- APIS.md policies vs observed API patterns (pagination, validation, migration guards)
- SECURITY.md policies vs observed security primitives (CSRF, session, auth middleware)

In TESTING.md, add a 'Documented vs Observed' section that compares:
- TESTING-STRATEGY.md no-mocks rule vs actual mock usage in the codebase. Grep for mocking-library imports (jest.mock, vi.mock, sinon, unittest.mock, Moq, NSubstitute, etc.) and report counts + sample paths. Any mock of owned code is drift.
- TESTING-STRATEGY.md unit/integration/E2E boundaries vs observed test layout
- TESTING-STRATEGY.md coverage philosophy vs observed coverage approach

For each drift entry, format as: '{policy} → {observed reality} → {drift severity}'. Severity: VIOLATION (contradicts policy), GAP (policy not yet implemented), DRIFT (extended without updating docs).

If no standards artifacts exist, skip drift detection and write the documents normally — note in each document 'No standards artifacts found in .planning/ — generate them via /gsd:new-milestone for drift detection on next run.'
{else:}
No standards artifacts found in .planning/. Write CONVENTIONS.md and TESTING.md normally; note at the top of each: 'No standards artifacts present — recommend generating SECURITY.md / APIS.md / TESTING-STRATEGY.md / ERROR-HANDLING.md via /gsd:new-milestone to enable drift detection.'
{endif}

Explore thoroughly. Write documents directly using templates. Return confirmation only."
)
```

**Agent 4: Concerns Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase concerns",
  prompt="Focus: concerns

Analyze this codebase for technical debt, known issues, and areas of concern.

Write this document to .planning/codebase/:
- CONCERNS.md - Tech debt, bugs, security, performance, fragile areas

{if SECURITY_EXISTS or APIS_EXISTS or ERROR_HANDLING_EXISTS or TESTING_STRATEGY_EXISTS or DESIGN_SYSTEM_EXISTS:}
**Standards artifacts to compare against** (read these before writing your output document):
{if SECURITY_EXISTS: '- .planning/SECURITY.md'}
{if APIS_EXISTS: '- .planning/APIS.md'}
{if ERROR_HANDLING_EXISTS: '- .planning/ERROR-HANDLING.md'}
{if TESTING_STRATEGY_EXISTS: '- .planning/TESTING-STRATEGY.md'}
{if DESIGN_SYSTEM_EXISTS: '- .planning/DESIGN-SYSTEM.md'}

**Standards Violation as a first-class concern category:**

In CONCERNS.md, add a top-level 'Standards Violations' section that surfaces concrete code-level violations of documented policies. Examples:
- SECURITY.md mandates CSRF protection but observed POST handlers lack it
- APIS.md mandates idempotent migrations but observed migrations lack IF EXISTS guards
- TESTING-STRATEGY.md forbids mocks of owned code but observed tests mock owned services (cite specific files)
- ERROR-HANDLING.md mandates correlation IDs in error logs but observed error paths lack them
- DESIGN-SYSTEM.md mandates specific interaction states but observed components only implement subset

Each violation entry: file path, line number(s), policy violated, severity (BLOCKER for security/data integrity, MAJOR for functional gaps, MINOR for stylistic drift).

Treat standards violations as concerns even when the code 'works' — the entire purpose of documented standards is that code which violates them will fail in production scenarios the standards were written to prevent.
{else:}
No standards artifacts found in .planning/. Document concerns normally; note 'Standards artifacts not present — recommend generating them via /gsd:new-milestone to surface policy-violation concerns.'
{endif}

Explore thoroughly. Write document directly using template. Return confirmation only."
)
```

Continue to collect_confirmations.
</step>

<step name="collect_confirmations">
Wait for all 4 agents to complete.

Read each agent's output file to collect confirmations.

**Expected confirmation format from each agent:**
```
## Mapping Complete

**Focus:** {focus}
**Documents written:**
- `.planning/codebase/{DOC1}.md` ({N} lines)
- `.planning/codebase/{DOC2}.md` ({N} lines)

Ready for orchestrator summary.
```

**What you receive:** Just file paths and line counts. NOT document contents.

If any agent failed, note the failure and continue with successful documents.

Continue to verify_output.
</step>

<step name="verify_output">
Verify all documents created successfully:

```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

**Verification checklist:**
- All 7 documents exist
- No empty documents (each should have >20 lines)

If any documents missing or empty, note which agents may have failed.

Continue to scan_for_secrets.
</step>

<step name="scan_for_secrets">
**CRITICAL SECURITY CHECK:** Scan output files for accidentally leaked secrets before committing.

Run secret pattern detection:

```bash
# Check for common API key patterns in generated docs
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' .planning/codebase/*.md 2>/dev/null && SECRETS_FOUND=true || SECRETS_FOUND=false
```

**If SECRETS_FOUND=true:**

```
⚠️  SECURITY ALERT: Potential secrets detected in codebase documents!

Found patterns that look like API keys or tokens in:
[show grep output]

This would expose credentials if committed.

**Action required:**
1. Review the flagged content above
2. If these are real secrets, they must be removed before committing
3. Consider adding sensitive files to Claude Code "Deny" permissions

Pausing before commit. Reply "safe to proceed" if the flagged content is not actually sensitive, or edit the files first.
```

Wait for user confirmation before continuing to commit_codebase_map.

**If SECRETS_FOUND=false:**

Continue to commit_codebase_map.
</step>

<step name="commit_codebase_map">
Commit the codebase map:

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: map existing codebase" --files .planning/codebase/*.md
```

Continue to offer_next.
</step>

<step name="offer_next">
Present completion summary and next steps.

**Get line counts:**
```bash
wc -l .planning/codebase/*.md
```

**Output format:**

```
Codebase mapping complete.

Created .planning/codebase/:
- STACK.md ([N] lines) - Technologies and dependencies
- ARCHITECTURE.md ([N] lines) - System design and patterns
- STRUCTURE.md ([N] lines) - Directory layout and organization
- CONVENTIONS.md ([N] lines) - Code style and patterns
- TESTING.md ([N] lines) - Test structure and practices
- INTEGRATIONS.md ([N] lines) - External services and APIs
- CONCERNS.md ([N] lines) - Technical debt and issues


---

## ▶ Next Up

**Initialize project** — use codebase context for planning

`/gsd:new-project`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- Re-run mapping: `/gsd:map-codebase`
- Review specific file: `cat .planning/codebase/STACK.md`
- Edit any document before proceeding

---
```

End workflow.
</step>

</process>

<success_criteria>
- .planning/codebase/ directory created
- 4 parallel gsd-codebase-mapper agents spawned with run_in_background=true
- Agents write documents directly (orchestrator doesn't receive document contents)
- Read agent output files to collect confirmations
- All 7 codebase documents exist
- Clear completion summary with line counts
- User offered clear next steps in GSD style
</success_criteria>
