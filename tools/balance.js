#!/usr/bin/env node
// Equilibrio de los mapas con muchas partidas simuladas (solo bots, sin gráficos), en paralelo en todos los núcleos.
// Para cada mapa calcula el % de rondas que ganan los atacantes y su margen de confianza del 95 % (intervalo de Wilson):
// así se distingue un mapa desequilibrado de verdad de la mala suerte de pocas partidas.
//   node tools/balance.js                    todos los mapas, 12 partidas de 9 rondas por mapa
//   G=20 node tools/balance.js muelle,oasis  más partidas, solo esos mapas
//   OUT=informe.md node tools/balance.js     además escribe el informe en Markdown (lo usa la prueba nocturna de GitHub)
// Veredicto: «equilibrado» si el % está entre 40 y 60; «revisar» si todo el margen de confianza queda fuera de 40-60;
// «dudoso» en el resto (faltan partidas para decidir).
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os'), fs = require('fs');

function playGame(map, diff, seed) {
  const PC = require('../shared/core.js');
  const res = { atk: 0, def: 0, why: {}, time: 0, err: null };
  const r = new PC.Room({ code: 'SIM' + seed, map, diff, mode: 'bomb', rules: { rounds: 9 } }); r.rotate = false; r.onSend = () => {};
  r.onBroadcast = m => { if (m.t !== 's') return; for (const e of m.ev) if (e.k === 'rend') { res[e.side]++; res.why[e.why] = (res.why[e.why] || 0) + 1; } };
  try { for (let t = 0; t < 60 * 25 && r.phase !== 'over'; t += .05) r.tick(.05); } catch (e) { res.err = e.stack.split('\n').slice(0, 3).join(' | '); }
  return res;
}

if (!isMainThread) {
  for (const job of workerData.jobs) parentPort.postMessage({ map: job.map, res: playGame(job.map, workerData.diff, job.seed) });
  return;
}

const PC = require('../shared/core.js');
const maps = process.argv[2] ? process.argv[2].split(',') : Object.keys(PC.MAPS).filter(k => !PC.MAPS[k].hidden);
const diff = process.argv[3] || 'veterano', games = +process.env.G || 12, nW = Math.max(1, Math.min(os.cpus().length, +process.env.W || 8));
const jobs = []; for (const map of maps) for (let g = 0; g < games; g++) jobs.push({ map, seed: g });
const buckets = Array.from({ length: nW }, () => []); jobs.forEach((j, i) => buckets[i % nW].push(j));
const agg = {}; for (const m of maps) agg[m] = { atk: 0, def: 0, why: {}, games: 0, errs: [] };
const t0 = Date.now(); let done = 0;

// intervalo de Wilson del 95 % para una proporción
function wilson(k, n) { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; }

Promise.all(buckets.filter(b => b.length).map(b => new Promise((ok, fail) => {
  const w = new Worker(__filename, { workerData: { jobs: b, diff } });
  w.on('message', ({ map, res }) => { const a = agg[map]; a.atk += res.atk; a.def += res.def; a.games++; for (const k in res.why) a.why[k] = (a.why[k] || 0) + res.why[k]; if (res.err) a.errs.push(res.err); done++; if (process.stderr.isTTY) process.stderr.write(`\r${done}/${jobs.length} partidas`); });
  w.on('error', fail); w.on('exit', ok);
}))).then(() => {
  if (process.stderr.isTTY) process.stderr.write('\n');
  const rows = []; let failed = false;
  for (const m of maps) {
    const a = agg[m], n = a.atk + a.def, p = n ? a.atk / n : 0, [lo, hi] = wilson(a.atk, n), timeR = a.why.time || 0;
    const verdict = a.errs.length ? 'ERROR' : (p >= .4 && p <= .6) ? 'equilibrado' : (hi < .4 || lo > .6) ? 'revisar' : 'dudoso';
    if (a.errs.length) failed = true;
    rows.push({ m, n, p, lo, hi, verdict, timeR, why: a.why, errs: a.errs });
  }
  const pct = v => Math.round(v * 100) + ' %';
  const lines = [`## Equilibrio de mapas (${diff}, ${games} partidas de 9 rondas por mapa, ${Math.round((Date.now() - t0) / 1000)} s)`, '',
    '| Mapa | Rondas | Atacantes ganan | Margen 95 % | Rondas por tiempo | Veredicto |', '|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.m} | ${r.n} | ${pct(r.p)} | ${pct(r.lo)} – ${pct(r.hi)} | ${r.timeR} | ${r.verdict === 'revisar' ? '⚠️ ' : r.verdict === 'ERROR' ? '❌ ' : ''}${r.verdict} |`);
  lines.push('', 'Meta: atacantes entre 40 % y 60 %. «Revisar»: todo el margen queda fuera de la meta. «Dudoso»: faltan partidas para decidir. Muchas rondas por tiempo suelen indicar bots atascados.');
  for (const r of rows) for (const e of r.errs.slice(0, 2)) lines.push('', `❌ ${r.m}: \`${e}\``);
  const md = lines.join('\n'); console.log(md);
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, md + '\n');
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(rows, null, 2));
  process.exit(failed ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
