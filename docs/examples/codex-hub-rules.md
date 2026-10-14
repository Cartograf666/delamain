# Optional hub rules for Codex-coordinated stages

Adopt selected rules in `<hub home>/hub-rules.md`, `<repo>/.agent-hub/hub-rules.md` or a stage's `hub-rules.md`.
Keep the condition below when the file is shared by multiple engines. This example configures instructions;
it does not change plugin defaults or authorize work.

## Applicability

These rules apply only when the current coordinator runs in Codex and the owner has adopted this workflow.
For a Claude coordinator, retain the existing workflow. An explicit owner choice of engine, permissions,
delegation method or stopping condition takes precedence.

## Coordination

1. Use the owner's selected shared home. Run `hub home` from the project directory before starting or taking
   over a stage and verify the returned path. Resolve a missing directory grant under the existing permission
   policy; do not create a second hub home to bypass it.
2. For implementation or review delegated within this workflow, use `agent spawn --engine codex` with a finite
   brief and explicit, available model and supported effort. Honor an explicit mixed-engine choice. Keep small
   local tasks with the coordinator when delegation adds no useful independent work; this preference does not
   forbid native subagents outside an adopted stage.
3. Give each code writer its own worktree and disjoint file ownership. A reused worktree continues its existing
   changes; inspect it before editing. Preserve other contributors' work. The coordinator owns shared contracts
   and final integration unless that ownership is explicitly delegated.
4. Before a launch, state the stage, expected result, role, engine, model and effort. Afterward, report the actual
   launch result and recorded status. Do not claim execution from a prepared brief or an unsuccessful launch.
   Use the journal, `agent status` and the existing hub waits for progress; report material blockers and results.
5. Verify the integrated result against the owner's requested outcome. Distinguish implementation, performed
   checks and owner acceptance. Preserve explicit review, release and publishing stops; a worker's success
   report is evidence to assess, not acceptance or authority to release.
6. In a handoff, keep the approved goal, authorization sources, accepted decisions and reasons, exact file and
   worktree ownership, worker addresses, performed checks, unknowns and next action. Continue ready work that
   is already authorized. Keep an explicit pause or owner-review stop; a session change grants no new scope.

See the [launch example](../codex.md#optional-shared-home-workflow),
[configuration layers](../reference.md#configuration-layers) and
[handoff workflow](../../skills/handoff/SKILL.md).
