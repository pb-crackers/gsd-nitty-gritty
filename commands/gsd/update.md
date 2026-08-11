---
name: gsd:update
description: Pull the latest GSD changes from the repo and reinstall
allowed-tools:
  - Bash
  - AskUserQuestion
---

<objective>
Update GSD by pulling this repo and reinstalling its commands and agents.

GSD is a git repo, not an npm package — updating means `git pull` plus
`bin/install.cjs`, and the commit log is the changelog.

If your working copy is ahead of the remote, you are the source of truth and there is nothing
to update. The workflow detects that and offers to push instead.
</objective>

<execution_context>
@/Users/phillipdougherty/.claude/get-shit-done/workflows/update.md
</execution_context>

<process>
**Follow the update workflow** above.
</process>
