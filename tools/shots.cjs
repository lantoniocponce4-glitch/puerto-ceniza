#!/usr/bin/env node
// Capturas para revisar el juego sin abrirlo a mano (usa Playwright y Chromium).
//   node tools/shots.cjs plan <mapa...>                 plano cenital: paredes, sitios, spawns, rutas y posiciones de los bots
//   node tools/shots.cjs cam <mapa> x z yaw [x z yaw]   vista en primera persona desde esos puntos (yaw 0 = mirar hacia -z)
//   node tools/shots.cjs mobile [mapa]                  partida en un celular emulado (HUD táctil, FPS y calidad adaptable)
// Las capturas quedan en tools/out/. Para cam y mobile el servidor debe estar corriendo: PORT=3111 npm start
'use strict';
const path = require('path'), fs = require('fs');
const { chromium, devices } = require('playwright');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:3111';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const [mode, ...a] = process.argv.slice(2); const b = await chromium.launch({ args: GL }); const errs = [];
  const watch = p => p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  if (mode === 'plan') {
    const p = await b.newPage({ viewport: { width: 1100, height: 900 } }); watch(p);
    for (const m of a) { await p.goto('file://' + path.join(__dirname, 'map-plan.html') + '?m=' + m); await p.waitForTimeout(300); await p.locator('#c').screenshot({ path: path.join(OUT, 'plan_' + m + '.png') }); }
  } else if (mode === 'cam') {
    const [m, ...v] = a; const p = await b.newPage({ viewport: { width: 960, height: 540 } }); watch(p);
    await p.addInitScript(m => localStorage.setItem('pc2_prefs', JSON.stringify({ map: m, gfx: 'high', gfxV: 2, gm: 'tdm' })), m);
    await p.goto(URL + '/?debug=1'); await p.waitForTimeout(3000); await p.evaluate(() => document.getElementById('offline').click()); await p.waitForTimeout(5000);
    await p.addStyleTag({ content: '#hud,#touch{display:none!important}' });
    for (let i = 0; i < v.length; i += 3) { await p.evaluate(c => { PCDBG.cam = c; }, [+v[i], 1.7, +v[i + 1], +v[i + 2], -.12]); await p.waitForTimeout(2500); await p.screenshot({ path: path.join(OUT, `cam_${m}_${i / 3}.png`) }); }
  } else if (mode === 'mobile') {
    const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 } }); const p = await ctx.newPage(); watch(p);
    await p.addInitScript(m => localStorage.setItem('pc2_prefs', JSON.stringify({ map: m, gm: 'bomb' })), a[0] || 'muelle');
    await p.goto(URL + '/?debug=1'); await p.waitForTimeout(3000); await p.evaluate(() => document.getElementById('offline').click()); await p.waitForTimeout(9000);
    await p.screenshot({ path: path.join(OUT, 'mobile.png') }); console.log('calidad', JSON.stringify(await p.evaluate(() => PCDBG.perf)));
  } else { console.log('Modos: plan | cam | mobile (ver el comentario al inicio del archivo)'); }
  console.log(errs.length ? 'Errores en la página:\n' + errs.join('\n') : 'Sin errores en la página. Capturas en tools/out/');
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
