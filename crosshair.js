const colors=['#ffffff','#00ff00','#80ff00','#dfff00','#ffff00','#00ffff','#ff00ff','#ff0000'];
const known=/^(c|u|h|t|o|d|z|a|f|s|b|[01][blvgtomafeprs])$/;
export function parseCrosshair(code) {
  if(typeof code!=='string' || code.length>700)return null;
  const parts=code.trim().split(';');
  if(parts.shift()!=='0')return null;
  const profile={P:{},A:{},S:{},global:{}};
  let row=profile.global, used=false;
  for(let i=0;i<parts.length;){
    const key=parts[i++];
    if(['P','A','S'].includes(key)){row=profile[key];used=true;continue}
    const raw=parts[i++];
    if(!raw || !/^[a-z0-9]{1,3}$/.test(key))return null;
    if(key==='u'){
      if(!/^[\da-f]{6}([\da-f]{2})?$/i.test(raw))return null;
      row.u='#'+raw;continue;
    }
    if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))return null;
    if(known.test(key))row[key]=Math.max(0,Math.min(100,Number(raw)));
  }
  return used?profile:null;
}
export function reticle(canvas,profile,{color='#80ffcf',ads=false,sniper=false,move=0,fire=0}={}){
  const ctx=canvas.getContext('2d'),n=canvas.width/2;
  const cfg=sniper?profile?.S:ads && profile && profile.global.a!==0 && Object.keys(profile.A).length?profile.A:profile?.P;
  const c=cfg??{},colorId=Math.round(c.c??0);
  const ink=cfg?(colorId===8?c.u??'#ffffff':colors[colorId]??'#ffffff'):color;
  const key=[JSON.stringify(c),ink,ads,sniper,Math.round(move),Math.round(fire)].join('/');
  if(canvas.dataset.draw===key)return;
  canvas.dataset.draw=key;ctx.clearRect(0,0,n*2,n*2);
  const shapes=[];
  if(sniper){
    if(c.d===0)return;
    shapes.push([0,0,c.s??2,c.s??2,c.o??.85]);
  }else{
    if(c.d===1)shapes.push([0,0,c.z??2,c.z??2,c.a??1]);
    for(const j of [0,1]){
      if(!(c[j+'b']??(j===0 || !!cfg)))continue;
      const l=c[j+'l']??(j?2:cfg?6:7),v=c[j+'g']?c[j+'v']??l:l,t=c[j+'t']??2;
      const gap=(c[j+'o']??(j?10:3))+(c[j+'m']??(cfg?j:1))*move*(c[j+'s']??1)+(c[j+'f']??1)*fire*(c[j+'e']??1);
      const a=c[j+'a']??(j?.35:cfg?.8:1);
      shapes.push([-gap-l/2,0,l,t,a],[gap+l/2,0,l,t,a],[0,-gap-v/2,t,v,a],[0,gap+v/2,t,v,a]);
    }
  }
  for(const border of [true,false]){
    if(border && (sniper || !(c.h??1)))continue;
    const edge=border?(c.t??1):0;
    ctx.fillStyle=border?'#000':ink;
    for(const [x,y,w,h,a] of shapes){
      if(w<=0 || h<=0 || !a)continue;
      ctx.globalAlpha=border?Math.min(1,c.o??.5):Math.min(1,a);
      ctx.fillRect(Math.round(n+x-w/2)-edge,Math.round(n+y-h/2)-edge,w+2*edge,h+2*edge);
    }
  }
  ctx.globalAlpha=1;
}
