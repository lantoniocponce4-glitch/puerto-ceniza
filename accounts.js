// Puerto Ceniza — cuentas de jugador: registro, ingreso, sesiones y perfil persistente.
// Usa Postgres si existe DATABASE_URL (por ejemplo Neon); si no, guarda en un archivo local (solo para desarrollo).
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PC = require('./shared/core.js');

const SESSION_DAYS = 60;
const today = () => new Date().toISOString().slice(0, 10);
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
function cleanDisplay(u) { return String(u || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14); }

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
  async createSession(hash, userId, exp) { this.data.sessions[hash] = { userId, exp }; this.save(); }
  async getSession(hash) { const s = this.data.sessions[hash]; return s && s.exp > Date.now() ? s : null; }
  async deleteSession(hash) { delete this.data.sessions[hash]; this.save(); }
}
// Limpia errores típicos al pegar la dirección: comillas, prefijo DATABASE_URL= y parámetros que el cliente no soporta
function cleanDbUrl(raw) {
  let u = String(raw || '').trim().replace(/^DATABASE_URL\s*=\s*/i, '').replace(/^psql\s+/i, '').replace(/^['"]|['"]$/g, '').trim();
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
  async createSession(hash, userId, exp) { await this.pool.query('INSERT INTO pc_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [hash, userId, exp]); await this.pool.query('UPDATE pc_users SET last_login=now() WHERE id=$1', [userId]); }
  async getSession(hash) { const r = await this.pool.query('SELECT user_id AS "userId", expires_at AS exp FROM pc_sessions WHERE token_hash=$1 AND expires_at > $2', [hash, Date.now()]); return r.rows[0] || null; }
  async deleteSession(hash) { await this.pool.query('DELETE FROM pc_sessions WHERE token_hash=$1', [hash]); }
}

/* ---------- Servicio de cuentas ---------- */
class Accounts {
  constructor() {
    this.store = process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new FileStore(path.join(__dirname, 'data', 'cuentas.json'));
    this.cache = new Map(); // id -> { id, username, display, profile, stats, dirty }
    this.fails = new Map(); // clave de intento -> { n, until }
    const start = () => this.store.init().then(() => { this.ok = true; this.err = null; console.log('Cuentas: usando', this.store.kind); }).catch(e => { this.ok = false; this.err = (e.code ? e.code + ': ' : '') + scrub(e.message); console.error('Cuentas: no se pudo iniciar la base de datos:', this.err); setTimeout(() => { this.ready = start(); }, 20000); });
    this.ready = start();
    setInterval(() => this.flush(), 10000).unref();
  }
  limited(key) { const f = this.fails.get(key); return f && f.until > Date.now(); }
  fail(key) { const f = this.fails.get(key) || { n: 0, until: 0 }; f.n++; if (f.n >= 6) { f.until = Date.now() + 10 * 60 * 1000; f.n = 0; } this.fails.set(key, f); }
  view(a) { freshDaily(a.profile); return { user: a.username, name: a.display, profile: a.profile, stats: a.stats }; }
  load(row) {
    let a = this.cache.get(row.id);
    if (!a) { a = { id: row.id, username: row.username, display: row.display, profile: freshDaily(Object.assign(newProfile(), row.profile || {})), stats: Object.assign(newStats(), row.stats || {}), dirty: false }; this.cache.set(row.id, a); }
    return a;
  }
  async session(userId) { const token = crypto.randomBytes(32).toString('hex'); await this.store.createSession(sha(token), userId, Date.now() + SESSION_DAYS * 864e5); return token; }
  async register(user, pass, display, ip) {
    await this.ready; if (!this.ok) return { error: 'La base de datos no está disponible. Intenta más tarde.' };
    const username = cleanUser(user);
    if (!USER_RE.test(username)) return { error: 'El usuario debe tener entre 3 y 16 caracteres: letras, números, punto o guion bajo.' };
    if (typeof pass !== 'string' || pass.length < 8 || pass.length > 100) return { error: 'La clave debe tener al menos 8 caracteres.' };
    if (this.limited('reg:' + ip)) return { error: 'Demasiados intentos. Espera unos minutos.' };
    if (await this.store.findUser(username)) { this.fail('reg:' + ip); return { error: 'Ese usuario ya existe. Elige otro o ingresa con tu clave.' }; }
    const salt = crypto.randomBytes(16).toString('hex');
    const row = await this.store.createUser({ username, display: cleanDisplay(display) || username, salt, pass_hash: await hashPass(pass, salt), profile: newProfile(), stats: newStats() });
    const a = this.load(row); return { token: await this.session(row.id), me: this.view(a) };
  }
  async login(user, pass, ip) {
    await this.ready; if (!this.ok) return { error: 'La base de datos no está disponible. Intenta más tarde.' };
    const username = cleanUser(user);
    if (this.limited('ip:' + ip) || this.limited('u:' + username)) return { error: 'Demasiados intentos fallidos. Espera 10 minutos.' };
    const row = await this.store.findUser(username);
    if (!row || typeof pass !== 'string' || !(await checkPass(pass, row.salt, row.pass_hash))) { this.fail('ip:' + ip); this.fail('u:' + username); return { error: 'Usuario o clave incorrectos.' }; }
    const a = this.load(row); return { token: await this.session(row.id), me: this.view(a) };
  }
  async fromToken(token) {
    await this.ready; if (!this.ok || typeof token !== 'string' || token.length !== 64) return null;
    const s = await this.store.getSession(sha(token)); if (!s) return null;
    const a = this.cache.get(s.userId); if (a) return a;
    const row = await this.store.getUser(s.userId); return row ? this.load(row) : null;
  }
  async logout(token) { if (typeof token === 'string') await this.store.deleteSession(sha(token)); }
  setCamo(a, camo) { const c = PC.CAMOS.find(x => x.id === camo); if (camo === null || camo === '') { a.profile.camo = null; a.dirty = true; return true; } if (!c || a.profile.lvl < c.lvl) return false; a.profile.camo = c.id; a.dirty = true; return true; }
  // Aplica la experiencia de un evento de juego; devuelve lo que hay que avisarle al jugador
  award(a, gains) {
    const p = freshDaily(a.profile); const msgs = []; let up = false, done = [];
    for (const g of gains) {
      if (g.stat) a.stats[g.stat] = (a.stats[g.stat] || 0) + 1;
      if (g.n) { p.xp += g.n; msgs.push('+' + g.n + ' · ' + g.why); }
      for (const id of g.ch) for (const c of p.ch) if (c.id === id && !c.done) { c.p = Math.min(c.n, c.p + 1); if (c.p >= c.n) { c.done = true; p.xp += 500; done.push(c.id); } }
    }
    while (p.xp >= PC.needXP(p.lvl)) { p.xp -= PC.needXP(p.lvl); p.lvl++; up = true; }
    a.dirty = true; return { msgs, up, done };
  }
  async flush() { for (const a of this.cache.values()) if (a.dirty) { a.dirty = false; try { await this.store.saveUser(a.id, a.profile, a.stats); } catch (e) { a.dirty = true; console.error('No se pudo guardar el perfil', a.username, e.message); } } }
}
module.exports = { Accounts, cleanDbUrl, scrub };
