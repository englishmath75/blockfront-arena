export const scopeLevels={operator:[2.5,5],outlaw:[3.5],marshal:[3.5],tour:[2.5,5]};
export function zoomFov(fov,magnification){
  return Math.atan(Math.tan(fov*Math.PI/360)/magnification)*360/Math.PI;
}
export function drawScope(canvas,gun,level,settled,skin) {
  const w=window.innerWidth,h=window.innerHeight;
  const key=[gun,level,w,h,settled,skin?.id,skin?.variant,skin?.visualOn].join('/');
  if(canvas.dataset.optic===key)return;
  canvas.dataset.optic=key;
  canvas.hidden=!gun;
  if(!gun)return;
  canvas.width=w;canvas.height=h;
  const g=canvas.getContext('2d'),x=w/2,y=h/2;
  g.translate(x,y);
  if(gun==='headhunter'){
    const u=h*.065;
    g.strokeStyle='#ffce62';g.lineWidth=Math.max(1,h/550);
    for(const side of [-1,1]){
      g.beginPath();g.moveTo(side*u*.65,-u*.5);g.lineTo(side*u,-u*.13);
      g.lineTo(side*u,.45*u);g.lineTo(side*.55*u,.8*u);g.stroke();
    }
    return;
  }
  if(!scopeLevels[gun]){
    const rogue=skin?.visualOn && skin.banner==='rogue',size=h*.11;
    g.scale(size,size);
    const colors={rogue:'#f14450',singularityep9:'#bc94ff',champions2023:'#edc064',araxys:'#9fe7de',prime:'#91e8ff'};
    g.strokeStyle=(skin?.visualOn && colors[skin.banner])||'#f9b756';
    g.lineWidth=Math.max(.017,1.15/size);g.lineCap='round';g.globalAlpha=.86;
    for(const u of [-1,1])for(const v of [-1,1]){
      g.beginPath();g.moveTo(u*(rogue?.27:.37),v*.84);g.lineTo(u*.91,v*.54);
      g.quadraticCurveTo(u*.99,v*.49,u*.99,v*.38);g.lineTo(u*.99,v*.085);g.stroke();
    }
    for(const u of [-1,1]){
      g.beginPath();g.moveTo(u*.96,0);g.lineTo(u*1.085,0);g.stroke();
      g.beginPath();g.moveTo(0,u*.76);g.lineTo(0,u*.84);g.stroke();
    }
    return;
  }
  const chamber=gun==='tour',r=h*.483;
  g.beginPath();g.rect(-x,-y,w,h);
  const contour=()=>{if(!chamber){g.moveTo(r,0);g.arc(0,0,r,0,Math.PI*2);return}
    const a=Math.min(w*.39,h*.68),b=h*.405;
    [[-a*.83,-b],[a*.80,-b],[a*.94,-b*.69],[a,-b*.47],[a,b*.48],[a*.82,b],[-a*.78,b],[-a*.92,b*.65],[-a,b*.49],[-a,-b*.48],[-a*.93,-b*.71]].forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.closePath();};
  contour();g.fillStyle=chamber?'rgba(21,14,32,.79)':'#07090b';g.fill('evenodd');
  g.beginPath();contour();g.strokeStyle=chamber?'#ffcd4f':'#25272a';g.lineWidth=chamber?Math.max(2,h/275):Math.max(2,h/180);g.stroke();
  g.save();g.beginPath();contour();g.clip();
  if(!chamber){const v=g.createRadialGradient(0,0,r*.75,0,0,r);v.addColorStop(0,'transparent');v.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=v;g.fillRect(-r,-r,2*r,2*r)}
  g.strokeStyle=chamber?'rgba(102,57,33,.87)':'#171617';g.lineWidth=Math.max(1,h/900);
  g.beginPath();g.moveTo(-x,0);g.lineTo(x,0);g.moveTo(0,-y);g.lineTo(0,y);g.stroke();
  if(settled && !chamber){g.fillStyle='#ef443c';g.beginPath();g.arc(0,0,Math.max(1,h/750),0,Math.PI*2);g.fill()}
  g.restore();
}
