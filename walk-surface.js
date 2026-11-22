// Only the portion of the foot that is over the step may lift the body.
// A nearby top face behind a wall is also found by the footprint support rays.
export function stepHeight(world,x,z,feet,standing,height,floor,dx=0,dz=0){
  if(!standing)return feet;
  const center=floor(x,z,feet+.33,.015),rim=floor(x,z,feet+.33,.28);
  const distance=Math.hypot(dx,dz);
  const forward=distance && rim>feet+.045 ? floor(x+.22*dx/distance,z+.22*dz/distance,feet+.33,.015) : center;
  let next=Math.max(feet,Math.min(rim,Math.max(center,forward)));
  if(next>feet+.025 && Number.isFinite(world.structure.ceiling(x,z,feet+height+.12,next+height+.12)))next=feet;
  return next;
}
