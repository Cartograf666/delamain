from pathlib import Path
import subprocess,os,json,signal,socket,time,shutil
W=Path('/tmp/viz-live-14');W.mkdir(exist_ok=True);ROOT=Path(__file__).resolve().parents[3];owned=[];children=[]
try:
 for port in (8814,8815,8816):
  s=socket.socket();s.bind(('127.0.0.1',port));s.close()
 # Build without editing protected Go sources. HTML/assets are served by the browser helper.
 subprocess.run(['/opt/homebrew/bin/go','build','-o',str(W/'server'),'.'],cwd=ROOT/'viz',check=True)
 fixture=(ROOT/'viz/tests/pilot2/make_fixture.py').read_text().replace("assert W.name.startswith('viz-pilot2-')", "assert W.name.startswith('viz-live-')")
 (W/'make_fixture.py').write_text(fixture)
 subprocess.run(['/usr/bin/python3',str(W/'make_fixture.py'),str(W)],check=True);owned.extend(json.loads((W/'fixture-pids.json').read_text()))
 base=W/'baseline';base.mkdir(exist_ok=True)
 archive=subprocess.Popen(['git','archive','d4dc085183a06464b781111b4bcd7063b8d17ef6','viz'],stdout=subprocess.PIPE)
 subprocess.run(['tar','-x','-C',str(base)],stdin=archive.stdout,check=True);assert archive.wait()==0
 subprocess.run(['/opt/homebrew/bin/go','build','-o',str(W/'before'),'.'],cwd=base/'viz',check=True)
 for label,port,home,exe in [('fixture',8814,W/'fixture-home','server'),('real',8815,Path.home()/'agent-hub','server'),('before',8816,W/'fixture-home','before')]:
  env=os.environ.copy();env['AGENT_HUB_HOME']=str(home)
  if label!='real':env['CODEX_HOME']=str(W/'fixture-codex')
  f=open(W/(label+'.log'),'w');p=subprocess.Popen([str(W/exe),'-addr',f'127.0.0.1:{port}','-allow-origin','http://127.0.0.1:8914'],env=env,stdout=f,stderr=f,start_new_session=True);owned.append(p.pid);children.append(p)
 (W/'owned-pids.json').write_text(json.dumps(owned));print('READY fixture 8814, read-only real 8815, baseline 8816; type stop',flush=True);input()
finally:
 for pid in reversed(owned):
  try:os.killpg(pid,signal.SIGTERM)
  except ProcessLookupError:pass
 for p in children:p.wait(timeout=10)
 (W/'cleanup.json').write_text(json.dumps({'ownedPids':owned,'closed':True},indent=2));print('CLOSED',flush=True)
