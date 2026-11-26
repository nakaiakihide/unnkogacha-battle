import { spin } from '/engine.mjs';
import { shrine } from '/shrine.mjs';
import { PixiReels } from '/reels.mjs';
import { createCharacterScreen } from '/character-screen.mjs';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const format = new Intl.NumberFormat('ja-JP');
const names = {fan:'扇', gem:'勾玉', drum:'太鼓', mask:'狐面', bell:'神楽鈴', gate:'鳥居', wild:'WILD'};
const categories = [['SLOT','スロット','▥'], ['FISHING','フィッシング','◈'], ['HORSE RACING','競馬','♞']];
const dock = [['ホーム','⌂'],['ミッション','◎'],['イベント','◇'],['ランキング','♜'],['フレンド','♧'],['ショップ','▱'],['ガチャ','◇'],['キャラ','♙'],['マイページ','◉']];
let coins = 3000, category = 0, betIndex = 0, state = 'IDLE', reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let sound = false, volume = 0.5, audio, skip, view = 'lobby';
const reelDebug = new URLSearchParams(location.search).has('reelDebug');
let renderer, reelsReady = false;
function updateReelDebug(metrics) {
  const values = list => list.map(value => value.toFixed(2)).join(' / ');
  renderer.debug.textContent = 'PixiJS ' + metrics.version + ' · ' + metrics.renderer +
    ' · FPS ' + metrics.observedFPS.toFixed(1) + ' / 平均 ' + metrics.averageFPS.toFixed(1) +
    ' · 平均Δ ' + metrics.averageFrameTime.toFixed(2) + ' ms · 最大Δ ' + metrics.maxFrameTime.toFixed(2) +
    ' ms · 25 ms超 ' + metrics.droppedFrames + ' / ' + metrics.frameCount +
    '\ndeltaMS ' + metrics.deltaMS.toFixed(2) + ' · elapsedMS ' + metrics.rawFrameMS.toFixed(2) +
    ' · ' + metrics.spriteCount + ' Sprites · ' + metrics.textureCount + ' Textures / ' + metrics.textureSourceCount +
    ' atlas · ' + metrics.resolution.join('×') + ' · DPR ' + metrics.devicePixelRatio +
    '\n座標 px ' + values(metrics.positions) + '\n移動 px/frame ' + values(metrics.frameDistance) +
    '\n速度 px/s ' + values(metrics.speed);
}

let speed = 'normal', autoRemaining = 0, autoRunning = false;
let holdTimer, longPress = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const balance = () => '<span class="balance"><i>◉</i><strong>' + format.format(coins) + '</strong></span>';

function modal(title, body) {
  dialog.className = '';
  dialog.innerHTML = '<div class="modal-heading"><h2>' + title + '</h2><button data-close aria-label="閉じる">×</button></div>' + body;
  if (!dialog.open) dialog.showModal();
}

const characterScreen = createCharacterScreen({
  dialog, modal,
  settings:() => ({sound,volume,reduced}),
  updateAvatar(character) {
    document.querySelectorAll('#app [data-avatar]').forEach(img => {
      img.src = img.closest('.avatar') ? character.iconImage : character.fullBodyImage;
    });
  }
});
const avatarSrc = () => characterScreen.selected().fullBodyImage;

function settings() {
  modal('設定', '<label><input type="checkbox" id="reduced"' + (reduced ? ' checked' : '') + '> 演出を軽減</label><label><input type="checkbox" id="sound"' + (sound ? ' checked' : '') + '> サウンド</label><label>音量 <input id="volume" type="range" min="0" max="100" value="' + volume * 100 + '"></label>');
}

function lobby() {
  renderer?.dispose();
  renderer = undefined;
  reelsReady = false;
  view = 'lobby';
  const posters = category === 0
    ? '<button class="poster featured" data-enter aria-label="電脳神社をプレイ"><img src="/art/neon-shrine-poster.webp" alt=""><span class="live-tag"><b></b> プレイ可能</span><span class="poster-copy"><small>CYBER SHRINE</small><strong>電脳神社</strong><span class="play-label">プレイ <b aria-hidden="true">›</b></span></span></button>' +
      Array.from({length: 4}, (_, index) => '<div class="poster locked p' + index + '"><span class="poster-copy"><strong>近日公開</strong></span></div>').join('')
    : '<div class="empty"><span>' + categories[category][2] + '</span><h2>' + categories[category][1] + '</h2><p>近日公開</p></div>';
  app.innerHTML = '<div class="lobby"><header class="hud"><div class="brand"><span class="brand-mark" aria-hidden="true"></span><div>ネオジャパンカジノタワー<small>NEO JAPAN CASINO TOWER</small></div></div><div class="hud-right"><button class="player" data-info="マイページ"><span class="avatar"><img data-avatar alt="" src="' + avatarSrc() + '"></span><span>RANK <b>1</b><meter min="0" max="100" value="0" aria-label="経験値"></meter></span></button>' + balance() + '<button class="gold square" data-refill aria-label="コイン補充">＋</button><button class="square" data-info="プレゼント" aria-label="プレゼント">♙</button><button class="square" data-settings aria-label="設定">⚙</button></div></header>' +
    '<div class="lobby-body"><aside class="avatar-stage"><img data-avatar alt="プレイヤーアバター" src="' + avatarSrc() + '"><button data-characters>キャラクター</button></aside><nav class="rail" aria-label="カテゴリー">' + categories.map(([en,jp,icon], index) => '<button data-category="' + index + '" aria-pressed="' + (category === index) + '"><span>' + icon + '</span><strong>' + en + '</strong><small>' + jp + '</small></button>').join('') + '</nav><section class="selection"><div class="section-heading"><h1>' + categories[category][1] + '</h1><span>' + categories[category][0] + '</span></div><div class="posters" tabindex="0" aria-label="ゲーム一覧">' + posters + '</div></section></div>' +
    '<nav class="dock" aria-label="メニュー">' + dock.map(([label,icon], index) => '<button ' + (index ? (label === 'ガチャ' ? 'data-gacha' : label === 'キャラ' ? 'data-characters' : 'data-info="' + label + '"') : 'data-home aria-current="page"') + '><span' + (label === 'ガチャ' ? ' class="gacha-icon" aria-hidden="true"' : '') + '>' + icon + '</span>' + label + '</button>').join('') + '</nav></div>';
}

function game() {
  view = 'game';
  app.innerHTML = '<div class="game"><header class="hud"><button data-home>‹ ロビー</button><div class="machine-title">電脳神社 <small>CYBER SHRINE</small></div><div class="hud-right">' + balance() + '<button data-refill class="gold square" aria-label="コイン補充">＋</button><button data-help class="square" aria-label="ヘルプ">ⓘ</button><button data-settings class="square" aria-label="設定">⚙</button></div></header><div class="stage"><img class="game-avatar" data-avatar alt="プレイヤーアバター" src="' + avatarSrc() + '"><div class="bonus-status" aria-live="polite"></div><div class="board"><div class="slot-reels" role="img" aria-label="5リール、4行"></div></div><div class="reach" hidden>リーチ！</div></div><footer class="controls"><button data-bet="-1" aria-label="ベット減少">−</button><div class="readout">TOTAL BET<strong id="bet"></strong></div><button data-bet="1" aria-label="ベット増加">＋</button><div class="readout result" id="result" aria-live="polite"></div><fieldset class="speed" aria-label="スピン速度"><button type="button" data-speed="normal">通常</button><button type="button" data-speed="fast">高速</button></fieldset><div class="spin-actions"><button class="auto-control" data-auto>自動回転</button><button class="gold spin" data-spin>SPIN</button></div></footer></div>';
  const slotReels = document.querySelector('.slot-reels');
  let debug;
  if (reelDebug) {
    debug = document.createElement('pre');
    debug.className = 'reel-debug';
    slotReels.closest('.stage').append(debug);
  }
  const initial = shrine.strips.map((strip,reel) => Array.from({length:4}, (_,row) => strip[(reel * 2 + row) % strip.length]));
  const instance = new PixiReels(slotReels, initial, shrine.strips);
  instance.debug = debug;
  renderer = instance;
  if (reelDebug) {
    window.inspectReels = () => instance.inspect();
    window.reelMetrics = () => instance.metrics;
  }
  sync();
  instance.ready.then(() => {
    if (renderer !== instance) return;
    if (debug) updateReelDebug(instance.report());
    reelsReady = true;
    sync();
  }).catch(() => {
    if (renderer === instance) document.querySelector('#result').textContent = 'WebGLのリールを起動できませんでした';
  });
}

function sync() {
  document.querySelector('.balance strong').textContent = format.format(coins);
  if (view === 'lobby') return;
  const busy = state !== 'IDLE' || autoRunning;
  document.querySelector('#bet').textContent = format.format(shrine.bets[betIndex]);
  for (const button of document.querySelectorAll('[data-home],[data-refill],[data-spin],[data-bet],[data-help],[data-settings],[data-speed]')) {
    const nextBet = betIndex + Number(button.dataset.bet);
    button.disabled = busy || (button.hasAttribute('data-spin') && !reelsReady) || (button.hasAttribute('data-bet') && !(nextBet in shrine.bets));
  }
  for (const button of document.querySelectorAll('[data-speed]')) {
    button.setAttribute('aria-pressed', String(button.dataset.speed === speed));
  }
  const auto = document.querySelector('[data-auto]');
  auto.disabled = !reelsReady || (busy && !autoRemaining);
  auto.textContent = autoRemaining ? '自動停止 · ' + (autoRemaining === Infinity ? '∞' : autoRemaining) : '自動回転';

}

function tone(frequency) {
  if (!sound || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = frequency;
  oscillator.connect(gain).connect(audio.destination);
  gain.gain.setValueAtTime(volume * .16, audio.currentTime);
  gain.gain.linearRampToValueAtTime(0, audio.currentTime + .13);
  oscillator.start();
  oscillator.stop(audio.currentTime + .13);
}

async function present(result, bet) {
  const board = document.querySelector('.board');
  const reach = document.querySelector('.reach');
  const anticipation = speed !== 'fast' && result.grid.slice(0,2).every(column => column.includes('gate'));
  state = 'REEL_STOPPING';
  await renderer.spin(result, {
    fast:speed === 'fast', reduced,
    onMetrics:renderer.debug ? updateReelDebug : undefined,
    onReelStop(index) {
      tone(270 + index * 55);
      reach.hidden = !(anticipation && index === 1);
      board.classList.toggle('anticipation', !reach.hidden);
      if (!reach.hidden) tone(523);
    }
  });
  if (renderer.debug) updateReelDebug(renderer.metrics);
  renderer.container.setAttribute('aria-label', result.grid.map((column,index) =>
    'リール' + (index + 1) + ' ' + column.map(symbol => names[symbol]).join('、')
  ).join('。'));
  state = 'RESULT';
  coins += result.payout;
  sync();
  document.querySelector('#result').innerHTML = result.payout ? '<strong>+' + format.format(result.payout) + '</strong>' : '';
  const tier = shrine.winTiers.find(({multiple}) => result.payout >= bet * multiple);
  if (tier && !result.awarded && !reduced) await showWin(tier, result.payout);
}

async function showWin(tier, payout) {
  state = 'WIN_ANIMATION';
  const stage = document.querySelector('.stage');
  const overlay = document.createElement('div');
  const character = characterScreen.selected();
  overlay.className = 'win-overlay ' + tier.id;
  overlay.innerHTML = '<div class="win-sparks" aria-hidden="true"></div><div class="win-panel">' +
    '<div class="win-gate" aria-hidden="true"></div><div class="win-title">' + tier.id.toUpperCase() +
    ' WIN</div><strong class="win-value"></strong><button data-skip>スキップ</button></div>';
  const cutIn = document.createElement('img');
  cutIn.className = 'character-win-portrait ' + character.rarity;
  cutIn.src = character.cutInImage;
  cutIn.alt = '';
  overlay.prepend(cutIn);
  const particles = overlay.querySelector('.win-sparks');
  for (let index = 0; index < tier.particles; index++) {
    const particle = document.createElement('i');
    particle.style.setProperty('--x', (index * 37 % 101) + '%');
    particle.style.setProperty('--offset', (index * 43 % 151 - 75) + 'px');
    particle.style.setProperty('--delay', (index * 73 % 510) + 'ms');
    particles.append(particle);
  }
  stage.append(overlay);
  const value = overlay.querySelector('.win-value');
  const started = performance.now();
  let frame;
  function countUp(now) {
    const progress = Math.min(1, (now - started) / (tier.duration * .72));
    value.textContent = format.format(Math.floor(payout * (1 - (1 - progress) ** 3)));
    if (progress < 1) frame = requestAnimationFrame(countUp);
  }
  value.textContent = '0';
  frame = requestAnimationFrame(countUp);
  tone(tier.id === 'golden' ? 880 : 660);
  await new Promise(resolve => {
    const timeout = setTimeout(resolve, tier.duration);
    skip = () => { clearTimeout(timeout); resolve(); };
  });
  skip = undefined;
  cancelAnimationFrame(frame);
  overlay.remove();
}

async function showScatter(result, extraSpins = 0) {
  const stage = document.querySelector('.stage');
  const panel = document.createElement('div');
  panel.className = 'scatter-scene' + (extraSpins ? ' retrigger' : '') + (reduced ? ' quiet' : '');
  panel.innerHTML = '<div class="scatter-gates" aria-hidden="true"><i></i><i></i><i></i></div>' +
    '<div class="scatter-card" aria-live="polite"><span class="scatter-label">' +
    (extraSpins ? '再参拝' : '鳥居が3つ揃いました') + '</span><strong class="scatter-title">' +
    (extraSpins ? '+' + extraSpins + ' フリースピン' : '参拝ガチャ') + '</strong>' +
    '<span class="scatter-detail">' + (extraSpins ? '神楽鈴のロックを引き継ぎます' : '鳥居配当 +' + format.format(result.scatterPay)) +
    '</span></div><button data-skip class="scatter-skip">スキップ</button>';
  stage.append(panel);
  tone(extraSpins ? 784 : 659);
  await new Promise(resolve => {
    const reveal = extraSpins ? undefined : setTimeout(() => {
      panel.classList.add('revealed');
      panel.querySelector('.scatter-title').textContent = result.awarded + ' フリースピン';
      panel.querySelector('.scatter-detail').textContent = '追加ベットなし';
      tone(988);
    }, reduced ? 120 : 1300);
    const finish = setTimeout(resolve, reduced ? 450 : extraSpins ? 1150 : 2700);
    skip = () => { clearTimeout(reveal); clearTimeout(finish); resolve(); };
  });
  skip = undefined;
  panel.remove();
}

function finishBonus(total, bet) {
  modal('フリーゲーム結果', '<div class="bonus-total"><span>獲得枚数<strong>' + format.format(total) + '</strong></span><span>合計倍率<strong>×' + format.format(total / bet) + '</strong></span></div>');
  return new Promise(resolve => dialog.addEventListener('close', resolve, {once:true}));
}

async function play() {
  if (state !== 'IDLE' || !reelsReady) return;
  const bet = shrine.bets[betIndex];
  if (coins < bet) {
    autoRemaining = 0;
    modal('コイン残高不足', '<p>スピンするにはコインを補充してください。</p><button class="gold" data-refill>1,000 コイン補充</button>');
    return;
  }
  if (sound && window.AudioContext) {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
  }
  state = 'SPINNING';
  coins -= bet;
  sync();
  document.querySelector('#result').textContent = '';
  const paid = spin(shrine, bet);
  await present(paid, bet);
  if (paid.awarded) {
    const status = document.querySelector('.bonus-status');
    const gameScreen = document.querySelector('.game');
    gameScreen.classList.add('bonus-mode');
    state = 'BONUS_START';
    await showScatter(paid);
    let remaining = paid.awarded, played = 0, total = 0, locks;
    while (remaining > 0) {
      state = 'FREE_SPINNING';
      status.textContent = '残り ' + remaining + '　累計 ' + format.format(total) + '　ロック ' + (locks?.flat().filter(Boolean).length ?? 0);
      const outcome = spin(shrine, bet, {free:true, locks});
      await present(outcome, bet);
      played++;
      remaining--;
      total += outcome.payout;
      locks = outcome.locks;
      if (outcome.awarded) {
        const added = Math.min(outcome.awarded, shrine.bonus.limit - played - remaining);
        if (added > 0) {
          state = 'RETRIGGER';
          remaining += added;
          status.textContent = '残り ' + remaining + '　累計 ' + format.format(total) + '　ロック ' + locks.flat().filter(Boolean).length;
          await showScatter(outcome, added);
        }
      }
      await pause(reduced ? 75 : 250);
    }
    state = 'BONUS_END';
    await finishBonus(total, bet);
    status.textContent = '';
    gameScreen.classList.remove('bonus-mode');
    renderer.clearLocks();
  }
  state = 'IDLE';
  sync();
}

function autoMenu() {
  modal('自動回転', '<div class="auto-options">' + [10, 30, 50, 100, Infinity].map(count =>
    '<button data-rounds="' + count + '">' + (count === Infinity ? '∞ 無制限' : count + '回') + '</button>'
  ).join('') + '</div>');
}

async function runAuto(count) {
  if (autoRunning || state !== 'IDLE') return;
  dialog.close();
  autoRunning = true;
  autoRemaining = count;
  sync();
  while (autoRemaining > 0 && !document.hidden) {
    await play();
    if (autoRemaining > 0) autoRemaining--;
    sync();
    if (autoRemaining > 0) await pause(reduced ? 75 : 280);
  }
  autoRemaining = 0;
  autoRunning = false;
  sync();
}

app.addEventListener('pointerdown', event => {
  const button = event.target.closest('[data-spin]');
  if (!button || button.disabled || !event.isPrimary || event.button !== 0) return;
  longPress = false;
  holdTimer = setTimeout(() => {
    longPress = true;
    autoMenu();
  }, 500);
});
for (const type of ['pointerup', 'pointercancel', 'pointermove']) {
  window.addEventListener(type, event => {
    if (type !== 'pointermove' || !event.target.closest?.('[data-spin]')) clearTimeout(holdTimer);
  });
}
app.addEventListener('contextmenu', event => {
  if (event.target.closest('[data-spin]')) event.preventDefault();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(holdTimer);
    autoRemaining = 0;
    if (view === 'game') sync();
  }
});

function help(section = 'free') {
  const bonus = shrine.bonus;
  const pages = {
    free: '<p>参拝ガチャで ' + bonus.min + '〜' + bonus.max + ' 回。追加ベットなしで自動連転します。</p><p>神楽鈴はそのマスに固定され、内部抽選で再出現すると最大 ×' + bonus.lockLimit + ' に増加します。鈴ラインの倍率は一致マスの倍率の合計です。</p><p>リトリガーは +' + bonus.retrigger + ' 回。合計上限は ' + bonus.limit + ' 回。突入時の鳥居配当はフリーゲーム累計から除外します。</p>',
    scatter: '<p>鳥居は第1〜第3リールに各1個まで出現します。3リールすべてに揃うと TOTAL BET ×' + shrine.scatter.multiple + ' とフリーゲームを獲得します。</p><p>フリーゲーム中は鳥居の配当なし。1回の配当上限は TOTAL BET ×' + shrine.maxMultiple + ' です。</p>',
    pay: '<table><caption>試作配当・1ラインBET基準</caption><thead><tr><th>図柄</th><th>3個</th><th>4個</th><th>5個</th></tr></thead><tbody>' + Object.entries(shrine.pay).map(([symbol, pay]) => '<tr><th>' + names[symbol] + '</th>' + pay.map(value => '<td>×' + value + '</td>').join('') + '</tr>').join('') + '</tbody></table>'
  };
  modal('電脳神社 ヘルプ', pages[section] + '<nav class="help-tabs">' + Object.entries({free:'フリーゲーム',scatter:'SCATTER',pay:'配当表'}).map(([key,label]) => '<button data-section="' + key + '" aria-pressed="' + (key === section) + '">' + label + '</button>').join('') + '</nav>');
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if ('characters' in data) characterScreen.openCollection();
  if ('gacha' in data) characterScreen.openGacha();
  if ('skip' in data) skip?.();
  if ('close' in data) dialog.close();
  if ('settings' in data) settings();
  if ('section' in data) help(data.section);
  if ('help' in data) help();
  if ('info' in data) {
    const character = characterScreen.selected();
    const profileViews = ['マイページ','ランキング','フレンド'];
    modal(data.info, profileViews.includes(data.info)
      ? '<div class="profile-character '+character.rarity+'"><img src="'+character.portraitImage+'" alt=""><div><strong>'+character.name+
        '</strong><p>RANK 1 · 所持コイン '+format.format(coins)+'</p>'+
        (data.info === 'マイページ' ? '<button data-characters>キャラクター</button>' : '<p>近日公開</p>')+'</div></div>'
      : '<p>近日公開</p>');
  }
  if ('refill' in data && state === 'IDLE') {
    coins += 1000;
    sync();
    if (dialog.open) dialog.close();
  }
  if ('category' in data) {
    category = Number(data.category);
    lobby();
    document.querySelector('[data-category="' + category + '"]').focus();
  }
  if ('enter' in data) game();
  if ('home' in data && state === 'IDLE') { category = 0; lobby(); }
  if ('bet' in data && state === 'IDLE') { betIndex += Number(data.bet); sync(); }
  if ('speed' in data) { speed = data.speed; sync(); }
  if ('auto' in data) {
    if (autoRunning) { autoRemaining = 0; sync(); }
    else autoMenu();
  }
  if ('rounds' in data) void runAuto(Number(data.rounds));
  if ('spin' in data) {
    if (!longPress || event.detail === 0) void play();
    longPress = false;
  }
});

dialog.addEventListener('input', event => {
  if (event.target.id === 'sound') sound = event.target.checked;
  if (event.target.id === 'reduced') reduced = event.target.checked;
  if (event.target.id === 'volume') volume = Number(event.target.value) / 100;
});

window.measureGame = () => {
  const size = element => {
    const {width, height} = element.getBoundingClientRect();
    return {width, height};
  };
  const measure = selector => [...document.querySelectorAll(selector)].map(size);
  return {viewport:{width:innerWidth,height:innerHeight}, hud:measure('.hud'), dock:measure('.dock'), posters:measure('.poster'), tabs:measure('.rail button'), board:measure('.board'), symbols:renderer?.pitch ? Array.from({length:20}, () => ({width:renderer.column,height:renderer.pitch})) : []};
};

lobby();
