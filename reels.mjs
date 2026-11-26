import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, UPDATE_PRIORITY } from 'pixi.js';

const rows = 4;
const poolSize = rows + 2;
const accelerate = 250;
const decelerate = 450;
const atlasOrder = ['fan','gem','drum','mask','bell','gate','wild'];
const mod = (index, length) => ((index % length) + length) % length;

export function calculateProgress(elapsed, duration) {
  const t = Math.max(0, Math.min(elapsed, duration));
  const area = duration - (accelerate + decelerate) / 2;
  if (t < accelerate) return t * t / (2 * accelerate * area);
  if (t < duration - decelerate) return (t - accelerate / 2) / area;
  return 1 - (duration - t) ** 2 / (2 * decelerate * area);
}

export function prepareStrip(source, current, target, steps) {
  const size = steps + rows + 2;
  const strip = Array.from({length:size}, (_, index) => source[index % source.length]);
  current.forEach((symbol, row) => { strip[row] = symbol; });
  target.forEach((symbol, row) => { strip[mod(row - steps, size)] = symbol; });
  return strip;
}

export function beltWindow(position, pitch) {
  const base = Math.floor(position / pitch);
  return {
    offset:position - base * pitch,
    indexes:Array.from({length:poolSize}, (_, index) => index - 1 - base)
  };
}

function matchReelBackground(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image,0,0,width,height);
  const pixels = ctx.getImageData(0,0,width,height);
  for (let channel = 0; channel < pixels.data.length; channel += 4) {
    // Bake the previous lighten blend once instead of filtering every Sprite.
    pixels.data[channel] = Math.max(pixels.data[channel],0x30);
    pixels.data[channel + 1] = Math.max(pixels.data[channel + 1],0x13);
    pixels.data[channel + 2] = Math.max(pixels.data[channel + 2],0x3c);
  }
  ctx.putImageData(pixels,0,0);
  return Texture.from(canvas);
}

export class PixiReels {
  constructor(container, initial, strips) {
    this.container = container;
    this.app = new Application();
    this.reels = strips.map((source, index) => ({source, currentSymbols:initial[index], position:0, stopped:true}));
    this.ready = this.init();
  }

  async init() {
    const {clientWidth:width, clientHeight:height} = this.container;
    await this.app.init({
      preference:'webgl', width:Math.max(1,width), height:Math.max(1,height),
      autoDensity:true, resolution:Math.min(devicePixelRatio || 1, 2),
      backgroundAlpha:0, antialias:false, autoStart:false, sharedTicker:false, powerPreference:'high-performance',
      roundPixels:false
    });
    this.initialized = true;
    if (this.disposed) { this.release(); return; }
    try {
      const gl = this.app.renderer.gl;
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      this.gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
      if (/swiftshader|llvmpipe|software/i.test(this.gpu)) this.app.renderer.resolution = .75;
      const atlas = await Assets.load('/art/symbols.webp');
      if (this.disposed) return;
      const size = atlas.width / 3;
      this.reelAtlas = matchReelBackground(atlas.source.resource, atlas.width, atlas.height);
      this.textures = Object.fromEntries(atlasOrder.map((symbol, index) => [symbol,
        new Texture({source:this.reelAtlas.source, frame:new Rectangle(index % 3 * size, Math.floor(index / 3) * size, size, size)})
      ]));
      const stage = this.app.stage;
      stage.eventMode = 'none';
      this.separators = stage.addChild(new Graphics());
      this.reels.forEach(reel => {
        reel.container = stage.addChild(new Container());
        reel.background = reel.container.addChild(new Graphics());
        reel.track = reel.container.addChild(new Container());
        reel.mask = reel.container.addChild(new Graphics());
        reel.track.mask = reel.mask;
        reel.sprites = Array.from({length:poolSize}, () => {
          const sprite = reel.track.addChild(new Sprite());
          sprite.anchor.set(.5);
          return sprite;
        });
        reel.fixed = reel.container.addChild(new Container());
        reel.locks = Array.from({length:rows}, () => {
          const layer = reel.fixed.addChild(new Container());
          layer.visible = false;
          const frame = layer.addChild(new Graphics());
          const sprite = layer.addChild(new Sprite());
          sprite.anchor.set(.5);
          const label = layer.addChild(new Text({style:{fontFamily:'system-ui',fontSize:13,fontWeight:'bold',fill:'#ffe4a3'}}));
          label.anchor.set(1);
          return {layer, frame, sprite, label};
        });
      });
      this.lines = stage.addChild(new Graphics());
      this.container.append(this.app.canvas);
      this.app.ticker.add(this.tick, this, UPDATE_PRIORITY.HIGH);
      this.observer = new ResizeObserver(() => {
        if (!this.active) this.resize();
      });
      this.observer.observe(this.container);
      document.addEventListener('visibilitychange', this.visibility);
      this.resize();
    } catch (error) {
      if (!this.disposed) this.dispose();
      throw error;
    }
  }

  visibility = () => {
    if (!this.active) return;
    if (document.hidden) this.app.ticker.stop();
    else this.app.ticker.start();
  };

  resize() {
    const {clientWidth:width, clientHeight:height} = this.container;
    if (!width || !height || (this.width === width && this.height === height)) return;
    this.width = width;
    this.height = height;
    this.pitch = height / rows;
    this.column = width / this.reels.length;
    this.size = Math.min(this.pitch, this.column - 1);
    this.app.renderer.resize(width, height);
    this.separators.clear();
    this.reels.forEach((reel, index) => {
      reel.container.x = index * this.column;
      reel.mask.clear().rect(0,0,this.column - 1,height).fill(0xffffff);
      reel.background.clear().rect(0,0,this.column - 1,height).fill(0x30133c);
      if (index) this.separators.rect(index * this.column - 1,0,1,height).fill(0xb88040);
      reel.sprites.forEach(sprite => { sprite.width = sprite.height = this.size; });
      reel.locks.forEach((lock,row) => {
        lock.layer.y = row * this.pitch;
        lock.frame.clear().rect(1,1,this.column - 3,this.pitch - 2)
          .fill(0x30133c).stroke({color:0xffc765,width:2});
        lock.sprite.position.set((this.column - 1) / 2,this.pitch / 2);
        lock.sprite.width = lock.sprite.height = this.size;
        lock.label.position.set(this.column - 5,this.pitch - 4);
      });
      if (reel.stopped) {
        reel.position = (reel.steps ?? 0) * this.pitch;
        this.place(reel);
      }
    });
    this.drawLines(this.wins ?? []);
    this.app.render();
  }

  place(reel, position = reel.position) {
    const {offset,indexes} = beltWindow(position, this.pitch);
    reel.track.y = offset;
    for (const [index, logical] of indexes.entries()) {
      const sprite = reel.sprites[mod(logical,poolSize)];
      const symbol = reel.strip ? reel.strip[mod(logical,reel.strip.length)]
        : reel.currentSymbols[mod(logical,rows)];
      if (sprite.texture !== this.textures[symbol]) sprite.texture = this.textures[symbol];
      sprite.position.set((this.column - 1) / 2,(index - .5) * this.pitch);
    }
  }

  spin(result, {fast = false, reduced = false, onReelStop, onMetrics} = {}) {
    this.wins = [];
    this.drawLines([]);
    this.elapsed = 0;
    this.samples = {count:0,total:0,max:0,dropped:0};
    this.reels.forEach((reel,index) => {
      const duration = fast ? 1200 : 2000 + index * 220;
      const steps = Math.round((duration - (accelerate + decelerate) / 2) * (fast ? .020 : .014));
      Object.assign(reel, {
        duration, steps, stopped:false, position:0, velocity:0,
        strip:prepareStrip(reel.source,reel.currentSymbols,result.grid[index],steps)
      });
      this.place(reel);
    });
    return new Promise(resolve => {
      this.active = {result,reduced,bounce:fast || reduced ? 0 : 160,onReelStop,onMetrics,nextReport:0,resolve};
      if (!document.hidden) this.app.ticker.start();
    });
  }

  tick(ticker) {
    const spin = this.active;
    if (!spin) return;
    const dt = ticker.elapsedMS;
    const samples = this.samples;
    samples.count++;
    samples.total += dt;
    samples.max = Math.max(samples.max,dt);
    if (dt > 25) samples.dropped++;
    this.elapsed += dt;
    for (const [index,reel] of this.reels.entries()) {
      if (reel.stopped) continue;
      const end = reel.duration + spin.bounce;
      const target = reel.steps * this.pitch;
      const previous = reel.position;
      if (this.elapsed < reel.duration) {
        reel.position = target * calculateProgress(this.elapsed,reel.duration);
      } else if (this.elapsed < end) {
        const progress = (this.elapsed - reel.duration) / spin.bounce;
        reel.position = target + 4 * Math.sin(Math.PI * progress);
      } else {
        reel.position = target;
        reel.stopped = true;
        reel.currentSymbols = spin.result.grid[index];
        spin.onReelStop?.(index);
      }
      reel.velocity = reel.stopped || !dt ? 0 : (reel.position - previous) * 1000 / dt;
      if (!spin.reduced || reel.stopped) this.place(reel);
    }
    if (this.reels.every(reel => reel.stopped)) this.complete(spin);
    else if (spin.onMetrics && this.elapsed >= spin.nextReport) {
      spin.onMetrics(this.report());
      spin.nextReport = this.elapsed + 250;
    }
  }

  complete(spin) {
    this.active = undefined;
    this.app.ticker.stop();
    this.setLocks(spin.result.locks);
    this.wins = spin.result.wins;
    this.drawLines(this.wins);
    this.resize();
    this.app.render();
    this.metrics = this.report();
    spin.resolve();
  }

  setLocks(locks = []) {
    this.reels.forEach((reel,index) => reel.locks.forEach((lock,row) => {
      const multiple = locks[index]?.[row];
      lock.layer.visible = Boolean(multiple);
      if (!multiple) return;
      lock.sprite.texture = this.textures[reel.currentSymbols[row]];
      lock.label.text = '×' + multiple;
    }));
  }

  clearLocks() { this.setLocks(); this.app.render(); }

  drawLines(wins) {
    this.lines.clear();
    if (!wins.length) return;
    const win = wins[0];
    this.lines.moveTo(this.column / 2,(win.rows[0] + .5) * this.pitch);
    for (let index = 1; index < win.count; index++) {
      this.lines.lineTo((index + .5) * this.column,(win.rows[index] + .5) * this.pitch);
    }
    this.lines.stroke({color:0xffd77b,width:2,alpha:.62});
  }

  inspect() {
    return this.reels.map(reel => ({
      position:reel.position, stopped:reel.stopped, symbols:[...reel.currentSymbols],
      textures:beltWindow(reel.position,this.pitch).indexes.slice(1,5).map(index => {
        const texture = reel.sprites[mod(index,poolSize)].texture;
        return atlasOrder.find(symbol => this.textures[symbol] === texture);
      }),
      locks:reel.locks.map(lock => lock.layer.visible ? lock.label.text : null)
    }));
  }

  report() {
    const {count,total,max,dropped} = this.samples ?? {count:0,total:0,max:0,dropped:0};
    return {
      averageFPS:total ? 1000 * count / total : 0, averageFrameTime:count ? total / count : 0,
      maxFrameTime:max,droppedFrames:dropped,frameCount:count,
      resolution:[this.app.canvas.width,this.app.canvas.height],
      spriteCount:this.reels.length * (poolSize + rows),renderer:this.app.renderer.name,
      speed:this.reels.map(reel => reel.velocity ?? 0), gpu:this.gpu
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange',this.visibility);
    if (this.initialized) this.release();
  }

  release() {
    this.app.destroy({removeView:true},{children:true});
    Object.values(this.textures ?? {}).forEach(texture => texture.destroy(false));
    this.reelAtlas?.destroy(true);
  }
}
