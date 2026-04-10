<purpose>

Start a new milestone cycle for an existing project. Loads project context, gathers milestone goals (from MILESTONE-CONTEXT.md or conversation), updates PROJECT.md and STATE.md, optionally runs parallel research, defines scoped requirements with REQ-IDs, spawns the roadmapper to create phased execution plan, and commits all artifacts. Brownfield equivalent of new-project.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

## 1. Load Context

- Read PROJECT.md (existing project, validated requirements, decisions)
- Read MILESTONES.md (what shipped previously)
- Read STATE.md (pending todos, blockers)
- Check for MILESTONE-CONTEXT.md (from /gsd:discuss-milestone)

## 2. Gather Milestone Goals

**If MILESTONE-CONTEXT.md exists:**
- Use features and scope from discuss-milestone
- Present summary for confirmation

**If no context file:**
- Present what shipped in last milestone
- Ask inline (freeform, NOT AskUserQuestion): "What do you want to build next?"
- Wait for their response, then use AskUserQuestion to probe specifics
- If user selects "Other" at any point to provide freeform input, ask follow-up as plain text — not another AskUserQuestion

## 3. Determine Milestone Version

- Parse last version from MILESTONES.md
- Suggest next version (v1.0 → v1.1, or v2.0 for major)
- Confirm with user

## 4. Update PROJECT.md

Add/update:

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]
```

Update Active requirements section and "Last updated" footer.

## 5. Update STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started
```

Keep Accumulated Context section from previous milestone.

## 6. Cleanup and Commit

Delete MILESTONE-CONTEXT.md if exists (consumed).

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: start milestone v[X.Y] [Name]" --files .planning/PROJECT.md .planning/STATE.md
```

## 7. Load Context and Resolve Models

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init new-milestone)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`.

## 7.5. Project Standards Artifact Gate

Check if project standards artifacts exist. These may be missing if the project was initialized before this workflow was updated, or if they were deleted.

```bash
SECURITY_EXISTS=$(test -f .planning/SECURITY.md && echo "true" || echo "false")
APIS_EXISTS=$(test -f .planning/APIS.md && echo "true" || echo "false")
TESTING_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
ERRORS_EXISTS=$(test -f .planning/ERROR-HANDLING.md && echo "true" || echo "false")
DESIGN_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")
```

**If any artifact is missing:**

Display:
```
⚠ Missing project standards artifacts:
${SECURITY_EXISTS == "false" ? "  - SECURITY.md" : ""}
${APIS_EXISTS == "false" ? "  - APIS.md" : ""}
${TESTING_EXISTS == "false" ? "  - TESTING-STRATEGY.md" : ""}
${ERRORS_EXISTS == "false" ? "  - ERROR-HANDLING.md" : ""}
${DESIGN_EXISTS == "false" ? "  - DESIGN-SYSTEM.md" : ""}

Generating missing artifacts...
```

Generate only the missing artifacts using the same templates and guidance as defined in `new-project.md` Step 7.5. Use existing PROJECT.md, REQUIREMENTS.md, and any research context to tailor them to the project's stack and domain.

Commit generated artifacts:
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: generate missing project standards artifacts" --files [list of generated files]
```

**If all artifacts exist:** Continue silently.

## 8. Research Decision

Check `research_enabled` from init JSON (loaded from config).

**If `research_enabled` is `true`:**

AskUserQuestion: "Research the domain ecosystem for new features before defining requirements?"
- "Research first (Recommended)" — Discover patterns, features, architecture for NEW capabilities
- "Skip research for this milestone" — Go straight to requirements (does not change your default)

**If `research_enabled` is `false`:**

AskUserQuestion: "Research the domain ecosystem for new features before defining requirements?"
- "Skip research (current default)" — Go straight to requirements
- "Research first" — Discover patterns, features, architecture for NEW capabilities

**IMPORTANT:** Do NOT persist this choice to config.json. The `workflow.research` setting is a persistent user preference that controls plan-phase behavior across the project. Changing it here would silently alter future `/gsd:plan-phase` behavior. To change the default, use `/gsd:settings`.

**If user chose "Research first":**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning 4 researchers in parallel...
  → Stack, Features, Architecture, Pitfalls
```

```bash
mkdir -p .planning/research
```

Spawn 4 parallel gsd-project-researcher agents. Each uses this template with dimension-specific fields:

**Common structure for all 4 researchers:**
```
Task(prompt="
<research_type>Project Research — {DIMENSION} for [new features].</research_type>

<milestone_context>
SUBSEQUENT MILESTONE — Adding [target features] to existing app.
{EXISTING_CONTEXT}
Focus ONLY on what's needed for the NEW features.
</milestone_context>

<question>{QUESTION}</question>

<files_to_read>
- .planning/PROJECT.md (Project context)
</files_to_read>

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .planning/research/{FILE}
Use template: /Users/phillipdougherty/.claude/get-shit-done/templates/research-project/{FILE}
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="{DIMENSION} research")
```

**Dimension-specific fields:**

| Field | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

After all 4 complete, spawn synthesizer:

```
Task(prompt="
Synthesize research outputs into SUMMARY.md.

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

Write to: .planning/research/SUMMARY.md
Use template: /Users/phillipdougherty/.claude/get-shit-done/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="gsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display key findings from SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
```

**If "Skip research":** Continue to Step 9.

## 9. Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read PROJECT.md: core value, current milestone goals, validated requirements (what exists).

**If research exists:** Read FEATURES.md, extract feature categories.

Present features by category:
```
## [Category 1]
**Table stakes:** Feature A, Feature B
**Differentiators:** Feature C, Feature D
**Research notes:** [any relevant notes]
```

**If no research:** Gather requirements through conversation. Ask: "What are the main things users need to do with [new features]?" Clarify, probe for related capabilities, group into categories.

**Scope each category** via AskUserQuestion (multiSelect: true, header max 12 chars):
- "[Feature 1]" — [brief description]
- "[Feature 2]" — [brief description]
- "None for this milestone" — Defer entire category

Track: Selected → this milestone. Unselected table stakes → future. Unselected differentiators → out of scope.

**Identify gaps** via AskUserQuestion:
- "No, research covered it" — Proceed
- "Yes, let me add some" — Capture additions

**Generate REQUIREMENTS.md:**
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- Future Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, NOTIF-02). Continue numbering from existing.

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Present FULL requirements list for confirmation:

```
## Milestone v[X.Y] Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

### [Category 2]
- [ ] **CAT2-01**: User can do Z

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

**Commit requirements:**
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: define milestone v[X.Y] requirements" --files .planning/REQUIREMENTS.md
```

## 9.5. PM Lens — Milestone Priority Validation

**Transition banner:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PM LENS (MILESTONE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Mode shift: you've told me what you want to build this milestone.
 Now let's look at it like a PM would.
```

Display context:
```
For a milestone, the PM lens is about focus: is this really the
highest-leverage thing to build next, or are we building what's
convenient? What are we deferring to LATER milestones, and why
this sequence?

We'll cover 4 areas (fewer than new-project because target users
and overall hypothesis were already validated):

1. Milestone Hypothesis — what does this milestone learn or prove?
2. MVP Discipline — which milestone features survive the pressure test?
3. Anti-Requirements — what are we explicitly deferring to next milestone?
4. Success Metrics & Risks — how will we know THIS milestone worked?
```

**Scale-aware skip offer:**

Check the milestone size. If the milestone has **fewer than 3 requirements** OR the total scope is a small refinement (e.g., bug fixes, polish, small UX improvements), offer to skip:

```bash
REQ_COUNT=$(grep -c "^- \[ \]" .planning/REQUIREMENTS.md 2>/dev/null || echo "0")
```

**If requirement count is small (< 3) OR scope appears to be refinement/polish:**

Use AskUserQuestion:
- header: "PM Lens?"
- question: "This milestone is small ([N] requirement(s)). PM lens is typically more valuable for larger milestones. Run it anyway, or skip?"
- options:
  - "Skip — this is straightforward" — Move on to roadmap
  - "Run it anyway" — Walk through the 4 areas
  - "Quick version" — Just capture hypothesis and success metric, skip the rest

**If the user chose "Skip":** Note in PROJECT.md under "Current Milestone" that PM lens was skipped (scope too small to warrant). Proceed to Step 10.

**If "Quick version":** Only run Area 1 (Hypothesis) and Area 4 (Success Metric). Skip MVP Discipline and Anti-Requirements.

**If "Run it anyway" OR milestone is not small:** Proceed with the full lens below.

---

**Full lens mode selection:**

**If auto mode:** Attempt to extract PM answers from MILESTONE-CONTEXT.md if it exists, or use sensible defaults based on the milestone goals and existing PROJECT.md PM Validation section (if present). Log each decision inline. Skip the AskUserQuestion and proceed to writing.

**Otherwise, use AskUserQuestion:**
- header: "PM Lens"
- question: "How much PM pressure-testing do you want to do on this milestone?"
- options:
  - "Walk me through it (Recommended)" — Interactive conversation through all 4 areas
  - "I've thought about this" — Skip questions, I'll write short answers per area
  - "Skip entirely" — Move on to roadmap (noted in PROJECT.md)

**If "Skip entirely":** Note in PROJECT.md under "Current Milestone" that PM lens was skipped. Proceed to Step 10.

**If "I've thought about this":** Ask the user to provide a short paragraph per area as plain text. Capture and proceed to "Capture to PROJECT.md" below.

**If "Walk me through it" (default):**

### Area 1: Milestone Hypothesis

Ask inline (freeform, NOT AskUserQuestion):

```
Let's start with the milestone hypothesis. A milestone is essentially
a bet: "If we ship this set of features, we'll learn/prove [X] and
users will [Y]."

Two questions:

1. Why THIS milestone now? Of all the things we could build next,
   why is this the highest-leverage? What does it unlock or
   validate that other work can't?

2. What does this milestone LEARN or PROVE? Not "it adds features" —
   what specific thing will you know after shipping this milestone
   that you don't know now?
```

Wait for response. **Probe for non-convenience reasoning:**

- "We should build this because it's the next thing in the roadmap" is not a strong answer. "We should build this because users keep dropping off at [X] and this fixes it" is.
- "It's a feature users asked for" is weak unless you can say how many and why they care.
- "It makes the product more complete" is weak — completeness isn't a milestone outcome.

**Red flags:**
- "Everything depends on it" → "What specifically? Walk me through the dependency."
- "It's the obvious next step" → "Obvious to whom? What other next steps did you consider?"
- "Users have been asking" → "How many? What did they say? Is this what they actually need or what they said they want?"

Capture the milestone hypothesis.

### Area 2: MVP Discipline (Scope Pressure Test)

Transition:

```
Now the uncomfortable part. You've defined [N] requirements for this
milestone. I want to challenge each one against the milestone hypothesis.

The question: does this requirement need to exist for the milestone
hypothesis to be tested? If not, it gets deferred to the NEXT milestone.

We'll walk through each requirement one at a time. This will feel like
me pushing back on things you want — that's the point.

Ready?
```

Wait for acknowledgment, then walk through **each requirement one at a time** (same thorough approach as new-project).

For each requirement, ask:

```
REQ-[ID]: [requirement text]

Question: If this requirement did NOT ship in this milestone, would
the milestone hypothesis still be testable? Could the milestone still
deliver its core learning/outcome?

- Yes, testable without it → Defer to next milestone.
- No, the hypothesis depends on it → It stays. Tell me why.
```

**Be willing to push back:**
- "I hear you, but could we validate the milestone hypothesis without this feature?"
- "What specifically would break if we deferred this to the next milestone?"
- "If we shipped the milestone without this, would users still experience the core outcome?"

**Track results:**
- `v1_kept`: requirements that survived
- `deferred_to_next`: requirements moved to next milestone
- `deferral_reasons`: documentation

**After walking through all requirements, summarize:**

```
## Milestone Scope — Pressure-Tested

### This milestone (validated essential — [N] requirements)
- REQ-XX: [text] — [why it's essential to this milestone]
- ...

### Deferred to next milestone — [M] requirements
- REQ-YY: [text] — deferred because [reason]
- ...
```

**Confirm via AskUserQuestion:**
- header: "Scope"
- question: "Does this refined milestone scope work?"
- options:
  - "Looks good, proceed"
  - "Restore some items"
  - "Re-do the pressure test"

### Area 3: Anti-Requirements (Next Milestone Preview)

Transition:

```
Let's explicitly capture what we're NOT building in this milestone.
Unlike new-project, this is less about "what are we saying NO to
forever" and more about "what are we sequencing LATER and why".

1. What features are you tempted to include in this milestone but
   forcing yourself to defer? Why defer them?

2. What will the NEXT milestone likely focus on? (Just a rough
   preview — we're not committing, but articulating this forces
   clarity on what this milestone is NOT.)
```

Wait for response. Push for at least 2 deferred items — naming them forces the user to justify the current milestone's scope.

**If the user can't name any deferred items:**
```
If you can't name anything you're deferring, either (a) this milestone
is bigger than it should be — you're including everything, or (b) you
don't have a vision for what comes next. Which is it?
```

Capture the deferred items and next milestone preview.

### Area 4: Success Metrics & Key Risks

Transition:

```
Last area. Two questions:

1. Milestone Success Metric
   How will you know THIS milestone worked? Not the overall product
   metric from the original PM validation — the specific outcome you
   expect from shipping this set of features.

   Examples:
   - "Onboarding completion rate goes from 40% to 60%"
   - "Weekly active users grows by 25% within a month"
   - "Support tickets about [specific pain point] drop by half"
   - "Feature adoption rate > 30% within 2 weeks"

   What's THIS MILESTONE's success metric?
```

Wait for response. Push for specificity and measurability.

```
2. Biggest Risk for this milestone
   What could make this milestone fail to deliver its hypothesis?
   Not "we'll run out of time" — what's the substantive risk that
   the features won't deliver the outcome you expect?
```

Wait for response. Push for honesty — usually the risk is "users won't adopt the new feature" or "the feature solves the wrong problem."

```
3. How will you know early if the milestone is failing?
   What's the signal in the first 2 weeks post-ship that would tell
   you the milestone hypothesis isn't holding?
```

Capture metric, risk, and early signal.

### Capture to PROJECT.md

Update PROJECT.md's "Current Milestone" section with PM Validation:

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]

### PM Validation

**Milestone Hypothesis:**
If we ship this milestone, we'll [learn/prove X] and users will [behavior Y].

**Why this milestone now:** [justification from Area 1]

**Scope — Pressure-Tested:**
- This milestone ([N] reqs): [list]
- Deferred to next milestone ([M] reqs): [list with reasons]

**Deferred for next milestone:**
- [item 1] — [reason]
- [item 2] — [reason]

**Next milestone preview (non-committal):**
[rough description of what comes after]

**Success Metric:** [specific measurable metric]
**Biggest Risk:** [honest articulation]
**Early warning signal:** [what you'd see in 2 weeks if failing]
```

### If requirements changed

If MVP Discipline moved items out of this milestone, update REQUIREMENTS.md:
1. Move deferred items to a "Next Milestone" section (not "v2" — these are next-milestone specific)
2. Add milestone success metric reference
3. Recompute REQ-ID coverage for this milestone

**Commit:**
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: PM lens for milestone v[X.Y] — scope refined, metrics captured" --files .planning/PROJECT.md .planning/REQUIREMENTS.md
```

Display summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PM LENS COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Validation          | Result                          |
|---------------------|---------------------------------|
| Milestone hypothesis| [one-line summary]              |
| Requirements        | [N] kept, [M] deferred to next  |
| Success metric      | [metric]                        |
| Biggest risk        | [one-line summary]              |

PROJECT.md updated with Current Milestone PM Validation.
REQUIREMENTS.md updated with refined milestone scope.
```

## 10. Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

**Starting phase number:** Read MILESTONES.md for last phase number. Continue from there (v1.0 ended at phase 5 → v1.1 starts at phase 6).

```
Task(prompt="
<planning_context>
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/config.json
- .planning/MILESTONES.md
</files_to_read>
</planning_context>

<instructions>
Create roadmap for milestone v[X.Y]:
1. Start phase numbering from [N]
2. Derive phases from THIS MILESTONE's requirements only
3. Map every requirement to exactly one phase
4. Derive 2-5 success criteria per phase (observable user behaviors)
5. Validate 100% coverage
6. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
7. Return ROADMAP CREATED with summary

Write files first, then return.
</instructions>
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**Handle return:**

**If `## ROADMAP BLOCKED`:** Present blocker, work with user, re-spawn.

**If `## ROADMAP CREATED`:** Read ROADMAP.md, present inline:

```
## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| [N] | [Name] | [Goal] | [REQ-IDs] | [count] |

### Phase Details

**Phase [N]: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
```

**Ask for approval** via AskUserQuestion:
- "Approve" — Commit and continue
- "Adjust phases" — Tell me what to change
- "Review full file" — Show raw ROADMAP.md

**If "Adjust":** Get notes, re-spawn roadmapper with revision context, loop until approved.
**If "Review":** Display raw ROADMAP.md, re-ask.

**Commit roadmap** (after approval):
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: create milestone v[X.Y] roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 11. Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

## ▶ Next Up

**Phase [N]: [Phase Name]** — [Goal]

`/gsd:discuss-phase [N]` — gather context and clarify approach

<sub>`/clear` first → fresh context window</sub>

Also: `/gsd:plan-phase [N]` — skip discussion, plan directly
```

</process>

<success_criteria>
- [ ] PROJECT.md updated with Current Milestone section
- [ ] STATE.md reset for new milestone
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Research completed (if selected) — 4 parallel agents, milestone-aware
- [ ] Requirements gathered and scoped per category
- [ ] REQUIREMENTS.md created with REQ-IDs
- [ ] PM Lens applied (walked through, documented, skipped, or quick version) → PROJECT.md updated
- [ ] gsd-roadmapper spawned with phase numbering context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md phases continue from previous milestone
- [ ] All commits made (if planning docs committed)
- [ ] User knows next step: `/gsd:discuss-phase [N]`

**Atomic commits:** Each phase commits its artifacts immediately.
</success_criteria>
