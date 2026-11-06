from pathlib import Path
import subprocess,json,datetime,os,sys
W=Path(sys.argv[1]).resolve(); assert W.name.startswith('viz-pilot2-'), 'Fixture path required'; W.mkdir(parents=True,exist_ok=True)
H=W/'fixture-home'; H.mkdir(exist_ok=True)
(W/'empty-home').mkdir(exist_ok=True)
now=datetime.datetime.now().astimezone()
def write(p,v):
 p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(v))
pids=[]
for i,repo in enumerate(['claude-agent-hub','santinel','dolya','raft-ceo-workspace','personal-fin-assistant','project-estimator']):
 s=H/f'fixture-{i+1}'; work=s/'coordinator/work'; work.mkdir(parents=True,exist_ok=True)
 write(s/'stage.json',{'goal':'Synthetic visual verification','repo':'/fixture/'+repo})
 roles={'hub':{'role':'hub','tag':'hub-1','engine':'claude','title':'Fixture hub'}}
 for j,(role,engine,model) in enumerate([('limo','codex','gpt-6-astra'),('sport','claude','opus'),('plain','codex','gpt-6-sol'),('bike','claude','haiku'),('van','pace','service')]):
  # argv contains a unique token; the process does nothing except wait.
  token=f'viz-fixture-{i}-{j}'
  p=subprocess.Popen(['/bin/zsh','-c','sleep 14400 & wait',token],start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); pids.append(p.pid)
  roles[role]={'role':role,'tag':role,'engine':engine,'pid':p.pid}
  a=s/'agents'/role
  write(a/'meta.json',{'pid':p.pid,'process_token':token,'engine':engine,'model':model})
  (a/'log.jsonl').write_text(json.dumps({'type':'rate_limit_event','rate_limit_info':{'unifiedWindows':{'five_hour':{'utilization':.28,'resetsAt':now.timestamp()+7200}}}})+'\n')
 write(s/'roles.json',{'roles':roles})
 if i==1: (s/'questions.md').write_text('## Q-FIXTURE-001 — Visual choice\n- status: open\n')
 lines=[('hub-1','@plain fixture dispatch'),('plain','@hub fixture-2 review'),('sport','@owner check skyline'),('bike','@limo handover')]
 (work/f'journal-{now:%Y-%m-%d}.md').write_text(''.join(f'- {now:%H:%M} [{r}] {t}\n' for r,t in lines))
# Isolate Codex sampling from the real account; server only reads this temporary root.
c=W/'fixture-codex'; roll=c/'sessions'/now.strftime('%Y/%m/%d')/'rollout-fixture.jsonl'
write(roll,{'type':'event_msg','timestamp':now.isoformat(),'payload':{'type':'token_count','rate_limits':{'limit_id':'codex','primary':{'used_percent':42,'window_minutes':300,'resets_at':now.timestamp()+7200}}}})
(W/'fixture-pids.json').write_text(json.dumps(pids))
print(f'Created {H}: 6 stages, 30 harmless workers; PIDs recorded')
