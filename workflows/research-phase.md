<purpose>
Research how to implement a phase. Spawns gsd-phase-researcher with phase context.

Standalone research command. For most workflows, use `/gsd:plan-phase` which integrates research automatically.
</purpose>

<process>

## Step 0: Resolve Model Profile

@/Users/phillipdougherty/.claude/get-shit-done/references/model-profile-resolution.md

Resolve model for:
- `gsd-phase-researcher`

## Step 1: Normalize and Validate Phase

@/Users/phillipdougherty/.claude/get-shit-done/references/phase-argument-parsing.md

```bash
PHASE_INFO=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

If `found` is false: Error and exit.

## Step 2: Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

If exists: Offer update/view/skip options.

## Step 3: Gather Phase Context

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Extract: phase_dir, padded_phase, phase_number, state_path, requirements_path, context_path
```

## Step 3.5: Detect Project Standards Artifacts

Before spawning the researcher, detect which standards artifacts exist. The researcher needs these so its recommendations align with the project's documented posture instead of returning generic best-practice answers that may contradict existing policy.

```bash
SECURITY_EXISTS=$(test -f .planning/SECURITY.md && echo "true" || echo "false")
APIS_EXISTS=$(test -f .planning/APIS.md && echo "true" || echo "false")
TESTING_STRATEGY_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
ERROR_HANDLING_EXISTS=$(test -f .planning/ERROR-HANDLING.md && echo "true" || echo "false")
DESIGN_SYSTEM_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")
```

Build a list of existing standards paths to pass into the researcher's `<files_to_read>` block.

## Step 4: Spawn Researcher

```
Task(
  prompt="<objective>
Research implementation approach for Phase {phase}: {name}
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /gsd:discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
{if SECURITY_EXISTS: '- .planning/SECURITY.md (Project security standards — align recommendations with documented policies)'}
{if APIS_EXISTS: '- .planning/APIS.md (Project API design & data access standards)'}
{if TESTING_STRATEGY_EXISTS: '- .planning/TESTING-STRATEGY.md (Project testing philosophy — honor no-mocks and coverage rules)'}
{if ERROR_HANDLING_EXISTS: '- .planning/ERROR-HANDLING.md (Project error handling patterns)'}
{if DESIGN_SYSTEM_EXISTS: '- .planning/DESIGN-SYSTEM.md (Project UX & accessibility standards)'}
</files_to_read>

<additional_context>
Phase description: {description}
</additional_context>

<project_standards_constraint>
All proposed patterns MUST align with or consciously extend the project's documented standards (the artifacts listed above). If a recommendation contradicts an existing standard, you must flag the contradiction explicitly and justify why the extension or deviation is warranted — do not silently propose patterns that violate documented policy. If no standards artifact exists for a relevant domain, note its absence and recommend generating one before proceeding. For testing recommendations specifically: honor TESTING-STRATEGY.md's no-mocks rule (test against real dependencies, only mock external paid APIs/clock/RNG) — never propose mocking owned code.
</project_standards_constraint>

<output>
Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md

Include a dedicated "Standards Alignment" section that explicitly maps each major recommendation to the relevant standards artifact (or notes the artifact's absence).
</output>",
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}"
)
```

## Step 5: Handle Return

- `## RESEARCH COMPLETE` — Display summary, offer: Plan/Dig deeper/Review/Done
- `## CHECKPOINT REACHED` — Present to user, spawn continuation
- `## RESEARCH INCONCLUSIVE` — Show attempts, offer: Add context/Try different mode/Manual

</process>
