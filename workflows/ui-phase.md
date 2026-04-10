<purpose>
Generate a UI design contract (UI-SPEC.md) for frontend phases. Orchestrates gsd-ui-researcher and gsd-ui-checker with a revision loop. Inserts between discuss-phase and plan-phase in the lifecycle.

UI-SPEC.md locks spacing, typography, color, copywriting, and design system decisions before the planner creates tasks. This prevents design debt caused by ad-hoc styling decisions during execution.
</purpose>

<required_reading>
@/Users/phillipdougherty/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<process>

## 1. Initialize

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`.

**File paths:** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`.

Resolve UI agent models:

```bash
UI_RESEARCHER_MODEL=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-ui-researcher --raw)
UI_CHECKER_MODEL=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-ui-checker --raw)
```

Check config:

```bash
UI_ENABLED=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.ui_phase 2>/dev/null || echo "true")
```

**If `UI_ENABLED` is `false`:**
```
UI phase is disabled in config. Enable via /gsd:settings.
```
Exit workflow.

**If `planning_exists` is false:** Error — run `/gsd:new-project` first.

## 2. Parse and Validate Phase

Extract phase number from $ARGUMENTS. If not provided, detect next unplanned phase.

```bash
PHASE_INFO=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

**If `found` is false:** Error with available phases.

## 3. Check Prerequisites

**If `has_context` is false:**
```
No CONTEXT.md found for Phase {N}.
Recommended: run /gsd:discuss-phase {N} first to capture design preferences.
Continuing without user decisions — UI researcher will ask all questions.
```
Continue (non-blocking).

**If `has_research` is false:**
```
No RESEARCH.md found for Phase {N}.
Note: stack decisions (component library, styling approach) will be asked during UI research.
```
Continue (non-blocking).

**Check for DESIGN-SYSTEM.md (MANDATORY for UI phases):**

```bash
DESIGN_SYSTEM_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")
```

**If `DESIGN_SYSTEM_EXISTS` is false:**

Display:
```
⚠ No DESIGN-SYSTEM.md found for this project.

DESIGN-SYSTEM.md defines accessibility standards, required interaction
states, responsive strategy, and UX requirements that the UI researcher
and checker use to validate the design contract.

Generating DESIGN-SYSTEM.md from defaults + project context...
```

Generate DESIGN-SYSTEM.md using the template defined in `new-project.md` Step 7.5, tailored to the project's stack (from PROJECT.md and any research context). Commit:

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: generate DESIGN-SYSTEM.md for UI phase" --files .planning/DESIGN-SYSTEM.md
```

**If exists:** Continue silently.

Set path for downstream agents:
```bash
DESIGN_SYSTEM_PATH=".planning/DESIGN-SYSTEM.md"
```

## 4. Check Existing UI-SPEC

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**If exists:** Use AskUserQuestion:
- header: "Existing UI-SPEC"
- question: "UI-SPEC.md already exists for Phase {N}. What would you like to do?"
- options:
  - "Update — re-run researcher with existing as baseline"
  - "View — display current UI-SPEC and exit"
  - "Skip — keep current UI-SPEC, proceed to verification"

If "View": display file contents, exit.
If "Skip": proceed to step 7 (checker).
If "Update": continue to step 5.

## 5. Spawn gsd-ui-researcher

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI DESIGN CONTRACT — PHASE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning UI researcher...
```

Build prompt:

```markdown
Read /Users/phillipdougherty/.claude/agents/gsd-ui-researcher.md for instructions.

<objective>
Create UI design contract for Phase {phase_number}: {phase_name}
Answer: "What visual and interaction contracts does this phase need?"

**You are acting as a senior UX designer.** Think about the full user experience:
not just the happy path visual, but accessibility, every interaction state,
error handling in the UI, empty states, loading behavior, responsive behavior
across devices, and reuse of existing components. A new Button variant is
better than a new ButtonV2 component — refactor-first applies to UI too.
</objective>

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /gsd:discuss-phase)
- {research_path} (Technical Research — stack decisions)
- {DESIGN_SYSTEM_PATH} (Project UX & accessibility standards — MANDATORY, the UI-SPEC must comply with this)
</files_to_read>

<ux_designer_requirements>
The UI-SPEC.md you produce MUST address ALL of these dimensions per DESIGN-SYSTEM.md:

1. **Accessibility (WCAG 2.1 AA)**
   - Color contrast ratios (4.5:1 normal text, 3:1 large text) — specify actual contrast values
   - Keyboard navigation — every interactive element reachable via Tab, operable via Enter/Space
   - Focus management — visible focus indicators, logical tab order, focus trapping in modals
   - Screen reader support — semantic HTML, ARIA labels where needed, alt text on images
   - Touch targets — 44×44 pixel minimum for touch interfaces
   - `prefers-reduced-motion` and `prefers-color-scheme` handled

2. **Interaction States (MANDATORY for every interactive element)**
   Every button, link, input, form, and interactive component MUST explicitly specify:
   - Default (resting)
   - Hover (mouse) — with visual feedback
   - Focus (keyboard) — with visible focus ring
   - Active (pressed) — momentary state during interaction
   - Disabled — visually distinct, not interactive, announced to screen readers
   - Loading — when async operation in progress (skeleton preferred over spinner for content)
   - Error — when validation fails, with clear message and recovery path
   - Success — when operation completes, with confirmation feedback
   - Empty — when data is absent (must specify what the user sees and what they can do)

3. **User Flow Coverage (MANDATORY)**
   For every feature in this phase, specify:
   - Happy path — the ideal flow when everything works
   - Error path — what happens when something fails (network, validation, permission, timeout)
   - Empty state — what the user sees before any data exists
   - Loading state — what the user sees while waiting
   - Edge cases — first-time user, power user, slow network, offline

4. **Responsive Strategy**
   - Mobile-first breakpoints specified (e.g., 640/768/1024/1280px)
   - Content reflow behavior at narrow widths
   - Touch and mouse both work on applicable devices
   - Typography scales appropriately

5. **Information Hierarchy**
   - Primary action identified and visually dominant
   - Secondary actions placed appropriately
   - Progressive disclosure for complex interfaces
   - Eye path consideration (top-left to bottom-right in LTR)

6. **Component Reuse (refactor-first for UI)**
   - Before specifying a NEW component, check if an existing one can be extended or composed
   - Document which existing components are being reused and which (if any) are new
   - Justify any new components — why can't the existing system serve this need?

7. **Micro-interactions & Timing**
   - Feedback within 100ms of user action
   - Transition timing 150-300ms for most animations
   - Loading skeletons for content, spinners only for short operations

8. **Typography, Spacing, Color**
   - Uses the project's type scale consistently (no magic numbers)
   - Spacing follows the system
   - Semantic color tokens (not raw hex in components)
   - Dark mode considered if applicable per DESIGN-SYSTEM.md
</ux_designer_requirements>

<output>
Write to: {phase_dir}/{padded_phase}-UI-SPEC.md
Template: /Users/phillipdougherty/.claude/get-shit-done/templates/UI-SPEC.md
</output>

<config>
commit_docs: {commit_docs}
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

Omit null file paths from `<files_to_read>`.

```
Task(
  prompt=ui_research_prompt,
  subagent_type="gsd-ui-researcher",
  model="{UI_RESEARCHER_MODEL}",
  description="UI Design Contract Phase {N}"
)
```

## 6. Handle Researcher Return

**If `## UI-SPEC COMPLETE`:**
Display confirmation. Continue to step 7.

**If `## UI-SPEC BLOCKED`:**
Display blocker details and options. Exit workflow.

## 7. Spawn gsd-ui-checker

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING UI-SPEC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning UI checker...
```

Build prompt:

```markdown
Read /Users/phillipdougherty/.claude/agents/gsd-ui-checker.md for instructions.

<objective>
Validate UI design contract for Phase {phase_number}: {phase_name}
Check all dimensions including DESIGN-SYSTEM.md compliance. Return APPROVED or BLOCKED.
</objective>

<files_to_read>
- {phase_dir}/{padded_phase}-UI-SPEC.md (UI Design Contract — PRIMARY INPUT)
- {context_path} (USER DECISIONS — check compliance)
- {research_path} (Technical Research — check stack alignment)
- {DESIGN_SYSTEM_PATH} (Project UX & accessibility standards — MANDATORY, verify UI-SPEC complies with this)
</files_to_read>

<ux_checker_requirements>
In addition to the 6 standard dimensions, verify the UI-SPEC complies with DESIGN-SYSTEM.md:

**Accessibility checks:**
- [ ] Color contrast ratios specified and meet WCAG 2.1 AA (4.5:1 normal, 3:1 large)
- [ ] Keyboard navigation specified for every interactive element
- [ ] Focus states visible and specified
- [ ] Touch targets 44×44 minimum where applicable
- [ ] ARIA labels specified where needed
- [ ] `prefers-reduced-motion` handling addressed

**Interaction state completeness:**
- [ ] Every interactive element has all required states: default, hover, focus, active, disabled, loading, error, success, empty
- [ ] Missing states are explicitly called out as intentional (e.g., "no loading state because action is synchronous")

**User flow coverage:**
- [ ] Happy path designed
- [ ] Error path designed (network, validation, permission, timeout)
- [ ] Empty state designed
- [ ] Loading state designed
- [ ] At least one edge case considered (first-time user, offline, slow network)

**Component reuse:**
- [ ] Existing components identified and reused where possible
- [ ] New components justified — explanation of why existing system can't serve

**If any of these checks fail, return ## ISSUES FOUND with specific remediation needed.**
**FLAG (non-blocking) items can include: suggested but not mandatory improvements, polish items, optional accessibility enhancements beyond WCAG AA.**
</ux_checker_requirements>

<config>
ui_safety_gate: {ui_safety_gate config value}
</config>
```

```
Task(
  prompt=ui_checker_prompt,
  subagent_type="gsd-ui-checker",
  model="{UI_CHECKER_MODEL}",
  description="Verify UI-SPEC Phase {N}"
)
```

## 8. Handle Checker Return

**If `## UI-SPEC VERIFIED`:**
Display dimension results. Proceed to step 10.

**If `## ISSUES FOUND`:**
Display blocking issues. Proceed to step 9.

## 9. Revision Loop (Max 2 Iterations)

Track `revision_count` (starts at 0).

**If `revision_count` < 2:**
- Increment `revision_count`
- Re-spawn gsd-ui-researcher with revision context:

```markdown
<revision>
The UI checker found issues with the current UI-SPEC.md.

### Issues to Fix
{paste blocking issues from checker return}

Read the existing UI-SPEC.md, fix ONLY the listed issues, re-write the file.
Do NOT re-ask the user questions that are already answered.
</revision>
```

- After researcher returns → re-spawn checker (step 7)

**If `revision_count` >= 2:**
```
Max revision iterations reached. Remaining issues:

{list remaining issues}

Options:
1. Force approve — proceed with current UI-SPEC (FLAGs become accepted)
2. Edit manually — open UI-SPEC.md in editor, re-run /gsd:ui-phase
3. Abandon — exit without approving
```

Use AskUserQuestion for the choice.

## 10. Present Final Status

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI-SPEC READY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {N}: {Name}** — UI design contract approved

Dimensions: 6/6 passed
{If any FLAGs: "Recommendations: {N} (non-blocking)"}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan Phase {N}** — planner will use UI-SPEC.md as design context

`/gsd:plan-phase {N}`

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────
```

## 11. Commit (if configured)

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): UI design contract" --files "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

## 12. Update State

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} UI-SPEC approved" \
  --resume-file "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

</process>

<success_criteria>
- [ ] Config checked (exit if ui_phase disabled)
- [ ] Phase validated against roadmap
- [ ] Prerequisites checked (CONTEXT.md, RESEARCH.md — non-blocking warnings)
- [ ] Existing UI-SPEC handled (update/view/skip)
- [ ] gsd-ui-researcher spawned with correct context and file paths
- [ ] UI-SPEC.md created in correct location
- [ ] gsd-ui-checker spawned with UI-SPEC.md
- [ ] All 6 dimensions evaluated
- [ ] Revision loop if BLOCKED (max 2 iterations)
- [ ] Final status displayed with next steps
- [ ] UI-SPEC.md committed (if commit_docs enabled)
- [ ] State updated
</success_criteria>
