# Model Profiles

Model profiles control which Claude model each GSD agent uses. This allows balancing quality vs token spend, or inheriting the currently selected session model.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` | `max` | `inherit` |
|-------|-----------|------------|----------|-------|-----------|
| gsd-planner | opus | opus | sonnet | opus | inherit |
| gsd-roadmapper | opus | sonnet | sonnet | opus | inherit |
| gsd-executor | opus | sonnet | sonnet | fable | inherit |
| gsd-phase-researcher | opus | sonnet | haiku | opus | inherit |
| gsd-project-researcher | opus | sonnet | haiku | opus | inherit |
| gsd-research-synthesizer | sonnet | sonnet | haiku | sonnet | inherit |
| gsd-debugger | opus | sonnet | sonnet | opus | inherit |
| gsd-codebase-mapper | sonnet | haiku | haiku | sonnet | inherit |
| gsd-verifier | sonnet | sonnet | haiku | sonnet | inherit |
| gsd-plan-checker | sonnet | sonnet | haiku | sonnet | inherit |
| gsd-integration-checker | sonnet | sonnet | haiku | sonnet | inherit |
| gsd-nyquist-auditor | sonnet | sonnet | haiku | sonnet | inherit |
| gsd-ui-researcher | opus | sonnet | haiku | opus | inherit |
| gsd-ui-checker | sonnet | sonnet | haiku | sonnet | inherit |
| gsd-ui-auditor | sonnet | sonnet | haiku | sonnet | inherit |

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- Opus only for planning (where architecture decisions happen)
- Sonnet for execution and research (follows explicit instructions)
- Sonnet for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal Opus usage
- Sonnet for anything that writes code
- Haiku for research and verification
- Use when: conserving quota, high-volume work, less critical phases

**max** - Highest-capability models for the build loop
- Fable 5 for execution only (gsd-executor)
- Opus for planning, roadmapping, debugging, and research/design agents
- Sonnet for read-only verification
- Use when: you want the strongest possible outputs for planning and execution and quota is not a concern

**inherit** - Follow the current session model
- All agents resolve to `inherit`
- Best when you switch models interactively (for example OpenCode `/model`)
- Use when: you want GSD to follow your currently selected runtime model

## Resolution Logic

Orchestrators resolve model before spawning:

```
1. Read .planning/config.json
2. Check model_overrides for agent-specific override
3. If no override, look up agent in profile table
4. Pass model parameter to Task call
```

## Per-Agent Overrides

Override specific agents without changing the entire profile:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

Overrides take precedence over the profile. Valid values: `opus`, `sonnet`, `haiku`, `fable`, `inherit`.

## Switching Profiles

Runtime: `/gsd:set-profile <profile>`

Per-project default: Set in `.planning/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Design Rationale

**Why Opus for gsd-planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for gsd-executor?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for gsd-codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.

**Why `inherit` instead of passing `opus` directly?**
Claude Code's `"opus"` alias maps to a specific model version. Organizations may block older opus versions while allowing newer ones. GSD returns `"inherit"` for opus-tier agents, causing them to use whatever opus version the user has configured in their session. This avoids version conflicts and silent fallbacks to Sonnet.

**Why `inherit` profile?**
Some runtimes (including OpenCode) let users switch models at runtime (`/model`). The `inherit` profile keeps all GSD subagents aligned to that live selection.
