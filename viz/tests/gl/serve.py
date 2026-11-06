"""Attached fixture-only Go server. Commands: restart, event, stop. No live-home reads."""
from pathlib import Path
import subprocess,os,json,signal,socket,datetime
ROOT=Path(__file__).resolve().parents[3];W=Path('/tmp/viz-gl2-18');W.mkdir(exist_ok=True);owned=[];server=None;log=None

def start():
 global server,log
 subprocess.run(['/opt/homebrew/bin/go','build','-o',str(W/'server'),'.'],cwd=ROOT/'viz',check=True)
 env=os.environ.copy();env['AGENT_HUB_HOME']=str(W/'fixture-home');env['CODEX_HOME']=str(W/'fixture-codex')
 log=open(W/'server.log','a');server=subprocess.Popen([str(W/'server'),'-addr','127.0.0.1:8818'],env=env,stdout=log,stderr=log,start_new_session=True)
 (W/'server-pid.json').write_text(json.dumps(server.pid));print('READY 8818; restart / event / stop',flush=True)
def stop_server():
 if server and server.poll() is None:os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=10)
 if log:log.close()
try:
 s=socket.socket();s.bind(('127.0.0.1',8818));s.close()
 fixture=(ROOT/'viz/tests/pilot2/make_fixture.py').read_text().replace("assert W.name.startswith('viz-pilot2-')","assert W.name.startswith('viz-gl2-')")
 (W/'make_fixture.py').write_text(fixture);subprocess.run(['/usr/bin/python3',str(W/'make_fixture.py'),str(W)],check=True);owned=json.loads((W/'fixture-pids.json').read_text());start()
 for cmd in iter(input,'stop'):
  if cmd=='restart':stop_server();start()
  elif cmd=='event':
   now=datetime.datetime.now().astimezone()
   for i in range(1,7):
    p=W/f'fixture-home/fixture-{i}/coordinator/work/journal-{now:%Y-%m-%d}.md'
    with p.open('a') as f:f.write(f'- {now:%H:%M} [plain] @hub Fixture work event {now.timestamp()}\n')
   print('EVENTS',flush=True)
finally:
 stop_server()
 for pid in owned:
  try:os.killpg(pid,signal.SIGTERM)
  except ProcessLookupError:pass
 (W/'cleanup.json').write_text(json.dumps({'fixturePids':owned,'serverPid':server.pid if server else None,'stopped':True}));print('CLOSED',flush=True)
