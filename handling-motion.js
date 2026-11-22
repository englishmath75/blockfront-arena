import { meleeTracks } from './melee-motion.js';
import shapes from './grip-shapes.json' with { type: 'json' };
import { motionAction } from './weapon-motion.js';
import filmedPaths from './rig-paths.json' with { type:'json' };
import { recordedAction } from './recorded-weapon.js';

// Each key is [time, roll, lift, wrist turn, fingertip closure]. The same
// physical grip must pass through contact and release in opposite directions.
const inspect = {
  turn: [[0,0,0,0,0],[.18,.47,.36,-.22,.19],[.36,1,.73,.32,-.45],[.57,.83,.61,.63,-.2],[.77,-.39,.37,-.52,.44],[1,0,0,0,0]],
  trace: [[0,0,0,0,0],[.16,.42,.49,-.12,-.13],[.34,.81,.85,.48,-.85],[.55,.9,.68,.84,-.64],[.74,.29,.42,-.24,.31],[.87,-.18,.18,-.31,.47],[1,0,0,0,0]],
  float: [[0,0,0,0,0],[.17,-.28,.62,.33,-.44],[.38,-.67,1,.76,-1],[.62,.62,.89,-.77,-.78],[.81,.33,.46,-.37,.44],[1,0,0,0,0]],
  flick: [[0,0,0,0,0],[.15,-.52,.26,-.26,.51],[.29,.94,.71,.65,-.6],[.47,.78,.85,.37,-.29],[.69,-.75,.55,-.81,.32],[.83,-.34,.31,-.2,.52],[1,0,0,0,0]],
  brace: [[0,0,0,0,0],[.19,.23,.25,.23,.39],[.4,.63,.52,.36,.52],[.57,.68,.63,-.15,-.18],[.79,-.2,.29,-.31,.48],[1,0,0,0,0]],
};
const reload = {
  magazine: [[0,0,0,0,0],[.12,.33,.2,.28,-.45],[.26,.66,.49,-.39,.83],[.45,.45,.31,-.65,-.69],[.63,.62,.58,.24,.67],[.72,.86,.69,-.13,.92],[.85,.14,.26,-.36,-.34],[1,0,0,0,0]],
  cell: [[0,0,0,0,0],[.14,-.41,.44,-.43,-.71],[.29,-.7,.61,.36,.51],[.46,-.38,.87,.81,-.92],[.65,.53,.73,-.55,-.18],[.77,.64,.36,-.4,.67],[1,0,0,0,0]],
  palm: [[0,0,0,0,0],[.1,.24,.17,-.11,-.49],[.23,.64,.3,.63,.72],[.4,.35,.51,.28,-.42],[.61,.7,.36,-.35,.56],[.69,.87,.59,-.42,.9],[.83,-.25,.19,.21,-.25],[1,0,0,0,0]],
  shell: [[0,0,0,0,0],[.18,-.52,.45,.47,-.62],[.32,-.66,.39,.12,.73],[.43,-.41,.34,-.13,-.51],[.57,-.62,.46,.32,.69],[.67,-.45,.37,-.32,-.29],[.8,.24,.25,.51,.5],[1,0,0,0,0]],
  belt: [[0,0,0,0,0],[.15,.38,.22,.65,-.77],[.31,.59,.47,-.42,.64],[.51,.43,.26,-.73,-.33],[.68,.65,.55,.52,.78],[.83,-.23,.24,-.53,-.43],[1,0,0,0,0]],
};
const kinetic = /rgx|glitch|overdrive|phaseguard|araxys|protocol|magepunk|cyrax|exo|chronovoid|origin/;
const arcane = /singularity|reaver|preludetochaos|kuronami|dreamwings|mystbloom|primordium|sentinelsoflight|ion/;
const detail = /champions|neptune|oni|elderflame|gaiasvengeance|holomeridian|divergence|prime|sovereign/;
const pistols = new Set(['frenzy','classic','ghost','bandit','sheriff']);
const shellGuns = new Set(['shorty','sheriff','marshal','outlaw','bucky']);
// Poses keyed at the changes of grip in the first-person demonstrations.
// Champions dwells on the side panel; Singularity turns into an open palm.
const performances={
  champions2023:{
    inspect:[[0,0,0,0,0],[.13,.29,.54,-.3,.4],[.23,.82,.78,.18,.46],[.47,.92,.82,.28,.34],[.66,-.13,.66,-.29,.24],[.88,-.16,.65,-.33,.29],[1,0,0,0,0]],
    reload:[[0,0,0,0,0],[.20,-.48,.57,.42,.83],[.38,-.81,.88,-.65,-.59],[.55,-.55,.54,.44,.8],[.71,-.66,.71,-.14,.31],[.85,.19,.64,-.37,-.21],[1,0,0,0,0]]},
  rogue:{
    equip:[[0,0,0,0,0],[.14,.23,.44,-.37,-.39],[.33,.56,.81,.31,.52],[.52,.68,.94,.42,.72],[.70,.62,.83,-.64,.88],[.84,.18,.44,-.41,.24],[1,0,0,0,0]],
    inspect:[[0,0,0,0,0],[.18,.5,.44,.26,.45],[.43,.74,.52,.34,.49],[.58,.98,.62,.81,-.36],[.76,-.82,.68,-.54,-.76],[.85,-.71,.59,-.42,.16],[1,0,0,0,0]],
    reload:[[0,0,0,0,0],[.13,.39,.32,-.63,-.59],[.27,.54,.74,-.28,.71],[.44,.51,.48,.43,-.69],[.62,.69,.95,-.69,.89],[.78,.34,.83,.48,-.38],[1,0,0,0,0]]},
  singularityep9:{
    inspect:[[0,0,0,0,0],[.15,-.43,.56,.65,-.74],[.32,-.69,.71,.78,-.55],[.46,-.6,.75,.62,-.43],[.58,.81,.85,-.74,-.98],[.77,.93,.78,-.81,-.83],[1,0,0,0,0]],
    reload:[[0,0,0,0,0],[.16,-.36,.44,.79,-.71],[.3,-.58,.74,.56,-.93],[.53,-.69,.87,.37,-.62],[.64,-.33,.97,-.64,.69],[.79,.34,.31,-.25,.52],[1,0,0,0,0]]},
  araxys:{
    inspect:[[0,0,0,0,0],[.14,-.53,.69,.41,-.69],[.28,-.85,.9,.69,-.75],[.44,-.79,.82,.7,-.49],[.6,.68,.55,-.65,-.64],[.76,.97,.79,-.73,-.79],[.89,.34,.38,-.3,.42],[1,0,0,0,0]],
    reload:[[0,0,0,0,0],[.11,.43,.36,.55,-.78],[.25,.66,.91,-.62,-.38],[.42,.41,.64,-.52,.65],[.58,.79,.87,.55,.9],[.76,.42,.72,-.35,.17],[1,0,0,0,0]]},
  neptune:{
    inspect:[[0,0,0,0,0],[.16,.86,.86,.46,.57],[.33,.88,.8,.54,.47],[.51,.73,.65,.28,.29],[.65,-.64,.64,-.49,.63],[.83,-.58,.48,-.4,.53],[1,0,0,0,0]],
    reload:[[0,0,0,0,0],[.2,.34,.68,-.26,.62],[.36,.62,.74,.75,-.35],[.51,.59,.62,.69,.59],[.68,.81,.75,-.55,.82],[.84,.31,.47,-.33,.27],[1,0,0,0,0]]},
};

export function handlingTracks(gun, skin) {
  const shape = shapes[skin?.id];
  if (!shape) return;
  const [balance, grip, detailX, detailY, depth, chroma] = shape.map(v=>v/1000);
  const theme = skin.motionOn ? skin.banner ?? '' : '';
  const custom=gun==='vandal' ? performances[theme] : undefined;
  const heavy = gun==='ares' || gun==='odin';
  const display = arcane.test(theme) ? 'float' : kinetic.test(theme) ? 'flick' :
    detail.test(theme) ? 'trace' : heavy ? 'brace' : gun==='melee' ?
      (grip>.19 ? 'turn' : 'flick') : chroma>.15 || detailY>.44 ? 'trace' : 'turn';
  const load = heavy ? 'belt' : shellGuns.has(gun) ? 'shell' : arcane.test(theme) ? 'cell' :
    pistols.has(gun) || kinetic.test(theme) ? 'palm' : 'magazine';
  function fit(keys, action) {
    const source = motionAction(skin,action)?.path;
    return keys.map(([t,roll,rise,turn,close])=>{
      const sample=source?.[Math.round(t*(source.length-1))];
      const envelope=4*t*(1-t);
      return [
        t + (detailX-.53)*.22*envelope,
        roll*(.18+.49*depth+.11*chroma) + (sample?.[2]??0)*.18*envelope,
        rise*(.032+.083*balance+.045*grip) - (sample?.[1]??0)*.065*envelope,
        turn*(.18+.66*grip+.28*detailY),
        close*(.32+.55*depth+.29*chroma),
      ];
    });
  }
  return { ...(custom?.equip?{equip:fit(custom.equip,'equip')}:{}), ...(gun==='melee' ? meleeTracks(skin,balance,depth) : {}), inspect:fit(custom?.inspect??inspect[display],'inspect'),
    reload:gun==='melee'?undefined:fit(custom?.reload??reload[load],'reload'),
    capture:{inspect:filmedPaths[recordedAction(skin,'inspect')?.key],reload:filmedPaths[recordedAction(skin,'reload')?.key]},
    point:display==='trace', balance, grip };
}

export function sampleHandling(keys, t, out) {
  let i=1;
  while(i<keys.length-1 && t>keys[i][0]) i++;
  const a=keys[i-1], b=keys[i];
  const x=Math.min(1,Math.max(0,(t-a[0])/(b[0]-a[0])));
  const mix=x*x*(3-2*x);
  for(let j=0;j<4;j++) out[j]=a[j+1]+(b[j+1]-a[j+1])*mix;
}
