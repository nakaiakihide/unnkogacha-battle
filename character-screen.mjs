import { byId, characters, loadCollection, pullCharacters, quotePull, rarities, rates, trialGacha } from '/characters.mjs';
import { animateSummon } from '/summon.mjs';

const key = 'neo-japan-characters-v1';
const getSaved = name => { try { return JSON.parse(localStorage.getItem(name)); } catch { return null; } };
const read = () => loadCollection(getSaved(key),getSaved('neo-japan-wardrobe-v1'));
const currencyName = value => value === 'tickets' ? 'チケット' : 'ジェム';
const button = (label, action, value, extra='') => '<button data-character-action="' + action + '" data-value="' + value + '" ' + extra + '>' + label + '</button>';
const art = (character,kind='fullBodyImage') => '<img src="' + character[kind] + '" alt="">';
const rarity = character => '<span class="g-rarity ' + character.rarity + '">' + character.rarity + '</span>';

export function createCharacterScreen({dialog, modal, updateAvatar, settings}) {
  let profile=read(), latest, active=false, currency='tickets', filter='', ownership='', search='', detailOrigin='collection';
  const selected=()=>byId[profile.selected];
  const commit=next=>{
    profile=next;
    try { localStorage.setItem(key,JSON.stringify(next)); } catch {}
    updateAvatar(selected());
  };
  const view=(title,content)=>{
    modal(title,content);
    dialog.className='character-dialog';
  };
  const top=()=>'<nav class="character-top">' + button('キャラ','collection','') + button('ガチャ','gacha','') +
    '<span>ジェム <b>' + profile.gems + '</b>　チケット <b>' + profile.tickets + '</b></span>' +
    button('＋','grantInfo','','aria-label="試作用ジェムを追加"') + '</nav>';
  const card=(character,{isNew=false,duplicate=false,owned=true,action='detail',active:equipped=false}={})=>
    '<button class="character-card ' + character.rarity + (owned?'':' unowned') + '" data-character-action="'+action+'" data-value="'+character.characterId+'">' +
    rarity(character)+art(character)+'<strong>'+character.name+'</strong>' +
    (isNew?'<small class="new-item">NEW</small>':duplicate?'<small>重複</small>':equipped?'<small>設定中</small>':'')+'</button>';

  function gacha() {
    const featured=byId.sol;
    view('キャラクターガチャ',top()+'<div class="gacha-layout"><nav class="gacha-banners" aria-label="ガチャ一覧">'+
      trialGacha.banners.map(banner=>'<button '+(banner.enabled?'aria-current="true"':'disabled')+'>'+banner.name+'</button>').join('')+
      '</nav><section class="gacha-feature '+featured.rarity+'">'+art(featured,'gachaIllustration')+'<div>'+rarity(featured)+
      '<h3>'+featured.name+'</h3><p>'+featured.title+'</p><p>'+featured.description+'</p><small>'+featured.passiveSkill.name+'</small>'+
      button('キャラクター詳細','gachaDetail',featured.characterId)+'</div></section></div>'+
      '<div class="gacha-footer">'+button('提供割合','rates','')+button('履歴','history','')+
      '<label>使用通貨 <select id="gacha-currency"><option value="tickets" '+(currency==='tickets'?'selected':'')+'>チケット</option><option value="gems" '+(currency==='gems'?'selected':'')+'>ジェム</option></select></label>'+
      [1,10].map(count=>{
        const quote=quotePull(profile,count,currency);
        return button(count+'回引く · '+quote.cost+' '+currencyName(currency),'confirm',count,'class="gold"'+(quote.affordable?'':' disabled'));
      }).join('')+'</div><small class="prototype-label">試作キャラクター・試作提供割合・無料テスト通貨</small>');
  }

  function collection() {
    view('キャラクター',top()+'<div class="collection-controls"><strong>所持 '+profile.owned.length+' / '+characters.length+'</strong>'+
      '<input type="search" id="character-search" placeholder="キャラクター検索" aria-label="キャラクター検索">'+
      '<select id="character-rarity" aria-label="レアリティ"><option value="">すべてのレアリティ</option>'+rarities.map(value=>'<option>'+value+'</option>').join('')+'</select>'+
      '<select id="character-ownership" aria-label="所持状態"><option value="">すべて</option><option value="owned">所持</option><option value="missing">未所持</option></select></div>'+
      '<div class="character-grid" id="character-list"></div>');
    dialog.querySelector('#character-search').value=search;
    dialog.querySelector('#character-rarity').value=filter;
    dialog.querySelector('#character-ownership').value=ownership;
    refreshList();
  }

  function refreshList() {
    const list=dialog.querySelector('#character-list');
    const visible=characters.filter(c=>{
      const owned=profile.owned.includes(c.characterId);
      return (!filter||c.rarity===filter)&&(!ownership||(ownership==='owned' ? owned : !owned))&&
        (!search||(c.name+c.title+c.characterId).toLowerCase().includes(search.toLowerCase()));
    });
    list.innerHTML=visible.map(c=>card(c,{owned:profile.owned.includes(c.characterId),active:profile.selected===c.characterId,isNew:profile.fresh.includes(c.characterId)})).join('') || '<p>条件に一致するキャラクターがいません。</p>';
  }

  function detail(id,origin=detailOrigin) {
    const character=byId[id];
    detailOrigin=origin;
    const owned=profile.owned.includes(id);
    view(character.name,'<div class="character-detail '+character.rarity+'">'+art(character)+'<section>'+rarity(character)+'<h3>'+character.title+
      '</h3><p>'+character.description+'</p><h4>'+character.passiveSkill.name+'</h4><p>'+character.passiveSkill.description+
      '</p><p>入手方法 · '+(character.acquisitionType==='starter'?'初期配布':'常設キャラクターガチャ')+
      '</p><small class="prototype-label">試作ビジュアル・試作能力</small><div class="gacha-footer">'+
      button('戻る',origin,'')+button('演出プレビュー','preview',id)+
      (owned ? button(profile.selected===id?'設定中':'アバターに設定','equip',id,'class="gold"'+(profile.selected===id?' disabled':'')) : '')+
      '</div></section></div>');
  }

  function results() {
    if (!latest) return gacha();
    if (latest.results.length === 1) {
      const result=latest.results[0], character=byId[result.id];
      view('ガチャ結果','<div class="character-detail '+character.rarity+'">'+art(character)+'<section>'+rarity(character)+
        '<h3>'+character.name+' '+(result.isNew?'<small class="new-item">NEW</small>':'<small>重複</small>')+'</h3><h4>'+
        character.passiveSkill.name+'</h4><p>'+character.passiveSkill.description+'</p><div class="gacha-footer">'+
        button('ガチャへ','gacha','')+button('詳細','resultDetail',result.id)+
        button(profile.selected===result.id?'設定中':'アバターに設定','equipResult',result.id,'class="gold"'+(profile.selected===result.id?' disabled':''))+
        '</div></section></div>');
    } else view('10回ガチャ結果','<div class="character-grid ten-results">'+latest.results.map(result=>card(byId[result.id],{isNew:result.isNew,duplicate:!result.isNew,action:'resultDetail'})).join('')+
      '</div><div class="gacha-footer">'+button('ガチャへ','gacha','')+'</div>');
  }

  async function summon(character,next) {
    const fx=settings();
    view('召喚','<div class="summon-scene">'+art(character)+'<strong class="summon-status">召喚中</strong><button type="button">スキップ</button></div>');
    const root=dialog.querySelector('.summon-scene');
    active=true;
    try { await animateSummon(root,dialog,character,fx); }
    finally { active=false; }
    if (dialog.open && root.isConnected) next();
  }

  dialog.addEventListener('input',event=>{
    const el=event.target;
    if(el.id==='character-search') search=el.value.trim();
    else if(el.id==='character-rarity') filter=el.value;
    else if(el.id==='character-ownership') ownership=el.value;
    else if(el.id==='gacha-currency') { currency=el.value; gacha(); return; }
    else return;
    refreshList();
  });
  dialog.addEventListener('click',event=>{
    const target=event.target.closest('[data-character-action]');
    if(!target||active||target.disabled) return;
    const {characterAction:action,value}=target.dataset;
    if(action==='gacha') gacha();
    if(action==='collection') collection();
    if(action==='detail') detail(value,'collection');
    if(action==='gachaDetail') detail(value,'gacha');
    if(action==='resultDetail') detail(value,'results');
    if(action==='results') results();
    if(action==='preview') void summon(byId[value],()=>detail(value));
    if(action==='equip'||action==='equipResult') {
      if(!profile.owned.includes(value)) return;
      commit({...profile,selected:value,fresh:profile.fresh.filter(id=>id!==value)});
      if(action==='equip') detail(value);
      else results();
    }
    if(action==='grantInfo') view('試作用ジェム','<p>無料で '+trialGacha.grantGems+' ジェムを追加します。</p>'+button('追加する','grant','')+button('戻る','gacha',''));
    if(action==='grant') {commit({...profile,gems:profile.gems+trialGacha.grantGems});gacha();}
    if(action==='rates') view('提供割合（試作）','<ul class="character-rates">'+rates.map(({character,percent})=>'<li>'+rarity(character)+' '+character.name+' <b>'+percent.toFixed(2)+'%</b></li>').join('')+'</ul>'+button('戻る','gacha',''));
    if(action==='history') view('ガチャ履歴','<ol class="character-history">'+profile.history.map(record=>'<li><time>'+new Date(record.at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+
      '</time>　'+record.cost+' '+currencyName(record.currency)+' · '+record.results.map(item=>byId[item.id]?.name ?? '—').join('、')+'</li>').join('')+'</ol>'+
      (profile.history.length?'':'<p>履歴はありません。</p>')+button('戻る','gacha',''));
    if(action==='confirm'){
      const quote=quotePull(profile,Number(value),currency);
      if(!quote?.affordable)return;
      view('ガチャの確認','<p>'+quote.count+'回引きます。消費する試作通貨は <strong>'+quote.cost+' '+currencyName(currency)+'</strong> です。</p>'+
        '<div class="gacha-footer">'+button('戻る','gacha','')+button('確定して引く','pull',value,'class="gold"')+'</div>');
    }
    if(action==='pull'){
      const pull=pullCharacters(profile,Number(value),currency);
      if(!pull)return gacha();
      commit(pull.profile);
      latest=pull.record;
      const featured=latest.results.map(result=>byId[result.id]).reduce((best,item)=>rarities.indexOf(item.rarity)>rarities.indexOf(best.rarity)?item:best);
      void summon(featured,results);
    }
  });
  return {selected,openGacha:gacha,openCollection:collection};
}
