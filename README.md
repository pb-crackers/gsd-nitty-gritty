# GSD Nitty Gritty

### *Slow is smooth and smooth is fast.*

A fork of [Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) workflows for AI-assisted development, enhanced with opinionated engineering standards that prioritize **code quality, security, and maintainability** over raw output speed.

---

## The Problem

AI-generated code is actually pretty good. But left unchecked, AI code generation has two failure modes:

1. **Too much code** — Instead of refactoring existing code to handle a new case, AI tends to create new files, new abstractions, and new modules. The codebase inflates. Complexity compounds. Six months later, nobody knows which of the three validation utilities is the "real" one.

2. **Too little depth** — AI will happily scaffold an entire API in minutes, but skip input validation, write `SELECT *` queries, leave error handling as `catch (e) { throw e }`, and commit migrations that explode on re-run. The speed is impressive until production says hello.

## The Solution

GSD Nitty Gritty adds three enforcement mechanisms to the standard GSD workflow:

### 1. Refactor-First Hard Gate

Before writing new code, the AI must evaluate whether existing code can be modified instead. **The default answer is refactor. New code requires documented justification.**

This applies at both planning time (the planner must include a `<refactor_check>` on every task) and execution time (the executor must perform a refactor analysis before creating new files). A new deviation rule (Rule 5: Unnecessary Abstraction) catches new files or modules that duplicate existing code.

### 2. First-Principles Decomposition

When planning a phase, the AI must decompose the work into its fundamental engineering concerns before creating tasks. No more "Task 1: Build the API" — instead, each concern gets targeted attention:

- **Data Model** — schemas, migrations, relationships, constraints, idempotency
- **Security** — auth, input validation, data protection, CORS/CSRF
- **API Design** — endpoints, request/response shapes, versioning, error cases
- **Error Handling** — failure modes, error codes, user-facing messages, retry strategy
- **Testing** — unit vs integration vs E2E boundaries, test data strategy
- **Logging & Observability** — audit events, correlation IDs, sensitive field exclusion
- **Performance** — query efficiency, N+1 prevention, indexing, connection management
- **State Management** — state location, transitions, edge cases
- **UX & Accessibility** — interaction states, user flows, keyboard navigation, WCAG compliance

The planner must explicitly document which concerns were evaluated and which were skipped (with reasoning). A pure CSS task can skip the rate limiting analysis, but it has to say so.

**The discussion phase applies this same lens.** Before planning starts, `discuss-phase` classifies the phase (pure visual/UX vs engineering depth vs mixed) and for engineering depth phases, walks the user through gray areas with **trade-off analysis** — concrete pros/cons/recommendations grounded in existing code and scale expectations. Claude acts as a senior engineer at a whiteboard, not a multiple-choice moderator.

### 3. Living Project Standards

Five opinionated reference documents are generated per project and referenced throughout the development lifecycle:

| Document | What It Covers |
|----------|---------------|
| **SECURITY.md** | Auth patterns, input validation, transport security, CORS/CSRF, database security, secret management, dependency auditing, logging constraints |
| **APIS.md** | Versioning, naming conventions, request/response format, pagination, rate limiting, **data access patterns** (query efficiency, N+1 prevention, index-aware design, connection management), **migration safety** (idempotent SQL, zero-downtime patterns, reversibility) |
| **TESTING-STRATEGY.md** | Unit/integration/E2E boundaries, what not to test, coverage philosophy, test data strategy |
| **ERROR-HANDLING.md** | Error classification, error codes, user-facing messages, logging strategy, retry patterns, global error handling, validation error format |
| **DESIGN-SYSTEM.md** | WCAG 2.1 AA accessibility, mandatory interaction states (default/hover/focus/active/disabled/loading/error/success/empty), responsive strategy, user flow requirements (happy/error/empty/loading), component reuse, micro-interactions, typography/spacing/color tokens |

These are:
- **Generated** during project initialization with opinionated defaults tailored to the project's stack
- **Gated** at planning time (no phase gets planned without them)
- **Referenced** by planners, executors, and UI agents during every phase
- **Maintained** after execution when new patterns emerge

### 4. QA Engineer Depth in Verification

The standard GSD verification workflow extracts tests from phase summaries and walks the user through them. GSD Nitty Gritty adds a **systematic edge case expansion** step that thinks like a QA engineer:

For each phase, the verifier classifies what was built and appends targeted tests from these categories (skipping ones that don't apply):

- **Input Validation** — empty, whitespace, max length, unicode, injection attempts, invalid formats
- **State Transitions** — double-submit, concurrent edits, partial completion, invalid state operations
- **Boundaries** — empty collections, single items, exact page size, large datasets
- **Failure Modes** — offline, slow network, timeouts, 500 errors, partial responses
- **Accessibility** — keyboard-only navigation, screen reader, zoomed text, reduced motion, color contrast
- **Cross-Device** — mobile, tablet, desktop, touch vs mouse
- **Security** — unauthorized access, authorization bypass, session expiry, CSRF
- **Data Integrity** — refresh persistence, cross-device sync, delete verification
- **Performance** — perceived performance, large dataset handling, memory leak probes

**Quality over quantity.** Five well-chosen edge case tests beat fifty generic ones. The goal is to catch the bugs that would embarrass the team in production, not to verify every line of code.

---

## How It Integrates With GSD

This is a drop-in enhancement to the standard GSD workflow. The same commands work the same way — `/gsd:new-project`, `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:autonomous`, etc. The differences are in what happens *inside* those commands:

| Workflow Step | Standard GSD | Nitty Gritty |
|--------------|-------------|--------------|
| **Project Init** | PROJECT.md, REQUIREMENTS.md, ROADMAP.md | + SECURITY.md, APIS.md, TESTING-STRATEGY.md, ERROR-HANDLING.md, DESIGN-SYSTEM.md |
| **UI Phase** | 6-dimension UI-SPEC validation | + Mandatory DESIGN-SYSTEM.md compliance, all interaction states required, full user flow coverage (happy/error/empty/loading), WCAG 2.1 AA accessibility baseline |
| **Verify Work** | Tests extracted from phase summaries | + QA depth expansion: systematic edge case tests across input validation, state transitions, boundaries, failure modes, accessibility, cross-device, security, data integrity, performance |
| **Requirements** | Specific, testable, user-centric | + First-principles decomposition of each feature into engineering concerns |
| **Phase Planning** | Anti-shallow rules (read_first, acceptance_criteria) | + Refactor-first principle, first-principles decomposition template, standards artifact references, `<refactor_check>` field on every task |
| **Execution** | Deviation rules 1-4 | + Rule 5 (Unnecessary Abstraction), mandatory refactor analysis, standards compliance check, artifact maintenance |
| **Discussion** | Gray areas from phase analysis | + Gray areas informed by established project standards |
| **New Milestone** | Check project state | + Artifact existence gate (generates missing standards docs) |
| **Quick Tasks** | Planner + executor | + Standards artifact references, refactor-first constraints |

---

## Installation

Replace the standard GSD workflows directory with this repo:

```bash
# Back up your current workflows (if you want to keep them)
cp -r ~/.claude/get-shit-done ~/.claude/get-shit-done-backup

# Clone this repo
git clone https://github.com/pb-crackers/gsd-nitty-gritty.git ~/.claude/get-shit-done
```

Or if you already have GSD installed and just want to swap the workflows:

```bash
git clone https://github.com/pb-crackers/gsd-nitty-gritty.git /tmp/gsd-nitty-gritty
cp -r /tmp/gsd-nitty-gritty/workflows ~/.claude/get-shit-done/workflows
```

---

## Philosophy

More steps up front. Fewer fires later.

AI can generate a thousand lines of code in seconds. That's a superpower, but it's also a liability if those thousand lines are poorly structured, insecure, or duplicating logic that already exists three directories over.

GSD Nitty Gritty trades raw generation speed for engineering rigor. Every phase takes a little longer to plan because the AI has to think about security, error handling, query efficiency, and whether the code it's about to write actually needs to exist. But the result is a codebase that's smaller, more secure, more consistent, and easier to maintain.

**Slow is smooth and smooth is fast.**

---

## Credits

Built on top of [Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) by the GSD team.

---

## License

MIT
