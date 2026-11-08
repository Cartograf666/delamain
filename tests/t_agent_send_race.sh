#!/bin/bash
# `agent send` is one critical section per agent (a lock beside meta.json): a message queued while another send's resume
# is still waiting for its init event is not lost when the resume saves its meta; two sends to a dead agent resume it
# once; every run reads a prompt file of its own that is never rewritten.
. "$(dirname "$0")/lib.sh"
new_home; export HUB_STAGE=stage-a HUB_TAG=hub-test CLAUDE_BIN=$T/fake_claude.py
R=$AGENT_HUB_HOME; W=$R/w; mkdir -p $W; echo "brief: send race, the code word is wolfsbane" > $W/b.md
M=$R/stage-a/agents
meta(){ python3 -c "import json,sys;m=json.load(open(sys.argv[1]));print(eval(sys.argv[2]))" $M/$1/meta.json "$2"; }
wait_gone(){ for i in $(seq 1 40); do kill -0 "$1" 2>/dev/null || return 0; sleep 0.25; done; return 1; }
trap 'for r in s1 s2 s3 s4 s5; do $B/agent stop $r >/dev/null 2>&1; done; test_cleanup' EXIT

# 1. a message B queued while send A's resume waits for init survives A's save of the meta
FAKE_HOLD=60 $B/agent spawn --role s1 --cwd $W --model haiku --brief $W/b.md > $R/sp1.out 2>&1; check $? 0 "spawn s1"
P=$(meta s1 "m['pid']"); kill -KILL -- -$P; wait_gone $P
FAKE_INIT_DELAY=4 FAKE_HOLD=60 $B/agent send s1 "message A" > $R/sa.out 2>&1 & SA=$!
for i in $(seq 1 60); do [ "$(meta s1 "len(m['runs'])")" = 2 ] && break; sleep 0.1; done
check "$(meta s1 "len(m['runs'])")" 2 "send A's resume is under way (its run is on record, init not yet seen)"
FAKE_HOLD=60 $B/agent send s1 "message B" > $R/sb.out 2>&1; check $? 0 "send B"
wait $SA; check $? 0 "send A finished"
grep -q 'resumed' $R/sa.out; check $? 0 "A resumed the session"
grep -q 'queued in its inbox' $R/sb.out; check $? 0 "B found a live agent and queued"
meta s1 "' '.join(u['msg'] for u in m['inbox_unread'])" | grep -q 'message B'; check $? 0 "B is still in inbox_unread after A's resume saved its meta"
grep -q 'message B' $M/s1/inbox.md; check $? 0 "…and in inbox.md"
check "$(meta s1 "len(m['runs'])")" 2 "B did not start a second resume"

# 2. two sends to a dead agent at once: one resume, the other queues; no message is lost
P=$(meta s1 "m['pid']"); kill -KILL -- -$P; wait_gone $P
FAKE_HOLD=60 $B/agent send s1 "message C" > $R/sc.out 2>&1 &
FAKE_HOLD=60 $B/agent send s1 "message D" > $R/sd.out 2>&1 &
wait
check "$(meta s1 "sum(1 for r in m['runs'] if r['kind']=='resume')")" 2 "two sends to a dead agent: one resume (A's and one more, not two more)"
check "$(grep -l 'queued in its inbox' $R/sc.out $R/sd.out | wc -l | tr -d ' ')" 1 "…and the other send queued its message"
grep -q 'message C' $M/s1/inbox.md && grep -q 'message D' $M/s1/inbox.md; check $? 0 "both messages are in inbox.md"
grep -c 'message [CD]' $W/prompts.log | grep -qv '^0$'; check $? 0 "the resume's CLI read its message on stdin"

# 3. one immutable prompt file per run, each holding exactly what that run read
[ ! -e $M/s1/prompt.txt ]; check $? 0 "no shared prompt.txt"
check "$(ls $M/s1/prompt-*.txt | wc -l | tr -d ' ')" "$(meta s1 "len(m['runs'])")" "one prompt file per run"
python3 - "$M/s1" <<'PY'
import json, os, sys
d = sys.argv[1]
m = json.load(open(d + "/meta.json"))
files = [r["prompt"] for r in m["runs"]]
assert len(set(files)) == len(files), files
assert "wolfsbane" in open(f"{d}/{files[0]}").read(), "the spawn prompt file holds the brief"
for r in m["runs"][1:]:
    assert "wolfsbane" not in open(f"{d}/{r['prompt']}").read(), "a resume prompt is its message, not the brief"
assert all(oct(os.stat(f"{d}/{f}").st_mode & 0o777) == "0o600" for f in files)
PY
check $? 0 "each run record names its own file; brief in the first, message in a resume; mode 0600"

# 4. agent stop vs the exit wrapper's replay of an unread message (review #180): a send that comes between the kill and
# the retire (the old run already gone, the role still registered) is refused, so nothing restarts a stopped agent
FAKE_HOLD=60 $B/agent spawn --role s3 --cwd $W --model haiku --brief $W/b.md > /dev/null 2>&1; check $? 0 "spawn s3"
FAKE_HOLD=60 $B/agent send s3 "queued before the stop" > /dev/null; check $? 0 "a message is queued while s3 runs"
RUNS=$(meta s3 "len(m['runs'])")
FAKE_HOLD=60 python3 - "$B" s3 > $R/stop-race.out 2>&1 <<'PY'
import argparse, importlib.machinery, importlib.util, os, sys, time
loader = importlib.machinery.SourceFileLoader("agent_mod", sys.argv[1] + "/agent")
agent = importlib.util.module_from_spec(importlib.util.spec_from_loader("agent_mod", loader))
loader.exec_module(agent)
role, real_killpg, seen = sys.argv[2], os.killpg, []
pid = agent.load_meta("stage-a", role)["pid"]
def killpg(pg, sig):  # stop's SIGTERM: the old run dies, then the replay's send comes before the retire
    real_killpg(pg, sig)
    if seen:
        return
    for _ in range(100):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.05)
    try:
        agent.cmd_send(argparse.Namespace(stage="stage-a", role=role, text=[], resume_anyway=False))
        seen.append("resumed")
    except agent.hc.Failure as e:
        seen.append(f"refused: {e}")
agent.os.killpg = killpg
agent.cmd_stop(argparse.Namespace(stage="stage-a", role=role))
print("send during stop:", seen[0] if seen else "not reached")
PY
check $? 0 "agent stop exits 0"
grep -q 'send during stop: refused: agent s3 was stopped' $R/stop-race.out; check $? 0 "a send between the kill and the retire is refused"
check "$(meta s3 "len(m['runs'])")" "$RUNS" "…no new run was started"
P=$(meta s3 "m['pid']"); kill -0 $P 2>/dev/null; check $? 1 "…and no process of s3 is left"
$B/roles get s3 > /dev/null 2>&1; check $? 1 "…and the role is retired"

# 5. a replay whose resume fails before init (review #180 r2): one attempt, not a loop; the message stays queued and the
# hub gets an EXIT line with the reason. The CLI dies from the replay on (a flag file), as twice in a row would.
printf '#!/bin/sh\n[ -e "$FLAKY_DIE" ] && export FAKE_CLAUDE=die\nexec python3 %s "$@"\n' "$T/fake_claude.py" > $W/flaky.sh
chmod +x $W/flaky.sh
CLAUDE_BIN=$W/flaky.sh FLAKY_DIE=$W/die FAKE_HOLD=3 $B/agent spawn --role s4 --cwd $W --model haiku --brief $W/b.md > /dev/null 2>&1; check $? 0 "spawn s4"
touch $W/die
$B/agent send s4 "replay me please" > /dev/null; check $? 0 "a message is queued while s4 runs"
for i in $(seq 1 80); do grep -q 'EXIT s4: its unread message could not be replayed' $(journal stage-a) && break; sleep 0.25; done
grep -q '\[s4\] EXIT s4: its unread message could not be replayed and stays queued — claude exited with code 1' $(journal stage-a); check $? 0 "a failed replay journals EXIT with the reason under the agent's tag"
sleep 6   # time enough for a second attempt (the CLI dies after 2 s) if the failed run scheduled one
check "$(grep -c 'replay me please' $W/prompts.log)" 1 "…one replay attempt, not a loop"
meta s4 "' '.join(u['msg'] for u in m['inbox_unread'])" | grep -q 'replay me please'; check $? 0 "…and the message stays queued"
rm -f $W/die

# 6. a message queued after the exit wrapper looked (the launch shell still alive) is still replayed: the waiter decides
# after the shell is gone, under the agent's lock (review #180 r2)
FAKE_HOLD=0 $B/agent spawn --role s5 --cwd $W --model haiku --brief $W/b.md > /dev/null 2>&1; check $? 0 "spawn s5"
for i in $(seq 1 40); do [ -n "$(meta s5 "m['pid']")" ] && ! kill -0 "$(meta s5 "m['pid']")" 2>/dev/null && break; sleep 0.25; done; sleep 1
FAKE_HOLD=0 AGENT_LOG_OFFSET=0 python3 - "$B" s5 > $R/late.out 2>&1 <<'PY'
import importlib.machinery, importlib.util, json, os, subprocess, sys
loader = importlib.machinery.SourceFileLoader("agent_mod", sys.argv[1] + "/agent")
agent = importlib.util.module_from_spec(importlib.util.spec_from_loader("agent_mod", loader))
loader.exec_module(agent)
role, calls = sys.argv[2], []
meta = agent.load_meta("stage-a", role)
assert not meta.get("inbox_unread"), "the queue is empty when the exit wrapper looks"
gone = subprocess.Popen(["true"]); gone.wait()
agent.os.getppid = lambda: gone.pid            # the launch shell, already gone by the time the waiter checks
real_popen = subprocess.Popen
agent.subprocess.Popen = lambda argv, **kw: calls.append((argv, kw["env"]))
agent.hand_over_unread("stage-a", role)
subprocess.Popen = real_popen
print("waiter scheduled:", bool(calls))
if calls:
    log = os.path.join(meta["dir"], "log.jsonl")  # the late message: queued by a send that still saw the shell alive
    meta = agent.load_meta("stage-a", role)
    meta["inbox_unread"] = [{"at": "2026-11-08T15:00:00", "msg": "late message", "log_offset": os.path.getsize(log)}]
    agent.save_meta("stage-a", role, meta)
    print("waiter exit:", subprocess.run(calls[0][0], env=calls[0][1]).returncode)
PY
grep -q 'waiter scheduled: True' $R/late.out; check $? 0 "the exit wrapper schedules the waiter even with an empty queue"
grep -q 'waiter exit: 0' $R/late.out; check $? 0 "…the waiter's send succeeds"
grep -q '\[inbox\] @s5 (session resumed, pid [0-9]*, unread replayed: 1)' $(journal stage-a); check $? 0 "…and replays the message queued after the wrapper looked"
grep -q 'late message' $W/prompts.log; check $? 0 "…which reaches the agent"
for i in $(seq 1 40); do kill -0 "$(meta s5 "m['pid']")" 2>/dev/null || break; sleep 0.25; done
FAKE_HOLD=0 AGENT_HUB_REPLAY=1 HUB_TAG=inbox $B/agent send s5 > $R/quiet.out 2>&1; check $? 0 "a replay with nothing left unread exits 0"
check "$(grep -c '@s5 (session resumed' $(journal stage-a))" 1 "…and resumes nothing"
exit $fail
