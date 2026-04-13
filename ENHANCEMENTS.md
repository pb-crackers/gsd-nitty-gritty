# Enhancements Log

A running history of enhancements made to GSD Nitty Gritty, the reasoning behind each one, and a backlog of future changes under consideration.

This document is not just a changelog — it captures the **intent** behind each enhancement so future iterations can build on the same philosophy rather than accidentally undoing it.

---

## Philosophy

GSD Nitty Gritty exists because AI-generated code has two failure modes:

1. **Too much code** — AI creates new files and abstractions when it should refactor existing code. Codebase inflates. Complexity compounds.
2. **Too little depth** — AI ships happy-path implementations that skip input validation, use `SELECT *`, leave error handling as `catch (e) { throw e }`, and commit migrations that explode on re-run.

The tagline is **"Slow is smooth and smooth is fast."** More steps up front. Fewer fires later. Raw generation speed is traded for engineering rigor.

Every enhancement in this document should reinforce one of these principles:

- **Refactor-first over extension-first**
- **First-principles decomposition over shallow task listing**
- **Opinionated standards over ad-hoc decisions**
- **Trade-off analysis over multiple-choice moderation**
- **Act like a team of experts, not a single generalist**
- **Catch the failure mode before it reaches production**

---

## Completed Enhancements

### 1. Refactor-First Hard Gate
**Shipped:** Initial release
**Files modified:** `plan-phase.md`, `execute-plan.md`, `quick.md`

**Problem:** AI reflexively creates new files and abstractions when existing code could be extended. This inflates codebase size, creates parallel implementations of similar logic, and makes maintenance harder.

**Solution:**
- Added `<refactor_check>` as a mandatory field on every task in plan-phase. The planner must list existing files/modules that touch the same domain.
- Added mandatory refactor analysis to execute-plan: before writing new code, the executor must evaluate whether existing code can be extended.
- Added Rule 5 (Unnecessary Abstraction) to the deviation rules. Catches new files/classes/modules that duplicate existing code — triggers an evaluate-refactor-alternative step.
- Default answer is **refactor**. New code requires documented justification in the commit message.

**Why it matters:** Prevents codebase inflation. Keeps the code comprehensible. Forces the AI to understand what exists before adding to it.

---

### 2. First-Principles Decomposition
**Shipped:** Initial release
**Files modified:** `new-project.md`, `plan-phase.md`

**Problem:** Phase planning tends to produce surface-level tasks like "build the API" or "create the UI" without decomposing into the underlying engineering concerns. Security, error handling, performance, and observability get skipped.

**Solution:**
- Added first-principles decomposition template to the planner prompt. For each phase, the planner must walk through an 8-concern checklist:
  - Data Model
  - Security
  - API Design
  - Error Handling
  - Testing
  - Logging & Observability
  - Performance
  - State Management
  - (Later added) UX & Accessibility
- The planner must explicitly document which concerns were evaluated and which were skipped (with reasoning). A pure CSS task can skip rate limiting, but it has to say so.
- Added language to new-project's requirements quality criteria encouraging atomic engineering-concern-level requirements rather than "build feature X" mega-requirements.

**Why it matters:** Forces the AI to think about what actually needs to exist for production-ready code. Eliminates "we'll add validation later" type gaps.

---

### 3. Living Project Standards Artifacts
**Shipped:** Initial release + expansion to 5 artifacts
**Files modified:** `new-project.md`, `new-milestone.md`, `plan-phase.md`, `execute-plan.md`, `discuss-phase.md`, `quick.md`, `autonomous.md`

**Problem:** Without project-level standards documents, every phase re-decides the same things from scratch. Security patterns drift. API conventions are inconsistent. Testing strategy varies per phase.

**Solution:** Five opinionated reference documents generated at project init, tailored to the project's stack:

1. **SECURITY.md** — Auth patterns, input validation, transport security, CORS/CSRF, database security, secret management, dependency auditing, logging constraints
2. **APIS.md** — Versioning, naming, request/response format, pagination, rate limiting, data access patterns (query efficiency, N+1 prevention, index-aware design), migration safety (idempotent SQL, zero-downtime patterns, reversibility)
3. **TESTING-STRATEGY.md** — Unit/integration/E2E boundaries, what not to test, coverage philosophy, test data strategy
4. **ERROR-HANDLING.md** — Error classification, error codes, user-facing messages, logging strategy, retry patterns, global error handling, validation error format
5. **DESIGN-SYSTEM.md** — WCAG 2.1 AA accessibility, mandatory interaction states (default/hover/focus/active/disabled/loading/error/success/empty), responsive strategy, user flow requirements (happy/error/empty/loading), component reuse, micro-interactions, typography/spacing/color tokens

Each artifact is:
- **Generated** during project initialization with opinionated defaults tailored to the project's stack
- **Gated** at planning time (no phase gets planned without them — missing artifacts are auto-generated before proceeding)
- **Referenced** by planners, executors, and UI agents during every phase
- **Maintained** after execution when new patterns emerge (execute-plan has an `update_project_standards` step)

**Why it matters:** Standards drift is one of the biggest code quality problems in AI-generated projects. These artifacts create a consistent reference point that the AI MUST consult before writing relevant code.

---

### 4. Engineering Depth in Discussion Phase
**Shipped:** Second wave
**Files modified:** `discuss-phase.md`, `autonomous.md`

**Problem:** The discussion phase was designed for visual/UX decisions (layout, colors, information density). It didn't apply first-principles thinking to engineering decisions. A user discussing "user notifications backend" would only get asked about visual aspects, never about data model, API design, or refactor opportunities.

**Solution:**
- Added phase engineering depth classification (pure visual vs engineering depth vs mixed) to `analyze_phase`.
- For engineering depth phases, the gray area generator walks through the engineering concerns checklist (refactor opportunities, data model, API design, security, error handling, performance, testing, state management).
- Added **trade-off analysis** requirement: for each engineering decision, the planner generates concrete pros/cons with a recommendation grounded in existing code and scale expectations. Not "Option A vs Option B" — "Option A because [pro] outweighs [con], although [alternative consideration]."
- Added **conversational discussion pattern**: instead of quiz-style option picking, Claude walks the user through the reasoning ("Here's what I'm thinking — A because X outweighs Y, but if you have constraints I don't see, let me know") and invites pushback.
- Added **refactor opportunity identification** to `scout_codebase`: explicitly surface existing code that could be extended instead of writing new code. Becomes a first-class gray area.
- Added `<engineering_decisions>` section to CONTEXT.md capturing decision + alternatives + rationale + downstream impact. Not just the choice but the reasoning.
- Mirrored all changes in `autonomous.md` smart_discuss so autonomous mode gets the same engineering rigor.

**Why it matters:** The discussion phase is where decisions get made. If the AI only asks about visuals, engineering decisions get made by default (usually poorly) at execution time. This ensures the senior-engineer lens is applied when it matters most — before any tasks exist.

---

### 5. UX Designer Depth in UI Phase
**Shipped:** Third wave
**Files modified:** `ui-phase.md`, `DESIGN-SYSTEM.md` (new artifact)

**Problem:** The UI phase produced UI-SPEC.md design contracts but didn't enforce UX designer rigor — accessibility, mandatory interaction states, full user flow coverage, responsive strategy, component reuse.

**Solution:**
- DESIGN-SYSTEM.md artifact (see Enhancement 3) provides the standards reference.
- Added `<ux_designer_requirements>` block to the UI researcher prompt. Every interactive element must specify all 9 interaction states. Every feature must design the full user flow (happy + error + empty + loading + edge cases). WCAG 2.1 AA is the baseline. Component reuse is required (refactor-first applies to UI too).
- Added matching `<ux_checker_requirements>` block to the UI checker. Verifies interaction state completeness, user flow coverage, accessibility compliance, and component reuse justification.
- DESIGN-SYSTEM.md becomes a mandatory read for both researcher and checker.

**Why it matters:** AI-generated UIs tend to skip accessibility, skip error/empty/loading states, and create ButtonV2 components instead of extending existing ones. This enforces the full UX designer lens.

---

### 6. QA Engineer Depth in Verification
**Shipped:** Third wave
**Files modified:** `verify-work.md`

**Problem:** The verify-work workflow extracted tests from phase summaries ("Reply to a Comment" → "Clicking Reply opens inline composer...") but didn't systematically explore edge cases, failure modes, or QA dimensions. Tests were happy-path only.

**Solution:** Added a `qa_depth_expansion` step that classifies what the phase built and appends targeted tests from 9 categories:

- **Input Validation** — empty, whitespace, max length, unicode, injection attempts, invalid formats, boundary numbers
- **State Transitions** — double-submit, concurrent edits, partial completion, invalid state probes
- **Boundaries** — empty collections, single item, exact page size, over page size, large datasets
- **Failure Modes** — offline, slow network, timeouts, 500 errors, partial responses
- **Accessibility** — keyboard-only, screen reader, zoomed text, reduced motion, color contrast
- **Cross-Device** — mobile, tablet, desktop, touch vs mouse
- **Security** — unauthorized access, authorization bypass, session expiry, CSRF
- **Data Integrity** — refresh after write, cross-device sync, delete verification
- **Performance** — perceived performance, large dataset handling, memory leak probes

Categories that don't apply are skipped with documented reasoning in the UAT frontmatter.

**Core philosophy:** "You are not trying to test everything — you are trying to catch the bugs that would embarrass the team in production." Quality over quantity. Five well-chosen edge case tests beat fifty generic ones.

**Why it matters:** Catches the bugs that actually reach production. A UAT that only validates the happy path gives false confidence.

---

### 7. PM Lens — Scope & Hypothesis Validation
**Shipped:** Third wave
**Files modified:** `new-project.md` (Step 7.25), `new-milestone.md` (Step 9.5)

**Problem:** Projects and milestones commonly fail not because the code is bad, but because someone built the wrong thing, the right thing at the wrong time, or too much before learning whether the hypothesis was real. The workflow had no pressure-test moment for scope and hypothesis before the roadmap got locked in.

**Solution:** Inserted a PM Lens step between requirements definition and roadmap creation. Claude steps into senior product manager mode and walks the user through five areas (four for milestones):

1. **Problem Clarity** — specific target user, specific problem, why current solutions are inadequate
2. **Hypothesis Framing** — "if we build X, users will Y, because Z" + prove/disprove evidence + early signal in 2 weeks
3. **MVP Discipline** — walk through every requirement one at a time, pressure-test against hypothesis, defer what fails
4. **Anti-Requirements** — tempting-but-deferred + explicit nos (minimum 3)
5. **Success Metrics & Key Risks** — measurable metric, threshold, honest risk articulation, early warning signal

For milestones, Area 1 is replaced with "Why this milestone now" since the overall product is already validated. Scale-aware skip: milestones with fewer than 3 requirements or refinement/polish scope get offered a skip or quick version.

Three modes: "Walk me through it" (default, interactive), "I've thought about this" (user provides short paragraphs), "Skip entirely" (noted in PROJECT.md). Auto mode extracts answers from idea documents.

All outcomes captured to PROJECT.md under a `## PM Validation` section. If MVP Discipline moved items from v1 to v2, REQUIREMENTS.md gets updated automatically before the roadmap is created.

**Why it matters:** The cheapest place to catch "we're building the wrong thing" is BEFORE any code exists. Projects that succeed are the ones where these questions got asked. The PM Lens makes them unavoidable without being a checkbox exercise.

---

### 8. No-Mocks Testing Philosophy + Standards Propagation to Every Lifecycle Workflow
**Shipped:** Fourth wave
**Files modified:** `new-project.md`, `add-tests.md`, `validate-phase.md`, `verify-phase.md`, `research-phase.md`, `verify-work.md`, `ui-review.md`, `audit-milestone.md`, `map-codebase.md`, `list-phase-assumptions.md`, `plan-milestone-gaps.md`

**Problem:** Two related gaps surfaced at once. First, the TESTING-STRATEGY.md template had a weak no-mocks stance — it said "real DB, not mocks" as a parenthetical on one tier, but never stated the core principle that we build production applications and a mocked test only proves that the mock matches itself. Projects following the template were still writing tests that mocked owned code, which passes CI and breaks in prod. Second, only 9 of the 40 workflows referenced the standards artifacts (SECURITY/APIS/TESTING-STRATEGY/ERROR-HANDLING/DESIGN-SYSTEM). The artifacts were being generated, read during planning and execution, and then ignored by nearly every other lifecycle command — verification, UAT, research, milestone audit, codebase mapping, retroactive UI review, assumption surfacing, and gap-planning all ran without them. Standards drift could enter the codebase phase-by-phase and never get caught.

**Solution:**

**Part A — Authoritative no-mocks rule in the template:**
- Rewrote the TESTING-STRATEGY.md template in `new-project.md` Step 7.5 to lead with a **Core Principle**: do not mock anything you own or control; tests must run against real databases, real internal services, real file systems, real queues, real HTTP handlers, real domain logic.
- The only acceptable mock boundary is **external third-party services you cannot run locally** (Stripe production API, Twilio SMS delivery, vendor SaaS without a sandbox) — and even there, prefer vendor test modes / sandboxes / contract tests over hand-rolled mocks.
- Added an explicit **Acceptable Mock Boundaries** short list: (1) external paid APIs with no sandbox, (2) time/clock for deterministic scheduling tests, (3) RNG for deterministic output tests. Everything else runs for real. Every mock must be justified in a code comment naming its boundary category.
- Propagates automatically to `new-milestone.md` (regenerates missing artifacts from this template) and to every existing reader (`discuss-phase`, `plan-phase`, `execute-plan`, `autonomous`, `quick`).

**Part B — Enforcement at the test-generating commands:**
- `add-tests.md` and `validate-phase.md` now load TESTING-STRATEGY.md before generating tests, with a fallback to the GSD default no-mocks philosophy embedded inline (so the rule applies even on projects that pre-date the artifact).
- Both commands now audit planned tests against the no-mocks rule **before** generating, and the generation steps forbid importing mocking libraries to stub owned code. If a test gap requires a mock of owned code, the agent must escalate rather than silently generate it.
- Test plans now include explicit dependency-touched notes per test, real-dependency setup requirements, and a Justified Mocks section where every mock must name its boundary category.

**Part C — Standards propagation to 9 previously-uninformed workflows:**

| Workflow | Problem | Solution |
|----------|---------|----------|
| `verify-phase.md` | Anti-pattern scan caught stubs but not policy violations | New `scan_standards_compliance` step classifies each phase-modified file by domain (auth/DB/migration/error-path/frontend) and spot-checks against the relevant artifact; blocker findings force `gaps_found` |
| `verify-work.md` | QA depth expansion had generic templates, ignored the project's own policies | New `load_project_standards` step loads all artifacts; each of the 9 QA categories now has a standards pointer annotation (Security → SECURITY.md, Accessibility → DESIGN-SYSTEM.md, etc.); frontmatter tracks `qa_standards_source: tailored\|default` |
| `research-phase.md` | Researcher returned generic best-practice answers contradicting documented project policy | Standards artifacts added to researcher's `<files_to_read>`; new `<project_standards_constraint>` block requires alignment or explicit justification; RESEARCH.md must include a Standards Alignment section |
| `ui-review.md` | Fallback was "abstract 6-pillar standards" when UI-SPEC.md absent, ignoring DESIGN-SYSTEM.md entirely | Formal audit-baseline hierarchy: UI-SPEC.md → DESIGN-SYSTEM.md → abstract. DESIGN-SYSTEM.md included in auditor context even when UI-SPEC.md is present, so audits catch design-system drift |
| `audit-milestone.md` | No milestone-level standards drift detection — phases could individually pass while the milestone's cumulative code silently diverged | New section 5.6 "Standards Drift Detection" aggregates phase-level findings + cross-phase sampling; `standards` block added to audit YAML; violations force `gaps_found`, drift feeds tech debt |
| `map-codebase.md` | Quality mapper's TESTING.md/CONVENTIONS.md documented observed patterns without comparing to prescriptive standards | Quality mapper now produces "Documented vs Observed" drift sections; Concerns mapper gets a top-level "Standards Violations" category as a first-class concern type (mocks of owned code, missing CSRF, missing migration guards, etc.) |
| `list-phase-assumptions.md` | Surfaced assumptions across 5 areas but not "assumptions about standards compliance" — the most expensive misunderstanding to catch late | 6th assumption area added with per-artifact phase-specific prompts ("I'm assuming the new endpoint uses the JWT middleware pattern from SECURITY.md…") |
| `plan-milestone-gaps.md` | Gap grouping ignored which standards artifact governed each gap | New section 2.5 tags each gap with its standards artifact; "same artifact tag → combine" grouping rule added; phase descriptions carry tags forward to `plan-phase` |

All propagation edits are conditional on artifact existence — workflows remain functional on projects without generated standards, with explicit fallback guidance.

**Core philosophy:** Tests that pass against mocks of owned code tell you nothing about production behavior. Standards documents that only planners read get silently violated everywhere else. Both problems have the same fix: enforce the rule at every point the rule could be broken, and make fallbacks explicit so the rule applies even when the authoritative document is missing.

**Why it matters:** Standards drift is asymmetric — one phase's violation sets the precedent that the next phase's violation is "consistent with existing code." Catching drift at every lifecycle point (verify, UAT, research, audit, map, review, assumption-surface, gap-plan) keeps the project's documented posture honest. The no-mocks rule in particular eliminates a whole class of false-confidence bugs where CI passes, production breaks, and nobody can explain the disconnect.

---

## Design Principles (Observed Patterns)

These patterns emerged as we built the enhancements. They serve as guardrails for future changes:

### 1. Act Like a Team of Experts
Each workflow step should embody a specific role (Engineer, Designer, PM, QA) with depth that role requires. Don't make Claude a generalist — make Claude act like the right specialist for each moment.

### 2. Hard Gates Over Soft Suggestions
When something matters (refactor-first, standards compliance, edge case coverage), make it mandatory and verifiable. Soft suggestions get ignored. Hard gates change behavior.

### 3. Trade-Off Analysis Over Options Lists
When presenting engineering decisions, show pros/cons/recommendation grounded in project context. Multiple choice without context forces blind trust or tedious probing.

### 4. Refactor-First at Every Layer
The refactor-first principle applies at discussion (surface opportunities), planning (refactor_check field), execution (mandatory analysis), and UI (component reuse). Reinforced at every layer.

### 5. Standards Documents as Living References
Project standards artifacts are referenced at every phase and maintained when new patterns emerge. They're not write-once — they evolve with the project.

### 6. Conversational Depth Over Checklist Width
Long walkthroughs with real probing beat short quiz-style questionnaires. The goal is engineering clarity, not speed to the next step.

### 7. Escape Hatches for Confidence
Every pressure-test step offers a skip option for users who've already done the thinking. Forcing re-work creates friction without adding value. But the default should be to do the work — skip is opt-in.

### 8. Document the Why, Not Just the What
Every decision capture includes rationale. CONTEXT.md has `<engineering_decisions>` with alternatives considered and trade-off reasoning. PROJECT.md has PM Validation with prove/disprove evidence. Future maintainers (and future Claude sessions) need the why.

---

## Backlog — Under Consideration

These are opportunities identified but not yet implemented. Listed in rough priority order.

### A. Debug Workflow / SRE Depth (⭐⭐)
**Status:** Not started
**Scope:** Enhance `gsd:debug` workflow with incident response rigor

**Current state:** The debug workflow follows scientific method (hypothesis → test → conclusion). Reasonable for narrow bugs.

**Proposed additions:**
- **Root cause vs symptom** — explicitly distinguish "we fixed the visible manifestation" from "we fixed the underlying cause". Don't accept a fix that doesn't explain WHY the bug happened.
- **Blast radius assessment** — when a bug is found, ask "what else could this be affecting that we haven't noticed yet?" Probe for related code paths, downstream systems, edge cases that might have the same underlying issue.
- **Prevention strategy** — for every fix, ask "what check/test/alert would have caught this earlier?" Add the prevention to the fix, not just the fix itself.
- **Pattern detection** — "Is this the third time we've seen a bug in this area? What does that tell us?" Surface code smells and architectural issues.
- **Post-mortem discipline** — for significant bugs, capture the learning in a format that can be retrieved later (ADR-style or debug session archive).

**Why it's valuable:** The current debug workflow often treats symptoms. Production teams need root cause + prevention, not just fixes.

**Complexity:** Medium. Primarily adds process steps to existing workflow.

---

### B. ADR Artifact (Architecture Decision Records) (⭐⭐)
**Status:** Not started
**Scope:** New artifact `.planning/adrs/` or `.planning/ARCHITECTURE.md`

**Current state:** Phase-level decisions are captured in CONTEXT.md `<engineering_decisions>`. Project standards are in SECURITY.md, APIS.md, etc. (prescriptive). But there's no home for **project-level architectural decisions with historical context**.

**Proposed:** Track major architectural decisions as they're made:
- "We chose Postgres over MongoDB because..."
- "We use server components not client components because..."
- "We use SSR not SSG because..."
- "We chose tRPC over REST because..."

Each ADR captures: context, decision, alternatives considered, consequences (expected and observed over time).

**Difference from APIS.md:** APIS.md is prescriptive standards (how to write APIs). ADRs are historical decisions with rationale (why we chose this stack/pattern/approach).

**Integration:** ADRs get referenced during discussion phase and planning to maintain consistency. New architectural decisions trigger new ADRs.

**Why it's valuable:** Six months into a project, "why did we do X?" becomes unanswerable without ADRs. They're the institutional memory.

**Complexity:** Medium. New artifact type, needs integration into discuss-phase and plan-phase.

---

### C. Observability Artifact (⭐)
**Status:** Not started
**Scope:** New artifact `.planning/OBSERVABILITY.md`

**Current state:** Logging standards are partially covered in SECURITY.md (don't log sensitive data, structured logging, correlation IDs). But there's no comprehensive observability artifact.

**Proposed:** Dedicated `.planning/OBSERVABILITY.md` covering:
- **Logging standards** — what to log, what not to log, format, levels
- **Metrics strategy** — what to measure, dimensions, aggregations
- **Alerting thresholds** — what should page someone, what should just notify
- **Correlation IDs & tracing** — how requests flow through systems, tracing strategy
- **SLO/SLI definitions** — what "working" means in measurable terms
- **Dashboards** — what the team looks at to understand system health
- **Incident response** — runbooks, escalation, post-mortem process

**Integration:** Referenced during planning for any backend work. Executor maintains it when new metrics or logging patterns emerge.

**Why it's valuable:** Observability is what turns "it works in dev" into "we'll know in prod." Often added after the first incident — should be designed in from the start.

**Complexity:** Medium. New artifact + integration at multiple points.

---

### D. Standalone PM Review Command (⭐)
**Status:** Not started
**Scope:** New workflow `workflows/pm-review.md` → `/gsd:pm-review`

**Current state:** PM Lens is inline in new-project and new-milestone. Not accessible at other points.

**Proposed:** Standalone command that can be run at any time to do a PM pressure test on current scope. Useful when:
- Mid-project, about to add scope — pressure-test before committing
- Scope is drifting — re-ground in hypothesis and metrics
- A feature isn't working in production — revisit the hypothesis
- New information arrives — re-evaluate priorities

Would reuse the same 5-area framework but with current project state as input instead of fresh requirements.

**Why it's valuable:** Scope creep is the #1 silent project killer. A standalone command gives the user a button to press when they feel it happening.

**Complexity:** Low-medium. Most of the logic already exists in new-project Step 7.25 — needs extraction and adaptation for mid-project use.

---

### E. Research Phase Architect Depth (⭐)
**Status:** Not started
**Scope:** Enhance `research-phase.md` and `gsd-phase-researcher` behavior

**Current state:** Phase research produces RESEARCH.md with technical findings relevant to the phase.

**Proposed additions:**
- **Security threat modeling** — for phases involving user input, auth, data handling, or external integrations, research common attack vectors and how to defend
- **Scaling considerations** — for phases introducing new data patterns, research how they scale
- **Industry benchmarks** — what do similar features look like in production at scale? What metrics are typical?
- **Known pitfalls** — deeper research into "things that typically go wrong" for this type of feature
- **ADR-style decision surfacing** — when research reveals architectural decisions, surface them for explicit capture (feeds into ADR artifact above)

**Why it's valuable:** Current research is tactical (how to implement). Architect depth adds strategic context (what could go wrong, what does mature look like).

**Complexity:** Medium. Mostly prompt engineering for the researcher agent.

---

### F. Feature Flag / Deployment Strategy Artifact (Candidate)
**Status:** Idea stage, not committed
**Scope:** New artifact `.planning/DEPLOYMENT.md` or similar

**Rationale:** Zero-downtime deploys, feature flags, rollback strategies, environment promotion — these are as important as code quality but not currently captured anywhere. Could be a dedicated artifact or a section in APIS.md/OBSERVABILITY.md.

**Open question:** Does this deserve its own artifact, or should it live inside existing artifacts? TBD.

---

### G. Test Generation Enhancement (Candidate)
**Status:** Idea stage, not committed
**Scope:** Enhance `add-tests.md` workflow

**Rationale:** Current test generation is based on UAT criteria. Could be enhanced with:
- Automatic edge case test generation (from QA depth categories)
- Property-based testing suggestions for appropriate functions
- Mutation testing awareness
- Test smell detection (flaky patterns, over-mocking)

**Open question:** How much of this should be in workflow vs trusted to the implementation side? TBD.

---

## Process Learnings

Things we've learned about modifying this workflow system:

### 1. The Workflow File Is Just Instructions for Claude
Remember that these `.md` files are read by Claude at runtime and interpreted as prompts. They're not code. This means:
- Clarity matters more than brevity — Claude reads every word
- Examples are very effective — Claude mimics patterns
- MANDATORY/CRITICAL emphasis actually works — Claude respects hard gates
- Escape hatches need to be explicit — Claude won't invent them

### 2. Changes Compound
Adding the refactor-first principle in one place (execute-plan) was good. Adding it at discuss-phase, plan-phase, execute-plan, quick, and ui-phase was transformative. Consistency across workflow layers is what makes enhancements stick.

### 3. Standards Artifacts Create Cascading Value
Once SECURITY.md and APIS.md existed, every subsequent enhancement could reference them. The `.planning/` standards directory is becoming the project's institutional memory. Future enhancements should ask "does this belong in an existing artifact, or does it need a new one?"

### 4. Roles > Tasks
The most effective enhancements framed Claude as a specific role (engineer, designer, PM, QA) rather than adding tasks. Roles carry implicit depth that tasks don't.

### 5. Pressure Tests Beat Checklists
"Walk through every requirement and challenge it" is more effective than "Check these 10 boxes". The conversational probing surfaces real issues; checklists get rubber-stamped.

### 6. Opinionated Defaults > Neutral Framing
Saying "we hash passwords with bcrypt" is better than "decide on a password hashing algorithm". Opinionated defaults eliminate decision fatigue and establish a baseline. Users can override when they have a reason.

---

## Review Cadence

Recommended review cadence for this document:
- **After every enhancement** — Add a new Completed section with full detail
- **After every real-project usage** — Update Backlog priorities based on actual friction
- **Every few months** — Revisit Design Principles to see if new patterns have emerged

The goal is for this document to grow with the system and capture the thinking, not just the code changes.
