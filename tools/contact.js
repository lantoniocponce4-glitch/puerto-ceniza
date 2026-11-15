#!/usr/bin/env node
// Primer contacto: cuántos segundos tardan los dos equipos en poder verse por primera vez saliendo de sus spawns, y dónde.
// En un buen mapa táctico el primer contacto llega a los 4,5 s o más (el duelo del medio de los mapas clásicos ocurre a los 5-7 s),
// lejos de los dos spawns (12 m o más), y los defensores llegan a los sitios antes que los atacantes (unos 4 a 8 s de ventaja).
// Uso: node tools/contact.js [mapas separados por coma]
'use strict';
const PC = require('../shared/core.js');
const SPEED = 5.2; // m/s corriendo con cuchillo o pistola
const maps = process.argv[2] ? process.argv[2].split(',') : Object.keys(PC.MAPS).filter(k => !PC.MAPS[k].hidden);
function dijkstra(W, starts) {
  const N = W.GW * W.GH, d = new Float32Array(N).fill(Infinity), q = [];
  for (const [x, z] of starts) { const k = W.nearestWalk(W.cIdx(x, z)); if (k >= 0) { d[k] = 0; q.push(k); } }
  // cola simple por cubos (costos 1 y 1,414)
  const open = q.slice(); let h = 0;
  while (h < open.length) {
    const k = open[h++], i = k % W.GW, j = (k / W.GW) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W.GW || nj >= W.GH) continue; const q2 = nj * W.GW + ni; if (!W.walk[q2]) continue;
      if (di && dj && (!W.walk[j * W.GW + ni] || !W.walk[nj * W.GW + i])) continue;
      const nd = d[k] + (di && dj ? 1.414 : 1); if (nd < d[q2] - 1e-6) { d[q2] = nd; open.push(q2); }
    }
  }
  return d;
}
const out = [];
for (const id of maps) {
  const M = PC.MAPS[id], W = new PC.World(id);
  const dA = dijkstra(W, M.spawns.atk), dD = dijkstra(W, M.spawns.def);
  const cells = []; for (let j = 0; j < W.GH; j += 2) for (let i = 0; i < W.GW; i += 2) { const k = j * W.GW + i; if (W.walk[k] && isFinite(dA[k]) && isFinite(dD[k])) cells.push([W.GX0 + i + .5, W.GZ0 + j + .5, dA[k] / SPEED, dD[k] / SPEED]); }
  const A = cells.slice().sort((p, q) => p[2] - q[2]), D = cells.slice().sort((p, q) => p[3] - q[3]);
  let best = Infinity, bp = null;
  for (const a of A) { if (a[2] >= best) break; for (const d of D) { if (d[3] >= best) break; const t = Math.max(a[2], d[3]); if (t >= best) continue; if (W.visible([a[0], 1.66, a[1]], [d[0], 1.66, d[1]])) { best = t; bp = [a, d]; } } }
  // con LIST=n muestra los n contactos más tempranos en lugares distintos (para corregirlos de una vez)
  if (+process.env.LIST) { const pairs = []; for (const a of A) { if (a[2] > 9) break; for (const d of D) { const t = Math.max(a[2], d[3]); if (t > 9) break; if (pairs.some(p => Math.hypot(p[1][0] - a[0], p[1][1] - a[1]) < 6 && Math.hypot(p[2][0] - d[0], p[2][1] - d[1]) < 6)) continue; if (W.visible([a[0], 1.66, a[1]], [d[0], 1.66, d[1]])) pairs.push([t, a, d]); } } pairs.sort((p, q) => p[0] - q[0]); for (const [t, a, d] of pairs.slice(0, +process.env.LIST)) console.log('   ', t.toFixed(1), 's  atacante', [a[0] | 0, a[1] | 0], ' defensor', [d[0] | 0, d[1] | 0]); }
  const site = k => { const c = M.sites[k].c, kk = W.nearestWalk(W.cIdx(c[0], c[1])); return [dA[kk] / SPEED, dD[kk] / SPEED]; };
  const sA = site('A'), sB = site('B');
  const f = v => v.toFixed(1).padStart(4);
  console.log(id.padEnd(10), 'primer contacto', f(best), 's', bp ? `atacante en (${bp[0][0] | 0}, ${bp[0][1] | 0}) · defensor en (${bp[1][0] | 0}, ${bp[1][1] | 0})` : '',
    `| sitio A: atac ${f(sA[0])} s, def ${f(sA[1])} s | sitio B: atac ${f(sB[0])} s, def ${f(sB[1])} s`);
  out.push({ id, best, sA, sB });
}
const bad = out.filter(o => o.best < 4.5 || o.sA[1] >= o.sA[0] || o.sB[1] >= o.sB[0]);
if (bad.length) { console.log('\n✗ A revisar:', bad.map(o => o.id + (o.best < 4.5 ? ' (contacto antes de 4,5 s)' : ' (los defensores no llegan antes a un sitio)')).join(', ')); process.exitCode = 1; }
