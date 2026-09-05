---
description: Run (or resume) the planner -> builder -> critic dev loop for BetterByTheBlock
argument-hint: [optional project brief — defaults to a self-survey of the app for the next round of improvements]
---

Drive one full cycle of the BetterByTheBlock planner/builder/critic loop
using the `planner`, `builder`, and `critic` subagents defined in
`/Users/connorbolin/neighborhoodnest/.claude/agents/`. You (the current
session) are the orchestrator — the three subagents never talk to each
other directly, everything routes through you.

State lives in `/Users/connorbolin/neighborhoodnest/.claude/dev-loop-state.json`,
shaped like:
```json
{
  "brief": "the brief this backlog was planned from",
  "sprints": [
    {
      "name": "...",
      "goal": "...",
      "acceptance_criteria": "...",
      "status": "pending | in_progress | approved | blocked",
      "attempts": 0,
      "last_feedback": null
    }
  ]
}
```

## Steps

1. **Load or create the backlog.**
   - Read the state file if it exists.
   - If it doesn't exist, or every sprint in it is `"approved"` (backlog
     exhausted — time for the next round), generate a fresh one: invoke
     the `planner` subagent with the brief `$ARGUMENTS` (if the user
     passed one after `/dev-loop`) or, if empty, no explicit brief at all
     — the planner defaults to self-surveying the app. Parse its JSON
     response into a new `sprints` array, each entry starting at
     `status: "pending"`, `attempts: 0`, `last_feedback: null`. Write the
     new state file (overwriting any fully-approved prior backlog).
   - Tell the user the sprint plan you're about to run (names + goals,
     one line each) before starting work.

2. **Find the active sprint** — the first entry whose `status` is not
   `"approved"` and not `"blocked"`. If none remain, report the backlog
   complete and stop (don't auto-generate a new one without being asked
   again — let the user decide whether to re-run `/dev-loop`).

3. **Build.** Invoke the `builder` subagent with that sprint's `goal` and
   `acceptance_criteria`. If `last_feedback` is set (a prior critic pass
   failed), include it verbatim and tell the builder it's required
   feedback from the previous attempt, not a suggestion. Set the sprint's
   `status` to `"in_progress"` and increment `attempts` before dispatching.

4. **Critique.** Invoke the `critic` subagent with the same
   `acceptance_criteria`. Pass along nothing else — the critic re-derives
   everything else itself from the current code.

5. **Branch on the critic's verdict:**
   - `APPROVED` → set `status: "approved"`, clear `last_feedback`, print a
     one-line summary of what shipped this sprint, update the state file,
     go back to step 2 for the next sprint.
   - `CHANGES_NEEDED: ...` → store the feedback in `last_feedback`. If
     `attempts < 3`, set `status` back to `"pending"` and go back to step 3
     to retry the same sprint with that feedback. If `attempts >= 3`, set
     `status: "blocked"`, stop the loop, and report the sprint name, goal,
     and the critic's last feedback to the user — this needs a human, not
     another automatic retry.

6. Keep looping through sprints until the backlog is exhausted or a sprint
   gets blocked. It's fine — expected, even — to stop between sprints and
   let the user resume later with `/dev-loop`; the state file makes this
   fully resumable, so don't feel pressure to push through an entire
   multi-sprint backlog in one uninterrupted run if it's running long.

Report progress as you go (which sprint you're on, build vs. critique,
pass/fail) rather than going silent for the whole loop — this runs several
subagents back to back and the user should be able to see where it is.
