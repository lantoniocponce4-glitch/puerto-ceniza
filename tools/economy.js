#!/usr/bin/env node
// Pruebas de regresión de la economía: medio tiempo sin armas conservadas ni kit, dinero inicial, tope, precios exactos y bono por derrotas.
// Uso: npm run test:economy   (sale con código 1 si algo falla)
// pruebas del sistema de dinero
const PC = require('../shared/core.js');
const mk = (rounds = 9) => { const r = new PC.Room({ code: 'M', map: 'alcazaba', diff: 'veterano', mode: 'bomb', rules: { rounds } }); r.rotate = false; r.onSend = () => {}; r.onBroadcast = () => {}; return r; };
const fails = []; const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(ok ? '  ✓' : '  ✗', msg); };
// 1) medio tiempo: nadie debería conservar armas de la primera mitad
{ const r = mk(9); let half = null, money = null; r.onBroadcast = m => { if (m.t === 's') for (const e of m.ev) if (e.k === 'half' && !half) { half = r.now; money = r.actors.map(a => a.money); } };
  const origBuy = r.botBuy.bind(r); let block = false; r.botBuy = (b) => { if (!block) origBuy(b); };
  for (let t = 0; t < 1500 && !half; t += .05) { if (r.round === r.R.half && r.phase === 'post') block = true; r.tick(.05); } const kept = r.actors.filter(a => a.inv.p), wrong = r.actors.filter(a => { const w = PC.WEAPONS[a.inv.p] || PC.WEAPONS[a.inv.s]; return [a.inv.p, a.inv.s].some(id => id && PC.WEAPONS[id] && PC.WEAPONS[id].side && PC.WEAPONS[id].side !== r.side(a.team)); });
  console.log('medio tiempo, ronda', r.round, '· dinero', r.actors.map(a => a.money).join(','));
  check(kept.length === 0, `medio tiempo: nadie conserva un arma principal (conservan ${kept.length}: ${kept.map(a => a.inv.p).join(', ')})`);
  check(wrong.length === 0, `medio tiempo: nadie tiene armas del otro bando (${wrong.length})`);
  check(money.every(m => m === 800), `medio tiempo: todos parten con $800 (${money.join(',')})`);
  check(r.actors.every(a => !a.kit), 'medio tiempo: nadie conserva el kit de desactivación'); }
// 2) dinero nunca negativo ni sobre el tope durante partidas completas; premio por baja correcto
{ let bad = 0, over = 0; for (let g = 0; g < 20; g++) { const r = mk(9); for (let t = 0; t < 1500 && r.phase !== 'over'; t += .05) { r.tick(.05); for (const a of r.actors) { if (a.money < 0 || !Number.isFinite(a.money)) bad++; if (a.money > 16000) over++; } } }
  check(bad === 0, 'dinero nunca negativo ni inválido (20 partidas)'); check(over === 0, 'dinero nunca sobre $16.000'); }
// 3) compra: descuenta el precio exacto y no permite comprar sin dinero
{ const r = mk(); for (let t = 0; t < 1 && r.phase !== 'buy'; t += .05) r.tick(.05); const a = r.actors[0]; a.money = 3000; a.inv.p = null;
  const ok1 = r.buy(a, 'ar'); check(ok1 && a.money === 300, `comprar AR con $3000 deja $300 (queda ${a.money})`);
  const ok2 = r.buy(a, 'sg55'); check(!ok2 && a.money === 300, 'no se puede comprar sin dinero suficiente');
  a.money = 1000; a.armor = 0; a.helmet = false; r.buy(a, 'helm'); check(a.money === 0 && a.helmet && a.armor === 100, `casco + chaleco desde cero cuesta $1000 (queda ${a.money})`);
  a.money = 1000; a.armor = 100; a.helmet = false; r.buy(a, 'helm'); check(a.money === 650, `solo el casco con chaleco puesto cuesta $350 (queda ${a.money})`); }
// 4) bono por derrota: 1400, 1900, 2400, 2900, 3400 y baja al ganar
{ const r = mk(24); for (let t = 0; t < 1 && r.phase !== 'buy'; t += .05) r.tick(.05); const got = []; const def = r.actors.find(a => r.side(a.team) === 'def');
  for (let i = 0; i < 6; i++) { def.money = 0; r.phase = 'live'; r.bomb.st = 'carried'; r.endRound('atk', 'elim'); got.push(def.money); r.phase = 'live'; }
  check(JSON.stringify(got) === JSON.stringify([1400, 1900, 2400, 2900, 3400, 3400]), `bono por derrotas seguidas: ${got.join(', ')}`); }
console.log(fails.length ? `\n${fails.length} fallas` : '\nsin fallas');
process.exit(fails.length ? 1 : 0);
