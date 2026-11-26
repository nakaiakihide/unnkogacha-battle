export const outfits = [
  {id:'starter', name:'ラベンダー・スター', weight:0},
  {id:'pearl', name:'ターコイズ・パール', weight:75},
  {id:'stage', name:'ゴールデン・ステージ', weight:25}
];

export function loadWardrobe(raw) {
  const initial = {tickets:12, owned:['starter'], equipped:'starter'};
  try {
    const saved = JSON.parse(raw);
    if (!Number.isSafeInteger(saved?.tickets) || saved.tickets < 0 || !Array.isArray(saved.owned)) return initial;
    const owned = outfits.filter(outfit => outfit.id === 'starter' || saved.owned.includes(outfit.id)).map(outfit => outfit.id);
    return {tickets:saved.tickets, owned, equipped:owned.includes(saved.equipped) ? saved.equipped : 'starter'};
  } catch {
    return initial;
  }
}

export function drawOutfits(wardrobe, count, random = Math.random) {
  if (![1,10].includes(count) || wardrobe.tickets < count) return [];
  const prizes = outfits.filter(outfit => outfit.weight > 0);
  const total = prizes.reduce((sum, outfit) => sum + outfit.weight, 0);
  const results = [];
  for (let index = 0; index < count; index++) {
    let roll = random() * total;
    const prize = prizes.find(outfit => (roll -= outfit.weight) < 0);
    const duplicate = wardrobe.owned.includes(prize.id);
    if (!duplicate) wardrobe.owned.push(prize.id);
    results.push({...prize, duplicate});
  }
  wardrobe.tickets -= count;
  return results;
}
