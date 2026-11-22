const positionKeys=['x','y','z','height'];
const zero=()=>({x:0,y:0,z:0,height:0});
export function peerMotion() {
  let predicted, offset=zero(), history=[], clockStamp=-1, clockTarget=0;
  const tracks=new Map();
  function reset(){predicted=null;offset=zero();history=[];tracks.clear();clockStamp=-1}
  function clock(server,stamp,resetTime,current){
    clockTarget=server;clockStamp=stamp;
    return resetTime||Math.abs(current-server)>.8?server:current;
  }
  function rate(now,stamp){
    if(clockStamp<0)return 1;
    const error=clockTarget+Math.min(.5,(stamp-clockStamp)/1000)-now;
    return 1+Math.max(-.15,Math.min(.15,error*2));
  }
  const view=()=>predicted && Object.fromEntries(positionKeys.map(k=>[k,predicted[k]+offset[k]]));
  function advance(player,keys,dt,stamp,walk){
    if(!predicted)return;
    const sample={keys:new Set(keys),dt,stamp,yaw:player.yaw,pitch:player.pitch};
    history.push(sample);
    while(history.length && stamp-history[0].stamp>450)history.shift();
    predicted.yaw=sample.yaw;predicted.pitch=sample.pitch;walk(dt,predicted,sample.keys,true);
    const decay=Math.exp(-14*dt);
    for(const k of positionKeys)offset[k]*=decay;
  }
  function reconcile(player,snapTime,stamp,force,walk){
    const old=view();
    predicted={...player,pilot:player.pilot?{...player.pilot}:null};
    if(force)history=[];
    const from=Math.max(stamp-280,(player.motionStamp??stamp)+Math.max(0,snapTime-(player.motionSeen??snapTime))*1000);
    for(const s of history)if(s.stamp>from){predicted.yaw=s.yaw;predicted.pitch=s.pitch;walk(s.dt,predicted,s.keys,true)}
    offset=zero();
    if(old && !force && Math.hypot(old.x-predicted.x,old.y-predicted.y,old.z-predicted.z)<1.6)
      for(const k of positionKeys)offset[k]=old[k]-predicted[k];
  }
  function record(p,stamp,resetTrack){
    const track=tracks.get(p.id)??[],last=track.at(-1);
    if(resetTrack || last && Math.hypot(p.x-last.x,p.y-last.y,p.z-last.z)>3)track.length=0;
    track.push({x:p.x,y:p.y,z:p.z,yaw:p.yaw,stamp});if(track.length>14)track.shift();
    tracks.set(p.id,track);
  }
  function other(p,stamp){
    const track=tracks.get(p.id);
    if(!track?.length)return p;
    const last=track.at(-1),previous=track.at(-2);
    const delay=previous?Math.min(180,Math.max(75,last.stamp-previous.stamp+18)):75;
    const time=stamp-delay, i=track.findIndex(s=>s.stamp>=time);
    if(i===0)return track[0];
    if(i<0)return last;
    const a=track[i-1],b=track[i],u=(time-a.stamp)/Math.max(1,b.stamp-a.stamp),angle=b.yaw-a.yaw;
    return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u,yaw:a.yaw+Math.atan2(Math.sin(angle),Math.cos(angle))*u};
  }
  return {reset,clock,rate,advance,reconcile,view,record,other};
}
