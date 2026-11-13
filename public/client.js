/* Puerto Ceniza — cliente (render, entrada, red, HUD) */
(function () {
'use strict';
const PC = window.PC;
const $ = s => document.querySelector(s);
if (!window.THREE || !PC) { document.body.insertAdjacentHTML('beforeend', '<div class="ov" style="z-index:9"><div class="box"><h2>No cargó el juego</h2><p class="lead">Revisa tu conexión y recarga la página.</p></div></div>'); return; }
const { WEAPONS, NADES, MAPS, ROUND } = PC;
const { clamp, lerp, rand, gauss, angDiff } = PC;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const nowS = () => performance.now() / 1000;
const TEAMC = ['#5cc8e0', '#ef6a45'], TEAMN = ['Halcón', 'Cobra'];
const SIDE_N = { atk: 'Ataca', def: 'Defiende' }, SIDE_L = { atk: 'atacantes', def: 'defensores' };
const SHORT = { knife: 'CUCHILLO', p9: 'P-9', r50: 'R-50', smg: 'SMG-9', ar: 'AR-17', sr: 'SR-8', he: 'HE', bomb: 'CARGA' };

/* ---------- Preferencias ---------- */
let prefs = { name: '', sens: 1, map: 'alcazaba', diff: 'veterano' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('pc2_prefs') || '{}')); } catch (e) { }
if (!MAPS[prefs.map]) prefs.map = 'alcazaba';
const savePrefs = () => { try { localStorage.setItem('pc2_prefs', JSON.stringify(prefs)); } catch (e) { } };
if (isTouch) $('#keysHelp').innerHTML = '<span>Joystick a la izquierda para moverte, arrastra a la derecha para apuntar. Mantén Fuego y arrastra para seguir al objetivo.</span>';

/* ================= RENDER ================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.25 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd9cdb5, .0065);
const camera = new THREE.PerspectiveCamera(74, 1, .05, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
const vmScene = new THREE.Scene(); const vmCam = new THREE.PerspectiveCamera(60, 1, .01, 10); vmScene.add(vmCam);
const vmHemi = new THREE.HemisphereLight(0xc8d8f0, 0x5a4632, .8); vmScene.add(vmHemi);
const vmSun = new THREE.DirectionalLight(0xfff0d8, 1.1); vmSun.position.set(-1, 1.4, .6); vmScene.add(vmSun);
const skyU = { top: { value: new THREE.Vector3(.33, .55, .82) }, hor: { value: new THREE.Vector3(.86, .8, .7) }, sunDir: { value: new THREE.Vector3(.4, .8, .3).normalize() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform vec3 top;uniform vec3 hor;uniform vec3 sunDir;varying vec3 vW;void main(){vec3 d=normalize(vW-cameraPosition);float h=d.y;vec3 c=mix(hor,top,smoothstep(0.,.55,h));c=mix(c,hor*.8,smoothstep(0.,-.2,h));float s=max(dot(d,sunDir),0.);c+=vec3(1.,.8,.55)*pow(s,7.)*.35+vec3(1.,.95,.85)*pow(s,500.)*2.2;float cl=sin(d.x*7.+d.z*3.)*sin(d.z*6.-d.x*2.5)+.3*sin(d.x*19.);c=mix(c,c*1.06+.04,smoothstep(.4,1.,cl)*smoothstep(.06,.2,h)*(1.-smoothstep(.3,.6,h)));gl_FragColor=vec4(c,1.);}'
}));
sky.renderOrder = -1; scene.add(sky);
const hemi = new THREE.HemisphereLight(0xbfd8f5, 0x9c8160, .75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.0); sun.castShadow = true;
const SM = isTouch ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(sun); scene.add(sun.target);
const THEMES = {
  desert: { top: [.30, .52, .80], hor: [.88, .82, .72], fog: 0xd8cbb0, fogD: .0058, sun: [.42, .62, .32], sunC: 0xffe8c8, sunI: 1.55, hs: 0xb4cce6, hg: 0x8a704f, hi: .55 },
  port: { top: [.24, .32, .46], hor: [.84, .62, .45], fog: 0xd09a70, fogD: .0095, sun: [-.78, .28, .34], sunC: 0xffc690, sunI: 1.9, hs: 0xb8cce2, hg: 0x7a5c40, hi: .88 }
};

/* ---------- Texturas procedurales ---------- */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function speck(x, w, h, n, a, dark) { for (let i = 0; i < n; i++) { const v = dark || Math.random() < .5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`; const s = Math.random() * 2.5 + .5; x.fillRect(Math.random() * w, Math.random() * h, s, s); } }
function blotch(x, w, h, n, col, rmin, rmax) { for (let i = 0; i < n; i++) { const r = rand(rmin, rmax); const px = rand(0, w), py = rand(0, h); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } }
function tex(c, rep = true) { const t = new THREE.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; }
function texPlaster(base) {
  const [c, x] = cnv(512, 512); x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  blotch(x, 512, 512, 30, 'rgba(255,245,225,.18)', 30, 120); blotch(x, 512, 512, 26, 'rgba(90,60,30,.12)', 20, 90);
  speck(x, 512, 512, 22000, .07);
  // ladrillo expuesto
  for (let k = 0; k < 3; k++) { const px = rand(40, 420), py = rand(40, 420), pw = rand(40, 90), ph = rand(26, 60); x.save(); x.beginPath(); x.ellipse(px, py, pw, ph, rand(-.3, .3), 0, 7); x.clip(); x.fillStyle = '#a77d55'; x.fillRect(px - pw, py - ph, pw * 2, ph * 2); x.strokeStyle = 'rgba(230,210,180,.7)'; x.lineWidth = 2; for (let yy = py - ph; yy < py + ph; yy += 12) { x.beginPath(); x.moveTo(px - pw, yy); x.lineTo(px + pw, yy); x.stroke(); for (let xx = px - pw + ((yy / 12) % 2) * 14; xx < px + pw; xx += 28) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + 12); x.stroke(); } } x.restore(); }
  x.strokeStyle = 'rgba(70,50,30,.35)'; x.lineWidth = 1; for (let i = 0; i < 9; i++) { x.beginPath(); let px = rand(0, 512), py = rand(0, 512); x.moveTo(px, py); for (let k = 0; k < 7; k++) { px += rand(-20, 20); py += rand(4, 24); x.lineTo(px, py); } x.stroke(); }
  return tex(c);
}
function texStone() {
  const [c, x] = cnv(512, 512); x.fillStyle = '#b89c74'; x.fillRect(0, 0, 512, 512);
  const rows = 8, rh = 512 / rows;
  for (let r = 0; r < rows; r++) { let px = -(r % 2) * 50; while (px < 512) { const bw = rand(70, 120); const v = rand(-18, 18); x.fillStyle = `rgb(${184 + v},${158 + v},${118 + v})`; x.fillRect(px + 3, r * rh + 3, bw - 6, rh - 6); px += bw; } }
  speck(x, 512, 512, 20000, .1); blotch(x, 512, 512, 14, 'rgba(80,55,30,.18)', 20, 80);
  x.fillStyle = 'rgba(60,45,30,.0)'; return tex(c);
}
function texWood() { const [c, x] = cnv(256, 256); x.fillStyle = '#8a6a44'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 8; i++) { const v = rand(-14, 14); x.fillStyle = `rgb(${138 + v},${106 + v},${68 + v})`; x.fillRect(0, i * 32 + 1, 256, 30); } for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(50,32,15,${Math.random() * .2})`; x.fillRect(rand(0, 256), rand(0, 256), rand(6, 40), 1); } x.fillStyle = 'rgba(30,20,10,.5)'; for (let i = 0; i < 8; i++) x.fillRect(0, i * 32, 256, 2); return tex(c); }
function texCrate() { const [c, x] = cnv(256, 256); x.drawImage(texWood().image, 0, 0); x.strokeStyle = '#4a3218'; x.lineWidth = 18; x.strokeRect(9, 9, 238, 238); x.lineWidth = 14; x.beginPath(); x.moveTo(16, 16); x.lineTo(240, 240); x.stroke(); x.fillStyle = 'rgba(20,14,8,.6)'; x.font = 'bold 26px monospace'; x.fillText('FRÁGIL', 70, 140); for (const [px, py] of [[9, 9], [247, 9], [9, 247], [247, 247]]) { x.fillStyle = '#3b3b3b'; x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill(); } return tex(c, false); }
function texGround(kind) {
  const [c, x] = cnv(512, 512);
  if (kind === 'sand') { x.fillStyle = '#c9b089'; x.fillRect(0, 0, 512, 512); blotch(x, 512, 512, 40, 'rgba(150,120,80,.22)', 20, 90); blotch(x, 512, 512, 30, 'rgba(240,225,195,.2)', 20, 80); speck(x, 512, 512, 30000, .12); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${rand(90, 140)},${rand(80, 110)},${rand(60, 80)},.5)`; x.beginPath(); x.arc(rand(0, 512), rand(0, 512), rand(1, 3.5), 0, 7); x.fill(); } }
  else { x.fillStyle = '#8e8578'; x.fillRect(0, 0, 512, 512); speck(x, 512, 512, 26000, .08); blotch(x, 512, 512, 22, 'rgba(40,30,20,.16)', 30, 110); x.strokeStyle = 'rgba(30,24,18,.35)'; for (let i = 0; i < 10; i++) { x.beginPath(); let px = rand(0, 512), py = rand(0, 512); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += rand(-24, 24); py += rand(-24, 24); x.lineTo(px, py); } x.stroke(); } x.fillStyle = 'rgba(20,16,12,.28)'; x.fillRect(0, 0, 512, 3); x.fillRect(0, 0, 3, 512); }
  return tex(c);
}
function texCorr(base, rust) {
  const [c, x] = cnv(256, 256); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i++) { const v = Math.sin(i / 256 * Math.PI * 2 * 16) * .5 + .5; x.fillStyle = `rgba(0,0,0,${v * .28})`; x.fillRect(i, 0, 1, 256); x.fillStyle = `rgba(255,255,255,${(1 - v) * .08})`; x.fillRect(i, 0, 1, 256); }
  blotch(x, 256, 256, 12, rust, 10, 50); speck(x, 256, 256, 3000, .1, true);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 256, 3); x.fillRect(0, 128, 256, 2);
  return tex(c);
}
function texRibs() { const [c, x] = cnv(256, 128); for (let i = 0; i < 256; i++) { const v = 150 + Math.sin(i / 256 * Math.PI * 2 * 18) * 70; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, 128); } for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${rand(60, 120)},${rand(30, 50)},20,${Math.random() * .25})`; x.fillRect(rand(0, 256), rand(0, 128), rand(1, 6), rand(1, 10)); } x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 256, 4); x.fillRect(0, 124, 256, 4); x.fillRect(0, 0, 4, 128); x.fillRect(252, 0, 4, 128); return tex(c, false); }
function texShutter() { const [c, x] = cnv(64, 96); x.fillStyle = '#4c6b6a'; x.fillRect(0, 0, 64, 96); for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(4, 4 + i * 7.5, 56, 2); } x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(31, 0, 2, 96); speck(x, 64, 96, 500, .2); x.strokeStyle = '#2b2620'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 92); return tex(c, false); }
function texDoor() { const [c, x] = cnv(64, 128); x.fillStyle = '#6b4a2e'; x.fillRect(0, 0, 64, 128); for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(i * 16, 0, 1.5, 128); } x.fillStyle = '#2a2622'; for (const y of [24, 100]) x.fillRect(6, y, 52, 4); x.fillStyle = '#b48c3c'; x.beginPath(); x.arc(50, 66, 3, 0, 7); x.fill(); x.strokeStyle = '#3a2a1a'; x.lineWidth = 5; x.strokeRect(2, 2, 60, 124); speck(x, 64, 128, 600, .2); return tex(c, false); }
function texRoll() { const [c, x] = cnv(128, 128); x.fillStyle = '#6e7276'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 32; i++) { x.fillStyle = `rgba(0,0,0,${.2 + (i % 2) * .1})`; x.fillRect(0, i * 4, 128, 1.5); } blotch(x, 128, 128, 6, 'rgba(120,60,20,.3)', 8, 30); x.fillStyle = '#d2a23a'; x.fillRect(0, 118, 128, 10); for (let i = 0; i < 8; i++) { x.fillStyle = '#222'; x.beginPath(); x.moveTo(i * 16, 128); x.lineTo(i * 16 + 8, 118); x.lineTo(i * 16 + 14, 118); x.lineTo(i * 16 + 6, 128); x.fill(); } return tex(c, false); }
function texAwning(c1, c2) { const [c, x] = cnv(128, 64); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c1 : c2; x.fillRect(i * 16, 0, 16, 64); } speck(x, 128, 64, 600, .15, true); return tex(c, false); }
function texLetter(l) { const [c, x] = cnv(256, 256); x.clearRect(0, 0, 256, 256); x.font = '800 220px "Saira Condensed",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(200,40,30,.82)'; x.fillText(l, 128, 140); x.globalCompositeOperation = 'destination-out'; speck(x, 256, 256, 2400, .7, true); return tex(c, false); }
function texSpot(color, soft) { const [c, x] = cnv(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, color); g.addColorStop(soft, color.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
function texFlash() { const [c, x] = cnv(128, 128); x.translate(64, 64); for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3 + rand(-.2, .2)); const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -5); x.lineTo(rand(40, 62), 0); x.lineTo(0, 5); x.fill(); } const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill(); return new THREE.CanvasTexture(c); }
function texSmoke() { const [c, x] = cnv(128, 128); for (let i = 0; i < 9; i++) { const px = rand(34, 94), py = rand(34, 94), r = rand(22, 40); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(230,230,228,.55)'); g.addColorStop(1, 'rgba(230,230,228,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); } return new THREE.CanvasTexture(c); }
function texLeaf() { const [c, x] = cnv(64, 256); x.fillStyle = '#3f6b2c'; x.beginPath(); x.moveTo(32, 0); for (let i = 0; i <= 20; i++) { const y = i * 12.8; const w = Math.sin(i / 20 * Math.PI) * 30; x.lineTo(32 + w * (i % 2 ? 1 : .7), y); } for (let i = 20; i >= 0; i--) { const y = i * 12.8; const w = Math.sin(i / 20 * Math.PI) * 30; x.lineTo(32 - w * (i % 2 ? .7 : 1), y); } x.fill(); x.strokeStyle = '#6b8a3a'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 256); x.stroke(); return tex(c, false); }

const TX = {};
function texAll() {
  Object.assign(TX, {
    plaster: texPlaster('#c9b28c'), plaster2: texPlaster('#b8915f'), stone: texStone(), wood: texWood(), crate: texCrate(), sand: texGround('sand'), concrete: texGround('concrete'),
    ware: texCorr('#7d8a92', 'rgba(140,70,30,.35)'), ware2: texCorr('#8c4a36', 'rgba(60,30,15,.35)'), roof: texCorr('#8a7b66', 'rgba(110,60,25,.4)'), ribs: texRibs(),
    shutter: texShutter(), door: texDoor(), roll: texRoll(), awn1: texAwning('#b9442f', '#e7dcc4'), awn2: texAwning('#2f5f80', '#e7dcc4'), awn3: texAwning('#5d7a3a', '#e3c27a'),
    A: texLetter('A'), B: texLetter('B'), hole: texSpot('rgba(18,14,10,0.95)', .35), flash: texFlash(), smoke: texSmoke(), leaf: texLeaf(), glow: texSpot('rgba(255,60,40,1)', .2)
  });
}
texAll();
const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: .9, metalness: 0 }, o));
const CONT_COL = { blue: 0x2f5f80, red: 0x8c3a2b, green: 0x3d6b4c, orange: 0xb5622d, gray: 0x7b8084, teal: 0x2e6f6c, cream: 0xb9ad8f };
const MAT = {};
function buildMats() {
  Object.assign(MAT, {
    bld: std({ map: TX.plaster }), bld2: std({ map: TX.plaster2 }), stone: std({ map: TX.stone }), wood: std({ map: TX.wood }), crate: std({ map: TX.crate }),
    roof: std({ map: TX.roof, roughness: .6, metalness: .4 }), ware: std({ map: TX.ware, roughness: .55, metalness: .5 }), ware2: std({ map: TX.ware2, roughness: .6, metalness: .45 }),
    concrete: std({ map: TX.concrete, color: 0xc8beb0 }), dark: std({ color: 0x2a2c2e, roughness: .6, metalness: .6 }), yellow: std({ color: 0xd29a2a, roughness: .6, metalness: .4 }),
    shutter: std({ map: TX.shutter }), door: std({ map: TX.door }), roll: std({ map: TX.roll, metalness: .4, roughness: .6 }), cornice: std({ color: 0xbfa985 }), cornice2: std({ color: 0x5b5f63, metalness: .5, roughness: .5 })
  });
  for (const k in CONT_COL) MAT['cont:' + k] = std({ map: TX.ribs, color: CONT_COL[k], roughness: .7, metalness: .35 });
}
buildMats();
const geoCache = new Map();
function uvBox(w, h, d, s) {
  const key = [w, h, d, s].map(v => v.toFixed(2)).join('|'); if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  if (s) for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
  geoCache.set(key, g); return g;
}
const TEXSCALE = { bld: 5, bld2: 5, stone: 4, wood: 2.4, roof: 3, ware: 4, ware2: 4, concrete: 6 };

/* ---------- Construcción del mapa ---------- */
let worldGroup = null, WORLD = null, CURMAP = null;
function addMesh(geo, mat, x, y, z, shadow = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = recv; worldGroup.add(m); return m; }
function boxAt(x0, y0, z0, x1, y1, z1, mat, s, shadow = true) { const w = x1 - x0, h = y1 - y0, d = z1 - z0; return addMesh(uvBox(w, h, d, s), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, shadow); }
function buildWorld(mapId) {
  if (CURMAP === mapId && worldGroup) return;
  if (worldGroup) { scene.remove(worldGroup); worldGroup.traverse(o => { if (o.geometry && !geoCache.has(o.geometry)) { } }); }
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  WORLD = new PC.World(mapId); CURMAP = mapId; const M = WORLD.map; const T = THEMES[M.theme]; const desert = M.theme === 'desert';
  // ambiente
  skyU.top.value.set(...T.top); skyU.hor.value.set(...T.hor); skyU.sunDir.value.set(...T.sun).normalize();
  scene.fog.color.setHex(T.fog); scene.fog.density = T.fogD; hemi.color.setHex(T.hs); hemi.groundColor.setHex(T.hg); hemi.intensity = T.hi;
  sun.color.setHex(T.sunC); sun.intensity = T.sunI;
  const cx = (M.bounds[0] + M.bounds[2]) / 2, cz = (M.bounds[1] + M.bounds[3]) / 2, hw = (M.bounds[2] - M.bounds[0]) / 2 + 6, hd = (M.bounds[3] - M.bounds[1]) / 2 + 6;
  sun.position.set(cx + T.sun[0] * 120, T.sun[1] * 120, cz + T.sun[2] * 120); sun.target.position.set(cx, 0, cz);
  const R = Math.hypot(hw, hd); Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 20, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
  vmSun.color.setHex(T.sunC); vmHemi.color.setHex(T.hs); vmHemi.groundColor.setHex(T.hg);
  // suelo
  const gt = desert ? TX.sand : TX.concrete; const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std({ map: gt, color: desert ? 0xffffff : 0xb9ab96, roughness: 1 }));
  ground.material.map = gt.clone(); ground.material.map.needsUpdate = true; ground.material.map.repeat.set(400 / 7, 400 / 7); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; worldGroup.add(ground);
  // cajas del mapa
  for (const b of WORLD.colliders) {
    if (b.mat === 'perim') continue;
    const mat = MAT[b.mat] || MAT.stone; const s = TEXSCALE[b.mat] || 0;
    boxAt(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, mat, s);
    if (b.mat === 'bld' || b.mat === 'bld2' || b.mat === 'ware' || b.mat === 'ware2') decorateBuilding(b, desert);
    if (b.mat.startsWith('cont')) { boxAt(b.minX - .03, b.maxY - .12, b.minZ - .03, b.maxX + .03, b.maxY, b.maxZ + .03, MAT.dark, 0, false); }
  }
  // perímetro
  const [x0, z0, x1, z1] = M.bounds, H = M.wallH, pm = desert ? MAT.bld2 : MAT.concrete;
  for (const [a, b, c, d] of [[x0 - 1, z0 - 1, x1 + 1, z0], [x0 - 1, z1, x1 + 1, z1 + 1], [x0 - 1, z0, x0, z1], [x1, z0, x1 + 1, z1]]) {
    boxAt(a, 0, b, c, H, d, pm, desert ? 5 : 6);
    boxAt(a - .15, H - .2, b - .15, c + .15, H + .1, d + .15, desert ? MAT.cornice : MAT.dark, 0, false);
  }
  // letras de los sitios en el suelo
  for (const k in M.sites) { const s = M.sites[k]; const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshStandardMaterial({ map: TX[k], transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })); p.rotation.x = -Math.PI / 2; p.position.set(s.c[0], .02, s.c[1]); p.receiveShadow = true; worldGroup.add(p); }
  if (desert) desertDecor(M); else portDecor(M);
}
function solidAt(x, z, y) { for (const b of WORLD.colliders) if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y > b.minY && y < b.maxY) return true; return false; }
function decorateBuilding(b, desert) {
  const h = b.maxY - b.minY;
  // zócalo y cornisa
  boxAt(b.minX - .05, 0, b.minZ - .05, b.maxX + .05, .7, b.maxZ + .05, desert ? MAT.stone : MAT.concrete, 3, false);
  boxAt(b.minX - .18, b.maxY - .1, b.minZ - .18, b.maxX + .18, b.maxY + .14, b.maxZ + .18, desert ? MAT.cornice : MAT.cornice2, 0, false);
  if (desert) { for (let x = b.minX + .6; x < b.maxX - .3; x += 1.6) addMesh(uvBox(.12, .5, .12, 0), MAT.cornice, x, b.maxY + .35, b.minZ + .05, false); }
  // fachadas: ventanas, puertas, toldos
  const faces = [[b.minX, b.maxX, b.minZ, 0, -1], [b.minX, b.maxX, b.maxZ, 0, 1], [b.minZ, b.maxZ, b.minX, 1, -1], [b.minZ, b.maxZ, b.maxX, 1, 1]];
  let n = 0;
  for (const [a0, a1, at, axis, sg] of faces) {
    const L = a1 - a0; if (L < 4) continue; const cnt = Math.floor(L / 4.2);
    for (let i = 0; i < cnt; i++) {
      const a = a0 + (i + .5) * (L / cnt); const ox = axis === 0 ? a : at + sg * .6, oz = axis === 0 ? at + sg * .6 : a;
      if (solidAt(ox, oz, 1.5) || Math.abs(ox) > 60 || Math.abs(oz) > 60) continue;
      n++;
      const place = (w, hh, y, mat, depth) => { const px = axis === 0 ? a : at + sg * depth / 2, pz = axis === 0 ? at + sg * depth / 2 : a; const m = addMesh(uvBox(axis === 0 ? w : depth, hh, axis === 0 ? depth : w, 0), mat, px, y, pz, false); return m; };
      if (desert) {
        if (h > 5.2) place(1.0, 1.3, h - 2.2, MAT.shutter, .08);
        if ((i + n) % 3 === 1) { place(1.3, 2.3, 1.15, MAT.door, .07); if ((i + n) % 2) awning(axis, sg, a, at, 2.6); }
        else if (h > 3.5) place(.9, 1.1, 2.1, MAT.shutter, .08);
      } else {
        if ((i + n) % 3 === 0 && L > 8) place(3.2, 3.3, 1.65, MAT.roll, .08);
        else place(1.4, .7, h - 1.4, MAT.dark, .06);
      }
    }
  }
}
function awning(axis, sg, a, at, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshStandardMaterial({ map: [TX.awn1, TX.awn2, TX.awn3][(Math.random() * 3) | 0], side: THREE.DoubleSide, roughness: 1 }));
  m.castShadow = true; m.receiveShadow = true;
  const px = axis === 0 ? a : at + sg * .55, pz = axis === 0 ? at + sg * .55 : a;
  m.position.set(px, y, pz); m.rotation.order = 'YXZ'; m.rotation.y = axis === 0 ? (sg > 0 ? 0 : Math.PI) : (sg > 0 ? Math.PI / 2 : -Math.PI / 2); m.rotation.x = -Math.PI / 2 + .45; worldGroup.add(m);
}
function palm(x, z, h) {
  const g = new THREE.Group(); g.position.set(x, 0, z); worldGroup.add(g);
  const trunkMat = std({ color: 0x7a6248 }); let px = 0, py = 0; const segs = 7;
  for (let i = 0; i < segs; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.16 - i * .01, .2 - i * .01, h / segs, 7), trunkMat); m.position.set(px, py + h / segs / 2, 0); m.castShadow = true; g.add(m); py += h / segs; px += .06 * i; }
  const lm = new THREE.MeshStandardMaterial({ map: TX.leaf, transparent: true, alphaTest: .4, side: THREE.DoubleSide, roughness: .9 });
  for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.9, 3.4), lm); l.geometry.translate(0, -1.7, 0); l.position.set(px, py, 0); l.rotation.order = 'YXZ'; l.rotation.y = i / 8 * Math.PI * 2; l.rotation.x = -1.05 - Math.random() * .3; l.castShadow = true; g.add(l); }
}
function jar(x, z, s) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.22 * s, .16 * s, .7 * s, 10), std({ color: 0xa8643c })); m.position.set(x, .35 * s, z); m.castShadow = true; worldGroup.add(m); }
function desertDecor(M) {
  // horizonte: casas altas y dunas fuera del perímetro
  const [x0, z0, x1, z1] = M.bounds;
  for (let i = 0; i < 60; i++) {
    const side = i % 4; let x, z; const off = rand(3, 14);
    if (side === 0) { x = rand(x0 - 12, x1 + 12); z = z0 - 2 - off; } else if (side === 1) { x = rand(x0 - 12, x1 + 12); z = z1 + 2 + off; } else if (side === 2) { x = x0 - 2 - off; z = rand(z0, z1); } else { x = x1 + 2 + off; z = rand(z0, z1); }
    const w = rand(5, 10), d = rand(5, 10), h = rand(7, 15);
    const m = boxAt(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, Math.random() < .5 ? MAT.bld : MAT.bld2, 5, false);
    boxAt(x - w / 2 - .15, h - .1, z - d / 2 - .15, x + w / 2 + .15, h + .15, z + d / 2 + .15, MAT.cornice, 0, false);
  }
  // torre con cúpula
  const tx = 8, tz = z0 - 22; boxAt(tx - 2.5, 0, tz - 2.5, tx + 2.5, 26, tz + 2.5, MAT.bld, 5, true);
  boxAt(tx - 3, 22, tz - 3, tx + 3, 23, tz + 3, MAT.cornice, 0, false);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0x3f7f7a, roughness: .5, metalness: .3 })); dome.position.set(tx, 26, tz); worldGroup.add(dome);
  const dune = std({ color: 0xcfb48a, roughness: 1 });
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const r = 150 + rand(0, 40); const m = new THREE.Mesh(new THREE.SphereGeometry(rand(30, 55), 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dune); m.scale.y = rand(.25, .45); m.position.set(Math.cos(a) * r, -2, Math.sin(a) * r); worldGroup.add(m); }
  // palmeras y vasijas en lugares abiertos
  const spots = [[0, 30], [-36, -29], [37, 29], [-1, -30.5], [26, 30.5], [-20, 30.5]];
  for (const [x, z] of spots) if (WORLD.walk[WORLD.cIdx(x, z)] && x > x0 && x < x1 && z > z0 && z < z1) palm(x, z, rand(5, 7));
  for (const [x, z] of [[-3.6, 14], [3.6, 20], [-3.6, -10], [21, -6.6], [-17.6, -9.2], [29.5, 23], [-33.5, -7.4], [17.4, -25]]) if (!solidAt(x, z, .3)) jar(x, z, rand(.8, 1.2));
  // cables de lado a lado del mercado
  const wire = new THREE.LineBasicMaterial({ color: 0x222222 });
  for (const z of [-6, 2, 14]) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4, 5.2, z), new THREE.Vector3(0, 4.6, z + .3), new THREE.Vector3(4, 5.2, z)]); worldGroup.add(new THREE.Line(g, wire)); }
}
function portDecor(M) {
  const [x0, z0, x1, z1] = M.bounds; const keys = Object.keys(CONT_COL);
  for (let x = x0 - 6; x <= x1 + 6; x += 6.5) for (let row = 0; row < 3; row++) { const h = 1 + ((Math.random() * 4) | 0); for (let i = 0; i < h; i++) addMesh(uvBox(6.06, 2.58, 2.44, 0), MAT['cont:' + keys[(Math.random() * keys.length) | 0]], x + rand(-.2, .2), 1.3 + i * 2.6, z0 - 3.5 - row * 2.7, row === 0); }
  for (let z = z0; z <= z1; z += 6.5) { const h = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < h; i++) addMesh(uvBox(2.44, 2.58, 6.06, 0), MAT['cont:' + keys[(Math.random() * keys.length) | 0]], x0 - 5, 1.3 + i * 2.6, z, false); }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 200), std({ color: 0x3d5a68, roughness: .18, metalness: .7 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -1.4, z1 + 105); worldGroup.add(water);
  boxAt(x0 - 100, -2, z1 + 3, x1 + 100, -.01, z1 + 5, MAT.concrete, 6, false);
  const crane = (x) => { const z = z1 + 8; for (const [dx, dz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) boxAt(x + dx - .4, 0, z + dz - .4, x + dx + .4, 28, z + dz + .4, MAT.yellow, 0, true); boxAt(x - .8, 27.7, z - 14, x + .8, 29.3, z + 30, MAT.yellow, 0, true); boxAt(x - 6, 25.4, z - .6, x + 6, 26.6, z + .6, MAT.yellow, 0, true); boxAt(x - 1.5, 23.5, z + 12.5, x + 1.5, 25.5, z + 15.5, MAT.dark, 0, true); };
  crane(-18); crane(16);
  boxAt(-70, -1, z1 + 50, 70, 9, z1 + 72, std({ color: 0x2d3236, roughness: .7, metalness: .4 }), 0, false);
  for (let x = -62; x <= 50; x += 6.3) { const h = 1 + ((Math.random() * 4) | 0); for (let i = 0; i < h; i++) addMesh(uvBox(6.06, 2.58, 2.44, 0), MAT['cont:' + keys[(Math.random() * keys.length) | 0]], x, 10.3 + i * 2.6, z1 + 61 + rand(-4, 4), false); }
  for (const [x, z] of [[x0 + 2, z0 + 2], [x1 - 2, z1 - 2], [x0 + 2, z1 - 2], [x1 - 2, z0 + 2]]) { boxAt(x - .11, 0, z - .11, x + .11, 9, z + .11, MAT.dark, 0, true); const l = new THREE.Mesh(uvBox(.5, .1, .3, 0), new THREE.MeshBasicMaterial({ color: 0xffe9b0 })); l.position.set(x, 8.9, z); worldGroup.add(l); }
}

/* ================= EFECTOS ================= */
const fx = { tracers: [], decals: [], di: 0 };
for (let i = 0; i < 48; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: .8, fog: false })); l.visible = false; l.frustumCulled = false; scene.add(l); fx.tracers.push({ l, life: 0 }); }
let tIdx = 0;
function tracer(a, b) { const t = fx.tracers[tIdx++ % fx.tracers.length]; const p = t.l.geometry.attributes.position.array; const k = .15; p[0] = lerp(a.x, b.x, k); p[1] = lerp(a.y, b.y, k); p[2] = lerp(a.z, b.z, k); p[3] = b.x; p[4] = b.y; p[5] = b.z; t.l.geometry.attributes.position.needsUpdate = true; t.l.visible = true; t.life = .05; }
const decalGeo = new THREE.PlaneGeometry(.11, .11); const decalMat = new THREE.MeshBasicMaterial({ map: TX.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(decalGeo, decalMat); m.visible = false; scene.add(m); fx.decals.push(m); }
const _v = new THREE.Vector3();
function decal(p, n) { const m = fx.decals[fx.di++ % fx.decals.length]; m.position.set(p.x + n[0] * .012, p.y + n[1] * .012, p.z + n[2] * .012); _v.set(m.position.x + n[0], m.position.y + n[1], m.position.z + n[2]); m.lookAt(_v); m.rotation.z = Math.random() * 6; m.visible = true; }
const PN = 700; const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN); let pI = 0;
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -999;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, opacity: .9, depthWrite: false })); parts.frustumCulled = false; scene.add(parts);
function burst(p, n, col, speed, count) { for (let i = 0; i < count; i++) { const k = pI++ % PN; pPos[k * 3] = p.x; pPos[k * 3 + 1] = p.y; pPos[k * 3 + 2] = p.z; const s = speed * rand(.3, 1); pVel[k * 3] = (n[0] + gauss() * .8) * s; pVel[k * 3 + 1] = (n[1] + gauss() * .8 + .4) * s; pVel[k * 3 + 2] = (n[2] + gauss() * .8) * s; pLife[k] = rand(.25, .7); const v = rand(.85, 1.1); pCol[k * 3] = col[0] * v; pCol[k * 3 + 1] = col[1] * v; pCol[k * 3 + 2] = col[2] * v; } pGeo.attributes.color.needsUpdate = true; }
const worldFlash = new THREE.PointLight(0xffa858, 0, 10); scene.add(worldFlash);
const boomLight = new THREE.PointLight(0xffb070, 0, 40); scene.add(boomLight);
function updateFx(dt) {
  for (const t of fx.tracers) if (t.life > 0) { t.life -= dt; t.l.material.opacity = Math.max(0, t.life / .05) * .8; if (t.life <= 0) t.l.visible = false; }
  for (let k = 0; k < PN; k++) if (pLife[k] > 0) { pLife[k] -= dt; pVel[k * 3 + 1] -= 9 * dt; pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt; if (pLife[k] <= 0 || pPos[k * 3 + 1] < 0) { pPos[k * 3 + 1] = -999; pLife[k] = 0; } }
  pGeo.attributes.position.needsUpdate = true;
  worldFlash.intensity = Math.max(0, worldFlash.intensity - dt * 50); boomLight.intensity = Math.max(0, boomLight.intensity - dt * 30);
}
const flashMat = new THREE.SpriteMaterial({ map: TX.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });

/* ---------- Humo ---------- */
const smokes = new Map();
function makeSmoke(id, x, y, z, dur) {
  if (smokes.has(id)) return; const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const mat = new THREE.SpriteMaterial({ map: TX.smoke, color: 0xcfcfcb, transparent: true, depthWrite: false, opacity: 0 });
  for (let i = 0; i < 46; i++) { const s = new THREE.Sprite(mat); const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 3; s.position.set(Math.cos(a) * r, rand(.4, 3.6), Math.sin(a) * r); const sc = rand(2.6, 4.2); s.scale.set(sc, sc, 1); s.material.rotation = Math.random() * 6; g.add(s); }
  smokes.set(id, { g, mat, born: nowS(), until: nowS() + dur, x, z });
}
function updateSmokes(list) {
  const seen = new Set(); for (const [id, x, z, left] of list) { seen.add(id); if (!smokes.has(id)) makeSmoke(id, x, 0, z, left); else smokes.get(id).until = nowS() + left; }
  for (const [id, s] of smokes) if (!seen.has(id) && nowS() > s.born + 1) { scene.remove(s.g); smokes.delete(id); }
}
function animSmokes() { const t = nowS(); for (const s of smokes.values()) { const grow = clamp((t - s.born) / 1.2, 0, 1), fade = clamp((s.until - t) / 2.5, 0, 1); s.mat.opacity = Math.min(grow, fade) * .96; s.g.scale.setScalar(.4 + .6 * grow); s.g.rotation.y += .0015; } }

/* ================= SOLDADOS ================= */
const TEAMLOOK = [{ uni: 0x4b5966, vest: 0x2c363f, band: 0x5cc8e0, skin: [0xc9a07e, 0x8d6248, 0xb88a68, 0x6e4a34] }, { uni: 0x8a7550, vest: 0x4d4130, band: 0xef6a45, skin: [0xd2ab8a, 0x9b7052, 0x7f5a40, 0xc49572] }];
const gunM = std({ color: 0x232527, roughness: .45, metalness: .7 }), gunP = std({ color: 0x6d6250, roughness: .8 }), bladeM = std({ color: 0xb8bcc0, roughness: .25, metalness: .9 });
function tpGun(wid) {
  const g = new THREE.Group(); const add = (m, x, y, z, sx, sy, sz) => { const b = new THREE.Mesh(geoBox, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.castShadow = true; g.add(b); };
  if (wid === 'knife') { add(bladeM, 0, 0, -.12, .015, .035, .2); add(gunM, 0, 0, .02, .03, .04, .1); }
  else if (wid === 'p9' || wid === 'r50') { const L = wid === 'r50' ? .26 : .19; add(gunM, 0, .02, -L / 2 + .04, .045, .055, L); add(gunM, 0, -.05, .03, .04, .1, .05); }
  else if (wid === 'smg') { add(gunM, 0, 0, -.1, .06, .09, .42); add(gunM, 0, -.11, -.12, .04, .15, .05); add(gunM, 0, -.02, .14, .04, .06, .16); }
  else if (wid === 'ar') { add(gunM, 0, 0, -.12, .06, .09, .56); add(gunP, 0, 0, -.32, .065, .07, .2); add(gunM, 0, .01, -.5, .025, .025, .2); add(gunP, 0, -.1, -.08, .045, .14, .07); add(gunP, 0, -.02, .26, .05, .1, .2); }
  else if (wid === 'sr') { add(gunP, 0, 0, -.12, .065, .09, .62); add(gunM, 0, .01, -.6, .025, .025, .36); add(gunM, 0, .09, -.1, .05, .05, .26); add(gunP, 0, -.02, .3, .05, .11, .24); }
  else { const col = wid === 'he' ? 0x47603a : wid === 'fl' ? 0x8a8f94 : 0x55585c; const m = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .11, 8), std({ color: col, metalness: .4, roughness: .5 })); m.castShadow = true; g.add(m); }
  return g;
}
const geoBox = new THREE.BoxGeometry(1, 1, 1);
function makeSoldier(team, idx) {
  const L = TEAMLOOK[team]; const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const mU = std({ color: L.uni }), mV = std({ color: L.vest }), mB = new THREE.MeshStandardMaterial({ color: L.band, emissive: L.band, emissiveIntensity: .3, roughness: .6 }), mS = std({ color: L.skin[idx % 4], roughness: .7 }), mBoot = std({ color: 0x1e1c1a });
  const add = (p, m, x, y, z, sx, sy, sz) => { const b = new THREE.Mesh(geoBox, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.castShadow = true; p.add(b); return b; };
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-.12, .92, 0); legR.position.set(.12, .92, 0); body.add(legL, legR);
  for (const Lg of [legL, legR]) { add(Lg, mU, 0, -.42, 0, .19, .86, .23); add(Lg, mBoot, 0, -.86, -.04, .2, .13, .3); add(Lg, mV, 0, -.36, -.12, .16, .14, .04); }
  const upper = new THREE.Group(); upper.position.y = .92; body.add(upper);
  add(upper, mU, 0, .36, 0, .5, .6, .28); add(upper, mV, 0, .4, 0, .55, .44, .34); add(upper, mV, 0, .36, -.19, .36, .2, .06); add(upper, mB, -.3, .5, 0, .15, .08, .16);
  const head = new THREE.Group(); head.position.set(0, .82, 0); upper.add(head);
  add(head, mS, 0, 0, 0, .22, .25, .24);
  if (team === 1) add(head, mV, 0, .02, .01, .235, .2, .25); // pasamontañas
  const helmet = new THREE.Group(); head.add(helmet); add(helmet, mV, 0, .13, 0, .29, .12, .3); add(helmet, mV, 0, .08, .03, .3, .1, .3);
  add(head, std({ color: 0x111111, roughness: .3, metalness: .4 }), 0, .03, -.125, .2, .06, .02);
  const armR = add(upper, mU, .24, .4, -.2, .13, .13, .44); armR.rotation.x = .25;
  const armL = add(upper, mU, -.18, .42, -.33, .12, .12, .44); armL.rotation.y = .5; armL.rotation.x = .15;
  const hand = new THREE.Group(); hand.position.set(.12, .42, -.42); upper.add(hand);
  const guns = {}; for (const w of ['knife', 'p9', 'r50', 'smg', 'ar', 'sr', 'he', 'fl', 'sm']) { guns[w] = tpGun(w); guns[w].visible = false; hand.add(guns[w]); }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .02, -.6); hand.add(muzzle);
  const flash = new THREE.Sprite(flashMat); flash.scale.set(.42, .42, .42); flash.visible = false; muzzle.add(flash);
  const pack = new THREE.Group(); upper.add(pack); pack.position.set(0, .4, .22); add(pack, std({ color: 0x3b3a30 }), 0, 0, 0, .3, .26, .14); add(pack, new THREE.MeshBasicMaterial({ color: 0xff3020 }), .08, .08, .075, .03, .03, .01);
  scene.add(g);
  return { g, body, upper, legL, legR, head, helmet, hand, guns, muzzle, flash, pack, curGun: null };
}
function setModelGun(m, wid) { if (m.curGun === wid) return; if (m.curGun && m.guns[m.curGun]) m.guns[m.curGun].visible = false; m.curGun = wid; if (m.guns[wid]) m.guns[wid].visible = true; const L = { knife: -.25, p9: -.25, r50: -.3, smg: -.36, ar: -.62, sr: -.78 }[wid] || -.3; m.muzzle.position.z = L; }

/* ---------- Carga explosiva, armas en el suelo, granadas ---------- */
const bombMesh = new THREE.Group(); scene.add(bombMesh); bombMesh.visible = false;
(() => { const b = new THREE.Mesh(geoBox, std({ color: 0x3b3a30 })); b.scale.set(.38, .16, .26); b.position.y = .08; b.castShadow = true; bombMesh.add(b); const s = new THREE.Mesh(geoBox, std({ color: 0x151515 })); s.scale.set(.16, .02, .1); s.position.set(-.05, .17, 0); bombMesh.add(s); for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(geoBox, std({ color: [0xb22, 0x2a6, 0x26b][i] })); w.scale.set(.36, .015, .015); w.position.set(0, .165, -.09 + i * .03); bombMesh.add(w); } })();
const bombLed = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); bombLed.scale.set(.4, .4, .4); bombLed.position.set(.1, .2, .08); bombMesh.add(bombLed);
const dropMeshes = new Map();
function updateDrops(list) {
  const seen = new Set();
  for (const [id, w, x, y, z] of list) { seen.add(id); if (!dropMeshes.has(id)) { const m = tpGun(w); m.position.set(x, y + .05, z); m.rotation.set(0, Math.random() * 6, Math.PI / 2); m.scale.setScalar(1.15); scene.add(m); dropMeshes.set(id, m); } }
  for (const [id, m] of dropMeshes) if (!seen.has(id)) { scene.remove(m); dropMeshes.delete(id); }
}
const nadeMeshes = new Map();
function updateNades(list) {
  const seen = new Set();
  for (const [id, k, x, y, z] of list) { seen.add(id); let m = nadeMeshes.get(id); if (!m) { m = tpGun(k); scene.add(m); nadeMeshes.set(id, m); m.position.set(x, y, z); } m.userData.t = [x, y, z]; }
  for (const [id, m] of nadeMeshes) if (!seen.has(id)) { scene.remove(m); nadeMeshes.delete(id); }
}

/* ================= AUDIO ================= */
let AC = null, master = null, noiseBuf = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .55;
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; master.connect(comp); comp.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340; const g = AC.createGain(); g.gain.value = .05; src.connect(f); f.connect(g); g.connect(master); src.start();
  } catch (e) { AC = null; }
}
function panNode(pan) { if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); return p; } return AC.createGain(); }
function posAudio(x, z) { const dx = x - camera.position.x, dz = z - camera.position.z; const d = Math.hypot(dx, dz); const rel = angDiff(camYaw, Math.atan2(-dx, -dz)); return { d, pan: -Math.sin(rel) * .85 }; }
function sShot(s, dist, pan) {
  if (!AC || !s) return; const t = AC.currentTime; const far = clamp(dist / 90, 0, 1); const vol = s.vol * (dist < 1 ? 1 : clamp(1.5 / (1 + dist * .08), .04, 1));
  const src = AC.createBufferSource(); src.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(s.cut * (1 - far * .75), t); f.frequency.exponentialRampToValueAtTime(260, t + s.dec);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + s.dec * (1 + far)); const p = panNode(pan);
  src.connect(f); f.connect(g); g.connect(p); p.connect(master); src.start(t, Math.random() * 1.5, s.dec * 2 + .1);
  const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(s.thump, t); o.frequency.exponentialRampToValueAtTime(35, t + .14); const og = AC.createGain(); og.gain.setValueAtTime(vol * (1 - far) * .9, t); og.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(og); og.connect(p); o.start(t); o.stop(t + .2);
}
function sTone(freq, dur, vol, type = 'sine', slide, delay = 0) { if (!AC) return; const t = AC.currentTime + delay; const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
function sNoise(dur, vol, freq, delay = 0, pan = 0, q = 1.2) { if (!AC) return; const t = AC.currentTime + delay; const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); const p = panNode(pan); s.connect(f); f.connect(g); g.connect(p); p.connect(master); s.start(t, Math.random(), dur + .05); }
function sBoom(dist, big) { if (!AC) return; const t = AC.currentTime; const vol = clamp(2 / (1 + dist * .05), .08, 1.4) * (big ? 1.4 : 1); const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 1600 : 2200, t); f.frequency.exponentialRampToValueAtTime(80, t + (big ? 2 : 1)); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + (big ? 2.4 : 1.2)); s.connect(f); f.connect(g); g.connect(master); s.start(t, 0, 2.5); const o = AC.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(25, t + .6); const og = AC.createGain(); og.gain.setValueAtTime(vol * .9, t); og.gain.exponentialRampToValueAtTime(.001, t + .8); o.connect(og); og.connect(master); o.start(t); o.stop(t + .9); }
const sStep = (v, pan) => sNoise(.06, v, 420 + Math.random() * 260, 0, pan || 0, 1.6);
const sReload = (w) => { sNoise(.06, .35, 2200, 0); sNoise(.05, .3, 1500, w.reload * .45); sNoise(.07, .4, 2600, w.reload * .85); };

/* ================= ESTADO ================= */
const G = { state: 'menu', phase: 'buy', pt: 0, rd: 0, sc: [0, 0], s0: 'def', bomb: ['carried', 0, 0, 0, -1, 0, 0, 0, ''], roster: [], code: '', mapId: 'alcazaba', pub: true };
const actors = []; // estado remoto
const me = {
  id: -1, team: 0, alive: false, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, h: 1.8, crouch: false, grounded: true, hp: 100,
  money: 0, armor: 0, helmet: false, kit: false, inv: { p: null, s: 'p9', n: { he: 0, fl: 0, sm: 0 } }, cb: false, cur: 'p9', lastCur: 'knife', srvCur: null,
  ammo: {}, drawT: 0, reloadT: 0, lastShot: -9, sprayI: 0, punchP: 0, punchY: 0, fireHeld: false, altHeld: false, trigLock: false, nadeArm: false, scoped: false, scopeK: 0, rescopeT: 0,
  crouchHold: false, crouchToggle: false, walkHeld: false, act: false, jumpReq: false, reloadReq: false, stepT: 0, deadT: 0, shots: 0, hits: 0, heads: 0, kills: 0, specIdx: 0
};
let camYaw = 0;
function sideOf(team) { return team === 0 ? G.s0 : (G.s0 === 'atk' ? 'def' : 'atk'); }
function ensureAmmo(wid) { const w = WEAPONS[wid]; if (w && !w.melee && !me.ammo[wid]) me.ammo[wid] = { mag: w.mag, res: w.res }; }
function refillAmmo() { me.ammo = {}; if (me.inv.p) ensureAmmo(me.inv.p); if (me.inv.s) ensureAmmo(me.inv.s); }
function slotList() { const l = []; if (me.inv.p) l.push(me.inv.p); if (me.inv.s) l.push(me.inv.s); l.push('knife'); for (const k of ['he', 'fl', 'sm']) if (me.inv.n[k] > 0) l.push(k); return l; }
function setCur(wid, send = true) {
  if (!wid || me.cur === wid) return; me.lastCur = me.cur; me.cur = wid; me.drawT = WEAPONS[wid] && WEAPONS[wid].melee ? .3 : .5; me.reloadT = 0; me.scoped = false; me.nadeArm = false; me.sprayI = 0;
  ensureAmmo(wid); showVM(wid); if (send) sendMsg({ t: 'eq', w: wid }); drawSlots();
}

/* ================= ARMA EN PRIMERA PERSONA ================= */
const vm = { group: new THREE.Group(), models: {}, cur: null, kick: 0, bobT: 0, swing: 0, throwT: 0 };
vmScene.add(vm.group);
let handMat = std({ color: 0x8a6a50, roughness: .8 }), sleeveMat = std({ color: TEAMLOOK[0].uni });
function buildVM(id) {
  const g = new THREE.Group(); const m1 = std({ color: 0x2b2e31, roughness: .45, metalness: .7 }), m2 = std({ color: 0x6d6250, roughness: .8 }), m3 = std({ color: 0x1a1b1c, roughness: .4, metalness: .8 });
  const add = (mat, x, y, z, sx, sy, sz, rx = 0) => { const m = new THREE.Mesh(geoBox, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; g.add(m); return m; };
  let muzz = -.6, pos = [.16, -.17, -.5];
  if (id === 'ar') { add(m1, 0, 0, 0, .065, .085, .42); add(m2, 0, -.005, -.3, .075, .075, .22); add(m3, 0, .012, -.5, .024, .024, .24); add(m2, 0, -.1, .04, .05, .15, .08, .35); add(m1, 0, -.11, -.12, .045, .16, .08, -.2); add(m2, 0, -.02, .3, .05, .09, .22); add(m3, 0, .058, -.02, .035, .035, .1); muzz = -.63; }
  else if (id === 'smg') { add(m1, 0, 0, -.02, .06, .09, .32); add(m3, 0, .01, -.26, .03, .03, .16); add(m1, 0, -.14, -.08, .045, .2, .055); add(m2, 0, -.1, .08, .05, .13, .07, .35); add(m3, 0, -.01, .22, .03, .05, .18); muzz = -.35; }
  else if (id === 'sr') { add(m2, 0, 0, 0, .07, .09, .5); add(m3, 0, .012, -.48, .026, .026, .4); add(m1, 0, -.12, -.08, .05, .13, .08); add(m2, 0, -.1, .1, .05, .15, .08, .35); add(m2, 0, -.01, .38, .06, .11, .26); const sc = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .24, 12), m3); sc.rotation.x = Math.PI / 2; sc.position.set(0, .085, -.04); g.add(sc); muzz = -.7; }
  else if (id === 'p9' || id === 'r50') { const L = id === 'r50' ? .24 : .18; add(m1, 0, 0, -L / 2 + .05, .042, .055, L); add(m3, 0, -.075, .02, .04, .1, .05, .25); if (id === 'r50') add(m3, 0, .035, -.05, .02, .01, .2); muzz = -L + .04; pos = [.13, -.14, -.36]; }
  else if (id === 'knife') { add(bladeM, 0, .02, -.17, .012, .035, .22); add(m3, 0, 0, .0, .03, .045, .12); pos = [.15, -.16, -.34]; }
  else { const col = id === 'he' ? 0x47603a : id === 'fl' ? 0x8a8f94 : 0x55585c; const n = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .1, 10), std({ color: col, metalness: .4, roughness: .5 })); g.add(n); add(m3, 0, .06, 0, .02, .02, .02); pos = [.14, -.15, -.32]; }
  // manos y mangas
  add(handMat, 0, -.08, .05, .055, .075, .08); add(sleeveMat, .035, -.13, .16, .08, .08, .16);
  if (id !== 'knife' && !NADES[id]) { add(handMat, -.035, -.05, id === 'p9' || id === 'r50' ? .02 : -.26, .05, .055, .1); add(sleeveMat, -.075, -.085, id === 'p9' || id === 'r50' ? .12 : -.15, .075, .075, .2).rotation.y = .4; }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .012, muzz); g.add(muzzle);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flash.scale.set(.2, .2, .2); flash.visible = false; muzzle.add(flash);
  const light = new THREE.PointLight(0xffb060, 0, 4); muzzle.add(light);
  g.visible = false; g.scale.setScalar(.75); vm.group.add(g);
  return { g, pos, muzzle, flash, light };
}
function rebuildVMs() { for (const k in vm.models) vm.group.remove(vm.models[k].g); vm.models = {}; for (const k of ['knife', 'p9', 'r50', 'smg', 'ar', 'sr', 'he', 'fl', 'sm']) vm.models[k] = buildVM(k); showVM(me.cur); }
function showVM(id) { for (const k in vm.models) vm.models[k].g.visible = false; vm.cur = vm.models[id] || null; if (vm.cur) vm.cur.g.visible = true; }
rebuildVMs();

/* ================= RED ================= */
const net = { mode: null, ws: null, room: null, timer: null, lastIn: 0 };
function sendMsg(m) {
  if (net.mode === 'online') { if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify(m)); }
  else if (net.mode === 'offline' && net.room) net.room.message('local', m);
}
function joinOnline(join) {
  setBusy(true); $('#err').textContent = '';
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  let ws; try { ws = new WebSocket(url); } catch (e) { setBusy(false); $('#err').textContent = 'No se pudo abrir la conexión. Prueba el modo sin conexión.'; return; }
  net.ws = ws; net.mode = 'online';
  const to = setTimeout(() => { if (ws.readyState !== 1) { ws.close(); setBusy(false); $('#err').textContent = 'El servidor tarda en responder (puede estar despertando). Espera unos segundos e intenta de nuevo.'; } }, 25000);
  ws.onopen = () => { clearTimeout(to); ws.send(JSON.stringify(join)); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } onMsg(m); };
  ws.onclose = () => { clearTimeout(to); if (net.ws !== ws) return; setBusy(false); if (G.state !== 'menu') { leaveToMenu(); $('#err').textContent = 'Se perdió la conexión con el servidor. Vuelve a entrar con el código de la sala.'; } net.mode = null; };
}
function startOffline() {
  leaveNet(); net.mode = 'offline';
  const room = new PC.Room({ code: 'LOCAL', map: prefs.map, diff: prefs.diff, isPublic: false }); net.room = room;
  room.onBroadcast = m => onMsg(m); room.onSend = (cid, m) => onMsg(m);
  const a = room.addHuman('local', cleanName(prefs.name));
  onMsg({ t: 'joined', code: 'LOCAL', you: a.id, team: a.team, diff: room.diffKey, pub: false, map: room.mapId });
  onMsg(room.privateState(a));
  net.timer = setInterval(() => room.tick(.05), 50);
}
function leaveNet() { if (net.ws) { const w = net.ws; net.ws = null; try { w.close(); } catch (e) { } } if (net.timer) clearInterval(net.timer); net.timer = null; net.room = null; net.mode = null; }
const cleanName = n => (String(n || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14)) || 'Operador';
function setBusy(b) { for (const id of ['#quick', '#create', '#joinBtn']) $(id).disabled = b; }

function onMsg(m) {
  switch (m.t) {
    case 'err': setBusy(false); $('#err').textContent = m.msg; leaveNet(); break;
    case 'joined': {
      setBusy(false); G.code = m.code; G.mapId = m.map; G.pub = m.pub; me.id = m.you; me.team = m.team;
      buildWorld(m.map); sleeveMat.color.setHex(TEAMLOOK[me.team].uni); for (const a of actors) if (a && a.model) scene.remove(a.model.g); actors.length = 0;
      enterGame(); break;
    }
    case 'r': {
      G.roster = m.r; if (m.map && m.map !== CURMAP) buildWorld(m.map);
      for (const [id, name, team, k, d, as, sc, hum, money] of m.r) { const a = getActor(id, team); a.name = name; a.human = hum; a.k = k; a.d = d; a.as = as; a.score = sc; a.money = money; if (id === me.id && team !== me.team) { me.team = team; sleeveMat.color.setHex(TEAMLOOK[team].uni); } }
      $('#roomCode').textContent = G.code; $('#mapName').textContent = '· ' + MAPS[CURMAP].name + ' · ' + m.r.filter(x => x[7]).length + ' en línea';
      break;
    }
    case 'p': {
      const prevInv = JSON.stringify(me.inv);
      me.money = m.m; me.armor = m.ar; me.helmet = !!m.hm; me.kit = !!m.kit; me.inv = m.inv; me.cb = !!m.cb; me.inv = JSON.parse(JSON.stringify(m.inv));
      if (me.inv.p) ensureAmmo(me.inv.p); if (me.inv.s) ensureAmmo(me.inv.s);
      if (m.cur !== me.srvCur) { me.srvCur = m.cur; if (m.cur !== me.cur) setCur(m.cur, false); }
      if (me.cur !== 'knife' && !slotList().includes(me.cur)) setCur(me.inv.p || me.inv.s || 'knife');
      if (prevInv !== JSON.stringify(me.inv)) drawSlots();
      if (!$('#buy').hidden) { const key = me.money + '|' + me.armor + me.helmet + me.kit + JSON.stringify(me.inv); if (key !== drawBuy.key) { drawBuy.key = key; drawBuy(); } }
      break;
    }
    case 's': onSnap(m); break;
  }
}
function getActor(id, team) {
  let a = actors[id];
  if (!a) { a = actors[id] = { id, team, name: '—', human: 0, buf: [], alive: false, hp: 100, cur: 'p9', flags: 0, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, h: 1.8, vx: 0, vz: 0, model: null, stepT: 0, deadT: 9, walkPh: 0, seenT: -9, k: 0, d: 0, as: 0, score: 0 }; }
  if (team !== undefined && a.team !== team) { a.team = team; if (a.model) { scene.remove(a.model.g); a.model = null; } }
  if (!a.model && id !== me.id) a.model = makeSoldier(a.team, id);
  return a;
}
function onSnap(m) {
  const t = nowS();
  const prevPhase = G.phase;
  G.phase = m.ph; G.pt = m.pt; G.ptAt = t; G.rd = m.rd; G.sc = m.sc; G.s0 = m.s0; G.bomb = m.b;
  let slotsDirty = false;
  for (const e of m.ev) { handleEvent(e); if (e.k === 'bpick' || e.k === 'bdrop' || e.k === 'plant' || e.k === 'round') slotsDirty = true; }
  if (slotsDirty) drawSlots();
  for (const r of m.a) {
    const [id, x, y, z, yaw, pitch, h, hp, alive, cur, flags, vx, vz] = r; const a = getActor(id);
    a.hp = hp; a.cur = cur; a.flags = flags; a.vx = vx; a.vz = vz;
    if (id === me.id) {
      me.hp = hp; if (!alive && me.alive) { me.alive = false; me.deadT = 0; }
      if (alive && !me.alive) { me.alive = true; me.pos = { x, y, z }; }
      a.alive = !!alive; a.pos = { x, y, z }; continue;
    }
    if (alive && !a.alive) a.buf = [];
    if (!alive && a.alive) a.deadT = 0;
    a.alive = !!alive;
    a.buf.push({ t, x, y, z, yaw, pitch, h }); if (a.buf.length > 30) a.buf.shift();
  }
  updateSmokes(m.sm); updateDrops(m.dr); updateNades(m.g);
  if (prevPhase !== G.phase && G.phase === 'live' && !$('#buy').hidden) closeBuy();
}

/* ---------- Eventos ---------- */
function nameOf(id) { const a = actors[id]; return a ? a.name : '—'; }
function teamOf(id) { const a = actors[id]; return a ? a.team : 0; }
function handleEvent(e) {
  const t = nowS();
  switch (e.k) {
    case 'sp': if (e.v === me.id) { me.pos = { x: e.p[0], y: e.p[1], z: e.p[2] }; me.vel = { x: 0, y: 0, z: 0 }; me.yaw = e.y; me.pitch = 0; me.alive = true; me.hp = 100; me.deadT = 0; me.h = 1.8; } else { const a = actors[e.v]; if (a) a.buf = []; } break;
    case 'round': refillAmmo(); me.sprayI = 0; announce('Ronda ' + e.n, sideOf(me.team) === 'atk' ? 'Compra tu equipo · después planta la carga en A o B' : 'Compra tu equipo · después defiende los sitios A y B', 3.2); if (e.n === ROUND.half + 1) toast('Cambio de lado: ahora ' + (sideOf(me.team) === 'atk' ? 'atacas' : 'defiendes')); break;
    case 'half': break;
    case 'live': announce('En marcha', sideOf(me.team) === 'atk' ? 'Planta la carga en A o B' : 'Que no planten la carga', 1.6); sTone(660, .12, .12, 'square'); break;
    case 'shot': onShotEvent(e); break;
    case 'slash': { const a = actors[e.s]; if (a && e.s !== me.id) { const p = posAudio(a.pos.x, a.pos.z); if (p.d < 20) sNoise(.12, .3 * (1 - p.d / 20), 3000, 0, p.pan); } break; }
    case 'hit': {
      if (e.a === me.id) { showHit(e.z === 'h', e.x); if (e.z === 'h') { me.heads++; sTone(e.x ? 2600 : 2100, .06, .2, 'square'); } else sTone(1500, .04, .15, 'square'); me.hits++; }
      if (e.v === me.id) { const a = actors[e.a]; if (a) addDmgDir(a.pos); sNoise(.12, .35, 300); me.lastHurt = t; if (e.z === 'h') sTone(3200, .25, .12, 'sine', 2600); }
      const v = actors[e.v]; if (v && e.v !== me.id) burst({ x: v.pos.x, y: v.pos.y + (e.z === 'h' ? v.h - .15 : v.h * .6), z: v.pos.z }, [0, .3, 0], [.5, .06, .04], 2.2, 7);
      break;
    }
    case 'kill': {
      addFeed(e); const v = actors[e.v]; if (v) v.deadT = 0;
      if (e.a === me.id) { me.kills++; sTone(900, .07, .18, 'square'); sTone(1350, .1, .18, 'square', 0, .07); }
      if (e.v === me.id) { me.alive = false; me.deadT = 0; me.killer = e.a; me.specIdx = 0; closeBuy(); }
      break;
    }
    case 'plant': { announce('Carga plantada', 'Sitio ' + e.site + ' · 40 segundos', 2.4, 'var(--bad)'); bombBeepT = 0; sTone(880, .15, .2, 'square'); break; }
    case 'planting': { const a = actors[e.v]; if (a) { const p = posAudio(a.pos.x, a.pos.z); if (p.d < 25) sNoise(.3, .25, 1800, 0, p.pan, 4); } break; }
    case 'defusing': { const a = actors[e.v]; if (a) { const p = posAudio(a.pos.x, a.pos.z); if (p.d < 30) { sNoise(.08, .4, 3000, 0, p.pan, 3); sNoise(.08, .4, 2400, .12, p.pan, 3); } } break; }
    case 'defused': announce('Carga desactivada', nameOf(e.v) + ' cortó el cable a tiempo', 2.5, 'var(--t0)'); sTone(520, .2, .2, 'sine', 780); break;
    case 'boom': { const p = { x: e.p[0], y: e.p[1] + 1, z: e.p[2] }; boomLight.position.set(p.x, p.y + 2, p.z); boomLight.intensity = 30; for (let i = 0; i < 6; i++) burst(p, [0, 1, 0], [1, .6, .25], 14, 40); burst(p, [0, 1, 0], [.3, .28, .25], 8, 60); sBoom(posAudio(p.x, p.z).d, true); shake = 1.2; break; }
    case 'boomhe': { const p = { x: e.p[0], y: e.p[1] + .2, z: e.p[2] }; boomLight.position.set(p.x, p.y + 1, p.z); boomLight.intensity = 12; burst(p, [0, 1, 0], [1, .65, .3], 9, 40); burst(p, [0, 1, 0], [.35, .32, .28], 5, 30); const d = posAudio(p.x, p.z).d; sBoom(d, false); if (d < 12) shake = .6 * (1 - d / 12); break; }
    case 'flash': onFlash(e.p); break;
    case 'smoke': makeSmoke(e.id, e.p[0], e.p[1], e.p[2], e.d); { const p = posAudio(e.p[0], e.p[2]); sNoise(1.8, .25 * clamp(1 - p.d / 40, .05, 1), 900, 0, p.pan, .5); } break;
    case 'throw': { const a = actors[e.s]; if (a && e.s !== me.id && sideOf(a.team) === sideOf(me.team)) { const msg = { he: 'Granada', fl: 'Cegadora', sm: 'Humo' }[e.g]; toast(nameOf(e.s) + ': ¡' + msg + ' va!'); } break; }
    case 'bounce': { const p = posAudio(e.p[0], e.p[2]); if (p.d < 25) sTone(2400 + rand(-300, 300), .04, .12 * (1 - p.d / 25), 'triangle'); break; }
    case 'rend': {
      const mine = e.w === me.team; const why = { elim: 'Eliminaron al equipo rival', time: 'Se acabó el tiempo', bomb: 'La carga explotó', defuse: 'Desactivaron la carga' }[e.why];
      announce('Ganan los ' + SIDE_L[e.side], TEAMN[e.w] + ' · ' + why, 4, TEAMC[e.w]);
      if (mine) { sTone(523, .18, .18, 'triangle'); sTone(659, .18, .18, 'triangle', 0, .16); sTone(784, .3, .18, 'triangle', 0, .32); } else { sTone(392, .22, .16, 'triangle'); sTone(311, .4, .16, 'triangle', 0, .2); }
      break;
    }
    case 'mend': showEnd(e); break;
    case 'mstart': $('#end').hidden = true; me.shots = me.hits = me.heads = me.kills = 0; break;
    case 'join': if (e.id !== me.id) toast(e.n + ' entró a la sala'); break;
    case 'leave': toast(e.n + ' salió; un bot toma su lugar'); break;
    case 'bdrop': if (sideOf(teamOf(e.v)) === sideOf(me.team) && sideOf(me.team) === 'atk') toast('La carga quedó en el suelo'); break;
    case 'bpick': if (e.v === me.id) toast('Tienes la carga. Ve a A o B y mantén E para plantar.'); break;
    case 'pick': if (e.v === me.id) toast('Recogiste ' + WEAPONS[e.w].name); else { const a = actors[e.v]; if (a) { const p = posAudio(a.pos.x, a.pos.z); if (p.d < 15) sNoise(.08, .2, 1500, 0, p.pan); } } break;
  }
}
function onShotEvent(e) {
  if (e.s === me.id) return;
  const a = actors[e.s]; if (!a || !a.model) return; const w = WEAPONS[e.w];
  const mw = new THREE.Vector3(); a.model.muzzle.getWorldPosition(mw);
  const end = new THREE.Vector3(e.e[0], e.e[1], e.e[2]); tracer(mw, end); a.flashT = .05;
  if (e.n) { decal(end, e.n); burst(end, e.n, [.62, .55, .45], 2, 4); }
  const p = posAudio(a.pos.x, a.pos.z); sShot(w && w.snd, p.d, p.pan);
  a.seenT = nowS();
}
function onFlash(p) {
  burst({ x: p[0], y: p[1], z: p[2] }, [0, 1, 0], [1, 1, .9], 4, 20); boomLight.position.set(p[0], p[1], p[2]); boomLight.intensity = 14;
  const o = [camera.position.x, camera.position.y, camera.position.z]; const d = Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
  const pa = posAudio(p[0], p[2]); sNoise(.25, clamp(1.2 - pa.d / 40, .1, 1), 2500, 0, pa.pan, .6);
  if (d > 24 || !WORLD.visible(o, p, smokeList())) return;
  const f = new THREE.Vector3(); camera.getWorldDirection(f); const dot = ((p[0] - o[0]) * f.x + (p[1] - o[1]) * f.y + (p[2] - o[2]) * f.z) / (d || 1);
  const k = (dot > .5 ? 1 : dot > 0 ? .6 : .2) * (1 - d / 24);
  if (k > .08) { flashT = Math.max(flashT, .5 + k * 3.4); if (k > .4) sTone(3400, 2.5 * k, .08, 'sine'); }
}
function smokeList() { const l = []; for (const s of smokes.values()) if (nowS() - s.born > .8) l.push({ x: s.x, y: 1.8, z: s.z, r: 3.3 }); return l; }

/* ================= ENTRADA ================= */
const keys = {}; const look = { dx: 0, dy: 0 };
let locked = false, lockFailed = false, wantUnlock = false, lastMX = null, lastMY = null;
function uiOpen() { return !$('#buy').hidden || !$('#pause').hidden || !$('#end').hidden; }
function requestLock() { if (isTouch || lockFailed || uiOpen()) return; try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { lockFailed = true; }); } catch (e) { lockFailed = true; } }
function releaseLock() { if (locked && document.exitPointerLock) { wantUnlock = true; document.exitPointerLock(); } }
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked && G.state === 'playing') { if (wantUnlock) wantUnlock = false; else if (!uiOpen()) openPause(); } });
document.addEventListener('pointerlockerror', () => { lockFailed = true; });
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'Tab') { e.preventDefault(); showBoard(true); return; }
  keys[e.code] = true; if (G.state !== 'playing' || e.repeat) return;
  if (e.code === 'KeyB') { toggleBuy(); return; }
  if (e.code === 'Escape') { if (!$('#buy').hidden) closeBuy(); else if (lockFailed || isTouch) openPause(); return; }
  if (!$('#buy').hidden) return;
  if (e.code === 'KeyR') me.reloadReq = true;
  if (e.code === 'Space') { e.preventDefault(); me.jumpReq = true; }
  if (e.code === 'KeyC') me.crouchToggle = !me.crouchToggle;
  if (e.code === 'Digit1' && me.inv.p) setCur(me.inv.p);
  if (e.code === 'Digit2' && me.inv.s) setCur(me.inv.s);
  if (e.code === 'Digit3') setCur('knife');
  if (e.code === 'Digit4') cycleNade();
  if (e.code === 'KeyQ') { if (slotList().includes(me.lastCur)) setCur(me.lastCur); }
  if (e.code === 'KeyG') sendMsg({ t: 'drop', bomb: me.cur === 'knife' ? 1 : 0 });
  if (!me.alive && (e.code === 'Space' || e.code === 'KeyD' || e.code === 'KeyA')) me.specIdx++;
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') showBoard(false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; me.fireHeld = me.altHeld = false; });
function cycleNade() { const l = ['he', 'fl', 'sm'].filter(k => me.inv.n[k] > 0); if (!l.length) return; const i = l.indexOf(me.cur); setCur(l[(i + 1) % l.length]); }
addEventListener('wheel', e => { if (G.state !== 'playing' || uiOpen() || !me.alive) return; const l = slotList(); const i = l.indexOf(me.cur); setCur(l[(i + (e.deltaY > 0 ? 1 : -1) + l.length) % l.length]); }, { passive: true });
addEventListener('mousemove', e => {
  if (G.state !== 'playing' || isTouch || uiOpen()) return;
  if (locked) { look.dx += e.movementX * .0021; look.dy += e.movementY * .0021; }
  else if (lockFailed) { if (lastMX !== null) { look.dx += (e.clientX - lastMX) * .0035; look.dy += (e.clientY - lastMY) * .0035; } lastMX = e.clientX; lastMY = e.clientY; }
});
canvas.addEventListener('mousedown', e => {
  if (G.state !== 'playing' || isTouch) return; initAudio();
  if (!locked && !lockFailed) { requestLock(); return; }
  if (!me.alive) { me.specIdx++; return; }
  if (e.button === 0) me.fireHeld = true; if (e.button === 2) { me.altHeld = true; onAlt(); }
});
addEventListener('mouseup', e => { if (isTouch) return; if (e.button === 0) me.fireHeld = false; if (e.button === 2) me.altHeld = false; });
addEventListener('contextmenu', e => e.preventDefault());
function onAlt() { const w = WEAPONS[me.cur]; if (w && w.scope && me.drawT <= 0 && me.reloadT <= 0) { me.scoped = !me.scoped; sNoise(.04, .2, 2000); } }

// táctil
const TL = $('#touch'), joyEl = $('#joy'), knob = joyEl.firstElementChild; const joy = { id: null, ox: 0, oy: 0, vx: 0, vy: 0, mag: 0 };
const lookPtr = new Map(), firePtrs = new Set();
TL.addEventListener('pointerdown', e => {
  if (e.target !== TL) return; e.preventDefault(); initAudio();
  if (!me.alive) { me.specIdx++; return; }
  if (e.clientX < innerWidth * .42 && joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.style.opacity = 1; }
  else lookPtr.set(e.pointerId, [e.clientX, e.clientY]);
  try { TL.setPointerCapture(e.pointerId); } catch (_) { }
}, { passive: false });
TL.addEventListener('pointermove', e => {
  if (e.pointerId === joy.id) { let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const L = Math.hypot(dx, dy), R = 56; if (L > R) { dx = dx / L * R; dy = dy / L * R; } joy.vx = dx / R; joy.vy = dy / R; joy.mag = Math.min(1, L / R); knob.style.transform = `translate(${dx}px,${dy}px)`; }
  else if (lookPtr.has(e.pointerId)) { const p = lookPtr.get(e.pointerId); look.dx += (e.clientX - p[0]) * .005; look.dy += (e.clientY - p[1]) * .005; p[0] = e.clientX; p[1] = e.clientY; }
});
function endPtr(e) { if (e.pointerId === joy.id) { joy.id = null; joy.vx = joy.vy = joy.mag = 0; knob.style.transform = ''; joyEl.style.opacity = 0; } lookPtr.delete(e.pointerId); if (firePtrs.has(e.pointerId)) { firePtrs.delete(e.pointerId); if (!firePtrs.size) { me.fireHeld = false; $('#bFire').classList.remove('on'); $('#bFireL').classList.remove('on'); } } }
TL.addEventListener('pointerup', endPtr); TL.addEventListener('pointercancel', endPtr);
function fireBtn(el) { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); firePtrs.add(e.pointerId); lookPtr.set(e.pointerId, [e.clientX, e.clientY]); me.fireHeld = true; el.classList.add('on'); try { TL.setPointerCapture(e.pointerId); } catch (_) { } }); }
fireBtn($('#bFire')); fireBtn($('#bFireL'));
function tapBtn(el, fn, up) { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); fn(el); }); if (up) { el.addEventListener('pointerup', () => up(el)); el.addEventListener('pointercancel', () => up(el)); el.addEventListener('pointerleave', () => up(el)); } }
tapBtn($('#bAds'), () => onAlt());
tapBtn($('#bReload'), () => { me.reloadReq = true; });
tapBtn($('#bJump'), () => { me.jumpReq = true; });
tapBtn($('#bCrouch'), el => { me.crouchToggle = !me.crouchToggle; el.classList.toggle('on', me.crouchToggle); });
tapBtn($('#bWeap'), () => { const l = slotList(); const i = l.indexOf(me.cur); setCur(l[(i + 1) % l.length]); });
tapBtn($('#bAct'), el => { me.act = true; el.classList.add('on'); }, el => { me.act = false; el.classList.remove('on'); });
tapBtn($('#bBuy'), () => toggleBuy());
$('#bBoard').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); showBoard(true); });
$('#bBoard').addEventListener('pointerup', () => showBoard(false)); $('#bBoard').addEventListener('pointercancel', () => showBoard(false));
tapBtn($('#bPause'), () => openPause());

/* ================= JUGADOR LOCAL ================= */
let shake = 0, flashT = 0, bombBeepT = 0;
function pattern(w, i) {
  if (!w.auto) return { p: w.kick * Math.min(i, 4) * .55, y: 0 };
  const up = w.kick * 9 * (1 - Math.exp(-i / 4.5)); const side = i < 7 ? i * .12 * w.kick : Math.sin((i - 7) * .5) * w.kick * 3.4;
  return { p: up, y: side };
}
function inaccuracy(w) {
  const spd = Math.hypot(me.vel.x, me.vel.z); const max = w.speed || 4.6; const mf = clamp((spd - max * .34) / (max * .5), 0, 1);
  let base = me.crouch ? w.crouch : w.stand; if (w.scope) base = me.scoped && me.scopeK > .9 ? w.scoped : w.stand;
  return base + w.run * mf + (!me.grounded ? w.jump : 0) + (w.auto ? 0 : Math.min(me.sprayI, 5) * w.kick * .08);
}
function canAct() { return me.alive && G.phase !== 'buy' && $('#buy').hidden; }
function updateLocal(dt) {
  if (!me.alive) { me.deadT += dt; return; }
  const frozen = G.phase === 'buy';
  // mirar
  const zoom = me.scoped ? .3 : 1; const s = prefs.sens * zoom;
  me.yaw -= look.dx * s; me.pitch -= look.dy * s; look.dx = look.dy = 0; me.pitch = clamp(me.pitch, -1.5, 1.5);
  // mover
  let fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - joy.vy; let st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.vx;
  const L = Math.hypot(fw, st); if (L > 1) { fw /= L; st /= L; }
  me.crouch = !!(keys.ControlLeft || keys.ControlRight || me.crouchToggle);
  me.walkHeld = !!(keys.ShiftLeft || keys.ShiftRight) || (isTouch && joy.mag > 0 && joy.mag < .55);
  const w = WEAPONS[me.cur] || WEAPONS.knife; let sp = NADES[me.cur] ? 5.0 : w.speed; if (w.scope && me.scoped) sp *= .45;
  if (me.crouch) sp *= .34; else if (me.walkHeld) sp *= .52;
  if (frozen) sp = 0;
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  const tx = (-sy * fw + cy * st) * sp, tz = (-cy * fw - sy * st) * sp;
  const acc = me.grounded ? 15 : 2; me.vel.x = lerp(me.vel.x, tx, 1 - Math.exp(-acc * dt)); me.vel.z = lerp(me.vel.z, tz, 1 - Math.exp(-acc * dt));
  if (me.jumpReq && me.grounded && !frozen) { me.vel.y = 5.2; me.grounded = false; } me.jumpReq = false;
  me.h = lerp(me.h, me.crouch ? 1.22 : 1.8, 1 - Math.exp(-dt * 12));
  WORLD.moveActor(me, dt);
  const spd = Math.hypot(me.vel.x, me.vel.z);
  if (me.grounded && spd > 1 && !me.walkHeld && !me.crouch) { me.stepT -= dt * spd; if (me.stepT <= 0) { me.stepT = 2.3; sStep(.12); } }
  vm.bobT += dt * spd * 1.3;
  // acción (plantar / desactivar)
  me.act = keys.KeyE || $('#bAct').classList.contains('on');
  // armas
  me.drawT = Math.max(0, me.drawT - dt);
  me.scopeK = lerp(me.scopeK, me.scoped ? 1 : 0, 1 - Math.exp(-dt * 16));
  if (me.rescopeT > 0) { me.rescopeT -= dt; if (me.rescopeT <= 0 && me.altScope) { me.scoped = true; me.altScope = false; } }
  const T = nowS();
  if (me.reloadReq && w.mag && me.reloadT <= 0) { const am = me.ammo[me.cur]; if (am && am.mag < w.mag && am.res > 0) { me.reloadT = w.reload; me.scoped = false; sReload(w); } }
  me.reloadReq = false;
  if (me.reloadT > 0) { me.reloadT -= dt; if (me.reloadT <= 0) { const am = me.ammo[me.cur]; if (am) { const take = Math.min(w.mag - am.mag, am.res); am.mag += take; am.res -= take; } } }
  // recuperación del retroceso
  if (T - me.lastShot > (w.rpm ? 60 / w.rpm * 1.4 : .3)) me.sprayI = Math.max(0, me.sprayI - dt * (w.auto ? 13 : 6));
  const pat = WEAPONS[me.cur] && !w.melee ? pattern(w, me.sprayI) : { p: 0, y: 0 };
  me.punchP = lerp(me.punchP, pat.p * .5, 1 - Math.exp(-dt * 20)); me.punchY = lerp(me.punchY, pat.y * .5, 1 - Math.exp(-dt * 20));
  if (!canAct()) { if (!me.fireHeld) me.trigLock = false; return; }
  if (NADES[me.cur]) {
    if ((me.fireHeld || me.altHeld) && me.drawT <= 0) me.nadeArm = me.fireHeld ? 'far' : 'lob';
    else if (me.nadeArm && !me.fireHeld && !me.altHeld) throwNade(me.nadeArm === 'lob');
    return;
  }
  if (w.melee) { if ((me.fireHeld || me.altHeld) && T - me.lastShot >= (me.altHeld ? 1.0 : .42) && me.drawT <= 0) knife(me.altHeld); return; }
  if (me.fireHeld && me.reloadT <= 0 && me.drawT <= 0 && (w.auto || !me.trigLock) && T - me.lastShot >= 60 / w.rpm) {
    const am = me.ammo[me.cur];
    if (am && am.mag > 0) { shoot(w, am); me.trigLock = true; }
    else if (!me.trigLock) { sTone(1800, .03, .15, 'square'); me.trigLock = true; if (am && am.res > 0) me.reloadReq = true; }
  }
  if (!me.fireHeld) me.trigLock = false;
}
function aimDir(extraP, extraY, inacc) {
  const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * inacc;
  const py = me.pitch + extraP + Math.sin(ang) * r, yy = me.yaw + extraY + Math.cos(ang) * r;
  return [-Math.sin(yy) * Math.cos(py), Math.sin(py), -Math.cos(yy) * Math.cos(py)];
}
function traceShot(o, d, maxT) {
  const wt = WORLD.traceWorld(o, d, maxT); let hit = null, t = wt.t, zone = null;
  for (const a of actors) { if (!a || a.id === me.id || !a.alive || a.team === me.team) continue; const r = PC.rayActor(o, d, a, t); if (r && r.t < t) { t = r.t; hit = a; zone = r.zone; } }
  return { wt, hit, t, zone };
}
function shoot(w, am) {
  am.mag--; me.lastShot = nowS(); me.shots++;
  const pat = pattern(w, me.sprayI); me.sprayI++;
  const o = [camera.position.x, camera.position.y, camera.position.z]; const d = aimDir(pat.p, pat.y, inaccuracy(w));
  const r = traceShot(o, d, 200);
  const end = new THREE.Vector3(o[0] + d[0] * r.t, o[1] + d[1] * r.t, o[2] + d[2] * r.t);
  const mw = vmMuzzleWorld(); tracer(mw, end);
  if (r.hit) burst(end, [-d[0], -d[1], -d[2]], [.5, .06, .04], 2.2, 6);
  else if (r.wt.n) { decal(end, r.wt.n); burst(end, r.wt.n, [.62, .55, .45], 2.2, 5); if (Math.random() < .35) burst(end, r.wt.n, [1, .8, .45], 4, 2); }
  sendMsg({ t: 'shot', w: me.cur, o: o.map(v => +v.toFixed(3)), d: d.map(v => +v.toFixed(4)), tt: +r.t.toFixed(2), hit: r.hit ? r.hit.id : null, z: r.zone, n: r.wt.n });
  vm.kick = 1; vm.flashT = .05; worldFlash.position.copy(mw); worldFlash.intensity = 2; sShot(w.snd, 0, 0);
  if (w.scope && me.scoped) { me.scoped = false; me.altScope = true; me.rescopeT = 1.2; }
}
function knife(heavy) {
  me.lastShot = nowS(); vm.swing = 1;
  const o = [camera.position.x, camera.position.y, camera.position.z]; const d = aimDir(0, 0, 0); const r = traceShot(o, d, 2.2);
  sNoise(.12, .3, 3000);
  if (r.hit) { sNoise(.08, .4, 600); sendMsg({ t: 'shot', w: 'knife', o, d, tt: +r.t.toFixed(2), hit: r.hit.id, z: 'c', alt: heavy ? 1 : 0 }); }
  else { if (r.wt.n && r.t < 2.2) { const p = new THREE.Vector3(o[0] + d[0] * r.t, o[1] + d[1] * r.t, o[2] + d[2] * r.t); burst(p, r.wt.n, [.62, .55, .45], 1.5, 4); sNoise(.05, .3, 2500); } sendMsg({ t: 'shot', w: 'knife', o, d, tt: 2.2, hit: null, alt: heavy ? 1 : 0 }); }
}
function throwNade(lob) {
  const k = me.cur; me.nadeArm = false; vm.throwT = 1; const d = aimDir(0, 0, 0);
  sendMsg({ t: 'nade', k, d, lob: lob ? 1 : 0 }); sNoise(.15, .25, 900);
  if (me.inv.n[k] <= 1) setTimeout(() => setCur(me.inv.p || me.inv.s || 'knife'), 250);
}
function vmMuzzleWorld() {
  const f = new THREE.Vector3(); camera.getWorldDirection(f); const right = new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
  return camera.position.clone().addScaledVector(f, .9).addScaledVector(right, .18).add(new THREE.Vector3(0, -.14, 0));
}
let lastIn = 0;
function sendInput() {
  const t = nowS(); if (t - lastIn < .05) return; lastIn = t;
  if (!me.alive) return;
  sendMsg({ t: 'in', p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)], v: [+me.vel.x.toFixed(2), +me.vel.y.toFixed(2), +me.vel.z.toFixed(2)], y: +me.yaw.toFixed(3), pi: +(me.pitch + me.punchP).toFixed(3), h: +me.h.toFixed(2), w: me.walkHeld || me.crouch ? 1 : 0, act: me.act ? 1 : 0 });
}

/* ================= REMOTOS ================= */
const INTERP = .11;
function updateRemotes(dt) {
  const rt = nowS() - INTERP;
  for (const a of actors) {
    if (!a || a.id === me.id || !a.model) continue; const m = a.model;
    if (a.buf.length) {
      let i = a.buf.length - 1; while (i > 0 && a.buf[i - 1].t > rt) i--;
      const b = a.buf[i], p = a.buf[i - 1] || b; let k = 1;
      if (p !== b && b.t > p.t) k = clamp((rt - p.t) / (b.t - p.t), 0, 1);
      if (rt < p.t) k = 0;
      a.pos = { x: lerp(p.x, b.x, k), y: lerp(p.y, b.y, k), z: lerp(p.z, b.z, k) }; a.yaw = p.yaw + angDiff(p.yaw, b.yaw) * k; a.pitch = lerp(p.pitch, b.pitch, k); a.h = lerp(p.h, b.h, k);
    }
    m.g.position.set(a.pos.x, a.pos.y, a.pos.z); m.g.rotation.y = a.yaw;
    const specMe = !me.alive && specTarget() === a;
    if (!a.alive) { a.deadT += dt; const k = Math.min(1, a.deadT / .45); m.body.rotation.x = lerp(0, Math.PI / 2 * .96, k * k); m.body.position.y = -.05 * k; m.g.visible = a.deadT < 6; continue; }
    m.g.visible = !specMe; m.body.rotation.x = 0; m.body.position.y = 0;
    const spd = Math.hypot(a.vx, a.vz); a.walkPh += dt * spd * 2.4; const sw = Math.sin(a.walkPh) * Math.min(1, spd / 3) * .65; const cr = clamp((1.8 - a.h) / .58, 0, 1);
    m.legL.rotation.x = sw * (1 - cr) - cr * 1.1; m.legR.rotation.x = -sw * (1 - cr) + cr * .2; m.legL.position.y = m.legR.position.y = .92 - cr * .42; m.upper.position.y = .92 - cr * .5; m.upper.rotation.x = a.pitch * .7;
    setModelGun(m, a.cur); m.helmet.visible = !!(a.flags & 128); m.pack.visible = !!(a.flags & 4);
    a.flashT = (a.flashT || 0) - dt; m.flash.visible = a.flashT > 0;
    // pasos audibles
    if (spd > 2.8 && !(a.flags & 2) && cr < .3 && Math.abs(a.pos.y - WORLD.groundAt(a.pos.x, a.pos.z, a.pos.y)) < .1) { a.stepT -= dt * spd; if (a.stepT <= 0) { a.stepT = 2.3; const p = posAudio(a.pos.x, a.pos.z); if (p.d < 28) sStep(.22 * (1 - p.d / 28) * (a.team === me.team ? .6 : 1), p.pan); } }
  }
  for (const m of nadeMeshes.values()) { const t = m.userData.t; if (t) { m.position.x = lerp(m.position.x, t[0], .35); m.position.y = lerp(m.position.y, t[1], .35); m.position.z = lerp(m.position.z, t[2], .35); m.rotation.x += dt * 8; } }
  // carga
  const B = G.bomb; bombMesh.visible = B[0] === 'dropped' || B[0] === 'planted';
  if (bombMesh.visible) { bombMesh.position.set(B[1], B[2], B[3]); const left = B[5]; const on = B[0] === 'planted' && ((nowS() * (left < 10 ? 6 : left < 20 ? 3 : 1.5)) % 1) < .3; bombLed.visible = on; }
  if (B[0] === 'planted') { bombBeepT -= dt; if (bombBeepT <= 0) { const left = B[5]; bombBeepT = clamp(left / 40, .08, 1) * 1.05; const p = posAudio(B[1], B[3]); sTone(left < 5 ? 1700 : 1450, .07, clamp(.35 - p.d / 120, .05, .35), 'square'); } }
}
function specTarget() {
  const mates = actors.filter(a => a && a.id !== me.id && a.alive && a.team === me.team);
  const pool = mates.length ? mates : actors.filter(a => a && a.id !== me.id && a.alive);
  if (!pool.length) return null; return pool[((me.specIdx % pool.length) + pool.length) % pool.length];
}

/* ================= HUD ================= */
let annT = 0; function announce(a, b, dur = 2.5, color) { $('#a1').textContent = a; $('#a1').style.color = color || 'var(--sand)'; $('#a2').textContent = b || ''; $('#announce').classList.add('on'); annT = dur; }
let toastT = 0; function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); toastT = 3; }
let hitT = 0; function showHit(head, kill) { $('#hit').className = kill ? 'kill' : head ? 'head' : ''; hitT = kill ? .35 : .15; }
const dmgDirs = []; function addDmgDir(src) { const el = document.createElement('div'); el.className = 'dd'; $('#dmgdirs').appendChild(el); dmgDirs.push({ el, src: { x: src.x, z: src.z }, life: 1.4 }); if (dmgDirs.length > 4) { dmgDirs[0].el.remove(); dmgDirs.shift(); } }
function addFeed(e) {
  const k = actors[e.a], v = actors[e.v]; if (!v) return; const d = document.createElement('div'); d.className = 'kf' + (e.a === me.id || e.v === me.id ? ' me' : '');
  const kn = k ? `<span class="t${k.team}">${esc(k.name)}</span>` : '';
  const ast = (e.ast || []).map(id => actors[id]).filter(Boolean).map(a => `<span class="t${a.team}" style="opacity:.75">+ ${esc(a.name)}</span>`).join('');
  d.innerHTML = `${kn}${ast}<span class="w">${SHORT[e.w] || '—'}</span>${e.h ? '<span class="hs">⌖</span>' : ''}<span class="t${v.team}">${esc(v.name)}</span>`;
  const f = $('#feed'); f.prepend(d); while (f.children.length > 6) f.lastChild.remove(); setTimeout(() => d.remove(), 7000);
}
function drawSlots() {
  const l = slotList(); const lbl = { knife: 'Cuchillo', he: 'Granada HE', fl: 'Cegadora', sm: 'Humo' };
  $('#slots').innerHTML = l.map(w => { const key = w === me.inv.p ? 1 : w === me.inv.s ? 2 : w === 'knife' ? 3 : 4; const n = NADES[w] ? ' ×' + me.inv.n[w] : ''; return `<div class="slot${w === me.cur ? ' cur' : ''}"><span>${esc((WEAPONS[w] && WEAPONS[w].name) || lbl[w])}${n}</span><kbd>${key}</kbd></div>`; }).join('') + ((G.bomb[0] === 'carried' && G.bomb[4] === me.id) ? '<div class="slot"><span id="bombTag">CARGA</span><kbd>E</kbd></div>' : '');
}
const radar = $('#radar'), rctx = radar.getContext('2d');
function drawRadar() {
  const W = radar.width, S = W / 2, sc = W / 70; rctx.clearRect(0, 0, W, W); rctx.save(); rctx.beginPath(); rctx.rect(0, 0, W, W); rctx.clip();
  rctx.fillStyle = 'rgba(14,18,22,.55)'; rctx.fillRect(0, 0, W, W);
  const cx = me.alive ? me.pos.x : camera.position.x, cz = me.alive ? me.pos.z : camera.position.z; const yaw = me.alive ? me.yaw : camYaw;
  rctx.translate(S, S); rctx.rotate(yaw); rctx.scale(sc, sc); rctx.translate(-cx, -cz);
  const M = WORLD.map; rctx.fillStyle = 'rgba(233,220,192,.1)'; rctx.fillRect(M.bounds[0], M.bounds[1], M.bounds[2] - M.bounds[0], M.bounds[3] - M.bounds[1]);
  rctx.fillStyle = 'rgba(10,12,14,.85)'; for (const b of WORLD.mapRects) if (b.maxY > 1.5) rctx.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
  rctx.fillStyle = 'rgba(233,220,192,.28)'; for (const b of WORLD.mapRects) if (b.maxY <= 1.5) rctx.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
  for (const k in M.sites) { const s = M.sites[k]; rctx.fillStyle = 'rgba(255,77,58,.12)'; rctx.fillRect(s.r[0], s.r[1], s.r[2] - s.r[0], s.r[3] - s.r[1]); rctx.save(); rctx.translate(s.c[0], s.c[1]); rctx.rotate(-yaw); rctx.fillStyle = 'rgba(255,110,80,.95)'; rctx.font = '800 7px "Saira Condensed",sans-serif'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle'; rctx.fillText(k, 0, 0); rctx.restore(); }
  const B = G.bomb; const mySide = sideOf(me.team);
  if ((B[0] === 'dropped' && mySide === 'atk') || B[0] === 'planted') { rctx.fillStyle = B[0] === 'planted' ? '#ff4d3a' : '#f2b33d'; rctx.fillRect(B[1] - .9, B[3] - .6, 1.8, 1.2); }
  const t = nowS();
  for (const a of actors) {
    if (!a || a.id === me.id || !a.alive) continue; const mate = a.team === me.team;
    if (!mate && t - a.seenT > 1.6 && !(a.flags & 1)) continue;
    rctx.fillStyle = TEAMC[a.team]; rctx.beginPath(); rctx.arc(a.pos.x, a.pos.z, 1.1, 0, 7); rctx.fill();
    if (mate) { rctx.strokeStyle = TEAMC[a.team]; rctx.lineWidth = .4; rctx.beginPath(); rctx.moveTo(a.pos.x, a.pos.z); rctx.lineTo(a.pos.x - Math.sin(a.yaw) * 2.4, a.pos.z - Math.cos(a.yaw) * 2.4); rctx.stroke(); }
    if (mate && (a.flags & 4)) { rctx.fillStyle = '#f2b33d'; rctx.fillRect(a.pos.x - .5, a.pos.z + 1.3, 1, .7); }
  }
  rctx.restore();
  rctx.save(); rctx.translate(S, S); rctx.fillStyle = '#f2f0e8'; rctx.beginPath(); rctx.moveTo(0, -8); rctx.lineTo(5.5, 6); rctx.lineTo(0, 2.5); rctx.lineTo(-5.5, 6); rctx.closePath(); rctx.fill(); rctx.restore();
}
const _p = new THREE.Vector3(); let tagEls = new Map(); let spotT = 0;
function updateHUD(dt) {
  const t = nowS();
  // barra superior
  const s0 = G.s0, s1 = s0 === 'atk' ? 'def' : 'atk';
  $('#sc0').textContent = G.sc[0]; $('#sc1').textContent = G.sc[1]; $('#role0').textContent = SIDE_N[s0]; $('#role1').textContent = SIDE_N[s1];
  for (const tm of [0, 1]) { const el = $('#pips' + tm); const list = actors.filter(a => a && a.team === tm); const html = list.map(a => `<i class="${a.alive ? '' : 'dead'}${a.id === me.id ? ' me' : ''}"></i>`).join(''); if (el._h !== html) { el.innerHTML = html; el._h = html; } }
  const left = Math.max(0, G.pt - (t - (G.ptAt || t))); const tm = $('#timer');
  if (G.bomb[0] === 'planted') { tm.textContent = 'CARGA'; tm.className = 'bomb'; }
  else { tm.textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'); tm.className = G.phase === 'buy' ? 'buy' : ''; }
  $('#rlabel').textContent = G.phase === 'buy' ? 'Compra · ronda ' + G.rd : G.phase === 'over' ? 'Fin de partida' : 'Ronda ' + G.rd + ' de ' + ROUND.total;
  // vitales
  const hp = Math.max(0, me.hp); const hpN = $('#hpN'); hpN.textContent = me.alive ? hp : 0; hpN.className = hp <= 25 ? 'low' : '';
  $('#arN').textContent = me.armor; $('#arL').textContent = me.helmet ? 'Blind. + casco' : 'Blindaje';
  $('#money').innerHTML = '$' + me.money + '<small>' + (me.cb ? 'compra con B' : 'en mano') + '</small>';
  const w = WEAPONS[me.cur]; const am = me.ammo[me.cur];
  if (w && !w.melee && am) { $('#ammoN').textContent = am.mag; $('#ammoN').className = am.mag <= w.mag * .25 ? 'low' : ''; $('#ammoR').textContent = '/ ' + am.res; }
  else if (NADES[me.cur]) { $('#ammoN').textContent = me.inv.n[me.cur]; $('#ammoN').className = ''; $('#ammoR').textContent = NADES[me.cur].name; }
  else { $('#ammoN').textContent = '—'; $('#ammoN').className = ''; $('#ammoR').textContent = 'Cuchillo'; }
  $('#reloadBar').style.opacity = me.reloadT > 0 ? 1 : 0; if (me.reloadT > 0 && w) $('#rbar').style.width = (1 - me.reloadT / w.reload) * 100 + '%';
  // mira
  const xh = $('#xh'); const scoped = me.scopeK > .5;
  $('#scope').style.opacity = scoped && me.alive ? 1 : 0; vm.group.visible = !scoped;
  const hideXh = !me.alive || scoped || (w && w.scope) || NADES[me.cur]; xh.style.opacity = hideXh ? 0 : 1;
  if (w && !hideXh) { const inacc = inaccuracy(w); const gap = 3 + inacc * (innerHeight / 2) / Math.tan(camera.fov * Math.PI / 360) * .9 + me.sprayI * .6; xh.children[0].style.top = (-gap - 7) + 'px'; xh.children[1].style.top = gap + 'px'; xh.children[2].style.left = (-gap - 7) + 'px'; xh.children[3].style.left = gap + 'px'; }
  if (hitT > 0) { hitT -= dt; $('#hit').style.opacity = clamp(hitT / .1, 0, 1); } else $('#hit').style.opacity = 0;
  $('#vign').style.opacity = me.alive && t - (me.lastHurt || 0) < .5 ? .7 : me.alive && hp < 30 ? .45 : 0;
  flashT = Math.max(0, flashT - dt); $('#flashOv').style.opacity = clamp(flashT / 1.2, 0, 1);
  for (let i = dmgDirs.length - 1; i >= 0; i--) { const d = dmgDirs[i]; d.life -= dt; if (d.life <= 0) { d.el.remove(); dmgDirs.splice(i, 1); continue; } const ang = Math.atan2(-(d.src.x - me.pos.x), -(d.src.z - me.pos.z)); d.el.style.transform = `rotate(${-angDiff(me.yaw, ang)}rad)`; d.el.style.opacity = Math.min(1, d.life); }
  if (annT > 0) { annT -= dt; if (annT <= 0) $('#announce').classList.remove('on'); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on'); }
  // pista de acción
  const B = G.bomb; let hint = '', prog = 0; const mySide = sideOf(me.team); const site = WORLD && me.alive ? siteAt(me.pos.x, me.pos.z) : null;
  const myA = actors[me.id];
  if (me.alive && mySide === 'atk' && B[0] === 'carried' && B[4] === me.id) { if (site && G.phase === 'live') { hint = myA && (myA.flags & 8) ? 'Plantando la carga… no te muevas' : 'Mantén E para plantar en ' + site; prog = B[6]; } }
  if (me.alive && mySide === 'def' && B[0] === 'planted' && Math.hypot(me.pos.x - B[1], me.pos.z - B[3]) < 1.7) { hint = myA && (myA.flags & 8) ? (me.kit ? 'Desactivando con kit…' : 'Desactivando… (10 s sin kit)') : 'Mantén E para desactivar'; prog = B[7]; }
  $('#hint').hidden = !hint; if (hint) { $('#hintT').textContent = hint; $('#hintBar').style.width = clamp(prog, 0, 1) * 100 + '%'; }
  $('#bAct').hidden = !(isTouch && hint); $('#bBuy').hidden = !(isTouch && me.cb);
  $('#bAds').hidden = !(isTouch && w && w.scope);
  // zona
  $('#zoneTag').textContent = site ? 'Sitio ' + site : (me.cb ? 'Zona de compra' : '');
  // espectador
  const sp = $('#spec'); if (!me.alive && me.deadT > 1.2) { const tg = specTarget(); sp.hidden = false; $('#specName').textContent = tg ? tg.name : 'Nadie en pie'; $('#specName').className = tg ? 't' + tg.team : ''; $('#specHint').textContent = isTouch ? 'Toca para cambiar' : 'Clic para cambiar de jugador'; } else sp.hidden = true;
  // enemigos vistos (radar) y nombres
  spotT -= dt; if (spotT <= 0 && me.alive) { spotT = .15; const o = [camera.position.x, camera.position.y, camera.position.z]; const sl = smokeList(); for (const a of actors) { if (!a || !a.alive || a.team === me.team || a.id === me.id) continue; if (WORLD.visible(o, [a.pos.x, a.pos.y + a.h * .7, a.pos.z], sl)) a.seenT = t; } }
  const aim = aimedEnemy();
  for (const a of actors) {
    if (!a || a.id === me.id) continue; let el = tagEls.get(a.id); if (!el) { el = document.createElement('div'); el.className = 'tag'; $('#tags').appendChild(el); tagEls.set(a.id, el); }
    let show = a.alive && (a.team === me.team || a === aim) && !(!me.alive && specTarget() === a);
    if (show) { _p.set(a.pos.x, a.pos.y + a.h + .3, a.pos.z).project(camera); if (_p.z > 1 || _p.z < -1) show = false; else { el.style.transform = `translate(${(_p.x * .5 + .5) * innerWidth}px,${(-_p.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; const txt = a.name + (a.flags & 4 ? ' ◆' : ''); if (el._t !== txt) { el.textContent = txt; el._t = txt; } el.style.color = TEAMC[a.team]; } }
    el.style.display = show ? 'block' : 'none';
  }
  if (!$('#buy').hidden) { $('#buyMoney').textContent = '$' + me.money; $('#buyTime').textContent = G.phase === 'buy' ? 'Tiempo de compra: ' + Math.ceil(left) + ' s' : ''; if (!me.cb) closeBuy(); }
  if (!$('#end').hidden) $('#endCount').textContent = 'Nueva partida en ' + Math.ceil(left) + ' s';
}
function siteAt(x, z) { const S = WORLD.map.sites; for (const k in S) if (PC.inRect(S[k].r, x, z)) return k; return null; }
function aimedEnemy() { if (!me.alive) return null; const o = [camera.position.x, camera.position.y, camera.position.z]; const d = aimDir(me.punchP, 0, 0); const r = traceShot(o, d, 120); return r.hit; }

/* ---------- Compra ---------- */
const BUY = [
  ['Pistolas', ['p9', 'r50']], ['Principales', ['smg', 'ar', 'sr']], ['Equipo', ['kevlar', 'helm', 'kit']], ['Granadas', ['he', 'fl', 'sm']]
];
const GEARN = { kevlar: ['Chaleco', 650], helm: ['Chaleco + casco', 1000], kit: ['Kit de desactivación', 400] };
function priceOf(i) { if (WEAPONS[i]) return WEAPONS[i].price; if (NADES[i]) return NADES[i].price; if (i === 'helm' && me.armor >= 100) return 350; return GEARN[i][1]; }
function owned(i) { if (WEAPONS[i]) return me.inv.p === i || me.inv.s === i; if (NADES[i]) return me.inv.n[i] >= NADES[i].max; if (i === 'kevlar') return me.armor >= 100; if (i === 'helm') return me.helmet && me.armor >= 100; if (i === 'kit') return me.kit; return false; }
function drawBuy() {
  $('#bcols').innerHTML = BUY.map(([title, items]) => `<div class="bcol"><div class="lbl">${title}</div>${items.map(i => {
    if (i === 'kit' && sideOf(me.team) !== 'def') return '';
    const name = WEAPONS[i] ? WEAPONS[i].name : NADES[i] ? NADES[i].name : GEARN[i][0]; const p = priceOf(i); const own = owned(i); const dis = own || p > me.money;
    const sub = WEAPONS[i] ? `${WEAPONS[i].cls} · ${WEAPONS[i].mag}/${WEAPONS[i].res}` : NADES[i] ? (NADES[i].max > 1 ? 'máx. ' + NADES[i].max : 'máx. 1') : '';
    return `<button type="button" class="bi${own ? ' own' : ''}" data-i="${i}" aria-disabled="${dis}"><span class="n">${name}</span><span class="p">$${p}</span><span class="k">${sub}</span></button>`;
  }).join('')}</div>`).join('');
}
$('#bcols').addEventListener('click', e => { const b = e.target.closest('.bi'); if (!b || b.getAttribute('aria-disabled') === 'true') return; sendMsg({ t: 'buy', i: b.dataset.i }); sNoise(.06, .3, 1800); });
function toggleBuy() { if (!$('#buy').hidden) closeBuy(); else if (me.cb && me.alive) { drawBuy(); $('#buy').hidden = false; releaseLock(); me.fireHeld = false; } else toast(G.phase === 'buy' || G.phase === 'live' ? 'Solo puedes comprar en tu zona de inicio al comienzo de la ronda' : 'La compra abre al empezar la ronda'); }
function closeBuy() { if ($('#buy').hidden) return; $('#buy').hidden = true; if (G.state === 'playing' && $('#pause').hidden) requestLock(); }
$('#buy').addEventListener('pointerdown', e => { if (e.target === $('#buy')) closeBuy(); });

/* ---------- Marcador y final ---------- */
function teamTable(tm) {
  const list = actors.filter(a => a && a.team === tm).sort((x, y) => y.score - x.score); const mine = tm === me.team;
  return `<table><caption class="t${tm}">${TEAMN[tm]} · ${G.sc[tm]} <span style="color:var(--dim);font-size:13px">${SIDE_N[sideOf(tm)]}</span></caption><tr><th>Jugador</th>${mine ? '<th>$</th>' : ''}<th>B</th><th>A</th><th>M</th><th>Pts</th></tr>` +
    list.map(a => `<tr class="${a.id === me.id ? 'me' : ''}${a.alive ? '' : ' dead'}"><td>${esc(a.name)}${a.human ? '' : '<span class="hum">BOT</span>'}${a.flags & 4 ? ' <span id="bombTag">CARGA</span>' : ''}</td>${mine ? `<td>${a.money}</td>` : ''}<td>${a.k}</td><td>${a.as}</td><td>${a.d}</td><td>${a.score}</td></tr>`).join('') + '</table>';
}
function showBoard(on) { if (G.state !== 'playing') return; if (on) { $('#boardT').innerHTML = teamTable(me.team) + teamTable(1 - me.team); $('#board').hidden = false; } else $('#board').hidden = true; }
function showEnd(e) {
  const win = e.w; $('#endTitle').textContent = win === -1 ? 'Empate' : win === me.team ? 'Victoria' : 'Derrota'; $('#endTitle').className = win === -1 ? '' : 't' + win;
  $('#endEye').textContent = `HALCÓN ${e.sc[0]} · ${e.sc[1]} COBRA · ${MAPS[CURMAP].name.toUpperCase()}`;
  const acc = me.shots ? Math.round(me.hits / me.shots * 100) : 0; const a = actors[me.id] || { k: 0, d: 0 };
  $('#endStats').innerHTML = [[a.k + ' / ' + a.d, 'Bajas / muertes'], [(a.k / Math.max(1, a.d)).toFixed(2), 'Relación B/M'], [acc + '%', 'Precisión'], [me.heads, 'A la cabeza']].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  $('#endT').innerHTML = teamTable(me.team) + teamTable(1 - me.team); $('#end').hidden = false; closeBuy(); releaseLock();
}

/* ---------- Menú ---------- */
function drawMaps() {
  $('#maps').innerHTML = PC.MAP_IDS.map(id => { const M = MAPS[id]; const c = M.theme === 'desert' ? 'linear-gradient(90deg,#d6c19d,#4c8fc8)' : 'linear-gradient(90deg,#d09a70,#2f5f80)'; return `<button type="button" class="mapc" data-m="${id}" aria-pressed="${id === prefs.map}"><span class="th" style="background:${c}"></span><span class="n">${M.name}</span><span class="d">${M.blurb}</span></button>`; }).join('');
}
drawMaps();
$('#maps').addEventListener('click', e => { const b = e.target.closest('.mapc'); if (!b) return; prefs.map = b.dataset.m; savePrefs(); drawMaps(); buildWorld(prefs.map); });
document.querySelectorAll('#diff button').forEach(b => { b.setAttribute('aria-pressed', b.dataset.d === prefs.diff); b.onclick = () => { prefs.diff = b.dataset.d; savePrefs(); document.querySelectorAll('#diff button').forEach(x => x.setAttribute('aria-pressed', x === b)); }; });
const nameEl = $('#pname'); nameEl.value = prefs.name || ''; nameEl.oninput = () => { prefs.name = nameEl.value; savePrefs(); };
for (const id of ['#sens', '#sens2']) { const el = $(id); el.value = prefs.sens; el.oninput = () => { prefs.sens = +el.value; savePrefs(); $('#sens').value = $('#sens2').value = prefs.sens; }; }
const codeEl = $('#code'); const qs = new URLSearchParams(location.search); if (qs.get('sala')) { codeEl.value = qs.get('sala').toUpperCase().slice(0, 4); }
const baseJoin = () => ({ t: 'join', name: cleanName(prefs.name), map: prefs.map, diff: prefs.diff });
$('#quick').onclick = () => { initAudio(); joinOnline(Object.assign(baseJoin(), { mode: 'quick' })); };
$('#create').onclick = () => { initAudio(); joinOnline(Object.assign(baseJoin(), { mode: 'create' })); };
$('#joinBtn').onclick = () => { initAudio(); const c = codeEl.value.trim().toUpperCase(); if (c.length !== 4) { $('#err').textContent = 'El código tiene 4 letras. Pídelo a quien creó la sala.'; return; } joinOnline(Object.assign(baseJoin(), { mode: 'code', code: c })); };
codeEl.addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });
$('#offline').onclick = () => { initAudio(); startOffline(); };
if (location.protocol === 'file:') { $('#err').textContent = 'Abierto como archivo local: el modo en línea necesita el servidor. Puedes practicar sin conexión.'; }

function enterGame() {
  G.state = 'playing'; $('#menu').hidden = true; $('#end').hidden = true; $('#pause').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !isTouch;
  const link = location.origin + location.pathname + '?sala=' + G.code; $('#inviteUrl').textContent = link; $('#inviteBox').hidden = net.mode !== 'online';
  $('#roomCode').textContent = G.code; me.ammo = {}; me.shots = me.hits = me.heads = me.kills = 0; refillAmmo(); drawSlots();
  if (net.mode === 'online') try { history.replaceState(null, '', '?sala=' + G.code); } catch (e) { }
  requestLock();
}
function leaveToMenu() {
  leaveNet(); G.state = 'menu'; toastT = annT = 0; $('#toast').classList.remove('on'); $('#announce').classList.remove('on'); $('#feed').innerHTML = ''; $('#hud').hidden = true; $('#touch').hidden = true; $('#pause').hidden = true; $('#end').hidden = true; $('#buy').hidden = true; $('#board').hidden = true; $('#menu').hidden = false;
  for (const a of actors) if (a && a.model) scene.remove(a.model.g); actors.length = 0; for (const el of tagEls.values()) el.remove(); tagEls.clear();
  for (const [id, s] of smokes) { scene.remove(s.g); } smokes.clear(); updateDrops([]); updateNades([]); bombMesh.visible = false; me.alive = false; releaseLock();
  try { history.replaceState(null, '', location.pathname); } catch (e) { }
}
function openPause() { if (G.state !== 'playing') return; closeBuy(); $('#pause').hidden = false; me.fireHeld = false; releaseLock(); }
$('#resume').onclick = () => { $('#pause').hidden = true; requestLock(); };
$('#quit').onclick = () => leaveToMenu(); $('#toMenu').onclick = () => leaveToMenu();
$('#copyBtn').onclick = async () => { const txt = $('#inviteUrl').textContent; try { await navigator.clipboard.writeText(txt); $('#copyBtn').textContent = 'Copiado'; setTimeout(() => $('#copyBtn').textContent = 'Copiar link', 1600); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#inviteUrl')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('#copyBtn').textContent = 'Selecciona y copia'; } };

/* ================= CICLO ================= */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); vmCam.aspect = w / h; vmCam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
buildWorld(prefs.map);
let last = performance.now(), menuT = 0;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G.state === 'playing' && WORLD) {
    updateLocal(dt); sendInput(); updateRemotes(dt); updateFx(dt); animSmokes();
    // cámara
    if (me.alive) {
      camera.position.set(me.pos.x, me.pos.y + me.h - .12, me.pos.z);
      const bob = Math.hypot(me.vel.x, me.vel.z) > .5 && me.grounded ? Math.sin(vm.bobT * 2) * .03 : 0; camera.position.y += bob;
      camera.rotation.set(me.pitch + me.punchP, me.yaw + me.punchY, 0); camYaw = me.yaw;
    } else {
      const tg = me.deadT > 1.2 ? specTarget() : null;
      if (tg) { camera.position.set(tg.pos.x, tg.pos.y + tg.h - .12, tg.pos.z); camera.rotation.set(tg.pitch, tg.yaw, 0); camYaw = tg.yaw; }
      else { const k = Math.min(1, me.deadT * 2); camera.position.set(me.pos.x, me.pos.y + lerp(1.6, .4, k), me.pos.z); camera.rotation.set(me.pitch * (1 - k) - .2 * k, me.yaw, .5 * k); camYaw = me.yaw; }
    }
    if (shake > 0) { shake = Math.max(0, shake - dt * 2); camera.rotation.x += gauss() * shake * .03; camera.rotation.y += gauss() * shake * .03; }
    const w = WEAPONS[me.cur]; const fovT = w && w.scope ? lerp(74, 22, me.scopeK) : 74; if (Math.abs(camera.fov - fovT) > .01) { camera.fov = fovT; camera.updateProjectionMatrix(); }
    updateVM(dt); updateHUD(dt); drawRadar();
  } else {
    menuT += dt * .04; const M = MAPS[CURMAP]; const cx = (M.bounds[0] + M.bounds[2]) / 2, cz = (M.bounds[1] + M.bounds[3]) / 2;
    camera.position.set(cx + Math.cos(menuT) * 34, 16, cz + Math.sin(menuT) * 26); camera.lookAt(cx, 1.5, cz); if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    animSmokes();
  }
  sky.position.copy(camera.position);
  renderer.clear(); renderer.render(scene, camera);
  if (G.state === 'playing' && me.alive && vm.group.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
function updateVM(dt) {
  const g = vm.cur; if (!g) return; vm.group.visible = me.alive && me.scopeK < .5;
  vm.kick = lerp(vm.kick, 0, 1 - Math.exp(-dt * 18)); vm.swing = Math.max(0, vm.swing - dt * 3); vm.throwT = Math.max(0, vm.throwT - dt * 2.5);
  const spd = Math.hypot(me.vel.x, me.vel.z); const bx = Math.sin(vm.bobT) * .011 * Math.min(1, spd / 4), by = Math.abs(Math.cos(vm.bobT)) * .009 * Math.min(1, spd / 4);
  const reloadK = me.reloadT > 0 ? Math.sin(Math.min(1, 1 - me.reloadT / (WEAPONS[me.cur].reload || 1)) * Math.PI) : 0;
  const draw = me.drawT > 0 ? me.drawT / .5 : 0;
  const [px, py, pz] = g.pos;
  g.g.position.set(px + bx + vm.swing * -.08, py - by - reloadK * .09 - draw * .25 + (me.nadeArm ? .05 : 0), pz + vm.kick * .035 - vm.throwT * .15);
  g.g.rotation.set(vm.kick * .05 + reloadK * .55 + draw * -.6 + vm.swing * -.6, vm.swing * 1.2, reloadK * -.35 + vm.swing * .3);
  vm.flashT = (vm.flashT || 0) - dt; g.flash.visible = vm.flashT > 0; g.flash.material.rotation = Math.random() * 6; g.light.intensity = vm.flashT > 0 ? 3 : 0;
}
requestAnimationFrame(frame);
})();
