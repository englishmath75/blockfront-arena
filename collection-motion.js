import {firstPerson,inspectLength} from './actor-models.js';
import {WEAPONS} from './rules.js';
import * as T from 'three';

// Share the match renderer's player rig and pose clock for collection playback.
export function collectionMotion(container,gun,skin,agent,name,onStart){
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));container.replaceChildren(renderer.domElement);
  const view=firstPerson(), stats=WEAPONS[gun];
  const duration=name==='light'?.5:name==='heavy'?1:name==='shot'?.40:name==='reload'?stats.reload:name==='inspect'?inspectLength(gun,skin):stats.equip;
  const player={agent,kit:{},shot:-20,drawDuration:stats.equip};
  const status=document.createElement('small');status.textContent='3D 동작 준비 중';container.append(status);
  let frame,dead=false,width=0,height=0;
  function render(){
    const w=container.clientWidth,h=container.clientHeight;
    if(w>0 && h>0){
      if(w!==width || h!==height){width=w;height=h;renderer.setSize(w,h,false);}
      renderer.clear();view.render(renderer,w/h,true);
    }
  }
  const base=10;
  view.update(player,gun,skin,base,true,stats.reload);
  view.loading.then(()=>{
    if(dead)return;
    if(!view.update(player,gun,skin,base,true,stats.reload)){status.textContent='3D 동작을 불러올 수 없습니다.';return}
    status.remove();
    const start=performance.now(),from=base+(name==='equip'?0:stats.equip+.05);
    if(name==='shot'||name==='light'||name==='heavy')player.shot=from;
    if(name==='light'||name==='heavy')player.strike={weapon:gun,alt:name==='heavy',combo:1,at:from};
    if(name==='reload')player.reloading=from+duration;
    if(name==='inspect')player.inspectUntil=from+duration;
    onStart(duration);
    const draw=stamp=>{
      if(dead)return;
      const t=Math.min(duration+.15,Math.max(0,(stamp-start)/1000));
      view.update(player,gun,skin,from+t,true,stats.reload);render();
      if(t<duration+.15)frame=requestAnimationFrame(draw);
    };
    draw(start);
  });
  const resize=new ResizeObserver(render);resize.observe(container);
  return ()=>{dead=true;cancelAnimationFrame(frame);resize.disconnect();view.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();status.remove()};
}
