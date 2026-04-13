<purpose>
Surface Claude's assumptions about a phase before planning, enabling users to correct misconceptions early.

Key difference from discuss-phase: This is ANALYSIS of what Claude thinks, not INTAKE of what user knows. No file output - purely conversational to prompt discussion.
</purpose>

<process>

<step name="validate_phase" priority="first">
Phase number: $ARGUMENTS (required)

**If argument missing:**

```
Error: Phase number required.

Usage: /gsd:list-phase-assumptions [phase-number]
Example: /gsd:list-phase-assumptions 3
```

Exit workflow.

**If argument provided:**
Validate phase exists in roadmap:

```bash
cat .planning/ROADMAP.md | grep -i "Phase ${PHASE}"
```

**If phase not found:**

```
Error: Phase ${PHASE} not found in roadmap.

Available phases:
[list phases from roadmap]
```

Exit workflow.

**If phase found:**
Parse phase details from roadmap:

- Phase number
- Phase name
- Phase description/goal
- Any scope details mentioned

Continue to analyze_phase.
</step>

<step name="analyze_phase">
Before listing assumptions, detect which standards artifacts exist — they shape several assumption categories below.

```bash
SECURITY_EXISTS=$(test -f .planning/SECURITY.md && echo "true" || echo "false")
APIS_EXISTS=$(test -f .planning/APIS.md && echo "true" || echo "false")
TESTING_STRATEGY_EXISTS=$(test -f .planning/TESTING-STRATEGY.md && echo "true" || echo "false")
ERROR_HANDLING_EXISTS=$(test -f .planning/ERROR-HANDLING.md && echo "true" || echo "false")
DESIGN_SYSTEM_EXISTS=$(test -f .planning/DESIGN-SYSTEM.md && echo "true" || echo "false")
```

Read each existing artifact so the analysis below can ground its standards-related assumptions in actual documented policies.

Based on roadmap description and project context, identify assumptions across six areas:

**1. Technical Approach:**
What libraries, frameworks, patterns, or tools would Claude use?
- "I'd use X library because..."
- "I'd follow Y pattern because..."
- "I'd structure this as Z because..."

**2. Implementation Order:**
What would Claude build first, second, third?
- "I'd start with X because it's foundational"
- "Then Y because it depends on X"
- "Finally Z because..."

**3. Scope Boundaries:**
What's included vs excluded in Claude's interpretation?
- "This phase includes: A, B, C"
- "This phase does NOT include: D, E, F"
- "Boundary ambiguities: G could go either way"

**4. Risk Areas:**
Where does Claude expect complexity or challenges?
- "The tricky part is X because..."
- "Potential issues: Y, Z"
- "I'd watch out for..."

**5. Dependencies:**
What does Claude assume exists or needs to be in place?
- "This assumes X from previous phases"
- "External dependencies: Y, Z"
- "This will be consumed by..."

**6. Standards Compliance:**
What is Claude assuming about how this phase maps onto the project's documented standards? Surface these assumptions explicitly — they're the most expensive class of misunderstanding to catch late.

For each existing standards artifact, surface phase-specific assumptions:

- **SECURITY.md** (if present): "I'm assuming the new endpoint(s) use the existing auth middleware pattern from SECURITY.md…", "I'm assuming session token handling follows the documented expiry policy…", "I'm assuming inputs are sanitized via the documented helper…"
- **APIS.md** (if present): "I'm assuming the new endpoint follows the documented pagination strategy (cursor vs LIMIT/OFFSET)…", "I'm assuming migrations use the documented idempotent guard pattern…", "I'm assuming queries use existing indexes per the documented data-access rules…"
- **TESTING-STRATEGY.md** (if present): "I'm assuming tests will run against real dependencies per the no-mocks rule (no mocks of owned code; only acceptable mock boundaries are external paid APIs without sandbox, clock, RNG)…", "I'm assuming the unit/integration/E2E split follows the documented boundaries…"
- **ERROR-HANDLING.md** (if present): "I'm assuming new error paths emit correlation IDs per the documented logging policy…", "I'm assuming retries use the documented exponential-backoff parameters…", "I'm assuming user-facing errors follow the documented format…"
- **DESIGN-SYSTEM.md** (if present): "I'm assuming new interactive elements implement all required interaction states per DESIGN-SYSTEM.md (default/hover/focus/active/disabled/loading/error/empty)…", "I'm assuming a11y compliance at the documented WCAG level with documented contrast ratios and touch-target sizes…"

For each artifact that does NOT exist, flag the absence as an assumption itself:
- "No SECURITY.md exists — I'll apply general security best practices, but the project lacks an authoritative auth/session/CSRF policy. Recommend generating SECURITY.md before this phase ships."
- "No TESTING-STRATEGY.md exists — I'll apply the GSD default no-mocks philosophy unless overridden. Recommend generating TESTING-STRATEGY.md to lock the testing posture."
- (etc.)

Be honest about uncertainty. Mark assumptions with confidence levels:
- "Fairly confident: ..." (clear from roadmap)
- "Assuming: ..." (reasonable inference)
- "Unclear: ..." (could go multiple ways)
</step>

<step name="present_assumptions">
Present assumptions in a clear, scannable format:

```
## My Assumptions for Phase ${PHASE}: ${PHASE_NAME}

### Technical Approach
[List assumptions about how to implement]

### Implementation Order
[List assumptions about sequencing]

### Scope Boundaries
**In scope:** [what's included]
**Out of scope:** [what's excluded]
**Ambiguous:** [what could go either way]

### Risk Areas
[List anticipated challenges]

### Dependencies
**From prior phases:** [what's needed]
**External:** [third-party needs]
**Feeds into:** [what future phases need from this]

### Standards Compliance
**Per existing standards artifact:**
- SECURITY.md → [phase-specific assumptions about auth/session/CSRF/etc., or "artifact absent — applying general best practices"]
- APIS.md → [phase-specific assumptions about pagination/validation/migrations/etc., or "artifact absent"]
- TESTING-STRATEGY.md → [phase-specific assumptions about test approach + no-mocks rule, or "artifact absent — applying GSD default no-mocks fallback"]
- ERROR-HANDLING.md → [phase-specific assumptions about error paths/logging/retries, or "artifact absent"]
- DESIGN-SYSTEM.md → [phase-specific assumptions about interaction states/a11y/breakpoints, or "artifact absent"]

**Standards artifacts absent that this phase suggests should exist:** [list with recommendation to generate]

---

**What do you think?**

Are these assumptions accurate? Let me know:
- What I got right
- What I got wrong
- What I'm missing
```

Wait for user response.
</step>

<step name="gather_feedback">
**If user provides corrections:**

Acknowledge the corrections:

```
Key corrections:
- [correction 1]
- [correction 2]

This changes my understanding significantly. [Summarize new understanding]
```

**If user confirms assumptions:**

```
Assumptions validated.
```

Continue to offer_next.
</step>

<step name="offer_next">
Present next steps:

```
What's next?
1. Discuss context (/gsd:discuss-phase ${PHASE}) - Let me ask you questions to build comprehensive context
2. Plan this phase (/gsd:plan-phase ${PHASE}) - Create detailed execution plans
3. Re-examine assumptions - I'll analyze again with your corrections
4. Done for now
```

Wait for user selection.

If "Discuss context": Note that CONTEXT.md will incorporate any corrections discussed here
If "Plan this phase": Proceed knowing assumptions are understood
If "Re-examine": Return to analyze_phase with updated understanding
</step>

</process>

<success_criteria>
- Phase number validated against roadmap
- Assumptions surfaced across five areas: technical approach, implementation order, scope, risks, dependencies
- Confidence levels marked where appropriate
- "What do you think?" prompt presented
- User feedback acknowledged
- Clear next steps offered
</success_criteria>
