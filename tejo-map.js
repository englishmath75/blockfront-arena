import {tabletRange} from './strike-path.js';
export const isTejoMap=name=>name==='유도 일제 사격' || name==='아마겟돈';
export const centeredTablet=name=>isTejoMap(name) || ['웨이브폼','계략','공중 연막','궤도 일격'].includes(name);
export function drawTejoMap(canvas,map,half,p,name,marks,cursor){
  const ctx=canvas.getContext('2d'),s=canvas.width,reach=tabletRange(name,p.down),scale=s/(2*reach);
  const X=x=>s/2+(x-p.x)*scale,Y=z=>s/2+(z-p.z)*scale;
  function circle(x,y,r,color,fill=false){
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle=ctx.fillStyle=color;
    if(fill)ctx.fill();else ctx.stroke();
  }
  ctx.save();ctx.clearRect(0,0,s,s);ctx.beginPath();ctx.arc(s/2,s/2,s/2-2,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#201523';ctx.fillRect(0,0,s,s);
  ctx.globalAlpha=.85;ctx.drawImage(map,X(-half),Y(-half),half*2*scale,half*2*scale);ctx.globalAlpha=1;
  const tint=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  if(name==='계략'){tint.addColorStop(0,'#3d205542');tint.addColorStop(.82,'#73428666');tint.addColorStop(1,'#dcb7f8be');}else if(name==='웨이브폼'){tint.addColorStop(0,'#2c184a44');tint.addColorStop(.88,'#51356a88');tint.addColorStop(1,'#eca744bb');}else{
  tint.addColorStop(0,'rgba(76,33,76,.5)');tint.addColorStop(.86,'rgba(142,74,45,.38)');tint.addColorStop(1,'rgba(255,181,75,.75)');
  }
  ctx.fillStyle=tint;ctx.fillRect(0,0,s,s);ctx.lineWidth=Math.max(1,s/220);
  for(let i=0;i<48;i++){
    const a=i*Math.PI/24,r=s*.488,inner=r-(i%4===0?s*.029:s*.011);
    ctx.beginPath();ctx.moveTo(s/2+Math.cos(a)*inner,s/2+Math.sin(a)*inner);
    ctx.lineTo(s/2+Math.cos(a)*r,s/2+Math.sin(a)*r);ctx.strokeStyle='#ffcd82';ctx.stroke();
  }
  if(name==='아마겟돈' && marks.length){
    const a=marks[0],angle=Math.atan2(cursor.z-a.z,cursor.x-a.x);
    ctx.save();ctx.translate(X(a.x),Y(a.z));ctx.rotate(angle);ctx.fillStyle='#ffb43b57';ctx.strokeStyle='#fff0a4';
    ctx.fillRect(0,-6*scale,32*scale,12*scale);ctx.strokeRect(0,-6*scale,32*scale,12*scale);ctx.restore();
  }
  const r=(name==='아마겟돈'?6:name==='웨이브폼'?4.72:name==='궤도 일격'?9:name==='공중 연막'?4.15:name==='계략'?4:4.5)*scale;
  for(const m of marks){circle(X(m.x),Y(m.z),r,'#ffb54490',true);circle(X(m.x),Y(m.z),r,'#fff0aa');}
  circle(X(cursor.x),Y(cursor.z),r,'#fff1ba');circle(X(cursor.x),Y(cursor.z),1.5,'#fff9de',true);
  ctx.translate(s/2,s/2);ctx.rotate(-p.yaw);ctx.fillStyle='#a4ffe4';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(4,4);ctx.lineTo(-4,4);ctx.fill();
  ctx.restore();
}

