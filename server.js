// Puerto Ceniza — servidor multijugador (HTTP estático + WebSocket)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const PC = require('./shared/core.js');

const PORT = process.env.PORT || 3000;
const TICK = 1 / 20;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url.pathname === '/api/rooms') {
    const list = [...rooms.values()].filter(r => r.isPublic).map(r => ({ code: r.code, players: r.humanCount, map: r.mapId, mode: r.mode }));
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(list));
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

/* ---------- Salas ---------- */
const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() { let c; do { c = Array.from({ length: 4 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join(''); } while (rooms.has(c)); return c; }
function createRoom(isPublic, diff, map, mode) {
  const code = newCode();
  const room = new PC.Room({ code, diff, isPublic, map, mode });
  room.sockets = new Map();
  room.onBroadcast = msg => { const s = JSON.stringify(msg); for (const ws of room.sockets.values()) if (ws.readyState === 1) ws.send(s); };
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
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join' && !room) {
      let r = null;
      const gm = m.gm === 'elim' || m.gm === 'gg' ? m.gm : 'bomb';
      if (m.mode === 'create') r = createRoom(false, m.diff, m.map, gm);
      else if (m.mode === 'code') {
        r = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!r) return ws.send(JSON.stringify({ t: 'err', msg: 'No existe una sala con ese código. Revisa las 4 letras o crea una nueva.' }));
      } else r = quickRoom(m.side, gm);
      if (r.humanCount >= 8) return ws.send(JSON.stringify({ t: 'err', msg: 'La sala está llena (8 de 8). Prueba partida rápida o crea otra sala.' }));
      const a = r.addHuman(cid, cleanName(m.name), m.side, typeof m.camo === 'string' ? m.camo : null);
      if (!a) {
        if (r.humanCount === 0) rooms.delete(r.code);
        const sideName = m.side === 'atk' ? 'terroristas' : 'antiterroristas';
        return ws.send(JSON.stringify({ t: 'err', msg: r.lastErr === 'side' ? `El bando ${sideName} ya tiene 4 personas. Elige el otro bando o «Automático».` : 'No se pudo entrar a la sala.' }));
      }
      room = r; r.sockets.set(cid, ws);
      ws.send(JSON.stringify({ t: 'joined', code: r.code, you: a.id, team: a.team, diff: r.diffKey, pub: r.isPublic, map: r.mapId, gm: r.mode }));
      ws.send(JSON.stringify(r.privateState(a)));
      ws.send(JSON.stringify(r.roster()));
      return;
    }
    if (room) room.message(cid, m);
  });
  ws.on('close', () => {
    if (!room) return;
    room.removeHuman(cid); room.sockets.delete(cid);
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
