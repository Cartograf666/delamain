"""Fail-safe wrapper for the plugin's hooks: whatever happens inside a hook, the harness gets a valid answer in time.

Claude Code 2.1.299 stopped letting an action through when a plugin hook cannot hand back its answer: a hook that
crashes, hangs past its `timeout` or prints half a JSON document now blocks the user's Bash and Edit calls (and withholds
the result of a tool that already ran). Every hook of this plugin is a guard that is meant to fail open, so each calls
`install()` first thing:

  - stdout is held back and written once at exit, and only if it is one complete JSON document; anything else (a crash
    after a partial print, a stray traceback line) is dropped, which reads as "no decision";
  - the exit status is always 0, whatever ended the process: an uncaught exception, an import error at module level,
    `sys.exit(1)`;
  - a timer answers "no decision" before the harness's own timeout (DEADLINES, seconds, 1.5 below the `timeout` of
    hooks/hooks.json and hooks/codex-hooks.json; tests/t_hook_failsafe.sh checks the two agree). A hook stuck on a
    stalled filesystem or an stdin that never closes is cut there, with one line on stderr naming the hook: a guard that
    gave up let the action through. $AGENT_HUB_HOOK_DEADLINE_S overrides it (the tests; a value outside (0, 60] is ignored).

A deliberate decision is not affected: a hook that printed its deny and then failed still delivers the deny.

The wrapper also keeps the durable record of those decisions: once a deny (or ask, or block) is delivered it appends
one line `{ts, hook, decision, reason, session, tag, program}` to `<state dir>/guard-decisions.jsonl` (the last
GUARD_LOG_CAP lines are kept). `program` is the basename of the command's first word after any VAR=value assignments:
no arguments and no assignment values are stored, so a secret on a command line never reaches the file. The record is written after the answer is out and is best effort: a write that fails or hangs
changes nothing for the guard.
"""
from __future__ import annotations

import atexit
import io
import json
import os
import re
import sys
import threading
import time

DEFAULT_DEADLINE_S = 8.5  # every `timeout` in the hook configs is 10 s
DEADLINES = {
    "board_locks.py": 8.5,  # timeout 10: a slow guard costs latency, never a skipped lock if it can be avoided
    "polling_guard.py": 8.5,
    "kill_guard.py": 8.5,
    "scan_guard.py": 8.5,
    "questions.py": 8.5,  # timeout 10
    "delegation.py": 8.5,
    "path_shadow.py": 8.5,
    "handoff_size.py": 8.5,
    "context_budget.py": 8.5,
    "session_cards.py": 8.5,
    "subagent_journal.py": 8.5,
}

GUARD_LOG_CAP = 5000  # lines kept in <state dir>/guard-decisions.jsonl
GUARD_LOG_MIN_LINE = 80  # bytes: a smaller file cannot hold GUARD_LOG_CAP lines, so it is not counted
REASON_CHARS = 120
STALE_TMP_S = 60
# VAR=value prefixes (quotes and escapes kept whole), then the program: only its basename is ever recorded
_ASSIGN = re.compile(r"\s*(?:[A-Za-z_]\w*=(?:\\.|\"(?:[^\"\\]|\\.)*\"|'[^']*'|[^\s\"'\\])*\s+)*([^\s;&|<>()]+)")

_state: dict = {}


class _TeeStdin:
    """The hook's stdin, remembered as it is read, so the decision record can name the command that was judged."""

    def __init__(self, real):
        self._real, self.read_text = real, []

    def _keep(self, chunk):
        if isinstance(chunk, str):
            self.read_text.append(chunk)
        return chunk

    def read(self, *args):
        return self._keep(self._real.read(*args))

    def readline(self, *args):
        return self._keep(self._real.readline(*args))

    def __iter__(self):
        for line in self._real:
            yield self._keep(line)

    def __getattr__(self, name):
        return getattr(self._real, name)


def deadline_s() -> float:
    default = DEADLINES.get(os.path.basename(sys.argv[0]), DEFAULT_DEADLINE_S)
    raw = os.environ.get("AGENT_HUB_HOOK_DEADLINE_S")
    if raw is None:
        return default
    try:
        value = float(raw)
        if 0 < value <= 60:
            return value
    except ValueError:
        pass
    print(f"delamain: AGENT_HUB_HOOK_DEADLINE_S={raw!r} is not a number of seconds in (0, 60]; using {default}", file=sys.stderr)
    return default


def _decision(answer) -> str | None:
    """deny / ask / block when the hook's answer is one, else None."""
    if not isinstance(answer, dict):
        return None
    out = answer.get("hookSpecificOutput")
    value = out.get("permissionDecision") if isinstance(out, dict) else None
    value = value or answer.get("decision")
    return value if value in ("deny", "ask", "block") else None


def _record(answer) -> None:
    """Append the decision to the capped guard-decisions.jsonl under the hub home's state dir. Never raises."""
    try:
        decision = _decision(answer)
        if decision is None:
            return
        tee = _state.get("stdin")
        try:
            event = json.loads("".join(tee.read_text)) if tee else {}
        except (ValueError, RecursionError):
            event = {}
        if not isinstance(event, dict):
            event = {}
        tool_input = event.get("tool_input")
        command = tool_input.get("command") if isinstance(tool_input, dict) else None
        match = _ASSIGN.match(command) if isinstance(command, str) else None
        raw = match.group(1) if match else ""
        program = "" if "=" in raw else os.path.basename(raw)  # `VAR=/x/secret ; cmd`: the assignment is no program
        if not re.fullmatch(r"[\w.+@-]{1,64}", program):
            program = event.get("tool_name") if isinstance(event.get("tool_name"), str) and not command else ""
        out = answer.get("hookSpecificOutput")
        reason = (out.get("permissionDecisionReason") if isinstance(out, dict) else None) or answer.get("reason") or ""
        reason = reason.splitlines()[0][:REASON_CHARS] if isinstance(reason, str) and reason.strip() else ""  # the headline: later lines can quote the command
        hook = os.path.basename(sys.argv[0]) + "".join(" " + a for a in sys.argv[1:2])
        record = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "hook": hook, "decision": decision, "reason": reason,
                  "session": event.get("session_id") if isinstance(event.get("session_id"), str) else "",
                  "tag": os.environ.get("HUB_TAG", ""), "program": program}
        root = os.environ.get("PLUGIN_ROOT") or os.environ.get("CLAUDE_PLUGIN_ROOT") or os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        sys.path.insert(0, os.path.join(root, "bin"))
        import hubcore  # noqa: E402

        hubcore.use_cwd(event.get("cwd"))  # the hub home of the session's directory, as the guards resolve it
        state = hubcore.state_dir()
        state.mkdir(parents=True, exist_ok=True)
        path = state / "guard-decisions.jsonl"
        line = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8", "replace")
        fd = os.open(path, os.O_RDWR | os.O_APPEND | os.O_CREAT, 0o600)
        try:
            size = os.fstat(fd).st_size
            if size and os.pread(fd, 1, size - 1) != b"\n":  # a torn line (short write) must not swallow this record
                line = b"\n" + line
            os.write(fd, line)  # one write: concurrent hooks do not interleave their lines
        finally:
            os.close(fd)
        if path.stat().st_size > GUARD_LOG_CAP * GUARD_LOG_MIN_LINE:
            lines = path.read_bytes().splitlines(keepends=True)
            if len(lines) > GUARD_LOG_CAP:
                for old in state.glob(".guard-decisions.*.tmp"):  # left by a trim that failed midway
                    try:
                        if time.time() - old.stat().st_mtime > STALE_TMP_S:
                            old.unlink()
                    except OSError:
                        pass
                tmp = path.with_name(f".guard-decisions.{os.getpid()}.tmp")
                try:
                    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                    with os.fdopen(fd, "wb") as out_file:
                        out_file.write(b"".join(lines[-GUARD_LOG_CAP:]))
                    os.replace(tmp, path)
                finally:
                    tmp.unlink(missing_ok=True)
    except BaseException:  # noqa: BLE001 — a lost record never changes what the guard decided
        pass


def _finish() -> None:
    """At exit: deliver a complete JSON answer, if there is one, record it, and leave with status 0."""
    real, buf = _state.get("stdout"), _state.get("buffer")
    answer = None
    try:
        sys.stdout = real
        text = buf.getvalue()
        if text.strip():
            answer = json.loads(text)  # a half-written document is no answer
            data = text.encode("utf-8", "replace")  # JSON is UTF-8 whatever the locale; a lone surrogate must not lose the answer
            if hasattr(real, "buffer"):
                real.flush()
                real.buffer.write(data)
                real.buffer.flush()
            else:
                real.write(text)
                real.flush()
            _state["delivered"] = True  # the deadline timer must not report a give-up for what is already out
    except BaseException:  # noqa: BLE001 — nothing is delivered, which means "no decision"
        pass
    if _state.get("delivered"):
        _record(answer)  # the timer is still armed: a hung write is cut at the deadline, the answer is already out
    timer = _state.get("timer")
    if timer is not None:
        timer.cancel()
    try:
        sys.stderr.flush()
    except BaseException:  # noqa: BLE001
        pass
    os._exit(0)


def _give_up() -> None:
    if _state.get("delivered"):
        os._exit(0)
    try:  # a guard that gave up lets the action through: leave a trace
        print(f"delamain: {os.path.basename(sys.argv[0])} gave up after {deadline_s():g} s: no decision", file=sys.stderr, flush=True)
    except BaseException:  # noqa: BLE001
        pass
    os._exit(0)  # the buffered output is dropped with the process


def install() -> None:
    """Arm the fail-safe for this hook process. Call once, before anything that can fail."""
    if _state:
        return
    _state["stdout"], _state["buffer"] = sys.stdout, io.StringIO()
    sys.stdout = _state["buffer"]
    if sys.stdin is not None:
        _state["stdin"] = sys.stdin = _TeeStdin(sys.stdin)
    timer = threading.Timer(deadline_s(), _give_up)
    timer.daemon = True
    timer.start()
    _state["timer"] = timer
    atexit.register(_finish)
