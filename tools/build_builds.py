"""Builds docs/data/builds.json and docs/img/ for the character builds page from the game's own recommendations.

Inputs (extracted with Herramientas/inspect_tables.py into Builds_Recomendadas_20261101/Tablas):
  ArtifactRecommendSuitLaunchData  3 recommended artifact builds per character (pieces per slot, attributes, ratings)
  RecommendWeaponRating            recommended weapons per slot and rarity
  EnergyPartnerRecommendData       affinity 0-3 with every teammate
  RoleData, ArtifactModuleLaunchData, ArtifactAttrLaunchData, WeaponItemData   names and icons
  SkillLiteParamData               the values behind the {placeholders} of each artifact effect
Art comes from Assets/ (portraits, artifact and weapon icons) and is converted to small WebP files.
Run: python tools/build_builds.py
"""
import json,re,glob
from pathlib import Path
from PIL import Image
from build_emanare import mm3,clean
ROOT=Path(__file__).resolve().parents[2];DOCS=Path(__file__).resolve().parents[1]/'docs'
TABLES=ROOT/'Builds_Recomendadas_20261101/Tablas';ASSETS=ROOT/'Assets'
LANGS={'en':ROOT/'Companion_Research_20261029/Foundry_Challenges/English.json','es':ROOT/'Update_20261022/JSON/47cac7e322a68fccf19184dfbd1b1172.json'}
SOURCE={'en':'Global client, tables of 2026-11-01','es':'cliente global, tablas del 01/11/2026'}
# The in-game artifact set screen calls the three ratings Offense, Survival and Control.
GAME_TEXTS={'offense':'TID_Character_Panel_CSD_C_Role_ArtifactSet_918547554','survival':'TID_Character_Panel_CSD_C_Role_ArtifactSet_1811328165',
 'control':'TID_Character_Panel_CSD_C_Role_ArtifactSet_1273119031','artifacts':'TID_Character_Panel_CSD_C_Role_ArtifactSetPop_N36809613',
 'weapons':'TID_Weapon_Panel_PY_RecommendWeapon','slot':'TID_Character_Panel_CSD_C_Role_ArtifactSetChangePop01_1496035744'}
RARITIES=[('myth','mythRecommendWeapon'),('legend','legendRecommendWeapon'),('rare','rareRecommendWeapon')]
SIZES={'roles':140,'artifacts':72,'weapons':96}

def load(path):return json.loads(Path(path).read_text('utf-8'))
def table(name):return load(TABLES/(name+'.json'))

def number(value,decimals,lang):
 text=f'{value:.{decimals}f}'.rstrip('0').rstrip('.') if decimals else str(round(value))
 return text.replace('.',',') if lang=='es' else text
def param_text(p,lang):
 """A skill parameter as the game shows it in PvE: its base value, or base–max when it grows with the artifact level."""
 levels=[p['PVEVal']]+[p[k] for k in sorted(p,key=lambda k:int(k.rsplit('_',1)[1]) if k.startswith('PVEVal_') else 0) if k.startswith('PVEVal_')]
 scale,unit=(100,'%') if p.get('is_percent') else (1,'');dec=p.get('decimalNum',0)
 low,high=number(levels[0]*scale,dec,lang),number(max(levels)*scale,dec,lang)
 return (low if low==high else f'{low}–{high}')+unit
def fill(text,params,lang):
 """Placeholders {Artifact_Att_…} take their parameter values; glossary links #l(tag|text|id) keep their text."""
 text=re.sub(r'#l\([^|)]*\|([^|)]*)\|[^)]*\)',r'\1',text)
 text=re.sub(r'\{([^}]+)\}',lambda m:param_text(params[m.group(1)],lang) if m.group(1) in params else m.group(0),text)
 return clean(text)

def main():
 loc={lang:load(p) for lang,p in LANGS.items()};hashed={lang:{mm3(k.encode()):v for k,v in d.items()} for lang,d in loc.items()}
 def text(value,fix=lambda s:s):
  """Every language for a hashed text field; a language missing it falls back to English."""
  try:h=int(value)
  except (TypeError,ValueError):return None
  en=hashed['en'].get(h)
  return {lang:fix(hashed[lang].get(h) or en) for lang in loc} if en else None
 def by_key(key,fix=lambda s:s):
  en=loc['en'].get(key);return {lang:fix(loc[lang].get(key) or en) for lang in loc} if en else None
 roles,launch,weapons,partners,items,modules,attrs=(table(n) for n in ('RoleData','ArtifactRecommendSuitLaunchData','RecommendWeaponRating','EnergyPartnerRecommendData','WeaponItemData','ArtifactModuleLaunchData','ArtifactAttrLaunchData'))
 params=table('SkillLiteParamData')
 def skill_text(sid):
  for field in ('tipDesc','detailedDesc'):
   key=f'TID_CA.SkillInfo.{sid}.{field}';en=loc['en'].get(key)
   if en:return {lang:fill(loc[lang].get(key) or en,params,lang) for lang in loc}
  return None
 images={k:{} for k in SIZES}
 def image(kind,key,pattern):
  """Copy the first matching asset as a small WebP; returns its path under docs/ or None."""
  if key in images[kind]:return images[kind][key]
  found=sorted(glob.glob(str(ASSETS/pattern),recursive=True));images[kind][key]=None
  if found:
   out=DOCS/'img'/kind/(key+'.webp');out.parent.mkdir(parents=True,exist_ok=True)
   im=Image.open(found[0]).convert('RGBA');im.thumbnail((SIZES[kind],SIZES[kind]),Image.LANCZOS);im.save(out,'WEBP',quality=88,method=6)
   images[kind][key]=f'img/{kind}/{key}.webp'
  return images[kind][key]
 # One entry per artifact template (the ID the recommended slots use): the highest-quality piece names it.
 templates={}
 for m in modules.values():
  t=m['templateID']
  if t not in templates or m['quality']>templates[t]['quality']:templates[t]=m
 used_pieces={};used_attrs={};used_weapons={}
 def piece(t):
  if t not in used_pieces:
   m=templates[t];sk=str(m.get('skillID'))
   used_pieces[t]=dict(name=text(m['name']),type=text(m.get('type')),slot=m['slotID'],
    desc=skill_text(sk),
    icon=image('artifacts',m['icon'],f"Artifacts/**/{m['icon']}*.png"))
  return t
 def attr(a):
  if a not in used_attrs:used_attrs[a]=dict(name=text(attrs[str(a)]['name']))
  return a
 def weapon(i):
  if i not in used_weapons:
   w=items[str(i)];icon=w['icon'].replace('_gear','')
   used_weapons[i]=dict(name=text(w['name']),quality=w.get('quality'),icon=image('weapons',icon,f"Weapons/**/{w['icon']}*.png") or image('weapons',icon,f"Weapons/*__{i}/*.png"))
  return i
 def tidy(s):
  # A few localized names come in capitals or with a stray full stop ("EFRIDEET", "Kabr, el Resuelto.").
  s=s.strip().rstrip('.');return s.title() if s.isupper() and len(s)>3 else s
 name=lambda c:text(roles[c]['name'],tidy) if c in roles else None
 characters=[]
 for c in sorted(launch,key=lambda c:(name(c) or {}).get('en','')):
  builds=[]
  for sid,b in sorted(launch[c].items(),key=lambda x:int(x[0])):
   builds.append(dict(id=int(sid),name=text(b['recommendBuild_Name']),desc=text(b['recommendBuild_Description']),
    ratings=dict(offense=b['rating_attack'],survival=b['rating_defense'],control=b['rating_operation']),
    pieces=[piece(b[f'slot{s}'][0]) for s in range(1,5)],attrs=[attr(a) for a in b.get('recommendAttr',[])]))
  w=weapons.get(c,{})
  guns={r:[[weapon(i) for i in w.get(f'{key}{slot}',[]) if str(i) in items] for slot in (1,2)] for r,key in RARITIES}
  mates=partners.get(c,{})
  team=sorted(((k,v) for k,v in mates.items() if k not in ('roleId',c) and isinstance(v,int) and v>=2 and k in launch),key=lambda x:(-x[1],(name(x[0]) or {}).get('en','')))
  characters.append(dict(id=c,name=name(c),portrait=image('roles',c,f'Characters/*__{c}/Icons/role_head_yx_{c}.png'),builds=builds,weapons=guns,partners=team))
 data=dict(source=SOURCE,langs=list(loc),texts={k:by_key(v) for k,v in GAME_TEXTS.items()},characters=characters,
  pieces=used_pieces,attributes=used_attrs,weapons=used_weapons)
 missing=[f'character {c["id"]}' for c in characters if not c['name'] or not c['portrait']]
 missing+=[f'piece {t}' for t,p in used_pieces.items() if not p['name'] or not p['icon']]
 missing+=[f'attribute {a}' for a,v in used_attrs.items() if not v['name']]
 missing+=[f'weapon {i}' for i,v in used_weapons.items() if not v['name'] or not v['icon']]
 (DOCS/'data').mkdir(parents=True,exist_ok=True);(DOCS/'data/builds.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),'utf-8')
 print('characters',len(characters),'builds',sum(len(c['builds']) for c in characters),'pieces',len(used_pieces),'attributes',len(used_attrs),'weapons',len(used_weapons))
 print('pieces with effect text',sum(bool(p['desc']) for p in used_pieces.values()),'/',len(used_pieces))
 print('missing:',missing or 'none')

if __name__=='__main__':main()
