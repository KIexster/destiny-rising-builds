"""Builds docs/data/emanare.json for the Emanare calculator from the decoded client tables.

Inputs (already extracted with Herramientas/inspect_emanare_tables.py):
  Emanare_Tablas_20261030/Tablas/*.json      PeakBoard*, CostData, AttributeData
  Update_20261022/Runtime/Data.SkillLite.SkillInfo.json
  Update_20261022/JSON/<en>.json, <es>.json  the game's own texts

Text fields in the tables hold MurmurHash3-32 (seed 0) of their TID key; they are resolved against every key of the
language file. Run: python tools/build_emanare.py
"""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];SITE=Path(__file__).resolve().parents[1]/'docs'
TABLES=ROOT/'Emanare_Tablas_20261030/Tablas'
LANGS={'en':ROOT/'Update_20261022/JSON/322be46287286a203429588cd16bda89.json','es':ROOT/'Update_20261022/JSON/47cac7e322a68fccf19184dfbd1b1172.json'}
SKILLS=ROOT/'Update_20261022/Runtime/Data.SkillLite.SkillInfo.json'
SOURCE='Global client, tables of 2026-10-29, texts of 2026-10-22'
# Game strings reused by the page, so it speaks the game's own vocabulary in every language.
GAME_TEXTS={'title':'TID_Season_PY_PeakBoard.py_1','core':'TID_Season_PY_PeakBoard.py_2','gem':'TID_Season_PY_PeakBoard.py_3',
 'role':'TID_Season_PY_PeakBoard.py_4','assist':'TID_Season_PY_PeakBoard.py_5','attr':'TID_Season_PY_PeakBoard.py_6','skill':'TID_Season_PY_PeakBoard.py_32',
 'needCore':'TID_Season_PY_PeakBoard.py_16','nodeLevel':'TID_Season_PY_PeakBoard.py_17','needPrev':'TID_Season_PY_PeakBoard.py_25',
 'unlockCost':'TID_Season_PY_PeakBoard.py_26','attrs':'TID_Season_PY_PeakBoard.py_19','power':'TID_Season_PY_PeakBoard.py_31'}
TYPES={1:'core',2:'role',3:'assist',4:'skill',5:'gem',6:'attr'}

def mm3(data,seed=0):
 n=len(data);h=seed;c1,c2=0xcc9e2d51,0x1b873593;r=n-n%4
 for i in range(0,r,4):
  k=int.from_bytes(data[i:i+4],'little');k=(k*c1)&0xffffffff;k=((k<<15)|(k>>17))&0xffffffff;k=(k*c2)&0xffffffff
  h^=k;h=((h<<13)|(h>>19))&0xffffffff;h=(h*5+0xe6546b64)&0xffffffff
 k=0
 for i,b in enumerate(data[r:]):k|=b<<(8*i)
 if n%4:k=(k*c1)&0xffffffff;k=((k<<15)|(k>>17))&0xffffffff;k=(k*c2)&0xffffffff;h^=k
 h^=n;h^=h>>16;h=(h*0x85ebca6b)&0xffffffff;h^=h>>13;h=(h*0xc2b2ae35)&0xffffffff;h^=h>>16
 return h

def clean(text):
 """Game markup out: colours (#cRRGGBB…#cend, #RRGGBB…#E), outlines (#o204…#oe), icons (#p(...)); placeholders become ?."""
 text=re.sub(r'#p\([^)]*\)','',text);text=re.sub(r'#c[0-9a-fA-F]{6}|#cend|#o\d+|#oe|#E|#[0-9a-fA-F]{6}|#bold|#bend','',text)
 return re.sub(r'\{[^}]*\}','?',text).strip()

def load(path):return json.loads(Path(path).read_text('utf-8'))
def table(name):return load(TABLES/(name+'.json'))

def main():
 loc={lang:load(p) for lang,p in LANGS.items()};hashed={lang:{mm3(k.encode()):v for k,v in d.items()} for lang,d in loc.items()}
 def by_key(key):return {lang:loc[lang].get(key) for lang in loc}
 def by_hash(value):
  try:h=int(value)
  except (TypeError,ValueError):return None
  names={lang:hashed[lang].get(h) for lang in loc};return names if names['en'] else None
 pb,attr_nodes,effects,cost,attributes,core=(table(n) for n in ('PeakBoardData','PeakBoardAttrNodeData','PeakBoardEffectData','CostData','AttributeData','PeakBoardCoreNodeData'))
 skill_nodes=table('PeakBoardSkillNodeData');skill_info=load(SKILLS)
 used_costs=set();used_attrs=set();used_items=set()
 def cost_of(cid):
  if not cid or cid not in cost:return None
  used_costs.add(cid);return cid
 def effect_of(eid):
  out=[]
  for c in effects.get(eid,{}).get('attrConf',[]):
   if c.get('func')!='add':raise ValueError(f'{eid}: unexpected func {c.get("func")}')
   used_attrs.add(c['attr']);out.append([c['attr'],c['num']])
  return out
 # Core node: level L costs core[L].consumeID to go to L+1 and needs that season phase.
 core_levels=[]
 for lv in sorted(core['1'],key=int):
  d=core['1'][lv];core_levels.append(dict(level=int(lv),next=dict(cost=cost_of(d['consumeID']),phase=d.get('seasonPhase')) if d.get('consumeID') else None))
 seasons={}
 for season,nodes in sorted(pb.items(),key=lambda x:int(x[0])):
  out=[]
  for n in sorted(nodes.values(),key=lambda n:n['nodeID']):
   t=TYPES[n['nodeType']];row=dict(id=n['nodeID'],type=t,ring=n['level'],pos=n['nodeID']%100,prev=n.get('prevNode',[]),links=n.get('linkNode',[]),
    core=n.get('coreNodeLevel',0),cost=cost_of(n.get('consumeID')))
   if t=='attr':
    # Level L: its effect and power; next = what going from L to L+1 needs. The last level has no cost.
    levels=attr_nodes[str(n['nodeSubType'])];row['levels']=[]
    for lv in sorted(levels,key=int):
     d=levels[lv];nxt=str(int(lv)+1) in levels
     row['levels'].append(dict(effects=effect_of(d['effectID']),power=d.get('power',0),next=dict(core=d['coreNodeLevel'],cost=cost_of(d['consumeID'])) if nxt else None))
    row['aura']=n.get('effectNodes',{})
   elif t=='skill':
    sid=skill_nodes[season][str(n['nodeSubType'])]['skillID'];info=skill_info.get(str(sid),{});title=info.get('tipsTitleID',sid)
    row['skill']=dict(id=sid,name=by_key(f'TID_CA.SkillUINameData.{title}.skillName'),
     desc={lang:clean(v) for lang,v in by_key(f'TID_CA.SkillInfo.{sid}.tipDesc').items() if v} or None)
    row['gems']=n.get('gemNode',[])
   elif t=='role':row['auraNodes']=n.get('includeNode',{})
   out.append(row)
  seasons[season]=dict(nodes=out)
 for cid in used_costs:
  for x in cost[cid].get('currencyConsume',[]):used_items.add(x['currency'])
  for x in cost[cid].get('resourceConsume',[]):used_items.add(x['resource'])
 data=dict(source=SOURCE,langs=list(loc),texts={k:by_key(v) for k,v in GAME_TEXTS.items()},core=core_levels,seasons=seasons,
  costs={cid:[[x['currency'],x['currencyNum']] for x in cost[cid].get('currencyConsume',[])]+[[x['resource'],x['resourceNum']] for x in cost[cid].get('resourceConsume',[])] for cid in sorted(used_costs)},
  attributes={a:dict(name=by_hash(attributes.get(str(a),{}).get('name')) or by_key(f'TID_CA.AttributeData.{a}.name'),ratio=bool(attributes.get(str(a),{}).get('showAsRatio'))) for a in sorted(used_attrs)},
  items={i:by_key(f'TID_CA.ItemData.{i}.name') for i in sorted(used_items)})
 missing=[f'attribute {a}' for a,v in data['attributes'].items() if not (v['name'] or {}).get('en')]+[f'item {i}' for i,v in data['items'].items() if not v.get('en')]
 (SITE/'data').mkdir(parents=True,exist_ok=True);(SITE/'data/emanare.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),'utf-8')
 print('seasons',list(seasons),'nodes',{s:len(v['nodes']) for s,v in seasons.items()},'costs',len(used_costs),'attributes',len(used_attrs),'items',len(used_items))
 print('missing names:',missing or 'none')

if __name__=='__main__':main()
