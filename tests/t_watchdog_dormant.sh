#!/bin/bash
# The watchdog finishes its job quietly and an idle hub goes dormant instead of being pinged (WP2).
# 1. R7 busy_reason on a fake process table: a retired hub's own leftover jwait (its armed file) and a pending prompt
#    (idle/blocked) do not protect it, nor does a shell that holds only MCP servers (context7 through `npm exec`); a shell
#    with real work, a bare shell, another direct child next to the waiter, a waiter of another session still protect it.
# 2. R3: a held line (another stage's hub) under a live waiter is no "does not match" alarm; a `[pace]` line never wakes a
#    hub without a waiter; R6 does not run for a quiet stage.
# 3. jwait's NEXT WAIT: nothing runs in the stage of a `claude --bg` hub (watchdog on) → dormant, end the turn with no
#    waiter; an open owner question, the watchdog off, a terminal hub → the long wait; a Desktop hub → the long wait and
#    `watchdog quiet`.
# 4. A dormant `claude --bg` hub idle for 2 h is stopped by R7's stop code (role kept), and R3 resumes it on a line;
#    younger, a waiter armed, an open question, not started in the background, AGENT_HUB_WATCHDOG_REAP=off: not stopped.
. "$(dirname "$0")/lib.sh"
new_home; R=$AGENT_HUB_HOME
export HOME=$R/home; mkdir -p "$HOME"
export CLAUDE_CONFIG_DIR=$R/claude-home CLAUDE_SESSIONS_DIR=$R/desktop
export CLAUDE_BIN=$T/fake_claude_wd.py FAKE_WD_ROWS=$R/rows.json FAKE_WD_LOG=$R/claude.log
export AGENT_HUB_WATCHDOG=on
unset AGENT_HUB_NOTIFY_CMD AGENT_HUB_WATCHDOG_REAP AGENT_HUB_WATCHDOG_WAKE_AFTER AGENT_HUB_WATCHDOG_NOW FX_NOW FAKE_WD_AGENTS FAKE_WD_STOP
FB=$R/fakebin; mkdir -p "$FB"; : > "$R/notify.log"; : > "$R/claude.log"
for n in osascript notify-send; do printf '#!/bin/sh\necho "local: $*" >> "%s"\n' "$R/notify.log" > "$FB/$n"; chmod +x "$FB/$n"; done
export PATH="$FB:$PATH"
FX(){ python3 "$T/watchdog_fixture.py" "$@"; }
WD(){ "$B/watchdog" "$@"; }
J(){ echo "$R/$1/coordinator/work/journal-$(today).md"; }
count(){ local n; n=$(grep -c -- "$1" "$2" 2>/dev/null); echo "${n:-0}"; }
calls(){ FX claude-calls "$R/claude.log" | tr '\n' '|'; }
CWD=$R/cwd; mkdir -p "$CWD"; export FX_CWD=$CWD
sid(){ printf '%s-0000-4000-8000-000000000000' "$1"; }
WAITER=
sleep 3000 > /dev/null 2>&1 < /dev/null & LIVE=$!   # the process of the listed rows: no children
trap 'kill $LIVE 2>/dev/null; [ -n "$WAITER" ] && kill $WAITER 2>/dev/null; test_cleanup' EXIT
# bghub STAGE SID MINUTES: a `claude --bg` hub (hub-4), listed idle/done with the process $LIVE, transcript MINUTES old
bghub(){
  mkdir -p "$R/$1/coordinator/work"
  "$B/roles" set --stage "$1" hub "$2" --kind cli --tag hub-4 > /dev/null
  FX backdate "$1" 300; FX hubfield "$1" host bg
  FX transcript "$2" "$3" ok; FX job "$2" "$CWD"
  FX rows "$FAKE_WD_ROWS" "${2:0:8}" "$2" background idle "$CWD" "$LIVE"
}

# ================================================================== 1. R7 on a fake process table
mkdir -p "$R/.jwait-state/st"
python3 - "$B" "$R" <<'PY'
import datetime as dt, importlib.machinery, importlib.util, json, sys
from pathlib import Path
b, r = sys.argv[1], Path(sys.argv[2])
loader = importlib.machinery.SourceFileLoader("watchdog_mod", f"{b}/watchdog")
wd = importlib.util.module_from_spec(importlib.util.spec_from_loader("watchdog_mod", loader)); loader.exec_module(wd)
t0 = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
wd.tool("jwait").pid_runs_jwait = lambda p: p != 777  # the fake table's waiters run a jwait; pid 777 is a reused one
armed = r / ".jwait-state" / "st" / "hub-1.armed.json"
fails = 0
def case(name, table, state, want, waiter=None):
    global fails
    procs = {100: (1, t0, "claude bg-spare")}
    procs.update({p: (pp, t0, cmd) for p, pp, cmd in table})
    if waiter:
        armed.write_text(json.dumps({"pid": waiter, "stage": "st", "caller": "hub-1"}))
    elif armed.exists():
        armed.unlink()
    got = wd.busy_reason({"status": state.split("/")[0], "state": state.split("/")[1], "pid": 100}, procs)
    ok = (got == "") if want == "" else want in got
    fails += not ok
    print(f"{'PASS' if ok else 'FAIL'} R7 {name} (got {got!r} want {want!r})")
MCP = [(101, 100, "/bin/zsh"), (102, 101, "npm exec @upstash/context7-mcp --api-key x"), (103, 102, "node"),
       (104, 100, "/bin/sh"), (105, 104, "chrome-devtools-mcp"), (106, 105, "/opt/homebrew/bin/node")]
case("MCP servers under shells (context7 through npm exec): stopped", MCP, "idle/done", "")
case("MCP servers as direct children: stopped", [(102, 100, "npm exec @upstash/context7-mcp"), (103, 102, "node")], "idle/done", "")
case("a shell running sleep: protected", [(101, 100, "/bin/zsh"), (107, 101, "sleep")], "idle/done", "running a child process")
case("one shell holding an MCP server and sleep: protected", [(101, 100, "/bin/zsh"), (102, 101, "context7-mcp"), (108, 101, "sleep")],
     "idle/done", "running a child process")
case("a shell whose work command runs something named mcp below it: protected",
     [(101, 100, "/bin/zsh"), (107, 101, "python3"), (108, 107, "mcp-server-test")], "idle/done", "running a child process")
case("a bare shell (a loop of builtins): protected", [(101, 100, "/bin/zsh")], "idle/done", "running a child process")
case("idle/blocked (a pending prompt): stopped", [], "idle/blocked", "")
case("idle/working without an armed waiter: protected", [(101, 100, "/bin/zsh"), (110, 101, "Python")], "idle/working", "running a child process")
case("idle/working, a direct child and no armed waiter: protected", [(110, 100, "Python")], "idle/working", "idle/working")
case("idle/working, its own jwait under a shell (armed file): stopped", [(101, 100, "/bin/zsh"), (110, 101, "Python")], "idle/working", "", waiter=110)
case("idle/working, its own jwait as a direct child: stopped", [(110, 100, "Python")] + MCP, "idle/working", "", waiter=110)
case("idle/working, own jwait and direct MCP servers (the usual shape): stopped",
     [(110, 100, "Python"), (102, 100, "npm exec @upstash/context7-mcp --api-key x"), (103, 102, "node"),
      (105, 100, "chrome-devtools-mcp")], "idle/working", "", waiter=110)
case("idle/working, own jwait under a shell and a direct native LSP server: stopped",
     [(101, 100, "/bin/zsh"), (110, 101, "Python"), (120, 100, "/opt/homebrew/bin/gopls")], "idle/working", "", waiter=110)
case("idle/working, own jwait and a node-hosted LSP server (process name node): protected",
     [(110, 100, "Python"), (121, 100, "node")], "idle/working", "idle/working", waiter=110)
case("an armed file whose pid now runs something else (reused): its process is work, protected",
     [(101, 100, "/bin/zsh"), (777, 101, "Python")], "idle/working", "running a child process", waiter=777)
case("idle/working, own jwait and another direct child (an await): protected", [(110, 100, "Python"), (111, 100, "Python")],
     "idle/working", "idle/working", waiter=110)
case("idle/working, own jwait and a shell with work: protected", [(110, 100, "Python"), (101, 100, "/bin/zsh"), (107, 101, "sleep")],
     "idle/working", "running a child process", waiter=110)
case("idle/working, the armed jwait belongs to another session: protected", [(110, 100, "Python"), (900, 1, "Python")],
     "idle/working", "idle/working", waiter=900)
case("busy/working: protected", [], "busy/working", "busy/working")
sys.exit(1 if fails else 0)
PY
check $? 0 "R7 busy_reason on a fake process table"

# ================================================================== 2. R3 and R6: held and pace lines
mkdir -p "$R/other/coordinator/work"   # a known stage: its hub's lines are held in ours
H1=$(sid d0000001); bghub sh "$H1" 20
FX jline sh 40 "[other-hub-2] @hub !1020 смержен"
"$B/jwait" --journal --stage sh --caller hub-4 --tag hub-4 --tag hub --settle 1 --for 120s > "$R/waiter.out" 2>&1 & WAITER=$!
for _ in $(seq 100); do [ -f "$R/.jwait-state/sh/hub-4.armed.json" ] && break; sleep 0.1; done
test -f "$R/.jwait-state/sh/hub-4.armed.json"; check $? 0 "setup: the hub's own jwait is armed"
WD run --stage sh > "$R/tick.out" 2>&1; check $? 0 "held line under a live waiter: the tick exits 0"
check "$(count "does not match" "$(J sh)")" 0 "a held line under a live waiter is no 'does not match' alarm"
FX jline sh 20 "[exec-1] DONE a line the waiter should have taken"
WD run --stage sh > "$R/tick.out" 2>&1
check "$(count "does not match 1 lines" "$(J sh)")" 1 "control: a waking line under a live waiter is still recorded as a mismatch (and only it is counted)"
kill $WAITER 2>/dev/null; wait $WAITER 2>/dev/null; WAITER=

H2=$(sid d0000002); bghub sp "$H2" 20
FX jline sp 40 "[pace] @hub LIMIT claude plan week ahead of pace"
WD run --dry-run --stage sp > "$R/tick.out" 2>&1
grep -q "would wake" "$R/tick.out"; check $? 1 "a [pace] line does not wake a hub that has no waiter"
FX jline sp 40 "[other-hub-2] @hub FYI the release is out"
WD run --dry-run --stage sp > "$R/tick.out" 2>&1
grep -q "would wake hub-4 .*: 1 lines waiting" "$R/tick.out"; check $? 0 "control: a held line of another stage's hub still wakes it after 30 min (one line: the pace line is not counted)"

python3 - "$B" <<'PY'
import importlib.machinery, importlib.util, subprocess, sys
b = sys.argv[1]
loader = importlib.machinery.SourceFileLoader("watchdog_mod", f"{b}/watchdog")
wd = importlib.util.module_from_spec(importlib.util.spec_from_loader("watchdog_mod", loader)); loader.exec_module(wd)
seen = []
wd.rule_r6 = lambda tick, stage: seen.append(stage)
wd.rule_hub = lambda *a: None
subprocess.run([f"{b}/watchdog", "quiet", "--stage", "sp", "--reason", "test", "--for", "8h"], check=True, capture_output=True)
tick = wd.Tick(dry=True, as_json=True)
wd.run_stage(tick, "sp"); wd.run_stage(tick, "sh")
print("R6 ran for:", seen)
sys.exit(0 if seen == ["sh"] else 1)
PY
check $? 0 "R6 skips a quiet stage, runs for one that is not"
WD quiet --stage sp --clear > /dev/null

# ================================================================== 3. jwait's NEXT WAIT
NW(){ "$B/jwait" --journal --stage "$1" --tag hub-4 --tag hub --settle 0 --for 1s --caller hub-4 2>&1 | grep '^NEXT WAIT'; }
H3=$(sid d0000003); bghub sn "$H3" 20
out=$(CLAUDE_CODE_SESSION_ID=$H3 NW sn)
case "$out" in *"nothing runs in sn — dormant: end the turn with no waiter"*) r=0 ;; *) r=1 ;; esac; check $r 0 "NEXT WAIT: a claude --bg hub with nothing running goes dormant ($out)"
out=$(CLAUDE_CODE_SESSION_ID=$H3 AGENT_HUB_WATCHDOG=off NW sn)
case "$out" in *"ONE Bash run_in_background"*) r=0 ;; *) r=1 ;; esac; check $r 0 "NEXT WAIT: the watchdog off → the long wait (nobody would wake it)"
out=$(CLAUDE_CODE_SESSION_ID=$(sid d00000ff) NW sn)
case "$out" in *"ONE Bash run_in_background"*) r=0 ;; *) r=1 ;; esac; check $r 0 "NEXT WAIT: a caller that is not the hub → the long wait"
WD quiet --stage sn --reason test --for 8h > /dev/null
out=$(CLAUDE_CODE_SESSION_ID=$H3 NW sn)
case "$out" in *"ONE Bash run_in_background"*) r=0 ;; *) r=1 ;; esac; check $r 0 "NEXT WAIT: a quiet stage (no R3 wake) → the long wait"
WD quiet --stage sn --clear > /dev/null
"$B/ask" add --stage sn --blocks x --default nothing --due 2099-01-01T00:00 --by t --source t "Keep it?" > /dev/null 2>&1; check $? 0 "setup: an open owner question"
out=$(CLAUDE_CODE_SESSION_ID=$H3 NW sn)
case "$out" in *"ONE Bash run_in_background"*) r=0 ;; *) r=1 ;; esac; check $r 0 "NEXT WAIT: an open owner question → the long wait"
FX hubfield sn host ""
"$B/ask" withdraw "$("$B/ask" list --stage sn --open | grep -o 'Q-[A-Z0-9-]*' | head -1)" --reason test > /dev/null 2>&1
out=$(CLAUDE_CODE_SESSION_ID=$H3 NW sn)
case "$out" in *"ONE Bash run_in_background"*) r=0 ;; *) r=1 ;; esac; check $r 0 "NEXT WAIT: a terminal hub (no host bg) → the long wait"
H4=$(sid d0000004); bghub sd "$H4" 20; FX hubfield sd kind desktop
out=$(CLAUDE_CODE_SESSION_ID=$H4 NW sd)
case "$out" in *"ONE Bash run_in_background"*"watchdog quiet --stage sd"*) r=0 ;; *) r=1 ;; esac; check $r 0 "NEXT WAIT: a Desktop hub → the long wait and watchdog quiet ($out)"

# ================================================================== 4. a dormant claude --bg hub is stopped after 2 h, resumed on a line
NOW=$(python3 -c 'import datetime as d; print((d.datetime.now(d.timezone.utc) + d.timedelta(minutes=150)).strftime("%Y-%m-%dT%H:%M:%S"))')
export FX_NOW=$NOW AGENT_HUB_WATCHDOG_NOW=$NOW   # the process of the rows started 150 min before the tick's clock
D=$(sid d0000010); bghub dm "$D" 130
: > "$R/claude.log"; WD run --dry-run --stage dm > "$R/tick.out" 2>&1
grep -q "would stop the dormant hub-4 (d0000010), idle 2 h 10 min" "$R/tick.out"; check $? 0 "dry run: plans the stop of a dormant hub idle 2 h 10 min"
FX transcript "$D" 100 ok
: > "$R/claude.log"; WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "idle 1 h 40 min: not stopped"
FX transcript "$D" 130 ok
"$B/ask" add --stage dm --blocks x --default nothing --due 2099-01-01T00:00 --by t --source t "Keep it?" > /dev/null 2>&1
: > "$R/claude.log"; WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "an open owner question: not stopped"
"$B/ask" withdraw "$("$B/ask" list --stage dm --open | grep -o 'Q-[A-Z0-9-]*' | head -1)" --reason test > /dev/null 2>&1
FX hubfield dm host ""
: > "$R/claude.log"; WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "not started in the background (R3 could not resume it): not stopped"
FX hubfield dm host bg
: > "$R/claude.log"; AGENT_HUB_WATCHDOG_REAP=off WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "AGENT_HUB_WATCHDOG_REAP=off: not stopped"
python3 - "$FAKE_WD_ROWS" <<'PY'
import json, sys
p = sys.argv[1]; r = json.load(open(p)); r[0]["state"] = "working"; json.dump(r, open(p, "w"))
PY
: > "$R/claude.log"; WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "idle/working (the listing says it waits): not stopped"
FX rows "$FAKE_WD_ROWS" "${D:0:8}" "$D" background idle "$CWD" "$LIVE"
# idle/done at the first look, idle/working at the last one, over a finished turn quiet 2 h 10 min: a dormant hub is not
# let go the way a retired one is (R7's last look keeps `working` protected for it)
python3 - "$CLAUDE_CONFIG_DIR/projects/p/$D.jsonl" <<'PY'
import json, os, sys
p = sys.argv[1]; st = os.stat(p)
last = max(json.loads(l)["timestamp"] for l in open(p) if '"timestamp"' in l)
open(p, "a").write(json.dumps({"type": "system", "subtype": "turn_duration", "timestamp": last}) + "\n")
os.utime(p, (st.st_atime, st.st_mtime))
PY
cat > "$R/to-working.py" <<'PY'
import json, os
p = os.environ["FAKE_WD_ROWS"]; r = json.load(open(p)); r[0]["state"] = "working"; json.dump(r, open(p, "w"))
PY
: > "$R/claude.log"; FAKE_WD_ON_AGENTS="2:python3 $R/to-working.py" WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "turns idle/working right before the stop: not stopped"
FX rows "$FAKE_WD_ROWS" "${D:0:8}" "$D" background idle "$CWD" "$LIVE"
sed 's/"working"/"blocked"/' "$R/to-working.py" > "$R/to-blocked.py"
: > "$R/claude.log"; FAKE_WD_ON_AGENTS="2:python3 $R/to-blocked.py" WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "turns idle/blocked right before the stop: not stopped (a dormant hub must be idle/done)"
FX rows "$FAKE_WD_ROWS" "${D:0:8}" "$D" background idle "$CWD" "$LIVE"
printf '{"sessions": ["%s"], "pid": %s}\n' "$D" "$$" > "$R/dm/.takeover-test.json"   # a running `hub takeover` names it
: > "$R/claude.log"; WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *stop*) r=1 ;; *) r=0 ;; esac; check $r 0 "named by a running hub takeover / hub start: not stopped"
rm -f "$R/dm/.takeover-test.json"
: > "$R/claude.log"; WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *"stop ${D:0:8}"*) r=0 ;; *) r=1 ;; esac; check $r 0 "a dormant hub idle 2 h 10 min is stopped ($(calls))"
grep -q "stopped the dormant hub-4 (d0000010), idle 2 h 10 min" "$R/tick.out"; check $? 0 "…and the tick says so"
check "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["roles"]["hub"]["session"])' "$R/dm/roles.json")" "$D" "…its role is kept"
check "$(count "dormant" "$(J dm)")" 0 "…and the stage journal gets no line"
FX jline dm 20 "[exec-1] DONE something for the hub"
: > "$R/claude.log"; WD run --stage dm > "$R/tick.out" 2>&1
case "$(calls)" in *"resume $D"*) r=0 ;; *) r=1 ;; esac; check $r 0 "a line addressed to the stopped dormant hub: R3 resumes it ($(calls))"
exit $fail
