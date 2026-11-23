// The second mark selects a direction. All sixteen strips keep the same size.
export function strikePath(origin,marker){
  const dx=marker.x-origin.x,dz=marker.z-origin.z,length=Math.hypot(dx,dz);
  if(length<.1)return [];
  const nx=dx/length,nz=dz/length,angle=Math.atan2(-nx,-nz);
  return Array.from({length:16},(_,i)=>({x:origin.x+nx*(2*i+1),z:origin.z+nz*(2*i+1),angle,delay:3.08+i*.25}));
}
export function insideStrip(d,p){
  const x=p.x-d.x,z=p.z-d.z,s=Math.sin(d.angle),c=Math.cos(d.angle);
  return Math.abs(x*c-z*s)<=d.w/2 && Math.abs(x*s+z*c)<d.d/2 && Math.abs(p.y-d.y)<d.h;
}
export function tabletRange(name){
  return name==='웨이브폼'?55.5:name==='유도 일제 사격'?45:name==='아마겟돈'?52.5:name==='그림자 습격'?Infinity:55;
}
export function sensorArea(d,p){
  const x=p.x-d.x,z=p.z-d.z,n=d.normal;
  if(!n)return false;
  const depth=x*n[0]+z*n[2];
  return depth>=-.15 && depth<=9 && Math.abs(x*n[2]-z*n[0])<=4 && Math.abs(p.y+(p.height??1.53)*.55-d.y)<=1.15;
}

