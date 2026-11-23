import styles from './melee-families.json' with {type:'json'};

// The contact key falls at the impact time used by the melee simulation.
// The following key carries the swing through before the hand returns to guard.
const stylesByGrip = {
  straight:  [.40,.06,.35, .06,.13,-.14],
  reverse:   [-.59,.08,.72, -.30,.065,-.76],
  butterfly: [.85,.10,1.05, -.46,.075,.94],
  karambit:  [-.84,.095,.91, .67,.06,.83],
  sword:     [.57,.13,.47, -.75,.15,.56],
  heavy:     [.47,.16,.30, -.90,.20,.37],
  fan:       [.91,.09,.96, .66,.14,-.69],
  dual:      [-.58,.07,.65, -.53,.095,-.62],
  fist:      [.12,.055,.28, -.12,.095,.34],
  staff:     [.63,.13,.65, .79,.14,.77],
};
export function meleeTracks(skin,balance,depth) {
  const style=styles[skin?.id]??'straight', [roll,rise,wrist,heavy,lift,twist]=stylesByGrip[style];
  const weight=.80+balance*.34, reach=.82+depth*.32;
  function stroke(alt,sign) {
    const r=(alt?heavy:roll)*sign*weight,h=(alt?lift:rise)*reach,w=(alt?twist:wrist)*sign;
    const hit=.24;
    return [[0,0,0,0,0],[hit*.48,-r*.52,h*.30,-w*.34,.42],
      [hit,r*.70,h*.84,w*.73,.85],[alt?.43:.39,r,h,w,.65],[.67,r*.38,h*.41,w*.34,.47],[1,0,0,0,0]];
  }
  const flourish=style==='butterfly'||style==='karambit'||style==='fan',reachOut=style==='sword'||style==='staff';
  const inspect=[[0,0,0,0,0],[.16,-roll*.38,rise*.42,-wrist*.41,.44],
    [.31,roll*.86*weight,rise*reach,wrist*.8,flourish?-.78:.35],
    [.47,roll*(flourish?-.85:.82),rise*(reachOut?1.08:.74),wrist*(flourish?-1:.58),flourish?.18:.47],
    [.66,-heavy*.63*weight,lift*.66,-twist*.81,flourish?-.47:.57],
    [.83,heavy*.31,lift*.39,twist*.36,.42],[1,0,0,0,0]];
  return {inspect,guard:style==='straight'?0:roll*.27,'attack 4':stroke(false,-1),'attack 5':stroke(false,1),'attack 1':stroke(false,1),'attack 2':stroke(false,-1),'attack 3':stroke(false,1),
    'alt attack':stroke(true,1),equip:[[0,0,0,0,0],[.18,-roll*.61,rise*.64,-wrist*.51,-.43],
      [.42,roll,rise,wrist,.23],[.69,-roll*.28,rise*.32,-wrist*.18,.82],[1,0,0,0,0]]};
}
