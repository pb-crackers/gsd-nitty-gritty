<purpose>
Update GSD by pulling this repo and reinstalling. The repo is the source of truth — there is
no package registry involved.
</purpose>

<required_reading>
@/Users/phillipdougherty/.claude/get-shit-done/references/communication.md
</required_reading>

<context>
GSD lives in a git repo (this one). `bin/install.cjs` puts its commands and agents where
Claude Code looks, either as symlinks back to the repo or as copies.

Two kinds of user run this command and they need opposite things:

- **Someone who cloned the repo.** Updating means pulling the maintainer's changes and
  reinstalling. This is the normal case.
- **The maintainer.** Their working copy IS the source. There is nothing upstream to pull
  from; if anything they are ahead of the remote. Telling them to "update" is wrong, and
  silently pulling could clobber unpushed work.

Tell them apart by looking at the repo, not by asking.
</context>

<process>

<step name="locate_repo">
Find the repo from this workflow file's own location — it is `../` from `workflows/`.

```bash
GSD_DIR="/Users/phillipdougherty/.claude/get-shit-done"
git -C "$GSD_DIR" rev-parse --show-toplevel 2>/dev/null
```

**If that fails,** GSD was installed some other way and this command cannot help:

> This copy of GSD isn't a git repo, so there's nothing to pull. Reinstall by cloning it:
> `git clone <repo-url> ~/.claude/get-shit-done && node ~/.claude/get-shit-done/bin/install.cjs`

Stop.
</step>

<step name="assess">
Gather the state in one pass:

```bash
cd "$GSD_DIR"
git remote get-url origin 2>/dev/null || echo "NO_REMOTE"
git status --porcelain | head -20
git rev-parse --abbrev-ref HEAD
git fetch --quiet origin 2>/dev/null && echo "FETCHED" || echo "FETCH_FAILED"
git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "NO_UPSTREAM"
```

`git rev-list --left-right --count` returns two numbers: commits you have that the remote
doesn't (**ahead**), and commits the remote has that you don't (**behind**).

Read them together and say plainly which situation the user is in:

| ahead | behind | dirty | What to say |
|---|---|---|---|
| 0 | 0 | no | Already up to date. Stop. |
| 0 | N | no | N updates available — go to `show_changes`. |
| N | 0 | — | They are the source of truth. Nothing to pull; offer to push instead. |
| N | M | — | Diverged — needs a human. Explain, don't attempt a merge. |
| — | — | yes | Uncommitted changes. Deal with those first — see below. |

**If `NO_REMOTE` or `NO_UPSTREAM`:** this is a local-only copy. Say so and stop — there is
nowhere to pull from, which is fine and not an error.

**If the working tree is dirty:** never pull over uncommitted work. Show what is modified and
ask what they want:
- "Commit them first" — they are the maintainer and these are real changes
- "Stash, pull, reapply" — they want the update and their edits back on top
- "Cancel"

**If ahead and not behind,** they maintain this fork. Say it in those terms rather than
reporting an error:

> You're ahead of the remote by [N] commits — this working copy is the source of truth, so
> there's nothing to update. Want me to push instead?
</step>

<step name="show_changes">
The commit log between here and the remote is the changelog. No separate file to maintain:

```bash
git -C "$GSD_DIR" log --oneline --no-merges HEAD..@{upstream}
git -C "$GSD_DIR" diff --stat HEAD..@{upstream} | tail -1
```

Summarize what actually changed in plain language — group by area (workflows, commands,
agents, tooling) rather than listing every commit subject. Then ask whether to pull.

Call out anything that will need attention after the pull: changes under `commands/` or
`agents/` mean a reinstall is required, which the next step handles.
</step>

<step name="pull_and_install">
```bash
cd "$GSD_DIR"
git pull --ff-only
```

`--ff-only` on purpose: if it cannot fast-forward, something needs a human and a silent merge
commit is the wrong answer. If it fails, report why and stop.

Then reinstall so new or renamed commands and agents land in the runtime:

```bash
node "$GSD_DIR/bin/install.cjs"
```

The installer detects nothing about the previous mode — if the user is on copies rather than
symlinks, pass `--copy`. Check first:

```bash
test -L "$HOME/.claude/commands/gsd" && echo "LINKED" || echo "COPIED"
```

Symlinked installs technically need no reinstall for edits to existing files, but a pull can
add files, so run it either way.
</step>

<step name="report">
Say what moved, in one short block. The version, what changed, and anything that needs the
user's attention:

```
GSD updated — [old version] → [new version]

[one line per area that changed]

[N] commands, [M] agents reinstalled.
```

If the pull touched `bin/gsd-tools.cjs` or `bin/lib/`, mention that the test suite exists and
offer to run it:

```bash
node "$GSD_DIR/test/run.cjs"
```
</step>

</process>

<success_criteria>
- [ ] Repo located, or the user told clearly that this install is not a git checkout
- [ ] Maintainer (ahead of remote) told they are the source, not told to update
- [ ] Uncommitted changes never pulled over
- [ ] Changes summarized in plain language before asking to pull
- [ ] `--ff-only`, with divergence handed to the user rather than merged silently
- [ ] `bin/install.cjs` re-run so new commands and agents reach the runtime
</success_criteria>
