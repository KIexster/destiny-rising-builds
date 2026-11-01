'use strict';
/* Character builds: the game's own recommendations (data/builds.json, built by tools/build_builds.py).
   Each character has 3 artifact builds (a piece per slot, attributes to look for, Offense/Survival/Control ratings),
   recommended weapons per slot and rarity, and the teammates it has the most affinity with. */

const UI={
  es:{pageTitle:'Builds de personajes',pageSub:'El equipamiento que recomienda el propio juego para cada personaje.',
    footer:'Proyecto de fans sin ánimo de lucro. No está afiliado a NetEase ni a Bungie.',source:'Datos del cliente del juego ({s}).',
    attrs:'Atributos a buscar',partners:'Mejores compañeros',myth:'Mítica',legend:'Legendaria',rare:'Rara',slot1:'Ranura 1',slot2:'Ranura 2',
    affinity:'Afinidad {n}/3',none:'Sin recomendación',home:'Inicio'},
  en:{pageTitle:'Character Builds',pageSub:'The loadouts the game itself recommends for each character.',
    footer:'Non-profit fan project. Not affiliated with NetEase or Bungie.',source:'Data from the game client ({s}).',
    attrs:'Attributes to look for',partners:'Best teammates',myth:'Mythic',legend:'Legendary',rare:'Rare',slot1:'Slot 1',slot2:'Slot 2',
    affinity:'Affinity {n}/3',none:'No recommendation',home:'Home'}
};
const S={data:null,lang:'es',char:null,build:1};
const $=id=>document.getElementById(id);
const t=(k,v={})=>(UI[S.lang][k]||k).replace(/\{(\w+)\}/g,(_,x)=>v[x]??'');
const tr=o=>o?(o[S.lang]||o.en||''):'';
const game=k=>tr(S.data.texts[k])||k;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1).toLowerCase():s;
const charById=id=>S.data.characters.find(c=>c.id===id);

function roster(){
  $('roster').innerHTML=S.data.characters.map(c=>`<button type="button" class="who${c.id===S.char?' on':''}" data-c="${c.id}" aria-pressed="${c.id===S.char}">
    <img src="${c.portrait}" alt="" width="56" height="56" loading="lazy"><span>${esc(tr(c.name))}</span></button>`).join('');
}
function pips(n){return [1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}
function detail(){
  const c=charById(S.char),b=c.builds.find(x=>x.id===S.build)||c.builds[0];
  const ratings=['offense','survival','control'].map(k=>`<div class="rate"><span>${esc(cap(game(k)))}</span><b class="pips">${pips(b.ratings[k])}</b></div>`).join('');
  const pieces=b.pieces.map((p,i)=>{const P=S.data.pieces[p];return `<article class="piece">
    <img src="${P.icon}" alt="" width="64" height="64" loading="lazy">
    <div><div class="kind">${esc(game('slot'))} ${i+1}${P.type?' · '+esc(tr(P.type)):''}</div><h4>${esc(tr(P.name))}</h4><p>${esc(tr(P.desc))}</p></div></article>`}).join('');
  const attrs=b.attrs.map(a=>`<span class="chip">${esc(tr(S.data.attributes[a].name))}</span>`).join('');
  const rows=['myth','legend','rare'].map(r=>`<tr><th>${t(r)}</th>${[0,1].map(s=>`<td>${(c.weapons[r][s]||[]).map(w=>{const W=S.data.weapons[w];
    return `<div class="gun q${W.quality}"><img src="${W.icon}" alt="" width="48" height="48" loading="lazy"><span>${esc(tr(W.name))}</span></div>`}).join('')||`<span class="muted">${t('none')}</span>`}</td>`).join('')}</tr>`).join('');
  const mates=c.partners.map(([id,v])=>{const m=charById(id);return m?`<button type="button" class="mate" data-c="${id}" title="${esc(t('affinity',{n:v}))}">
    <img src="${m.portrait}" alt="" width="44" height="44" loading="lazy"><span>${esc(tr(m.name))}</span><b class="pips">${pips(v)}</b></button>`:''}).join('');
  $('detail').innerHTML=`
    <div class="who-head"><img src="${c.portrait}" alt="" width="96" height="96"><div><h2>${esc(tr(c.name))}</h2>
      <div class="seg tabs" role="tablist">${c.builds.map(x=>`<button type="button" role="tab" aria-selected="${x.id===b.id}" data-b="${x.id}">${esc(tr(x.name))}</button>`).join('')}</div></div></div>
    <p class="build-desc">${esc(tr(b.desc))}</p>
    <div class="rates">${ratings}</div>
    <h3>${esc(cap(game('artifacts')))}</h3><div class="pieces">${pieces}</div>
    ${attrs?`<h3>${t('attrs')}</h3><div class="chips">${attrs}</div>`:''}
    <h3>${esc(game('weapons'))}</h3>
    <table class="guns"><thead><tr><th></th><th>${t('slot1')}</th><th>${t('slot2')}</th></tr></thead><tbody>${rows}</tbody></table>
    ${mates?`<h3>${t('partners')}</h3><div class="mates">${mates}</div>`:''}`;
  $('detail').classList.remove('enter');void $('detail').offsetWidth;$('detail').classList.add('enter');
  history.replaceState(null,'',`#${c.id}/${b.id}`);
}
function select(id,build=1){
  if(!charById(id))return;S.char=id;S.build=build;roster();detail();
  const btn=document.querySelector(`.who[data-c="${id}"]`);btn&&btn.scrollIntoView({block:'nearest',inline:'nearest'});
}
function translate(){
  document.documentElement.lang=S.lang;
  for(const e of document.querySelectorAll('[data-t]'))e.textContent=t(e.dataset.t);
  $('source').textContent=t('source',{s:tr(S.data.source)});document.title=`${t('pageTitle')} · Destiny Rising`;
  $('langs').innerHTML=S.data.langs.map(l=>`<button type="button" role="tab" aria-selected="${l===S.lang}" data-l="${l}">${l.toUpperCase()}</button>`).join('');
  roster();detail();
}
async function main(){
  S.data=await (await fetch('data/builds.json')).json();
  let lang=null;try{lang=localStorage.getItem('lang')}catch{}
  S.lang=S.data.langs.includes(lang)?lang:(navigator.language||'').toLowerCase().startsWith('es')?'es':'en';
  const [id,b]=location.hash.slice(1).split('/');
  S.char=charById(id)?id:S.data.characters[0].id;S.build=+b||1;
  $('roster').addEventListener('click',e=>{const x=e.target.closest('[data-c]');if(x)select(x.dataset.c)});
  $('detail').addEventListener('click',e=>{
    const tab=e.target.closest('[data-b]');if(tab){S.build=+tab.dataset.b;detail();return}
    const mate=e.target.closest('[data-c]');if(mate){select(mate.dataset.c);window.scrollTo({top:0,behavior:'smooth'})}
  });
  $('langs').addEventListener('click',e=>{const x=e.target.closest('[data-l]');if(!x)return;S.lang=x.dataset.l;try{localStorage.setItem('lang',S.lang)}catch{}translate()});
  translate();
}
main();
