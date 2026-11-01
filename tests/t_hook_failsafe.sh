#!/bin/bash
# Claude Code 2.1.299 blocks the action when a plugin hook cannot hand back its answer (it crashes, times out, prints
# half a document). hooks/failsafe.py makes every hook of the plugin answer "no decision" instead. Controls:
#   positive - malformed input to every hook: exit 0 and empty or complete JSON, never a traceback status;
#              a deliberate deny survives a crash after it; the deadlines sit below the configured timeouts
#   negative - the same hooks WITHOUT the fail-safe (a copy of the plugin with the install call removed) do crash, so
#              the controls can fail
. "$(dirname "$0")/lib.sh"
new_home; R=$AGENT_HUB_HOME; mkdir -p "$R"
python3 - "$T/.." "$R" <<'PY'
import json, os, shutil, subprocess, sys, time
from pathlib import Path

ROOT, WORK = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
fail = 0


def check(ok, what):
    global fail
    print(("PASS " if ok else "FAIL ") + what)
    fail |= 0 if ok else 1


HOOKS = [("questions.py", []), ("delegation.py", ["session-start"]), ("delegation.py", ["prompt"]),
         ("delegation.py", ["pre-tool"]), ("path_shadow.py", []), ("board_locks.py", []), ("polling_guard.py", []), ("kill_guard.py", []), ("scan_guard.py", []),
         ("handoff_size.py", []), ("context_budget.py", []),
         ("session_cards.py", ["session-start"]), ("session_cards.py", ["pre-tool"]),
         ("subagent_journal.py", ["start"]), ("subagent_journal.py", ["stop"])]
deep = b"[" * 60000 + b"]" * 60000
INPUTS = {
    "empty": b"", "garbage": b"not json", "list": b"[]", "null": b"null", "string": b'"x"',
    "tool_input is a string": b'{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":"x"}',
    "command is a number": b'{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":123},"cwd":"/"}',
    "nested 60000 deep": deep,
    "tool_input nested 60000 deep": b'{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls","x":' + deep + b"}}",
    "invalid UTF-8": b'\xff\xfe{"a":1}',
    "lone surrogate in the command": b'{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo \\ud800 gh pr merge 1"},"cwd":"/"}',
    "fields of the wrong type": b'{"hook_event_name":"PreToolUse","cwd":5,"session_id":7,"tool_name":"Write","tool_input":{"file_path":7,"content":9}}',
    "edit of a missing handoff": b'{"hook_event_name":"PreToolUse","cwd":"/nonexistent/x","tool_name":"Edit","tool_input":{"file_path":"/nonexistent/HANDOFF-x.md","old_string":"a","new_string":"b"}}',
    "3 MB input": b'{"hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"/tmp/x","content":"' + b"a" * 3_000_000 + b'"}}',
    "prompt is an object": b'{"hook_event_name":"UserPromptSubmit","session_id":"s","cwd":"/","prompt":{"a":[1]}}',
}


def env_for(plugin_root):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("HUB_", "CLAUDE_", "CODEX_", "PLUGIN_ROOT", "AGENT_HUB_HOOK"))}
    env.update(AGENT_HUB_HOME=str(WORK / "hub"), AGENT_HUB_TZ="UTC")
    return env


def run(plugin_root, hook, args, data, env=None, timeout=30):
    return subprocess.run([sys.executable, str(plugin_root / "hooks" / hook), *args], input=data, capture_output=True,
                          env=env or env_for(plugin_root), timeout=timeout)


def answered(r):
    """Exit 0 and either nothing or one complete JSON object."""
    if r.returncode != 0:
        return False
    if not r.stdout.strip():
        return True
    try:
        return isinstance(json.loads(r.stdout), dict)
    except ValueError:
        return False


# -- positive: malformed input never costs the user a tool call
bad = [f"{h} {' '.join(a)} / {name}: exit {r.returncode}, {r.stdout[:60]!r}"
       for h, a in HOOKS for name, data in INPUTS.items() for r in [run(ROOT, h, a, data)] if not answered(r)]
check(not bad, f"every hook answers every malformed input with exit 0 and no output or one JSON object ({len(HOOKS) * len(INPUTS)} runs)" + (f": {bad[:3]}" if bad else ""))
bad = [f"{h} {' '.join(a)}" for h, a in HOOKS
       if not answered(subprocess.run([sys.executable, str(ROOT / "hooks" / h), *a], stdin=subprocess.DEVNULL, capture_output=True, env=env_for(ROOT), timeout=30))]
check(not bad, "every hook copes with a stdin that is /dev/null" + (f": {bad}" if bad else ""))


# -- a copy of the plugin to break: bin/ is shared, hooks/ is copied
def plugin_copy(name, install=True):
    root = WORK / name
    (root / "hooks").mkdir(parents=True)
    for f in (ROOT / "hooks").glob("*.py"):
        text = f.read_text()
        if not install:
            text = text.replace("failsafe.install()", "pass")
        (root / "hooks" / f.name).write_text(text)
    (root / "bin").symlink_to(ROOT / "bin")
    (root / ".claude-plugin").symlink_to(ROOT / ".claude-plugin")
    (root / "skills").symlink_to(ROOT / "skills")
    return root


# a sibling module that cannot be imported: the module-level import of the hook fails before main() runs
for install, label in ((False, "negative control, no fail-safe"), (True, "with the fail-safe")):
    root = plugin_copy("broken-" + label.split(",")[0].replace(" ", "-"), install)
    (root / "hooks" / "codex_compat.py").write_text("raise ImportError('sibling module is broken')\n")
    ev = json.dumps({"hook_event_name": "PreToolUse", "tool_name": "Write", "tool_input": {"file_path": "x", "content": "y"}, "session_id": "s", "cwd": "/"}).encode()
    codes = {h: run(root, h, a, ev).returncode for h, a in (("context_budget.py", []), ("handoff_size.py", []), ("delegation.py", ["pre-tool"]))}
    if install:
        check(all(c == 0 for c in codes.values()), f"{label}: a sibling module that fails to import still gives exit 0 {codes}")
    else:
        check(all(c != 0 for c in codes.values()), f"{label}: the same break is a crash (so the control can fail) {codes}")

# a decision survives what comes after it; a half-written answer does not
PROBES = (
    ("a deny printed before a crash is delivered", 'print(json.dumps({"hookSpecificOutput": {"permissionDecision": "deny"}}))\nraise RuntimeError("late")', "deny"),
    ("a half-written document before a crash is dropped", 'print(\'{"hookSpecificOutput": {"permissionDec\')\nraise RuntimeError("late")', ""),
    ("sys.exit(3) becomes exit 0", "sys.exit(3)", ""),
)
for install in (True, False):
    root = plugin_copy("probe-" + str(install), install)
    for what, body, want in PROBES:
        arm = "failsafe.install()" if install else "pass"
        (root / "hooks" / "probe.py").write_text("import json, sys\nif __name__ == '__main__':\n    import failsafe\n    " + arm + "\n"
                                                 + "\n".join("    " + l for l in body.split("\n")) + "\n")
        r = run(root, "probe.py", [], b"{}")
        if install:
            check(r.returncode == 0 and (want in r.stdout.decode()) and (bool(want) == bool(r.stdout.strip())), f"fail-safe: {what}")
        else:
            check(r.returncode != 0, f"negative control, no fail-safe: the same probe ends with exit {r.returncode} ({what})")

# -- a hook that never gets its input or stalls is cut at its deadline, not at the harness's timeout
for install in (True, False):
    root = plugin_copy("stall-" + str(install), install)
    env = env_for(root)
    env["AGENT_HUB_HOOK_DEADLINE_S"] = "1"
    t0 = time.time()
    p = subprocess.Popen([sys.executable, str(root / "hooks" / "board_locks.py")], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, env=env)  # stdin stays open (communicate() would close it): json.load waits
    try:
        p.wait(timeout=6 if install else 3)
        took = time.time() - t0
        err = p.stderr.read().decode()
        check(install and p.returncode == 0 and not p.stdout.read().strip() and took < 5,
              f"deadline: a hook stuck reading stdin answers exit 0, no output, at the deadline ({took:.1f} s)" if install
              else f"negative control: without the fail-safe the stalled hook should still be waiting ({took:.1f} s)")
    except subprocess.TimeoutExpired:
        p.kill(); p.wait()
        check(not install, "negative control, no fail-safe: the stalled hook runs until the harness kills it" if not install
              else "deadline: the stalled hook was not cut at its deadline")
    if install:
        check("board_locks.py gave up after 1 s: no decision" in err, f"deadline: the cut leaves one line on stderr naming the hook and the deadline ({err.strip()[:80]!r})")
    for f in (p.stdin, p.stdout, p.stderr):
        f.close()

# an unusable deadline setting is ignored with a note, never a deadline of zero that skips every guard
for bad_value in ("0", "-3", "inf", "nan", "soon", "61"):
    env = env_for(ROOT); env["AGENT_HUB_HOOK_DEADLINE_S"] = bad_value
    r = run(ROOT, "polling_guard.py", [], json.dumps({"tool_name": "Bash", "tool_input": {"command": "sleep 600"}}).encode(), env=env)
    check(b"permissionDecision" in r.stdout and b"using 8.5" in r.stderr, f"AGENT_HUB_HOOK_DEADLINE_S={bad_value}: ignored with a note, the guard still answers its deny")


# -- the decision record: a delivered deny leaves one line in <state dir>/guard-decisions.jsonl; nothing else does
POLL_DENY = json.dumps({"hook_event_name": "PreToolUse", "tool_name": "Bash", "session_id": "sess-1", "cwd": "/",
                        "tool_input": {"command": "sleep 600 # " + "x" * 200}}).encode()
POLL_PASS = json.dumps({"hook_event_name": "PreToolUse", "tool_name": "Bash", "session_id": "sess-1", "cwd": "/",
                        "tool_input": {"command": "ls"}}).encode()
log = WORK / "hub" / ".state" / "guard-decisions.jsonl"
log.unlink(missing_ok=True)
env = env_for(ROOT); env["HUB_TAG"] = "guard-log"
r = run(ROOT, "polling_guard.py", [], POLL_PASS, env=env)
check(r.returncode == 0 and not log.exists(), "decision record: a command the guard lets through leaves no record")
r = run(ROOT, "polling_guard.py", [], POLL_DENY, env=env)
rec = [json.loads(l) for l in log.read_text().splitlines()] if log.exists() else []
check(r.returncode == 0 and b'"deny"' in r.stdout and len(rec) == 1, "decision record: a deny is delivered and recorded once")
rec = rec[0] if rec else {}
check((rec.get("hook"), rec.get("decision"), rec.get("session"), rec.get("tag"), rec.get("program")) == ("polling_guard.py", "deny", "sess-1", "guard-log", "sleep")
      and rec.get("reason", "").startswith("Waiting in the foreground is not run") and "\n" not in rec.get("reason", "") and rec.get("ts")
      and set(rec) == {"ts", "hook", "decision", "reason", "session", "tag", "program"},
      f"decision record: hook, decision, headline reason, session, tag and the program name, nothing else ({rec})")
# no secret reaches the file: not from an assignment (plain, quoted, with a space or an escape), not from an argument, not from the reason
log.unlink(missing_ok=True)
SECRET_COMMANDS = [("TOKEN=S3CRET-ASSIGN sleep 600", "sleep"), ("A=1 TOKEN='S3CRET ASSIGN' B=\"x y\" sleep 600", "sleep"),
                   ("TOKEN=S3CRET\\ ASSIGN sleep 600", "sleep"), ("TOKEN=\"S3CRET ASSIGN sleep 600", ""),
                   ("sleep 600 --token S3CRET-ARG", "sleep"), ("TOKEN=S3CRET-ASSIGN glab ci status --token S3CRET-ARG", "glab"),
                   ("until curl -H 'Authorization: S3CRET-ARG' x; do sleep 30; done", "until"),
                   ("TOKEN=/x/S3CRET ; sleep 600", ""), ("TOKEN=/x/S3CRET && sleep 600", ""),
                   ("DATABASE_URL=postgres://u:S3CRET@h/dbS3CRET && sleep 600", "")]
for cmd, _ in SECRET_COMMANDS:
    run(ROOT, "polling_guard.py", [], json.dumps({"tool_name": "Bash", "session_id": "s", "cwd": "/", "tool_input": {"command": cmd}}).encode(), env=env)
text = log.read_text() if log.exists() else ""
got = [json.loads(l).get("program") for l in text.splitlines()]
check("S3CRET" not in text and "ASSIGN" not in text and got == [w for _, w in SECRET_COMMANDS],
      f"decision record: an artificial secret in an assignment or an argument is not in the file, and the program is still named ({got})")
log.unlink(missing_ok=True)

# a hook with a subcommand names it; a record of a deny printed before a crash is kept too
root = plugin_copy("record-probe")
(root / "hooks" / "probe.py").write_text("import json, sys\nif __name__ == '__main__':\n    import failsafe\n    failsafe.install()\n"
                                          "    json.load(sys.stdin)\n    print(json.dumps({'hookSpecificOutput': {'permissionDecision': 'deny'}}))\n    raise RuntimeError('late')\n")
log.unlink(missing_ok=True)
r = run(root, "probe.py", ["pre-tool"], POLL_DENY)
rec = [json.loads(l) for l in log.read_text().splitlines()] if log.exists() else []
check(r.returncode == 0 and [x.get("hook") for x in rec] == ["probe.py pre-tool"], f"decision record: the subcommand is part of the hook name, and a deny printed before a crash is recorded ({rec})")
# the cap: the last GUARD_LOG_CAP lines are kept
CAP = 5000  # failsafe.GUARD_LOG_CAP
seed = "".join(json.dumps({"ts": "t", "hook": "old.py", "decision": "deny", "session": "", "tag": "", "command": f"seed {i} " + "x" * 60}) + "\n"
               for i in range(CAP))
log.write_text(seed)
r = run(ROOT, "polling_guard.py", [], POLL_DENY, env=env)
lines = log.read_text().splitlines()
check(len(lines) == CAP and json.loads(lines[0])["command"].startswith("seed 1 ") and json.loads(lines[-1])["hook"] == "polling_guard.py",
      f"decision record: at the cap the oldest line goes and the new one stays ({len(lines)} lines)")
import stat
check(stat.S_IMODE(log.stat().st_mode) == 0o600, f"decision record: the file is 0600 after a trim too ({oct(stat.S_IMODE(log.stat().st_mode))})")
# a short write leaves a torn line; the next record must not be glued to it
torn_home = WORK / "torn-hub"
script = (
    "import json, os, sys\n"
    "sys.path.insert(0, sys.argv[1] + '/hooks'); sys.argv[0] = 'polling_guard.py'\n"
    "import failsafe\n"
    "real, calls = os.write, [0]\n"
    "def torn(fd, data):\n"
    "    calls[0] += 1\n"
    "    return real(fd, data[:20]) if calls[0] == 1 else real(fd, data)\n"
    "os.write = torn\n"
    "class Tee: read_text = ['{\"session_id\": \"s\", \"tool_input\": {\"command\": \"sleep 600\"}}']\n"
    "failsafe._state['stdin'] = Tee()\n"
    "answer = {'hookSpecificOutput': {'permissionDecision': 'deny', 'permissionDecisionReason': 'r'}}\n"
    "failsafe._record(answer); failsafe._record(answer); failsafe._record(answer)\n")
tenv = env_for(ROOT); tenv["AGENT_HUB_HOME"] = str(torn_home)
r = subprocess.run([sys.executable, "-c", script, str(ROOT)], env=tenv, capture_output=True, timeout=30)
lines = (torn_home / ".state" / "guard-decisions.jsonl").read_text().splitlines() if (torn_home / ".state" / "guard-decisions.jsonl").exists() else []
good = []
for l in lines:
    try:
        good.append(json.loads(l)["program"])
    except (ValueError, KeyError):
        pass
check(r.returncode == 0 and good == ["sleep", "sleep"] and len(lines) == 3,
      f"decision record: after a short write the torn line stays one broken line and the next two records are intact ({len(lines)} lines, {len(good)} valid) {r.stderr[-200:]!r}")
# a temp file left by a trim that failed is removed by the next trim
stale = log.with_name(".guard-decisions.99999.tmp"); fresh = log.with_name(".guard-decisions.88888.tmp")
log.write_text(seed)
stale.write_text("x"); fresh.write_text("x")
os.utime(stale, (time.time() - 3600, time.time() - 3600))
run(ROOT, "polling_guard.py", [], POLL_DENY, env=env)
check(not stale.exists() and fresh.exists(), "decision record: the next trim removes an old leftover temp file and leaves a recent one")
fresh.unlink(missing_ok=True)
# a record that cannot be written changes nothing for the guard
blocked = WORK / "blocked-hub"
blocked.mkdir(exist_ok=True); (blocked / ".state").write_text("a file where the state dir should be\n")
env2 = env_for(ROOT); env2["AGENT_HUB_HOME"] = str(blocked)
r = run(ROOT, "polling_guard.py", [], POLL_DENY, env=env2)
check(r.returncode == 0 and b'"deny"' in r.stdout and not r.stderr.strip(), "decision record: an unwritable state dir does not touch the deny, the exit status or stderr")
# negative control: without the fail-safe there is no record
root = plugin_copy("record-off", install=False)
log.unlink(missing_ok=True)
run(root, "polling_guard.py", [], POLL_DENY, env=env)
check(not log.exists(), "negative control, no fail-safe: the same deny leaves no record")

# the deadlines stay below the timeouts the configs give the same hooks
import re
sys.path.insert(0, str(ROOT / "hooks"))
import failsafe
bad = []
seen = set()
standalone_veto = []
for cfg in ("hooks.json", "codex-hooks.json"):
    for event, groups in json.loads((ROOT / "hooks" / cfg).read_text())["hooks"].items():
        for g in groups:
            for h in g["hooks"]:
                m = re.search(r"hooks/([\w-]+\.py)", h["command"])
                if not m:
                    continue
                if m.group(1) == "no_compaction.py":
                    standalone_veto.append((cfg, event, g.get("matcher"), h["timeout"]))
                    continue
                seen.add(m.group(1))
                d = failsafe.DEADLINES.get(m.group(1), failsafe.DEFAULT_DEADLINE_S)
                if abs(d - (h["timeout"] - 1.5)) > 1e-9:
                    bad.append(f"{cfg}: {m.group(1)} deadline {d} vs timeout {h['timeout']}")
check(not bad and seen == set(failsafe.DEADLINES), f"every hook script has a deadline exactly 1.5 s under its configured timeout ({sorted(seen)}) {bad}")
check(standalone_veto == [("codex-hooks.json", "PreCompact", "^(manual|auto)$", 5)],
      f"standalone unconditional compaction veto is only Codex PreCompact, outside fail-open deadlines ({standalone_veto})")
sys.exit(fail)
PY
fail=$?
exit $fail
