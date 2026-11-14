/* Puerto Ceniza — modelos detallados: armas (siluetas extruidas y biseladas) y soldados articulados */
(function () {
'use strict';
const T = THREE;
const rand = (a, b) => a + Math.random() * (b - a);
const texs = [];
let ANISO = 8;

/* ---------- Texturas ---------- */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function mk(c, rep) { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep, rep); t.anisotropy = ANISO; texs.push(t); return t; }
function speck(x, w, h, n, a, light) { for (let i = 0; i < n; i++) { const v = light === undefined ? (Math.random() < .5 ? 0 : 255) : light; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`; x.fillRect(Math.random() * w, Math.random() * h, rand(.6, 2), rand(.6, 2)); } }
function texWear() {
  const [c, x] = cnv(256, 256); x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 256, 256); speck(x, 256, 256, 9000, .16, 0);
  for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(255,255,255,${rand(.15, .45)})`; x.lineWidth = rand(.4, 1.2); x.beginPath(); const px = rand(0, 256), py = rand(0, 256); x.moveTo(px, py); x.lineTo(px + rand(-14, 14), py + rand(-3, 3)); x.stroke(); }
  for (let i = 0; i < 14; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(60,50,40,.18)'); g.addColorStop(1, 'rgba(60,50,40,0)'); x.save(); x.translate(rand(0, 256), rand(0, 256)); x.fillStyle = g; x.fillRect(-30, -30, 60, 60); x.restore(); }
  return mk(c, 5);
}
function texGrain() { const [c, x] = cnv(128, 128); x.fillStyle = '#e4e4e4'; x.fillRect(0, 0, 128, 128); speck(x, 128, 128, 6000, .14); return mk(c, 9); }
function texWoodG() { const [c, x] = cnv(256, 256); x.fillStyle = '#7b4a25'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${rand(40, 70)},${rand(20, 35)},10,${rand(.2, .5)})`; x.lineWidth = rand(.6, 2.2); x.beginPath(); const y0 = rand(0, 256); x.moveTo(0, y0); for (let k = 0; k <= 8; k++) x.lineTo(k * 32, y0 + Math.sin(k * .8 + i) * rand(2, 6)); x.stroke(); } speck(x, 256, 256, 2000, .12); return mk(c, 3); }
function texCloth() { const [c, x] = cnv(128, 128); x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 128; i += 2) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, i, 128, 1); x.fillRect(i, 0, 1, 128); } speck(x, 128, 128, 2500, .1); return mk(c, 7); }
function texCamo(team) {
  const [c, x] = cnv(256, 256);
  if (team === 0) {
    x.fillStyle = '#5b6773'; x.fillRect(0, 0, 256, 256); const cols = ['#3e4955', '#7c8995', '#2f363f', '#66727e'];
    for (let i = 0; i < 520; i++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; let px = (Math.random() * 64 | 0) * 4, py = (Math.random() * 64 | 0) * 4; const n = 2 + (Math.random() * 6 | 0); for (let k = 0; k < n; k++) { x.fillRect(px, py, 4, 4); if (Math.random() < .5) px += 4; else py += 4; } }
  } else {
    x.fillStyle = '#b39b70'; x.fillRect(0, 0, 256, 256); const cols = ['#8c7350', '#cdb68d', '#6c5739', '#a48a5f'];
    for (let i = 0; i < 70; i++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; x.save(); x.translate(rand(0, 256), rand(0, 256)); x.rotate(rand(0, 3)); x.beginPath(); x.ellipse(0, 0, rand(10, 30), rand(5, 14), 0, 0, 7); x.fill(); x.restore(); }
  }
  speck(x, 256, 256, 5000, .1); for (let i = 0; i < 256; i += 2) { x.fillStyle = 'rgba(0,0,0,.04)'; x.fillRect(0, i, 256, 1); }
  return mk(c, 2);
}
const TXW = texWear(), TXG = texGrain(), TXWOOD = texWoodG(), TXCLOTH = texCloth(), CAMO = [texCamo(0), texCamo(1)];
// Relieve (mapas normales) generado desde una altura procedural con filtro Sobel
function nrm(drawH, size, str, rep) {
  const [c, x] = cnv(size, size); drawH(x, size); const src = x.getImageData(0, 0, size, size).data, L = new Float32Array(size * size);
  for (let k = 0, p = 0; k < L.length; k++, p += 4) L[k] = src[p] / 255;
  const H = (i, j) => L[((j + size) % size) * size + ((i + size) % size)], out = x.createImageData(size, size), D = out.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const dx = (H(i + 1, j - 1) + 2 * H(i + 1, j) + H(i + 1, j + 1)) - (H(i - 1, j - 1) + 2 * H(i - 1, j) + H(i - 1, j + 1)), dy = (H(i - 1, j + 1) + 2 * H(i, j + 1) + H(i + 1, j + 1)) - (H(i - 1, j - 1) + 2 * H(i, j - 1) + H(i + 1, j - 1));
    const nx = -dx * str, ny = dy * str, l = Math.hypot(nx, ny, 1), k = (j * size + i) * 4; D[k] = (nx / l * .5 + .5) * 255; D[k + 1] = (ny / l * .5 + .5) * 255; D[k + 2] = (1 / l * .5 + .5) * 255; D[k + 3] = 255;
  }
  x.putImageData(out, 0, 0); return mk(c, rep);
}
const NSTIPPLE = nrm((x, n) => { x.fillStyle = '#808080'; x.fillRect(0, 0, n, n); for (let i = 0; i < n * n / 9; i++) { const v = rand(90, 200) | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.arc(rand(0, n), rand(0, n), rand(.6, 1.6), 0, 7); x.fill(); } }, 128, 2.2, 9);
const NBRUSH = nrm((x, n) => { x.fillStyle = '#808080'; x.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { const v = rand(100, 160) | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, rand(0, n), n, rand(.4, 1.2)); } for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgb(60,60,60)'; x.lineWidth = rand(.5, 1.4); x.beginPath(); const px = rand(0, n), py = rand(0, n); x.moveTo(px, py); x.lineTo(px + rand(-10, 10), py + rand(-3, 3)); x.stroke(); } }, 128, 1.6, 5);
const NWEAVE = nrm((x, n) => { x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, n, n); for (let i = 0; i < n; i += 4) { x.fillStyle = 'rgb(150,150,150)'; x.fillRect(0, i, n, 2); x.fillStyle = 'rgb(115,115,115)'; x.fillRect(i, 0, 2, n); } for (let i = 0; i < n; i += 32) { x.fillStyle = 'rgb(185,185,185)'; x.fillRect(0, i, n, 1); x.fillRect(i, 0, 1, n); } }, 128, 2.6, 6);
function withN(m, t, k) { m.normalMap = t; m.normalScale = new T.Vector2(k, k); return m; }
/* ---------- Camuflajes de armas ---------- */
function blobs(x, base, cols, n, rmin, rmax) { x.fillStyle = base; x.fillRect(0, 0, 256, 256); for (let i = 0; i < n; i++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; x.save(); x.translate(rand(0, 256), rand(0, 256)); x.rotate(rand(0, 3)); x.beginPath(); x.ellipse(0, 0, rand(rmin, rmax), rand(rmin * .5, rmax * .55), 0, 0, 7); x.fill(); x.restore(); } }
const CAMO_SW = {};
function blobs2(x, col, n) { for (let i = 0; i < n; i++) { x.fillStyle = col; x.beginPath(); x.ellipse(rand(0, 256), rand(0, 256), rand(6, 22), rand(4, 14), rand(0, 3), 0, 7); x.fill(); } }
function camoTex(id) {
  const [c, x] = cnv(256, 256);
  if (id === 'bosque') blobs(x, '#4b5b33', ['#2e3a1e', '#6b7a45', '#5a4a30', '#3c4a26'], 70, 12, 34);
  else if (id === 'desierto') blobs(x, '#c2a878', ['#9c8156', '#d8c49a', '#b0925f'], 60, 12, 32);
  else if (id === 'digital') { x.fillStyle = '#6c7a86'; x.fillRect(0, 0, 256, 256); const cols = ['#3e4955', '#9aa6b0', '#55626e', '#2c343c']; for (let i = 0; i < 700; i++) { x.fillStyle = cols[(Math.random() * 4) | 0]; let px = (Math.random() * 64 | 0) * 4, py = (Math.random() * 64 | 0) * 4; for (let k = 0; k < 4; k++) { x.fillRect(px, py, 4, 4); if (Math.random() < .5) px += 4; else py += 4; } } }
  else if (id === 'tigre') { x.fillStyle = '#d4892a'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#17110b'; for (let i = 0; i < 22; i++) { const y0 = rand(-40, 256); x.beginPath(); x.moveTo(0, y0); for (let k = 0; k <= 16; k++) x.lineTo(k * 16, y0 + k * 6 + Math.sin(k * 1.3 + i) * 7); for (let k = 16; k >= 0; k--) x.lineTo(k * 16, y0 + k * 6 + 6 + Math.sin(k * 1.7 + i) * 5 * rand(.5, 1.3)); x.fill(); } }
  else if (id === 'carbono') { for (let yy = 0; yy < 256; yy += 8) for (let xx = 0; xx < 256; xx += 8) { const o = ((xx + yy) / 8) % 2; const g = x.createLinearGradient(xx, yy, xx + 8, yy + 8); g.addColorStop(0, o ? '#2c2e31' : '#18191b'); g.addColorStop(1, o ? '#1a1b1d' : '#2a2c2f'); x.fillStyle = g; x.fillRect(xx, yy, 8, 8); } }
  else if (id === 'carmesi') blobs(x, '#8e1d1d', ['#5c0f12', '#b02a24', '#741518'], 50, 14, 36);
  else if (id === 'acero' || id === 'cobre') { x.fillStyle = id === 'acero' ? '#a3aab2' : '#b46c3d'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { const v = rand(-1, 1); x.fillStyle = v > 0 ? `rgba(255,255,255,${v * .12})` : `rgba(0,0,0,${-v * .14})`; x.fillRect(0, rand(0, 256), 256, rand(.5, 1.6)); } if (id === 'cobre') blobs2(x, 'rgba(60,120,100,.18)', 8); }
  else if (id === 'oceano') { const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#1d7480'); g.addColorStop(.55, '#15506a'); g.addColorStop(1, '#0f3550'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  else if (id === 'grafito') { x.fillStyle = '#2b2e33'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(160,170,180,.16)'; x.lineWidth = 1.4; for (let yy = 0; yy < 270; yy += 14) for (let xx = 0; xx < 270; xx += 24) { const ox = (yy / 14) % 2 ? 12 : 0; x.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 6 * Math.PI * 2; x.lineTo(xx + ox + Math.cos(a) * 8, yy + Math.sin(a) * 8); } x.stroke(); } }
  else if (id === 'neon') { x.fillStyle = '#0d0f1a'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 26; i++) { x.strokeStyle = ['#ff2bd6', '#2bf0ff', '#a6ff2b'][i % 3]; x.globalAlpha = rand(.5, .95); x.lineWidth = rand(1.5, 4); x.beginPath(); let px = rand(0, 256), py = rand(0, 256); x.moveTo(px, py); for (let k = 0; k < 4; k++) { if (k % 2) px += rand(-60, 60); else py += rand(-60, 60); x.lineTo(px, py); } x.stroke(); } x.globalAlpha = 1; }
  else if (id === 'hielo') { const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#e6f6ff'); g.addColorStop(.5, '#8cc8ea'); g.addColorStop(1, '#3a7fb0'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 40; i++) { x.lineWidth = rand(.5, 1.6); x.beginPath(); const px = rand(0, 256), py = rand(0, 256); x.moveTo(px, py); x.lineTo(px + rand(-40, 40), py + rand(-40, 40)); x.stroke(); } }
  else if (id === 'magma') { x.fillStyle = '#1a0a06'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 18; i++) { x.strokeStyle = `rgba(255,${(rand(60, 160)) | 0},20,${rand(.6, .95)})`; x.lineWidth = rand(2, 5); x.beginPath(); let px = rand(0, 256), py = rand(0, 256); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rand(-30, 30); py += rand(-30, 30); x.lineTo(px, py); } x.stroke(); } blobs2(x, 'rgba(255,120,30,.25)', 10); }
  else if (id === 'obsidiana') { x.fillStyle = '#0b0b10'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${(rand(60, 120)) | 0},${(rand(40, 90)) | 0},${(rand(110, 180)) | 0},${rand(.08, .25)})`; x.beginPath(); const px = rand(0, 256), py = rand(0, 256); x.moveTo(px, py); x.lineTo(px + rand(-30, 30), py + rand(-30, 30)); x.lineTo(px + rand(-30, 30), py + rand(-30, 30)); x.fill(); } }
  else if (id === 'prisma') { for (let yy = 0; yy < 256; yy += 16) for (let xx = 0; xx < 256; xx += 16) { x.fillStyle = `hsl(${(xx + yy * 1.4) % 360},70%,${45 + ((xx / 16 + yy / 16) % 2) * 10}%)`; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 16, yy); x.lineTo(xx, yy + 16); x.fill(); x.fillStyle = `hsl(${(xx + yy * 1.4 + 40) % 360},70%,40%)`; x.beginPath(); x.moveTo(xx + 16, yy); x.lineTo(xx + 16, yy + 16); x.lineTo(xx, yy + 16); x.fill(); } }
  else if (id === 'aurora') { const g = x.createLinearGradient(0, 256, 256, 0); g.addColorStop(0, '#0d2a3a'); g.addColorStop(.3, '#1fae8a'); g.addColorStop(.55, '#3fd6e0'); g.addColorStop(.8, '#7a5ad8'); g.addColorStop(1, '#2a1a4a'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 12; i++) { x.strokeStyle = `rgba(255,255,255,${rand(.05, .14)})`; x.lineWidth = rand(2, 6); x.beginPath(); const y0 = rand(0, 256); x.moveTo(0, y0); x.bezierCurveTo(80, y0 - 40, 170, y0 + 40, 256, y0 - 10); x.stroke(); } }
  else { x.fillStyle = '#e8c35c'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 220; i++) { x.strokeStyle = `rgba(255,250,220,${rand(.1, .35)})`; x.lineWidth = rand(.5, 1.5); x.beginPath(); const px = rand(0, 256), py = rand(0, 256); x.moveTo(px, py); x.lineTo(px + rand(-20, 20), py + rand(-3, 3)); x.stroke(); } }
  speck(x, 256, 256, 3000, .08);
  CAMO_SW[id] = c.toDataURL('image/png');
  return mk(c, 4);
}


/* ---------- Materiales ---------- */
const S = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: .8, metalness: 0 }, o));
const MG = {
  metal: S({ color: 0x33363a, map: TXW, metalness: .85, roughness: .32 }),
  park: S({ color: 0x45484c, map: TXW, metalness: .55, roughness: .52 }),
  poly: S({ color: 0x232427, map: TXG, roughness: .72 }),
  tan: S({ color: 0xa8946e, map: TXG, roughness: .75 }),
  od: S({ color: 0x55603e, map: TXG, roughness: .76 }),
  wood: S({ map: TXWOOD, roughness: .5 }),
  steel: S({ color: 0xc9ccd0, metalness: 1, roughness: .16 }),
  glass: new T.MeshStandardMaterial({ color: 0x7fb8d8, metalness: .75, roughness: .03, transparent: true, opacity: .14, depthWrite: false, envMapIntensity: 1.4 }),
  red: new T.MeshBasicMaterial({ color: 0xff2b1a }),
  dotw: new T.MeshBasicMaterial({ color: 0xf4f1e6 }),
  dotg: new T.MeshBasicMaterial({ color: 0x8dff7a }),
  rubber: S({ color: 0x141414, roughness: .95 }),
  brass: S({ color: 0xc9a043, metalness: .9, roughness: .3 })
};

for (const k of ['poly', 'tan', 'od']) withN(MG[k], NSTIPPLE, .55);
for (const k of ['metal', 'park']) withN(MG[k], NBRUSH, .3);
withN(MG.rubber, NSTIPPLE, .9);
const MCAMO = {};
const ANIMC = { neon: { em: .95, sc: [.05, 0] }, magma: { em: .85, sc: [0, .03] }, prisma: { em: .3, sc: [.035, .035] }, hielo: { em: .18, sc: [0, -.01] }, aurora: { em: .4, sc: [.025, 0] }, obsidiana: { em: .22, sc: [.01, .01] } };
// skin efectiva de un arma: spec puede ser un id (todas las armas) o { d: general, w: { arma: id | 'none' } }
function camoFor(spec, id) { if (!spec) return null; if (typeof spec === 'string') return spec; const v = spec.w && Object.prototype.hasOwnProperty.call(spec.w, id) ? spec.w[id] : spec.d; return v && v !== 'none' ? v : null; }
const CAMO_PBR = { acero: [.95, .3], cobre: [.92, .32], oceano: [.7, .24], grafito: [.45, .4], aurora: [.75, .2], neon: [.3, .35], hielo: [.6, .15], magma: [.4, .5], obsidiana: [.8, .12], prisma: [.7, .2] };
for (const id of ['bosque', 'digital', 'desierto', 'tigre', 'carbono', 'carmesi', 'oro', 'acero', 'cobre', 'oceano', 'grafito', 'aurora', 'neon', 'hielo', 'magma', 'obsidiana', 'prisma']) {
  const t = camoTex(id);
  MCAMO[id] = CAMO_PBR[id] ? S({ map: t, metalness: CAMO_PBR[id][0], roughness: CAMO_PBR[id][1] }) : id === 'oro' ? S({ map: t, metalness: 1, roughness: .22 }) : id === 'carbono' ? S({ map: t, metalness: .45, roughness: .3 }) : id === 'carmesi' ? S({ map: t, metalness: .35, roughness: .38 }) : S({ map: t, roughness: .62, metalness: .1 });
}
const CAMO_KEYS = new Set(['poly', 'tan', 'od', 'park', 'wood']);

/* ---------- Geometría ---------- */
function shape(pts) { const s = new T.Shape(); let st = false; for (const p of pts) { if (p[0] === 'q') s.quadraticCurveTo(p[1], p[2], p[3], p[4]); else if (!st) { s.moveTo(p[0], p[1]); st = true; } else s.lineTo(p[0], p[1]); } return s; }
function ex(pts, w, z = 0, bev = .0025, holes) {
  const s = shape(pts); if (holes) for (const h of holes) s.holes.push(shape(h));
  const d = Math.max(.001, w - 2 * bev);
  const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -d / 2 + z); return g;
}
function cyl(r0, r1, x0, x1, y, z = 0, seg = 18) { const g = new T.CylinderGeometry(r1, r0, x1 - x0, seg); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, y, z); return g; }
function vcyl(r0, r1, y0, y1, x = 0, z = 0, seg = 18) { const g = new T.CylinderGeometry(r1, r0, y1 - y0, seg); g.translate(x, (y0 + y1) / 2, z); return g; }
function bx(x0, y0, x1, y1, w, z = 0) { const g = new T.BoxGeometry(x1 - x0, y1 - y0, w); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z); return g; }
function sph(r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 16) { const g = new T.SphereGeometry(r, seg, Math.max(8, seg * .7 | 0)); g.scale(sx, sy, sz); g.translate(x, y, z); return g; }
function tor(r, t, x, y, z, rx = 0) { const g = new T.TorusGeometry(r, t, 8, 22); g.rotateX(rx); g.translate(x, y, z); return g; }
function merge(list) {
  let n = 0; const parts = list.map(g => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const q of parts) { const c = q.attributes.position.count; pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) uv.set(q.attributes.uv.array, o * 2); o += c; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); return g;
}
// alza de hierro: dos postes con ranura central, visible desde la posición de tiro
const notch = (x0, x1, y0, yTop, yNotch, gap, w) => [bx(x0, y0, x1, yNotch, w), bx(x0, yNotch, x1, yTop, (w - gap) / 2, (gap + (w - gap) / 2) / 2), bx(x0, yNotch, x1, yTop, (w - gap) / 2, -(gap + (w - gap) / 2) / 2)];
const rail = (x0, x1, y, w) => { const l = [bx(x0, y, x1, y + .006, w)]; for (let x = x0 + .004; x < x1 - .006; x += .011) l.push(bx(x, y + .006, x + .006, y + .012, w * .92)); return l; };
const gripG = (x, w = .032) => ex([[x, .002], [x + .046, .002], [x + .022, -.1], [x - .028, -.096], [x - .033, -.08]], w, 0, .004);
const trig = (x) => [ex([[x - .012, 0], [x + .066, 0], [x + .066, -.034], [x - .012, -.034]], .012, 0, .002, [[[x - .004, -.004], [x + .058, -.004], [x + .058, -.026], [x - .004, -.026]]]), ex([[x + .022, 0], [x + .029, 0], [x + .034, -.022], [x + .027, -.024]], .006, 0, .001)];
function holo(x, y, w = .034) {
  // marco abierto: base, dos postes laterales y visera; se ve a través al apuntar
  const hw = w / 2;
  return { body: [bx(x - .03, y, x + .07, y + .012, w), bx(x - .018, y + .012, x + .062, y + .048, .004, hw - .002), bx(x - .018, y + .012, x + .062, y + .048, .004, -hw + .002), bx(x - .022, y + .046, x + .066, y + .052, w)],
    glass: bx(x + .028, y + .013, x + .03, y + .046, w - .006), sight: Object.assign([x + .027, y + .029], { ret: [x + .0262, y + .029, Math.min(.03, w - .008)] }) };
}

/* ---------- Definiciones de armas (adelante = +x, cañón en boreY) ---------- */
const DEF = {
  ar() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('park', ex([[-.105, 0], [.2, 0], [.215, .02], [.215, .074], [-.105, .074], [-.12, .058], [-.12, .012]], .054));
    a('metal', bx(.07, .03, .15, .058, .057));
    a('poly', ex([[.215, .006], [.47, .01], [.475, .02], [.475, .064], [.47, .07], [.215, .074]], .062, 0, .004));
    for (let x = .24; x < .45; x += .035) a('metal', bx(x, .03, x + .016, .05, .064));
    a('metal', cyl(.0105, .0105, .475, .6, .045)); a('metal', cyl(.016, .015, .6, .655, .045)); for (let i = 0; i < 3; i++) a('poly', bx(.612 + i * .013, .054, .618 + i * .013, .062, .034));
    a('park', rail(-.1, .21, .074, .032)); a('park', rail(.22, .46, .07, .03));
    a('park', ex([[.43, .07], [.45, .07], [.448, .108], [.438, .108]], .01));
    const h = holo(.0, .086); a('poly', h.body); a('glass', h.glass);
    a('metal', bx(-.105, .062, -.085, .072, .07)); a('poly', gripG(-.035)); a('metal', trig(-.025));
    a('metal', ex([[.03, 0], [.095, 0], ['q', .105, -.09, .135, -.17], [.075, -.185], ['q', .05, -.09, .03, 0]], .026));
    a('poly', ex([[-.12, .066], [-.12, .004], [-.31, -.028], [-.37, -.034], [-.375, -.02], [-.375, .06], [-.37, .07], [-.31, .07]], .046, 0, .004));
    a('park', cyl(.016, .016, -.31, -.12, .048)); a('rubber', bx(-.388, -.036, -.374, .071, .05));
    return { P, muzzle: .655, boreY: .045, grip: [-.03, -.05], fore: [.34, .006], cls: 'rifle', sight: h.sight, adsZ: -.17 };
  },
  fr9() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('tan', ex([[-.32, -.045], [-.1, -.03], [.02, -.005], [.3, -.002], [.31, .02], [.31, .072], [-.3, .075], [-.335, .04], [-.335, -.03]], .062, 0, .005));
    a('park', ex([[-.14, .074], [.18, .074], [.18, .124], [-.14, .124]], .024, 0, .003, [[[-.12, .085], [.16, .085], [.16, .112], [-.12, .112]]]));
    a('park', rail(-.12, .17, .124, .02));
    const h = holo(.04, .136, .03); a('poly', h.body); a('glass', h.glass);
    a('metal', cyl(.011, .011, .31, .46, .045)); a('metal', cyl(.015, .015, .46, .5, .045));
    a('poly', gripG(.07)); a('metal', trig(.08));
    a('metal', ex([[-.14, -.03], [-.08, -.02], ['q', -.07, -.09, -.06, -.16], [-.12, -.17], ['q', -.13, -.1, -.14, -.03]], .026));
    a('rubber', bx(-.347, -.046, -.333, .076, .064));
    return { P, muzzle: .5, boreY: .045, grip: [.085, -.05], fore: [.24, 0], cls: 'rifle', sight: h.sight, adsZ: -.2 };
  },
  smg() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('poly', ex([[-.13, 0], [.17, 0], [.18, .012], [.18, .066], [-.13, .068], [-.14, .04]], .05, 0, .004));
    a('park', bx(-.12, .066, .17, .075, .04));
    a('park', notch(-.1, -.08, .075, .099, .091, .007, .03)); a('dotw', sph(.0012, -.08, .0935, .0065, 1, 1, 1, 6)); a('dotw', sph(.0012, -.08, .0935, -.0065, 1, 1, 1, 6));
    a('park', bx(.152, .075, .162, .0975, .0045)); a('dotg', sph(.0013, .151, .0955, 0, 1, 1, 1, 6));
    a('metal', cyl(.019, .019, .18, .25, .038)); a('metal', cyl(.011, .011, .25, .29, .038));
    a('metal', ex([[.035, 0], [.08, 0], [.088, -.2], [.043, -.205]], .026));
    a('poly', gripG(-.045)); a('metal', trig(-.035));
    a('metal', cyl(.006, .006, -.36, -.13, .05, .018)); a('metal', cyl(.006, .006, -.36, -.13, .05, -.018)); a('rubber', bx(-.375, -.02, -.36, .08, .05));
    return { P, muzzle: .29, boreY: .038, grip: [-.04, -.05], fore: [.06, -.06], cls: 'rifle', sight: [.152, .0965], adsZ: -.2 };
  },
  lmg() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('park', ex([[-.16, -.012], [.26, -.012], [.27, .01], [.27, .088], [-.16, .088], [-.17, .06]], .072, 0, .005));
    a('park', ex([[-.13, .088], [.17, .088], [.15, .104], [-.11, .104]], .074, 0, .004));
    a('park', rail(-.12, .15, .104, .03));
    const h = holo(-.02, .116); a('poly', h.body); a('glass', h.glass);
    a('metal', cyl(.027, .027, .27, .47, .05)); for (const x of [.3, .36, .42]) a('poly', cyl(.0285, .0285, x, x + .012, .05));
    a('metal', cyl(.015, .015, .47, .74, .05)); a('metal', cyl(.02, .019, .74, .79, .05));
    a('poly', ex([[.28, .077], [.42, .077], [.42, .12], [.28, .12]], .016, 0, .003, [[[.295, .088], [.405, .088], [.405, .11], [.295, .11]]]));
    a('od', ex([[0, -.012], [.14, -.012], [.14, -.14], [0, -.14]], .08, .045, .006));
    a('metal', ex([[.62, .03], [.636, .03], [.6, -.17], [.587, -.17]], .01, .022)); a('metal', ex([[.62, .03], [.636, .03], [.6, -.17], [.587, -.17]], .01, -.022));
    a('poly', ex([[-.17, .08], [-.17, 0], [-.42, -.03], [-.44, -.03], [-.44, .085], [-.42, .09]], .05, 0, .005));
    a('poly', gripG(-.07)); a('metal', trig(-.06));
    return { P, muzzle: .79, boreY: .05, grip: [-.065, -.05], fore: [.34, .02], cls: 'rifle', sight: h.sight, adsZ: -.17 };
  },
  es12() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('park', ex([[-.1, 0], [.14, 0], [.15, .012], [.15, .07], [-.1, .072], [-.11, .05]], .05, 0, .004));
    a('metal', cyl(.0125, .0125, .15, .64, .056)); a('metal', cyl(.0125, .0125, .15, .57, .026)); a('metal', cyl(.014, .014, .57, .59, .026));
    a('steel', sph(.0045, .63, .0715, 0, 1, 1, 1, 10));
    a('park', notch(-.08, -.064, .072, .085, .079, .007, .03));
    a('wood', ex([[.24, .004], [.43, .004], [.44, .015], [.44, .045], [.43, .055], [.24, .055]], .06, 0, .006)); for (let x = .26; x < .42; x += .025) a('poly', bx(x, .004, x + .006, .055, .063));
    a('wood', ex([[-.1, .066], [-.1, .002], [-.13, -.035], [-.165, -.05], [-.43, -.075], [-.44, -.06], [-.44, .05], [-.42, .06], [-.18, .06]], .046, 0, .005));
    a('rubber', bx(-.455, -.078, -.44, .055, .048)); a('metal', trig(-.07));
    return { P, muzzle: .64, boreY: .056, grip: [-.12, -.03], fore: [.34, 0], cls: 'rifle', sight: [.63, .0715], adsZ: -.16 };
  },
  sr() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('od', ex([[-.47, 0], [-.47, .095], [-.44, .1], [-.2, .08], [-.05, .072], [.36, .072], [.37, .05], [.36, .028], [.04, .02], [-.02, 0], ['q', -.05, -.1, -.11, -.1], [-.135, -.02], [-.22, -.005]], .058, 0, .006, [[[-.12, .0], [-.065, .008], ['q', -.072, -.06, -.1, -.065], [-.12, 0]]]));
    a('od', ex([[-.4, .095], [-.24, .084], [-.24, .106], [-.4, .113]], .03, 0, .004));
    a('park', cyl(.024, .024, -.06, .24, .064)); a('steel', cyl(.006, .006, -.02, 0, .064, .035)); a('poly', sph(.012, -.01, .064, .065));
    a('metal', cyl(.016, .013, .24, .86, .058)); a('metal', cyl(.021, .021, .86, .93, .058)); for (let i = 0; i < 3; i++) a('poly', bx(.87 + i * .018, .07, .878 + i * .018, .08, .03));
    a('poly', cyl(.019, .019, -.04, .22, .135)); a('poly', cyl(.026, .019, -.12, -.04, .135)); a('poly', cyl(.019, .031, .22, .3, .135));
    a('poly', vcyl(.012, .012, .15, .175, .09, 0)); a('poly', bx(.08, .124, .1, .146, .07));
    a('glass', cyl(.028, .028, .3, .303, .135)); a('glass', cyl(.024, .024, -.123, -.12, .135));
    a('metal', bx(-.01, .062, .02, .14, .046)); a('metal', bx(.17, .062, .2, .14, .046));
    a('metal', ex([[.02, .02], [.1, .02], [.1, -.06], [.02, -.06]], .04));
    return { P, muzzle: .93, boreY: .058, grip: [-.085, -.05], fore: [.22, .03], cls: 'rifle', scope: true };
  },
  tr7() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('tan', ex([[-.42, 0], [-.42, .085], [-.2, .07], [.3, .065], [.31, .03], [0, .02], ['q', -.04, -.08, -.09, -.085], [-.12, -.01], [-.22, 0]], .05, 0, .005));
    a('park', cyl(.02, .02, -.04, .2, .058)); a('metal', cyl(.013, .011, .2, .72, .052)); a('metal', cyl(.014, .014, .72, .74, .052));
    a('steel', cyl(.005, .005, -.01, .006, .058, .03)); a('poly', sph(.01, -.002, .058, .055));
    a('poly', cyl(.016, .016, -.02, .18, .115)); a('poly', cyl(.022, .016, -.09, -.02, .115)); a('poly', cyl(.016, .025, .18, .24, .115));
    a('glass', cyl(.022, .022, .24, .243, .115)); a('glass', cyl(.02, .02, -.093, -.09, .115));
    a('metal', bx(.0, .06, .025, .12, .04)); a('metal', bx(.14, .06, .165, .12, .04)); a('metal', ex([[.03, .02], [.09, .02], [.09, -.045], [.03, -.045]], .036));
    return { P, muzzle: .74, boreY: .052, grip: [-.06, -.05], fore: [.2, .02], cls: 'rifle', scope: true };
  },
  knife() {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('steel', ex([[0, 0], [.15, .006], ['q', .19, .012, .205, .03], [.12, .034], [0, .034]], .004, 0, .001));
    a('metal', bx(-.006, -.012, .004, .046, .022));
    a('poly', ex([[-.11, .004], [-.006, 0], [-.006, .034], [-.11, .03], [-.12, .017]], .024, 0, .005)); for (let x = -.1; x < -.02; x += .02) a('rubber', bx(x, -.001, x + .008, .035, .026));
    a('metal', sph(.012, -.12, .017, 0));
    return { P, muzzle: .2, boreY: .017, grip: [-.05, .017], fore: [-.05, .017], cls: 'knife' };
  },
  he() { const P = [['od', sph(.032, 0, 0, 0, 1, 1.15, 1, 18)], ['metal', vcyl(.011, .011, .03, .05)], ['metal', ex([[-.006, .045], [.006, .045], [.012, -.025], [.0, -.03]], .014, .03)], ['steel', tor(.012, .002, 0, .055, .02)]]; return { P, muzzle: 0, boreY: 0, grip: [0, 0], fore: [0, 0], cls: 'nade' }; },
  fl() { const P = [['park', vcyl(.022, .022, -.05, .05)], ['poly', vcyl(.0225, .0225, -.03, -.02)], ['poly', vcyl(.0225, .0225, .02, .03)], ['metal', vcyl(.011, .011, .05, .065)], ['metal', ex([[-.006, .06], [.006, .06], [.012, -.03], [0, -.035]], .014, .026)], ['steel', tor(.012, .002, 0, .07, .02)]]; return { P, muzzle: 0, boreY: 0, grip: [0, 0], fore: [0, 0], cls: 'nade' }; },
  in() { const P = [['park', vcyl(.024, .026, -.055, .045)], ['red', vcyl(.0262, .0262, -.01, .006)], ['metal', vcyl(.014, .02, .045, .062)], ['steel', vcyl(.008, .008, .062, .075)], ['metal', ex([[-.006, .07], [.006, .07], [.012, -.03], [0, -.035]], .014, .028)]]; return { P, muzzle: 0, boreY: 0, grip: [0, 0], fore: [0, 0], cls: 'nade' }; },
  de() { const P = [['poly', vcyl(.02, .02, -.04, .04)], ['dotg', vcyl(.0205, .0205, .018, .024)], ['metal', vcyl(.01, .01, .04, .055)], ['rubber', vcyl(.021, .021, -.045, -.03)]]; return { P, muzzle: 0, boreY: 0, grip: [0, 0], fore: [0, 0], cls: 'nade' }; },
  sm() { const P = [['od', vcyl(.025, .025, -.055, .055)], ['tan', vcyl(.0255, .0255, -.015, .02)], ['metal', vcyl(.012, .012, .055, .07)], ['metal', ex([[-.006, .065], [.006, .065], [.012, -.035], [0, -.04]], .014, .029)], ['steel', tor(.012, .002, 0, .075, .022)]]; return { P, muzzle: 0, boreY: 0, grip: [0, 0], fore: [0, 0], cls: 'nade' }; }
};
function pistolDef(len, mag, comp) {
  return function () {
    const P = []; const a = (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g]);
    a('park', ex([[-.035, .03], [len, .03], [len + .006, .04], [len + .004, .058], [-.03, .062], [-.04, .05]], .03, 0, .003));
    for (let i = 0; i < 5; i++) a('poly', bx(-.03 + i * .008, .036, -.026 + i * .008, .058, .032));
    a('poly', ex([[-.025, 0], [len - .02, 0], [len - .02, .03], [-.025, .03]], .028, 0, .003));
    a('poly', ex([[-.035, .01], [.02, .01], [.004, -.105], [-.05, -.1], [-.052, -.085]], .031, 0, .004));
    a('poly', trig(.0)[0]); a('metal', trig(.0)[1]);
    a('metal', cyl(.007, .007, len - .002, len + .008, .046));
    a('metal', notch(-.032, -.018, .062, .0725, .0665, .0062, .024)); a('dotw', sph(.0011, -.0178, .069, .0058, 1, 1, 1, 6)); a('dotw', sph(.0011, -.0178, .069, -.0058, 1, 1, 1, 6));
    a('metal', bx(len - .016, .062, len - .009, .0715, .0034)); a('dotg', sph(.0012, len - .0165, .0692, 0, 1, 1, 1, 6));
    if (mag) a('metal', ex([[-.048, -.095], [0, -.095], [-.008, -.18], [-.05, -.18]], .026));
    if (comp) a('metal', ex([[len, .03], [len + .028, .032], [len + .028, .06], [len, .06]], .03, 0, .003));
    return { P, muzzle: len + (comp ? .03 : .008), boreY: .046, grip: [-.015, -.045], fore: [-.02, -.06], cls: 'pistol', sight: [len - .0125, .0705], adsZ: -.26 };
  };
}
DEF.p9 = pistolDef(.15);
// silenciador: tubo con anillos de sujeción, alarga el cañón
function withSuppressor(base, len, r, y) { return function () { const d = base(); const x0 = d.muzzle - .004; d.P.push(['park', cyl(r, r, x0, x0 + len, y, 0, 18)]); d.P.push(['metal', cyl(r * 1.06, r * 1.06, x0 + .006, x0 + .016, y, 0, 18)]); d.P.push(['metal', cyl(r * 1.06, r * 1.06, x0 + len - .012, x0 + len - .002, y, 0, 18)]); d.P.push(['rubber', cyl(r * .45, r * .45, x0 + len - .001, x0 + len + .002, y, 0, 12)]); d.muzzle = x0 + len; return d; }; }
DEF.p9s = withSuppressor(pistolDef(.15), .13, .0135, .046);
DEF.ars = withSuppressor(DEF.ar, .19, .018, .045); DEF.r50 = pistolDef(.2); DEF.ap18 = pistolDef(.155, true, true);
DEF.b3 = pistolDef(.17, false, true);
const A = () => { const P = []; return [P, (m, g) => Array.isArray(g) ? g.forEach(q => P.push([m, q])) : P.push([m, g])]; };
// K-11 Zorro: subfusil compacto con cargador largo y culata plegable
DEF.k11 = function () {
  const [P, a] = A();
  a('poly', ex([[-.11, 0], [.14, 0], [.15, .012], [.15, .07], [-.11, .072], [-.12, .045]], .048, 0, .004));
  a('od', ex([[-.1, .07], [.13, .07], [.13, .08], [-.1, .08]], .04, 0, .002));
  a('park', rail(-.09, .12, .08, .026)); const h = holo(-.02, .092, .03); a('poly', h.body); a('glass', h.glass);
  a('metal', cyl(.016, .016, .15, .21, .04)); a('metal', cyl(.02, .018, .21, .26, .04)); for (let i = 0; i < 4; i++) a('poly', bx(.22 + i * .01, .052, .225 + i * .01, .06, .03));
  a('metal', ex([[.03, 0], [.07, 0], [.085, -.24], [.045, -.25]], .024)); for (let y = -.06; y > -.23; y -= .04) a('poly', bx(.04, y, .08, y + .006, .026));
  a('poly', gripG(-.05)); a('metal', trig(-.04));
  a('metal', ex([[-.12, .055], [-.12, .045], [-.32, .02], [-.33, .03], [-.33, .07], [-.32, .075]], .01, .016)); a('metal', ex([[-.12, .055], [-.12, .045], [-.32, .02], [-.33, .03], [-.33, .07], [-.32, .075]], .01, -.016)); a('rubber', bx(-.345, .015, -.33, .078, .046));
  return { P, muzzle: .26, boreY: .04, grip: [-.045, -.05], fore: [.05, -.08], cls: 'rifle', sight: h.sight, adsZ: -.19 };
};
// P-12 Martillo: escopeta de corredera con guardamanos de madera estriado
DEF.pump = function () {
  const [P, a] = A();
  a('metal', ex([[-.1, 0], [.15, 0], [.16, .014], [.16, .07], [-.1, .072], [-.11, .05]], .048, 0, .004));
  a('metal', cyl(.013, .013, .16, .68, .058)); a('metal', cyl(.012, .012, .16, .6, .028)); a('metal', cyl(.0135, .0135, .6, .62, .028));
  a('steel', sph(.0045, .67, .0735, 0, 1, 1, 1, 10)); a('park', notch(-.08, -.064, .072, .085, .079, .007, .03));
  a('wood', ex([[.26, .006], [.45, .006], [.46, .016], [.46, .05], [.45, .06], [.26, .06]], .064, 0, .006)); for (let x = .28; x < .44; x += .018) a('poly', bx(x, .006, x + .005, .06, .067));
  a('wood', ex([[-.1, .066], [-.1, .004], [-.125, -.03], [-.16, -.048], [-.42, -.07], [-.435, -.055], [-.435, .052], [-.415, .062], [-.18, .062]], .046, 0, .005));
  a('rubber', bx(-.45, -.073, -.435, .057, .048)); a('metal', trig(-.07)); a('metal', bx(-.02, .02, .05, .05, .05));
  return { P, muzzle: .68, boreY: .058, grip: [-.12, -.03], fore: [.36, .0], cls: 'rifle', sight: [.67, .0735], adsZ: -.16 };
};
// BP-9 Escorpión: bullpup (cargador detrás de la empuñadura)
DEF.bp9 = function () {
  const [P, a] = A();
  a('tan', ex([[-.36, -.05], [-.36, .06], [-.34, .075], [.2, .075], [.22, .06], [.22, .012], [.08, .0], [.02, -.01], [-.12, -.02], [-.3, -.06]], .06, 0, .006));
  a('park', ex([[-.3, .075], [.18, .075], [.18, .088], [-.3, .088]], .03, 0, .002)); a('park', rail(-.28, .16, .088, .024));
  const h = holo(-.02, .1); a('poly', h.body); a('glass', h.glass);
  a('metal', cyl(.012, .012, .22, .44, .045)); a('metal', cyl(.016, .016, .44, .49, .045));
  a('poly', ex([[.04, .0], [.1, .0], [.088, -.1], [.035, -.098]], .034)); a('metal', trig(.045));
  a('metal', ex([[-.21, -.035], [-.15, -.03], [-.13, -.2], [-.19, -.21]], .026));
  a('rubber', bx(-.375, -.055, -.36, .072, .064));
  return { P, muzzle: .49, boreY: .045, grip: [.07, -.05], fore: [.18, .0], cls: 'rifle', sight: h.sight, adsZ: -.21 };
};
// M-14 Halcón: tirador designado con culata de madera y mira de aumento medio
DEF.dmr = function () {
  const [P, a] = A();
  a('wood', ex([[-.44, -.01], [-.44, .08], [-.2, .07], [.38, .066], [.39, .03], [.06, .02], ['q', .02, -.08, -.03, -.085], [-.06, -.01], [-.2, 0]], .052, 0, .005));
  a('metal', bx(-.08, .066, .2, .09, .04)); a('metal', cyl(.012, .011, .38, .78, .055)); a('metal', cyl(.016, .016, .78, .82, .055));
  a('poly', cyl(.015, .015, -.04, .14, .118)); a('poly', cyl(.021, .015, -.1, -.04, .118)); a('poly', cyl(.015, .023, .14, .19, .118));
  a('glass', cyl(.021, .021, .19, .193, .118)); a('glass', cyl(.019, .019, -.103, -.1, .118));
  a('metal', bx(-.02, .088, .0, .1, .036)); a('metal', bx(.1, .088, .12, .1, .036));
  a('metal', ex([[.08, .02], [.14, .02], [.13, -.12], [.08, -.12]], .032)); a('metal', trig(.0));
  a('rubber', bx(-.455, -.012, -.44, .082, .054));
  return { P, muzzle: .82, boreY: .055, grip: [-.02, -.05], fore: [.28, .02], cls: 'rifle', scope: true };
};
// AX-50 Cóndor: francotirador pesado con freno de boca y bípode
DEF.ax50 = function () {
  const [P, a] = A();
  a('od', ex([[-.5, -.02], [-.5, .1], [-.46, .11], [-.2, .085], [-.05, .078], [.4, .078], [.41, .03], [.05, .02], [-.01, -.005], ['q', -.04, -.1, -.1, -.105], [-.13, -.02], [-.25, -.03]], .066, 0, .007, [[[-.11, -.005], [-.06, .005], ['q', -.065, -.065, -.095, -.07], [-.11, -.005]]]));
  a('park', cyl(.028, .028, -.06, .26, .07)); a('metal', cyl(.02, .017, .26, 1.0, .064));
  a('metal', bx(1.0, .045, 1.08, .085, .06)); for (let i = 0; i < 3; i++) a('poly', bx(1.01 + i * .022, .05, 1.018 + i * .022, .08, .064));
  a('poly', cyl(.022, .022, -.05, .25, .15)); a('poly', cyl(.03, .022, -.14, -.05, .15)); a('poly', cyl(.022, .036, .25, .34, .15));
  a('glass', cyl(.033, .033, .34, .343, .15)); a('glass', cyl(.028, .028, -.143, -.14, .15));
  a('metal', bx(-.01, .07, .02, .16, .05)); a('metal', bx(.19, .07, .22, .16, .05));
  a('metal', ex([[.04, .02], [.13, .02], [.13, -.07], [.04, -.07]], .046));
  a('metal', ex([[.62, .03], [.635, .03], [.6, -.16], [.588, -.16]], .01, .024)); a('metal', ex([[.62, .03], [.635, .03], [.6, -.16], [.588, -.16]], .01, -.024));
  a('rubber', bx(-.515, -.025, -.5, .112, .07));
  return { P, muzzle: 1.08, boreY: .064, grip: [-.08, -.05], fore: [.26, .03], cls: 'rifle', scope: true };
};

const cache = {};
function gunParts(id) {
  if (cache[id]) return cache[id];
  const d = (DEF[id] || DEF.p9)(); const by = {};
  for (const [m, g] of d.P) (by[m] = by[m] || []).push(g);
  const meshes = []; for (const m in by) { const geo = merge(by[m]); geo.rotateY(Math.PI / 2); geo.computeBoundingSphere(); meshes.push([m, geo]); }
  return (cache[id] = { meshes, info: d });
}
const toLocal = (p) => new T.Vector3(0, p[1], -p[0]);
// retícula de mira holográfica: anillo de referencia, punto central y marcas cortas (dibujada una vez)
const RETTEX = (() => { const [c, x] = cnv(256, 256); x.clearRect(0, 0, 256, 256); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 6;
  x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 92, 0, 7); x.stroke(); x.beginPath(); x.arc(128, 128, 9, 0, 7); x.fill();
  for (const [a, b, c2, d] of [[128, 20, 128, 44], [128, 212, 128, 236], [20, 128, 44, 128], [212, 128, 236, 128]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); }
  const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; })();
const RETMAT = new T.MeshBasicMaterial({ map: RETTEX, color: 0xff2414, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
function buildGun(id, opt = {}) {
  const { meshes, info } = gunParts(id); const g = new T.Group();
  for (const [m, geo] of meshes) { const mat = opt.camo && MCAMO[opt.camo] && CAMO_KEYS.has(m) ? MCAMO[opt.camo] : MG[m]; const mesh = new T.Mesh(geo, mat); mesh.castShadow = opt.shadow !== false; mesh.receiveShadow = opt.shadow !== false; g.add(mesh); }
  if (info.sight && info.sight.ret) { const [rx, ry, rs] = info.sight.ret; const ret = new T.Mesh(new T.PlaneGeometry(rs * .82, rs * .82), RETMAT); ret.position.set(0, ry, -rx); ret.renderOrder = 3; g.add(ret); }
  const mz = new T.Object3D(); mz.position.set(0, info.boreY, -info.muzzle); g.add(mz);
  g.userData = { muzzle: mz, info };
  return g;
}

/* ---------- Soldados ---------- */
const GC = {};
function rbox(w, h, d, r) {
  const key = ['rb', w, h, d, r].join(); if (GC[key]) return GC[key];
  r = Math.min(r, w / 2 - .002, h / 2 - .002, d / 2 - .002);
  const iw = w - 2 * r, ih = h - 2 * r, rr = Math.min(r * .6, iw / 2, ih / 2), x = -iw / 2, y = -ih / 2; const s = new T.Shape();
  s.moveTo(x + rr, y); s.lineTo(x + iw - rr, y); s.quadraticCurveTo(x + iw, y, x + iw, y + rr); s.lineTo(x + iw, y + ih - rr); s.quadraticCurveTo(x + iw, y + ih, x + iw - rr, y + ih); s.lineTo(x + rr, y + ih); s.quadraticCurveTo(x, y + ih, x, y + ih - rr); s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const dd = Math.max(.001, d - 2 * r); const g = new T.ExtrudeGeometry(s, { depth: dd, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 }); g.translate(0, 0, -dd / 2);
  return (GC[key] = g);
}
function cylY(r0, r1, h, seg = 14) { const key = ['cy', r0, r1, h, seg].join(); if (!GC[key]) GC[key] = new T.CylinderGeometry(r1, r0, h, seg); return GC[key]; }
function sphG(r, w = 16, hs = 12) { const key = ['sp', r, w, hs].join(); if (!GC[key]) GC[key] = new T.SphereGeometry(r, w, hs); return GC[key]; }
const LOOK = [
  { vest: 0x262b31, pad: 0x1d2024, boot: 0x1b1b1b, glove: 0x1c1c1c, helm: 0x4b5661, belt: 0x1d1f22, pack: 0x30353b, cap: 0x2a2f36, skins: [0xc9a07e, 0x8d6248, 0xb88a68, 0x6e4a34] },
  { vest: 0x7a6446, pad: 0x5e4b33, boot: 0x8a7353, glove: 0x3a3226, helm: 0x9f8a62, belt: 0x5e4b33, pack: 0x6b5a40, wrap: 0xb8a27a, skins: [0xd2ab8a, 0x9b7052, 0x7f5a40, 0xc49572] }
];
const TEAMC = [0x5cc8e0, 0xef6a45];
const SCARF = [0x4a4f3a, 0x262626, 0x8a7350, 0x6b3a2e].map(c => S({ map: TXCLOTH, color: c, roughness: .95 }));
// Atuendos: paleta de camuflaje y colores de equipo por variante (el diseño del camuflaje sigue el estilo de cada bando)
const OUTFIT_DEF = {
  noche: { cols: ['#22272d', '#15181c', '#2e343b', '#1b1f24'], base: '#1d2126', vest: 0x15181c, helm: 0x23272c, pad: 0x101215, pack: 0x1a1d21 },
  artico: { cols: ['#d8dde2', '#aab3bb', '#eef1f3', '#8d969e'], base: '#c9d0d6', vest: 0x9aa3ab, helm: 0xc9d0d6, pad: 0x7d868e, pack: 0xaab3bb },
  selva: { cols: ['#3f5a2e', '#2a3b1f', '#5d7a3e', '#1f2a17'], base: '#344a27', vest: 0x34432a, helm: 0x4a5a36, pad: 0x27311f, pack: 0x3a4a2c },
  pulso: { cols: ['#1a1d24', '#0f1116', '#262b35', '#13161c'], base: '#16191f', vest: 0x111318, helm: 0x1a1d24, pad: 0x0d0f12, pack: 0x14171c, glow: true }
};
function texCamoV(team, cols, base) {
  const [c, x] = cnv(256, 256); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  if (team === 0) { for (let i = 0; i < 520; i++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; let px = (Math.random() * 64 | 0) * 4, py = (Math.random() * 64 | 0) * 4; const n = 2 + (Math.random() * 6 | 0); for (let k = 0; k < n; k++) { x.fillRect(px, py, 4, 4); px += (Math.random() < .5 ? 4 : 0); py += (Math.random() < .5 ? 4 : 0); } } }
  else for (let i = 0; i < 70; i++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; x.save(); x.translate(rand(0, 256), rand(0, 256)); x.rotate(rand(0, 3)); x.beginPath(); x.ellipse(0, 0, rand(10, 30), rand(5, 14), 0, 0, 7); x.fill(); x.restore(); }
  speck(x, 256, 256, 5000, .1); for (let i = 0; i < 256; i += 2) { x.fillStyle = 'rgba(0,0,0,.04)'; x.fillRect(0, i, 256, 1); }
  return mk(c, 2);
}
const OUTMATS = {}, OUTCAMO = {};
function outfitCamo(team, o) { const k = team + o; if (!OUTCAMO[k]) { const D = OUTFIT_DEF[o]; OUTCAMO[k] = texCamoV(team, D.cols, D.base); } return OUTCAMO[k]; }
function teamMatsFor(team, o) {
  if (!o || !OUTFIT_DEF[o]) return teamMats[team]; const k = team + o; if (OUTMATS[k]) return OUTMATS[k];
  const D = OUTFIT_DEF[o], B = teamMats[team], C = Object.assign({}, B);
  C.camo = withN(S({ map: outfitCamo(team, o), roughness: .92 }), NWEAVE, .28);
  for (const [key, col] of [['vest', D.vest], ['helm', D.helm], ['pad', D.pad], ['pack', D.pack]]) { C[key] = B[key].clone(); C[key].color.setHex(col); }
  if (D.glow) { C.tag = B.tag.clone(); C.tag.emissiveIntensity = 1.6; C.glow = true; }
  return (OUTMATS[k] = C);
}
const teamMats = [0, 1].map(t => {
  const L = LOOK[t];
  const o = {
    tag: S({ color: TEAMC[t], roughness: .55, emissive: TEAMC[t], emissiveIntensity: .35 }), molle: S({ color: 0x101113, roughness: .85 }), strap: S({ color: 0x0e0f10, roughness: .7 }),
    camo: S({ map: CAMO[t], roughness: .92 }), vest: S({ map: TXCLOTH, color: L.vest, roughness: .85 }), pad: S({ color: L.pad, roughness: .6 }), boot: S({ color: L.boot, roughness: .7 }),
    sole: S({ color: 0x111111, roughness: .9 }), glove: S({ map: TXCLOTH, color: L.glove, roughness: .75 }), helm: S({ map: TXG, color: L.helm, roughness: .55, side: T.DoubleSide }),
    belt: S({ color: L.belt, roughness: .7 }), pack: S({ map: TXCLOTH, color: L.pack, roughness: .85 }), black: S({ color: 0x151515, roughness: .5 }), lens: S({ color: 0x0c0f12, metalness: .8, roughness: .08 }),
    wrap: S({ map: TXCLOTH, color: L.wrap || 0x999999, roughness: .95 }), cap: S({ map: TXCLOTH, color: L.cap || 0x333333, roughness: .9, side: T.DoubleSide }), buckle: S({ color: 0x777777, metalness: .8, roughness: .35 })
  };
  for (const k of ['camo', 'vest', 'pack', 'glove', 'wrap', 'cap']) withN(o[k], NWEAVE, .28); withN(o.helm, NSTIPPLE, .4); withN(o.boot, NSTIPPLE, .6);
  return o;
});
const skinMats = {};
// Rostro pintado en la esfera de la cabeza (u = .75 es el frente): cejas, ojos, nariz, boca, sombras y barba según el soldado
const faceMats = {};
function faceMat(team, idx) {
  const v = idx % 4, k = team + '_' + v; if (faceMats[k]) return faceMats[k];
  const W = 256, H = 128, [c, x] = cnv(W, H), col = new T.Color(LOOK[team].skins[v]), hex = '#' + col.getHexString();
  const sh = (f) => '#' + col.clone().multiplyScalar(f).getHexString();
  x.fillStyle = hex; x.fillRect(0, 0, W, H);
  const cx = W * .75, eye = H * .44, mouth = H * .66;
  const g = x.createRadialGradient(cx, H * .5, 8, cx, H * .5, 70); g.addColorStop(0, 'rgba(255,230,210,.12)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = sh(.72); x.fillRect(cx - 18, eye - 7, 36, 4); // sombra de cejas
  x.fillStyle = '#2a1d14'; for (const s of [-1, 1]) { x.save(); x.translate(cx + s * 10, eye - 9); x.rotate(s * -.12); x.fillRect(-7, -1.5, 14, 3); x.restore(); }
  for (const s of [-1, 1]) { x.fillStyle = '#f2ece4'; x.beginPath(); x.ellipse(cx + s * 10, eye, 5, 2.6, 0, 0, 7); x.fill(); x.fillStyle = v % 2 ? '#3b2a1c' : '#2d3a40'; x.beginPath(); x.arc(cx + s * 10, eye, 2.1, 0, 7); x.fill(); }
  x.fillStyle = sh(.8); x.fillRect(cx - 2, eye + 4, 4, 12); x.fillStyle = sh(.66); x.fillRect(cx - 5, eye + 15, 10, 2.5); // nariz
  x.fillStyle = sh(.55); x.fillRect(cx - 8, mouth, 16, 2.4); x.fillStyle = sh(.82); x.fillRect(cx - 6, mouth + 3, 12, 2); // boca
  const beard = team === 0 ? v % 3 : (v === 2 ? 1 : 0);
  if (beard) { x.fillStyle = beard === 1 ? 'rgba(40,28,18,.85)' : 'rgba(40,30,22,.35)'; x.beginPath(); x.moveTo(cx - 26, eye + 10); x.quadraticCurveTo(cx - 24, H * .92, cx, H * .95); x.quadraticCurveTo(cx + 24, H * .92, cx + 26, eye + 10); x.lineTo(cx + 20, mouth + 6); x.lineTo(cx - 20, mouth + 6); x.closePath(); x.fill();
    if (beard === 1) { x.fillRect(cx - 9, mouth - 4, 18, 3.5); } x.fillStyle = sh(.55); x.fillRect(cx - 8, mouth, 16, 2.4); }
  const t = new T.CanvasTexture(c); t.anisotropy = ANISO; texs.push(t);
  return (faceMats[k] = S({ map: t, roughness: .6 }));
}
const skinMat = (team, idx) => { const k = team + '_' + (idx % 4); return skinMats[k] || (skinMats[k] = S({ color: LOOK[team].skins[idx % 4], roughness: .62 })); };
const _up = new T.Vector3(0, 1, 0);
function orientSeg(mesh, a, b) { const d = new T.Vector3().subVectors(b, a); const L = d.length() || 1e-4; mesh.position.copy(a).addScaledVector(d, .5); mesh.scale.set(1, L, 1); mesh.quaternion.setFromUnitVectors(_up, d.multiplyScalar(1 / L)); }
function solveArm(arm, Sh, Tg, a, b, pole) {
  if (arm.fdir) { // mano con dedos: el brazo llega a la muñeca y la mano se orienta con la dirección de los dedos y la palma
    const Y = arm.fdir.clone().normalize(), Z = arm.palm.clone().negate(); Z.addScaledVector(Y, -Z.dot(Y)).normalize(); const X = new T.Vector3().crossVectors(Y, Z);
    const H = Tg.clone(), W = H.clone().addScaledVector(Y, -arm.wrist); const f = arm.fdir; arm.fdir = null; const w = arm.wrist; arm.wrist = 0;
    const dS = Sh.clone().sub(W), mx = .9 * (a + b); if (dS.length() > mx) Sh = W.clone().addScaledVector(dS.normalize(), mx); // el hombro (fuera de cámara) se acerca para que el brazo alcance
    solveArm(arm, Sh, W, a, b, pole); arm.fdir = f; arm.wrist = w;
    arm.hand.position.copy(H); arm.hand.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z)); return;
  }
  const d = new T.Vector3().subVectors(Tg, Sh); let L = d.length(); L = Math.min(Math.max(L, .05), a + b - 1e-3); const dir = d.normalize();
  const x = (a * a - b * b + L * L) / (2 * L); const h = Math.sqrt(Math.max(0, a * a - x * x));
  const pv = pole.clone().sub(Sh); const perp = pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
  const E = Sh.clone().addScaledVector(dir, x).addScaledVector(perp, h); const T2 = Sh.clone().addScaledVector(dir, L);
  orientSeg(arm.up, Sh, E); arm.elbow.position.copy(E); orientSeg(arm.fore, E, arm.wrist ? T2.clone().addScaledVector(new T.Vector3().subVectors(T2, E).normalize(), -arm.wrist) : T2); arm.hand.position.copy(T2); arm.hand.quaternion.copy(arm.fore.quaternion);
  if (arm.palm) { // orienta la palma hacia el arma (la mano en primera persona tiene dedos)
    const Y = new T.Vector3().subVectors(T2, E).normalize(), Z = arm.palm.clone().negate(); Z.addScaledVector(Y, -Z.dot(Y)).normalize();
    const X = new T.Vector3().crossVectors(Y, Z); arm.hand.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  }
}
function mergeChildren(grp, skip) {
  const by = new Map(); const kill = [];
  for (const o of grp.children) {
    if (!o.isMesh || skip.has(o)) continue; o.updateMatrix();
    const key = o.material.uuid + '|' + (o.castShadow ? 1 : 0);
    let b = by.get(key); if (!b) { b = { mat: o.material, cast: o.castShadow, geos: [] }; by.set(key, b); }
    const g = o.geometry.clone(); g.applyMatrix4(o.matrix); b.geos.push(g); kill.push(o);
  }
  for (const o of kill) grp.remove(o);
  for (const b of by.values()) { const geo = merge(b.geos); geo.computeBoundingSphere(); const m = new T.Mesh(geo, b.mat); m.castShadow = b.cast; m.receiveShadow = true; grp.add(m); for (const g of b.geos) g.dispose(); }
}
const POSE_OV = { descanso: { pos: [.14, .3, -.2], rot: [.85, .15, .25] }, hombro: { pos: [.17, .64, .02], rot: [-1.15, .05, .12] }, alerta: { pos: [.06, .44, -.32], rot: [.22, 0, 0] } };
const HANDPOS = { rifle: [.1, .47, -.2], pistol: [.03, .47, -.44], knife: [.2, .3, -.27], nade: [.2, .34, -.25] };
function buildSoldier(team, idx, opt = {}) {
  const C = teamMatsFor(team, opt.outfit), skin = skinMat(team, idx);
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  const hips = new T.Group(); hips.position.y = .95; body.add(hips);
  add(hips, cylY(.165, .155, .2, 16), C.camo, 0, -.03, 0).scale.z = .68;
  add(hips, cylY(.172, .172, .05, 18), C.belt, 0, .06, 0).scale.z = .7; add(hips, rbox(.05, .035, .02, .006), C.buckle, 0, .06, -.12);
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(sx * .095, -.05, 0); hips.add(hip);
    add(hip, cylY(.08, .064, .43, 14), C.camo, 0, -.215, 0);
    if (sx > 0) add(hip, rbox(.06, .15, .11, .02), C.vest, .075, -.12, 0);
    const knee = new T.Group(); knee.position.y = -.43; hip.add(knee);
    add(knee, sphG(.064, 12, 10), C.camo); add(knee, rbox(.1, .1, .05, .018), C.pad, 0, -.02, -.055);
    add(knee, cylY(.06, .05, .4, 14), C.camo, 0, -.2, 0);
    add(knee, rbox(.115, .11, .27, .035), C.boot, 0, -.43, -.045); add(knee, rbox(.12, .035, .29, .012), C.sole, 0, -.485, -.045);
    legs.push({ hip, knee });
  }
  const upper = new T.Group(); upper.position.y = .95; body.add(upper);
  add(upper, cylY(.195, .16, .5, 18), C.camo, 0, .27, 0).scale.z = .64;
  add(upper, rbox(.38, .33, .27, .04), C.vest, 0, .32, 0); add(upper, rbox(.4, .05, .28, .02), C.vest, 0, .13, 0);
  for (const px of [-.105, 0, .105]) add(upper, rbox(.085, .11, .06, .016), C.vest, px, .21, -.16);
  add(upper, rbox(.11, .07, .04, .014), C.vest, -.09, .38, -.15);
  for (const sx of [-1, 1]) add(upper, rbox(.07, .04, .26, .012), C.vest, sx * .12, .49, 0);
  // portaplacas: cintas MOLLE, faja lateral, panel trasero y parches de identificación del equipo
  for (const my of [.255, .3, .345]) { add(upper, rbox(.3, .012, .012, .004), C.molle, 0, my, -.142); add(upper, rbox(.28, .012, .012, .004), C.molle, 0, my, .142); }
  for (const sx of [-1, 1]) { add(upper, rbox(.03, .2, .2, .01), C.vest, sx * .195, .27, 0); add(upper, rbox(.012, .14, .012, .004), C.strap, sx * .07, .4, -.142); }
  add(upper, rbox(.08, .035, .01, .004), C.tag, .07, .43, -.142); add(upper, rbox(.11, .05, .01, .004), C.tag, 0, .4, .142);
  for (const sx of [-1, 1]) { const t = add(upper, rbox(.012, .06, .07, .004), C.tag, sx * .262, .4, 0); t.rotation.z = sx * .25; }
  for (const sx of [-1, 1]) add(hips, rbox(.07, .08, .05, .014), C.vest, sx * .13, .02, -.07);
  add(hips, rbox(.1, .07, .05, .014), C.pack, 0, .02, .13);
  if (C.glow) { for (const sx of [-1, 1]) add(upper, rbox(.012, .2, .008, .003), C.tag, sx * .15, .3, -.146); add(upper, rbox(.24, .01, .008, .003), C.tag, 0, .18, -.146); add(upper, rbox(.2, .01, .008, .003), C.tag, 0, .46, .146); }
  add(upper, rbox(.055, .13, .045, .012), C.black, .2, .34, .06); add(upper, cylY(.004, .003, .22, 6), C.black, .21, .5, .07);
  add(upper, cylY(.052, .058, .12, 12), skin, 0, .58, 0);
  const head = new T.Group(); head.position.set(0, .71, 0); upper.add(head);
  add(head, sphG(.105, 24, 18), faceMat(team, idx)).scale.set(.95, 1.12, 1.02);
  add(head, rbox(.13, .06, .06, .025), skin, 0, -.075, -.055); // mandíbula
  add(head, rbox(.03, .045, .04, .012), skin, 0, -.01, -.105);
  for (const sx of [-1, 1]) add(head, sphG(.025, 8, 6), skin, sx * .1, 0, 0).scale.set(.5, 1, .8);
  let cap = null;
  if (team === 0) {
    add(head, rbox(.19, .04, .03, .012), C.lens, 0, .015, -.098);
    for (const sx of [-1, 1]) { const e = add(head, cylY(.036, .036, .03, 16), C.black, sx * .108, 0, 0); e.rotation.z = Math.PI / 2; }
    // Halcón: micrófono de radio en el auricular izquierdo
    const mic = add(head, cylY(.005, .005, .1, 6), C.black, -.1, -.045, -.06); mic.rotation.x = 1.15; mic.rotation.z = -.35; add(head, sphG(.012, 8, 6), C.black, -.085, -.07, -.105);
    cap = new T.Group(); head.add(cap); add(cap, new T.SphereGeometry(.113, 20, 10, 0, Math.PI * 2, 0, Math.PI * .5), C.cap, 0, .02, 0); const br = add(cap, rbox(.15, .012, .09, .005), C.cap, 0, .03, -.12); br.rotation.x = .12;
  } else {
    add(head, sphG(.117, 20, 16), C.wrap, 0, .012, .005).scale.set(1, 1.1, 1.05);
    add(head, rbox(.2, .05, .04, .015), C.lens, 0, .022, -.1); add(head, rbox(.06, .08, .05, .02), C.wrap, 0, -.02, .12);
    // Cobra: pañuelo sobre nariz y boca, con color distinto por soldado
    const scarf = SCARF[idx % 4]; add(head, rbox(.215, .085, .15, .04), scarf, 0, -.055, -.03); add(head, rbox(.17, .05, .05, .02), scarf, 0, -.1, -.085); add(head, rbox(.05, .07, .03, .012), scarf, 0, -.03, .125);
  }
  const helmet = new T.Group(); head.add(helmet);
  const shell = add(helmet, new T.SphereGeometry(.14, 24, 14, 0, Math.PI * 2, 0, Math.PI * .55), C.helm, 0, .03, 0); shell.scale.set(1, .95, 1.08);
  add(helmet, rbox(.05, .04, .02, .008), C.black, 0, .07, -.145); for (const sx of [-1, 1]) add(helmet, rbox(.02, .03, .1, .006), C.black, sx * .134, .04, 0);
  // casco: cascos auriculares, montura frontal con visor plegado, banda y parche de equipo
  for (const sx of [-1, 1]) { const e = add(helmet, cylY(.045, .045, .035, 16), C.black, sx * .125, -.03, 0); e.rotation.z = Math.PI / 2; }
  add(helmet, rbox(.07, .05, .04, .01), C.black, 0, .03, -.165); add(helmet, rbox(.11, .035, .045, .012), C.lens, 0, .045, -.19);
  add(helmet, cylY(.145, .147, .018, 24), C.strap, 0, .05, 0).scale.z = 1.08; add(helmet, rbox(.06, .03, .01, .004), C.tag, 0, .08, .15);
  helmet.visible = false;
  const pack = new T.Group(); pack.position.set(0, .32, .17); upper.add(pack); add(pack, rbox(.28, .3, .12, .03), C.pack); const led = new T.Mesh(sphG(.008, 8, 6), new T.MeshBasicMaterial({ color: 0xff3020 })); led.position.set(.09, .1, .065); pack.add(led); pack.visible = false;
  const arms = {}; const SH = { R: new T.Vector3(.2, .48, 0), L: new T.Vector3(-.2, .48, 0) };
  for (const s of ['R', 'L']) { const a = { up: add(upper, cylY(.056, .05, 1, 12), C.camo), elbow: add(upper, sphG(.05, 10, 8), C.camo), fore: add(upper, cylY(.05, .042, 1, 12), C.camo), hand: add(upper, rbox(.075, .1, .05, .018), C.glove) }; const pad = add(upper, sphG(.068, 12, 10), C.camo); pad.position.copy(SH[s]); pad.scale.set(1, .9, 1.1); arms[s] = a; }
  const hand = new T.Group(); upper.add(hand);
  const flash = new T.Sprite(opt.flashMat || new T.SpriteMaterial({ color: 0xffcc88 })); flash.scale.set(.42, .42, .42); flash.visible = false;
  const guns = {}; let cur = null;
  const model = { g, body, upper, hips, legs, head, helmet, pack, hand, flash, muzzle: new T.Object3D(), curGun: null, camo: opt.camo || null };
  model.setGun = function (id) {
    if (model.curGun === id) return; if (cur) cur.visible = false; model.curGun = id;
    if (!guns[id]) { guns[id] = buildGun(id, { camo: camoFor(model.camo, id) }); hand.add(guns[id]); }
    cur = guns[id]; cur.visible = true; const info = cur.userData.info; const cls = info.cls;
    const po = model.poseOv && cls === 'rifle' ? POSE_OV[model.poseOv] : null; model._hpy = undefined; hand.position.set(...(po ? po.pos : HANDPOS[cls])); if (po) hand.rotation.set(...po.rot); else hand.rotation.set(cls === 'knife' ? -.5 : 0, 0, 0); hand.updateMatrix();
    cur.userData.muzzle.add(flash); model.muzzle = cur.userData.muzzle;
    const gp = toLocal(info.grip).applyMatrix4(hand.matrix);
    const fp = cls === 'rifle' ? toLocal(info.fore).applyMatrix4(hand.matrix) : cls === 'pistol' ? gp.clone().add(new T.Vector3(-.035, -.01, .02)) : new T.Vector3(-.24, .14, -.08);
    solveArm(arms.R, SH.R, gp, .29, .27, new T.Vector3(.55, .1, .25)); solveArm(arms.L, SH.L, fp, .29, .27, new T.Vector3(-.6, 0, .05));
  };
  // las piezas chicas no proyectan sombra: misma silueta, la mitad de llamadas de dibujo en la pasada de sombras
  g.traverse(o => { if (o.isMesh) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const sc = Math.max(o.scale.x, o.scale.y, o.scale.z); if (o.geometry.boundingSphere.radius * sc < .07) o.castShadow = false; } });
  // fundir las piezas rígidas de cada articulación por material (los brazos con cinemática inversa quedan aparte)
  const skip = new Set(); for (const k in arms) for (const m of Object.values(arms[k])) skip.add(m);
  const groups = [hips, upper, head, helmet, pack]; if (cap) groups.push(cap); for (const l of legs) groups.push(l.hip, l.knee);
  for (const grp of groups) mergeChildren(grp, skip);
  model.setCamo = function (c) {
    c = c || null; if (JSON.stringify(c) === JSON.stringify(model.camo)) return; model.camo = c;
    for (const k in guns) { hand.remove(guns[k]); delete guns[k]; } cur = null;
    const was = model.curGun; model.curGun = null; if (was) model.setGun(was);
  };
  model.setPose = function (p) { const ov = POSE_OV[p] ? p : null; if (ov === (model.poseOv || null)) return; model.poseOv = ov; const was = model.curGun; model.curGun = null; if (was) model.setGun(was); };
  model.setHelmet = function (on) { helmet.visible = on; if (cap) cap.visible = !on; };
  model.animate = function (spd, ph, cr, pitch, mv) {
    mv = mv || {}; const t = performance.now() * .001, run = Math.min(1, spd / 3.2), k = run * (1 - cr * .55);
    // dirección del paso respecto de donde mira: de lado las piernas giran, hacia atrás el paso se invierte
    const fw = mv.fw === undefined ? spd : mv.fw, sd = mv.sd || 0, back = fw < -.3 && Math.abs(fw) > Math.abs(sd) * .6 ? -1 : 1;
    const tgtYaw = spd > .4 ? Math.max(-.85, Math.min(.85, Math.atan2(-sd, Math.abs(fw) + .01) * .75 * back)) : 0; model._hy = (model._hy || 0) + (tgtYaw - (model._hy || 0)) * .18;
    const amp = (mv.walk ? .42 : .58) * (1 - cr * .4), sw = Math.sin(ph) * amp * k * back;
    if (mv.air) { model._air = Math.min(1, (model._air || 0) + .12); } else model._air = Math.max(0, (model._air || 0) - .2); const air = model._air;
    legs[0].hip.rotation.x = sw * (1 - air) + cr * 1.25 + air * .55; legs[1].hip.rotation.x = -sw * (1 - air) + cr * .2 + air * .25;
    legs[0].knee.rotation.x = (-Math.max(0, Math.sin(ph - 1.3 * back)) * 1.05 * k - cr * 2.1) * (1 - air) - air * 1.0;
    legs[1].knee.rotation.x = (-Math.max(0, Math.sin(ph - 1.3 * back + Math.PI)) * 1.05 * k - cr * 1.7) * (1 - air) - air * .7;
    hips.rotation.y = model._hy; hips.rotation.z = Math.sin(ph) * .045 * k;
    const bob = Math.abs(Math.cos(ph)) * .03 * k, breath = Math.sin(t * 1.6) * .006 * (1 - run);
    const y = .95 - cr * .42 + bob - air * .05; hips.position.y = y; upper.position.y = y + breath;
    upper.rotation.x = pitch * .65 + cr * .1 + run * .06 + Math.sin(t * 1.6) * .012 * (1 - run); upper.rotation.y = -model._hy * .85 + Math.sin(ph) * .06 * k; upper.rotation.z = -Math.sin(ph) * .03 * k;
    head.rotation.x = pitch * .25 - run * .05; head.rotation.y = model._hy * .3;
    hand.position.y = (model._hpy !== undefined ? model._hpy : (model._hpy = hand.position.y)) + Math.sin(ph * 2) * .008 * k;
  };
  return model;
}

/* ---------- Brazos en primera persona ---------- */
const fpMats = { sleeve: withN(S({ map: CAMO[0], roughness: .92 }), NWEAVE, .5), glove: withN(S({ map: TXCLOTH, color: 0x1c1c1c, roughness: .75 }), NWEAVE, .35), cuff: S({ color: 0x2a2a2a, roughness: .8 }),
  pad: withN(S({ color: 0x0d0d0e, roughness: .55 }), NSTIPPLE, 1), watch: S({ color: 0x0b0b0c, roughness: .35, metalness: .4 }), face: S({ color: 0x0a1410, emissive: 0x3ee6a0, emissiveIntensity: .5, roughness: .2 }), tag: S({ color: 0x5cc8e0, emissive: 0x5cc8e0, emissiveIntensity: .1, roughness: .6 }) };
// Mano con guante táctico: palma, nudillos acolchados, 4 dedos en 3 falanges y pulgar. Eje +Y = hacia los dedos, palma hacia -Z.
const HANDC = {};
function handGeo(k, left) {
  const key = k + '|' + left; if (HANDC[key]) return HANDC[key];
  const G = { glove: [], pad: [], cuff: [] }, tmp = new T.Object3D(), sg = left ? -1 : 1;
  const put = (geo, m, pos, quat) => { tmp.position.set(pos[0] * k, pos[1] * k, pos[2] * k); tmp.quaternion.copy(quat || new T.Quaternion()); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); const g = geo.clone(); g.applyMatrix4(tmp.matrix); G[m].push(g); };
  const seg = (a, b, r, m = 'glove') => { const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); const g = new T.CylinderGeometry(r * k, r * .92 * k, L * k, 8); const q = new T.Quaternion().setFromUnitVectors(_up, d.normalize()); const c = A.add(B).multiplyScalar(.5); put(g, m, [c.x, c.y, c.z], q); put(new T.SphereGeometry(r * .98 * k, 8, 6), m, b); };
  put(rbox(.084 * k, .08 * k, .042 * k, .016 * k), 'glove', [0, 0, 0]);
  put(rbox(.074 * k, .03 * k, .014 * k, .006 * k), 'pad', [0, .026, .022]);
  put(rbox(.05 * k, .04 * k, .01 * k, .004 * k), 'pad', [0, -.012, .021]);
  for (let i = 0; i < 4; i++) {
    const x = (-.03 + i * .02) * sg * -1, r = i === 0 || i === 3 ? .0085 : .0095, l = i === 3 ? .8 : i === 1 ? 1.08 : 1;
    const p0 = [x, .038, 0], p1 = [x, .038 + .03 * l, -.004], p2 = [x, .04 + .03 * l, -.03 * l], p3 = [x, .036 + .012 * l, -.042 * l];
    put(new T.SphereGeometry(r * 1.05 * k, 8, 6), 'glove', p0); seg(p0, p1, r); seg(p1, p2, r * .95); seg(p2, p3, r * .88);
    put(rbox(.017 * k, .012 * k, .008 * k, .003 * k), 'pad', [x, .052 + .004 * l, .008]);
  }
  const tx = -.043 * sg; seg([tx * .8, -.025, -.012], [tx, .012, -.03], .0115); seg([tx, .012, -.03], [tx * .7, .036, -.045], .0102);
  put(new T.CylinderGeometry(.041 * k, .043 * k, .05 * k, 14), 'cuff', [0, -.06, 0]); put(new T.CylinderGeometry(.044 * k, .044 * k, .008 * k, 14), 'pad', [0, -.043, 0]);
  const out = {}; for (const m in G) { out[m] = merge(G[m]); out[m].computeBoundingSphere(); for (const g of G[m]) g.dispose(); }
  return (HANDC[key] = out);
}
function mkHand(k, left, watch) {
  const h = new T.Group(), H = handGeo(k, left); h.add(new T.Mesh(H.glove, fpMats.glove), new T.Mesh(H.pad, fpMats.pad), new T.Mesh(H.cuff, fpMats.cuff));
  if (watch) { const w = new T.Mesh(rbox(.036 * k, .04 * k, .014 * k, .005 * k), fpMats.watch); w.position.set(0, -.085 * k, .046 * k); const f = new T.Mesh(new T.PlaneGeometry(.026 * k, .028 * k), fpMats.face); f.position.set(0, -.085 * k, .0535 * k); h.add(w, f); }
  return h;
}
function setFpTeam(t, o) { fpMats.sleeve.map = o && OUTFIT_DEF[o] ? outfitCamo(t, o) : CAMO[t]; fpMats.sleeve.needsUpdate = true; fpMats.glove.color.setHex(LOOK[t].glove); fpMats.tag.color.setHex(TEAMC[t]); fpMats.tag.emissive.setHex(TEAMC[t]); fpMats.sleeve.color.setHex(t ? 0xb0a898 : 0x8f969e); }
function fpArms(gun, pos, s) {
  const info = gun.userData.info; if (info.cls === 'nade' && false) return;
  const add = (geo, mat) => { const m = new T.Mesh(geo, mat); gun.add(m); return m; };
  const toGun = (v) => new T.Vector3((v[0] - pos[0]) / s, (v[1] - pos[1]) / s, (v[2] - pos[2]) / s);
  const k = 1 / s, a = .3 * k, b = .28 * k;
  const mkArm = () => ({ up: add(cylY(.058 * k, .052 * k, 1, 14), fpMats.sleeve), elbow: add(sphG(.053 * k, 12, 10), fpMats.sleeve), fore: add(cylY(.05 * k, .044 * k, 1, 14), fpMats.sleeve), hand: null });
  const handOf = (arm, left, palm, watch, fdir) => { arm.hand = mkHand(k, left, watch); gun.add(arm.hand); arm.palm = new T.Vector3(...palm).normalize(); arm.wrist = .062 * k; arm.fdir = new T.Vector3(...fdir);
    const band = new T.Mesh(cylY(.0505 * k, .0495 * k, .045, 14), fpMats.tag); arm.fore.add(band); band.position.y = -.05; arm.band = band; };
  const R = mkArm(); handOf(R, false, [-1, .1, 0], false, [0, -.45, -1]); const gp = toLocal(info.grip).add(new T.Vector3(.042 * k, -.005 * k, .03 * k));
  const pist = info.cls === 'pistol', shR = pist ? [.24, -.56, .1] : [.26, -.42, .12], shL = pist ? [-.22, -.58, .08] : [-.24, -.44, .1];
  solveArm(R, toGun(shR), gp, a, b, toGun([.5, -.4, -.1]));
  if (info.cls === 'rifle' || info.cls === 'pistol') {
    const L = mkArm(); const rif = info.cls === 'rifle'; handOf(L, true, rif ? [-.2, 1, 0] : [.8, .5, 0], true, rif ? [1, .15, -.35] : [.4, -.35, -.8]); const fp = info.cls === 'rifle' ? toLocal(info.fore) : gp.clone().add(new T.Vector3(-.035, -.012, .02));
    if (rif) fp.add(new T.Vector3(-.03 * k, -.028 * k, 0));
    solveArm(L, toGun(shL), fp, a, b, toGun([-.55, -.45, -.1]));
    // datos para animar la recarga: la mano izquierda va al cargador, baja a buscar otro y vuelve
    const g0 = toLocal(info.grip), mag = info.cls === 'pistol' ? toLocal([info.grip[0] - .01, info.grip[1] - .11]) : toLocal([info.grip[0] + .1, info.grip[1] - .07]);
    mag.x -= .03 * k; gun.userData.fpL = { arm: L, sh: toGun(shL), fore: fp.clone(), mag, low: mag.clone().add(new T.Vector3(-.06 * k, -.3 * k, .1 * k)), pole: toGun([-.55, -.45, -.1]), a, b, t: 0 };
  }
}

const _rt = new T.Vector3();
function poseReload(gun, t) {
  const L = gun.userData.fpL; if (!L || Math.abs(L.t - t) < 1e-3) return; L.t = t;
  const sm = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
  if (t <= 0) _rt.copy(L.fore); else if (t < .22) _rt.lerpVectors(L.fore, L.mag, sm(t / .22)); else if (t < .42) _rt.lerpVectors(L.mag, L.low, sm((t - .22) / .2));
  else if (t < .66) _rt.lerpVectors(L.low, L.mag, sm((t - .42) / .24)); else if (t < .8) _rt.copy(L.mag).add(new T.Vector3(0, .012 * Math.sin((t - .66) / .14 * Math.PI) / (gun.scale.x || 1), 0)); else _rt.lerpVectors(L.mag, L.fore, sm((t - .8) / .2));
  solveArm(L.arm, L.sh, _rt.clone(), L.a, L.b, L.pole);
}
// camuflajes animados del pase: brillo que respira y dibujo que se desliza
for (const id in ANIMC) { const m = MCAMO[id]; if (!m || !m.map) continue; m.emissive = new T.Color(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = ANIMC[id].em; m.needsUpdate = true; }
function tickCamo(t) { for (const id in ANIMC) { const m = MCAMO[id]; if (!m || !m.map) continue; const a = ANIMC[id]; m.map.offset.set(a.sc[0] * t % 1, a.sc[1] * t % 1); m.emissiveIntensity = a.em * (.7 + .3 * Math.sin(t * 2.2)); } }
// dijes: cuelgan de un cordón al costado izquierdo del arma (el que ve el jugador)
const CHM = { brass: S({ color: 0xc9a043, metalness: .9, roughness: .3 }), white: S({ color: 0xf2efe8, roughness: .35 }), black: S({ color: 0x111111, roughness: .5 }), steel: S({ color: 0x8a9096, metalness: .85, roughness: .3 }), gold: S({ color: 0xe8b84a, metalness: .95, roughness: .25, emissive: 0x3a2400 }), cord: S({ color: 0x1a1a1a, roughness: .9 }), amber: S({ color: 0xf2b33d, roughness: .4, emissive: 0x5a3000 }) };
function charmMesh(id) {
  const g = new T.Group(), add = (geo, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  if (id === 'bala') { add(new T.CylinderGeometry(.006, .006, .018, 10), CHM.brass, 0, -.009); add(new T.ConeGeometry(.006, .012, 10), CHM.brass, 0, .006); }
  else if (id === 'dado') { add(rbox(.016, .016, .016, .003), CHM.white); for (const [x, y] of [[-.004, .004], [0, 0], [.004, -.004]]) add(new T.SphereGeometry(.0018, 6, 4), CHM.black, x, y, .0082); }
  else if (id === 'ancla') { add(new T.CylinderGeometry(.0018, .0018, .024, 6), CHM.steel); const r = add(new T.TorusGeometry(.009, .0018, 6, 14, Math.PI), CHM.steel, 0, -.009); r.rotation.z = Math.PI; add(new T.TorusGeometry(.003, .0012, 6, 10), CHM.steel, 0, .014); add(new T.BoxGeometry(.014, .002, .002), CHM.steel, 0, .007); }
  else if (id === 'estrella') { const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .0045 : .011; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const ge = new T.ExtrudeGeometry(s, { depth: .003, bevelEnabled: true, bevelThickness: .001, bevelSize: .001, bevelSegments: 1 }); ge.translate(0, 0, -.0015); add(ge, CHM.gold); }
  else { const s = new T.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, r = .01; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); } const ge = new T.ExtrudeGeometry(s, { depth: .003, bevelEnabled: true, bevelThickness: .001, bevelSize: .001, bevelSegments: 1 }); ge.translate(0, 0, -.0015); add(ge, CHM.amber); add(new T.BoxGeometry(.008, .003, .0045), CHM.black, 0, 0, 0); }
  return g;
}
function addCharm(gun, id) {
  if (gun.userData.charm) { gun.remove(gun.userData.charm); gun.userData.charm = null; } if (!id) return;
  const info = gun.userData.info; if (!info || info.cls === 'nade' || info.cls === 'knife') return;
  const p = toLocal([info.grip[0] + (info.cls === 'pistol' ? .05 : .17), info.grip[1] + (info.cls === 'pistol' ? .045 : .07)]); const piv = new T.Group(); piv.position.set(info.cls === 'pistol' ? -.022 : -.034, p.y, p.z);
  const cord = new T.Mesh(new T.CylinderGeometry(.0009, .0009, .03, 4), CHM.cord); cord.position.y = -.015; piv.add(cord); const c = charmMesh(id); c.position.y = -.038; piv.add(c);
  gun.add(piv); gun.userData.charm = piv;
}
window.PCM = {
  buildGun, buildSoldier, fpArms, setFpTeam, poseReload, tickCamo, addCharm, camoFor, camoSwatch: (id) => CAMO_SW[id] || '', gunInfo: (id) => gunParts(id).info, toLocal, merge,
  setEnv(env) { for (const m of Object.values(MCAMO).concat(Object.values(MG))) if (m && m.isMeshStandardMaterial && m.metalness > .3) { m.envMap = env; m.envMapIntensity = .9; m.needsUpdate = true; } },
  setAniso(n) { ANISO = n; for (const t of texs) { t.anisotropy = n; t.needsUpdate = true; } }
};
})();
