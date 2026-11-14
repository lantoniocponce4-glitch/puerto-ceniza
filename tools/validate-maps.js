#!/usr/bin/env node
// Valida los mapas: spawns caminables, bots llegan a sitios, rutas y posiciones de defensa, y sin visión de spawn a spawn.
// Uso: node tools/validate-maps.js   (sale con código 1 si algo falla)
'use strict';
const PC = require('../shared/core.js');
let bad = 0;
for (const id of Object.keys(PC.MAPS)) {
  const M = PC.MAPS[id]; if (M.hidden) continue; const W = new PC.World(id); const errs = [];
  const walk = (x, z) => { const k = W.cIdx(x, z); return k >= 0 && W.walk[k]; };
  const reach = (a, b) => { const p = W.findPath(a[0], a[1], b[0], b[1]); if (!p) return false; const e = p[p.length - 1]; return Math.hypot(e[0] - b[0], e[1] - b[1]) < 2.5; };
  for (const sd of ['atk', 'def']) for (const s of M.spawns[sd]) if (!walk(s[0], s[1])) errs.push('spawn no caminable ' + sd + ' ' + s);
  const s0 = M.spawns.atk[0], s1 = M.spawns.def[0];
  for (const k in M.sites) { const c = M.sites[k].c; if (!reach(s0, c)) errs.push('atacantes no llegan al sitio ' + k); if (!reach(s1, c)) errs.push('defensores no llegan al sitio ' + k); }
  for (const k in M.holds) for (const h of M.holds[k]) { if (!walk(h[0], h[1])) errs.push('posición de defensa no caminable ' + k + ' ' + h.slice(0, 2)); else if (!reach(s1, h)) errs.push('defensores no llegan a ' + k + ' ' + h.slice(0, 2)); }
  for (const k in M.routes) for (const r of M.routes[k]) for (const p of r) if (!walk(p[0], p[1])) errs.push('punto de ruta no caminable ' + k + ' ' + p);
  if (!reach(s0, s1)) errs.push('el spawn atacante no llega al defensor');
  const LP = []; for (const a of M.spawns.atk) for (const b of M.spawns.def) if (W.visible([a[0], 1.66, a[1]], [b[0], 1.66, b[1]])) LP.push(a + ' > ' + b);
  if (LP.length) errs.push('visión de spawn a spawn: ' + LP.join('  '));
  console.log(id.padEnd(10), 'objetos', String(M.boxes.length).padStart(3), errs.length ? '\n   ✗ ' + errs.join('\n   ✗ ') : ' ✓');
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
