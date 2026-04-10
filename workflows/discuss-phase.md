<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **gsd-phase-researcher** — Reads CONTEXT.md to know WHAT to research
   - "User wants card-based layout" → researcher investigates card component patterns
   - "Infinite scroll decided" → researcher looks into virtualization libraries

2. **gsd-planner** — Reads CONTEXT.md to know WHAT decisions are locked
   - "Pull-to-refresh on mobile" → planner includes that in task specs
   - "Claude's Discretion: loading skeleton" → planner can decide approach

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.

**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.
</downstream_awareness>

<philosophy>
**User = founder/visionary. Claude = builder.**

The user knows:
- How they imagine it working
- What it should look/feel like
- What's essential vs nice-to-have
- Specific behaviors or references they have in mind

The user doesn't know (and shouldn't be asked):
- Codebase patterns (researcher reads the code)
- Technical risks (researcher identifies these)
- Implementation approach (planner figures this out)
- Success metrics (inferred from the work)

Ask about vision and implementation choices. Capture decisions for downstream agents.
</philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.**

The phase boundary comes from ROADMAP.md and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

**Allowed (clarifying ambiguity):**
- "How should posts be displayed?" (layout, density, info shown)
- "What happens on empty state?" (within the feature)
- "Pull to refresh or manual?" (behavior choice)

**Not allowed (scope creep):**
- "Should we also add comments?" (new capability)
- "What about search/filtering?" (new capability)
- "Maybe include bookmarking?" (new capability)

**The heuristic:** Does this clarify how we implement what's already in the phase, or does it add a new capability that could be its own phase?

**When user suggests scope creep:**
```
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog?

For now, let's focus on [phase domain]."
```

Capture the idea in a "Deferred Ideas" section. Don't lose it, don't act on it.
</scope_guardrail>

<gray_area_identification>
Gray areas are **implementation decisions the user cares about** — things that could go multiple ways and would change the result.

**How to identify gray areas:**

1. **Read the phase goal** from ROADMAP.md
2. **Understand the domain** — What kind of thing is being built?
   - Something users SEE → visual presentation, interactions, states matter
   - Something users CALL → interface contracts, responses, errors matter
   - Something users RUN → invocation, output, behavior modes matter
   - Something users READ → structure, tone, depth, flow matter
   - Something being ORGANIZED → criteria, grouping, handling exceptions matter
3. **Generate phase-specific gray areas** — Not generic categories, but concrete decisions for THIS phase

**Don't use generic category labels** (UI, UX, Behavior). Generate specific gray areas:

```
Phase: "User authentication"
→ Session handling, Error responses, Multi-device policy, Recovery flow

Phase: "Organize photo library"
→ Grouping criteria, Duplicate handling, Naming convention, Folder structure

Phase: "CLI for database backups"
→ Output format, Flag design, Progress reporting, Error recovery

Phase: "API documentation"
→ Structure/navigation, Code examples depth, Versioning approach, Interactive elements
```

**The key question:** What decisions would change the outcome that the user should weigh in on?

**Claude handles these (don't ask):**
- Technical implementation details
- Architecture patterns
- Performance optimization
- Scope (roadmap defines this)
</gray_area_identification>

<answer_validation>
**IMPORTANT: Answer validation** — After every AskUserQuestion call, check if the response is empty or whitespace-only. If so:
1. Retry the question once with the same parameters
2. If still empty, present the options as a plain-text numbered list and ask the user to type their choice number
Never proceed with an empty answer.
</answer_validation>

<process>

**Express path available:** If you already have a PRD or acceptance criteria document, use `/gsd:plan-phase {phase} --prd path/to/prd.md` to skip this discussion and go straight to planning.

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /gsd:progress to see available phases.
```
Exit workflow.

**If `phase_found` is true:** Continue to check_existing.

**Auto mode** — If `--auto` is present in ARGUMENTS:
- In `check_existing`: auto-select "Skip" (if context exists) or continue without prompting (if no context/plans)
- In `present_gray_areas`: auto-select ALL gray areas without asking the user
- In `discuss_areas`: for each discussion question, choose the recommended option (first option, or the one marked "recommended") without using AskUserQuestion
- Log each auto-selected choice inline so the user can review decisions in the context file
- After discussion completes, auto-advance to plan-phase (existing behavior)
</step>

<step name="check_existing">
Check if CONTEXT.md already exists using `has_context` from init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null
```

**If exists:**

**If `--auto`:** Auto-select "Update it" — load existing context and continue to analyze_phase. Log: `[auto] Context exists — updating with auto-selected decisions.`

**Otherwise:** Use AskUserQuestion:
- header: "Context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — Review and revise existing context
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to analyze_phase
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**

Check `has_plans` and `plan_count` from init. **If `has_plans` is true:**

**If `--auto`:** Auto-select "Continue and replan after". Log: `[auto] Plans exist — continuing with context capture, will replan after.`

**Otherwise:** Use AskUserQuestion:
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after" — Capture context, then run /gsd:plan-phase {X} to replan
  - "View existing plans" — Show plans before deciding
  - "Cancel" — Skip discuss-phase

If "Continue and replan after": Continue to analyze_phase.
If "View existing plans": Display plan files, then offer "Continue" / "Cancel".
If "Cancel": Exit workflow.

**If `has_plans` is false:** Continue to load_prior_context.
</step>

<step name="load_prior_context">
Read project-level and prior phase context to avoid re-asking decided questions and maintain consistency.

**Step 1: Read project-level files**
```bash
# Core project files
cat .planning/PROJECT.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null

# Project standards artifacts (inform gray area identification with established patterns)
cat .planning/SECURITY.md 2>/dev/null
cat .planning/APIS.md 2>/dev/null
cat .planning/TESTING-STRATEGY.md 2>/dev/null
cat .planning/ERROR-HANDLING.md 2>/dev/null
cat .planning/DESIGN-SYSTEM.md 2>/dev/null
```

Extract from these:
- **PROJECT.md** — Vision, principles, non-negotiables, user preferences
- **REQUIREMENTS.md** — Acceptance criteria, constraints, must-haves vs nice-to-haves
- **STATE.md** — Current progress, any flags or session notes
- **SECURITY.md** — Established security patterns (inform security-related gray areas)
- **APIS.md** — API design standards, data access patterns (inform API/database gray areas)
- **TESTING-STRATEGY.md** — Testing boundaries (inform testing-related decisions)
- **ERROR-HANDLING.md** — Error handling patterns (inform error response gray areas)
- **DESIGN-SYSTEM.md** — UX standards, accessibility, interaction states, responsive strategy (inform UI/UX gray areas)

Use the project standards artifacts to ground gray area discussions. For example, if discussing an API phase, reference established API naming conventions from APIS.md rather than asking the user to decide from scratch. Gray areas should focus on decisions NOT already covered by these standards.

**Step 2: Read all prior CONTEXT.md files**
```bash
# Find all CONTEXT.md files from phases before current
find .planning/phases -name "*-CONTEXT.md" 2>/dev/null | sort
```

For each CONTEXT.md where phase number < current phase:
- Read the `<decisions>` section — these are locked preferences
- Read `<specifics>` — particular references or "I want it like X" moments
- Note any patterns (e.g., "user consistently prefers minimal UI", "user rejected single-key shortcuts")

**Step 3: Build internal `<prior_decisions>` context**

Structure the extracted information:
```
<prior_decisions>
## Project-Level
- [Key principle or constraint from PROJECT.md]
- [Requirement that affects this phase from REQUIREMENTS.md]

## From Prior Phases
### Phase N: [Name]
- [Decision that may be relevant to current phase]
- [Preference that establishes a pattern]

### Phase M: [Name]
- [Another relevant decision]
</prior_decisions>
```

**Usage in subsequent steps:**
- `analyze_phase`: Skip gray areas already decided in prior phases
- `present_gray_areas`: Annotate options with prior decisions ("You chose X in Phase 5")
- `discuss_areas`: Pre-fill answers or flag conflicts ("This contradicts Phase 3 — same here or different?")

**If no prior context exists:** Continue without — this is expected for early phases.
</step>

<step name="scout_codebase">
Lightweight scan of existing code to inform gray area identification and discussion. Uses ~10% context — acceptable for an interactive session.

**Step 1: Check for existing codebase maps**
```bash
ls .planning/codebase/*.md 2>/dev/null
```

**If codebase maps exist:** Read the most relevant ones (CONVENTIONS.md, STRUCTURE.md, STACK.md based on phase type). Extract:
- Reusable components/hooks/utilities
- Established patterns (state management, styling, data fetching)
- Integration points (where new code would connect)

Skip to Step 3 below.

**Step 2: If no codebase maps, do targeted grep**

Extract key terms from the phase goal (e.g., "feed" → "post", "card", "list"; "auth" → "login", "session", "token").

```bash
# Find files related to phase goal terms
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10

# Find existing components/hooks
ls src/components/ 2>/dev/null
ls src/hooks/ 2>/dev/null
ls src/lib/ src/utils/ 2>/dev/null
```

Read the 3-5 most relevant files to understand existing patterns.

**Step 3: Build internal codebase_context**

From the scan, identify:
- **Reusable assets** — existing components, hooks, utilities that could be used in this phase
- **Established patterns** — how the codebase does state management, styling, data fetching
- **Integration points** — where new code would connect (routes, nav, providers)
- **Creative options** — approaches the existing architecture enables or constrains
- **Refactor opportunities (CRITICAL)** — existing code in the same domain that could be extended/refactored to accomplish this phase's work instead of writing net new code. For each opportunity, note:
  - The existing file/module/class
  - What it currently does
  - How it could be extended to serve this phase's needs
  - Whether extending is better than creating new (will it make the existing code too complex? does it fit the existing abstraction?)

**Think like a senior engineer doing a codebase tour:** You're not just cataloging files — you're identifying leverage points. If this phase adds user notifications and `EmailService` already exists, that's a refactor opportunity worth surfacing. If there are two utility files that both do validation, consolidating them is worth flagging. The goal is to prevent the AI from reflexively creating new files when existing ones could serve.

Store as internal `<codebase_context>` for use in analyze_phase and present_gray_areas. This is NOT written to a file — it's used within this session only.
</step>

<step name="analyze_phase">
Analyze the phase to identify gray areas worth discussing. **Use both `prior_decisions` and `codebase_context` to ground the analysis.**

**You are acting as a senior engineer.** Your job is not just to pick options from a menu — it's to think through engineering consequences, identify leverage points in the existing codebase, surface trade-offs, and ask the questions that will shape the work. If the phase has real engineering depth (new backend, APIs, data, logic, refactoring), walk the user through the decisions that matter. If it's a pure visual tweak, don't invent engineering questions that don't exist.

**Read the phase description from ROADMAP.md and determine:**

1. **Domain boundary** — What capability is this phase delivering? State it clearly.

1b. **Initialize canonical refs accumulator** — Start building the `<canonical_refs>` list for CONTEXT.md. This accumulates throughout the entire discussion, not just this step.

   **Source 1 (now):** Copy `Canonical refs:` from ROADMAP.md for this phase. Expand each to a full relative path.
   **Source 2 (now):** Check REQUIREMENTS.md and PROJECT.md for any specs/ADRs referenced for this phase.
   **Source 3 (scout_codebase):** If existing code references docs (e.g., comments citing ADRs), add those.
   **Source 4 (discuss_areas):** When the user says "read X", "check Y", or references any doc/spec/ADR during discussion — add it immediately. These are often the MOST important refs because they represent docs the user specifically wants followed.

   This list is MANDATORY in CONTEXT.md. Every ref must have a full relative path so downstream agents can read it directly. If no external docs exist, note that explicitly.

2. **Check prior decisions** — Before generating gray areas, check if any were already decided:
   - Scan `<prior_decisions>` for relevant choices (e.g., "Ctrl+C only, no single-key shortcuts")
   - These are **pre-answered** — don't re-ask unless this phase has conflicting needs
   - Note applicable prior decisions for use in presentation

3. **Phase engineering depth classification (CRITICAL)** — Determine the engineering depth of this phase. This decides whether you apply first-principles decomposition or stick to visual/UX decisions.

   **Pure visual/UX phase (skip engineering decomposition):**
   - Extending or restyling an existing UI component
   - Adding visual variants, layout tweaks, copy changes
   - No new data, APIs, logic, state, or integrations
   - No database or backend changes

   **Engineering depth phase (apply first-principles decomposition):**
   - New API endpoints or changes to existing endpoints
   - New database tables, schema changes, or migrations
   - New backend logic, services, or business rules
   - Refactoring existing code
   - New integrations (third-party APIs, external services)
   - Authentication, authorization, or security-sensitive work
   - Data transformations, batch processing, or background jobs
   - State management changes that affect multiple components or data sources
   - Performance-sensitive work (caching, indexing, query optimization)

   **Mixed phase:** Some phases have both visual and engineering depth (e.g., "build notification UI with backend delivery system"). Apply BOTH the visual gray area logic AND the engineering decomposition.

4. **Gray area generation:**

   **If pure visual/UX phase:** For each relevant category (UI, UX, Behavior, Empty States, Content), identify 1-2 specific ambiguities that would change implementation. **Annotate with code context where relevant** (e.g., "You already have a Card component" or "No existing pattern for this"). Skip the engineering concerns checklist below.

   **If engineering depth phase (or mixed):** Walk through the engineering concerns checklist below. For each concern relevant to this phase, identify decision points that have real trade-offs and deserve user input. You are thinking like an engineer would when estimating: "What decisions here would change the result or cost? What do I need the user's input on?"

   **Engineering concerns checklist (apply only relevant ones — skip concerns that genuinely don't apply):**

   1. **Refactor Opportunities (ALWAYS CHECK FIRST)** — From codebase_context, is there existing code that could be extended or refactored to accomplish this phase's work? If yes, surface it as a gray area:
      - "We could extend `EmailService` to handle these notifications OR create a new `NotificationService`. Which approach?"
      - "The existing `validateUser()` function handles most of what we need — extend it or write a new validator for this phase?"
      - "Two similar utilities exist (`formatDate.ts` and `dateHelpers.ts`). Should we consolidate them as part of this phase or leave them?"
      - **The refactor-first principle applies here too.** Don't let the user default to "write new code" without considering if existing code can serve.

   2. **Data Model** — What data is being stored/changed? Gray areas might include:
      - New table vs extend existing table vs JSONB field?
      - Normalization level? (One table or split relationships?)
      - Soft deletes vs hard deletes?
      - Migration strategy if schema changes?

   3. **API Design** — What's the interface?
      - New endpoint vs extend existing?
      - Request/response shape?
      - Breaking change or backwards-compatible?
      - Pagination/filtering needs?

   4. **Security** — What's the trust boundary? Reference `.planning/SECURITY.md`.
      - Who can access this? What's the authorization model?
      - Input validation strategy?
      - Any secrets or sensitive data involved?
      - Does this deviate from established SECURITY.md patterns? (Flag if so.)

   5. **Error Handling** — What can fail? Reference `.planning/ERROR-HANDLING.md`.
      - User-facing vs internal failures?
      - Retry strategy for transient issues?
      - Graceful degradation or hard fail?

   6. **Performance** — Reference `.planning/APIS.md` Data Access section.
      - Expected data volume now and in 2 years?
      - Any N+1 query risk?
      - Caching strategy?
      - Sync vs async processing?

   7. **Testing** — Reference `.planning/TESTING-STRATEGY.md`.
      - What's the critical behavior that MUST be tested?
      - Unit vs integration vs E2E boundaries for this feature?
      - Regression risk in existing code?

   8. **State Management** — Where does state live? How is it synchronized?
      - Client vs server authority?
      - Optimistic updates or server-confirmed?

5. **For each engineering gray area, prepare a trade-off analysis:**

   When an engineering decision has multiple viable options, don't just list them — think through the consequences. For each option, identify:
   - **Concrete pros** — specific advantages in this project's context
   - **Concrete cons** — specific disadvantages, risks, or future costs
   - **What it affects downstream** — other code, future phases, maintainability, performance
   - **Your recommendation** — which option you'd pick and WHY, based on project state, existing code, and scale expectations

   **Example trade-off analysis for a data model decision:**
   ```
   Decision: How to store user notifications?

   Option A: New `notifications` table
   - ✓ Pros: Clean schema, indexable, easy to query independently, supports future notification types
   - ✗ Cons: Requires migration, adds a join when fetching user + notifications
   - Affects: New API endpoint likely, notification fan-out logic, read/unread tracking

   Option B: JSONB field on users table
   - ✓ Pros: No migration, simpler initial implementation, colocated with user data
   - ✗ Cons: Harder to query efficiently, can't index notification fields, JSONB grows unbounded per user
   - Affects: User table size, query patterns, future migration pain if you switch later

   Recommendation: Option A — you'll likely need to query notifications independently (unread counts, filtering by type), and the JSONB approach becomes painful as the feature grows. The migration cost is one-time; the query pain would be ongoing.
   ```

   The user makes the final call, but you've done the thinking so they can choose with full context.

6. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation, or all already decided in prior phases), the phase may not need discussion.

**Output your analysis internally, then present to user.**

Example analysis for "Post Feed" phase (pure visual, with code and prior context):
```
Domain: Displaying posts from followed users
Classification: Pure visual/UX phase — no new backend, APIs, or data
Existing: Card component (src/components/ui/Card.tsx), useInfiniteQuery hook, Tailwind CSS
Prior decisions: "Minimal UI preferred" (Phase 2), "No pagination — always infinite scroll" (Phase 4)
Gray areas:
- UI: Layout style (cards vs timeline vs grid) — Card component exists with shadow/rounded variants
- UI: Information density (full posts vs previews) — no existing density patterns
- Behavior: Loading pattern — ALREADY DECIDED: infinite scroll (Phase 4)
- Empty State: What shows when no posts exist — EmptyState component exists in ui/
```

Example analysis for "User Notifications Backend" phase (engineering depth):
```
Domain: Backend system for user notifications with delivery and read tracking
Classification: Engineering depth — new data, API, and logic
Refactor opportunity: EmailService exists at src/services/email.ts — could extend it or create parallel NotificationService
Gray areas:
- Refactor: Extend EmailService or create new NotificationService? [trade-off analysis]
- Data Model: notifications table vs JSONB on users? [trade-off analysis]
- API Design: /notifications endpoint vs /users/:id/notifications? [trade-off analysis]
- Performance: How to handle fan-out for users with many followers? [trade-off analysis]
- Real-time: WebSocket push vs polling? [trade-off analysis]
```
</step>

<step name="present_gray_areas">
Present the domain boundary, prior decisions, and gray areas to user.

**First, state the boundary and any prior decisions that apply:**
```
Phase [X]: [Name]
Domain: [What this phase delivers — from your analysis]

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)

[If prior decisions apply:]
**Carrying forward from earlier phases:**
- [Decision from Phase N that applies here]
- [Decision from Phase M that applies here]
```

**If `--auto`:** Auto-select ALL gray areas. Log: `[auto] Selected all gray areas: [list area names].` Skip the AskUserQuestion below and continue directly to discuss_areas with all areas selected.

**Otherwise, use AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: Generate 3-4 phase-specific gray areas, each with:
  - "[Specific area]" (label) — concrete, not generic
  - [1-2 questions this covers + code context annotation] (description)
  - **Highlight the recommended choice with brief explanation why**

**Prior decision annotations:** When a gray area was already decided in a prior phase, annotate it:
```
☐ Exit shortcuts — How should users quit?
  (You decided "Ctrl+C only, no single-key shortcuts" in Phase 5 — revisit or keep?)
```

**Code context annotations:** When the scout found relevant existing code, annotate the gray area description:
```
☐ Layout style — Cards vs list vs timeline?
  (You already have a Card component with shadow/rounded variants. Reusing it keeps the app consistent.)
```

**Combining both:** When both prior decisions and code context apply:
```
☐ Loading behavior — Infinite scroll or pagination?
  (You chose infinite scroll in Phase 4. useInfiniteQuery hook already set up.)
```

**For engineering depth gray areas: present trade-offs BEFORE the multiselect.**

When the phase has engineering depth and you generated trade-off analyses in `analyze_phase`, display the trade-offs inline so the user sees the engineering thinking, not just option labels. Format:

```
## Engineering Decisions

Before we pick which areas to dig into, here's the engineering thinking I've done:

### 1. [Decision area name]

**Context:** [what's being decided and why it matters]

**Option A: [name]**
- ✓ [concrete pro]
- ✓ [concrete pro]
- ✗ [concrete con]
- **Affects:** [downstream impact]

**Option B: [name]**
- ✓ [concrete pro]
- ✗ [concrete con]
- ✗ [concrete con]
- **Affects:** [downstream impact]

**My recommendation:** [A or B] — [rationale grounded in this project's state, existing code, and scale expectations]

---

### 2. [Next decision area]

[Same format]
```

Present ALL engineering trade-offs up front so the user sees the full picture. THEN use AskUserQuestion to let them pick which areas to discuss further OR accept your recommendations as-is.

**AskUserQuestion for engineering phases:**
- header: "Discuss"
- question: "Which engineering decisions do you want to discuss, or accept the recommendations as-is?"
- options: Include an "Accept all recommendations" option FIRST, then each decision area, then specific cross-cutting topics
- multiSelect: true

**Why the trade-off-first approach:** The user is not a multiple-choice test taker — they're a product owner who needs to understand the consequences. Showing them "Option A vs Option B" without context forces them to either trust you blindly or ask "what's the difference?". Showing them pros/cons/recommendations up front lets them validate your reasoning, push back if they disagree, or defer to you if the decision is too technical to care about.

**Do NOT include a "skip" or "you decide" option in the overall gray area selection.** User ran this command to discuss — give them real choices. HOWEVER, "Accept all recommendations" is valid because it means "I trust your engineering reasoning, let's move on."

**Examples by domain (with code context):**

For "Post Feed" (visual feature):
```
☐ Layout style — Cards vs list vs timeline? (Card component exists with variants)
☐ Loading behavior — Infinite scroll or pagination? (useInfiniteQuery hook available)
☐ Content ordering — Chronological, algorithmic, or user choice?
☐ Post metadata — What info per post? Timestamps, reactions, author?
```

For "Database backup CLI" (command-line tool):
```
☐ Output format — JSON, table, or plain text? Verbosity levels?
☐ Flag design — Short flags, long flags, or both? Required vs optional?
☐ Progress reporting — Silent, progress bar, or verbose logging?
☐ Error recovery — Fail fast, retry, or prompt for action?
```

For "Organize photo library" (organization task):
```
☐ Grouping criteria — By date, location, faces, or events?
☐ Duplicate handling — Keep best, keep all, or prompt each time?
☐ Naming convention — Original names, dates, or descriptive?
☐ Folder structure — Flat, nested by year, or by category?
```

Continue to discuss_areas with selected areas.
</step>

<step name="discuss_areas">
For each selected area, conduct a focused discussion loop.

**Batch mode support:** Parse optional `--batch` from `$ARGUMENTS`.
- Accept `--batch`, `--batch=N`, or `--batch N`
- Default to 4 questions per batch when no number is provided
- Clamp explicit sizes to 2-5 so a batch stays answerable
- If `--batch` is absent, keep the existing one-question-at-a-time flow

**Philosophy:** stay adaptive, but let the user choose the pacing.
- Default mode: 4 single-question turns, then check whether to continue
- `--batch` mode: 1 grouped turn with 2-5 numbered questions, then check whether to continue

Each answer (or answer set, in batch mode) should reveal the next question or next batch.

**Auto mode (`--auto`):** For each area, Claude selects the recommended option (first option, or the one explicitly marked "recommended") for every question without using AskUserQuestion. Log each auto-selected choice:
```
[auto] [Area] — Q: "[question text]" → Selected: "[chosen option]" (recommended default)
```
After all areas are auto-resolved, skip the "Explore more gray areas" prompt and proceed directly to write_context.

**Interactive mode (no `--auto`):**

**For each area:**

1. **Announce the area:**
   ```
   Let's talk about [Area].
   ```

1b. **For engineering decisions: walk through consequences, not just options.**

   If this area is an engineering decision (from the engineering concerns checklist in analyze_phase), start by re-stating the trade-off analysis and then ask the user to respond to your thinking, not just pick from a list. Format:

   ```
   Here's my thinking on [decision]:

   [Brief restatement of the trade-off — pros, cons, recommendation]

   My gut says [recommendation] because [rationale tied to existing code/project state/scale].

   Does that reasoning hold for you, or are there constraints I'm missing?
   ```

   This is a conversation, not a quiz. Invite the user to push back on your reasoning, add context you don't have, or point out constraints that change the calculus. If they agree, capture the decision and move on. If they disagree, explore why — their disagreement often reveals context you didn't have access to.

   **Probe for consequences when the user picks an option:**
   - "If we go with Option A, we'll need to handle [downstream implication] — are you okay with that cost?"
   - "That approach means we can't [future capability] without rework — is that a concern?"
   - "This choice couples [X] to [Y] — is that acceptable?"

   **Probe for refactor opportunities:**
   - "Before we write new code for this, I noticed [existing file/class] does something similar. Want me to extend that instead?"
   - "There are two existing utilities that overlap here — should we consolidate them as part of this work, or leave them alone?"

2. **Ask questions using the selected pacing:**

   **Default (no `--batch`): Ask 4 questions using AskUserQuestion**
   - header: "[Area]" (max 12 chars — abbreviate if needed)
   - question: Specific decision for this area
   - options: 2-3 concrete choices (AskUserQuestion adds "Other" automatically), with the recommended choice highlighted and brief explanation why
   - **Annotate options with code context** when relevant:
     ```
     "How should posts be displayed?"
     - Cards (reuses existing Card component — consistent with Messages)
     - List (simpler, would be a new pattern)
     - Timeline (needs new Timeline component — none exists yet)
     ```
   - Include "You decide" as an option when reasonable — captures Claude discretion
   - **Context7 for library choices:** When a gray area involves library selection (e.g., "magic links" → query next-auth docs) or API approach decisions, use `mcp__context7__*` tools to fetch current documentation and inform the options. Don't use Context7 for every question — only when library-specific knowledge improves the options.

   **Batch mode (`--batch`): Ask 2-5 numbered questions in one plain-text turn**
   - Group closely related questions for the current area into a single message
   - Keep each question concrete and answerable in one reply
   - When options are helpful, include short inline choices per question rather than a separate AskUserQuestion for every item
   - After the user replies, reflect back the captured decisions, note any unanswered items, and ask only the minimum follow-up needed before moving on
   - Preserve adaptiveness between batches: use the full set of answers to decide the next batch or whether the area is sufficiently clear

3. **After the current set of questions, check:**
   - header: "[Area]" (max 12 chars)
   - question: "More questions about [area], or move to next? (Remaining: [list other unvisited areas])"
   - options: "More questions" / "Next area"

   When building the question text, list the remaining unvisited areas so the user knows what's ahead. For example: "More questions about Layout, or move to next? (Remaining: Loading behavior, Content ordering)"

   If "More questions" → ask another 4 single questions, or another 2-5 question batch when `--batch` is active, then check again
   If "Next area" → proceed to next selected area
   If "Other" (free text) → interpret intent: continuation phrases ("chat more", "keep going", "yes", "more") map to "More questions"; advancement phrases ("done", "move on", "next", "skip") map to "Next area". If ambiguous, ask: "Continue with more questions about [area], or move to the next area?"

4. **After all initially-selected areas complete:**
   - Summarize what was captured from the discussion so far
   - AskUserQuestion:
     - header: "Done"
     - question: "We've discussed [list areas]. Which gray areas remain unclear?"
     - options: "Explore more gray areas" / "I'm ready for context"
   - If "Explore more gray areas":
     - Identify 2-4 additional gray areas based on what was learned
     - Return to present_gray_areas logic with these new areas
     - Loop: discuss new areas, then prompt again
   - If "I'm ready for context": Proceed to write_context

**Canonical ref accumulation during discussion:**
When the user references a doc, spec, or ADR during any answer — e.g., "read adr-014", "check the MCP spec", "per browse-spec.md" — immediately:
1. Read the referenced doc (or confirm it exists)
2. Add it to the canonical refs accumulator with full relative path
3. Use what you learned from the doc to inform subsequent questions

These user-referenced docs are often MORE important than ROADMAP.md refs because they represent docs the user specifically wants downstream agents to follow. Never drop them.

**Question design:**
- Options should be concrete, not abstract ("Cards" not "Option A")
- Each answer should inform the next question or next batch
- If user picks "Other" to provide freeform input (e.g., "let me describe it", "something else", or an open-ended reply), ask your follow-up as plain text — NOT another AskUserQuestion. Wait for them to type at the normal prompt, then reflect their input back and confirm before resuming AskUserQuestion or the next numbered batch.

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**Find or create phase directory:**

Use values from init: `phase_dir`, `phase_slug`, `padded_phase`.

If `phase_dir` is null (phase exists in roadmap but no directory):
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**File location:** `${phase_dir}/${padded_phase}-CONTEXT.md`

**Structure the content by what was discussed:**

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor]

</domain>

<decisions>
## Implementation Decisions

### [Category 1 that was discussed]
- [Decision or preference captured]
- [Another decision if applicable]

### [Category 2 that was discussed]
- [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

</decisions>

<engineering_decisions>
## Engineering Decisions & Rationale

**Only include this section if the phase had engineering depth.** For each engineering decision, capture not just the choice but the reasoning — future phases and downstream agents need to understand WHY a decision was made, not just what it was.

### [Engineering concern — e.g., Data Model]
**Decision:** [Chosen option]
**Alternatives considered:** [Other options that were on the table]
**Rationale:** [Why this option was chosen — pros that won, cons that were acceptable, project context that drove the choice]
**Affects:** [What downstream code/phases this decision impacts]

### [Next engineering concern — e.g., Refactor Approach]
**Decision:** Extend existing `EmailService` rather than create new `NotificationService`
**Alternatives considered:** New NotificationService with email as one delivery method
**Rationale:** EmailService already handles template rendering and delivery retry logic. Extending keeps notification logic consolidated. If we add SMS/push later, we can refactor to a delivery-method abstraction then.
**Affects:** src/services/email.ts will grow; notification types will live alongside email types; future SMS/push work will touch this file

[If no engineering decisions: omit this entire section]

</engineering_decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[MANDATORY section. Write the FULL accumulated canonical refs list here.
Sources: ROADMAP.md refs + REQUIREMENTS.md refs + user-referenced docs during
discussion + any docs discovered during codebase scout. Group by topic area.
Every entry needs a full relative path — not just a name.]

### [Topic area 1]
- `path/to/adr-or-spec.md` — [What it decides/defines that's relevant]
- `path/to/doc.md` §N — [Specific section reference]

### [Topic area 2]
- `path/to/feature-doc.md` — [What this doc defines]

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [Component/hook/utility]: [How it could be used in this phase]

### Established Patterns
- [Pattern]: [How it constrains/enables this phase]

### Integration Points
- [Where new code connects to existing system]

</code_context>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases. Don't lose them.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

Write file.
</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured

### [Category]
- [Key decision]

### [Category]
- [Key decision]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future phase

---

## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:plan-phase ${PHASE} --skip-research` — plan without research
- `/gsd:ui-phase ${PHASE}` — generate UI design contract before planning (if phase has frontend work)
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="git_commit">
Commit phase context (uses `commit_docs` from init internally):

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Confirm: "Committed: docs(${padded_phase}): capture phase context"
</step>

<step name="update_state">
Update STATE.md with session info:

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commit STATE.md:

```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="auto_advance">
Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. **Sync chain flag with intent** — if user invoked manually (no `--auto`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Read both the chain flag and user preference:
   ```bash
   AUTO_CHAIN=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present AND `AUTO_CHAIN` is not true:** Persist chain flag to config (handles direct `--auto` usage without new-project):
```bash
node "/Users/phillipdougherty/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active true
```

**If `--auto` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Launching plan-phase...
```

Launch plan-phase using the Skill tool to avoid nested Task sessions (which cause runtime freezes due to deep agent nesting — see #686):
```
Skill(skill="gsd:plan-phase", args="${PHASE} --auto")
```

This keeps the auto-advance chain flat — discuss, plan, and execute all run at the same nesting level rather than spawning increasingly deep Task agents.

**Handle plan-phase return:**
- **PHASE COMPLETE** → Full chain succeeded. Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished: discuss → plan → execute

  Next: /gsd:discuss-phase ${NEXT_PHASE} --auto
  <sub>/clear first → fresh context window</sub>
  ```
- **PLANNING COMPLETE** → Planning done, execution didn't complete:
  ```
  Auto-advance partial: Planning complete, execution did not finish.
  Continue: /gsd:execute-phase ${PHASE}
  ```
- **PLANNING INCONCLUSIVE / CHECKPOINT** → Stop chain:
  ```
  Auto-advance stopped: Planning needs input.
  Continue: /gsd:plan-phase ${PHASE}
  ```
- **GAPS FOUND** → Stop chain:
  ```
  Auto-advance stopped: Gaps found during execution.
  Continue: /gsd:plan-phase ${PHASE} --gaps
  ```

**If neither `--auto` nor config enabled:**
Route to `confirm_creation` step (existing behavior — show manual next steps).
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Prior context loaded (PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files)
- Already-decided questions not re-asked (carried forward from prior phases)
- Codebase scouted for reusable assets, patterns, and integration points
- Gray areas identified through intelligent analysis with code and prior decision annotations
- User selected which areas to discuss
- Each selected area explored until user satisfied (with code-informed and prior-decision-informed options)
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions, not vague vision
- CONTEXT.md includes canonical_refs section with full file paths to every spec/ADR/doc downstream agents need (MANDATORY — never omit)
- CONTEXT.md includes code_context section with reusable assets and patterns
- Deferred ideas preserved for future phases
- STATE.md updated with session info
- User knows next steps
</success_criteria>
