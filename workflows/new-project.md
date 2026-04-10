<purpose>
Initialize a new project through unified flow: questioning, research (optional), requirements, roadmap. This is the most leveraged moment in any project — deep questioning here means better plans, better execution, better outcomes. One workflow takes you from idea to ready-for-planning.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<auto_mode>
## Auto Mode Detection

Check if `--auto` flag is present in $ARGUMENTS.

**If auto mode:**
- Skip brownfield mapping offer (assume greenfield)
- Skip deep questioning (extract context from provided document)
- Config: YOLO mode is implicit (skip that question), but ask granularity/git/agents FIRST (Step 2a)
- After config: run Steps 6-9 automatically with smart defaults:
  - Research: Always yes
  - Requirements: Include all table stakes + features from provided document
  - Requirements approval: Auto-approve
  - Roadmap approval: Auto-approve

**Document requirement:**
Auto mode requires an idea document — either:
- File reference: `/gsd:new-project --auto @prd.md`
- Pasted/written text in the prompt

If no document content provided, error:

```
Error: --auto requires an idea document.

Usage:
  /gsd:new-project --auto @your-idea.md
  /gsd:new-project --auto [paste or write your idea here]

The document should describe what you want to build.
```
</auto_mode>

<process>

## 1. Setup

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init new-project)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `project_exists`, `has_codebase_map`, `planning_exists`, `has_existing_code`, `has_package_file`, `is_brownfield`, `needs_codebase_map`, `has_git`, `project_path`.

**If `project_exists` is true:** Error — project already initialized. Use `/gsd:progress`.

**If `has_git` is false:** Initialize git:
```bash
git init
```

## 2. Brownfield Offer

**If auto mode:** Skip to Step 4 (assume greenfield, synthesize PROJECT.md from provided document).

**If `needs_codebase_map` is true** (from init — existing code detected but no codebase map):

Use AskUserQuestion:
- header: "Codebase"
- question: "I detected existing code in this directory. Would you like to map the codebase first?"
- options:
  - "Map codebase first" — Run /gsd:map-codebase to understand existing architecture (Recommended)
  - "Skip mapping" — Proceed with project initialization

**If "Map codebase first":**
```
Run `/gsd:map-codebase` first, then return to `/gsd:new-project`
```
Exit command.

**If "Skip mapping" OR `needs_codebase_map` is false:** Continue to Step 3.

## 2a. Auto Mode Config (auto mode only)

**If auto mode:** Collect config settings upfront before processing the idea document.

YOLO mode is implicit (auto = YOLO). Ask remaining config questions:

**Round 1 — Core settings (3 questions, no Mode question):**

```
AskUserQuestion([
  {
    header: "Granularity",
    question: "How finely should scope be sliced into phases?",
    multiSelect: false,
    options: [
      { label: "Coarse (Recommended)", description: "Fewer, broader phases (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced phase size (5-8 phases, 3-5 plans each)" },
      { label: "Fine", description: "Many focused phases (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
])
```

**Round 2 — Workflow agents (same as Step 5):**

```
AskUserQuestion([
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents (OpenCode /model)" }
    ]
  }
])
```

Create `.planning/config.json` with mode set to "yolo":

```json
{
  "mode": "yolo",
  "granularity": "[selected]",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget|inherit",
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "verifier": true|false,
    "nyquist_validation": depth !== "quick",
    "auto_advance": true
  }
}
```

**If commit_docs = No:** Add `.planning/` to `.gitignore`.

**Commit config.json:**

```bash
mkdir -p .planning
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "chore: add project config" --files .planning/config.json
```

**Persist auto-advance chain flag to config (survives context compaction):**

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active true
```

Proceed to Step 4 (skip Steps 3 and 5).

## 3. Deep Questioning

**If auto mode:** Skip (already handled in Step 2a). Extract project context from provided document instead and proceed to Step 4.

**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Open the conversation:**

Ask inline (freeform, NOT AskUserQuestion):

"What do you want to build?"

Wait for their response. This gives you the context needed to ask intelligent follow-up questions.

**Follow the thread:**

Based on what they said, ask follow-up questions that dig into their response. Use AskUserQuestion with options that probe what they mentioned — interpretations, clarifications, concrete examples.

Keep following threads. Each answer opens new threads to explore. Ask about:
- What excited them
- What problem sparked this
- What they mean by vague terms
- What it would actually look like
- What's already decided

Consult `questioning.md` for techniques:
- Challenge vagueness
- Make abstract concrete
- Surface assumptions
- Find edges
- Reveal motivation

**Check context (background, not out loud):**

As you go, mentally check the context checklist from `questioning.md`. If gaps remain, weave questions naturally. Don't suddenly switch to checklist mode.

**Decision gate:**

When you could write a clear PROJECT.md, use AskUserQuestion:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

Loop until "Create PROJECT.md" selected.

## 4. Write PROJECT.md

**If auto mode:** Synthesize from provided document. No "Ready?" gate was shown — proceed directly to commit.

Synthesize all context into `.planning/PROJECT.md` using the template from `templates/project.md`.

**For greenfield projects:**

Initialize requirements as hypotheses:

```markdown
## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

### Out of Scope

- [Exclusion 1] — [why]
- [Exclusion 2] — [why]
```

All Active requirements are hypotheses until shipped and validated.

**For brownfield projects (codebase map exists):**

Infer Validated requirements from existing code:

1. Read `.planning/codebase/ARCHITECTURE.md` and `STACK.md`
2. Identify what the codebase already does
3. These become the initial Validated set

```markdown
## Requirements

### Validated

- ✓ [Existing capability 1] — existing
- ✓ [Existing capability 2] — existing
- ✓ [Existing capability 3] — existing

### Active

- [ ] [New requirement 1]
- [ ] [New requirement 2]

### Out of Scope

- [Exclusion 1] — [why]
```

**Key Decisions:**

Initialize with any decisions made during questioning:

```markdown
## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |
```

**Last updated footer:**

```markdown
---
*Last updated: [date] after initialization*
```

Do not compress. Capture everything gathered.

**Commit PROJECT.md:**

```bash
mkdir -p .planning
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: initialize project" --files .planning/PROJECT.md
```

## 5. Workflow Preferences

**If auto mode:** Skip — config was collected in Step 2a. Proceed to Step 5.5.

**Check for global defaults** at `~/.gsd/defaults.json`. If the file exists, offer to use saved defaults:

```
AskUserQuestion([
  {
    question: "Use your saved default settings? (from ~/.gsd/defaults.json)",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Use saved defaults, skip settings questions" },
      { label: "No", description: "Configure settings manually" }
    ]
  }
])
```

If "Yes": read `~/.gsd/defaults.json`, use those values for config.json, and skip directly to **Commit config.json** below.

If "No" or `~/.gsd/defaults.json` doesn't exist: proceed with the questions below.

**Round 1 — Core workflow settings (4 questions):**

```
questions: [
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve, just execute" },
      { label: "Interactive", description: "Confirm at each step" }
    ]
  },
  {
    header: "Granularity",
    question: "How finely should scope be sliced into phases?",
    multiSelect: false,
    options: [
      { label: "Coarse", description: "Fewer, broader phases (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced phase size (5-8 phases, 3-5 plans each)" },
      { label: "Fine", description: "Many focused phases (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
]
```

**Round 2 — Workflow agents:**

These spawn additional agents during planning/execution. They add tokens and time but improve quality.

| Agent | When it runs | What it does |
|-------|--------------|--------------|
| **Researcher** | Before planning each phase | Investigates domain, finds patterns, surfaces gotchas |
| **Plan Checker** | After plan is created | Verifies plan actually achieves the phase goal |
| **Verifier** | After phase execution | Confirms must-haves were delivered |

All recommended for important projects. Skip for quick experiments.

```
questions: [
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents (OpenCode /model)" }
    ]
  }
]
```

Create `.planning/config.json` with all settings:

```json
{
  "mode": "yolo|interactive",
  "granularity": "coarse|standard|fine",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget|inherit",
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "verifier": true|false,
    "nyquist_validation": depth !== "quick"
  }
}
```

**If commit_docs = No:**
- Set `commit_docs: false` in config.json
- Add `.planning/` to `.gitignore` (create if needed)

**If commit_docs = Yes:**
- No additional gitignore entries needed

**Commit config.json:**

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "chore: add project config" --files .planning/config.json
```

**Note:** Run `/gsd:settings` anytime to update these preferences.

## 5.5. Resolve Model Profile

Use models from init: `researcher_model`, `synthesizer_model`, `roadmapper_model`.

## 6. Research Decision

**If auto mode:** Default to "Research first" without asking.

Use AskUserQuestion:
- header: "Research"
- question: "Research the domain ecosystem before defining requirements?"
- options:
  - "Research first (Recommended)" — Discover standard stacks, expected features, architecture patterns
  - "Skip research" — I know this domain well, go straight to requirements

**If "Research first":**

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Researching [domain] ecosystem...
```

Create research directory:
```bash
mkdir -p .planning/research
```

**Determine milestone context:**

Check if this is greenfield or subsequent milestone:
- If no "Validated" requirements in PROJECT.md → Greenfield (building from scratch)
- If "Validated" requirements exist → Subsequent milestone (adding to existing app)

Display spawning indicator:
```
◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

Spawn 4 parallel gsd-project-researcher agents with path references:

```
Task(prompt="<research_type>
Project Research — Stack dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: Research the standard stack for building [domain] from scratch.
Subsequent: Research what's needed to add [target features] to an existing [domain] app. Don't re-research the existing system.
</milestone_context>

<question>
What's the standard 2025 stack for [domain]?
</question>

<files_to_read>
- {project_path} (Project context and goals)
</files_to_read>

<downstream_consumer>
Your STACK.md feeds into roadmap creation. Be prescriptive:
- Specific libraries with versions
- Clear rationale for each choice
- What NOT to use and why
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (verify with Context7/official docs, not training data)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Confidence levels assigned to each recommendation
</quality_gate>

<output>
Write to: .planning/research/STACK.md
Use template: /Users/phillipdougherty/.claude/get-shit-done/templates/research-project/STACK.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Stack research")

Task(prompt="<research_type>
Project Research — Features dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What features do [domain] products have? What's table stakes vs differentiating?
Subsequent: How do [target features] typically work? What's expected behavior?
</milestone_context>

<question>
What features do [domain] products have? What's table stakes vs differentiating?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

<downstream_consumer>
Your FEATURES.md feeds into requirements definition. Categorize clearly:
- Table stakes (must have or users leave)
- Differentiators (competitive advantage)
- Anti-features (things to deliberately NOT build)
</downstream_consumer>

<quality_gate>
- [ ] Categories are clear (table stakes vs differentiators vs anti-features)
- [ ] Complexity noted for each feature
- [ ] Dependencies between features identified
</quality_gate>

<output>
Write to: .planning/research/FEATURES.md
Use template: /Users/phillipdougherty/.claude/get-shit-done/templates/research-project/FEATURES.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Features research")

Task(prompt="<research_type>
Project Research — Architecture dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: How are [domain] systems typically structured? What are major components?
Subsequent: How do [target features] integrate with existing [domain] architecture?
</milestone_context>

<question>
How are [domain] systems typically structured? What are major components?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

<downstream_consumer>
Your ARCHITECTURE.md informs phase structure in roadmap. Include:
- Component boundaries (what talks to what)
- Data flow (how information moves)
- Suggested build order (dependencies between components)
</downstream_consumer>

<quality_gate>
- [ ] Components clearly defined with boundaries
- [ ] Data flow direction explicit
- [ ] Build order implications noted
</quality_gate>

<output>
Write to: .planning/research/ARCHITECTURE.md
Use template: /Users/phillipdougherty/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Architecture research")

Task(prompt="<research_type>
Project Research — Pitfalls dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What do [domain] projects commonly get wrong? Critical mistakes?
Subsequent: What are common mistakes when adding [target features] to [domain]?
</milestone_context>

<question>
What do [domain] projects commonly get wrong? Critical mistakes?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

<downstream_consumer>
Your PITFALLS.md prevents mistakes in roadmap/planning. For each pitfall:
- Warning signs (how to detect early)
- Prevention strategy (how to avoid)
- Which phase should address it
</downstream_consumer>

<quality_gate>
- [ ] Pitfalls are specific to this domain (not generic advice)
- [ ] Prevention strategies are actionable
- [ ] Phase mapping included where relevant
</quality_gate>

<output>
Write to: .planning/research/PITFALLS.md
Use template: /Users/phillipdougherty/.claude/get-shit-done/templates/research-project/PITFALLS.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Pitfalls research")
```

After all 4 agents complete, spawn synthesizer to create SUMMARY.md:

```
Task(prompt="
<task>
Synthesize research outputs into SUMMARY.md.
</task>

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

<output>
Write to: .planning/research/SUMMARY.md
Use template: /Users/phillipdougherty/.claude/get-shit-done/templates/research-project/SUMMARY.md
Commit after writing.
</output>
", subagent_type="gsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display research complete banner and key findings:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Key Findings

**Stack:** [from SUMMARY.md]
**Table Stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]

Files: `.planning/research/`
```

**If "Skip research":** Continue to Step 7.

## 7. Define Requirements

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Load context:**

Read PROJECT.md and extract:
- Core value (the ONE thing that must work)
- Stated constraints (budget, timeline, tech limitations)
- Any explicit scope boundaries

**If research exists:** Read research/FEATURES.md and extract feature categories.

**If auto mode:**
- Auto-include all table stakes features (users expect these)
- Include features explicitly mentioned in provided document
- Auto-defer differentiators not mentioned in document
- Skip per-category AskUserQuestion loops
- Skip "Any additions?" question
- Skip requirements approval gate
- Generate REQUIREMENTS.md and commit directly

**Present features by category (interactive mode only):**

```
Here are the features for [domain]:

## Authentication
**Table stakes:**
- Sign up with email/password
- Email verification
- Password reset
- Session management

**Differentiators:**
- Magic link login
- OAuth (Google, GitHub)
- 2FA

**Research notes:** [any relevant notes]

---

## [Next Category]
...
```

**If no research:** Gather requirements through conversation instead.

Ask: "What are the main things users need to be able to do?"

For each capability mentioned:
- Ask clarifying questions to make it specific
- Probe for related capabilities
- Group into categories

**Scope each category:**

For each category, use AskUserQuestion:

- header: "[Category]" (max 12 chars)
- question: "Which [category] features are in v1?"
- multiSelect: true
- options:
  - "[Feature 1]" — [brief description]
  - "[Feature 2]" — [brief description]
  - "[Feature 3]" — [brief description]
  - "None for v1" — Defer entire category

Track responses:
- Selected features → v1 requirements
- Unselected table stakes → v2 (users expect these)
- Unselected differentiators → out of scope

**Identify gaps:**

Use AskUserQuestion:
- header: "Additions"
- question: "Any requirements research missed? (Features specific to your vision)"
- options:
  - "No, research covered it" — Proceed
  - "Yes, let me add some" — Capture additions

**Validate core value:**

Cross-check requirements against Core Value from PROJECT.md. If gaps detected, surface them.

**Generate REQUIREMENTS.md:**

Create `.planning/REQUIREMENTS.md` with:
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- v2 Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, CONTENT-02)

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Reject vague requirements. Push for specificity:
- "Handle authentication" → "User can log in with email/password and stay logged in across sessions"
- "Support sharing" → "User can share post via link that opens in recipient's browser"

**First-principles decomposition:**

When defining requirements, decompose each feature into its fundamental engineering concerns. Don't accept "Build an API" — break it down:
- "API validates all inputs server-side before processing"
- "API returns consistent error responses with error codes"
- "API endpoints require authentication"
- "API includes rate limiting per user"
- "API operations are logged with correlation IDs"

Each concern becomes a verifiable requirement. The planner will use these atomic requirements to create targeted tasks rather than vague "implement feature" tasks.

**Present full requirements list (interactive mode only):**

Show every requirement (not counts) for user confirmation:

```
## v1 Requirements

### Authentication
- [ ] **AUTH-01**: User can create account with email/password
- [ ] **AUTH-02**: User can log in and stay logged in across sessions
- [ ] **AUTH-03**: User can log out from any page

### Content
- [ ] **CONT-01**: User can create posts with text
- [ ] **CONT-02**: User can edit their own posts

[... full list ...]

---

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

**Commit requirements:**

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md
```

## 7.25. PM Lens — Scope & Hypothesis Validation

**Transition banner:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PM LENS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Mode shift: you've told me what you want to build.
 Now let's look at it like a PM would.
```

Display context:
```
A good PM's job is to sharpen vision, not replace it. These questions
can be uncomfortable — they force you to say no to things you like,
commit to metrics that might fail, and ship less than you want. But
the projects that succeed are the ones where these questions got asked.

We'll walk through 5 areas:
1. Problem Clarity — who is this really for, and why?
2. Hypothesis Framing — what's the bet we're making?
3. MVP Discipline — which requirements survive the scope pressure test?
4. Anti-Requirements — what are we explicitly NOT building?
5. Success Metrics & Key Risks — how will we know it's working?
```

**Mode selection:**

**If auto mode:** Attempt to extract PM answers from the provided idea document. For each area:
- If the document addresses it → capture the answer verbatim
- If the document doesn't address it → use sensible defaults based on the project context
- Log each decision inline so the user can review

Skip the AskUserQuestion below and proceed directly to writing PM Validation section in PROJECT.md.

**Otherwise, use AskUserQuestion:**
- header: "PM Lens"
- question: "How much PM pressure-testing do you want to do on this project?"
- options:
  - "Walk me through it (Recommended)" — Interactive conversation through all 5 areas
  - "I've thought about this" — Skip questions, I'll write short answers per area
  - "Skip entirely" — Move on to artifacts (noted in PROJECT.md)

**If "Skip entirely":**
Add a brief note to PROJECT.md under "PM Validation" that the lens was skipped at user request with the date. Proceed to Step 7.5.

**If "I've thought about this":**
Ask the user to provide a short paragraph per area as plain text (not AskUserQuestion):

```
Great. Please give me a short paragraph for each area. If you haven't
thought about one, say "N/A" and I'll prompt you on it.

1. Target User & Problem — Who is this for and what problem does it solve?
2. Hypothesis — If we build this, what will users do and why does it matter?
3. MVP Scope — What's the minimum needed to validate the hypothesis?
4. Anti-Requirements — What are you explicitly NOT building?
5. Success Metrics & Risks — How will you know it's working, and what could make it fail?
```

Capture the answers. If any are "N/A", do a lightweight probe on that area only (2-3 follow-up questions). Then proceed to "Capture to PROJECT.md" below.

**If "Walk me through it" (default):**

### Area 1: Problem Clarity

Ask inline (freeform, NOT AskUserQuestion):

```
Let's start with the problem. I want to understand three things:

1. Who is this for? Not "users" — specifically who. Describe the
   person: their role, their context, their day-to-day.

2. What problem are they experiencing today? What's painful about
   how they solve this now?

3. Why haven't they already solved it? If this is so obviously
   useful, what's stopped them or the market?

Take your time — I'll ask follow-ups after.
```

Wait for response. Ask follow-ups based on answers. **The goal is to extract specificity:**

- A **specific target user** (not "everyone" or "developers" — a concrete persona)
- A **specific problem** (not "it's annoying" — a concrete pain point)
- A **specific gap in current solutions** (not "nothing like this exists" — what's actually missing)

**If the user is vague, probe:**
- "Could you give me a concrete example? Walk me through a specific person and a specific instance where they hit this problem."
- "What do they do right now? Even if it's duct tape and workarounds — there's always a current solution, even if it's 'suffer silently'."
- "If I went and talked to 10 of these people today, what would they all say about this problem?"
- "Have you actually talked to these users, or is this your hypothesis about what they'd say?"

**Red flags to push back on:**
- "Everyone will want this" → "Let's narrow it down. If you had to pick the ONE group that will want this most, who?"
- "There's nothing like this" → "Then how are people solving this problem today? Something must be filling the gap."
- "It's just better than X" → "Better how, specifically? And is 'better' enough to make someone switch?"

Capture the answers.

### Area 2: Hypothesis Framing

Transition:

```
OK, now let's treat this project as a hypothesis. Every product is
essentially a bet: "If I build X, [specific users] will [specific
action], which matters because [why]."

What's your hypothesis? Phrase it in that format — I'll help you
sharpen it if needed.
```

Wait for response. **Probe for specificity:**

- "Users will like it" is not a hypothesis. "Users will return to use it weekly without a reminder" is.
- "It will be successful" is not a hypothesis. "It will replace how teams currently handle X within 3 months of trying it" is.
- "It will grow" is not a hypothesis. "Each user will invite 2+ others on average" is.

**Then ask:**

```
Good. Now two follow-ups:

1. What evidence would PROVE this hypothesis? What specific user
   behavior or outcome would make you confident you were right?

2. What evidence would DISPROVE it? What would make you kill the
   project or pivot?

3. What's the EARLY SIGNAL? What would you see in the first 2 weeks
   after launch that would tell you whether you're on the right track?
```

The early signal is critical — it's the difference between a 2-year dead project and a 2-week kill decision. Push the user to name something they could actually measure fast.

Capture the hypothesis, prove/disprove evidence, and early signal.

### Area 3: MVP Discipline (Scope Pressure Test)

Transition:

```
Now the uncomfortable part.

You've listed [N] requirements in REQUIREMENTS.md. I want to challenge
each one. The question isn't "is this feature good?" — most features
are good. The question is:

    "What's the smallest thing that tests the hypothesis?"

Everything beyond that is optimization. We're going to walk through
each requirement and ask: does this feature NEED to exist for the
hypothesis to be testable in v1? If no, it becomes v2.

This is going to feel like me saying no to things you want. That's
the point. I'm not actually saying no — I'm asking you to justify why
yes. If the justification is strong, it stays.

Ready?
```

Wait for acknowledgment, then walk through **each requirement one at a time.**

For each requirement, ask:

```
REQ-[ID]: [requirement text]

Question: If this feature did NOT exist in v1, would your hypothesis
still be testable? Could users still experience the core value and
behave in the way your hypothesis predicts?

- Yes, testable without it → This is v2. Defer it.
- No, the hypothesis depends on it → This stays in v1. Tell me why.
```

Wait for response per requirement.

**Be willing to push back.** Users tend to protect features they're excited about. Challenge gently but firmly:

- "I hear you, but help me understand: could users get the CORE value without this?"
- "What's the specific evidence that this feature is critical to the hypothesis, not just nice to have?"
- "If we deferred this to v2, would users walk away from v1, or would they just find it less polished?"
- "Imagine we ship v1 without this. What breaks?"

**Don't be a pushover either.** If the user pushes back with a strong case, accept it. PM lens is about clarity, not arbitrary deferral.

**Track the results internally:**
- `v1_kept`: requirements that survived the pressure test
- `deferred_to_v2`: requirements moved to v2
- `deferral_reasons`: why each was deferred (for documentation)

**After walking through ALL requirements, summarize:**

```
## Scope Pressure Test Results

### v1 (validated essential — [N] requirements)
- REQ-XX: [text] — [why it's essential]
- ...

### Deferred to v2 — [M] requirements
- REQ-YY: [text] — deferred because [reason]
- ...

### Out of scope (confirmed)
- [items already marked out of scope in requirements]
```

**Confirm with user via AskUserQuestion:**
- header: "Scope"
- question: "Does this refined scope work, or do you want to restore any deferred items?"
- options:
  - "Looks good, proceed" — Lock in the refined scope
  - "Restore some items" — Tell me which ones and why
  - "Re-do the pressure test" — Walk through the requirements again

**If "Restore some items":** Ask which requirements to restore and capture the justification. Update the tracking.

### Area 4: Anti-Requirements

Transition:

```
PMs know that saying "yes" is easy — saying "no" is what makes a
product sharp. Let's explicitly capture what we're NOT building.

Two categories:
```

**Category 1 — Tempting but deferring:**

```
1. What are the features you're tempted by but deferring? Things
   that would be appealing but would dilute focus from the core
   hypothesis. Name at least 3.
```

Wait for response. If they name fewer than 3, probe:

- "What about [adjacent feature] — have you considered it? What would you say to that?"
- "What's the feature you most want to add that you're forcing yourself not to?"

**Category 2 — Explicit nos:**

```
2. What might users or stakeholders EXPECT that you're explicitly
   not doing? Decisions you've made that might surprise people.

   Examples: "we're not building a mobile app", "we're not supporting
   team accounts in v1", "we're not going to have an API", "we're
   not integrating with X".

   What are your explicit nos?
```

Wait for response. Push for at least 3 anti-requirements total (combined). Vague projects say no to nothing; sharp projects have clear anti-requirements.

Capture the full list.

### Area 5: Success Metrics & Key Risks

Transition:

```
Last area. Two questions, both about knowing whether this is working.

1. Success Metric
   How will you know this is working? Pick something MEASURABLE, not
   "users love it". Examples:

   - "Weekly active users > 500"
   - "User returns within 7 days > 40%"
   - "Completed onboarding > 80%"
   - "Invites sent per user > 2"
   - "Time-to-first-value < 5 minutes"

   What's YOUR primary metric? The one number that matters most?
```

Wait for response. **Push for specificity:**

- "Active users" → "Weekly or monthly active users?"
- "Engagement" → "Engagement measured how? Sessions per user? Time in app? Actions taken?"
- "Growth" → "Growth of what? New signups per week? Retained users?"
- "Revenue" → "Revenue per user? Total MRR? Conversion rate?"

Then ask:

```
2. What's the "good enough to ship" threshold? At what level of this
   metric would you say "v1 is validated, let's invest more"?
```

Capture the primary metric and the validation threshold.

**Then the risk question:**

```
3. Biggest Risk
   What could make this fail? What's the biggest assumption you're
   making that might be wrong? Be honest — this is the hardest
   question because it forces you to articulate what you're afraid of.
```

Wait for response. **Push for honesty — most people default to "competition" or "execution", which are usually NOT the biggest risks.**

The biggest risk is usually one of:
- Users won't actually do [the thing the hypothesis depends on]
- The problem we're solving isn't painful enough for people to switch
- The people who WOULD use this don't know they need it
- The solution works in theory but is too complex to adopt in practice
- We're wrong about who the user is

Probe:

- "That's a real risk, but let me push. If I built this perfectly and shipped it tomorrow, what's the most likely reason it would still fail?"
- "What's an assumption you're making that you haven't actually validated yet?"
- "If you had to pick the ONE thing that, if wrong, would sink this project — what would it be?"

**Then ask:**

```
4. How will you know early if this risk is manifesting? What's the
   signal in the first 2 weeks that would tell you this risk is
   becoming real?
```

Capture the biggest risk and early warning signal.

### Capture to PROJECT.md

Update PROJECT.md with a new section:

```markdown
## PM Validation

**Conducted:** [date]

### Target User
[From Area 1 — specific description]

### Problem
[From Area 1 — specific pain point]

### Why Now
[From Area 1 — why current solutions are inadequate]

### Hypothesis
If we build [what], [who] will [specific action], which matters because [why].

**Prove:** [evidence that validates]
**Disprove:** [evidence that invalidates]
**Early signal (2 weeks):** [what tells us we're on the right track]

### MVP Scope — Pressure-Tested
**v1 (validated essential):**
- [REQ-ID]: [text]
- ...

**Deferred to v2:**
- [REQ-ID]: [text] — [deferral reason]
- ...

### Anti-Requirements
**Tempting but deferring:**
- [item 1]
- [item 2]
- [item 3]

**Explicit nos:**
- [item 1]
- [item 2]
- [item 3]

### Success Metrics
**Primary metric:** [the one number that matters most]
**"Good enough to ship" threshold:** [what level = validated]

### Key Risks
**Biggest risk:** [honest articulation of what could sink this]
**Early warning signal:** [what you'd see in 2 weeks if this risk is manifesting]
```

### If requirements changed

If the MVP Discipline step moved items from v1 to v2, update REQUIREMENTS.md:

1. Move deferred items to the "v2 / Future" section with the deferral reason
2. Add a "Success Metrics" section at the top referencing PROJECT.md's PM Validation
3. Recompute REQ-ID coverage — make sure v1 list is still internally consistent

**Commit both files:**

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: PM lens validation — scope refined, metrics captured" --files .planning/PROJECT.md .planning/REQUIREMENTS.md
```

Display summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PM LENS COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Validation       | Result                           |
|------------------|----------------------------------|
| Target user      | [one-line summary]               |
| Hypothesis       | [one-line summary]               |
| v1 requirements  | [N] validated, [M] deferred      |
| Anti-requirements| [total count]                    |
| Primary metric   | [metric]                         |
| Biggest risk     | [one-line summary]               |

PROJECT.md updated with PM Validation section.
REQUIREMENTS.md updated with refined v1 scope.
```

## 7.5. Generate Project Standards Artifacts

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► GENERATING PROJECT STANDARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Generate five project standards artifacts in `.planning/`. These are opinionated defaults tailored to the project's stack and domain (from research if available, otherwise from PROJECT.md context). They serve as living reference documents that downstream agents MUST consult during planning and execution.

**Generate each file using the project's stack, domain, and requirements context:**

**1. `.planning/SECURITY.md`** — Security best practices and requirements:
- **Authentication & Authorization** — Hash passwords (bcrypt/argon2, never MD5/SHA), enforce MFA where applicable, use short-lived JWTs with refresh tokens, implement role-based access control
- **Input Validation & Sanitization** — Validate all inputs server-side (never trust client), sanitize for SQL injection / XSS / command injection, use parameterized queries exclusively, validate content types and file uploads
- **Transport Security** — Enforce HTTPS everywhere, HSTS headers, TLS 1.2+ minimum, secure cookie flags (HttpOnly, Secure, SameSite)
- **CORS & CSRF** — Whitelist-only CORS origins, CSRF tokens on state-changing requests, validate Origin/Referer headers
- **Database Security** — Row-Level Security policies, principle of least privilege for DB roles, encrypt sensitive columns at rest, never store secrets in plaintext
- **API Security** — Rate limiting per endpoint, request size limits, authentication on every endpoint (no "we'll add auth later"), API key rotation strategy
- **Secret Management** — Environment variables only (never hardcoded), .env files gitignored, secret rotation policy, no secrets in logs
- **Dependency Security** — Audit dependencies regularly, pin versions, monitor CVEs
- **Logging & Monitoring** — Never log sensitive data (passwords, tokens, PII), structured logging, audit trail for auth events, alerting on anomalous patterns

Each item should include a "How to verify" note so the planner can generate acceptance criteria against it. Tailor to the project's specific stack (e.g., if using Supabase, include RLS-specific guidance; if using Next.js, include middleware auth patterns).

**2. `.planning/APIS.md`** — API design standards and data access patterns:
- **Versioning** — URL-based versioning (`/v1/`), never break existing versions, deprecation policy with sunset headers
- **Naming Conventions** — Plural nouns for resources (`/users` not `/user`), kebab-case for multi-word paths, no verbs in URLs (use HTTP methods), consistent query parameter naming
- **Request/Response Format** — JSON by default, consistent envelope structure, include request IDs in responses, pagination via cursor (not offset) for large datasets
- **Error Responses** — Consistent error schema (`{error: {code, message, details}}`), use appropriate HTTP status codes, never leak stack traces to clients, include correlation IDs
- **Pagination** — Cursor-based for feeds/lists, include `next`/`prev` links, default and max page sizes
- **Filtering & Sorting** — Consistent query parameter patterns, whitelist-only sortable fields, validate filter operators
- **Authentication** — Bearer token in Authorization header, 401 vs 403 semantics, token refresh flow documented
- **Rate Limiting** — Per-user/per-IP limits, rate limit headers in responses (`X-RateLimit-*`), 429 response with retry-after
- **Data Access Patterns:**
  - Select only what you need — No `SELECT *`, specify columns explicitly
  - N+1 query prevention — Use joins or batch loading, never loop-and-query
  - Index-aware design — Plan queries around existing indexes, add new indexes alongside new query patterns
  - Pagination at query level — LIMIT/OFFSET vs cursor-based, keyset pagination for large datasets
  - Aggregation strategy — Push aggregation to the database (GROUP BY, COUNT, SUM) rather than fetching rows and computing in application code
  - Query complexity limits — Avoid deeply nested subqueries when CTEs or joins are clearer
  - Connection management — Use connection pooling, don't hold connections during long operations, set statement timeouts
  - Write efficiency — Batch inserts over loops, upserts over select-then-insert, transactions scoped tightly
- **Migration Safety:**
  - Idempotent by default — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  - Destructive operations require guards — `DROP TABLE IF EXISTS`, `DROP COLUMN IF EXISTS`, never bare DROP
  - Reversibility — Every migration should have a rollback path; if irreversible, document explicitly
  - Data backfills — Run in batches with limits, not unbounded UPDATE on millions of rows
  - Zero-downtime awareness — Add nullable column first, backfill, then add constraint; never add NOT NULL without a default to populated tables
  - Transaction scoping — DDL in its own transaction, don't mix DDL and large data operations

**3. `.planning/TESTING-STRATEGY.md`** — Testing philosophy and boundaries:
- **Unit Tests** — Pure business logic, utilities, data transformations. No external dependencies. Fast, isolated, deterministic.
- **Integration Tests** — Database queries (real DB, not mocks), API endpoint handlers, third-party service adapters. Use test containers or dedicated test databases.
- **E2E Tests** — Critical user flows only (auth, checkout, core CRUD). Not exhaustive.
- **What NOT to Test** — Framework boilerplate, simple getters/setters, generated code, third-party library internals
- **Test Data** — Factories/fixtures over hardcoded values, realistic but deterministic, isolated per test
- **Coverage Philosophy** — Cover behavior, not lines. 80% meaningful coverage beats 100% metric-chasing. Every bug fix gets a regression test.

**4. `.planning/ERROR-HANDLING.md`** — Error handling strategy:
- **Error Classification** — Operational errors (expected, handle gracefully) vs programmer errors (unexpected, fail fast)
- **Error Codes** — Application-specific error codes (not just HTTP status), documented in a registry, stable across versions
- **User-Facing Errors** — Human-readable messages, never expose internals, actionable when possible
- **Logging** — Log full error context internally (stack, request, user), structured format, correlation IDs
- **Retry Strategy** — Exponential backoff with jitter for transient failures, circuit breaker for cascading failures, max retry limits
- **Global Error Handling** — Catch-all middleware/handler, consistent response format, graceful degradation over hard crashes
- **Validation Errors** — Return all validation failures at once (not one-at-a-time), field-level error mapping for forms

**5. `.planning/DESIGN-SYSTEM.md`** — UX and design standards (skip generation for purely headless/API-only projects, but still create the file with "N/A — API-only project" as a marker):
- **Accessibility (a11y)** — WCAG 2.1 AA as the baseline standard:
  - Color contrast ratios (4.5:1 for normal text, 3:1 for large text)
  - Keyboard navigation — every interactive element reachable via Tab, operable via Enter/Space
  - Focus management — visible focus states, logical tab order, focus trapping in modals
  - Screen reader support — semantic HTML, ARIA labels where needed, meaningful alt text on images
  - Touch targets — 44×44 pixel minimum for touch interfaces
  - Respect `prefers-reduced-motion` and `prefers-color-scheme`
- **Interaction States (MANDATORY for every interactive element)** — Every button, link, input, and interactive component must explicitly design for:
  - Default (resting)
  - Hover
  - Focus (keyboard)
  - Active (pressed)
  - Disabled
  - Loading (when async operation in progress)
  - Error (when validation fails)
  - Success (when operation completes)
  - Empty (when data is absent)
- **Responsive Strategy** — Mobile-first design:
  - Breakpoint strategy (e.g., 640px mobile, 768px tablet, 1024px desktop, 1280px wide)
  - Content reflows gracefully at narrow widths, no horizontal scroll
  - Typography scales appropriately
  - Touch and mouse both work on applicable devices
- **Information Hierarchy** — Every screen should answer:
  - What is the primary action? (Should be visually dominant)
  - What is the secondary action?
  - What can be deprioritized or hidden behind progressive disclosure?
  - What is the user's eye path? (Top-left to bottom-right in LTR contexts)
- **User Flow Requirements (MANDATORY for every feature)** — Every feature must design for:
  - Happy path — the ideal flow when everything works
  - Error path — what happens when something fails (network, validation, permission)
  - Empty state — what the user sees when there's no data yet
  - Loading state — what the user sees while waiting
  - Edge cases — first-time user, power user, slow network, offline
- **Component Reuse (refactor-first applies here too)** — Before creating a new component, check if an existing component can be extended or composed. A new Button variant is better than a new ButtonV2 component.
- **Micro-interactions & Feedback** — Every user action should produce feedback within 100ms (perceived instantaneous). Loading skeletons preferred over spinners for content. Optimistic updates where safe. Transition timing 150-300ms for most animations.
- **Typography & Spacing** — Consistent scale (e.g., 12/14/16/20/24/32px type scale). Spacing follows a system (e.g., 4/8/12/16/24/32/48px). No magic numbers.
- **Color Usage** — Semantic color tokens (primary, secondary, success, warning, danger, neutral), not raw hex values in components. Dark mode considered from the start if applicable.

**For each artifact:**
1. Use the project's stack (from research or PROJECT.md) to tailor recommendations to specific frameworks/libraries
2. Include "How to verify" notes on key items so planners can generate acceptance criteria
3. Write the file

**Commit all artifacts:**

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: generate project standards (SECURITY, APIS, TESTING-STRATEGY, ERROR-HANDLING, DESIGN-SYSTEM)" --files .planning/SECURITY.md .planning/APIS.md .planning/TESTING-STRATEGY.md .planning/ERROR-HANDLING.md .planning/DESIGN-SYSTEM.md
```

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROJECT STANDARDS GENERATED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Artifact           | Location                         |
|--------------------|----------------------------------|
| Security           | `.planning/SECURITY.md`          |
| API & Data Access  | `.planning/APIS.md`              |
| Testing Strategy   | `.planning/TESTING-STRATEGY.md`  |
| Error Handling     | `.planning/ERROR-HANDLING.md`    |
| Design System      | `.planning/DESIGN-SYSTEM.md`     |
```

## 8. Create Roadmap

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

Spawn gsd-roadmapper agent with path references:

```
Task(prompt="
<planning_context>

<files_to_read>
- .planning/PROJECT.md (Project context)
- .planning/REQUIREMENTS.md (v1 Requirements)
- .planning/research/SUMMARY.md (Research findings - if exists)
- .planning/config.json (Granularity and mode settings)
</files_to_read>

</planning_context>

<instructions>
Create roadmap:
1. Derive phases from requirements (don't impose structure)
2. Map every v1 requirement to exactly one phase
3. Derive 2-5 success criteria per phase (observable user behaviors)
4. Validate 100% coverage
5. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
6. Return ROADMAP CREATED with summary

Write files first, then return. This ensures artifacts persist even if context is lost.
</instructions>
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**Handle roadmapper return:**

**If `## ROADMAP BLOCKED`:**
- Present blocker information
- Work with user to resolve
- Re-spawn when resolved

**If `## ROADMAP CREATED`:**

Read the created ROADMAP.md and present it nicely inline:

```
---

## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 2 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 3 | [Name] | [Goal] | [REQ-IDs] | [count] |
...

### Phase Details

**Phase 1: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
3. [criterion]

**Phase 2: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]

[... continue for all phases ...]

---
```

**If auto mode:** Skip approval gate — auto-approve and commit directly.

**CRITICAL: Ask for approval before committing (interactive mode only):**

Use AskUserQuestion:
- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" — Commit and continue
  - "Adjust phases" — Tell me what to change
  - "Review full file" — Show raw ROADMAP.md

**If "Approve":** Continue to commit.

**If "Adjust phases":**
- Get user's adjustment notes
- Re-spawn roadmapper with revision context:
  ```
  Task(prompt="
  <revision>
  User feedback on roadmap:
  [user's notes]

  <files_to_read>
  - .planning/ROADMAP.md (Current roadmap to revise)
  </files_to_read>

  Update the roadmap based on feedback. Edit files in place.
  Return ROADMAP REVISED with changes made.
  </revision>
  ", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Revise roadmap")
  ```
- Present revised roadmap
- Loop until user approves

**If "Review full file":** Display raw `cat .planning/ROADMAP.md`, then re-ask.

**Commit roadmap (after approval or auto mode):**

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: create roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 9. Done

Present completion summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[Project Name]**

| Artifact           | Location                         |
|--------------------|----------------------------------|
| Project            | `.planning/PROJECT.md`           |
| Config             | `.planning/config.json`          |
| Research           | `.planning/research/`            |
| Requirements       | `.planning/REQUIREMENTS.md`      |
| Security           | `.planning/SECURITY.md`          |
| API & Data Access  | `.planning/APIS.md`              |
| Testing Strategy   | `.planning/TESTING-STRATEGY.md`  |
| Error Handling     | `.planning/ERROR-HANDLING.md`    |
| Design System      | `.planning/DESIGN-SYSTEM.md`     |
| Roadmap            | `.planning/ROADMAP.md`           |

**[N] phases** | **[X] requirements** | Ready to build ✓
```

**If auto mode:**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝
```

Exit skill and invoke SlashCommand("/gsd:discuss-phase 1 --auto")

**If interactive mode:**

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/gsd:discuss-phase 1 — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

---

**Also available:**
- /gsd:plan-phase 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

</process>

<output>

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/research/` (if research selected)
  - `STACK.md`
  - `FEATURES.md`
  - `ARCHITECTURE.md`
  - `PITFALLS.md`
  - `SUMMARY.md`
- `.planning/REQUIREMENTS.md`
- `.planning/SECURITY.md`
- `.planning/APIS.md`
- `.planning/TESTING-STRATEGY.md`
- `.planning/ERROR-HANDLING.md`
- `.planning/DESIGN-SYSTEM.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

</output>

<success_criteria>

- [ ] .planning/ directory created
- [ ] Git repo initialized
- [ ] Brownfield detection completed
- [ ] Deep questioning completed (threads followed, not rushed)
- [ ] PROJECT.md captures full context → **committed**
- [ ] config.json has workflow mode, granularity, parallelization → **committed**
- [ ] Research completed (if selected) — 4 parallel agents spawned → **committed**
- [ ] Requirements gathered (from research or conversation)
- [ ] User scoped each category (v1/v2/out of scope)
- [ ] REQUIREMENTS.md created with REQ-IDs → **committed**
- [ ] PM Lens applied (walked through, documented, or explicitly skipped) → PROJECT.md updated → **committed**
- [ ] Project standards artifacts generated (SECURITY.md, APIS.md, TESTING-STRATEGY.md, ERROR-HANDLING.md, DESIGN-SYSTEM.md) → **committed**
- [ ] gsd-roadmapper spawned with context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md created with phases, requirement mappings, success criteria
- [ ] STATE.md initialized
- [ ] REQUIREMENTS.md traceability updated
- [ ] User knows next step is `/gsd:discuss-phase 1`

**Atomic commits:** Each phase commits its artifacts immediately. If context is lost, artifacts persist.

</success_criteria>
