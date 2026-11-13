// Puerto Ceniza — servidor multijugador (HTTP estático + WebSocket)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const PC = require('./shared/core.js');
const { Accounts } = require('./accounts.js');
const ACC = new Accounts();

const PORT = process.env.PORT || 3000;
const TICK = 1 / 20;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/rooms') return api(req, res, url);
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ ok: true, cuentas: ACC.store.kind, baseLista: ACC.ok === true, error: ACC.err || null })); }
  if (url.pathname === '/api/rooms') {
    const list = [...rooms.values()].filter(r => r.isPublic && r.humanCount > 0).map(r => ({ code: r.code, players: r.humanCount, map: r.mapId, mode: r.mode, diff: r.diffKey, phase: r.phase, round: r.round, sc: r.scores, hs: { atk: r.sideHumans('atk'), def: r.sideHumans('def') }, names: r.actors.filter(a => a.human).map(a => a.name).slice(0, 8) })).sort((a, b) => b.players - a.players);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(list));
  }
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = file === '/core.js' ? path.join(__dirname, 'shared', 'core.js') : path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(PUBLIC) && !full.endsWith(path.join('shared', 'core.js'))) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

/* ---------- API de cuentas ---------- */
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const bearer = req => { const h = String(req.headers.authorization || ''); return h.startsWith('Bearer ') ? h.slice(7).trim() : ''; };
function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((ok) => { let d = ''; req.on('data', c => { d += c; if (d.length > 4096) { d = ''; req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { ok({}); } }); req.on('error', () => ok({})); });
}
async function api(req, res, url) {
  try {
    const p = url.pathname;
    if (req.method === 'POST' && p === '/api/register') { const b = await body(req); const r = await ACC.register(b.user, b.pass, b.name, ipOf(req)); return json(res, r.error ? 400 : 200, r); }
    if (req.method === 'POST' && p === '/api/login') { const b = await body(req); const r = await ACC.login(b.user, b.pass, ipOf(req)); return json(res, r.error ? 401 : 200, r); }
    if (req.method === 'POST' && p === '/api/logout') { await ACC.logout(bearer(req)); return json(res, 200, { ok: true }); }
    if (req.method === 'GET' && p === '/api/me') { const a = await ACC.fromToken(bearer(req)); return a ? json(res, 200, { me: ACC.view(a) }) : json(res, 401, { error: 'Tu sesión venció. Vuelve a ingresar.' }); }
    if (req.method === 'POST' && p === '/api/camo') { const a = await ACC.fromToken(bearer(req)); if (!a) return json(res, 401, { error: 'Tu sesión venció. Vuelve a ingresar.' }); const b = await body(req); return ACC.setCamo(a, b.camo === null ? null : String(b.camo || '')) ? json(res, 200, { me: ACC.view(a) }) : json(res, 400, { error: 'Ese camuflaje aún no está desbloqueado.' }); }
    return json(res, 404, { error: 'No encontrado' });
  } catch (e) { console.error('api', e); return json(res, 500, { error: 'Error del servidor. Intenta de nuevo.' }); }
}

/* ---------- Salas ---------- */
const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() { let c; do { c = Array.from({ length: 4 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join(''); } while (rooms.has(c)); return c; }
function createRoom(isPublic, diff, map, mode) {
  const code = newCode();
  const room = new PC.Room({ code, diff, isPublic, map, mode });
  room.sockets = new Map();
  room.accts = new Map();
  room.onBroadcast = msg => {
    const s = JSON.stringify(msg); for (const ws of room.sockets.values()) if (ws.readyState === 1) ws.send(s);
    if (msg.t === 's' && msg.ev.length && room.accts.size) {
      const teamOf = id => room.actors[id] ? room.actors[id].team : -1;
      for (const [cid, acct] of room.accts) {
        const id = room.clients.get(cid); if (id == null) continue; const me = room.actors[id]; const gains = [];
        for (const e of msg.ev) gains.push(...PC.xpFromEvent(e, id, me.team, teamOf));
        if (!gains.length) continue;
        const r = ACC.award(acct, gains);
        if (r.msgs.length || r.up || r.done.length) room.onSend(cid, { t: 'xp', msgs: r.msgs, up: r.up, done: r.done, me: ACC.view(acct) });
      }
    }
  };
  room.onSend = (cid, msg) => { const ws = room.sockets.get(cid); if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  rooms.set(code, room);
  return room;
}
function quickRoom(side, mode) {
  let best = null;
  for (const r of rooms.values()) {
    if (!r.isPublic || r.humanCount >= 8 || r.mode !== mode) continue;
    if ((side === 'atk' || side === 'def') && r.sideHumans(side) >= 4) continue;
    if (!best || r.humanCount > best.humanCount) best = r;
  }
  return best || createRoom(true, 'veterano', null, mode);
}
const cleanName = n => (String(n || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14)) || 'Operador';

let nextCid = 1;
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192, perMessageDeflate: { zlibDeflateOptions: { level: 1 }, threshold: 256 } });
wss.on('connection', ws => {
  const cid = 'c' + (nextCid++);
  let room = null;
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  let joining = false, acct = null;
  ws.on('message', async raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join' && !room && !joining) {
      joining = true;
      acct = m.token ? await ACC.fromToken(String(m.token)) : null;
      joining = false; if (ws.readyState !== 1) return;
      let r = null;
      const gm = m.gm === 'elim' || m.gm === 'gg' ? m.gm : 'bomb';
      if (m.mode === 'create') r = createRoom(!!m.pub, m.diff, m.map, gm);
      else if (m.mode === 'code') {
        r = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!r) return ws.send(JSON.stringify({ t: 'err', msg: 'No existe una sala con ese código. Revisa las 4 letras o crea una nueva.' }));
      } else r = quickRoom(m.side, gm);
      if (r.humanCount >= 8) return ws.send(JSON.stringify({ t: 'err', msg: 'La sala está llena (8 de 8). Prueba partida rápida o crea otra sala.' }));
      const a = acct ? r.addHuman(cid, acct.display, m.side, acct.profile.camo) : r.addHuman(cid, cleanName(m.name), m.side, null);
      if (!a) {
        if (r.humanCount === 0) rooms.delete(r.code);
        const sideName = m.side === 'atk' ? 'terroristas' : 'antiterroristas';
        return ws.send(JSON.stringify({ t: 'err', msg: r.lastErr === 'side' ? `El bando ${sideName} ya tiene 4 personas. Elige el otro bando o «Automático».` : 'No se pudo entrar a la sala.' }));
      }
      room = r; r.sockets.set(cid, ws); if (acct) r.accts.set(cid, acct);
      ws.send(JSON.stringify({ t: 'joined', code: r.code, you: a.id, team: a.team, diff: r.diffKey, pub: r.isPublic, map: r.mapId, gm: r.mode }));
      ws.send(JSON.stringify(r.privateState(a)));
      ws.send(JSON.stringify(r.roster()));
      return;
    }
    if (room) room.message(cid, m);
  });
  ws.on('close', () => {
    if (!room) return;
    room.removeHuman(cid); room.sockets.delete(cid); room.accts.delete(cid); if (acct) ACC.flush();
    if (room.humanCount === 0) rooms.delete(room.code);
  });
});

// latido para cerrar conexiones muertas
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch (e) { } } }, 15000);

// ciclo de juego
let last = Date.now();
setInterval(() => {
  const now = Date.now(); let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, .1);
  for (const r of rooms.values()) { try { r.tick(dt); } catch (e) { console.error('tick', r.code, e); } }
}, TICK * 1000);

server.listen(PORT, () => console.log(`Puerto Ceniza escuchando en :${PORT}`));
