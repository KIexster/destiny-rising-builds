"""One Emanare season as plain data files to share: JSON, CSV and the cost of every season phase.

Usage: python tools/export_emanare_season.py [season] [out_dir]
Reads docs/data/emanare.json (built by build_emanare.py) and writes, in English:
- emanare_s<season>.json: items, attributes, Core Node levels, every node with its unlock and level costs, and phases;
- nodes.csv, node_levels.csv, core_levels.csv, phases.csv;
- README.md with the rules.
Phase p allows Core Node level p; "max phase p" is Core Node p with every node it allows unlocked and every Attribute
Node at the highest level it allows. The same rules as the web planner (docs/emanare.js, phaseMax and costBetween).
"""
import sys,json,csv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'docs'/'data'/'emanare.json').read_text('utf-8'))
SEASON=sys.argv[1] if len(sys.argv)>1 else '6'
OUT=Path(sys.argv[2]) if len(sys.argv)>2 else ROOT.parent/f'Emanare_S{SEASON}_Export'
NODES=DATA['seasons'][SEASON]['nodes'];BY={n['id']:n for n in NODES}
ITEMS={int(k):v['en'] for k,v in DATA['items'].items()}
ATTRS={int(k):v['name']['en'] for k,v in DATA['attributes'].items()}
GLIMMER=2000001

def cost(cid):return [dict(item=i,name=ITEMS.get(i,str(i)),count=n) for i,n in DATA['costs'].get(cid,[])] if cid else []
def add(total,cid):
 for i,n in DATA['costs'].get(cid,[]) if cid else []:total[i]=total.get(i,0)+n
def order():
 """Nodes outward from the core, each after the node before it."""
 out=[];seen=set();queue=[n['id'] for n in NODES if not n['prev']];kids={}
 for n in NODES:
  for p in n['prev']:kids.setdefault(p,[]).append(n['id'])
 while queue:
  i=queue.pop(0)
  if i in seen:continue
  seen.add(i);out.append(BY[i]);queue+=kids.get(i,[])
 return out+[n for n in NODES if n['id'] not in seen]
def phase_max(p):
 levels={}
 for n in order():
  if n['type']=='core' or n['core']>p:continue
  if not all(BY[q]['type']=='core' or levels.get(q,0)>0 for q in n['prev'] if q in BY):continue
  cap=1
  if n['type']=='attr':
   while cap<len(n['levels']) and n['levels'][cap-1]['next'] and n['levels'][cap-1]['next']['core']<=p:cap+=1
  levels[n['id']]=cap
 return p,levels
def cost_between(a,b):
 total={};(ca,la),(cb,lb)=a,b
 for l in range(ca,cb):add(total,DATA['core'][l-1]['next']['cost'] if DATA['core'][l-1]['next'] else None)
 for n in NODES:
  if n['type']=='core':continue
  x,y=la.get(n['id'],0),lb.get(n['id'],0)
  if y<=x:continue
  if not x:add(total,n['cost'])
  for l in range(max(1,x),y):add(total,n['levels'][l-1]['next']['cost'])
 return total
def ordered(total):return sorted(total.items(),key=lambda x:(x[0]!=GLIMMER,x[0]))

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 phases=[];prev=(1,{});cumulative={}
 for p in range(1,11):
  cur=phase_max(p);step=cost_between(prev,cur)
  for i,n in step.items():cumulative[i]=cumulative.get(i,0)+n
  phases.append(dict(phase=p,core_level=p,nodes_unlocked=len(cur[1]),from_previous_phase=[dict(item=i,name=ITEMS[i],count=n) for i,n in ordered(step)],
   total_from_scratch=[dict(item=i,name=ITEMS[i],count=n) for i,n in ordered(cumulative)]))
  prev=cur
 nodes=[]
 for n in NODES:
  e=dict(id=n['id'],type=n['type'],ring=n['ring'],position=n['pos'],previous=n['prev'],links=n['links'])
  if n['type']!='core':e['unlock']=dict(core_level=n['core'],cost=cost(n['cost']))
  if n['type']=='attr':e['levels']=[dict(level=i+1,power=L['power'],effects=[dict(attribute=a,name=ATTRS.get(a,str(a)),value=v,percent=bool(DATA['attributes'].get(str(a),{}).get('ratio'))) for a,v in L['effects']],
   next=dict(core_level=L['next']['core'],cost=cost(L['next']['cost'])) if L['next'] else None) for i,L in enumerate(n['levels'])]
  if n['type']=='skill':e['skill']=(n.get('skill') or {}).get('name',{}).get('en')
  nodes.append(e)
 core=[dict(level=c['level'],next=dict(phase=c['next']['phase'],cost=cost(c['next']['cost'])) if c['next'] else None) for c in DATA['core']]
 doc=dict(season=int(SEASON),source=DATA['source']['en'],
  rules=['Phase p of the season allows Core Node level p (core_levels[].next.phase).','A node unlocks when every previous node is unlocked and the Core Node is at unlock.core_level; it starts at level 1.',
   'An Attribute Node at level L goes to L+1 with levels[L-1].next: Core Node requirement and cost. The last level has no next.',
   'phases[].from_previous_phase: materials to go from phase p-1 maxed to phase p maxed. total_from_scratch adds them up from an empty board.',
   'Character Node auras and gem rolls depend on the account and are not included.'],
  items=ITEMS,attributes={a:dict(name=n,percent=bool(DATA['attributes'][str(a)].get('ratio'))) for a,n in ATTRS.items()},core_levels=core,nodes=nodes,phases=phases)
 (OUT/f'emanare_s{SEASON}.json').write_text(json.dumps(doc,indent=1,ensure_ascii=False),'utf-8')
 fmt=lambda c:'; '.join(f"{x['name']} x{x['count']}" for x in c)
 with (OUT/'nodes.csv').open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f);w.writerow(['id','type','ring','position','previous','unlock_core_level','unlock_cost','max_level'])
  for n in nodes:w.writerow([n['id'],n['type'],n['ring'],n['position'],' '.join(map(str,n['previous'])),n.get('unlock',{}).get('core_level',''),fmt(n.get('unlock',{}).get('cost',[])),len(n.get('levels',[])) or (10 if n['type']=='core' else 1)])
 with (OUT/'node_levels.csv').open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f);w.writerow(['node','level','power','effects','next_core_level','next_cost'])
  for n in nodes:
   for L in n.get('levels',[]):w.writerow([n['id'],L['level'],L['power'],'; '.join(f"{x['name']} +{x['value']*100:g}%" if x['percent'] else f"{x['name']} +{x['value']:g}" for x in L['effects']),(L['next'] or {}).get('core_level',''),fmt((L['next'] or {}).get('cost',[]))])
 with (OUT/'core_levels.csv').open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f);w.writerow(['level','next_level_phase','next_level_cost'])
  for c in core:w.writerow([c['level'],(c['next'] or {}).get('phase',''),fmt((c['next'] or {}).get('cost',[]))])
 with (OUT/'phases.csv').open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f);w.writerow(['phase','item_id','item','from_previous_phase','total_from_scratch'])
  for ph in phases:
   step={x['item']:x['count'] for x in ph['from_previous_phase']}
   for x in ph['total_from_scratch']:w.writerow([ph['phase'],x['item'],x['name'],step.get(x['item'],0),x['count']])
 (OUT/'README.md').write_text(f"""# Emanare, season {SEASON}

Data from the Destiny Rising Global client ({DATA['source']['en']}). Item, attribute and skill names are the game's English texts.

## Files

| File | Content |
|---|---|
| `emanare_s{SEASON}.json` | Everything below in one file: items, attributes, Core Node levels, every node and the phases. |
| `phases.csv` | For each season phase and material: what maxing that phase costs when the previous one is maxed, and the running total from an empty board. |
| `nodes.csv` | The {len(NODES)} nodes: type, ring, position (1-24), previous node, Core Node level and cost to unlock. |
| `node_levels.csv` | Attribute Node levels: power, effects, and the Core Node level and cost to reach the next level. |
| `core_levels.csv` | Core Node levels: the season phase and cost of the next level. |

## Rules

""" + '\n'.join('- '+r for r in doc['rules']) + f"""

Node ids are ring × 100 + position. The Core Node is id 1. Position 12 points right on the in-game board.

These are the rules of the web planner at https://kiexster.github.io/destiny-rising-builds/emanare.html. Its "Phase goal" card computes the same phase costs from any board.
""",'utf-8')
 print(json.dumps({ph['phase']:{ITEMS[i]:n for i,n in [(x['item'],x['count']) for x in ph['from_previous_phase']] if i in (GLIMMER,2500038)} for ph in phases}))
 return phases,cost_between,phase_max
if __name__=='__main__':main()
