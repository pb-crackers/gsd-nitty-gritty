# Workflow Audit — 2026-08-11

An audit of `workflows/` against three goals: cut instruction weight, make the agent talk
like a person, and find what has gone stale. Numbers below are measured unless marked
*estimate*.

Companion to [ENHANCEMENTS.md](ENHANCEMENTS.md) — that file records intent behind changes
already made; this one records the case for a set of changes not yet made.

---

## 1. What it actually costs

The number that matters is not the size of `workflows/` (565 KB ≈ 141k tokens across 40
files). It is what a single command drags into the context window before doing any work. A
command file `@`-includes its workflow and templates, so the whole thing lands up front.

| Command | Instruction load before step 1 |
|---|---|
| `/gsd:new-project` | **37,613 tok** |
| `/gsd:new-milestone` | 19,447 tok |
| `/gsd:plan-phase` | 18,381 tok |
| `/gsd:verify-work` | 17,981 tok |
| `/gsd:autonomous` | 16,717 tok |
| `/gsd:discuss-phase` | 14,808 tok |
| `/gsd:quick` | 12,675 tok |
| `/gsd:execute-phase` | 10,528 tok |
| *median across all 38 commands* | *4,614 tok* |

`/gsd:new-project` spends roughly a fifth of a 200k window on instructions for itself. That
is the budget the actual project research, roadmap and questions have to share.

### Composition

| Category | Volume |
|---|---|
| Prose | ~85,000 tok |
| Illustrative output (unlabelled ``` fences) | **~27,200 tok (19%)** |
| `bash` fences | ~11,000 tok |
| Other labelled fences | ~10,800 tok |

---

## 2. Finding: examples are the single largest reducible block

19% of all workflow text is illustrative output — sample transcripts, sample analyses,
sample file layouts. This made sense when models needed to be shown the shape of an answer.
It is now the clearest case of paying for something the model already knows.

The pattern is not one example, it is four. `discuss-phase.md` teaches "generate
phase-specific gray areas, not generic categories" with four worked domains (auth, photo
library, backup CLI, API docs) at lines 86–97 — then teaches the same lesson again with
three more worked domains at lines 555–577. Seven examples for one idea.

**Recommendation.** One example per idea, kept where the idea is genuinely
counter-intuitive; delete the rest. Keep examples that encode a *format contract*
(the `<decisions>` block another agent parses); delete examples that merely illustrate good
judgement.

*Estimate: 10–14k tokens across the corpus, concentrated in the five largest files.*

---

## 3. Finding: mechanical repetition

Measured, all of it removable with no behaviour change:

| Item | Cost |
|---|---|
| ~~Tool path written out in full, 147×~~ — **not recoverable, see below** | ~~2,300 tok~~ |
| Repeated named steps (`offer_next`, `initialize`, `init_context`, `git_commit`, `update_state`…) | ~5,600 tok |
| Box-drawing banner art, 77 lines | ~2,100 tok |
| `if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi` — 52 occurrences in 26 files | ~600 tok |

The `@file:` line is worth calling out: it is boilerplate in every workflow that exists only
because `output()` in `core.cjs` spills payloads over 50 KB to a tmpfile. That is the
tool's problem and it should be solved once in the tool, not restated 52 times in prose.

**Correction — the `GSD=` variable does not work.** Tested after writing this: shell state
does not persist between Bash tool calls, so a variable set in one fenced block is empty in
the next. Every block needs the literal path regardless. Measured what survives: only 7
blocks use the path twice or more, worth ~91 tokens total. The 147 repetitions are the cost
of the tool not being on `PATH`, and the only real fix is an installed shim — a change to
the installer, not to the workflows. **Dropped from the plan.**

**Recommendation (revised).** Replace banner art with a sentence; extract the
genuinely-identical steps into `references/` and `@`-include them. Leave the path alone.
The `@file:` boilerplate is ~600 tokens and is a symptom of `output()` spilling over the
50 KB Bash buffer — worth fixing in `core.cjs` on its own merits, not for the token count.

*Estimate: ~7k tokens, near-zero risk.*

---

## 4. Finding: the communication problem is a structure problem, not a missing rule

This is goal 2, and the diagnosis is not what I expected: **the right instruction already
exists and is well written.** `discuss-phase.md` lines 543–551 say it plainly —

> *The user is not a multiple-choice test taker — they're a product owner who needs to
> understand the consequences. Showing them "Option A vs Option B" without context forces
> them to either trust you blindly or ask "what's the difference?".*

Three structural problems stop that instruction from landing:

**It arrives at line 507 of a 988-line file.** By the time the model reaches it, it has read
500 lines of procedure. Guidance about *how to talk* has to precede the procedure, not be
buried mid-way through it.

**It is gated behind a classification.** Lines 331–351 make the model first decide whether
the phase has "engineering depth" — and the plain-English trade-off treatment applies only
if it does. A pure visual phase falls through to bare option lists. The user asked for plain
English *always*, and the gate is what prevents that. The gate should go.

**The prescribed format is not plain English.** The template it asks for is symbol-dense:

```
**Option A: [name]**
- ✓ [concrete pro]
- ✗ [concrete con]
- **Affects:** [downstream impact]
```

That is a spec sheet. It also instructs "Present ALL engineering trade-offs up front", which
produces a wall of structured text — the opposite of "plain language first, specifics on
request".

**Recommendation.** One short `references/communication.md`, `@`-included by every
workflow, replacing the scattered presentation rules (29 in `discuss-phase.md` alone, 37 in
`autonomous.md`). Draft:

> **Lead in plain language. Get technical when asked.**
>
> When presenting a decision, say four things in prose, in this order:
> 1. **What the choice is**, in a sentence a non-engineer would follow.
> 2. **Why it matters** — what it affects that the user can feel: speed, cost, what breaks
>    later, what becomes hard to change.
> 3. **The options**, each with its real trade-off in plain words. No symbol tables.
> 4. **What you'd pick and why.**
>
> Name the concrete thing, not the category: "the page would take about a second longer to
> load" beats "performance implications". Jargon is allowed only after it has been earned
> by a plain-English sentence next to it.
>
> Do not front-load every trade-off. Give the short version and offer the detail:
> *"I can go deeper on any of these."* Depth on request, not by default.

*Estimate: ~4k tokens saved, and this is the change with real quality upside rather than
just speed.*

---

## 5. Finding: `--auto` is threaded through everything

`discuss-phase.md` carries 15 separate `--auto` branches, one inside nearly every step
("**If `--auto`:** auto-select…"). Each step therefore has to be read twice — once for the
interactive path, once for the automated one — by a model that is only ever running one of
them.

**Recommendation.** State the auto-mode rule once at the top ("in `--auto`, take the
recommended option at every decision, log it, never call AskUserQuestion") and delete the
per-step restatements.

*Estimate: 2–3k tokens across `discuss-phase`, `plan-phase`, `autonomous`, `quick`.*

---

## 6. Finding: command files restate their workflow

`~/.claude/commands/gsd/discuss-phase.md` contains a 9-item `<process>` list and a set of
"CRITICAL" rules that the workflow it `@`-includes already covers in detail. Two statements
of the same procedure is one more than needed, and the short one adds no information the
long one lacks.

**Recommendation.** Command files keep frontmatter, `<objective>`, argument contract and the
`@`-includes. The procedure lives in the workflow only.

*Estimate: ~2k tokens.*

---

## 7. What is NOT stale (checked, leave alone)

Worth recording so nobody spends time here:

- **Model profiles** (`bin/lib/model-profiles.cjs`) use bare aliases — `opus`, `sonnet`,
  `haiku`, `fable` — which resolve to current models. No pinned or dated model IDs anywhere.
- **`Task()` calls.** 23 across 8 files, and all the ones inspected are legitimate subagent
  spawns (`gsd-phase-researcher`, `gsd-planner`, `gsd-plan-checker`). The `Skill()`
  migration noted in `discuss-phase.md:932` was specifically about *workflow chaining*
  causing nesting freezes (#686); it does not apply to these and they should stay.
- **The `<step name="…">` structure itself.** It is doing real work — it gives the model
  resumable checkpoints and gives `resume-work` something to point at. Condense the contents,
  keep the skeleton.

---

## 8. Proposed sequence

Ordered so each commit stands alone and the risky ones come last, after the mechanical wins
have proven nothing broke.

| # | Change | Risk | Est. saving |
|---|---|---|---|
| 1 | ~~`GSD=` variable~~ — dropped, shell state does not persist between calls | — | ~~3k~~ |
| 2 | Delete banner art, replace with sentences | none | ~2k |
| 3 | Extract identical repeated steps to `references/` | low | ~5k |
| 4 | `references/communication.md` + delete scattered presentation rules | low | ~4k |
| 5 | Remove the engineering-depth gate on plain-English treatment | low | — |
| 6 | Collapse `--auto` branches to one block per workflow | low | ~2.5k |
| 7 | Command files stop restating workflow procedure | low | ~2k |
| 8 | Example cull, one per idea, five largest files first | **medium** | ~10–14k |

Total *estimate*: **25–29k tokens**, roughly 18–21% of the corpus, concentrated in the
commands that cost the most today. `/gsd:new-project` should land near 26–28k.

Step 8 is medium risk because judging which example carries a format contract and which is
decorative requires reading each one in context. It should be one commit per file, not one
sweeping commit.

### How to tell if it worked

There is no test suite for prose. Two checks worth running per commit:

1. **Re-measure.** The per-command table in §1 is a script; regenerate it and record the
   delta in the commit message.
2. **Exercise one real command end to end** against a disposable `.planning/` copy —
   `/gsd:discuss-phase` for the communication changes, since that is where regressions in
   tone would show up first.
