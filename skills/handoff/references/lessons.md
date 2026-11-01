# § 7 Lessons of this shift

Read this when the draft has a `## 7. Lessons of this shift` (the hub home's `AGENT_HUB_HANDOFF_LESSONS` is on). At a
handoff your context still holds the whole shift; after it that is gone and the journal keeps only events. A lesson is
what you would tell the next hub about how to work, with the moment it rests on.

## Procedure

1. Open `<hub home>/<stage>/lessons.md` (the draft prints the path; create it if absent). It is kept across handoffs —
   never delete it with them. You edit it by hand; there is no command. The takeover digest reads it and lists what to act on
   (below).
2. Judge the lessons listed under "Open lessons to judge". For each that actually acted in your shift, append a
   `verdict:` line (below). A lesson that did not come up gets none.
3. Write 0–3 new entries. "No lesson" is a valid answer: write `none: <reason>` in § 7. A lesson without `evidence`
   is not written.
4. Fill § 7 of the draft: the new ids (or `none: <reason>`) and the verdicts (or `none`). Never carry § 7 over from an
   earlier handoff, and never answer "module not used": with the setting on, the look back is due every shift.
   `hub handoff --finish`, `hub succeed --handoff` and the successor's `hub takeover` warn — never refuse — when § 7
   is missing, still holds `TODO`, or names neither a lesson id nor `none: <reason>`.

## Entry format

```markdown
## L-001 — <cue: when the lesson applies, one line>
- status: proposed        (you write only this, and later `promoted: <file> DATE` or `retired: DATE hub-N — reason`)
- by: hub-3, 2026-10-22
- lesson: one or two sentences, an instruction the next hub can follow
- evidence: the moment it rests on — a journal line (time + tag), an MR/PR, an ask id, a session id
- confidence: low | medium | high
- verdict: hub-4 2026-10-23 helped — evidence     (appended by later shifts; repeatable)
- verdict (L-001, hub-4 2026-10-23): helped — evidence    (a verdict on another entry: its id in the parentheses)
```

Ids run on from the last one in the file. An id is `L-<digits>` (`L-007`) or carries the stage's prefix, as ask ids do
(`L-MC-005`): `L-<LETTERS>-<digits>`, capitals only. The check of § 7 accepts both and takes either as an answer. A verdict is `helped | hurt | no effect | confounded`; use `confounded` when
something else changed in the same shift and you cannot tell.

## What a verdict does

The hub derives the status from the verdict lines (`hub takeover` reads them; nobody keeps it by hand). A shift is the
`hub-N` of the verdict line, so several verdicts of one shift count once.

| verdicts | effect |
|---|---|
| `helped` from 2 different shifts, no `hurt` | promotable: the digest lists "promotable: L-… (helped ×N)" |
| any `hurt` | retired: it leaves "Open lessons to judge" |
| `no effect`, `confounded`, `ignored`, or two words in one verdict | counts for nothing |

## Promoting a lesson

When the takeover digest lists promotable lessons, promote each yourself before planning; it does not go to the owner.

1. A lesson a tool could catch (a hook, a script, a check in `hub`) is not a prose rule. Put a pointer in the plugin
   backlog instead: an entry in the plugin repository's `ROADMAP.md` or a GitHub issue, naming the lesson and its
   evidence. Replace the entry's `- status:` line with
   `- status: promoted: backlog <entry or issue URL> DATE`.
2. Any other lesson becomes one line in the stage's `<hub home>/<stage>/hub-rules.md`, in the section
   `## Promoted lessons` (create it): the instruction, with its cue, and the source id, e.g.
   `- Before briefing an executor, say "stop at DONE, do not wait for CI" (L-002, lessons.md)`. Replace the entry's
   `- status:` line with `- status: promoted: hub-rules.md DATE` (only the first `- status:` line counts). The
   `handoff_size` hook refuses a section over 2 KiB: when it is full, retire the line that acts least or merge two,
   never lengthen a line.
3. Journal it with `jlog` (the id and where it went).

A promoted lesson keeps its entry. If a later shift gives it a `hurt` verdict, the digest lists it under "promoted but
hurt": delete its line from `hub-rules.md` (or the backlog entry), replace its `- status:` line with `retired: DATE hub-N — reason`, and journal it. A
`hurt` on any other lesson needs no edit.

## Writing a good lesson

- The cue says WHEN: a situation the next hub can recognise ("before merging a PR that touches the lock board"), not a
  topic.
- The lesson is an instruction the next hub can follow, not a description of what happened.
- The evidence is a pointer, not a story: a journal line (time and tag), an MR/PR, an `ask` id, a session id.
- If it would read "be more careful" or "check more", it is not a lesson; leave it out.
- When the lesson is mechanical (the same slip can be caught by a check), prefer a hook, a script or a skill change
  over a prose rule: put it in the plugin backlog and write the lesson as a pointer to that.
