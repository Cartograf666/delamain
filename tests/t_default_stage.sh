#!/bin/bash
# default_stage: without --stage and $HUB_STAGE a tool works in the stage whose registry lists the calling session,
# never silently in `default` (the 01.11 `agent send` and five await lines that landed there); several candidate stages
# are refused; an unregistered caller still gets `default`.
. "$(dirname "$0")/lib.sh"
new_home; unset HUB_STAGE HUB_TAG CLAUDE_CODE_SESSION_ID AGENT_SESSION_ID CODEX_THREAD_ID; O=$AGENT_HUB_HOME
S=11111111-1111-4111-8111-111111111111
HUB_STAGE=stage-a $B/roles set hub $S --kind cli --tag hub-4 >/dev/null; check $? 0 "register the hub's session in stage-a"
export CLAUDE_CODE_SESSION_ID=$S
JA=$(journal stage-a); JD=$(journal default)

$B/jlog "own stage" >/dev/null; check $? 0 "jlog without HUB_STAGE"
check "$(grep -c '\[hub-4\] own stage' $JA)" 1 "…lands in the registered stage, signed with the registry tag"
[ ! -e "$JD" ]; check $? 0 "…and nothing in default"

$B/await --wait --label ci -- true >/dev/null 2>&1; check $? 0 "await without HUB_STAGE"
check "$(grep -c '\[hub-4-await\] @hub DONE ci' $JA)" 1 "…its line lands in the registered stage"
ls $O/stage-a/coordinator/work/await/*-ci-*.log >/dev/null 2>&1; check $? 0 "…and its log under that stage's work dir"
[ ! -e "$JD" ]; check $? 0 "…nothing in default"

$B/agent send nobody "hello" > $O/send.out 2>&1; check $? 1 "agent send to an unknown agent fails"
grep -q "no agent 'nobody' in stage stage-a" $O/send.out; check $? 0 "…looking in the registered stage, not default"

HUB_TAG=hub-4 $B/jlog "with tag" >/dev/null; check "$(grep -c '\[hub-4\] with tag' $JA)" 1 "HUB_TAG set too: the same stage"
HUB_STAGE=stage-x HUB_TAG=x $B/jlog "env wins" >/dev/null; check "$(grep -c 'env wins' $(journal stage-x))" 1 "an explicit HUB_STAGE still wins"
$B/jlog --stage stage-y "flag wins" >/dev/null; check "$(grep -c 'flag wins' $(journal stage-y))" 1 "…and so does --stage"

# a second registration: which one cannot be told without a tag -> refused, not default
HUB_STAGE=stage-b $B/roles set qa $S --kind cli --tag qa >/dev/null
$B/jlog "ambiguous" > $O/amb.out 2>&1; check $? 2 "registered in two stages, no HUB_TAG: refused"
grep -q 'pass --stage' $O/amb.out; check $? 0 "…saying what to do"
[ ! -e "$JD" ]; check $? 0 "…nothing in default"
HUB_TAG=qa $B/jlog "picked by tag" >/dev/null; check "$(grep -c '\[qa\] picked by tag' $(journal stage-b))" 1 "HUB_TAG picks the registration carrying it"

# negative controls: an unregistered session, or no session at all, still writes to default
CLAUDE_CODE_SESSION_ID=22222222-2222-4222-8222-222222222222 HUB_TAG=x $B/jlog "stranger" >/dev/null
check "$(grep -c 'stranger' $JD)" 1 "an unregistered session: default, as before"
env -u CLAUDE_CODE_SESSION_ID HUB_TAG=x $B/jlog "no session" >/dev/null
check "$(grep -c 'no session' $JD)" 1 "no session id: default, as before"
exit $fail
