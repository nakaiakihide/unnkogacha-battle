export const rarities = ['N','R','SR','SSR','UR'];
const entry = (characterId, name, title, rarity, gender, theme, description, image, passiveSkill, acquisitionType='gacha') => ({
  characterId,name,title,rarity,gender,theme,description,
  portraitImage:image,fullBodyImage:image,iconImage:image,gachaIllustration:image,
  cutInImage:image,backgroundImage:'/art/tower.webp',
  passiveSkill,animationConfig:{palette:rarity},voiceConfig:null,releaseDate:null,acquisitionType,isLimited:false,isAvailable:true
});

export const characters = [
  entry('luna','ルナ','星灯りの案内人','N','female','スター','初めて訪れるゲストを迎えるタワーの案内人。','/art/avatar-starter.webp',{name:'スターフレーム',description:'星色のプロフィールと当選カットイン。'},'starter'),
  entry('azure','アズール','蒼の奇術師','R','male','ブルー','光を折り曲げて客席を驚かせるステージマジシャン。','/art/character-azure.webp',{name:'ブルーライト',description:'青色のプロフィールと当選カットイン。'}),
  entry('marina','マリナ','真珠の歌姫','SR','female','パール','夜景を背に歌う、パールラウンジのボーカリスト。','/art/avatar-pearl.webp',{name:'パールライト',description:'紫色のプロフィールと当選カットイン。'}),
  entry('violet','ヴィオラ','宵の演出家','SSR','female','アメジスト','タワーの舞台を取り仕切る照明と演出の専門家。','/art/character-violet.webp',{name:'ゴールドスポット',description:'金色のプロフィールと当選カットイン。'}),
  entry('sol','ソル','黄金ステージの主役','UR','male','プリズム','光のプリズムを操るタワーの看板パフォーマー。','/art/character-sol.webp',{name:'プリズムカットイン',description:'虹色のプロフィールと当選カットイン。'}),
  entry('ruby','ルビー','紅のショーマスター','N','female','ルビー','赤いステージのショーを盛り上げる司会者。','/art/avatar-stage.webp',{name:'ルビーライト',description:'銀色のプロフィールと当選カットイン。'})
];
export const byId = Object.fromEntries(characters.map(character => [character.characterId, character]));
export const trialGacha = {
  gemCost:100, grantGems:1000, startingGems:1000, startingTickets:12,
  weights:{N:40,R:30,SR:18,SSR:9,UR:3}, duplicateReward:0,
  banners:[{name:'常設キャラクターガチャ',enabled:true},{name:'ピックアップ',enabled:false},{name:'期間限定',enabled:false}]
};
const pool = characters.filter(character => character.acquisitionType === 'gacha' && character.isAvailable);
const weightedPool = rarities.flatMap(rarity => {
  const group = pool.filter(character => character.rarity === rarity);
  return group.map(character => ({character,weight:trialGacha.weights[rarity] / group.length}));
});
const totalWeight = weightedPool.reduce((sum,item) => sum + item.weight,0);
export const rates = weightedPool.map(({character,weight}) => ({character,percent:weight / totalWeight * 100}));
const validAmount = (amount, fallback) => Number.isSafeInteger(amount) && amount >= 0 ? amount : fallback;
const oldIds = {starter:'luna',pearl:'marina',stage:'ruby'};

export function loadCollection(saved, legacy) {
  const owned = [...new Set(['luna',...(Array.isArray(saved?.owned) ? saved.owned : Array.isArray(legacy?.owned) ? legacy.owned.map(id=>oldIds[id]) : [])].filter(id=>Object.hasOwn(byId,id)))];
  const chosen = saved?.selected ?? oldIds[legacy?.equipped];
  return {
    owned, selected:owned.includes(chosen) ? chosen : 'luna',
    gems:validAmount(saved?.gems,trialGacha.startingGems),
    tickets:validAmount(saved?.tickets,validAmount(legacy?.tickets,trialGacha.startingTickets)),
    fresh:Array.isArray(saved?.fresh) ? saved.fresh.filter(id=>owned.includes(id)) : [],
    history:Array.isArray(saved?.history) ? saved.history.filter(record=>Array.isArray(record?.results) && Number.isFinite(record.at) && Number.isSafeInteger(record.cost) && record.cost >= 0 && ['tickets','gems'].includes(record.currency) && record.results.every(result=>Object.hasOwn(byId,result?.id))).slice(0,50) : []
  };
}

export function quotePull(profile,count,currency,{maxPerPull=10,allowed=true}={}) {
  if (!allowed || ![1,10].includes(count) || count > maxPerPull || !['tickets','gems'].includes(currency)) return null;
  const cost = count * (currency === 'gems' ? trialGacha.gemCost : 1);
  return {count,currency,cost,affordable:profile[currency] >= cost};
}

export function pullCharacters(profile,count,currency,{rng=Math.random,now=Date.now(),policy}={}) {
  const quote = quotePull(profile,count,currency,policy);
  if (!quote?.affordable) return null;
  const owned = new Set(profile.owned);
  const fresh = new Set(profile.fresh);
  const results = Array.from({length:count}, () => {
    let roll = rng() * totalWeight;
    const {character} = weightedPool.find(item => (roll -= item.weight) < 0) ?? weightedPool.at(-1);
    const id = character.characterId;
    const isNew = !owned.has(id);
    owned.add(id);
    if (isNew) fresh.add(id);
    return {id,isNew};
  });
  const record = {...quote,results,at:now};
  const duplicates = results.filter(item=>!item.isNew).length;
  const next = {...profile,owned:[...owned],fresh:[...fresh],history:[record,...profile.history].slice(0,50)};
  next[currency] -= quote.cost;
  next.gems += duplicates * trialGacha.duplicateReward;
  return {profile:next,record};
}
