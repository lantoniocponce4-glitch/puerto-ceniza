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
/* ---------- Camuflajes de armas ---------- */
function blobs(x, base, cols, n, rmin, rmax) { x.fillStyle = base; x.fillRect(0, 0, 256, 256); for (let i = 0; i < n; i++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; x.save(); x.translate(rand(0, 256), rand(0, 256)); x.rotate(rand(0, 3)); x.beginPath(); x.ellipse(0, 0, rand(rmin, rmax), rand(rmin * .5, rmax * .55), 0, 0, 7); x.fill(); x.restore(); } }
const CAMO_SW = {};
function camoTex(id) {
  const [c, x] = cnv(256, 256);
  if (id === 'bosque') blobs(x, '#4b5b33', ['#2e3a1e', '#6b7a45', '#5a4a30', '#3c4a26'], 70, 12, 34);
  else if (id === 'desierto') blobs(x, '#c2a878', ['#9c8156', '#d8c49a', '#b0925f'], 60, 12, 32);
  else if (id === 'digital') { x.fillStyle = '#6c7a86'; x.fillRect(0, 0, 256, 256); const cols = ['#3e4955', '#9aa6b0', '#55626e', '#2c343c']; for (let i = 0; i < 700; i++) { x.fillStyle = cols[(Math.random() * 4) | 0]; let px = (Math.random() * 64 | 0) * 4, py = (Math.random() * 64 | 0) * 4; for (let k = 0; k < 4; k++) { x.fillRect(px, py, 4, 4); if (Math.random() < .5) px += 4; else py += 4; } } }
  else if (id === 'tigre') { x.fillStyle = '#d4892a'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#17110b'; for (let i = 0; i < 22; i++) { const y0 = rand(-40, 256); x.beginPath(); x.moveTo(0, y0); for (let k = 0; k <= 16; k++) x.lineTo(k * 16, y0 + k * 6 + Math.sin(k * 1.3 + i) * 7); for (let k = 16; k >= 0; k--) x.lineTo(k * 16, y0 + k * 6 + 6 + Math.sin(k * 1.7 + i) * 5 * rand(.5, 1.3)); x.fill(); } }
  else if (id === 'carbono') { for (let yy = 0; yy < 256; yy += 8) for (let xx = 0; xx < 256; xx += 8) { const o = ((xx + yy) / 8) % 2; const g = x.createLinearGradient(xx, yy, xx + 8, yy + 8); g.addColorStop(0, o ? '#2c2e31' : '#18191b'); g.addColorStop(1, o ? '#1a1b1d' : '#2a2c2f'); x.fillStyle = g; x.fillRect(xx, yy, 8, 8); } }
  else if (id === 'carmesi') blobs(x, '#8e1d1d', ['#5c0f12', '#b02a24', '#741518'], 50, 14, 36);
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
  glass: new T.MeshStandardMaterial({ color: 0x9fd0e8, metalness: .6, roughness: .02, transparent: true, opacity: .18, depthWrite: false }),
  red: new T.MeshBasicMaterial({ color: 0xff2b1a }),
  dotw: new T.MeshBasicMaterial({ color: 0xf4f1e6 }),
  dotg: new T.MeshBasicMaterial({ color: 0x8dff7a }),
  rubber: S({ color: 0x141414, roughness: .95 }),
  brass: S({ color: 0xc9a043, metalness: .9, roughness: .3 })
};

const MCAMO = {};
for (const id of ['bosque', 'digital', 'desierto', 'tigre', 'carbono', 'carmesi', 'oro']) {
  const t = camoTex(id);
  MCAMO[id] = id === 'oro' ? S({ map: t, metalness: 1, roughness: .22 }) : id === 'carbono' ? S({ map: t, metalness: .45, roughness: .3 }) : id === 'carmesi' ? S({ map: t, metalness: .35, roughness: .38 }) : S({ map: t, roughness: .62, metalness: .1 });
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
    glass: bx(x + .028, y + .013, x + .03, y + .046, w - .006), dot: sph(.0015, x + .027, y + .029, 0, 1, 1, 1, 8), sight: [x + .027, y + .029] };
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
    const h = holo(.0, .086); a('poly', h.body); a('glass', h.glass); a('red', h.dot);
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
    const h = holo(.04, .136, .03); a('poly', h.body); a('glass', h.glass); a('red', h.dot);
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
    const h = holo(-.02, .116); a('poly', h.body); a('glass', h.glass); a('red', h.dot);
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
DEF.p9 = pistolDef(.15); DEF.r50 = pistolDef(.2); DEF.ap18 = pistolDef(.155, true, true);

const cache = {};
function gunParts(id) {
  if (cache[id]) return cache[id];
  const d = (DEF[id] || DEF.p9)(); const by = {};
  for (const [m, g] of d.P) (by[m] = by[m] || []).push(g);
  const meshes = []; for (const m in by) { const geo = merge(by[m]); geo.rotateY(Math.PI / 2); geo.computeBoundingSphere(); meshes.push([m, geo]); }
  return (cache[id] = { meshes, info: d });
}
const toLocal = (p) => new T.Vector3(0, p[1], -p[0]);
function buildGun(id, opt = {}) {
  const { meshes, info } = gunParts(id); const g = new T.Group();
  for (const [m, geo] of meshes) { const mat = opt.camo && MCAMO[opt.camo] && CAMO_KEYS.has(m) ? MCAMO[opt.camo] : MG[m]; const mesh = new T.Mesh(geo, mat); mesh.castShadow = opt.shadow !== false; mesh.receiveShadow = opt.shadow !== false; g.add(mesh); }
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
const teamMats = [0, 1].map(t => {
  const L = LOOK[t];
  return {
    camo: S({ map: CAMO[t], roughness: .92 }), vest: S({ map: TXCLOTH, color: L.vest, roughness: .85 }), pad: S({ color: L.pad, roughness: .6 }), boot: S({ color: L.boot, roughness: .7 }),
    sole: S({ color: 0x111111, roughness: .9 }), glove: S({ map: TXCLOTH, color: L.glove, roughness: .75 }), helm: S({ map: TXG, color: L.helm, roughness: .55, side: T.DoubleSide }),
    belt: S({ color: L.belt, roughness: .7 }), pack: S({ map: TXCLOTH, color: L.pack, roughness: .85 }), black: S({ color: 0x151515, roughness: .5 }), lens: S({ color: 0x0c0f12, metalness: .8, roughness: .08 }),
    wrap: S({ map: TXCLOTH, color: L.wrap || 0x999999, roughness: .95 }), cap: S({ map: TXCLOTH, color: L.cap || 0x333333, roughness: .9, side: T.DoubleSide }), buckle: S({ color: 0x777777, metalness: .8, roughness: .35 })
  };
});
const skinMats = {};
const skinMat = (team, idx) => { const k = team + '_' + (idx % 4); return skinMats[k] || (skinMats[k] = S({ color: LOOK[team].skins[idx % 4], roughness: .62 })); };
const _up = new T.Vector3(0, 1, 0);
function orientSeg(mesh, a, b) { const d = new T.Vector3().subVectors(b, a); const L = d.length() || 1e-4; mesh.position.copy(a).addScaledVector(d, .5); mesh.scale.set(1, L, 1); mesh.quaternion.setFromUnitVectors(_up, d.multiplyScalar(1 / L)); }
function solveArm(arm, Sh, Tg, a, b, pole) {
  const d = new T.Vector3().subVectors(Tg, Sh); let L = d.length(); L = Math.min(Math.max(L, .05), a + b - 1e-3); const dir = d.normalize();
  const x = (a * a - b * b + L * L) / (2 * L); const h = Math.sqrt(Math.max(0, a * a - x * x));
  const pv = pole.clone().sub(Sh); const perp = pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
  const E = Sh.clone().addScaledVector(dir, x).addScaledVector(perp, h); const T2 = Sh.clone().addScaledVector(dir, L);
  orientSeg(arm.up, Sh, E); arm.elbow.position.copy(E); orientSeg(arm.fore, E, T2); arm.hand.position.copy(T2); arm.hand.quaternion.copy(arm.fore.quaternion);
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
const HANDPOS = { rifle: [.1, .47, -.2], pistol: [.03, .47, -.44], knife: [.2, .3, -.27], nade: [.2, .34, -.25] };
function buildSoldier(team, idx, opt = {}) {
  const C = teamMats[team], skin = skinMat(team, idx);
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
  add(upper, rbox(.055, .13, .045, .012), C.black, .2, .34, .06); add(upper, cylY(.004, .003, .22, 6), C.black, .21, .5, .07);
  add(upper, cylY(.052, .058, .12, 12), skin, 0, .58, 0);
  const head = new T.Group(); head.position.set(0, .71, 0); upper.add(head);
  add(head, sphG(.105, 24, 18), skin).scale.set(.95, 1.12, 1.02);
  add(head, rbox(.03, .045, .04, .012), skin, 0, -.01, -.105);
  for (const sx of [-1, 1]) add(head, sphG(.025, 8, 6), skin, sx * .1, 0, 0).scale.set(.5, 1, .8);
  let cap = null;
  if (team === 0) {
    add(head, rbox(.19, .04, .03, .012), C.lens, 0, .015, -.098);
    for (const sx of [-1, 1]) { const e = add(head, cylY(.036, .036, .03, 16), C.black, sx * .108, 0, 0); e.rotation.z = Math.PI / 2; }
    cap = new T.Group(); head.add(cap); add(cap, new T.SphereGeometry(.113, 20, 10, 0, Math.PI * 2, 0, Math.PI * .5), C.cap, 0, .02, 0); const br = add(cap, rbox(.15, .012, .09, .005), C.cap, 0, .03, -.12); br.rotation.x = .12;
  } else {
    add(head, sphG(.117, 20, 16), C.wrap, 0, .012, .005).scale.set(1, 1.1, 1.05);
    add(head, rbox(.2, .05, .04, .015), C.lens, 0, .022, -.1); add(head, rbox(.06, .08, .05, .02), C.wrap, 0, -.02, .12);
  }
  const helmet = new T.Group(); head.add(helmet);
  const shell = add(helmet, new T.SphereGeometry(.14, 24, 14, 0, Math.PI * 2, 0, Math.PI * .55), C.helm, 0, .03, 0); shell.scale.set(1, .95, 1.08);
  add(helmet, rbox(.05, .04, .02, .008), C.black, 0, .07, -.145); for (const sx of [-1, 1]) add(helmet, rbox(.02, .03, .1, .006), C.black, sx * .134, .04, 0);
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
    if (!guns[id]) { guns[id] = buildGun(id, { camo: model.camo }); hand.add(guns[id]); }
    cur = guns[id]; cur.visible = true; const info = cur.userData.info; const cls = info.cls;
    hand.position.set(...HANDPOS[cls]); hand.rotation.set(cls === 'knife' ? -.5 : 0, 0, 0); hand.updateMatrix();
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
    c = c || null; if (c === model.camo) return; model.camo = c;
    for (const k in guns) { hand.remove(guns[k]); delete guns[k]; } cur = null;
    const was = model.curGun; model.curGun = null; if (was) model.setGun(was);
  };
  model.setHelmet = function (on) { helmet.visible = on; if (cap) cap.visible = !on; };
  model.animate = function (spd, ph, cr, pitch) {
    const k = Math.min(1, spd / 3.2) * (1 - cr); const sw = Math.sin(ph) * .6 * k;
    legs[0].hip.rotation.x = sw + cr * 1.25; legs[1].hip.rotation.x = -sw + cr * .2;
    legs[0].knee.rotation.x = -Math.max(0, Math.sin(ph - 1.3)) * 1.0 * k - cr * 2.1;
    legs[1].knee.rotation.x = -Math.max(0, Math.sin(ph - 1.3 + Math.PI)) * 1.0 * k - cr * 1.7;
    const y = .95 - cr * .42 + Math.abs(Math.cos(ph)) * .022 * k; hips.position.y = y; upper.position.y = y;
    upper.rotation.x = pitch * .65 + cr * .1; upper.rotation.y = Math.sin(ph) * .05 * k; head.rotation.x = pitch * .25;
  };
  return model;
}

/* ---------- Brazos en primera persona ---------- */
const fpMats = { sleeve: S({ map: CAMO[0], roughness: .92 }), glove: S({ map: TXCLOTH, color: 0x1c1c1c, roughness: .75 }), cuff: S({ color: 0x2a2a2a, roughness: .8 }) };
function setFpTeam(t) { fpMats.sleeve.map = CAMO[t]; fpMats.sleeve.needsUpdate = true; fpMats.glove.color.setHex(LOOK[t].glove); }
function fpArms(gun, pos, s) {
  const info = gun.userData.info; if (info.cls === 'nade' && false) return;
  const add = (geo, mat) => { const m = new T.Mesh(geo, mat); gun.add(m); return m; };
  const toGun = (v) => new T.Vector3((v[0] - pos[0]) / s, (v[1] - pos[1]) / s, (v[2] - pos[2]) / s);
  const k = 1 / s, a = .3 * k, b = .28 * k;
  const mkArm = () => ({ up: add(cylY(.058 * k, .052 * k, 1, 14), fpMats.sleeve), elbow: add(sphG(.053 * k, 12, 10), fpMats.sleeve), fore: add(cylY(.05 * k, .044 * k, 1, 14), fpMats.sleeve), hand: add(rbox(.08 * k, .1 * k, .055 * k, .02 * k), fpMats.glove) });
  const R = mkArm(); const gp = toLocal(info.grip);
  const pist = info.cls === 'pistol', shR = pist ? [.24, -.56, .1] : [.26, -.42, .12], shL = pist ? [-.22, -.58, .08] : [-.24, -.44, .1];
  solveArm(R, toGun(shR), gp, a, b, toGun([.5, -.4, -.1]));
  if (info.cls === 'rifle' || info.cls === 'pistol') {
    const L = mkArm(); const fp = info.cls === 'rifle' ? toLocal(info.fore) : gp.clone().add(new T.Vector3(-.035, -.012, .02));
    solveArm(L, toGun(shL), fp, a, b, toGun([-.55, -.45, -.1]));
  }
}

window.PCM = {
  buildGun, buildSoldier, fpArms, setFpTeam, camoSwatch: (id) => CAMO_SW[id] || '', gunInfo: (id) => gunParts(id).info, toLocal, merge,
  setAniso(n) { ANISO = n; for (const t of texs) { t.anisotropy = n; t.needsUpdate = true; } }
};
})();
