<pm_lens>

Scope and hypothesis pressure-testing. **Not loaded by default** — `/gsd:new-project` offers
it at the end and reads this file only if the user accepts, so the ~3.6k tokens are spent
only when the work is actually going to happen.

Run it any time by asking for "the PM lens". It is worth re-running at a milestone boundary,
when scope has drifted, or when a project has stalled and nobody can say what it was betting
on.

**Before you start, check what already exists.** If PROJECT.md has a PM Validation section,
read it and treat this as a revision rather than a first pass — confirm what still holds
instead of re-asking it.

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
Add a brief note to PROJECT.md under "PM Validation" that the lens was skipped at user request, with the date. Done.

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

<scope_changed>
If the MVP Discipline step moved requirements from v1 to v2 **and a roadmap already exists**,
that roadmap was built from the old scope and is now stale. Say so plainly and offer to
regenerate it:

> Deferring [N] requirements to v2 means the roadmap I built covers work that is no longer in
> v1. I can regenerate it against the refined scope — phases would be rebuilt from what
> survived the pressure test. Want me to?

If yes, re-spawn `gsd-roadmapper` against the updated REQUIREMENTS.md and commit the result.
If no, note in STATE.md that the roadmap predates the PM lens, so the next reader knows.
</scope_changed>

</pm_lens>
