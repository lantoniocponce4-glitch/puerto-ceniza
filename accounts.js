// Puerto Ceniza — cuentas de jugador: registro, ingreso, sesiones y perfil persistente.
// Usa Postgres si existe DATABASE_URL (por ejemplo Neon); si no, guarda en un archivo local (solo para desarrollo).
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PC = require('./shared/core.js');

const SESSION_DAYS = 60;
const today = () => new Date().toISOString().slice(0, 10);
const seasonId = () => new Date().toISOString().slice(0, 7);
function freshSeason(st) { const id = seasonId(); if (!st.season || st.season.id !== id) st.season = { id, xp: 0, kills: 0, wins: 0, deaths: 0 }; return st.season; }
const RANK_BY = { xp: 'xp', kills: 'kills', wins: 'wins' };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* ---------- Claves ---------- */
function hashPass(pass, salt) {
  return new Promise((ok, fail) => crypto.scrypt(pass, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? fail(e) : ok(k.toString('hex'))));
}
async function checkPass(pass, salt, hash) {
  const h = Buffer.from(await hashPass(pass, salt), 'hex'), ref = Buffer.from(hash, 'hex');
  return h.length === ref.length && crypto.timingSafeEqual(h, ref);
}
const USER_RE = /^[a-z0-9_.ñ]{3,16}$/;
function cleanUser(u) { return String(u || '').trim().toLowerCase().normalize('NFC'); }
function cleanDisplay(u) { return String(u || '').replace(/[\p{Cf}\p{Cc}\u3164\u115F\u1160\u2800\uFFA0]/gu, '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14); }

/* ---------- Perfil ---------- */
function newProfile() { return { xp: 0, lvl: 1, camo: null, day: today(), ch: PC.dailyFor(today()) }; }
function newStats() { return { kills: 0, deaths: 0, wins: 0, matches: 0 }; }
function freshDaily(p) { const d = today(); if (p.day !== d || !Array.isArray(p.ch) || p.ch.length !== 3) { p.day = d; p.ch = PC.dailyFor(d); } return p; }

/* ---------- Almacenamiento ---------- */
class FileStore {
  constructor(file) { this.file = file; try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { this.data = { users: {}, sessions: {}, seq: 0 }; } this.kind = 'archivo local'; }
  async init() { }
  save() { try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data)); } catch (e) { console.error('No se pudo guardar', e.message); } }
  async findUser(username) { return Object.values(this.data.users).find(u => u.username === username) || null; }
  async getUser(id) { return this.data.users[id] || null; }
  async createUser(u) { const id = ++this.data.seq; const row = Object.assign({ id }, u); this.data.users[id] = row; this.save(); return row; }
  async saveUser(id, profile, stats) { const u = this.data.users[id]; if (u) { u.profile = profile; u.stats = stats; this.save(); } }
  async setDisplay(id, display) { const u = this.data.users[id]; if (u) { u.display = display; this.save(); } }
  async displayTaken(display, id) { const k = display.toLowerCase(); return Object.values(this.data.users).some(u => u.id !== id && String(u.display).toLowerCase() === k); }
  async createSession(hash, userId, exp) { this.data.sessions[hash] = { userId, exp }; this.save(); }
  async getSession(hash) { const s = this.data.sessions[hash]; return s && s.exp > Date.now() ? s : null; }
  async deleteSession(hash) { delete this.data.sessions[hash]; this.save(); }
  sorted(season, by) { return Object.values(this.data.users).filter(u => u.stats && u.stats.season && u.stats.season.id === season).sort((a, b) => ((b.stats.season[by] || 0) - (a.stats.season[by] || 0)) || (a.id - b.id)); }
  async top(season, by, n) { return this.sorted(season, by).slice(0, n).map(u => ({ id: u.id, display: u.display, lvl: (u.profile || {}).lvl || 1, s: u.stats.season })); }
  async rankOf(season, by, val, id) { const l = this.sorted(season, by); const i = l.findIndex(u => u.id === id); return i >= 0 ? i + 1 : l.filter(u => (u.stats.season[by] || 0) > val).length + 1; }
}
// Limpia errores típicos al pegar la dirección: comillas, prefijo DATABASE_URL= y parámetros que el cliente no soporta
function cleanDbUrl(raw) {
  let u = String(raw || '').trim().replace(/^DATABASE_URL\s*=\s*/i, '').replace(/^psql\s+/i, '').replace(/^['"]|['"]$/g, '').replace(/[\s\u00AD\u200B-\u200F\u2028\u2029\u2060\uFEFF]+/g, '');
  try { const x = new URL(u); x.searchParams.delete('channel_binding'); x.searchParams.delete('sslmode'); u = x.toString(); } catch (e) { }
  return u;
}
const scrub = (m) => String(m || '').replace(/postgres(ql)?:\/\/\S+/gi, '[dirección oculta]').replace(/password[^,;]*/gi, 'password [oculto]').slice(0, 160);
class PgStore {
  constructor(url) { const { Pool } = require('pg'); this.pool = new Pool({ connectionString: cleanDbUrl(url), ssl: { rejectUnauthorized: false }, max: 4, idleTimeoutMillis: 20000, connectionTimeoutMillis: 15000 }); this.pool.on('error', e => console.error('Postgres:', scrub(e.message))); this.kind = 'Postgres'; }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS pc_users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, display TEXT NOT NULL, salt TEXT NOT NULL, pass_hash TEXT NOT NULL, profile JSONB NOT NULL, stats JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), last_login TIMESTAMPTZ DEFAULT now())`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS pc_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES pc_users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL)`);
    await this.pool.query(`DELETE FROM pc_sessions WHERE expires_at < $1`, [Date.now()]);
  }
  async findUser(username) { const r = await this.pool.query('SELECT * FROM pc_users WHERE username=$1', [username]); return r.rows[0] || null; }
  async getUser(id) { const r = await this.pool.query('SELECT * FROM pc_users WHERE id=$1', [id]); return r.rows[0] || null; }
  async createUser(u) { const r = await this.pool.query('INSERT INTO pc_users (username, display, salt, pass_hash, profile, stats) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [u.username, u.display, u.salt, u.pass_hash, u.profile, u.stats]); return r.rows[0]; }
  async saveUser(id, profile, stats) { await this.pool.query('UPDATE pc_users SET profile=$2, stats=$3 WHERE id=$1', [id, profile, stats]); }
  async setDisplay(id, display) { await this.pool.query('UPDATE pc_users SET display=$2 WHERE id=$1', [id, display]); }
  async displayTaken(display, id) { const r = await this.pool.query('SELECT 1 FROM pc_users WHERE lower(display)=lower($1) AND id<>$2 LIMIT 1', [display, id]); return r.rowCount > 0; }
  async createSession(hash, userId, exp) { await this.pool.query('INSERT INTO pc_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [hash, userId, exp]); await this.pool.query('UPDATE pc_users SET last_login=now() WHERE id=$1', [userId]); }
  async getSession(hash) { const r = await this.pool.query('SELECT user_id AS "userId", expires_at AS exp FROM pc_sessions WHERE token_hash=$1 AND expires_at > $2', [hash, Date.now()]); return r.rows[0] || null; }
  async deleteSession(hash) { await this.pool.query('DELETE FROM pc_sessions WHERE token_hash=$1', [hash]); }
  async top(season, by, n) {
    const r = await this.pool.query(`SELECT id, display, COALESCE((profile->>'lvl')::int,1) AS lvl, stats->'season' AS s FROM pc_users WHERE stats->'season'->>'id' = $1 ORDER BY COALESCE((stats->'season'->>$2)::int,0) DESC, id ASC LIMIT $3`, [season, by, n]);
    return r.rows;
  }
  async rankOf(season, by, val, id) {
    const r = await this.pool.query(`SELECT COUNT(*)::int AS n FROM pc_users WHERE stats->'season'->>'id' = $1 AND (COALESCE((stats->'season'->>$2)::int,0) > $3 OR (COALESCE((stats->'season'->>$2)::int,0) = $3 AND id < $4))`, [season, by, val, id]);
    return r.rows[0].n + 1;
  }
}

/* ---------- Servicio de cuentas ---------- */
class Accounts {
  constructor() {
    // Se prefiere la conexión con pool de Neon (DATABASE_URL_POOLED); si no está, se usa DATABASE_URL
    const dbUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
    this.store = dbUrl ? new PgStore(dbUrl) : new FileStore(path.join(__dirname, 'data', 'cuentas.json'));
    this.cache = new Map(); // id -> { id, username, display, profile, stats, dirty }
    this.fails = new Map(); // clave de intento -> { n, until }
    const start = () => this.store.init().then(() => { this.ok = true; this.err = null; console.log('Cuentas: usando', this.store.kind); }).catch(e => { this.ok = false; this.err = (e.code ? e.code + ': ' : '') + scrub(e.message); console.error('Cuentas: no se pudo iniciar la base de datos:', this.err); setTimeout(() => { this.ready = start(); }, 20000); });
    this.ready = start();
    setInterval(() => { this.flush().then(() => this.sweep()); }, 10000).unref();
  }
  // Limpia intentos vencidos y saca de memoria las cuentas que nadie usa hace 30 minutos
  sweep() {
    const now = Date.now();
    for (const [k, f] of this.fails) if (f.until < now && (f.n === 0 || now - (f.t || 0) > 15 * 60e3)) this.fails.delete(k);
    if (this.fails.size > 20000) this.fails.clear();
    for (const [id, a] of this.cache) if (!a.dirty && !a.inRoom && now - (a.lastUse || 0) > 30 * 60e3) this.cache.delete(id);
  }
  limited(key) { const f = this.fails.get(key); return f && f.until > Date.now(); }
  fail(key) { const f = this.fails.get(key) || { n: 0, until: 0 }; f.n++; f.t = Date.now(); if (f.n >= 6) { f.until = Date.now() + 10 * 60 * 1000; f.n = 0; } this.fails.set(key, f); }
  view(a) { freshDaily(a.profile); return { user: a.username, name: a.display, profile: a.profile, stats: a.stats }; }
  load(row) {
    let a = this.cache.get(row.id);
    if (a) a.lastUse = Date.now();
    if (!a) { a = { lastUse: Date.now(), id: row.id, username: row.username, display: row.display, profile: freshDaily(Object.assign(newProfile(), row.profile || {})), stats: Object.assign(newStats(), row.stats || {}), dirty: false }; this.cache.set(row.id, a); }
    return a;
  }
  async session(userId) { const token = crypto.randomBytes(32).toString('hex'); await this.store.createSession(sha(token), userId, Date.now() + SESSION_DAYS * 864e5); return token; }
  async register(user, pass, display, ip) {
    await this.ready; if (!this.ok) return { error: 'La base de datos no está disponible. Intenta más tarde.' };
    const username = cleanUser(user);
    if (!USER_RE.test(username)) return { error: 'El usuario debe tener entre 3 y 16 caracteres: letras, números, punto o guion bajo.' };
    if (typeof pass !== 'string' || pass.length < 8 || pass.length > 100) return { error: 'La clave debe tener al menos 8 caracteres.' };
    if (this.limited('reg:' + ip) || this.limited('regok:' + ip)) return { error: 'Demasiados intentos. Espera unos minutos.' };
    if (await this.store.findUser(username)) { this.fail('reg:' + ip); return { error: 'Ese usuario ya existe. Elige otro o ingresa con tu clave.' }; }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashPass(pass, salt);
    if (await this.store.findUser(username)) return { error: 'Ese usuario ya existe. Elige otro o ingresa con tu clave.' };
    let row; try { row = await this.store.createUser({ username, display: cleanDisplay(display) || username, salt, pass_hash: hash, profile: newProfile(), stats: newStats() }); }
    catch (e) { if (e && e.code === '23505') return { error: 'Ese usuario ya existe. Elige otro o ingresa con tu clave.' }; throw e; }
    for (let i = 0; i < 2; i++) this.fail('regok:' + ip);
    const a = this.load(row); return { token: await this.session(row.id), me: this.view(a) };
  }
  async login(user, pass, ip) {
    await this.ready; if (!this.ok) return { error: 'La base de datos no está disponible. Intenta más tarde.' };
    const username = cleanUser(user);
    const uk = 'u:' + username + '|' + ip;
    if (this.limited('ip:' + ip) || this.limited(uk)) return { error: 'Demasiados intentos fallidos. Espera 10 minutos.' };
    const row = await this.store.findUser(username);
    // si el usuario no existe igual se calcula un hash, para no revelar qué usuarios existen por el tiempo de respuesta
    const okPass = typeof pass === 'string' && (row ? await checkPass(pass, row.salt, row.pass_hash) : (await hashPass(pass, 'x'.repeat(32)), false));
    if (!row || !okPass) { this.fail('ip:' + ip); this.fail(uk); return { error: 'Usuario o clave incorrectos.' }; }
    const a = this.load(row); return { token: await this.session(row.id), me: this.view(a) };
  }
  async fromToken(token) {
    await this.ready; if (!this.ok || typeof token !== 'string' || token.length !== 64) return null;
    const s = await this.store.getSession(sha(token)); if (!s) return null;
    const a = this.cache.get(s.userId); if (a) { a.lastUse = Date.now(); return a; }
    const row = await this.store.getUser(s.userId); return row ? this.load(row) : null;
  }
  async logout(token) { if (typeof token === 'string') await this.store.deleteSession(sha(token)); }
  async setCamo(a, camo, wid) {
    if (wid !== undefined && wid !== null) { if (typeof wid !== 'string' || !Object.prototype.hasOwnProperty.call(PC.WEAPONS, wid)) return false; const cm = a.profile.camos || (a.profile.camos = {}); if (camo === null || camo === '') { delete cm[wid]; a.dirty = true; return true; } if (camo === 'none') { cm[wid] = 'none'; a.dirty = true; return true; } if (!(await this.setCamo({ profile: Object.assign({}, a.profile), stats: a.stats, id: a.id }, camo))) return false; cm[wid] = camo; a.dirty = true; return true; }
    const c = PC.CAMOS.find(x => x.id === camo); if (camo === null || camo === '') { a.profile.camo = null; a.dirty = true; return true; } if (!c || a.profile.lvl < c.lvl) return false;
    if (c.top) { await this.flush(); const ss = freshSeason(a.stats); if (!(ss.xp > 0)) return false; const pos = await this.store.rankOf(seasonId(), 'xp', ss.xp, a.id); if (!(pos <= c.top)) return false; } a.profile.camo = c.id; a.dirty = true; return true; }
  // Aplica la experiencia de un evento de juego; devuelve lo que hay que avisarle al jugador
  award(a, gains) {
    const p = freshDaily(a.profile); const ss = freshSeason(a.stats); const msgs = []; let up = false, done = [];
    for (const g of gains) {
      if (g.stat) { a.stats[g.stat] = (a.stats[g.stat] || 0) + 1; if (ss[g.stat] !== undefined) ss[g.stat]++; }
      if (g.n) { p.xp += g.n; ss.xp += g.n; msgs.push('+' + g.n + ' · ' + g.why); }
      for (const id of g.ch) for (const c of p.ch) if (c.id === id && !c.done) { c.p = Math.min(c.n, c.p + 1); if (c.p >= c.n) { c.done = true; p.xp += 500; ss.xp += 500; done.push(c.id); } }
    }
    while (p.xp >= PC.needXP(p.lvl)) { p.xp -= PC.needXP(p.lvl); p.lvl++; up = true; }
    a.dirty = true; return { msgs, up, done };
  }
  // Cambiar el nombre visible (el usuario para ingresar no cambia). Máximo 3 cambios cada 10 minutos.
  async rename(a, raw) {
    const name = cleanDisplay(raw);
    if (name.length < 3) return { error: 'El nombre debe tener entre 3 y 14 caracteres.' };
    if (name === a.display) return { ok: true };
    if (this.limited('name:' + a.id)) return { error: 'Cambiaste el nombre muchas veces. Espera unos minutos.' };
    if (await this.store.displayTaken(name, a.id)) return { error: 'Ese nombre ya lo usa otro jugador. Prueba con otro.' };
    for (let i = 0; i < 2; i++) this.fail('name:' + a.id);
    await this.store.setDisplay(a.id, name); a.display = name; a.lastUse = Date.now();
    return { ok: true };
  }
  async ranking(byRaw, me) {
    await this.ready; const by = RANK_BY[byRaw] || 'xp', season = seasonId();
    if (!this.ok) return { season, by, top: [], me: null, error: 'La base de datos no está disponible.' };
    await this.flush();
    const rows = await this.store.top(season, by, 50);
    const top = rows.map((r, i) => ({ pos: i + 1, name: r.display, lvl: r.lvl, xp: r.s.xp || 0, kills: r.s.kills || 0, wins: r.s.wins || 0, you: !!(me && r.id === me.id) }));
    let mine = null;
    if (me) { const ss = freshSeason(me.stats); const pos = await this.store.rankOf(season, by, ss[by] || 0, me.id); mine = { pos, name: me.display, lvl: me.profile.lvl, xp: ss.xp, kills: ss.kills, wins: ss.wins }; }
    return { season, by, top, me: mine };
  }
  async flush() { for (const a of this.cache.values()) if (a.dirty) { a.dirty = false; try { await this.store.saveUser(a.id, a.profile, a.stats); } catch (e) { a.dirty = true; console.error('No se pudo guardar el perfil', a.username, e.message); } } }
}
module.exports = { Accounts, cleanDbUrl, scrub };
