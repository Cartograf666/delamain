"""Build explicit archival-plot to rendered-geometry links; never infer ownership by proximity.

An absent building is intentional: authored landmarks replace some original plots.
Those plots retain exact ground polygons, but cannot recolour unrelated geometry.
"""
import json, math
from pathlib import Path
root=Path(__file__).resolve().parents[2]
s=json.loads((root/'assets/gl/scene.json').read_text())
g=json.loads((root/'citydata/graph.json').read_text())
def project(x,y):return [(g['ox']+x-y)*.75,(g['oy']+(x+y)/2)*.75-40]
plots=[]
for p in g['plots']:
    centre=project(p['X'],p['Y'])
    matches=[b for b in s['buildings'] if math.dist(centre,b['ground'])<.02]
    assert len(matches)<=1, f"Ambiguous rendered building for plot {p['id']}"
    plots.append({'id':p['id'],'building':matches[0]['id'] if matches else None,'ground':centre,'footprint':[project(p[x],p[y]) for x,y in [('x0','y0'),('x1','y0'),('x1','y1'),('x0','y1')]]})
result={'source':'citydata/graph.json + assets/gl/scene.json','tolerance':.02,'plots':plots}
(root/'assets/gl/growth-plots.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(f"{len(plots)} exact footprints; {sum(p['building'] is not None for p in plots)} unique rendered buildings; {sum(p['building'] is None for p in plots)} absent/replaced original buildings")
