const patterns = ['00000', '11111', '22222', '33333'];
for (const step of [1, 2, 3]) {
  for (let start = 0; start < 4; start++) {
    for (const shape of [[0,1,2,3,4], [0,1,2,1,0], [0,0,1,1,2], [0,1,1,2,2]]) {
      patterns.push(shape.map(offset => (start + step * offset) % 4).join(''));
    }
  }
}

patterns.push("01310", "32023");

// Fixed cyclic strips. Each reel draws a single independent, uniform stop.
const ordinary = ['fan','gem','drum','mask','fan','gem','bell','drum','fan','gem','wild','mask','fan','drum','gem','fan','bell','mask','drum','gem','fan','drum','gem','mask'];
const strips = Array.from({length: 5}, (_, reel) => {
  const shift = reel * 5;
  const strip = ordinary.slice(shift).concat(ordinary.slice(0, shift));
  if (reel < 3) strip[7] = 'gate';
  return strip;
});

export const shrine = {
  id: 'cyber-shrine',
  name: '電脳神社',
  version: 'prototype-1',
  rows: 4,
  strips,
  lines: [...new Set(patterns)].slice(0, 50).map(line => [...line].map(Number)),
  bets: [200, 500, 1000, 2500, 5000],
  wild: 'wild',
  scatter: { symbol: 'gate', reels: [0,1,2], multiple: 2 },
  bonus: { min: 5, max: 20, retrigger: 10, limit: 60, locked: 'bell', lockLimit: 5, retriggerPays: false },
  maxMultiple: 1000,
  winTiers: [
    {id: 'golden', multiple: 50, duration: 2500, particles: 32},
    {id: 'super', multiple: 15, duration: 2100, particles: 20},
    {id: 'big', multiple: 5, duration: 1600, particles: 10}
  ],
  pay: { fan: [2,5,10], gem: [3,8,16], drum: [4,12,25], mask: [5,18,45], bell: [7,25,70], wild: [10,40,100] }
};
