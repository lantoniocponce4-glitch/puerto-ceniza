#!/usr/bin/env node
// Simula partidas completas solo con bots (sin gráficos) para medir equilibrio y detectar bots atascados o errores.
// Uso: node tools/sim-bots.js [mapas separados por coma] [recluta|veterano|elite]   ·   G=6 para más partidas por mapa
// Objetivo: atacantes y defensores entre 40 % y 60 % de rondas ganadas; pocas rondas por «time» (señal de bots atascados).
'use strict';
const PC = require('../shared/core.js');
const maps = process.argv[2] ? process.argv[2].split(',') : Object.keys(PC.MAPS).filter(k => !PC.MAPS[k].hidden);
const diff = process.argv[3] || 'veterano', games = +process.env.G || 2; let failed = false;
for (const map of maps) {
  const res = { atk: 0, def: 0, why: {}, plants: 0, kills: 0, hs: 0 }; let err = null;
  for (let g = 0; g < games && !err; g++) {
    const r = new PC.Room({ code: 'SIM', map, diff, mode: 'bomb', rules: { rounds: 9 } }); r.rotate = false; r.onSend = () => {};
    r.onBroadcast = m => { if (m.t !== 's') return; for (const e of m.ev) { if (e.k === 'rend') { res[e.side]++; res.why[e.why] = (res.why[e.why] || 0) + 1; } if (e.k === 'plant') res.plants++; if (e.k === 'kill') { res.kills++; if (e.h) res.hs++; } } };
    try { for (let t = 0; t < 60 * 25 && r.phase !== 'over'; t += .05) r.tick(.05); } catch (e) { err = e.stack.split('\n').slice(0, 3).join(' | '); failed = true; }
  }
  const tot = res.atk + res.def, pa = tot ? Math.round(res.atk / tot * 100) : 0;
  console.log(map.padEnd(10), diff, `atacantes ${pa}% (${res.atk}-${res.def})`, JSON.stringify(res.why), 'plantas', res.plants, 'bajas', res.kills, 'a la cabeza', res.kills ? Math.round(res.hs / res.kills * 100) + '%' : '-', err ? '\n   ✗ ' + err : '');
}
process.exit(failed ? 1 : 0);
