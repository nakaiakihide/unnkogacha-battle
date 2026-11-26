export function lineAwards(config, grid, locks, bet) {
  const stake = bet / config.lines.length;
  return config.lines.flatMap((rows, index) => {
    const symbols = rows.map((row, reel) => grid[reel][row]);
    let best;
    for (const [symbol, pay] of Object.entries(config.pay)) {
      let count = 0;
      while (count < symbols.length && (symbols[count] === symbol || symbols[count] === config.wild)) count++;
      if (count < 3) continue;
      const multiplier = symbol === config.bonus?.locked && rows.slice(0, count).some((row, reel) => locks[reel][row])
        ? rows.slice(0, count).reduce((sum, row, reel) => sum + (locks[reel][row] || 1), 0)
        : 1;
      const amount = stake * pay[count - 3] * multiplier;
      if (!best || amount > best.amount) best = { index, rows, count, amount };
    }
    return best ? [best] : [];
  });
}

export function spin(config, bet, { free = false, locks, rng = Math.random } = {}) {
  if (!config.bets.includes(bet)) throw new RangeError('Invalid bet');
  const raw = config.strips.map(strip => {
    const stop = Math.floor(rng() * strip.length);
    return Array.from({length: config.rows}, (_, row) => strip[(stop + row) % strip.length]);
  });
  const nextLocks = raw.map((column, reel) => column.map((symbol, row) => {
    if (!free || !config.bonus?.locked) return 0;
    const previous = locks?.[reel]?.[row] ?? 0;
    return Math.min(config.bonus.lockLimit, previous + Number(symbol === config.bonus.locked));
  }));
  const grid = raw.map((column, reel) => column.map((symbol, row) => nextLocks[reel][row] ? config.bonus.locked : symbol));
  const scatter = config.scatter;
  const trigger = Boolean(scatter?.reels.every(reel => grid[reel].includes(scatter.symbol)));
  const scatterPay = trigger && (!free || config.bonus?.retriggerPays) ? bet * scatter.multiple : 0;
  const bonus = config.bonus;
  const awarded = trigger && bonus
    ? free ? bonus.retrigger : bonus.min + Math.floor(rng() * (bonus.max - bonus.min + 1))
    : 0;
  const wins = lineAwards(config, grid, nextLocks, bet);
  const payout = Math.min(bet * config.maxMultiple, wins.reduce((sum, win) => sum + win.amount, scatterPay));
  return { grid, locks: nextLocks, wins, trigger, scatterPay, awarded, payout };
}
