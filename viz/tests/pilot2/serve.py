from pathlib import Path
import subprocess,os,json,signal,time,socket,shutil,sys
W=Path('/tmp/viz-pilot2-13');W.mkdir(exist_ok=True); ROOT=Path(__file__).resolve().parents[3];owned=[];children=[]
try:
 for port in (8813,8814):
  s=socket.socket();s.bind(('127.0.0.1',port));s.close()
 shutil.copytree(ROOT/'viz',W/'build-viz',dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules'))
 subprocess.run(['/opt/homebrew/bin/go','build','-o',str(W/'after'),'.'],cwd=W/'build-viz',check=True)
 base=W/'baseline';base.mkdir(exist_ok=True)
 archive=subprocess.Popen(['git','archive','d4dc085183a06464b781111b4bcd7063b8d17ef6','viz'],stdout=subprocess.PIPE)
 subprocess.run(['tar','-x','-C',str(base)],stdin=archive.stdout,check=True);archive.wait()
 subprocess.run(['/opt/homebrew/bin/go','build','-o',str(W/'before'),'.'],cwd=base/'viz',check=True)
 subprocess.run(['/usr/bin/python3',str(Path(__file__).with_name('make_fixture.py')),str(W)],check=True);owned.extend(json.loads((W/'fixture-pids.json').read_text()))
 env=os.environ.copy();env['AGENT_HUB_HOME']=str(W/'fixture-home');env['CODEX_HOME']=str(W/'fixture-codex')
 for label,port in [('after',8813),('before',8814)]:
  f=open(W/(label+'.log'),'w');p=subprocess.Popen([str(W/label),'-addr',f'127.0.0.1:{port}'],env=env,stdout=f,stderr=f,start_new_session=True);owned.append(p.pid);children.append(p)
 (W/'owned-pids.json').write_text(json.dumps(owned));print('READY 8813/8814; type stop',flush=True);input()
finally:
 for pid in reversed(owned):
  try:os.killpg(pid,signal.SIGTERM)
  except ProcessLookupError:pass
 for p in children:p.wait(timeout=10)
 time.sleep(.3)
 survivors=[]
 for pid in owned:
  try:
   state=subprocess.check_output(['ps','-o','stat=','-p',str(pid)],text=True).strip()
   if state and not state.startswith('Z'):survivors.append(pid)
  except subprocess.CalledProcessError:pass
 (W/'cleanup.json').write_text(json.dumps({'ownedPids':owned,'survivors':survivors,'closed':not survivors},indent=2));print('CLOSED',survivors,flush=True)
