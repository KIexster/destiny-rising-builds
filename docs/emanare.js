'use strict';
/* Emanare planner. Rules, as the game describes them and as its tables encode them:
   - The Core Node starts at level 1 and goes up to 10; each level needs a later phase of the season.
   - A node unlocks once its preceding node is unlocked and the Core Node level is high enough; that puts it at level 1.
   - An Attribute Node at level L goes to L+1 with levels[L-1].next (Core Node level and cost); the last level has none.
   Everything else (gem, ability, character nodes) only unlocks. Aura amplification and gem rolls are account-specific
   and left out. Data: data/emanare.json, built by tools/build_emanare.py from the game client. */

const UI={
  es:{pageTitle:'Calculadora de Emanare',pageSub:'Planifica el tablero, mira los atributos que da y lo que cuesta.',
    hint:'Toca un nodo para verlo. Mayús + clic sube su nivel; clic derecho lo baja.',activeNodes:'Nodos activos',maxNodes:'Atributos al máximo',
    auraNote:'No incluye el aura de los nodos de personaje ni las gemas: dependen de tu cuenta.',totalCost:'Coste total',fill:'Todo lo posible',
    reset:'Reiniciar',share:'Copiar enlace',footer:'Proyecto de fans sin ánimo de lucro. No está afiliado a NetEase ni a Bungie.',
    season:'T{n}',phase:'Disponible desde la fase {p} de la temporada.',phaseStart:'Nivel inicial.',unlock:'Desbloquear',up:'Subir nivel',down:'Bajar',
    remove:'Quitar',max:'Al máximo',pick:'Elige un nodo del tablero para ver qué da y cuánto cuesta.',now:'Ahora',next:'Siguiente nivel',
    nothing:'Nada todavía',copied:'Enlace copiado',gems:'Ranuras de gema enlazadas: {n}',gemOf:'Ranura de gema de: {s}',
    aura:'Su aura cubre hasta {n} nodos de atributo; pasa el ratón por encima para verlos.',costUnlock:'Coste de desbloqueo',costNext:'Coste del siguiente nivel',
    maxed:'Nivel máximo',ring:'Anillo {n}',coreNext:'Coste del nivel {n}',source:'Datos del cliente del juego ({s}).',lvl:'Nv. {a}/{b}'},
  en:{pageTitle:'Emanare Planner',pageSub:'Plan the board, see the attributes it gives and what it costs.',
    hint:'Tap a node to inspect it. Shift + click levels it up; right-click levels it down.',activeNodes:'Active nodes',maxNodes:'Maxed attributes',
    auraNote:'Character Node auras and gems are not included: they depend on your account.',totalCost:'Total cost',fill:'Everything possible',
    reset:'Reset',share:'Copy link',footer:'Non-profit fan project. Not affiliated with NetEase or Bungie.',
    season:'S{n}',phase:'Available from season phase {p}.',phaseStart:'Starting level.',unlock:'Unlock',up:'Level up',down:'Level down',
    remove:'Remove',max:'Max',pick:'Pick a node on the board to see what it gives and what it costs.',now:'Now',next:'Next level',
    nothing:'Nothing yet',copied:'Link copied',gems:'Linked gem slots: {n}',gemOf:'Gem slot for: {s}',
    aura:'Its aura covers up to {n} Attribute Nodes; hover it to see them.',costUnlock:'Unlock cost',costNext:'Next level cost',
    maxed:'Max level',ring:'Ring {n}',coreNext:'Level {n} cost',source:'Data from the game client ({s}).',lvl:'Lv. {a}/{b}'}
};
// Ring spacing and orientation measured on the in-game board: a wide empty centre around the Core Node, and position 12
// (the outer Character Node of slot 2) straight to the right.
const GLIMMER=2000001,RING0=114,RING_STEP=45,SIZE={attr:12,gem:14,skill:18,role:17,assist:16};
const S={data:null,lang:'es',season:null,core:1,levels:new Map(),sel:null};
let nodes=[],byId=new Map(),children=new Map(),order=[];
const $=id=>document.getElementById(id);
const SVG='http://www.w3.org/2000/svg';

// Text
const t=(key,vars={})=>(UI[S.lang][key]||key).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
const game=(key,value)=>{const s=(S.data.texts[key]||{})[S.lang]||(S.data.texts[key]||{}).en||key;return value===undefined?s:s.replace(/\{[^}]+\}/g,value)};
const tr=o=>o?(o[S.lang]||o.en||''):'';
const locale=()=>S.lang==='es'?'es-ES':'en-US';
// Spanish leaves 4-digit numbers ungrouped by default; group them all so a cost list lines up.
const num=(v,digits=0)=>v.toLocaleString(locale(),{minimumFractionDigits:digits,maximumFractionDigits:Math.max(digits,2),useGrouping:'always'});
function attrValue(id,v){
  const a=S.data.attributes[id];
  return '+'+(a&&a.ratio?num(v*100,2)+' %':num(v));
}
const attrName=id=>tr((S.data.attributes[id]||{}).name)||'#'+id;
const itemName=id=>tr(S.data.items[id])||'#'+id;

// Board rules
const level=n=>n.type==='core'?S.core:(S.levels.get(n.id)||0);
const maxLevel=n=>n.type==='attr'?n.levels.length:n.type==='core'?10:1;
const active=n=>level(n)>0;
function prevOk(n){return n.prev.every(p=>{const q=byId.get(p);return !q||active(q)})}
/** Why n can't go up one level right now: null if it can. */
function raiseBlock(n){
  const lv=level(n);
  if(n.type==='core')return lv>=10?'max':null;
  if(lv>=maxLevel(n))return 'max';
  if(lv===0){
    if(S.core<n.core)return {core:n.core};
    return prevOk(n)?null:'prev';
  }
  const nx=n.levels[lv-1].next;
  if(!nx)return 'max';
  return S.core<nx.core?{core:nx.core}:null;
}
/** Highest level the current Core Node allows once n is unlocked. */
function levelCap(n){
  if(n.type!=='attr')return 1;
  let cap=1;
  while(cap<n.levels.length&&n.levels[cap-1].next&&S.core>=n.levels[cap-1].next.core)cap++;
  return cap;
}
function setLevel(n,lv){
  if(n.type==='core'){S.core=Math.max(1,Math.min(10,lv));normalize();return}
  if(lv<=0){S.levels.delete(n.id);for(const c of children.get(n.id)||[])setLevel(byId.get(c),0)}
  else S.levels.set(n.id,lv);
}
function raise(n){
  if(raiseBlock(n))return false;
  if(n.type==='core'){setLevel(n,S.core+1);return true}
  setLevel(n,level(n)+1);pulse(n);return true;
}
function lower(n){
  if(n.type==='core'){if(S.core>1)setLevel(n,S.core-1);return}
  if(level(n)>0)setLevel(n,level(n)-1);
}
/** After the Core Node changes or a link is loaded: drop what is no longer allowed, outward from the core. */
function normalize(){
  for(const n of order){
    const lv=level(n);
    if(!lv||n.type==='core')continue;
    if(S.core<n.core||!prevOk(n))setLevel(n,0);
    else if(lv>levelCap(n))S.levels.set(n.id,levelCap(n));
  }
}
function fillAll(){
  for(const n of order){
    if(n.type==='core')continue;
    if(!level(n)&&!raiseBlock(n))S.levels.set(n.id,1);
    if(level(n))S.levels.set(n.id,levelCap(n));
  }
}

// Totals
function addCost(map,cid){if(!cid)return;for(const [id,n] of S.data.costs[cid]||[])map.set(id,(map.get(id)||0)+n)}
function nextCost(n){
  if(n.type==='core')return S.core<10?S.data.core[S.core-1].next?.cost:null;
  const lv=level(n);
  return lv===0?n.cost:n.type==='attr'&&lv<n.levels.length?n.levels[lv-1].next?.cost:null;
}
function totals(){
  const items=new Map(),attrs=new Map();let power=0,count=0,maxed=0;
  for(let l=1;l<S.core;l++)addCost(items,S.data.core[l-1].next?.cost);
  for(const n of nodes){
    const lv=level(n);
    if(!lv||n.type==='core')continue;
    count++;addCost(items,n.cost);
    if(n.type!=='attr')continue;
    for(let l=1;l<lv;l++)addCost(items,n.levels[l-1].next?.cost);
    const L=n.levels[lv-1];power+=L.power;
    for(const [a,v] of L.effects)attrs.set(a,(attrs.get(a)||0)+v);
    if(lv===n.levels.length)maxed++;
  }
  return {items,attrs,power,count,maxed};
}

// Drawing
const angle=pos=>(pos/24)*Math.PI*2-Math.PI;
const radius=ring=>RING0+ring*RING_STEP;
const point=n=>n.type==='core'?[0,0]:[radius(n.ring)*Math.cos(angle(n.pos)),radius(n.ring)*Math.sin(angle(n.pos))];
function el(tag,attrs,parent){const e=document.createElementNS(SVG,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);parent&&parent.appendChild(e);return e}
function shape(n,g){
  const r=SIZE[n.type];
  if(n.type==='gem')return el('path',{class:'shape',d:`M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z`},g);
  if(n.type==='skill'){
    const pts=[...Array(6)].map((_,i)=>{const a=Math.PI/3*i-Math.PI/2;return `${r*Math.cos(a)},${r*Math.sin(a)}`}).join(' ');
    return el('polygon',{class:'shape',points:pts},g);
  }
  if(n.type==='assist')return el('rect',{class:'shape',x:-r,y:-r,width:2*r,height:2*r,rx:4},g);
  const c=el('circle',{class:'shape',r},g);
  if(n.type==='role')el('circle',{r:r-6,fill:'none',stroke:'currentColor','stroke-opacity':.25,'pointer-events':'none'},g);
  return c;
}
function drawBoard(){
  const svg=$('board');svg.textContent='';
  // Like the in-game board: only the connections between nodes are drawn, no full ring guides.
  const links=el('g',{},svg),dots=el('g',{},svg);
  const seen=new Set();
  for(const n of nodes)for(const m of new Set([...n.links,...n.prev])){
    const o=byId.get(m),key=[n.id,m].sort((a,b)=>a-b).join('-');
    if(!o||seen.has(key))continue;
    seen.add(key);
    const [x1,y1]=point(n),[x2,y2]=point(o);let d=`M${x1} ${y1}L${x2} ${y2}`;
    if(n.type!=='core'&&o.type!=='core'&&n.ring===o.ring){
      let diff=angle(o.pos)-angle(n.pos);diff=Math.atan2(Math.sin(diff),Math.cos(diff));
      d=`M${x1} ${y1}A${radius(n.ring)} ${radius(n.ring)} 0 0 ${diff>0?1:0} ${x2} ${y2}`;
    }
    const p=el('path',{class:'link',d},links);p.dataset.a=n.id;p.dataset.b=m;
  }
  for(const n of nodes){
    const [x,y]=point(n);
    const g=el('g',{class:`node ${n.type}`,transform:`translate(${x} ${y})`,tabindex:0,role:'button'},dots);g.dataset.id=n.id;
    if(n.type==='core'){
      g.classList.add('core');el('circle',{class:'glow',r:70},g);el('circle',{class:'shape',r:54},g);el('text',{class:'corelvl'},g);
    }else{
      // A wider invisible target, so nodes can be tapped on a phone where the board is ~350 px wide.
      el('circle',{r:SIZE[n.type]+10,fill:'transparent'},g);shape(n,g);el('text',{class:'lvl'},g);
    }
    n.el=g;
  }
}
function render(){
  const tot=totals();
  for(const n of nodes){
    const g=n.el,lv=level(n);
    if(n.type==='core'){g.querySelector('text').textContent=S.core;g.setAttribute('aria-label',`${game('core')} ${S.core}`);continue}
    const block=lv?null:raiseBlock(n);
    g.classList.toggle('on',lv>0);g.classList.toggle('max',n.type==='attr'&&lv===maxLevel(n));
    g.classList.toggle('open',!lv&&!block);g.classList.toggle('locked',!lv&&!!block);g.classList.toggle('sel',S.sel===n.id);
    g.querySelector('.lvl').textContent=n.type==='attr'&&lv?lv:'';
    g.setAttribute('aria-label',`${nodeTitle(n)}, ${t('lvl',{a:lv,b:maxLevel(n)})}`);
  }
  for(const p of $('board').querySelectorAll('.link'))
    p.classList.toggle('on',active(byId.get(+p.dataset.a))&&active(byId.get(+p.dataset.b)));
  $('coreLevel').textContent=S.core;$('coreDown').disabled=S.core<=1;$('coreUp').disabled=S.core>=10;
  const phase=S.core>1?S.data.core[S.core-2].next?.phase:null;
  $('corePhase').textContent=phase?t('phase',{p:phase}):t('phaseStart');
  $('activeCount').textContent=tot.count;$('maxCount').textContent=tot.maxed;tween($('powerTotal'),tot.power);
  const attrs=[...tot.attrs].sort((a,b)=>a[0]-b[0]);
  $('attrList').innerHTML=attrs.length?attrs.map(([a,v])=>`<li><span>${esc(attrName(a))}</span><strong>${attrValue(a,v)}</strong></li>`).join(''):`<li class="empty">${t('nothing')}</li>`;
  $('costList').innerHTML=costRows(tot.items)||`<li class="empty">${t('nothing')}</li>`;
  renderCard();writeHash();
}
function costRows(map){
  return [...map].sort((a,b)=>(a[0]===GLIMMER?-1:b[0]===GLIMMER?1:a[0]-b[0])).map(([id,n])=>`<li><span>${esc(itemName(id))}</span><strong>${num(n)}</strong></li>`).join('');
}
function costList(cid){const m=new Map();addCost(m,cid);return costRows(m)}
function nodeTitle(n){
  if(n.type==='attr')return [...new Set(n.levels[0].effects.map(e=>attrName(e[0])))].join(' · ');
  if(n.type==='skill')return tr(n.skill.name)||game('skill');
  return game(n.type);
}
function renderCard(){
  const card=$('nodeCard'),n=byId.get(S.sel);
  if(!n){card.innerHTML=`<p class="note">${t('pick')}</p>`;return}
  const lv=level(n),block=raiseBlock(n),max=maxLevel(n);
  let h=`<div class="kind">${esc(game(n.type))}${n.type==='core'?'':' · '+t('ring',{n:n.ring})}</div><h3>${esc(nodeTitle(n))}</h3>`;
  if(n.type==='skill'&&n.skill.desc)h+=`<p class="desc">${esc(tr(n.skill.desc))}</p>`;
  if(n.type==='skill')h+=`<p class="desc">${t('gems',{n:n.gems.length})}</p>`;
  if(n.type==='gem'){const s=nodes.find(m=>m.type==='skill'&&m.gems.includes(n.id));if(s)h+=`<p class="desc">${esc(t('gemOf',{s:tr(s.skill.name)}))}</p>`}
  if(n.type==='role'){const all=new Set(Object.values(n.auraNodes).flat());h+=`<p class="desc">${t('aura',{n:all.size})}</p>`}
  if(max>1)h+=`<div class="lv">${[...Array(max)].map((_,i)=>`<i class="${i<lv?'on':''}"></i>`).join('')}</div><div class="req">${esc(game('nodeLevel'))}: ${lv}/${max}</div>`;
  if(n.type==='attr'){
    const cur=lv?n.levels[lv-1].effects:[],nx=lv<max?n.levels[lv].effects:null;
    if(cur.length)h+=`<h4>${t('now')}</h4><ul class="list">${cur.map(([a,v])=>`<li><span>${esc(attrName(a))}</span><strong>${attrValue(a,v)}</strong></li>`).join('')}</ul>`;
    if(nx)h+=`<h4>${t(lv?'next':'unlock')}</h4><ul class="list">${nx.map(([a,v])=>`<li><span>${esc(attrName(a))}</span><strong>${attrValue(a,v)}</strong></li>`).join('')}</ul>`;
  }
  if(block==='prev')h+=`<p class="req bad">${esc(game('needPrev'))}</p>`;
  else if(block&&block.core)h+=`<p class="req bad">${esc(game('needCore',block.core))}</p>`;
  const nc=block==='max'?null:nextCost(n);
  if(nc)h+=`<h4>${n.type==='core'?t('coreNext',{n:S.core+1}):lv?t('costNext'):esc(game('unlockCost'))}</h4><ul class="list">${costList(nc)}</ul>`;
  else if(block==='max')h+=`<p class="req">${t('maxed')}</p>`;
  if(n.type!=='core')h+=`<div class="row"><button type="button" data-act="down" ${lv?'':'disabled'}>${max>1&&lv>1?t('down'):t('remove')}</button>`+
    `<button type="button" data-act="up" class="primary" ${block?'disabled':''}>${lv?t('up'):t('unlock')}</button>`+
    (max>1?`<button type="button" data-act="max" ${block?'disabled':''}>${t('max')}</button>`:'')+`</div>`;
  card.innerHTML=h;
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function tween(elm,target){
  const from=+elm.dataset.v||0;elm.dataset.v=target;const start=performance.now();
  const step=now=>{const k=Math.min(1,(now-start)/400),e=1-(1-k)**3;elm.textContent=num(Math.round(from+(target-from)*e));if(k<1)requestAnimationFrame(step)};
  requestAnimationFrame(step);
}
function pulse(n){const g=n.el;if(!g)return;g.classList.remove('pulse');void g.getBBox();g.classList.add('pulse')}

// State in the URL: #s=6&c=7&n=418.3-104.1 (so a build can be shared as a link)
function writeHash(){
  const list=[...S.levels].sort((a,b)=>a[0]-b[0]).map(([id,lv])=>`${id}.${lv}`).join('-');
  history.replaceState(null,'',`#s=${S.season}&c=${S.core}${list?'&n='+list:''}`);
}
function readHash(){
  const p=new URLSearchParams(location.hash.slice(1));
  const season=p.get('s');if(season&&S.data.seasons[season])S.season=season;
  return {core:+p.get('c')||1,levels:(p.get('n')||'').split('-').filter(Boolean).map(x=>x.split('.').map(Number))};
}

// Wiring
function loadSeason(season,saved){
  S.season=season;nodes=S.data.seasons[season].nodes;byId=new Map(nodes.map(n=>[n.id,n]));children=new Map();
  for(const n of nodes)for(const p of n.prev){if(!children.has(p))children.set(p,[]);children.get(p).push(n.id)}
  // Outward from the core: every node after its preceding one.
  order=[];const seen=new Set(),queue=nodes.filter(n=>!n.prev.length).map(n=>n.id);
  while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);order.push(byId.get(id));queue.push(...(children.get(id)||[]))}
  for(const n of nodes)if(!seen.has(n.id))order.push(n);
  S.levels=new Map();S.core=1;S.sel=null;
  if(saved){
    S.core=Math.max(1,Math.min(10,saved.core));
    for(const [id,lv] of saved.levels){const n=byId.get(id);if(n&&n.type!=='core'&&lv>0)S.levels.set(id,Math.min(lv,maxLevel(n)))}
    normalize();
  }
  drawBoard();segments();render();
}
function segments(){
  $('seasons').innerHTML=Object.keys(S.data.seasons).map(s=>`<button type="button" role="tab" aria-selected="${s===S.season}" data-s="${s}">${t('season',{n:s})}</button>`).join('');
  $('langs').innerHTML=S.data.langs.map(l=>`<button type="button" role="tab" aria-selected="${l===S.lang}" data-l="${l}">${l.toUpperCase()}</button>`).join('');
}
function translate(){
  document.documentElement.lang=S.lang;
  for(const e of document.querySelectorAll('[data-t]'))e.textContent=t(e.dataset.t);
  $('coreTitle').textContent=game('core');$('attrsTitle').textContent=game('attrs');$('powerLabel').textContent=game('power');
  $('source').textContent=t('source',{s:tr(S.data.source)});document.title=`${t('pageTitle')} · Destiny Rising`;
  segments();render();
}
function act(n,what){
  if(what==='up')raise(n);else if(what==='down')lower(n);
  else if(what==='max'){while(!raiseBlock(n))raise(n)}
  render();
}
function showTip(n,ev){
  const tip=$('tip');
  tip.innerHTML=`<b>${esc(nodeTitle(n))}</b><span>${esc(game(n.type))}${n.type==='core'?'':' · '+t('lvl',{a:level(n),b:maxLevel(n)})}</span>`;
  tip.hidden=false;const x=Math.min(ev.clientX+14,innerWidth-tip.offsetWidth-8),y=Math.min(ev.clientY+14,innerHeight-tip.offsetHeight-8);
  tip.style.left=x+'px';tip.style.top=y+'px';
}
function aura(n,on){
  if(n.type!=='role')return;
  for(const id of new Set(Object.values(n.auraNodes).flat())){const m=byId.get(id);m&&m.el.classList.toggle('aura',on)}
}
function toast(text){
  let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el)}
  el.textContent=text;el.classList.add('show');clearTimeout(el.timer);el.timer=setTimeout(()=>el.classList.remove('show'),1600);
}
function wire(){
  const board=$('board');
  const nodeOf=ev=>{const g=ev.target.closest('.node');return g?byId.get(+g.dataset.id):null};
  board.addEventListener('click',ev=>{const n=nodeOf(ev);if(!n)return;S.sel=n.id;if(ev.shiftKey)raise(n);render()});
  board.addEventListener('contextmenu',ev=>{const n=nodeOf(ev);if(!n)return;ev.preventDefault();S.sel=n.id;lower(n);render()});
  board.addEventListener('keydown',ev=>{
    const n=nodeOf(ev);if(!n)return;
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();S.sel=n.id;render()}
    else if(ev.key==='+'||ev.key==='='||ev.key==='ArrowUp'){ev.preventDefault();S.sel=n.id;raise(n);render()}
    else if(ev.key==='-'||ev.key==='ArrowDown'){ev.preventDefault();S.sel=n.id;lower(n);render()}
  });
  board.addEventListener('pointerover',ev=>{const n=nodeOf(ev);if(n){showTip(n,ev);aura(n,true)}});
  board.addEventListener('pointermove',ev=>{const n=nodeOf(ev);if(n)showTip(n,ev)});
  board.addEventListener('pointerout',ev=>{const n=nodeOf(ev);if(n){$('tip').hidden=true;aura(n,false)}});
  $('nodeCard').addEventListener('click',ev=>{const b=ev.target.closest('button[data-act]');const n=byId.get(S.sel);if(b&&n)act(n,b.dataset.act)});
  $('coreUp').addEventListener('click',()=>{if(S.core<10){S.core++;normalize();render()}});
  $('coreDown').addEventListener('click',()=>{if(S.core>1){S.core--;normalize();render()}});
  $('fill').addEventListener('click',()=>{fillAll();render()});
  $('reset').addEventListener('click',()=>{S.levels=new Map();S.core=1;render()});
  $('share').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(location.href);toast(t('copied'))}catch{prompt(t('share'),location.href)}
  });
  $('seasons').addEventListener('click',ev=>{const b=ev.target.closest('button[data-s]');if(b&&b.dataset.s!==S.season)loadSeason(b.dataset.s)});
  $('langs').addEventListener('click',ev=>{const b=ev.target.closest('button[data-l]');if(!b)return;S.lang=b.dataset.l;try{localStorage.setItem('lang',S.lang)}catch{}translate()});
}
async function main(){
  S.data=await (await fetch('data/emanare.json')).json();
  let lang=null;try{lang=localStorage.getItem('lang')}catch{}
  S.lang=S.data.langs.includes(lang)?lang:(navigator.language||'').toLowerCase().startsWith('es')?'es':'en';
  const latest=Object.keys(S.data.seasons).sort((a,b)=>b-a)[0];S.season=latest;
  const saved=location.hash?readHash():null;
  wire();loadSeason(S.season,saved);translate();
}
main();
