<purpose>
Retroactive 6-pillar visual audit of implemented frontend code. Standalone command that works on any project — GSD-managed or not. Produces scored UI-REVIEW.md with actionable findings.
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

Parse: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `commit_docs`.

```bash
UI_AUDITOR_MODEL=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-ui-auditor --raw)
```

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI AUDIT — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. Detect Input State

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
UI_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-UI-REVIEW.md 2>/dev/null | head -1)
```

**If `SUMMARY_FILES` empty:** Exit — "Phase {N} not executed. Run /gsd:execute-phase {N} first."

**If `UI_REVIEW_FILE` non-empty:** Use AskUserQuestion:
- header: "Existing UI Review"
- question: "UI-REVIEW.md already exists for Phase {N}."
- options:
  - "Re-audit — run fresh audit"
  - "View — display current review and exit"

If "View": display file, exit.
If "Re-audit": continue.

## 2. Gather Context Paths

```bash
DESIGN_SYSTEM_PATH=""
if [[ -f .planning/DESIGN-SYSTEM.md ]]; then
  DESIGN_SYSTEM_PATH=".planning/DESIGN-SYSTEM.md"
fi
```

Build file list for auditor:
- All SUMMARY.md files in phase dir
- All PLAN.md files in phase dir
- UI-SPEC.md (if exists — phase-specific audit baseline)
- DESIGN-SYSTEM.md (if exists — project-wide audit baseline; always pass it when present, even if UI-SPEC.md also exists, so audits catch design-system drift within the phase)
- CONTEXT.md (if exists — locked decisions)

**Audit baseline hierarchy** (strictest → loosest):
1. **UI-SPEC.md** — phase-specific contract, most specific to what was built
2. **DESIGN-SYSTEM.md** — project-wide UX contract, applies to every UI phase
3. **Abstract 6-pillar standards** — generic fallback when neither artifact exists

If both UI-SPEC.md and DESIGN-SYSTEM.md exist, audit against UI-SPEC.md primarily but cross-check compliance with DESIGN-SYSTEM.md (a phase should not extend the design system silently). If UI-SPEC.md is absent but DESIGN-SYSTEM.md exists, DESIGN-SYSTEM.md becomes the primary baseline — do not fall through to abstract standards just because UI-SPEC.md is missing.

## 3. Spawn gsd-ui-auditor

```
◆ Spawning UI auditor...
```

Build prompt:

```markdown
Read /Users/phillipdougherty/.claude/agents/gsd-ui-auditor.md for instructions.

<objective>
Conduct 6-pillar visual audit of Phase {phase_number}: {phase_name}

Audit baseline hierarchy:
{If UI-SPEC exists AND DESIGN-SYSTEM exists: "Audit primarily against UI-SPEC.md (phase contract). Cross-check compliance with DESIGN-SYSTEM.md (project-wide UX contract) — flag any phase-introduced drift from documented design-system policies."}
{If UI-SPEC exists AND no DESIGN-SYSTEM: "Audit against UI-SPEC.md design contract."}
{If no UI-SPEC AND DESIGN-SYSTEM exists: "Audit against DESIGN-SYSTEM.md as the project-wide UX contract — do not fall through to abstract standards just because UI-SPEC.md is absent."}
{If no UI-SPEC AND no DESIGN-SYSTEM: "Audit against abstract 6-pillar standards (generic fallback — recommend generating DESIGN-SYSTEM.md via /gsd:new-milestone)."}
</objective>

<files_to_read>
- {summary_paths} (Execution summaries)
- {plan_paths} (Execution plans — what was intended)
- {ui_spec_path} (UI Design Contract — phase-specific audit baseline, if exists)
- {design_system_path} (Project UX & accessibility standards — project-wide audit baseline, if exists)
- {context_path} (User decisions, if exists)
</files_to_read>

<config>
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

Omit null file paths.

```
Task(
  prompt=ui_audit_prompt,
  subagent_type="gsd-ui-auditor",
  model="{UI_AUDITOR_MODEL}",
  description="UI Audit Phase {N}"
)
```

## 4. Handle Return

**If `## UI REVIEW COMPLETE`:**

Display score summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI AUDIT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {N}: {Name}** — Overall: {score}/24

| Pillar | Score |
|--------|-------|
| Copywriting | {N}/4 |
| Visuals | {N}/4 |
| Color | {N}/4 |
| Typography | {N}/4 |
| Spacing | {N}/4 |
| Experience Design | {N}/4 |

Top fixes:
1. {fix}
2. {fix}
3. {fix}

Full review: {path to UI-REVIEW.md}

───────────────────────────────────────────────────────────────

## ▶ Next

- `/gsd:verify-work {N}` — UAT testing
- `/gsd:plan-phase {N+1}` — plan next phase

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────
```

## 5. Commit (if configured)

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): UI audit review" --files "${PHASE_DIR}/${PADDED_PHASE}-UI-REVIEW.md"
```

</process>

<success_criteria>
- [ ] Phase validated
- [ ] SUMMARY.md files found (execution completed)
- [ ] Existing review handled (re-audit/view)
- [ ] DESIGN-SYSTEM.md detected and included in auditor context when present
- [ ] Audit baseline hierarchy applied (UI-SPEC → DESIGN-SYSTEM → abstract)
- [ ] gsd-ui-auditor spawned with correct context
- [ ] UI-REVIEW.md created in phase directory
- [ ] Design-system drift flagged (if applicable)
- [ ] Score summary displayed to user
- [ ] Next steps presented
</success_criteria>
