export function fieldReach(d, time) {
  const windup = d.type === 'mosh' ? .45 : d.start-d.born;
  return d.radius * Math.max(0,Math.min(1,(time-d.born)/windup));
}

export function tickGroundField(d, owner, ctx) {
  const { time, players, visible, hostile, hurt } = ctx;
  if (!owner || (d.type !== 'mosh' && d.type !== 'seize')) return;
  const center = {x:d.x, y:d.y+.1, z:d.z};
  const includes = (p,r) => !p.down && Math.abs(p.y-d.y)<1.8 &&
    Math.hypot(p.x-d.x,p.z-d.z)<=r && visible(center,p,r+2);
  if (d.type === 'seize') {
    if (d.done) return;
    d.caught ??= [];
    for (const p of players) {
      if (!hostile(owner,p) || !includes(p,fieldReach(d,time))) continue;
      if (!d.caught.includes(p.id)) {
        const loss = Math.min(Math.max(0,75-p.decayLost),Math.max(0,p.hp-1));
        p.hp -= loss;
        p.decayLost += loss;
        p.seizeRecoveryUntil = time+5;
        p.seizeRecoveryRate = Math.max(0,p.decayLost)/5;
        d.caught.push(p.id);
      }
      if (time>=d.start) {
        p.tether = {x:d.x,z:d.z,radius:d.radius,until:d.end};
        p.deafUntil = Math.max(p.deafUntil,d.end);
      }
    }
    d.done = time>=d.start;
    return;
  }
  // Tick from the impact clock so the blast and its three hits are stable at low frame rates.
  d.tick ??= 0;
  while (d.tick<33) {
    const blast = d.tick>=30;
    const at = blast ? d.start+(d.tick-30)*.1 : d.born+(d.tick+.5)*.1;
    if (time+1e-6<at) break;
    for (const p of players) {
      if (!includes(p,fieldReach(d,at))) continue;
      const distance = Math.hypot(p.x-d.x,p.z-d.z);
      const amount = blast ? (distance<=5.5 ? 50 : 25) : 1;
      hurt(p,hostile(owner,p) ? amount : amount/3,owner);
    }
    d.tick++;
  }
}
