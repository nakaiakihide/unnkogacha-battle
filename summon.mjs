import { Application, Graphics } from 'pixi.js';

const colors = {N:0xcbd2e4,R:0x51adff,SR:0xbf74ff,SSR:0xffd05a,UR:0xff92ed};
let chime;

function playChime(volume, rarity) {
  if (!window.Howl || !volume) return;
  if (!chime) {
    const rate = 16000, count = 5600;
    const bytes = new Uint8Array(44 + count * 2);
    const view = new DataView(bytes.buffer);
    for (const [offset, tag] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']]) bytes.set([...tag].map(char=>char.charCodeAt(0)),offset);
    for (const [offset,value] of [[4,bytes.length-8],[16,16],[24,rate],[28,rate*2],[40,count*2]]) view.setUint32(offset,value,true);
    for (const [offset,value] of [[20,1],[22,1],[32,2],[34,16]]) view.setUint16(offset,value,true);
    for (let index=0;index<count;index++) view.setInt16(44+index*2,
      6200 * (1-index/count)**2 * (Math.sin(index/rate*440*2*Math.PI) + .35*Math.sin(index/rate*660*2*Math.PI)),true);
    chime = new window.Howl({src:['data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes))]});
  }
  const id = chime.play();
  chime.volume(volume,id);
  chime.rate({N:1,R:1.1,SR:1.2,SSR:1.35,UR:1.5}[rarity],id);
}

export function animateSummon(root, dialog, character, {reduced, sound, volume}) {
  let instance, timeline, finished = false, timeout;
  const portrait = root.querySelector('img');
  const status = root.querySelector('.summon-status');
  return new Promise(resolve => {
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (timeline) {
        timeline.kill();
        window.gsap.ticker.sleep();
      }
      dialog.removeEventListener('close',finish);
      if (instance) instance.destroy({removeView:true},{children:true});
      resolve();
    }
    root.querySelector('button').addEventListener('click',finish,{once:true});
    dialog.addEventListener('close',finish,{once:true});
    if (sound) playChime(volume,character.rarity);
    if (reduced || !window.gsap) { timeout=setTimeout(finish,250); return; }
    const model = {angle:0,scale:.4,light:0};
    timeline = window.gsap.timeline({onComplete:finish});
    timeline.fromTo(portrait,{opacity:0,scale:.8,filter:'brightness(0)'},{opacity:.85,scale:1,filter:'brightness(0)',duration:.65})
      .to(portrait,{opacity:1,filter:'brightness(1)',duration:.45,onStart:()=>{status.textContent=character.rarity + ' · ' + character.name;}})
      .to(model,{angle:2.1,scale:1,light:1,duration:1.1},0)
      .to(model,{light:0,duration:.45},1.2).to({}, {duration:.35});
    const app=new Application();
    const {width,height}=root.getBoundingClientRect();
    app.init({width,height,backgroundAlpha:0,preference:'webgl',autoStart:false,resolution:Math.min(devicePixelRatio,1.5)})
      .then(()=>{
        if (finished) { app.destroy({removeView:true},{children:true}); return; }
        instance=app;
        root.prepend(app.canvas);
        const layer=app.stage.addChild(new Graphics());
        const radius=Math.min(width,height)*.35;
        const color=colors[character.rarity];
        const render=()=>{
          layer.clear();
          layer.circle(width/2,height/2,radius*model.scale).stroke({width:3,color,alpha:model.light});
          layer.circle(width/2,height/2,radius*.87*model.scale).stroke({width:1,color:0xffdd8a,alpha:model.light});
          for(let index=0;index<18;index++){
            const angle=index*Math.PI/9+model.angle;
            const distance=radius*(.85+(index%3)*.12)*model.scale;
            layer.circle(width/2+Math.cos(angle)*distance,height/2+Math.sin(angle)*distance,2+index%3)
              .fill({color:character.rarity==='UR' && index%2 ? 0x79eaff : color,alpha:model.light});
          }
          app.render();
        };
        timeline.eventCallback('onUpdate',render);
        render();
      }).catch(()=>{ if(app.renderer) app.destroy({removeView:true},{children:true}); });
  });
}
