/* Puerto Ceniza — cliente (render, entrada, red, HUD) */
(function () {
'use strict';
const PC = window.PC;
const QC = new Map();
const $ = s => { if (s[0] !== '#' || s.indexOf(' ') >= 0) return document.querySelector(s); let e = QC.get(s); if (!e || !e.isConnected) { e = document.querySelector(s); if (e) QC.set(s, e); } return e; };
// escribe en el DOM solo si el valor cambió (el HUD se actualiza en cada cuadro)
const setTxt = (sel, v) => { const e = $(sel); if (e && e._tx !== v) { e._tx = v; e.textContent = v; } };
const setHtml = (sel, v) => { const e = $(sel); if (e && e._hx !== v) { e._hx = v; e.innerHTML = v; } };
const setCls = (sel, v) => { const e = $(sel); if (e && e.className !== v) e.className = v; };
if (!window.THREE || !PC) { document.body.insertAdjacentHTML('beforeend', '<div class="ov" style="z-index:9"><div class="box"><h2>No cargó el juego</h2><p class="lead">Revisa tu conexión y recarga la página.</p></div></div>'); return; }
const { WEAPONS, NADES, MAPS, ROUND } = PC;
const { clamp, lerp, rand, gauss, angDiff } = PC;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const nowS = () => performance.now() / 1000;
const TEAMC = ['#5cc8e0', '#ef6a45'], TEAMN = ['Halcón', 'Cobra'];
const SIDE_N = { atk: 'Terroristas', def: 'Antiterroristas' }, SIDE_L = { atk: 'terroristas', def: 'antiterroristas' };
const SHORT = { knife: 'CUCHILLO', p9: 'P-9', r50: 'R-50', smg: 'SMG-9', ar: 'AR-17', sr: 'SR-8', ap18: 'AP-18', es12: 'ES-12', fr9: 'FR-9', lmg: 'LMG-60', tr7: 'TR-7', he: 'HE', in: 'FUEGO', bomb: 'CARGA' };
const PIST = new Set(['p9', 'r50', 'ap18']);
const NADE_IDS = ['he', 'fl', 'sm', 'in', 'de'];
const GUN_IDS = Object.keys(WEAPONS).concat(NADE_IDS);

/* ---------- Preferencias ---------- */
let prefs = { name: '', sens: 1, map: 'alcazaba', diff: 'veterano', side: 'auto', gm: 'bomb', gfx: isTouch ? 'low' : 'high' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('pc2_prefs') || '{}')); } catch (e) { }
if (!MAPS[prefs.map]) prefs.map = 'alcazaba'; prefs.vol = Object.assign({ m: 1, fx: 1, amb: 1, ui: 1 }, prefs.vol || {}); if (prefs.gfx !== 'low' && prefs.gfx !== 'high') prefs.gfx = isTouch ? 'low' : 'high';
let prof = { xp: 0, lvl: 1, camo: null, day: '', ch: [] };
try { Object.assign(prof, JSON.parse(localStorage.getItem('pc2_prof') || '{}')); } catch (e) { }
if (prof.camo && !(PC.CAMOS.find(c => c.id === prof.camo && c.lvl <= prof.lvl && !c.top))) prof.camo = null;
if (prof.camos) for (const k of Object.keys(prof.camos)) if (prof.camos[k] !== 'none' && !(PC.CAMOS.find(c => c.id === prof.camos[k] && c.lvl <= prof.lvl && !c.top))) delete prof.camos[k];
// skins del jugador: general + por arma
const mySkin = () => ({ d: prof.camo || null, w: prof.camos || {} });
const saveProf = () => { if (auth.me) return; try { localStorage.setItem('pc2_prof', JSON.stringify(prof)); } catch (e) { } };
// Cuenta: token de sesión en el navegador; el perfil vive en el servidor
const auth = { token: null, me: null };
try { auth.token = localStorage.getItem('pc2_tok'); } catch (e) { }
function guestProfile() { const g = { xp: 0, lvl: 1, camo: null, day: '', ch: [] }; try { Object.assign(g, JSON.parse(localStorage.getItem('pc2_prof') || '{}')); } catch (e) { } return g; }
function applyMe(me) { auth.me = me; if (me) { for (const k of Object.keys(prof)) delete prof[k]; Object.assign(prof, JSON.parse(JSON.stringify(me.profile))); } }
const savePrefs = () => { try { localStorage.setItem('pc2_prefs', JSON.stringify(prefs)); } catch (e) { } };
if (isTouch) $('#keysHelp').innerHTML = '<span>Joystick a la izquierda para moverte, arrastra a la derecha para apuntar. Mantén Fuego y arrastra para seguir al objetivo.</span>';

/* ================= RENDER ================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.25 : 2));
const MAXA = Math.min(16, (renderer.capabilities.getMaxAnisotropy && renderer.capabilities.getMaxAnisotropy()) || 4); if (window.PCM) PCM.setAniso(MAXA);
// Entorno de reflejos para metales (armas y acabados): cielo, horizonte cálido y suelo oscuro
try { const [ec, ex] = [document.createElement('canvas'), null]; ec.width = 256; ec.height = 128; const x2 = ec.getContext('2d'); const gg = x2.createLinearGradient(0, 0, 0, 128); gg.addColorStop(0, '#9fb8d8'); gg.addColorStop(.46, '#f1e2c8'); gg.addColorStop(.52, '#6d6458'); gg.addColorStop(1, '#1e1d1b'); x2.fillStyle = gg; x2.fillRect(0, 0, 256, 128); x2.fillStyle = 'rgba(255,255,255,.9)'; x2.fillRect(60, 18, 40, 10); x2.fillRect(170, 26, 28, 8);
  const et = new THREE.CanvasTexture(ec); et.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(et).texture; pm.dispose(); et.dispose(); if (window.PCM && PCM.setEnv) PCM.setEnv(env); } catch (e) { }
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
const SM = prefs.gfx === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(sun); scene.add(sun.target);
const THEMES = {
  desert: { top: [.30, .52, .80], hor: [.88, .82, .72], fog: 0xd8cbb0, fogD: .0058, sun: [.42, .62, .32], sunC: 0xffe8c8, sunI: 1.55, hs: 0xb4cce6, hg: 0x8a704f, hi: .55 },
  rural: { top: [.12, .36, .84], hor: [.68, .8, .95], fog: 0xb6c8de, fogD: .0042, sun: [.32, .86, .38], sunC: 0xfff4e2, sunI: 1.4, hs: 0xbad4f4, hg: 0x6c7448, hi: .55, sat: 1.12 },
  city: { top: [.30, .40, .56], hor: [.70, .74, .80], fog: 0x8d97a6, fogD: .0075, sun: [.55, .55, -.45], sunC: 0xffe6c4, sunI: 1.3, hs: 0xa8bcd8, hg: 0x4a4e56, hi: .7, sat: 1.0 },
  snow: { top: [.34, .52, .78], hor: [.86, .9, .95], fog: 0xd8e2ec, fogD: .0065, sun: [-.5, .42, .5], sunC: 0xfff0dc, sunI: 1.25, hs: 0xd4e4f8, hg: 0x8a96a8, hi: .78, sat: .96 },
  port: { top: [.24, .32, .46], hor: [.84, .62, .45], fog: 0xd09a70, fogD: .0095, sun: [-.78, .28, .34], sunC: 0xffc690, sunI: 1.9, hs: 0xb8cce2, hg: 0x7a5c40, hi: .88 }
};

/* ---------- Texturas procedurales ---------- */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function speck(x, w, h, n, a, dark) { for (let i = 0; i < n; i++) { const v = dark || Math.random() < .5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`; const s = Math.random() * 2.5 + .5; x.fillRect(Math.random() * w, Math.random() * h, s, s); } }
function blotch(x, w, h, n, col, rmin, rmax) { for (let i = 0; i < n; i++) { const r = rand(rmin, rmax); const px = rand(0, w), py = rand(0, h); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } }
function tex(c, rep = true) { const t = new THREE.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = MAXA; return t; }
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
  else if (kind === 'gravel') { x.fillStyle = '#a69a86'; x.fillRect(0, 0, 512, 512); blotch(x, 512, 512, 30, 'rgba(120,100,75,.25)', 20, 90); for (let i = 0; i < 5200; i++) { const v = rand(90, 200); x.fillStyle = `rgba(${v},${v * .95},${v * .86},${rand(.4, .9)})`; x.beginPath(); x.ellipse(rand(0, 512), rand(0, 512), rand(1, 3.4), rand(.8, 2.4), rand(0, 3), 0, 7); x.fill(); } speck(x, 512, 512, 12000, .12); }
  else if (kind === 'grass') { x.fillStyle = '#5f7f34'; x.fillRect(0, 0, 512, 512); blotch(x, 512, 512, 40, 'rgba(140,150,60,.3)', 20, 90); blotch(x, 512, 512, 30, 'rgba(40,70,25,.3)', 20, 80); for (let i = 0; i < 9000; i++) { x.strokeStyle = `rgba(${rand(60, 140)},${rand(110, 170)},${rand(40, 70)},.55)`; x.lineWidth = 1; const px = rand(0, 512), py = rand(0, 512); x.beginPath(); x.moveTo(px, py); x.lineTo(px + rand(-3, 3), py - rand(3, 9)); x.stroke(); } }
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
function texHedge() { const [c, x] = cnv(256, 256); x.fillStyle = '#3d5a25'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { const g = rand(70, 140); x.fillStyle = `rgba(${g * .45},${g},${g * .32},${rand(.4, .9)})`; x.beginPath(); x.ellipse(rand(0, 256), rand(0, 256), rand(2, 6), rand(1.5, 4), rand(0, 3), 0, 7); x.fill(); } blotch(x, 256, 256, 14, 'rgba(10,25,5,.35)', 10, 40); return tex(c); }
function texAO() { const [c, x] = cnv(64, 64); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.45, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
function texBlinds() { const [c, x] = cnv(64, 64); x.fillStyle = '#e8e6df'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 16; i++) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, i * 4, 64, 1.4); } x.strokeStyle = '#f5f5f2'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(31, 0, 2, 64); return new THREE.CanvasTexture(c); }
function texBark() { const [c, x] = cnv(64, 128); x.fillStyle = '#5b4632'; x.fillRect(0, 0, 64, 128); for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(30,20,12,${rand(.3, .6)})`; x.beginPath(); const px = rand(0, 64); x.moveTo(px, 0); x.lineTo(px + rand(-6, 6), 128); x.stroke(); } return tex(c); }
function texTuft() { const [c, x] = cnv(64, 64); x.clearRect(0, 0, 64, 64); for (let i = 0; i < 22; i++) { x.strokeStyle = `rgba(${rand(70, 130)},${rand(120, 170)},${rand(40, 60)},1)`; x.lineWidth = rand(1.5, 3); const px = rand(14, 50); x.beginPath(); x.moveTo(px, 64); x.quadraticCurveTo(px + rand(-6, 6), 40, px + rand(-14, 14), rand(6, 30)); x.stroke(); } return new THREE.CanvasTexture(c); }
function texSpot(color, soft) { const [c, x] = cnv(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, color); g.addColorStop(soft, color.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
function texFlash() { const [c, x] = cnv(128, 128); x.translate(64, 64); for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3 + rand(-.2, .2)); const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -5); x.lineTo(rand(40, 62), 0); x.lineTo(0, 5); x.fill(); } const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill(); return new THREE.CanvasTexture(c); }
function texSmoke() { const [c, x] = cnv(128, 128); for (let i = 0; i < 9; i++) { const px = rand(34, 94), py = rand(34, 94), r = rand(22, 40); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(230,230,228,.55)'); g.addColorStop(1, 'rgba(230,230,228,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); } return new THREE.CanvasTexture(c); }
function texLeaf() { const [c, x] = cnv(64, 256); x.fillStyle = '#3f6b2c'; x.beginPath(); x.moveTo(32, 0); for (let i = 0; i <= 20; i++) { const y = i * 12.8; const w = Math.sin(i / 20 * Math.PI) * 30; x.lineTo(32 + w * (i % 2 ? 1 : .7), y); } for (let i = 20; i >= 0; i--) { const y = i * 12.8; const w = Math.sin(i / 20 * Math.PI) * 30; x.lineTo(32 - w * (i % 2 ? .7 : 1), y); } x.fill(); x.strokeStyle = '#6b8a3a'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 256); x.stroke(); return tex(c, false); }

function texAsphalt() {
  const [c, x] = cnv(512, 512); x.fillStyle = '#3a3e44'; x.fillRect(0, 0, 512, 512); speck(x, 512, 512, 36000, .14);
  blotch(x, 512, 512, 24, 'rgba(15,18,24,.35)', 20, 110); blotch(x, 512, 512, 12, 'rgba(120,130,145,.12)', 30, 90);
  x.strokeStyle = 'rgba(12,12,14,.55)'; x.lineWidth = 1.2; for (let i = 0; i < 6; i++) { x.beginPath(); let px = rand(0, 512), py = rand(0, 512); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += rand(-26, 26); py += rand(-26, 26); x.lineTo(px, py); } x.stroke(); }
  return tex(c);
}
function texSnow() {
  const [c, x] = cnv(512, 512); x.fillStyle = '#e9eef4'; x.fillRect(0, 0, 512, 512); blotch(x, 512, 512, 40, 'rgba(170,188,212,.22)', 30, 120); blotch(x, 512, 512, 26, 'rgba(255,255,255,.5)', 20, 80);
  speck(x, 512, 512, 14000, .06, true); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(120,135,160,${rand(.05, .16)})`; x.beginPath(); x.ellipse(rand(0, 512), rand(0, 512), rand(2, 6), rand(1, 3), rand(0, 3), 0, 7); x.fill(); }
  return tex(c);
}
function texFacade(base, win, lit) {
  const [c, x] = cnv(256, 256); x.fillStyle = base; x.fillRect(0, 0, 256, 256); speck(x, 256, 256, 5000, .08); blotch(x, 256, 256, 8, 'rgba(0,0,0,.14)', 20, 70);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const on = Math.random() < lit; x.fillStyle = on ? (Math.random() < .5 ? '#f2c27a' : '#cfe3f2') : win; x.fillRect(k * 64 + 12, r * 64 + 14, 40, 38); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(k * 64 + 12, r * 64 + 50, 40, 4); x.fillRect(k * 64 + 31, r * 64 + 14, 2, 38); }
  return tex(c);
}
function texBrick() {
  const [c, x] = cnv(256, 256); x.fillStyle = '#5a4038'; x.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) { let px = -(r % 2) * 16; while (px < 256) { const v = rand(-16, 16); x.fillStyle = `rgb(${128 + v},${62 + v * .6},${48 + v * .5})`; x.fillRect(px + 1.5, r * 16 + 1.5, 29, 13); px += 32; } }
  speck(x, 256, 256, 6000, .1); blotch(x, 256, 256, 10, 'rgba(255,255,255,.12)', 10, 50); return tex(c);
}
function texWagon(col) {
  const [c, x] = cnv(512, 128); x.fillStyle = col; x.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 512; i += 8) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(i, 0, 2, 128); }
  x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 512, 6); x.fillRect(0, 118, 512, 10); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 4; x.strokeRect(200, 18, 112, 96);
  blotch(x, 512, 128, 10, 'rgba(110,60,25,.35)', 8, 40); x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '700 22px sans-serif'; x.fillText('PC ' + ((Math.random() * 9000 + 1000) | 0), 26, 52); return tex(c, false);
}
const TX = {};
function texAll() {
  Object.assign(TX, {
    plaster: texPlaster('#c9b28c'), plaster2: texPlaster('#b8915f'), stone: texStone(), wood: texWood(), crate: texCrate(), sand: texGround('sand'), concrete: texGround('concrete'),
    ware: texCorr('#7d8a92', 'rgba(140,70,30,.35)'), ware2: texCorr('#8c4a36', 'rgba(60,30,15,.35)'), roof: texCorr('#8a7b66', 'rgba(110,60,25,.4)'), ribs: texRibs(),
    shutter: texShutter(), door: texDoor(), roll: texRoll(), awn1: texAwning('#b9442f', '#e7dcc4'), awn2: texAwning('#2f5f80', '#e7dcc4'), awn3: texAwning('#5d7a3a', '#e3c27a'),
    gravel: texGround('gravel'), grass: texGround('grass'), hedge: texHedge(), ao: texAO(), blinds: texBlinds(), bark: texBark(), tuft: texTuft(), corrDark: texCorr('#25324a', 'rgba(20,30,60,.3)'), roofDark: texCorr('#3b3f42', 'rgba(90,50,25,.35)'), shadowBlob: texSpot('rgba(0,0,0,0.6)', .5),
    asphalt: texAsphalt(), snow: texSnow(), city: texFacade('#8f8a84', '#2a3440', .28), city2: texFacade('#6f7a82', '#1f2a35', .22), brick: texBrick(),
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
  Object.assign(MAT, {
    slab: std({ map: TX.concrete, color: 0xd8d2c6 }), wareDark: std({ map: TX.corrDark, roughness: .55, metalness: .5 }), metal: std({ color: 0x6b3a22, roughness: .55, metalness: .6 }),
    tank: std({ color: 0x1d2024, roughness: .5, metalness: .1 }), tarp: std({ color: 0x2a62b8, roughness: .7 }), vine: std({ map: TX.hedge }), hedge: std({ map: TX.hedge, color: 0xcfe0c0 }),
    trunk: std({ map: TX.bark }), pole: std({ color: 0x6f5a44, roughness: 1 }), roofDark: std({ map: TX.roofDark, roughness: .5, metalness: .55, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa9c8e0, roughness: .05, metalness: .9, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }),
    blinds: std({ map: TX.blinds, roughness: .6 }), whiteFrame: std({ color: 0xeeeeea, roughness: .5 })
  });
  Object.assign(MAT, {
    city: std({ map: TX.city, roughness: .75 }), city2: std({ map: TX.city2, roughness: .7 }), slabC: std({ map: TX.concrete, color: 0xa9aaad }), concrete2: std({ map: TX.concrete, color: 0x9ea2a8 }),
    stoneC: std({ map: TX.stone, color: 0xd8dce2 }), planter: std({ map: TX.hedge, color: 0xb8d0a8 }), kiosk: std({ color: 0x2e6f6c, roughness: .5, metalness: .4 }), barrier: std({ color: 0xc9c5bd, roughness: .8 }),
    glassC: new THREE.MeshStandardMaterial({ color: 0x7fb6d8, roughness: .08, metalness: .85, transparent: true, opacity: .42, depthWrite: false }), dumpster: std({ color: 0x2f5a3c, roughness: .55, metalness: .5 }),
    stationH: std({ map: TX.brick }), roofP: std({ map: TX.roofDark, roughness: .5, metalness: .55 }), metalP: std({ color: 0x3b4450, roughness: .45, metalness: .7 }), bench: std({ map: TX.wood }),
    snowpile: std({ map: TX.snow, roughness: .95 }), snowCap: std({ map: TX.snow, roughness: .95 })
  });
  for (const [k, col] of [['red', '#8c2f24'], ['blue', '#2b4f7a'], ['green', '#3d6448'], ['gray', '#6c7076']]) MAT['wagon:' + k] = std({ map: texWagon(col), roughness: .6, metalness: .35 });
  MAT['cont:blue'] = std({ map: TX.ribs, color: 0x1f4f9c, roughness: .6, metalness: .4 });
  for (const k in CONT_COL) if (!MAT['cont:' + k]) MAT['cont:' + k] = std({ map: TX.ribs, color: CONT_COL[k], roughness: .7, metalness: .35 });
}
buildMats();
const geoCache = new Map();
function uvBox(w, h, d, s) {
  const key = [w, h, d, s].map(v => v.toFixed(2)).join('|'); if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  if (s) for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
  geoCache.set(key, g); return g;
}
const TEXSCALE = { city: 8, city2: 8, stationH: 3, slabC: 6, concrete2: 4, stoneC: 3, planter: 2, snowpile: 3, bench: 2, bld: 5, bld2: 5, stone: 4, wood: 2.4, roof: 3, ware: 4, ware2: 4, concrete: 6, slab: 6, wareDark: 4, vine: 2, hedge: 3 };

/* ---------- Construcción del mapa ---------- */
let worldGroup = null, WORLD = null, CURMAP = null;
function addMesh(geo, mat, x, y, z, shadow = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = recv; worldGroup.add(m); return m; }
function boxAt(x0, y0, z0, x1, y1, z1, mat, s, shadow = true) { const w = x1 - x0, h = y1 - y0, d = z1 - z0; return addMesh(uvBox(w, h, d, s), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, shadow); }
function buildWorld(mapId) {
  if (CURMAP === mapId && worldGroup) return;
  if (worldGroup) {
    scene.remove(worldGroup);
    const keepM = new Set([...Object.values(MAT), ...leafMats, ...Object.values(SHM)]), keepT = new Set(Object.values(TX)), keepG = new Set(geoCache.values());
    worldGroup.traverse(o => {
      if (o.geometry && !o.isSprite && !keepG.has(o.geometry) && o.geometry !== geoBox) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) { if (keepM.has(m)) continue; if (m.map && !keepT.has(m.map)) m.map.dispose(); m.dispose(); }
    });
  }
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  WORLD = new PC.World(mapId); CURMAP = mapId; const M = WORLD.map; const T = THEMES[M.theme]; const desert = M.theme === 'desert', rural = M.theme === 'rural', city = M.theme === 'city', snow = M.theme === 'snow';
  post.sat = T.sat || (desert ? 1.06 : 1.04);
  // ambiente
  skyU.top.value.set(...T.top); skyU.hor.value.set(...T.hor); skyU.sunDir.value.set(...T.sun).normalize();
  scene.fog.color.setHex(T.fog); scene.fog.density = T.fogD; hemi.color.setHex(T.hs); hemi.groundColor.setHex(T.hg); hemi.intensity = T.hi;
  sun.color.setHex(T.sunC); sun.intensity = T.sunI;
  const cx = (M.bounds[0] + M.bounds[2]) / 2, cz = (M.bounds[1] + M.bounds[3]) / 2, hw = (M.bounds[2] - M.bounds[0]) / 2 + 6, hd = (M.bounds[3] - M.bounds[1]) / 2 + 6;
  sun.position.set(cx + T.sun[0] * 120, T.sun[1] * 120, cz + T.sun[2] * 120); sun.target.position.set(cx, 0, cz);
  const R = Math.hypot(hw, hd); Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 20, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
  vmSun.color.setHex(T.sunC); vmHemi.color.setHex(T.hs); vmHemi.groundColor.setHex(T.hg);
  // suelo
  const gt = desert ? TX.sand : rural ? TX.gravel : city ? TX.asphalt : snow ? TX.snow : TX.concrete; const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std({ map: gt, color: desert || city || snow ? 0xffffff : rural ? 0x8f8676 : 0xb9ab96, roughness: city ? .55 : 1, metalness: city ? .15 : 0 }));
  ground.material.map = gt.clone(); ground.material.map.needsUpdate = true; ground.material.map.repeat.set(400 / 7, 400 / 7); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; worldGroup.add(ground);
  // cajas del mapa
  for (const b of WORLD.colliders) {
    if (b.mat === 'perim') continue;
    if (specialBox(b)) continue;
    const mat = MAT[b.mat] || MAT.stone; const s = TEXSCALE[b.mat] || 0;
    boxAt(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, mat, s);
    if (b.maxY - b.minY > .8 && b.minY < .5) aoStrips(b);
    if (b.mat === 'bld' || b.mat === 'bld2' || b.mat === 'ware' || b.mat === 'ware2') decorateBuilding(b, desert);
    if (b.mat === 'city' || b.mat === 'city2' || b.mat === 'stationH') { boxAt(b.minX - .05, 0, b.minZ - .05, b.maxX + .05, .6, b.maxZ + .05, MAT.concrete2, 3, false); boxAt(b.minX - .2, b.maxY - .1, b.minZ - .2, b.maxX + .2, b.maxY + .16, b.maxZ + .2, MAT.cornice2, 0, false); }
    if (snow && b.minY < 3.8 && b.maxY > .9 && b.mat !== 'metalP') boxAt(b.minX + .04, b.maxY, b.minZ + .04, b.maxX - .04, b.maxY + .14, b.maxZ - .04, MAT.snowCap, 3, false);
    if (b.mat.startsWith('cont')) { boxAt(b.minX - .03, b.maxY - .12, b.minZ - .03, b.maxX + .03, b.maxY, b.maxZ + .03, MAT.dark, 0, false); }
  }
  // perímetro
  const [x0, z0, x1, z1] = M.bounds, H = M.wallH, pm = desert ? MAT.bld2 : rural ? MAT.hedge : city ? MAT.city2 : snow ? MAT.stationH : MAT.concrete;
  for (const [a, b, c, d] of [[x0 - 1, z0 - 1, x1 + 1, z0], [x0 - 1, z1, x1 + 1, z1 + 1], [x0 - 1, z0, x0, z1], [x1, z0, x1 + 1, z1]]) {
    boxAt(a, 0, b, c, H, d, pm, desert ? 5 : rural ? 3 : city ? 8 : 6);
    if (!rural) boxAt(a - .15, H - .2, b - .15, c + .15, H + .1, d + .15, desert ? MAT.cornice : MAT.dark, 0, false);
  }
  // letras de los sitios en el suelo
  for (const k in M.sites) { const s = M.sites[k]; const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshStandardMaterial({ map: TX[k], transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })); p.rotation.x = -Math.PI / 2; p.position.set(s.c[0], .02, s.c[1]); p.receiveShadow = true; worldGroup.add(p); }
  if (desert) desertDecor(M); else if (rural) ruralDecor(M); else if (city) cityDecor(M); else if (snow) snowDecor(M); else portDecor(M);
  buildDust(desert || rural);
  mergeStatic(worldGroup);
  condKey = ''; if (typeof clearDecals === 'function' && fx) clearDecals();
}
// Une todas las mallas estáticas del mapa por material: de cientos de llamadas de dibujo a unas decenas
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map(), victims = [];
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) return;
    const m = o.material; if (Array.isArray(m)) return;
    const key = m.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + (o.renderOrder || 0);
    let b = buckets.get(key); if (!b) { b = { mat: m, cast: o.castShadow, recv: o.receiveShadow, ro: o.renderOrder || 0, geos: [] }; buckets.set(key, b); }
    const g = o.geometry.clone(); if (!g.attributes.uv) return; if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld); b.geos.push(g); victims.push(o);
  });
  for (const o of victims) if (o.parent) o.parent.remove(o);
  for (const b of buckets.values()) {
    if (!b.geos.length) continue;
    const geo = PCM.merge(b.geos); geo.computeBoundingSphere(); geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.ro; mesh.matrixAutoUpdate = false; group.add(mesh);
    for (const g of b.geos) g.dispose();
  }
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

/* ---------- Distrito Lumen (ciudad) y Estación Boreal (nieve) ---------- */
function wagonModel(b, mat) {
  const along = (b.maxX - b.minX) > (b.maxZ - b.minZ);
  boxAt(b.minX, .55, b.minZ, b.maxX, b.maxY, b.maxZ, mat, 0);
  boxAt(b.minX - .06, b.maxY - .04, b.minZ - .06, b.maxX + .06, b.maxY + .1, b.maxZ + .06, MAT.dark, 0, false);
  boxAt(b.minX + .5, .2, b.minZ + .3, b.maxX - .5, .55, b.maxZ - .3, MAT.dark, 0, true);
  const L = along ? b.maxX - b.minX : b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const tire = shMat('wheel', () => std({ color: 0x1a1c1f, roughness: .6, metalness: .6 }));
  for (const t of [-.36, .36]) for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .16, 14), tire); w.rotation[along ? 'x' : 'z'] = Math.PI / 2; const off = t * L, so = sd * ((along ? b.maxZ - b.minZ : b.maxX - b.minX) / 2 - .25); w.position.set(along ? cx + off : cx + so, .42, along ? cz + so : cz + off); worldGroup.add(w); }
}
function fountain(b) {
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, r = (b.maxX - b.minX) / 2;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r + .1, b.maxY, 24), MAT.stoneC); rim.position.set(cx, b.maxY / 2, cz); rim.castShadow = rim.receiveShadow = true; worldGroup.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - .25, 24), std({ color: 0x2f5d75, roughness: .05, metalness: .8 })); water.rotation.x = -Math.PI / 2; water.position.set(cx, b.maxY - .08, cz); worldGroup.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.22, .34, 2.4, 12), MAT.stoneC); col.position.set(cx, 1.2, cz); col.castShadow = true; worldGroup.add(col);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.9, .3, .3, 16), MAT.stoneC); bowl.position.set(cx, 2.4, cz); bowl.castShadow = true; worldGroup.add(bowl);
}
function streetLamp(x, z, h, rot) {
  boxAt(x - .07, 0, z - .07, x + .07, h, z + .07, MAT.metalP, 0, true);
  const dx = Math.cos(rot) * 1.1, dz = Math.sin(rot) * 1.1; boxAt(Math.min(x, x + dx) - .05, h - .08, Math.min(z, z + dz) - .05, Math.max(x, x + dx) + .05, h, Math.max(z, z + dz) + .05, MAT.metalP, 0, false);
  const l = new THREE.Mesh(uvBox(.42, .1, .26, 0), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); l.position.set(x + dx, h - .12, z + dz); worldGroup.add(l);
}
function neonSign(x, y, z, w, h, color, rotY) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = rotY; worldGroup.add(m);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w + .2, h + .2), new THREE.MeshStandardMaterial({ color: 0x15171a, side: THREE.DoubleSide })); f.position.set(x - Math.sin(rotY) * .02, y, z - Math.cos(rotY) * .02); f.rotation.y = rotY; worldGroup.add(f);
}
function cityDecor(M) {
  const [x0, z0, x1, z1] = M.bounds;
  // rascacielos en el horizonte
  for (let i = 0; i < 46; i++) {
    const side = i % 4, off = rand(4, 30); let x, z;
    if (side === 0) { x = rand(x0 - 30, x1 + 30); z = z0 - 2 - off; } else if (side === 1) { x = rand(x0 - 30, x1 + 30); z = z1 + 2 + off; } else if (side === 2) { x = x0 - 2 - off; z = rand(z0, z1); } else { x = x1 + 2 + off; z = rand(z0, z1); }
    const w = rand(6, 12), d = rand(6, 12), h = rand(14, 46); boxAt(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, Math.random() < .5 ? MAT.city : MAT.city2, 8, false);
  }
  // líneas de la avenida y pasos de cebra
  const paint = std({ color: 0xe8e4d6, roughness: .8 }), yel = std({ color: 0xd9a22e, roughness: .8 });
  for (let x = x0 + 2; x < x1 - 2; x += 4) boxAt(x, .005, -.08 + 1.2, x + 2, .02, .08 + 1.2, yel, 0, false);
  for (const zx of [-9, 9]) for (let k = 0; k < 6; k++) boxAt(zx - 1.6, .005, -5.5 + k * 1.3 + 2.5, zx + 1.6, .02, -5 + k * 1.3 + 2.5, paint, 0, false);
  // franjas pintadas de los sitios (lectura rápida de A y B)
  for (const k in M.sites) { const [a, b, c, d] = M.sites[k].r; const col = std({ color: k === 'A' ? 0xd9a22e : 0x3fb4c9, roughness: .7 }); boxAt(a, .006, b, c, .02, b + .25, col, 0, false); boxAt(a, .006, d - .25, c, .02, d, col, 0, false); }
  // postes de luz y letreros de neón
  for (let x = x0 + 6; x < x1 - 4; x += 12) { streetLamp(x, -5.2, 5.4, Math.PI / 2); streetLamp(x + 6, 5.6, 5.4, -Math.PI / 2); }
  neonSign(-8, 6, -7.9, 3.4, .8, 0x3fe0f0, 0); neonSign(8, 7, -7.9, 2.6, .9, 0xff5a8a, 0); neonSign(-31, 6.5, 5.9, 3, .8, 0xffb347, Math.PI); neonSign(12, 6, 5.9, 3.2, .7, 0x3fe0f0, Math.PI);
  // charcos que reflejan
  const pud = std({ color: 0x1d2530, roughness: .04, metalness: .9 });
  for (const [x, z, r] of [[-14, 1, 1.6], [6, -2, 1.2], [24, 2, 1.8], [-34, 1.5, 1.3], [0, 18, 1.1]]) { const p = new THREE.Mesh(new THREE.CircleGeometry(r, 18), pud); p.rotation.x = -Math.PI / 2; p.position.set(x, .012, z); p.scale.y = .6; worldGroup.add(p); }
}
function snowDecor(M) {
  const [x0, z0, x1, z1] = M.bounds;
  // rieles
  const rail = std({ color: 0x5b5f66, roughness: .35, metalness: .85 }), sleeper = std({ map: TX.wood, color: 0x6a5440 });
  for (const zc of [-12, -2, 8]) { for (const dz of [-.72, .72]) boxAt(x0, .0, zc + dz - .05, x1, .14, zc + dz + .05, rail, 0, false); for (let x = x0 + .5; x < x1; x += 1.4) boxAt(x, 0, zc - 1.2, x + .28, .06, zc + 1.2, sleeper, 0, false); }
  // pinos nevados afuera
  const pine = std({ color: 0x2c4a3a, roughness: .9, flatShading: true }), cap = MAT.snowCap;
  for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, r = rand(44, 90); const x = Math.cos(a) * r, z = Math.sin(a) * r * .85; const h = rand(5, 11); const g = new THREE.Group(); g.position.set(x, 0, z); worldGroup.add(g);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(h * (.34 - k * .08), h * .45, 8), pine); c.position.y = h * (.3 + k * .22); c.castShadow = true; g.add(c); const s = new THREE.Mesh(new THREE.ConeGeometry(h * (.2 - k * .05), h * .2, 8), cap); s.position.y = h * (.42 + k * .22); g.add(s); } }
  // montañas
  const mtn = std({ color: 0xb8c6d8, roughness: 1, flatShading: true });
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const m = new THREE.Mesh(new THREE.ConeGeometry(rand(40, 70), rand(40, 80), 6), mtn); m.position.set(Math.cos(a) * 190, 0, Math.sin(a) * 190); worldGroup.add(m); }
  // franjas de los sitios y faroles del andén
  for (const k in M.sites) { const [a, b, c, d] = M.sites[k].r; const col = std({ color: k === 'A' ? 0xd9a22e : 0x3fb4c9, roughness: .7 }); boxAt(a, .32, b, c, .34, b + .25, col, 0, false); boxAt(a, .006, d - .25, c, .03, d, col, 0, false); }
  for (const x of [-9, -1, 7, 15, 23]) { const l = new THREE.Mesh(uvBox(.5, .12, .3, 0), new THREE.MeshBasicMaterial({ color: 0xffe0b0 })); l.position.set(x, 3.5, -21); worldGroup.add(l); }
}

/* ---------- Fundo Azul (casa de contenedores) ---------- */
function specialBox(b) {
  const m = b.mat;
  if (m.startsWith('car:')) { carModel(b, { red: 0xb3221c, navy: 0x1f2a3d, silver: 0xa9adb3 }[m.slice(4)] || 0x777777); return true; }
  if (m === 'trunk') { fruitTree((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2); return true; }
  if (m === 'tank') { const r = (b.maxX - b.minX) / 2; const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, b.maxY, 20), MAT.tank); t.position.set((b.minX + b.maxX) / 2, b.maxY / 2, (b.minZ + b.maxZ) / 2); t.castShadow = t.receiveShadow = true; worldGroup.add(t); aoStrips(b); return true; }
  if (m === 'pole') { const t = new THREE.Mesh(new THREE.CylinderGeometry(.13, .17, b.maxY, 8), MAT.pole); const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2; t.position.set(cx, b.maxY / 2, cz); t.castShadow = true; worldGroup.add(t); boxAt(cx - 1, b.maxY - .7, cz - .06, cx + 1, b.maxY - .55, cz + .06, MAT.pole, 0, true); return true; }
  if (m === 'vine') { boxAt(b.minX, .35, b.minZ, b.maxX, b.maxY, b.maxZ, MAT.vine, 2); for (let z = b.minZ; z <= b.maxZ; z += 3) boxAt((b.minX + b.maxX) / 2 - .05, 0, z - .05, (b.minX + b.maxX) / 2 + .05, b.maxY + .2, z + .05, MAT.pole, 0, true); return true; }
  if (m.startsWith('wagon:')) { wagonModel(b, MAT[m]); return true; }
  if (m === 'stoneC') { fountain(b); return true; }
  if (m === 'snowpile') { const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2; const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.snowpile); s.scale.set((b.maxX - b.minX) / 2 + .2, b.maxY, (b.maxZ - b.minZ) / 2 + .2); s.position.set(cx, 0, cz); s.castShadow = s.receiveShadow = true; worldGroup.add(s); return true; }
  if (m === 'tarp') { boxAt(b.minX, 0, b.minZ, b.maxX, b.maxY, b.maxZ, MAT.tarp, 0); const j = boxAt(b.minX + .3, b.maxY, b.minZ + .3, b.minX + .75, b.maxY + .32, b.minZ + .62, std({ color: 0xd8261c, roughness: .4 }), 0); return true; }
  return false;
}
// Materiales compartidos entre objetos repetidos (autos, ruedas): menos llamadas de dibujo y nada que liberar al cambiar de mapa
const SHM = {}; const shMat = (k, make) => SHM[k] || (SHM[k] = make());
function carModel(b, color) {
  const g = new THREE.Group(); const along = (b.maxZ - b.minZ) > (b.maxX - b.minX); const L = along ? b.maxZ - b.minZ : b.maxX - b.minX, W = along ? b.maxX - b.minX : b.maxZ - b.minZ, H = b.maxY - b.minY;
  g.position.set((b.minX + b.maxX) / 2, b.minY, (b.minZ + b.maxZ) / 2); if (!along) g.rotation.y = Math.PI / 2; worldGroup.add(g);
  const paint = shMat('paint' + color, () => std({ color, roughness: .25, metalness: .6 })), glass = shMat('cglass', () => std({ color: 0x14181d, roughness: .1, metalness: .8 })), tire = shMat('tire', () => std({ color: 0x151515, roughness: .9 })), trim = shMat('trim', () => std({ color: 0x222426, roughness: .6 }));
  const add = (m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geoBox, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(paint, 0, .55, 0, W, .55, L); add(trim, 0, .32, 0, W + .02, .14, L + .02);
  add(paint, 0, 1.05, -L * .05, W * .9, .45, L * .55); add(glass, 0, 1.06, -L * .05, W * .92, .36, L * .5);
  add(paint, 0, 1.3, -L * .05, W * .86, .06, L * .52);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .24, 16), tire); w.rotation.z = Math.PI / 2; w.position.set(sx * (W / 2 - .08), .34, sz * (L / 2 - .7)); w.castShadow = true; g.add(w); }
  for (const sx of [-1, 1]) { const tl = new THREE.Mesh(geoBox, shMat('tail', () => new THREE.MeshBasicMaterial({ color: 0xff2a1a }))); tl.position.set(sx * (W / 2 - .2), .7, L / 2 + .005); tl.scale.set(.3, .1, .02); g.add(tl); const hl = new THREE.Mesh(geoBox, shMat('head', () => new THREE.MeshBasicMaterial({ color: 0xfff6e0 }))); hl.position.set(sx * (W / 2 - .2), .68, -L / 2 - .005); hl.scale.set(.3, .1, .02); g.add(hl); }
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(W + .9, L + .9), shMat('blob', () => new THREE.MeshBasicMaterial({ map: TX.shadowBlob, transparent: true, depthWrite: false }))); sh.rotation.x = -Math.PI / 2; sh.position.y = .02; g.add(sh);
}
const leafMats = [0x3f6e2a, 0x4d7d30, 0x5a8a36, 0x386224].map(c => std({ color: c, roughness: .9, flatShading: true }));
function fruitTree(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); worldGroup.add(g);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(.12, .17, 1.8, 7), MAT.trunk); tr.position.y = .9; tr.castShadow = true; g.add(tr);
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(.9, 1.4), 1), leafMats[(Math.random() * 4) | 0]); c.position.set(rand(-.7, .7), rand(2.1, 3.0), rand(-.7, .7)); c.scale.y = rand(.75, 1); c.castShadow = true; c.receiveShadow = true; g.add(c); }
}
function aoStrips(b) {
  if (prefs.gfx !== 'high') return;
  const mat = new THREE.MeshBasicMaterial({ map: TX.ao, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const w = .9, y = (b.minY > .05 ? b.minY : 0) + .012;
  const sides = [[(b.minX + b.maxX) / 2, b.minZ - w / 2, b.maxX - b.minX, 0], [(b.minX + b.maxX) / 2, b.maxZ + w / 2, b.maxX - b.minX, Math.PI], [b.minX - w / 2, (b.minZ + b.maxZ) / 2, b.maxZ - b.minZ, -Math.PI / 2], [b.maxX + w / 2, (b.minZ + b.maxZ) / 2, b.maxZ - b.minZ, Math.PI / 2]];
  for (const [x, z, L, r] of sides) {
    if (solidAt(x, z, y + .3)) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L + w * .6, w), mat); m.rotation.order = 'YXZ'; m.rotation.y = r; m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); worldGroup.add(m);
  }
}
function groundPatch(x0, z0, x1, z1, tx, y = .008) { const t = tx.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / 6, (z1 - z0) / 6); const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; worldGroup.add(m); return m; }
function tufts(areas, count) {
  const geo = new THREE.PlaneGeometry(.7, .55); geo.translate(0, .27, 0); const g2 = geo.clone(); g2.rotateY(Math.PI / 2); const merged = new THREE.BufferGeometry();
  const pa = [...geo.attributes.position.array, ...g2.attributes.position.array], ua = [...geo.attributes.uv.array, ...g2.attributes.uv.array], ia = [...geo.index.array, ...g2.index.array.map(i => i + 4)];
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3)); merged.setAttribute('uv', new THREE.Float32BufferAttribute(ua, 2)); merged.setIndex(ia); merged.computeVertexNormals();
  const im = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ map: TX.tuft, alphaTest: .5, side: THREE.DoubleSide, roughness: 1 }), count); const o = new THREE.Object3D(); let n = 0;
  for (let i = 0; i < count * 3 && n < count; i++) { const [x0, z0, x1, z1] = areas[(Math.random() * areas.length) | 0]; const x = rand(x0, x1), z = rand(z0, z1); if (solidAt(x, z, .3)) continue; o.position.set(x, 0, z); o.rotation.y = Math.random() * 6; const s = rand(.6, 1.3); o.scale.set(s, s, s); o.updateMatrix(); im.setMatrixAt(n++, o.matrix); }
  im.count = n; worldGroup.add(im);
}
function ruralDecor(M) {
  const [x0, z0, x1, z1] = M.bounds;
  // pasto: jardín delantero, huerto, viña
  groundPatch(-12, 3.5, -2.6, 11, TX.grass); groundPatch(2.6, 3.5, 14, 11, TX.grass); groundPatch(x0, z0, x1, -12, TX.grass); groundPatch(19, -12, x1, 18, TX.grass); groundPatch(-60, z0 - 60, 60, z0, TX.grass, -.01);
  tufts([[-12, 3.5, -2.6, 11], [2.6, 3.5, 14, 11], [x0, z0, x1, -12], [19, -12, x1, 18], [x0, 18, -20, z1]], prefs.gfx === 'high' ? 1400 : 500);
  // rampa de entrada
  boxAt(-2.6, 0, 3.5, 2.6, .15, 7, MAT.slab, 6, false);
  // techo a dos aguas sobre los contenedores
  const ridge = 9.2, eave = 3.35, half = 14.2, zA = -11.2, zB = 3.8, slope = Math.atan2(ridge - eave, half), len = Math.hypot(half, ridge - eave);
  for (const sg of [-1, 1]) {
    const t = TX.roofDark.clone(); t.needsUpdate = true; t.repeat.set(len / 3, (zB - zA) / 3);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(len, zB - zA), new THREE.MeshStandardMaterial({ map: t, roughness: .45, metalness: .6, side: THREE.DoubleSide }));
    r.position.set(sg * half / 2, (ridge + eave) / 2, (zA + zB) / 2); r.rotation.set(-Math.PI / 2, 0, -sg * slope, 'ZXY');
    r.castShadow = true; r.receiveShadow = true; worldGroup.add(r);
    // vigas (perfiles de acero café)
    for (let z = zA + .3; z <= zB; z += 2.4) { const bm = new THREE.Mesh(geoBox, MAT.metal); bm.scale.set(len, .16, .1); bm.position.set(sg * half / 2, (ridge + eave) / 2 - .14, z); bm.rotation.z = sg > 0 ? -slope : slope; bm.castShadow = true; worldGroup.add(bm); }
  }
  boxAt(-.1, ridge - .25, zA, .1, ridge, zB, MAT.metal, 0, true);
  for (const x of [-5.1, 5.1, -10.1, 10.1]) for (const z of [2.1, -10.1]) { const top = ridge - (ridge - eave) * Math.abs(x) / half; boxAt(x - .07, 2.9, z - .07, x + .07, top, z + .07, MAT.metal, 0, true); }
  // frontón de vidrio
  const sh = new THREE.Shape(); sh.moveTo(-5, 3.2); sh.lineTo(5, 3.2); sh.lineTo(5, ridge - (ridge - eave) * 5 / half); sh.lineTo(0, ridge - .1); sh.lineTo(-5, ridge - (ridge - eave) * 5 / half); sh.closePath();
  const gl = new THREE.Mesh(new THREE.ShapeGeometry(sh), MAT.glass); gl.position.z = -10.1; worldGroup.add(gl);
  for (let x = -5; x <= 5.01; x += 1.25) { const top = ridge - .1 - (ridge - eave) * Math.abs(x) / half; boxAt(x - .03, 3.2, -10.15, x + .03, Math.max(3.3, top), -10.05, MAT.dark, 0, false); }
  for (const y of [5.2, 7.2]) { const wHalf = Math.min(5, (ridge - y) / (ridge - eave) * half); boxAt(-wHalf, y - .03, -10.15, wHalf, y + .03, -10.05, MAT.dark, 0, false); }
  // ventanales y puertas en los contenedores
  boxAt(-9.5, .45, 2.0, -5.5, 2.75, 2.06, MAT.whiteFrame, 0, false); boxAt(-9.35, .55, 2.06, -5.65, 2.65, 2.09, MAT.blinds, 0, false);
  boxAt(6.2, 1.3, 2.0, 9.4, 2.55, 2.06, MAT.whiteFrame, 0, false); boxAt(6.32, 1.4, 2.06, 9.28, 2.45, 2.09, MAT.blinds, 0, false);
  boxAt(4.95, 1.4, -3.2, 5.0, 2.3, -1.6, MAT.blinds, 0, false); boxAt(-1, .3, -10.0, 1, 2.6, -9.96, MAT.dark, 0, false);
  for (const [x, z] of [[-10, 2], [-5, 2], [5, 2], [10, 2], [-10, -10], [10, -10]]) boxAt(x - .12, .3, z - .12, x + .12, 2.95, z + .12, MAT.dark, 0, false);
  // techo de la cochera
  boxAt(-24.6, 3.2, -8.6, -10, 3.34, 5.6, MAT.roofDark, 0, true); for (let z = -8; z <= 5; z += 3.25) boxAt(-24.6, 3.05, z - .06, -10, 3.2, z + .06, MAT.metal, 0, true);
  // luz de relleno bajo el techo (rebote del sol en la losa)
  const fill = new THREE.PointLight(0xfff0dc, .9, 24, 1.6); fill.position.set(0, 5.5, -4); worldGroup.add(fill);
  // antena satelital
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .05, 20), std({ color: 0xf2f2ee, roughness: .4 })); dish.position.set(-12.6, 4.1, -2); dish.rotation.z = .5; worldGroup.add(dish);
  // palmeras, maceteros y cables
  palm(-13.8, 6, 3.2); palm(13.6, 6.4, 3.4); palm(26, 26, 5.5);
  for (const [x, z] of [[-6.4, 2.6], [-4.2, 2.8], [6.8, 2.7], [8.6, 2.7], [11.4, 2.8]]) jar(x, z, rand(.7, 1.1));
  const wire = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  for (const [ax, ay, az, bx, by, bz] of [[31.15, 8.4, 22.15, 14, 3.6, 2.5], [31.15, 8.4, 22.15, 46, 8.6, 40], [31.15, 8.4, 22.15, 31, 8.5, -40]]) { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(lerp(ax, bx, t), lerp(ay, by, t) - Math.sin(t * Math.PI) * .8, lerp(az, bz, t))); } worldGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); }
  // colinas y huertos lejanos
  const hill = std({ color: 0x6f8a4a, roughness: 1 }), hill2 = std({ color: 0x8a8a58, roughness: 1 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const r = 160 + rand(0, 50); const m = new THREE.Mesh(new THREE.SphereGeometry(rand(40, 70), 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), i % 3 ? hill : hill2); m.scale.y = rand(.22, .42); m.position.set(Math.cos(a) * r, -3, Math.sin(a) * r); worldGroup.add(m); }
  for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, r = rand(48, 90); fruitTree(Math.cos(a) * r, Math.sin(a) * r); }
}

/* ================= EFECTOS ================= */
const fx = { tracers: [], decals: [], di: 0 };
for (let i = 0; i < 48; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: .8, fog: false })); l.visible = false; l.frustumCulled = false; scene.add(l); fx.tracers.push({ l, life: 0 }); }
let tIdx = 0;
function tracer(a, b) { const t = fx.tracers[tIdx++ % fx.tracers.length]; const p = t.l.geometry.attributes.position.array; const k = .15; p[0] = lerp(a.x, b.x, k); p[1] = lerp(a.y, b.y, k); p[2] = lerp(a.z, b.z, k); p[3] = b.x; p[4] = b.y; p[5] = b.z; t.l.geometry.attributes.position.needsUpdate = true; t.l.visible = true; t.life = .05; }
const decalGeo = new THREE.PlaneGeometry(.11, .11); const decalMat = new THREE.MeshBasicMaterial({ map: TX.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const DECALS = 200; const decalIM = new THREE.InstancedMesh(decalGeo, decalMat, DECALS); decalIM.frustumCulled = false; { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < DECALS; i++) decalIM.setMatrixAt(i, z); } scene.add(decalIM);
const _dO = new THREE.Object3D();
const _v = new THREE.Vector3();
function clearDecals() { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < DECALS; i++) decalIM.setMatrixAt(i, z); decalIM.instanceMatrix.needsUpdate = true; fx.di = 0; }
function decal(p, n) { const i = fx.di++ % DECALS; _dO.position.set(p.x + n[0] * .012, p.y + n[1] * .012, p.z + n[2] * .012); _v.set(_dO.position.x + n[0], _dO.position.y + n[1], _dO.position.z + n[2]); _dO.lookAt(_v); _dO.rotateZ(Math.random() * 6); _dO.scale.setScalar(rand(.8, 1.2)); _dO.updateMatrix(); decalIM.setMatrixAt(i, _dO.matrix); decalIM.instanceMatrix.needsUpdate = true; }
const PN = 700; const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN); let pI = 0;
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -999;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, opacity: .9, depthWrite: false })); parts.frustumCulled = false; scene.add(parts);
function burst(p, n, col, speed, count) { for (let i = 0; i < count; i++) { const k = pI++ % PN; pPos[k * 3] = p.x; pPos[k * 3 + 1] = p.y; pPos[k * 3 + 2] = p.z; const s = speed * rand(.3, 1); pVel[k * 3] = (n[0] + gauss() * .8) * s; pVel[k * 3 + 1] = (n[1] + gauss() * .8 + .4) * s; pVel[k * 3 + 2] = (n[2] + gauss() * .8) * s; pLife[k] = rand(.25, .7); const v = rand(.85, 1.1); pCol[k * 3] = col[0] * v; pCol[k * 3 + 1] = col[1] * v; pCol[k * 3 + 2] = col[2] * v; } pGeo.attributes.color.needsUpdate = true; }
const worldFlash = new THREE.PointLight(0xffa858, 0, 10); scene.add(worldFlash);
// chispas (aditivas)
const SN = 240; const sPos = new Float32Array(SN * 3), sVel = new Float32Array(SN * 3), sLife = new Float32Array(SN); let sI = 0; for (let i = 0; i < SN; i++) sPos[i * 3 + 1] = -999;
const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sparksPts = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: .045, color: 0xffc070, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); sparksPts.frustumCulled = false; scene.add(sparksPts);
function sparks(p, n, count) { for (let i = 0; i < count; i++) { const k = sI++ % SN; sPos[k * 3] = p.x; sPos[k * 3 + 1] = p.y; sPos[k * 3 + 2] = p.z; const sp = rand(3, 7); sVel[k * 3] = (n[0] + gauss()) * sp; sVel[k * 3 + 1] = (n[1] + gauss() + .5) * sp; sVel[k * 3 + 2] = (n[2] + gauss()) * sp; sLife[k] = rand(.12, .3); } }
// casquillos
const brass = std({ color: 0xc9a043, roughness: .3, metalness: .9 }), shellRed = std({ color: 0xa8231c, roughness: .5 });
const casings = []; for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .024, 6), brass); m.visible = false; scene.add(m); casings.push({ m, v: new THREE.Vector3(), life: 0, b: 0 }); } let cI = 0;
function ejectCasing(shotgun) {
  const c = casings[cI++ % casings.length]; const right = new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw)); const f = new THREE.Vector3(); camera.getWorldDirection(f);
  c.m.material = shotgun ? shellRed : brass; c.m.scale.setScalar(shotgun ? 2.2 : 1);
  c.m.position.copy(camera.position).addScaledVector(f, .35).addScaledVector(right, .16).add(new THREE.Vector3(0, -.1, 0));
  c.v.copy(right).multiplyScalar(rand(1.8, 2.6)).add(new THREE.Vector3(0, rand(1.6, 2.4), 0)).addScaledVector(f, rand(-.3, .3)).add(new THREE.Vector3(me.vel.x, 0, me.vel.z));
  c.life = 3; c.b = 0; c.m.visible = true; c.m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
}
// humo del cañón
const puffMat = new THREE.SpriteMaterial({ map: TX.smoke, color: 0xd8d4cc, transparent: true, depthWrite: false, opacity: 0 });
const puffs = []; for (let i = 0; i < 24; i++) { const s = new THREE.Sprite(puffMat.clone()); s.visible = false; scene.add(s); puffs.push({ s, life: 0 }); } let puI = 0;
function muzzlePuff(p) { const q = puffs[puI++ % puffs.length]; q.s.position.copy(p); q.life = .7; q.s.visible = true; q.s.scale.setScalar(.15); q.s.material.rotation = Math.random() * 6; }
// motas de polvo al sol
let dust = null;
function buildDust(on) {
  if (dust) { scene.remove(dust); dust.geometry.dispose(); dust.material.dispose(); dust = null; } if (!on || prefs.gfx !== 'high') return;
  const N = 420, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-18, 18); pos[i * 3 + 1] = rand(.2, 6); pos[i * 3 + 2] = rand(-18, 18); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ size: .028, color: 0xfff2d6, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); dust.frustumCulled = false; scene.add(dust);
}
const boomLight = new THREE.PointLight(0xffb070, 0, 40); scene.add(boomLight);
function updateFx(dt) {
  for (const t of fx.tracers) if (t.life > 0) { t.life -= dt; t.l.material.opacity = Math.max(0, t.life / .05) * .8; if (t.life <= 0) t.l.visible = false; }
  for (let k = 0; k < PN; k++) if (pLife[k] > 0) { pLife[k] -= dt; pVel[k * 3 + 1] -= 9 * dt; pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt; if (pLife[k] <= 0 || pPos[k * 3 + 1] < 0) { pPos[k * 3 + 1] = -999; pLife[k] = 0; } }
  pGeo.attributes.position.needsUpdate = true;
  for (let k = 0; k < SN; k++) if (sLife[k] > 0) { sLife[k] -= dt; sVel[k * 3 + 1] -= 12 * dt; sPos[k * 3] += sVel[k * 3] * dt; sPos[k * 3 + 1] += sVel[k * 3 + 1] * dt; sPos[k * 3 + 2] += sVel[k * 3 + 2] * dt; if (sLife[k] <= 0) sPos[k * 3 + 1] = -999; }
  sGeo.attributes.position.needsUpdate = true;
  for (const c of casings) if (c.life > 0) {
    c.life -= dt; if (c.life <= 0) { c.m.visible = false; continue; }
    if (c.b < 3) { c.v.y -= 11 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 18; c.m.rotation.y += dt * 9;
      const g = WORLD ? WORLD.groundAt(c.m.position.x, c.m.position.z, c.m.position.y) : 0;
      if (c.m.position.y < g + .01) { c.m.position.y = g + .01; c.v.y = -c.v.y * .35; c.v.x *= .5; c.v.z *= .5; c.b++; if (c.b === 1) sTone(rand(3800, 5200), .04, .05, 'triangle'); if (c.b >= 3) c.m.rotation.set(Math.PI / 2, Math.random() * 6, 0); } }
  }
  for (const q of puffs) if (q.life > 0) { q.life -= dt; const k = 1 - q.life / .7; q.s.scale.setScalar(.15 + k * .9); q.s.position.y += dt * .4; q.s.material.opacity = (1 - k) * .28; if (q.life <= 0) q.s.visible = false; }
  if (dust) { dust.position.set(Math.floor(camera.position.x / 36) * 36, 0, Math.floor(camera.position.z / 36) * 36); const a = dust.geometry.attributes.position.array; const t = nowS(); for (let i = 0; i < a.length; i += 3) { a[i] += Math.sin(t * .3 + i) * dt * .08; a[i + 1] += Math.sin(t * .5 + i * .7) * dt * .05; } dust.geometry.attributes.position.needsUpdate = true; }
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
const fires = new Map(), fakeBlips = [];
const fireMat = () => new THREE.SpriteMaterial({ map: glowWarm, color: 0xff8a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .9 });
function makeFire(id, x, y, z, r, dur) {
  if (fires.has(id)) return; const g = new THREE.Group(); g.position.set(x, y + .02, z); scene.add(g); const mat = fireMat(); const fl = [];
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0x120c08, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); scorch.rotation.x = -Math.PI / 2; g.add(scorch);
  const N = prefs.gfx === 'high' ? 34 : 16; for (let i = 0; i < N; i++) { const s = new THREE.Sprite(mat); const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r * .92; s.position.set(Math.cos(a) * rr, rand(.15, .6), Math.sin(a) * rr); s.userData = { b: rand(.5, 1.1), ph: Math.random() * 6 }; g.add(s); fl.push(s); }
  fires.set(id, { g, mat, fl, born: nowS(), until: nowS() + dur, x, z, crack: 0 });
  const p = posAudio(x, z); sNoise(.5, clamp(.5 - p.d / 60, .05, .5), 900, 0, p.pan, .6); sNoise(.9, clamp(.3 - p.d / 70, .03, .3), 2400, .1, p.pan, .8);
}
function killFire(id, steam) { const f = fires.get(id); if (!f) return; if (steam) { burst({ x: f.x, y: .5, z: f.z }, [0, 1, 0], [.8, .8, .8], 3, 14); const p = posAudio(f.x, f.z); sNoise(.6, clamp(.4 - p.d / 60, .04, .4), 4000, 0, p.pan, .5); } scene.remove(f.g); f.g.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); }); f.mat.dispose(); fires.delete(id); }
function clearFires() { for (const id of [...fires.keys()]) killFire(id); fakeBlips.length = 0; }
function animFires(dt) {
  const t = nowS();
  for (const [id, f] of fires) {
    const left = f.until - t; if (left <= 0) { killFire(id); continue; } const k = Math.min(1, (t - f.born) / .25) * Math.min(1, left / .8);
    for (const s of f.fl) { const u = s.userData; const fl = (Math.sin(t * 11 + u.ph) * .5 + .5) * .5 + .5; s.scale.set(u.b * fl * k, u.b * 1.7 * fl * k, 1); s.position.y = .2 + u.b * .5 * fl; }
    f.crack -= dt; if (f.crack <= 0) { f.crack = rand(.08, .25); const p = posAudio(f.x, f.z); if (p.d < 30) sNoise(.05, .18 * (1 - p.d / 30), rand(1800, 4200), 0, p.pan, 2); }
  }
  for (let i = fakeBlips.length - 1; i >= 0; i--) if (fakeBlips[i].until < t) fakeBlips.splice(i, 1);
}
function decoyShots(e) {
  const w = WEAPONS[e.w] || WEAPONS.p9; const p = posAudio(e.p[0], e.p[2]); const iv = 60 / w.rpm;
  for (let i = 0; i < (e.n || 1); i++) setTimeout(() => sShot(w.snd, p.d, p.pan), i * iv * 1000);
  if (e.tm !== me.team) fakeBlips.push({ x: e.p[0], z: e.p[2], until: nowS() + 1.4 });
}
function updateSmokes(list) {
  const seen = new Set(); for (const [id, x, z, left] of list) { seen.add(id); if (!smokes.has(id)) makeSmoke(id, x, 0, z, left); else smokes.get(id).until = nowS() + left; }
  for (const [id, s] of smokes) if (!seen.has(id) && nowS() > s.born + 1) { scene.remove(s.g); smokes.delete(id); }
}
function animSmokes() { const t = nowS(); for (const s of smokes.values()) { const grow = clamp((t - s.born) / 1.2, 0, 1), fade = clamp((s.until - t) / 2.5, 0, 1); s.mat.opacity = Math.min(grow, fade) * .96; s.g.scale.setScalar(.4 + .6 * grow); s.g.rotation.y += .0015; } }

/* ================= SOLDADOS ================= */
const TEAMLOOK = [{ uni: 0x4b5966, vest: 0x2c363f, band: 0x5cc8e0, skin: [0xc9a07e, 0x8d6248, 0xb88a68, 0x6e4a34] }, { uni: 0x8a7550, vest: 0x4d4130, band: 0xef6a45, skin: [0xd2ab8a, 0x9b7052, 0x7f5a40, 0xc49572] }];
const gunM = std({ color: 0x232527, roughness: .45, metalness: .7 }), gunP = std({ color: 0x6d6250, roughness: .8 }), bladeM = std({ color: 0xb8bcc0, roughness: .25, metalness: .9 });
function tpGun(wid) { return PCM.buildGun(wid); }
const geoBox = new THREE.BoxGeometry(1, 1, 1);
function makeSoldier(team, idx) { const m = PCM.buildSoldier(team, idx, { flashMat }); scene.add(m.g); return m; }
function setModelGun(m, wid) { m.setGun(wid); }
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
let AC = null, master = null, noiseBuf = null, curBus = null; const bus = {};
const OUT = () => curBus || bus.fx || master;
function uiSound(fn) { curBus = bus.ui; try { fn(); } finally { curBus = null; } }
function applyVol() { if (!AC) return; const v = prefs.vol; master.gain.value = .55 * v.m; bus.fx.gain.value = v.fx; bus.amb.gain.value = v.amb; bus.ui.gain.value = v.ui; }
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .55;
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; master.connect(comp); comp.connect(AC.destination);
    for (const k of ['fx', 'amb', 'ui']) { bus[k] = AC.createGain(); bus[k].connect(master); } applyVol();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340; const g = AC.createGain(); g.gain.value = .05; src.connect(f); f.connect(g); g.connect(bus.amb); src.start();
  } catch (e) { AC = null; }
}
function panNode(pan) { if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); return p; } return AC.createGain(); }
function posAudio(x, z) { const dx = x - camera.position.x, dz = z - camera.position.z; const d = Math.hypot(dx, dz); const rel = angDiff(camYaw, Math.atan2(-dx, -dz)); return { d, pan: -Math.sin(rel) * .85 }; }
const ECHO = { city: .3, port: .26, desert: .2, snow: .17, rural: .12 };
function sShot(s, dist, pan, occ) {
  if (!AC || !s) return; const t = AC.currentTime; const far = clamp(dist / 90, 0, 1); const vol = s.vol * (dist < 1 ? 1 : clamp(1.5 / (1 + dist * .08), .04, 1)) * (occ ? .62 : 1);
  const ek = WORLD ? ECHO[WORLD.map.theme] || .15 : .15; if (ek > 0 && (dist < 1 || dist > 14)) { const e = AC.createBufferSource(); e.buffer = noiseBuf; const ef = AC.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = occ ? 420 : 900; const eg = AC.createGain(); const d0 = t + .08 + Math.min(dist, 80) * .003; eg.gain.setValueAtTime(.0001, t); eg.gain.linearRampToValueAtTime(vol * ek, d0); eg.gain.exponentialRampToValueAtTime(.001, d0 + .5 + ek); const ep = panNode(-pan * .5); e.connect(ef); ef.connect(eg); eg.connect(ep); ep.connect(OUT()); e.start(t, Math.random() * 1.2, 1.3); }
  const src = AC.createBufferSource(); src.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(s.cut * (1 - far * .75) * (occ ? .3 : 1), t); f.frequency.exponentialRampToValueAtTime(260, t + s.dec);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + s.dec * (1 + far)); const p = panNode(pan);
  src.connect(f); f.connect(g); g.connect(p); p.connect(OUT()); src.start(t, Math.random() * 1.5, s.dec * 2 + .1);
  const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(s.thump, t); o.frequency.exponentialRampToValueAtTime(35, t + .14); const og = AC.createGain(); og.gain.setValueAtTime(vol * (1 - far) * .9, t); og.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(og); og.connect(p); o.start(t); o.stop(t + .2);
}
function killSound(head) { sNoise(.09, .45, 160, 0, 0, .8); sTone(620, .09, .16, 'triangle', 0, .02); sTone(930, .14, .16, 'triangle', 0, .08); sTone(1240, .22, .12, 'sine', 0, .14); if (head) { sTone(3100, .35, .1, 'sine', 2900, .05); sNoise(.12, .25, 5200, .05, 0, 4); } }
function sTone(freq, dur, vol, type = 'sine', slide, delay = 0) { if (!AC) return; const t = AC.currentTime + delay; const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(OUT()); o.start(t); o.stop(t + dur + .02); }
function sNoise(dur, vol, freq, delay = 0, pan = 0, q = 1.2) { if (!AC) return; const t = AC.currentTime + delay; const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); const p = panNode(pan); s.connect(f); f.connect(g); g.connect(p); p.connect(OUT()); s.start(t, Math.random(), dur + .05); }
function sBoom(dist, big) { if (!AC) return; const t = AC.currentTime; const vol = clamp(2 / (1 + dist * .05), .08, 1.4) * (big ? 1.4 : 1); const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 1600 : 2200, t); f.frequency.exponentialRampToValueAtTime(80, t + (big ? 2 : 1)); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + (big ? 2.4 : 1.2)); s.connect(f); f.connect(g); g.connect(OUT()); s.start(t, 0, 2.5); const o = AC.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(25, t + .6); const og = AC.createGain(); og.gain.setValueAtTime(vol * .9, t); og.gain.exponentialRampToValueAtTime(.001, t + .8); o.connect(og); og.connect(OUT()); o.start(t); o.stop(t + .9); }
const sStep = (v, pan) => sNoise(.06, v, 420 + Math.random() * 260, 0, pan || 0, 1.6);
const sReload = (w) => { sNoise(.06, .35, 2200, 0); sNoise(.05, .3, 1500, w.reload * .45); sNoise(.07, .4, 2600, w.reload * .85); };

/* ================= ESTADO ================= */
const G = { reveal: 0, drone: 0, state: 'menu', phase: 'buy', pt: 0, rd: 0, sc: [0, 0], s0: 'def', bomb: ['carried', 0, 0, 0, -1, 0, 0, 0, ''], roster: [], code: '', mapId: 'alcazaba', pub: true };
const actors = []; // estado remoto
const me = {
  id: -1, team: 0, alive: false, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, h: 1.8, crouch: false, grounded: true, hp: 100,
  money: 0, armor: 0, helmet: false, kit: false, inv: { p: null, s: 'p9', n: { he: 0, fl: 0, sm: 0, in: 0, de: 0 } }, cb: false, cur: 'p9', lastCur: 'knife', srvCur: null,
  ammo: {}, drawT: 0, reloadT: 0, lastShot: -9, sprayI: 0, punchP: 0, punchY: 0, fireHeld: false, altHeld: false, trigLock: false, nadeArm: false, scoped: false, scopeK: 0, rescopeT: 0,
  crouchHold: false, crouchToggle: false, walkHeld: false, act: false, jumpReq: false, reloadReq: false, stepT: 0, deadT: 0, shots: 0, hits: 0, heads: 0, kills: 0, specIdx: 0
};
let camYaw = 0;
function sideOf(team) { return team === 0 ? G.s0 : (G.s0 === 'atk' ? 'def' : 'atk'); }
function ensureAmmo(wid) { const w = WEAPONS[wid]; if (w && !w.melee && !me.ammo[wid]) me.ammo[wid] = { mag: w.mag, res: w.res }; }
function refillAmmo() { me.ammo = {}; if (me.inv.p) ensureAmmo(me.inv.p); if (me.inv.s) ensureAmmo(me.inv.s); }
function slotList() { const l = []; if (me.inv.p) l.push(me.inv.p); if (me.inv.s) l.push(me.inv.s); l.push('knife'); for (const k of NADE_IDS) if (me.inv.n[k] > 0) l.push(k); return l; }
function setCur(wid, send = true) {
  if (!wid || me.cur === wid) return; me.lastCur = me.cur; me.cur = wid; me.drawT = WEAPONS[wid] && WEAPONS[wid].melee ? .3 : .5; me.reloadT = 0; me.scoped = false; me.altScope = false; me.rescopeT = 0; me.adsToggle = false; me.adsK = 0; me.scopeK = 0; me.nadeArm = false; me.sprayI = 0; $('#bAds').classList.remove('on');
  ensureAmmo(wid); showVM(wid); if (send) sendMsg({ t: 'eq', w: wid }); drawSlots();
}

/* ================= ARMA EN PRIMERA PERSONA ================= */
const vm = { group: new THREE.Group(), models: {}, cur: null, kick: 0, bobT: 0, swing: 0, throwT: 0, slash: 0, stab: 0, slashSide: 1, inspT: 0 };
const INSP = 2.6;
vmScene.add(vm.group);
const VMPOS = { rifle: [.15, -.18, -.44], pistol: [.12, -.14, -.38], knife: [.18, -.19, -.42], nade: [.2, -.21, -.48] }, VMS = .78;
function buildVM(id) {
  const g = PCM.buildGun(id, { shadow: false, camo: PCM.camoFor(mySkin(), id) }); const info = g.userData.info; const pos = VMPOS[info.cls] || VMPOS.rifle;
  PCM.fpArms(g, pos, VMS);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flash.scale.set(.24, .24, .24); flash.visible = false; g.userData.muzzle.add(flash);
  const light = new THREE.PointLight(0xffb060, 0, 4); g.userData.muzzle.add(light);
  g.visible = false; g.scale.setScalar(VMS); vm.group.add(g);
  // posición de apuntado: el punto de mira queda exactamente en el centro de la pantalla
  const ads = info.sight && !info.scope ? [0, -info.sight[1] * VMS, info.adsZ] : null;
  return { g, pos, ads, info, muzzle: g.userData.muzzle, flash, light };
}
function rebuildVMs() { for (const k in vm.models) vm.group.remove(vm.models[k].g); vm.models = {}; for (const k of GUN_IDS) vm.models[k] = buildVM(k); showVM(me.cur); }
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
  net.joinTimer = to;
  ws.onclose = () => { clearTimeout(to); if (net.ws !== ws) return; setBusy(false); if (G.state === 'menu' && !$('#err').textContent) $('#err').textContent = 'No se pudo conectar con el servidor. Puede estar despertando: intenta de nuevo en unos segundos.'; if (G.state !== 'menu') { leaveToMenu(); $('#err').textContent = 'Se perdió la conexión con el servidor. Vuelve a entrar con el código de la sala.'; } net.mode = null; };
}
function startOffline(opt = {}) {
  if (auth.me && !opt.range) setTimeout(() => toast('En práctica sin conexión no se suma experiencia a tu cuenta'), 1500);
  leaveNet(); net.mode = 'offline';
  const room = new PC.Room({ code: 'LOCAL', map: prefs.map, diff: prefs.diff, isPublic: false, mode: opt.range ? 'range' : prefs.gm }); net.room = room;
  room.onBroadcast = m => onMsg(m); room.onSend = (cid, m) => onMsg(m);
  const a = room.addHuman('local', cleanName(prefs.name), prefs.side === 'auto' ? null : prefs.side, mySkin());
  onMsg({ t: 'joined', code: 'LOCAL', you: a.id, team: a.team, diff: room.diffKey, pub: false, map: room.mapId, gm: room.mode });
  onMsg(room.privateState(a)); onMsg(room.roster()); if (opt.range) rangeStart();
  net.timer = setInterval(() => room.tick(.05), 50);
}
function leaveNet() { clearTimeout(net.joinTimer); setBusy(false); if (net.ws) { const w = net.ws; net.ws = null; try { w.close(); } catch (e) { } } if (net.timer) clearInterval(net.timer); net.timer = null; net.room = null; net.mode = null; }
const cleanName = n => (String(n || '').replace(/[\p{Cf}\p{Cc}\u3164\u115F\u1160\u2800\uFFA0]/gu, '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14)) || 'Operador';
function setBusy(b) { for (const id of ['#quick', '#create', '#joinBtn']) $(id).disabled = b; }

function onMsg(m) {
  switch (m.t) {
    case 'err': setBusy(false); $('#err').textContent = m.msg; leaveNet(); break;
    case 'joined': {
      setBusy(false); G.code = m.code; G.mapId = m.map; G.pub = m.pub; G.mode = m.gm || 'bomb'; G.cond = m.cond || null; me.id = m.you; me.team = m.team;
      buildWorld(m.map); PCM.setFpTeam(me.team); for (const a of actors) if (a && a.model) scene.remove(a.model.g); actors.length = 0;
      enterGame(); break;
    }
    case 'r': {
      G.roster = m.r; if (m.gm) G.mode = m.gm; if (m.map && m.map !== CURMAP) buildWorld(m.map); if (m.cond) G.cond = m.cond; if (G.state === 'playing') applyCond(G.cond);
      for (const [id, name, team, k, d, as, sc, hum, money, lvl, camo] of m.r) { const a = getActor(id, team); a.camo = camo || null; if (a.model && a.model.setCamo) a.model.setCamo(a.camo); a.name = name; a.human = hum; a.k = k; a.d = d; a.as = as; a.score = sc; a.money = money; a.lvl = lvl | 0; if (id === me.id && team !== me.team) { me.team = team; PCM.setFpTeam(team); } }
      $('#roomCode').textContent = G.code; $('#mapName').textContent = '· ' + MAPS[CURMAP].name + ' · ' + m.r.filter(x => x[7]).length + ' en línea';
      break;
    }
    case 'fix': if (m.p) { me.pos = { x: m.p[0], y: m.p[1], z: m.p[2] }; me.vel = { x: 0, y: 0, z: 0 }; } break;
    case 'p': {
      const prevInv = JSON.stringify(me.inv); me.streak = m.stk | 0;
      me.lvl = m.lvl | 0; me.money = m.m; me.armor = m.ar; me.helmet = !!m.hm; me.kit = !!m.kit; me.inv = m.inv; me.cb = !!m.cb; me.inv = JSON.parse(JSON.stringify(m.inv));
      if (me.inv.p) ensureAmmo(me.inv.p); if (me.inv.s) ensureAmmo(me.inv.s);
      if (m.cur !== me.srvCur) { me.srvCur = m.cur; if (m.cur !== me.cur) setCur(m.cur, false); }
      if (me.cur !== 'knife' && !slotList().includes(me.cur)) setCur(me.inv.p || me.inv.s || 'knife');
      if (prevInv !== JSON.stringify(me.inv)) drawSlots();
      if (!$('#buy').hidden) { const key = me.money + '|' + me.armor + me.helmet + me.kit + JSON.stringify(me.inv); if (key !== drawBuy.key) { drawBuy.key = key; drawBuy(); } }
      break;
    }
    case 's': onSnap(m); break;
    case 'xp': {
      if (!auth.me) break; const prevLvl = prof.lvl; applyMe(m.me);
      if (m.msgs && m.msgs.length) xpPop(m.msgs.join('  '));
      if (m.up) { const unl = PC.CAMOS.filter(c => c.lvl > prevLvl && c.lvl <= prof.lvl).pop(); announce('Subiste a nivel ' + prof.lvl, unl ? 'Desbloqueaste el camuflaje ' + unl.name + '. Elígelo en el menú principal.' : 'Sigue sumando experiencia', 3.2, 'var(--amber)'); sTone(660, .12, .2, 'triangle'); sTone(880, .12, .2, 'triangle', 0, .1); sTone(1180, .22, .2, 'triangle', 0, .2); }
      for (const id of m.done || []) { const c = prof.ch.find(x => x.id === id); if (c) toast('Desafío diario completado: ' + chText(c) + ' · +500'); }
      break;
    }
  }
}
function getActor(id, team) {
  let a = actors[id];
  if (!a) { a = actors[id] = { id, team, name: '—', human: 0, buf: [], alive: false, hp: 100, cur: 'p9', flags: 0, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, h: 1.8, vx: 0, vz: 0, model: null, stepT: 0, deadT: 9, walkPh: 0, seenT: -9, k: 0, d: 0, as: 0, score: 0, lvl: 0 }; }
  if (team !== undefined && a.team !== team) { a.team = team; if (a.model) { scene.remove(a.model.g); a.model = null; } }
  if (!a.model && id !== me.id && (a.team === 0 || a.team === 1)) a.model = makeSoldier(a.team, id);
  return a;
}
function onSnap(m) {
  const t = nowS();
  const prevPhase = G.phase;
  G.phase = m.ph; G.pt = m.pt; G.ptAt = t; G.rd = m.rd; G.sc = m.sc; G.s0 = m.s0; G.bomb = m.b;
  let slotsDirty = false;
  recordSnap(m, t);
  for (const e of m.ev) { handleEvent(e); progressEvent(e); if (e.k === 'bpick' || e.k === 'bdrop' || e.k === 'plant' || e.k === 'round') slotsDirty = true; }
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
    case 'sp': if (e.v === me.id) { me.pos = { x: e.p[0], y: e.p[1], z: e.p[2] }; me.vel = { x: 0, y: 0, z: 0 }; me.yaw = e.y; me.pitch = 0; me.alive = true; me.hp = 100; me.deadT = 0; me.h = 1.8; resetAim(); stopKillcam(); if (G.mode === 'tdm' || G.mode === 'gg') { me.ammo = {}; if (me.inv.p) ensureAmmo(me.inv.p); if (me.inv.s) ensureAmmo(me.inv.s); } } else { const a = actors[e.v]; if (a) a.buf = []; } break;
    case 'round': clearFires(); G.reveal = G.drone = 0; stopKillcam(); refillAmmo(); me.sprayI = 0; announce('Ronda ' + e.n, 'Eres ' + SIDE_L[sideOf(me.team)] + ' · ' + (G.mode === 'elim' ? 'compra y elimina al otro bando' : sideOf(me.team) === 'atk' ? 'compra y después planta la carga en A o B' : 'compra y después defiende los sitios A y B'), 3.2); if (e.n === ROUND.half + 1) toast('Medio tiempo: cambio de bando, ahora eres ' + SIDE_L[sideOf(me.team)]); break;
    case 'half': break;
    case 'live': announce('En marcha', G.mode === 'elim' ? 'Sin carga: gana el bando que elimine al otro' : sideOf(me.team) === 'atk' ? 'Planta la carga en A o B' : 'Que no planten la carga', 1.6); sTone(660, .12, .12, 'square'); break;
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
      if (e.a === me.id && e.v !== me.id) { me.kills++; killSound(!!e.h); }
      if (e.v === me.id) { me.alive = false; me.deadT = 0; me.killer = e.a; me.specIdx = 0; closeBuy(); resetAim(); closeChat(false); toggleWheel(false); startKillcam(e); }
      break;
    }
    case 'plant': { announce('Carga plantada', 'Sitio ' + e.site + ' · 40 segundos', 2.4, 'var(--bad)'); bombBeepT = 0; sTone(880, .15, .2, 'square'); break; }
    case 'planting': { const a = actors[e.v]; if (a) { const p = posAudio(a.pos.x, a.pos.z); if (p.d < 25) sNoise(.3, .25, 1800, 0, p.pan, 4); } break; }
    case 'defusing': { const a = actors[e.v]; if (a) { const p = posAudio(a.pos.x, a.pos.z); if (p.d < 30) { sNoise(.08, .4, 3000, 0, p.pan, 3); sNoise(.08, .4, 2400, .12, p.pan, 3); } } break; }
    case 'defused': announce('Carga desactivada', nameOf(e.v) + ' cortó el cable a tiempo', 2.5, 'var(--t0)'); sTone(520, .2, .2, 'sine', 780); break;
    case 'boom': { const p = { x: e.p[0], y: e.p[1] + 1, z: e.p[2] }; boomLight.position.set(p.x, p.y + 2, p.z); boomLight.intensity = 30; for (let i = 0; i < 6; i++) burst(p, [0, 1, 0], [1, .6, .25], 14, 40); burst(p, [0, 1, 0], [.3, .28, .25], 8, 60); sBoom(posAudio(p.x, p.z).d, true); shake = 1.2; break; }
    case 'boomhe': { const p = { x: e.p[0], y: e.p[1] + .2, z: e.p[2] }; boomLight.position.set(p.x, p.y + 1, p.z); boomLight.intensity = 12; burst(p, [0, 1, 0], [1, .65, .3], 9, 40); burst(p, [0, 1, 0], [.35, .32, .28], 5, 30); const d = posAudio(p.x, p.z).d; sBoom(d, false); if (d < 12) shake = .6 * (1 - d / 12); break; }
    case 'flash': onFlash(e.p); break;
    case 'fire': makeFire(e.id, e.p[0], e.p[1], e.p[2], e.r || 2.6, e.d || 7); break;
    case 'fireout': if (fires.has(e.id)) killFire(e.id, true); else if (e.p) { burst({ x: e.p[0], y: .4, z: e.p[2] }, [0, 1, 0], [.8, .8, .8], 2, 10); } break;
    case 'dshot': decoyShots(e); break;
    case 'smoke': makeSmoke(e.id, e.p[0], e.p[1], e.p[2], e.d); { const p = posAudio(e.p[0], e.p[2]); sNoise(1.8, .25 * clamp(1 - p.d / 40, .05, 1), 900, 0, p.pan, .5); } break;
    case 'throw': { const a = actors[e.s]; if (a && e.s !== me.id && sideOf(a.team) === sideOf(me.team)) { const msg = { he: 'Granada', fl: 'Cegadora', sm: 'Humo', in: 'Incendiaria', de: 'Señuelo' }[e.g]; toast(nameOf(e.s) + ': ¡' + msg + ' va!'); } break; }
    case 'bounce': { const p = posAudio(e.p[0], e.p[2]); if (p.d < 25) sTone(2400 + rand(-300, 300), .04, .12 * (1 - p.d / 25), 'triangle'); break; }
    case 'rend': {
      const mine = e.w === me.team; const why = { elim: 'Eliminaron al bando rival', time: G.mode === 'elim' ? 'Se acabó el tiempo · más jugadores en pie' : 'Se acabó el tiempo', bomb: 'La carga explotó', defuse: 'Desactivaron la carga' }[e.why];
      announce('Ganan los ' + SIDE_L[e.side], TEAMN[e.w] + ' · ' + why, 4, TEAMC[e.w]);
      if (mine) { sTone(523, .18, .18, 'triangle'); sTone(659, .18, .18, 'triangle', 0, .16); sTone(784, .3, .18, 'triangle', 0, .32); } else { sTone(392, .22, .16, 'triangle'); sTone(311, .4, .16, 'triangle', 0, .2); }
      break;
    }
    case 'mend': stopKillcam(); showEnd(e); break;
    case 'chat': if (e.tm === me.team) { addChat(`<b class="t${e.tm}">${esc(nameOf(e.v))}</b>: ${esc(e.m)}`); uiSound(() => sTone(1200, .05, .08, 'triangle')); } break;
    case 'radio': if (e.tm === me.team) { addChat(`<span class="rd">Radio</span><b class="t${e.tm}">${esc(nameOf(e.v))}</b>: ${esc(PC.RADIO[e.c] || '')}`); uiSound(() => sTone(980, .06, .1, 'square')); uiSound(() => sTone(1320, .07, .1, 'square', 0, .08)); const a = actors[e.v]; if (a) a.radioT = nowS(); } break;
    case 'ping': if (e.tm === me.team) addPing(e); break;
    case 'streak': {
      const S = { radar: ['Pulso de radar', 'Enemigos en el radar por 5 segundos'], kit: ['Blindaje y munición', 'Blindaje completo, casco y cargadores llenos'], dron: ['Dron de reconocimiento', 'Enemigos marcados a través de paredes por 12 segundos'] }[e.r] || ['Racha', ''];
      if (e.tm === me.team) {
        if (e.d) { G.reveal = Math.max(G.reveal || 0, nowS() + e.d); if (e.r === 'dron') G.drone = Math.max(G.drone || 0, nowS() + e.d); }
        if (e.v === me.id) { announce('Racha de ' + e.n + ' · ' + S[0], S[1], 2.6, 'var(--amber)'); if (e.r === 'kit') refillAmmo(); sTone(660, .1, .14, 'triangle'); sTone(990, .12, .14, 'triangle', 0, .1); sTone(1320, .2, .12, 'sine', 0, .2); }
        else { toast(nameOf(e.v) + ' consiguió ' + S[0].toLowerCase() + ' (' + e.n + ' bajas)'); uiSound(() => sTone(880, .08, .1, 'triangle')); }
        if (e.r === 'radar' || e.r === 'dron') uiSound(() => { sTone(1400, .25, .08, 'sine', 700); sTone(1400, .25, .06, 'sine', 700, .35); });
      } else if (e.r === 'dron' || e.r === 'radar') toast('El enemigo activó ' + (e.r === 'dron' ? 'un dron: te ven a través de las paredes' : 'un pulso de radar'));
      break;
    }
    case 'tdm': refillAmmo(); announce('Combate por equipos', 'Reapareces a los 3 segundos. Gana el primer equipo en llegar a ' + e.goal + ' bajas.', 3.6); break;
    case 'gg': refillAmmo(); announce('Escalada de armas', 'Cada baja con tu arma te sube de nivel. Gana quien mate con el cuchillo.', 3.6); break;
    case 'lvl': {
      const w = e.w; if (e.v === me.id) { delete me.ammo[w]; ensureAmmo(w); announce('Nivel ' + (e.l + 1) + ' de ' + PC.LADDER.length, w === 'knife' ? 'Último nivel: gana con una baja a cuchillo' : (WEAPONS[w] && WEAPONS[w].name), 1.6, 'var(--amber)'); sTone(700, .08, .15, 'triangle'); sTone(1050, .12, .15, 'triangle', 0, .08); }
      else if (w === 'knife') toast(nameOf(e.v) + ' llegó al cuchillo');
      break;
    }
    case 'demote': if (e.v === me.id) toast('Te apuñalaron: bajas al nivel ' + (e.l + 1)); else if (e.a === me.id) toast('Le quitaste un nivel a ' + nameOf(e.v)); break;
    case 'mstart': $('#end').hidden = true; me.shots = me.hits = me.heads = me.kills = 0; if (e.map && e.map !== CURMAP) { for (const [id, sm] of smokes) scene.remove(sm.g); smokes.clear(); clearFires(); buildWorld(e.map); G.mapId = e.map; } G.cond = e.cond || null; applyCond(G.cond); if (e.map) announce(MAPS[e.map].name + condLabel(G.cond), (e.voted ? 'Elegido por votación' + (G.mode === 'gg' || G.mode === 'tdm' ? '' : ' · ') : '') + (G.mode === 'gg' || G.mode === 'tdm' ? (e.voted ? '' : GM_N[G.mode]) : 'al mejor de 5 rondas'), 3); if (G.cond && G.cond.night) setTimeout(() => toast(isTouch ? 'Es de noche: la linterna se enciende sola' : 'Es de noche: F enciende o apaga la linterna'), 3200); break;
    case 'votes': G.votes = e.v || {}; drawVotes(); break;
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
  const end = new THREE.Vector3(e.e[0], e.e[1], e.e[2]); a.flashT = .05;
  if (!me.alive && !kcActive() && me.deadT > 1.2 && specTarget() === a && vm.spec) { vm.kick = 1; vm.flashT = .05; tracer(vmMuzzleWorld(), end); } else tracer(mw, end);
  if (e.n) { decal(end, e.n); burst(end, e.n, [.62, .55, .45], 2, 4); }
  const p = posAudio(a.pos.x, a.pos.z); const occ = p.d > 3 && !WORLD.visible([camera.position.x, camera.position.y, camera.position.z], [a.pos.x, a.pos.y + 1.4, a.pos.z], []); sShot(w && w.snd, p.d, p.pan, occ);
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
let locked = false, lockFailed = false, lockFails = 0, wantUnlock = false, lastMX = null, lastMY = null;
function uiOpen() { return !$('#buy').hidden || !$('#pause').hidden || !$('#end').hidden || !$('#rangeEnd').hidden; }
function requestLock(gesture) {
  // El navegador solo permite capturar el mouse justo después de un clic o una tecla.
  if (isTouch || locked || uiOpen() || !gesture || lockFailed) return;
  const fail = () => { }; // los fallos se cuentan solo en el evento pointerlockerror
  try {
    const r = canvas.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch(err => { if (err && err.name === 'NotSupportedError') { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(fail); } catch (e) { fail(); } } else fail(); });
  } catch (e) { try { canvas.requestPointerLock(); } catch (_) { fail(); } }
}
function releaseLock() { if (locked && document.exitPointerLock) { wantUnlock = true; document.exitPointerLock(); } }
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (locked) lockFails = 0; $('#app').classList.toggle('locked', locked); if (!locked && G.state === 'playing') { if (wantUnlock) wantUnlock = false; else if (!uiOpen()) openPause(); } });
document.addEventListener('pointerlockerror', () => { lockFails++; if (lockFails >= 3) lockFailed = true; });
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  // En partida: las teclas no activan botones ni atajos del navegador (espacio, enter, retroceso, búsqueda rápida…)
  const menuUp = G.state === 'playing' && (!$('#pause').hidden || !$('#end').hidden || !$('#rangeEnd').hidden);
  if (G.state === 'playing' && !menuUp && !/^F\d+$/.test(e.code) && !(e.ctrlKey || e.metaKey)) e.preventDefault();
  if (menuUp && e.code !== 'Escape') return;
  if (G.state === 'playing' && (e.ctrlKey || e.metaKey || e.altKey)) return;
  if (e.code === 'Tab') { e.preventDefault(); showBoard(true); return; }
  keys[e.code] = true; if (G.state !== 'playing' || e.repeat) return;
  if (wheelOpen && /^Digit[1-8]$/.test(e.code)) { sendRadio(+e.code.slice(5) - 1); return; }
  if (kcActive() && (e.code === 'Space' || e.code === 'Enter')) { stopKillcam(); return; }
  if (e.code === 'KeyZ') { toggleWheel(); return; }
  if (e.code === 'KeyY') { openChat(); return; }
  if (e.code === 'KeyV') { doPing(); return; }
  if (e.code === 'KeyF') { flashOn = !flashOn; sNoise(.03, .2, 3000); return; }
  if (e.code === 'KeyI') { inspect(); return; }
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && RG.on && !RG.chal) { rangeChallenge(); return; }
  if (e.code === 'Escape' && wheelOpen) { toggleWheel(false); return; }
  if (e.code === 'KeyB') { toggleBuy(true); return; }
  if (e.code === 'Escape') { if (!$('#buy').hidden) closeBuy(true); else if (lockFailed || isTouch) openPause(); return; }
  if (!$('#buy').hidden) return;
  if (e.code === 'KeyR') me.reloadReq = true;
  if (e.code === 'Space') { e.preventDefault(); me.jumpReq = true; }
  if (e.code === 'Digit1' && me.inv.p) setCur(me.inv.p);
  if (e.code === 'Digit2' && me.inv.s) setCur(me.inv.s);
  if (e.code === 'Digit3') setCur('knife');
  if (e.code === 'Digit4') cycleNade();
  if (e.code === 'KeyQ') { if (slotList().includes(me.lastCur)) setCur(me.lastCur); }
  if (e.code === 'KeyG') sendMsg({ t: 'drop', bomb: me.cur === 'knife' ? 1 : 0 });
  if (!me.alive && (e.code === 'Space' || e.code === 'KeyD' || e.code === 'KeyA')) me.specIdx++;
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') showBoard(false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; me.fireHeld = me.altHeld = false; me.nadeArm = false; showBoard(false); });
// salir por accidente: confirmar al cerrar o recargar la pestaña, y bloquear el botón Atrás del navegador o del mouse
addEventListener('beforeunload', e => { if (G.state === 'playing') { e.preventDefault(); e.returnValue = ''; return ''; } });
addEventListener('popstate', () => { if (G.state === 'playing') { try { history.pushState({ pc: 1 }, '', location.href); } catch (_) { } openPause(); toast('Para salir usa «Salir de la sala» en el menú'); } });
for (const ev of ['mousedown', 'mouseup', 'auxclick']) addEventListener(ev, e => { if (e.button === 3 || e.button === 4) { e.preventDefault(); e.stopPropagation(); } }, true);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => { if (G.state === 'playing') e.preventDefault(); });
function blurUI() { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }
function confirmBtn(el, label, fn) {
  let armed = 0; const orig = el.textContent;
  el.addEventListener('click', () => { if (Date.now() - armed < 3500) { armed = 0; el.textContent = orig; fn(); } else { armed = Date.now(); el.textContent = label; setTimeout(() => { if (armed && Date.now() - armed >= 3400) { armed = 0; el.textContent = orig; } }, 3500); } });
}
function cycleNade() { const l = NADE_IDS.filter(k => me.inv.n[k] > 0); if (!l.length) return; const i = l.indexOf(me.cur); setCur(l[(i + 1) % l.length]); }
addEventListener('wheel', e => { if (G.state !== 'playing' || uiOpen() || !me.alive) return; const l = slotList(); const i = l.indexOf(me.cur); setCur(l[(i + (e.deltaY > 0 ? 1 : -1) + l.length) % l.length]); }, { passive: true });
addEventListener('mousemove', e => {
  if (G.state !== 'playing' || isTouch || uiOpen()) return;
  if (locked) { look.dx += e.movementX * .0021; look.dy += e.movementY * .0021; }
  else if (lockFailed) { if (lastMX !== null) { look.dx += (e.clientX - lastMX) * .0035; look.dy += (e.clientY - lastMY) * .0035; } lastMX = e.clientX; lastMY = e.clientY; }
});
canvas.addEventListener('mousedown', e => {
  if (G.state !== 'playing' || isTouch) return; initAudio();
  if (!locked && !lockFailed) { requestLock(true); return; }
  if (kcActive()) { stopKillcam(); return; }
  if (!me.alive) { me.specIdx++; return; }
  if (e.button === 1) { e.preventDefault(); doPing(); return; }
  if (kcActive()) { stopKillcam(); return; }
  if (wheelOpen) { toggleWheel(false); return; }
  if (e.button === 0) me.fireHeld = true; if (e.button === 2) { me.altHeld = true; onAlt(); }
});
addEventListener('mouseup', e => { if (isTouch) return; if (e.button === 0) me.fireHeld = false; if (e.button === 2) me.altHeld = false; });
addEventListener('contextmenu', e => e.preventDefault());
function onAlt() { const w = WEAPONS[me.cur]; if (!me.alive || !w || w.melee) return; if (w.scope) { if (me.drawT <= 0 && me.reloadT <= 0) { me.scoped = !me.scoped; me.altScope = false; if (me.scoped) { sNoise(.06, .2, 2600, 0, 0, 3); sTone(1900, .05, .05, 'sine', 2400, .03); } else { sNoise(.05, .16, 1800, 0, 0, 3); } } } }
function canAds() { const w = WEAPONS[me.cur]; return !!(w && !w.melee && !w.scope && vm.cur && vm.cur.ads); }

// táctil
const TL = $('#touch'), joyEl = $('#joy'), knob = joyEl.firstElementChild; const joy = { id: null, ox: 0, oy: 0, vx: 0, vy: 0, mag: 0 };
const lookPtr = new Map(), firePtrs = new Set();
TL.addEventListener('pointerdown', e => {
  if (e.target !== TL) return; e.preventDefault(); initAudio();
  if (kcActive()) { stopKillcam(); return; }
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
tapBtn($('#bAds'), el => { const w = WEAPONS[me.cur]; if (w && w.scope) onAlt(); else if (canAds()) { me.adsToggle = !me.adsToggle; } el.classList.toggle('on', !!(me.scoped || me.adsToggle)); });
tapBtn($('#bReload'), () => { me.reloadReq = true; });
tapBtn($('#bInsp'), () => inspect());
tapBtn($('#bJump'), () => { me.jumpReq = true; });
tapBtn($('#bCrouch'), el => { me.crouchToggle = !me.crouchToggle; el.classList.toggle('on', me.crouchToggle); });
tapBtn($('#bWeap'), () => { const l = slotList().filter(x => !NADES[x]); const i = l.indexOf(me.cur); setCur(l[(i + 1) % l.length] || 'knife'); });
tapBtn($('#bNade'), () => cycleNade());
tapBtn($('#bAct'), el => { me.act = true; el.classList.add('on'); }, el => { me.act = false; el.classList.remove('on'); });
tapBtn($('#bBuy'), () => toggleBuy());
$('#bBoard').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); showBoard(true); });
$('#bBoard').addEventListener('pointerup', () => showBoard(false)); $('#bBoard').addEventListener('pointercancel', () => showBoard(false));
tapBtn($('#bPause'), () => openPause());
tapBtn($('#bRadio'), () => toggleWheel());
tapBtn($('#bPing'), () => doPing());
tapBtn($('#bChat'), () => openChat());

/* ================= JUGADOR LOCAL ================= */
let shake = 0, flashT = 0, bombBeepT = 0;
function pattern(w, i) {
  if (!w.auto) return { p: w.kick * Math.min(i, 4) * .55, y: 0 };
  const up = w.kick * 9 * (1 - Math.exp(-i / 4.5)); const side = i < 7 ? i * .12 * w.kick : Math.sin((i - 7) * .5) * w.kick * 3.4;
  return { p: up, y: side };
}
function frozenAds() { return !me.alive || !$('#buy').hidden; }
function inaccuracy(w) {
  const spd = Math.hypot(me.vel.x, me.vel.z); const max = w.speed || 4.6; const mf = clamp((spd - max * .34) / (max * .5), 0, 1);
  let base = me.crouch ? w.crouch : w.stand; if (w.scope) base = me.scoped && me.scopeK > .9 ? w.scoped : w.stand;
  const ak = me.adsK || 0;
  return base * (1 - .4 * ak) + w.run * mf * (1 - .2 * ak) + (!me.grounded ? w.jump : 0) + (w.auto ? 0 : Math.min(me.sprayI, 5) * w.kick * .08);
}
function resetAim() { me.scoped = false; me.altScope = false; me.rescopeT = 0; me.scopeK = 0; me.adsK = 0; me.adsToggle = false; me.nadeArm = false; me.fireHeld = false; me.altHeld = false; $('#bAds').classList.remove('on'); }
function canAct() { return me.alive && G.phase !== 'buy' && $('#buy').hidden && !chatOpen; }
function updateLocal(dt) {
  if (!me.alive) { me.deadT += dt; return; }
  const frozen = G.phase === 'buy' || !$('#pause').hidden || !$('#end').hidden || !$('#rangeEnd').hidden;
  // mirar
  const s = prefs.sens * (camera.fov / 74);
  me.yaw -= look.dx * s; me.pitch -= look.dy * s; vm.swX = lerp(vm.swX || 0, clamp(look.dx * 4, -.6, .6), .35); vm.swY = lerp(vm.swY || 0, clamp(look.dy * 4, -.6, .6), .35); look.dx = look.dy = 0; me.pitch = clamp(me.pitch, -1.5, 1.5);
  // mover
  let fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - joy.vy; let st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.vx;
  const L = Math.hypot(fw, st); if (L > 1) { fw /= L; st /= L; }
  me.crouch = !!(keys.KeyC || me.crouchToggle);
  me.walkHeld = !!(keys.ShiftLeft || keys.ShiftRight) || (isTouch && joy.mag > 0 && joy.mag < .55);
  const w = WEAPONS[me.cur] || WEAPONS.knife; let sp = NADES[me.cur] ? 5.0 : w.speed; if (w.scope && me.scoped) sp *= .45;
  const wantAds = canAds() && (me.altHeld || me.adsToggle) && me.reloadT <= 0 && me.drawT <= 0 && !frozenAds();
  if (wantAds !== !!me.wasAds) { me.wasAds = wantAds; if (wantAds) { sNoise(.07, .16, 900, 0, 0, .9); sTone(210, .05, .07, 'triangle'); } else sNoise(.05, .1, 700, 0, 0, .9); }
  me.adsK = lerp(me.adsK || 0, wantAds ? 1 : 0, 1 - Math.exp(-dt * (wantAds ? 16 : 20))); if (!canAds()) { me.adsK = 0; me.adsToggle = false; }
  sp *= 1 - .3 * me.adsK;
  if (me.crouch) sp *= .34; else if (me.walkHeld) sp *= .52;
  if (frozen) sp = 0;
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  const tx = (-sy * fw + cy * st) * sp, tz = (-cy * fw - sy * st) * sp;
  const acc = me.grounded ? 15 : 2; me.vel.x = lerp(me.vel.x, tx, 1 - Math.exp(-acc * dt)); me.vel.z = lerp(me.vel.z, tz, 1 - Math.exp(-acc * dt));
  if (me.jumpReq && me.grounded && !frozen) { me.vel.y = 5.2; me.grounded = false; } me.jumpReq = false;
  me.h = lerp(me.h, me.crouch ? 1.22 : 1.8, 1 - Math.exp(-dt * 12));
  const fallV = me.vel.y, wasG = me.grounded;
  WORLD.moveActor(me, dt);
  if (!wasG && me.grounded && fallV < -3) { me.landT = clamp(-fallV / 9, .2, .8); sStep(.25); }
  me.landT = Math.max(0, (me.landT || 0) - dt * 3);
  const lat = me.vel.x * Math.cos(me.yaw) - me.vel.z * Math.sin(me.yaw); me.roll = lerp(me.roll || 0, -lat * .006, 1 - Math.exp(-dt * 8));
  const spd = Math.hypot(me.vel.x, me.vel.z);
  if (me.grounded && spd > 1 && !me.walkHeld && !me.crouch) { me.stepT -= dt * spd; if (me.stepT <= 0) { me.stepT = 2.3; sStep(.12); } }
  vm.bobT += dt * spd * 1.3;
  // acción (plantar / desactivar)
  if ($('#bAct').hidden) $('#bAct').classList.remove('on');
  me.act = keys.KeyE || $('#bAct').classList.contains('on');
  // armas
  me.drawT = Math.max(0, me.drawT - dt);
  me.scopeK = lerp(me.scopeK, me.scoped ? 1 : 0, 1 - Math.exp(-dt * 16));
  if (me.rescopeT > 0) { me.rescopeT -= dt; if (me.rescopeT <= 0 && me.altScope) { me.altScope = false; const ww = WEAPONS[me.cur]; if (ww && ww.scope && me.alive && me.reloadT <= 0) me.scoped = true; } }
  const T = nowS();
  if (me.reloadReq && w.mag && me.reloadT <= 0) { const am = me.ammo[me.cur]; if (am && am.mag < w.mag && am.res > 0) { me.reloadT = w.reload; me.scoped = false; me.altScope = false; sReload(w); sendMsg({ t: 'rl' }); } }
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
  const o = [camera.position.x, camera.position.y, camera.position.z]; const mw = vmMuzzleWorld();
  const n = w.pellets || 1; const pel = []; let main = null; let anyRange = false;
  for (let i = 0; i < n; i++) {
    const d = aimDir(pat.p, pat.y, inaccuracy(w) + (w.pellets ? w.spreadP * Math.sqrt(Math.random()) : 0));
    const r = traceShot(o, d, 200);
    const rh = RG.on ? rangeHit(o, d, r.t) : null; if (rh) { r.t = rh.t; r.wt = { t: rh.t, n: null }; r.hit = null; }
    const end = new THREE.Vector3(o[0] + d[0] * r.t, o[1] + d[1] * r.t, o[2] + d[2] * r.t);
    if (i < 3) tracer(mw, end);
    if (rh) { rangeOnHit(rh, end); anyRange = true; }
    if (r.hit) burst(end, [-d[0], -d[1], -d[2]], [.5, .06, .04], 2.2, 6);
    else if (r.wt.n) { decal(end, r.wt.n); burst(end, r.wt.n, [.62, .55, .45], 2.2, w.pellets ? 2 : 5); if (Math.random() < .5) sparks(end, r.wt.n, w.pellets ? 1 : 3); }
    const rec = { d: d.map(v => +v.toFixed(4)), tt: +r.t.toFixed(2), hit: r.hit ? r.hit.id : null, z: r.zone, n: r.wt.n };
    pel.push(rec); if (!main) main = rec;
  }
  if (RG.chal) { RG.shots++; if (anyRange) RG.hits++; }
  const msg = Object.assign({ t: 'shot', w: me.cur, o: o.map(v => +v.toFixed(3)) }, main); if (w.pellets) msg.pel = pel;
  sendMsg(msg);
  vm.kick = 1; vm.flashT = .05; worldFlash.position.copy(mw); worldFlash.intensity = 2; sShot(w.snd, 0, 0);
  if (prefs.gfx === 'high') { if (!w.pellets || Math.random() < .5) ejectCasing(!!w.pellets); if (Math.random() < .6) muzzlePuff(mw); }
  me.recoilJolt = Math.min(1, (me.recoilJolt || 0) + (w.auto ? .25 : .7));
  if (w.scope && me.scoped) { me.scoped = false; me.altScope = true; me.rescopeT = 1.2; }
}
function inspect() { if (!me.alive || !vm.cur || me.reloadT > 0 || me.drawT > 0 || (me.adsK || 0) > .1 || me.scoped || vm.inspT > 0) return; vm.inspT = INSP; sNoise(.05, .14, 2400, .1, 0, 3); sNoise(.05, .12, 1700, .9, 0, 3); sTone(260, .05, .05, 'triangle', 0, 1.6); }
function knife(heavy) {
  me.lastShot = nowS(); vm.inspT = 0; if (heavy) vm.stab = 1; else { vm.slash = 1; vm.slashSide = -(vm.slashSide || 1); }
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

/* ---------- Trayectoria de granada ---------- */
const arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3));
const arcLine = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0xf2b33d, dashSize: .25, gapSize: .15, transparent: true, opacity: .9, depthTest: false })); arcLine.frustumCulled = false; arcLine.visible = false; arcLine.renderOrder = 5; scene.add(arcLine);
const arcDots = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: 0xffd27a, size: .09, transparent: true, opacity: .95, depthTest: false })); arcDots.frustumCulled = false; arcDots.renderOrder = 5; arcLine.add(arcDots);
const arcRing = new THREE.Mesh(new THREE.RingGeometry(.32, .42, 28), new THREE.MeshBasicMaterial({ color: 0xf2b33d, transparent: true, opacity: .9, side: THREE.DoubleSide, depthTest: false })); arcRing.rotation.x = -Math.PI / 2; arcRing.visible = false; arcRing.renderOrder = 6; scene.add(arcRing);
function updateArc() {
  const k = me.cur; const show = me.alive && NADES[k] && me.nadeArm && WORLD;
  arcLine.visible = arcRing.visible = !!show; if (!show) return;
  const lob = me.nadeArm === 'lob'; const d = aimDir(0, 0, 0); const sp = lob ? 7.5 : 15;
  let p = { x: camera.position.x, y: camera.position.y - .1, z: camera.position.z }; const v = { x: d[0] * sp + me.vel.x * .6, y: d[1] * sp + 2.2, z: d[2] * sp + me.vel.z * .6 };
  const C = WORLD.colliders; const inside = (x, y, z) => C.some(b => x > b.minX - .06 && x < b.maxX + .06 && y > b.minY - .06 && y < b.maxY + .06 && z > b.minZ - .06 && z < b.maxZ + .06);
  const arr = arcGeo.attributes.position.array; let n = 0; const h = .05 / 3; let t = 0;
  arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z; n++;
  while (n < 160 && t < (k === 'sm' ? 3.5 : 1.6)) {
    for (let s2 = 0; s2 < 3; s2++) {
      v.y -= 14 * h; const np = { x: p.x + v.x * h, y: p.y + v.y * h, z: p.z + v.z * h };
      if (inside(np.x, p.y, p.z)) { v.x *= -.45; np.x = p.x; } if (inside(np.x, p.y, np.z)) { v.z *= -.45; np.z = p.z; }
      if (inside(np.x, np.y, np.z)) { v.y *= -.35; np.y = p.y; v.x *= .7; v.z *= .7; }
      if (np.y < .08) { np.y = .08; v.y = Math.abs(v.y) > 1.5 ? -v.y * .35 : 0; v.x *= .72; v.z *= .72; }
      p = np;
    }
    t += .05; arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z; n++;
    if (k === 'sm' && t > 1.2 && Math.hypot(v.x, v.y, v.z) < .8) break;
  }
  arcGeo.setDrawRange(0, n); arcGeo.attributes.position.needsUpdate = true; arcLine.computeLineDistances();
  arcRing.position.set(p.x, WORLD.groundAt(p.x, p.z, p.y + .3) + .03, p.z); const r = k === 'sm' ? 3.4 : k === 'in' ? 2.6 : k === 'he' ? 1.6 : 1; arcRing.scale.setScalar(r);
}

/* ================= REMOTOS ================= */
const INTERP = .11;
function updateRemotes(dt) {
  if (kcActive()) { kcRender(dt); return; }
  if (meModel) meModel.g.visible = false;
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
    const spd = Math.hypot(a.vx, a.vz); a.walkPh += dt * spd * 2.2; const cr = clamp((1.8 - a.h) / .58, 0, 1);
    m.animate(spd, a.walkPh, cr, a.pitch);
    setModelGun(m, a.cur); m.setHelmet(!!(a.flags & 128)); m.pack.visible = !!(a.flags & 4);
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
  const l = slotList(); const lbl = { knife: 'Cuchillo', he: 'Granada HE', fl: 'Cegadora', sm: 'Humo', in: 'Incendiaria', de: 'Señuelo' };
  $('#slots').innerHTML = l.map(w => { const key = w === me.inv.p ? 1 : w === me.inv.s ? 2 : w === 'knife' ? 3 : 4; const n = NADES[w] ? ' ×' + me.inv.n[w] : ''; return `<div class="slot${w === me.cur ? ' cur' : ''}"><span>${esc((WEAPONS[w] && WEAPONS[w].name) || lbl[w])}${n}</span><kbd>${key}</kbd></div>`; }).join('') + ((G.bomb[0] === 'carried' && G.bomb[4] === me.id) ? '<div class="slot"><span class="bombTag">CARGA</span><kbd>E</kbd></div>' : '');
}
const radar = $('#radar'), rctx = radar.getContext('2d');
let radarT = 1;
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
  rctx.fillStyle = TEAMC[1 - me.team]; for (const b of fakeBlips) { rctx.beginPath(); rctx.arc(b.x, b.z, 1.1, 0, 7); rctx.fill(); }
  for (const a of actors) {
    if (!a || a.id === me.id || !a.alive) continue; const mate = a.team === me.team;
    if (!mate && t - a.seenT > 1.6 && !(a.flags & 1) && !(G.reveal > t)) continue;
    rctx.fillStyle = TEAMC[a.team]; rctx.beginPath(); rctx.arc(a.pos.x, a.pos.z, 1.1, 0, 7); rctx.fill();
    if (mate) { rctx.strokeStyle = TEAMC[a.team]; rctx.lineWidth = .4; rctx.beginPath(); rctx.moveTo(a.pos.x, a.pos.z); rctx.lineTo(a.pos.x - Math.sin(a.yaw) * 2.4, a.pos.z - Math.cos(a.yaw) * 2.4); rctx.stroke(); }
    if (mate && (a.flags & 4)) { rctx.fillStyle = '#f2b33d'; rctx.fillRect(a.pos.x - .5, a.pos.z + 1.3, 1, .7); }
  }
  rctx.restore();
  rctx.save(); rctx.translate(S, S); rctx.rotate(yaw); rctx.scale(sc, sc); rctx.translate(-cx, -cz);
  for (const pg of pings) { const q = pingPos(pg); rctx.fillStyle = pg.e >= 0 ? '#ff4d3a' : '#f2b33d'; rctx.save(); rctx.translate(q.x, q.z); rctx.rotate(Math.PI / 4); rctx.fillRect(-1.1, -1.1, 2.2, 2.2); rctx.restore(); }
  for (const a of actors) if (a && a.alive && a.team === me.team && a.radioT && nowS() - a.radioT < 2) { rctx.strokeStyle = '#f2b33d'; rctx.lineWidth = .5; rctx.beginPath(); rctx.arc(a.pos.x, a.pos.z, 2.2 + (nowS() - a.radioT) * 1.5, 0, 7); rctx.stroke(); }
  rctx.restore();
  rctx.save(); rctx.translate(S, S); rctx.fillStyle = '#f2f0e8'; rctx.beginPath(); rctx.moveTo(0, -8); rctx.lineTo(5.5, 6); rctx.lineTo(0, 2.5); rctx.lineTo(-5.5, 6); rctx.closePath(); rctx.fill(); rctx.restore();
}
const _p = new THREE.Vector3(); let tagEls = new Map(); let spotT = 0;
function updateHUD(dt) {
  const t = nowS();
  // barra superior
  const s0 = G.s0, s1 = s0 === 'atk' ? 'def' : 'atk';
  setTxt('#sc0', G.sc[0]); setTxt('#sc1', G.sc[1]); setTxt('#role0', SIDE_N[s0]); setTxt('#role1', SIDE_N[s1]);
  for (const tm of [0, 1]) { const el = $('#pips' + tm); const list = actors.filter(a => a && a.team === tm); const html = list.map(a => `<i class="${a.alive ? '' : 'dead'}${a.id === me.id ? ' me' : ''}"></i>`).join(''); if (el._h !== html) { el.innerHTML = html; el._h = html; } }
  const left = Math.max(0, G.pt - (t - (G.ptAt || t))); const tm = $('#timer');
  if (RG.on) { }
  else if (G.bomb[0] === 'planted') { setTxt('#timer', 'CARGA'); setCls('#timer', 'bomb'); }
  else { setTxt('#timer', Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0')); setCls('#timer', G.phase === 'buy' ? 'buy' : ''); }
  if (RG.on) { }
  else if (G.mode === 'gg') { const lead = actors.filter(Boolean).sort((p, q) => (q.lvl - p.lvl) || (q.k - p.k))[0]; setTxt('#rlabel', G.phase === 'over' ? 'Fin de la escalada' : (lead ? 'Líder: ' + lead.name + ' · nivel ' + (lead.lvl + 1) : 'Escalada')); }
  else if (G.mode === 'tdm') setTxt('#rlabel', G.phase === 'over' ? 'Fin del combate' : 'Combate · meta ' + PC.TDM.goal + ' bajas');
  else setTxt('#rlabel', G.phase === 'buy' ? 'Compra · ronda ' + G.rd : G.phase === 'over' ? 'Fin de partida' : 'Ronda ' + G.rd + ' de ' + ROUND.total);
  if (G.mode === 'gg') { setTxt('#role0', 'Halcón'); setTxt('#role1', 'Cobra'); }
  // vitales
  const hp = Math.max(0, me.hp); setTxt('#hpN', String(me.alive ? hp : 0)); setCls('#hpN', hp <= 25 ? 'low' : '');
  setTxt('#arN', me.armor); setTxt('#arL', me.helmet ? 'Blind. + casco' : 'Blindaje');
  if (RG.on) { setTxt('#timer', RG.chal ? Math.max(0, Math.ceil(RG.endT - nowS())) + ' s' : 'LIBRE'); setCls('#timer', RG.chal && RG.endT - nowS() < 10 ? 'bomb' : ''); setTxt('#rlabel', RG.chal ? 'Desafío · ' + RG.score.toLocaleString('es-CL') + ' pts · ' + RG.kills + ' blancos' : 'Campo de tiro · práctica libre'); const rb = $('#rangeBtn'), hideB = RG.chal || !$('#rangeEnd').hidden; if (rb.hidden !== hideB) rb.hidden = hideB; }
  const gg = G.mode === 'gg'; $('#money').hidden = gg || G.mode === 'tdm' || G.mode === 'range'; $('#ggBox').hidden = !gg;
  { const sk = me.streak | 0, sb = $('#streakBox'), next = [3, 5, 7].find(n => n > sk); const show = !gg && me.alive && sk > 0 && G.mode !== 'range'; if (sb.hidden === show) sb.hidden = !show;
    if (show) setHtml('#streakBox', `Racha <b>${sk}</b>` + (next ? ` · ${next - sk} para ${{ 3: 'radar', 5: 'blindaje', 7: 'dron' }[next]}` : ' · ¡dron listo!')); }
  if (gg) { const lv = me.lvl | 0, nx = PC.LADDER[lv + 1]; const txt = `<b>Nivel ${lv + 1}</b> de ${PC.LADDER.length} · ${esc((WEAPONS[PC.LADDER[lv]] || {}).name || '')}${nx ? `<span>Siguiente: ${esc(WEAPONS[nx].name)}</span>` : '<span>¡Gana con una baja a cuchillo!</span>'}`; if ($('#ggBox')._t !== txt) { setHtml('#ggBox', txt); $('#ggBox')._t = txt; } }
  else setHtml('#money', '$' + me.money + '<small>' + (me.cb ? 'compra con B' : 'en mano') + '</small>');
  const w = WEAPONS[me.cur]; const am = me.ammo[me.cur];
  if (w && !w.melee && am) { setTxt('#ammoN', am.mag); setCls('#ammoN', am.mag <= w.mag * .25 ? 'low' : ''); setTxt('#ammoR', '/ ' + am.res); }
  else if (NADES[me.cur]) { setTxt('#ammoN', me.inv.n[me.cur]); setCls('#ammoN', ''); setTxt('#ammoR', NADES[me.cur].name + (isTouch ? ' · mantén Fuego y suelta' : ' · clic: lejos · clic der.: corto')); }
  else { setTxt('#ammoN', '—'); setCls('#ammoN', ''); setTxt('#ammoR', 'Cuchillo'); }
  $('#reloadBar').style.opacity = me.reloadT > 0 ? 1 : 0; if (me.reloadT > 0 && w) $('#rbar').style.width = (1 - me.reloadT / w.reload) * 100 + '%';
  // mira
  const xh = $('#xh'); const scoped = me.alive && me.scopeK > .5 && !!(w && w.scope);
  $('#scope').classList.toggle('on', scoped); if (me.alive) vm.group.visible = !scoped;
  const hideXh = !me.alive || scoped || (w && w.scope) || NADES[me.cur] || (me.adsK || 0) > .35; xh.style.opacity = hideXh ? 0 : 1;
  if (w && !hideXh) { const inacc = inaccuracy(w); const gap = 3 + inacc * (innerHeight / 2) / Math.tan(camera.fov * Math.PI / 360) * .9 + me.sprayI * .6; xh.children[0].style.top = (-gap - 7) + 'px'; xh.children[1].style.top = gap + 'px'; xh.children[2].style.left = (-gap - 7) + 'px'; xh.children[3].style.left = gap + 'px'; }
  // punto central al apuntar: referencia de tiro siempre visible, también con miras de hierro
  $('#adsDot').style.opacity = me.alive && (me.adsK || 0) > .6 && !(w && w.scope) ? 1 : 0;
  if (hitT > 0) { hitT -= dt; $('#hit').style.opacity = clamp(hitT / .1, 0, 1); } else $('#hit').style.opacity = 0;
  $('#vign').style.opacity = me.alive && t - (me.lastHurt || 0) < .5 ? .7 : me.alive && hp < 30 ? .45 : 0;
  flashT = Math.max(0, flashT - dt); $('#flashOv').style.opacity = clamp(flashT / 1.2, 0, 1);
  for (let i = dmgDirs.length - 1; i >= 0; i--) { const d = dmgDirs[i]; d.life -= dt; if (d.life <= 0) { d.el.remove(); dmgDirs.splice(i, 1); continue; } const ang = Math.atan2(-(d.src.x - me.pos.x), -(d.src.z - me.pos.z)); d.el.style.transform = `rotate(${-angDiff(me.yaw, ang)}rad)`; d.el.style.opacity = Math.min(1, d.life); }
  if (annT > 0) { annT -= dt; if (annT <= 0) $('#announce').classList.remove('on'); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on'); }
  $('#clickPlay').hidden = isTouch || locked || lockFailed || uiOpen() || G.state !== 'playing';
  // pista de acción
  const B = G.bomb; let hint = '', prog = 0; const mySide = sideOf(me.team); const site = WORLD && me.alive ? siteAt(me.pos.x, me.pos.z) : null;
  const myA = actors[me.id];
  if (me.alive && mySide === 'atk' && B[0] === 'carried' && B[4] === me.id) { if (site && G.phase === 'live') { hint = myA && (myA.flags & 8) ? 'Plantando la carga… no te muevas' : 'Mantén E para plantar en ' + site; prog = B[6]; } }
  if (me.alive && mySide === 'def' && B[0] === 'planted' && Math.hypot(me.pos.x - B[1], me.pos.z - B[3]) < 1.7) { hint = myA && (myA.flags & 8) ? (me.kit ? 'Desactivando con kit…' : 'Desactivando… (10 s sin kit)') : 'Mantén E para desactivar'; prog = B[7]; }
  $('#hint').hidden = !hint; if (hint) { setTxt('#hintT', hint); $('#hintBar').style.width = clamp(prog, 0, 1) * 100 + '%'; }
  $('#bAct').hidden = !(isTouch && hint); $('#bBuy').hidden = !(isTouch && me.cb);
  $('#bAds').hidden = !(isTouch && w && (w.scope || canAds()));
  $('#bNade').hidden = !(isTouch && me.alive && (me.inv.n.he + me.inv.n.fl + me.inv.n.sm) > 0);
  // zona
  setTxt('#zoneTag', site ? 'Sitio ' + site : (me.cb ? 'Zona de compra' : ''));
  // espectador
  const kcOn = kcActive(); $('#killcam').hidden = !kcOn;
  if (kcOn) { const k = actors[kc.killer]; const txt = (k ? k.name : '—') + '|' + kc.w; if ($('#killcam')._t !== txt) { $('#killcam')._t = txt; setTxt('#kcName', k ? k.name : '—'); setCls('#kcName', k ? 't' + k.team : ''); setTxt('#kcInfo', (WEAPONS[kc.w] ? WEAPONS[kc.w].name : kc.w === 'he' ? 'Granada HE' : kc.w === 'in' ? 'Incendiaria' : 'Carga') + (kc.h ? ' · a la cabeza' : '') + ' · ' + kc.dist + ' m' + (kc.hp != null ? ' · le quedó ' + kc.hp + ' de vida' : '')); } $('#kcBar').style.width = clamp(kc.phase === 'eyes' ? (kc.rt - kc.from) / kc.len * .8 : .8 + kc.orbitT / kc.orbitLen * .2, 0, 1) * 100 + '%'; }
  const sp = $('#spec'); if (kcOn) sp.hidden = true; else if (!me.alive && (G.mode === 'gg' || G.mode === 'tdm')) { sp.hidden = false; setTxt('#specName', 'Reapareces en un momento'); setCls('#specName', ''); setTxt('#specHint', 'Te toca ' + ((WEAPONS[PC.LADDER[me.lvl | 0]] || {}).name || '')); } else if (!me.alive && me.deadT > 1.2) { const tg = specTarget(); sp.hidden = false; setTxt('#specName', tg ? tg.name + ' · ' + Math.max(0, tg.hp | 0) + ' de vida' : 'Nadie en pie'); setCls('#specName', tg ? 't' + tg.team : ''); setTxt('#specHint', (tg && WEAPONS[tg.cur] ? WEAPONS[tg.cur].name + ' · ' : '') + (isTouch ? 'toca para cambiar de compañero' : 'clic para cambiar de compañero')); } else sp.hidden = true;
  // enemigos vistos (radar) y nombres
  spotT -= dt; if (spotT <= 0 && me.alive) { spotT = .15; const o = [camera.position.x, camera.position.y, camera.position.z]; const sl = smokeList(); for (const a of actors) { if (!a || !a.alive || a.team === me.team || a.id === me.id) continue; if (WORLD.visible(o, [a.pos.x, a.pos.y + a.h * .7, a.pos.z], sl)) a.seenT = t; } }
  const aim = aimedEnemy();
  for (const a of actors) {
    if (!a || a.id === me.id) continue; let el = tagEls.get(a.id); if (!el) { el = document.createElement('div'); el.className = 'tag'; $('#tags').appendChild(el); tagEls.set(a.id, el); }
    const droned = G.drone > t && a.team !== me.team;
    let show = a.alive && (a.team === me.team || a === aim || droned) && !(!me.alive && specTarget() === a);
    el.classList.toggle('dron', droned && a !== aim);
    if (show) { _p.set(a.pos.x, a.pos.y + a.h + .3, a.pos.z).project(camera); if (_p.z > 1 || _p.z < -1) show = false; else { el.style.transform = `translate(${(_p.x * .5 + .5) * innerWidth}px,${(-_p.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; const txt = a.name + (a.flags & 4 ? ' ◆' : ''); if (el._t !== txt) { el.textContent = txt; el._t = txt; } el.style.color = TEAMC[a.team]; } }
    el.style.display = show ? 'block' : 'none';
  }
  drawPings(t);
  if (!$('#buy').hidden) { setTxt('#buyMoney', '$' + me.money); setTxt('#buyTime', G.phase === 'buy' ? 'Tiempo de compra: ' + Math.ceil(left) + ' s' : ''); if (!me.cb) closeBuy(); }
  if (!$('#end').hidden) { const lead = voteLeader(); const nm = lead || G.nextMap; setTxt('#endCount', (nm && MAPS[nm] ? 'Próximo mapa: ' + MAPS[nm].name + (lead ? ' (más votado)' : ' (rotación)') + ' · ' : 'Nueva partida ') + 'en ' + Math.ceil(left) + ' s'); }
}
function siteAt(x, z) { const S = WORLD.map.sites; for (const k in S) if (PC.inRect(S[k].r, x, z)) return k; return null; }
function aimedEnemy() { if (!me.alive) return null; const o = [camera.position.x, camera.position.y, camera.position.z]; const d = aimDir(me.punchP, 0, 0); const r = traceShot(o, d, 120); return r.hit; }

/* ---------- Compra ---------- */
const BUY = [
  ['Pistolas', ['p9', 'ap18', 'r50']], ['Subfusiles y pesadas', ['smg', 'es12', 'lmg']], ['Fusiles', ['fr9', 'ar', 'tr7', 'sr']], ['Equipo', ['kevlar', 'helm', 'kit']], ['Granadas', NADE_IDS]
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
$('#bcols').addEventListener('click', e => { const b = e.target.closest('.bi'); if (b) b.blur(); if (!b || b.getAttribute('aria-disabled') === 'true') return; sendMsg({ t: 'buy', i: b.dataset.i }); sNoise(.06, .3, 1800); });
function toggleBuy(gesture) { if (!$('#buy').hidden) closeBuy(gesture); else if (me.cb && me.alive) { drawBuy(); $('#buy').hidden = false; releaseLock(); me.fireHeld = false; } else toast(G.phase === 'buy' || G.phase === 'live' ? 'Solo puedes comprar en tu zona de inicio al comienzo de la ronda' : 'La compra abre al empezar la ronda'); }
function closeBuy(gesture) { if ($('#buy').hidden) return; $('#buy').hidden = true; blurUI(); if (G.state === 'playing' && $('#pause').hidden) requestLock(gesture); }
$('#buy').addEventListener('pointerdown', e => { if (e.target === $('#buy')) closeBuy(true); });

/* ---------- Marcador y final ---------- */
function teamTable(tm) {
  const list = actors.filter(a => a && a.team === tm).sort((x, y) => y.score - x.score); const mine = tm === me.team;
  const gg = G.mode === 'gg'; if (gg) list.sort((x, y) => (y.lvl - x.lvl) || (y.k - x.k));
  const extraH = gg ? '<th>Nivel</th>' : mine ? '<th>$</th>' : '';
  return `<table><caption class="t${tm}">${TEAMN[tm]} · ${G.sc[tm]} <span style="color:var(--dim);font-size:13px">${gg || G.mode === 'tdm' ? 'bajas' : SIDE_N[sideOf(tm)]}</span></caption><tr><th>Jugador</th>${extraH}<th>B</th><th>A</th><th>M</th><th>Pts</th></tr>` +
    list.map(a => `<tr class="${a.id === me.id ? 'me' : ''}${a.alive ? '' : ' dead'}"><td>${esc(a.name)}${a.human ? '' : '<span class="hum">BOT</span>'}${a.flags & 4 ? ' <span class="bombTag">CARGA</span>' : ''}</td>${gg ? `<td>${a.lvl + 1} · ${SHORT[PC.LADDER[a.lvl]] || ''}</td>` : mine ? `<td>${a.money}</td>` : ''}<td>${a.k}</td><td>${a.as}</td><td>${a.d}</td><td>${a.score}</td></tr>`).join('') + '</table>';
}
function showBoard(on) { if (G.state !== 'playing') return; if (on) { $('#boardT').innerHTML = teamTable(me.team) + teamTable(1 - me.team); $('#board').hidden = false; } else $('#board').hidden = true; }
function showEnd(e) {
  G.nextMap = e.next || null; G.votes = {}; G.myVote = null; drawVotes();
  if (e.gg) {
    const wa = actors[e.win]; const mine = e.win === me.id;
    $('#endTitle').textContent = mine ? '¡Ganaste con el cuchillo!' : (wa ? wa.name + ' ganó' : 'Fin de la escalada'); $('#endTitle').className = wa ? 't' + wa.team : '';
    $('#endEye').textContent = 'ESCALADA DE ARMAS · ' + MAPS[CURMAP].name.toUpperCase();
    const a = actors[me.id] || { k: 0, d: 0, lvl: 0 }; const acc = me.shots ? Math.round(me.hits / me.shots * 100) : 0;
    $('#endStats').innerHTML = [['Nivel ' + ((me.lvl | 0) + 1), 'De ' + PC.LADDER.length], [a.k + ' / ' + a.d, 'Bajas / muertes'], [acc + '%', 'Precisión'], [me.heads, 'A la cabeza']].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
    $('#endT').innerHTML = teamTable(me.team) + teamTable(1 - me.team); $('#end').hidden = false; closeBuy(); releaseLock(); return;
  }
  const win = e.w; $('#endTitle').textContent = win === -1 ? 'Empate' : win === me.team ? 'Victoria' : 'Derrota'; $('#endTitle').className = win === -1 ? '' : 't' + win;
  $('#endEye').textContent = `HALCÓN ${e.sc[0]} · ${e.sc[1]} COBRA · ${MAPS[CURMAP].name.toUpperCase()}`;
  const acc = me.shots ? Math.round(me.hits / me.shots * 100) : 0; const a = actors[me.id] || { k: 0, d: 0 };
  $('#endStats').innerHTML = [[a.k + ' / ' + a.d, 'Bajas / muertes'], [(a.k / Math.max(1, a.d)).toFixed(2), 'Relación B/M'], [acc + '%', 'Precisión'], [me.heads, 'A la cabeza']].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  $('#endT').innerHTML = teamTable(me.team) + teamTable(1 - me.team); $('#end').hidden = false; closeBuy(); releaseLock();
}

/* ---------- Menú ---------- */
const MAPSW = { desert: 'linear-gradient(90deg,#d6c19d,#4c8fc8)', port: 'linear-gradient(90deg,#d09a70,#2f5f80)', rural: 'linear-gradient(90deg,#1f4f9c,#6a9a4a)', city: 'linear-gradient(90deg,#2a3440,#3fe0f0 70%,#d9a22e)', snow: 'linear-gradient(90deg,#e9eef4,#8c2f24 75%,#2b4f7a)' };
function drawMaps() {
  $('#maps').innerHTML = PC.MAP_IDS.map(id => { const M = MAPS[id]; const c = MAPSW[M.theme] || '#444'; return `<button type="button" class="mapc" data-m="${id}" aria-pressed="${id === prefs.map}"><span class="th" style="background:${c}"></span><span class="n">${M.name}</span><span class="d">${M.blurb}</span></button>`; }).join('');
}
drawMaps();
$('#maps').addEventListener('click', e => { const b = e.target.closest('.mapc'); if (!b) return; prefs.map = b.dataset.m; savePrefs(); drawMaps(); buildWorld(prefs.map); });
for (const [sel, key] of [['#sideSeg', 'side'], ['#gmSeg', 'gm'], ['#gfxSeg', 'gfx'], ['#gfxSeg2', 'gfx']]) { document.querySelectorAll(sel + ' button').forEach(b => { b.setAttribute('aria-pressed', b.dataset.v === prefs[key]); b.onclick = () => { prefs[key] = b.dataset.v; savePrefs(); if (key === 'gm' && typeof SQ !== 'undefined' && SQ.st && SQ.st.lead) sqSendMsg({ t: 'sq_mode', gm: prefs.gm }); document.querySelectorAll(sel + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); if (key === 'gfx') { for (const s2 of ['#gfxSeg', '#gfxSeg2']) document.querySelectorAll(s2 + ' button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === prefs.gfx)); const m = CURMAP; CURMAP = null; buildWorld(m); applyGfx(); if (G.state === 'playing') applyCond(G.cond); } }; }); }
document.querySelectorAll('#diff button').forEach(b => { b.setAttribute('aria-pressed', b.dataset.d === prefs.diff); b.onclick = () => { prefs.diff = b.dataset.d; savePrefs(); document.querySelectorAll('#diff button').forEach(x => x.setAttribute('aria-pressed', x === b)); }; });
const nameEl = $('#pname'); nameEl.value = prefs.name || ''; nameEl.oninput = () => { prefs.name = nameEl.value; savePrefs(); };
function drawMix() { document.querySelectorAll('.mix input').forEach(el => { el.value = prefs.vol[el.dataset.k]; el.nextElementSibling.textContent = Math.round(prefs.vol[el.dataset.k] * 100) + ' %'; }); }
document.querySelectorAll('.mix input').forEach(el => { el.oninput = () => { prefs.vol[el.dataset.k] = +el.value; savePrefs(); drawMix(); applyVol(); }; el.onchange = () => { initAudio(); if (el.dataset.k === 'ui') uiSound(() => sTone(980, .06, .1, 'square')); else sNoise(.08, .3, 1200); }; });
drawMix();
for (const id of ['#sens', '#sens2']) { const el = $(id); el.value = prefs.sens; el.oninput = () => { prefs.sens = +el.value; savePrefs(); $('#sens').value = $('#sens2').value = prefs.sens; }; }
const codeEl = $('#code'); const qs = new URLSearchParams(location.search); if (qs.get('sala')) { codeEl.value = qs.get('sala').toUpperCase().slice(0, 4); }
const baseJoin = () => ({ t: 'join', token: auth.me ? auth.token : undefined, camo: mySkin(), name: cleanName(prefs.name), map: prefs.map, diff: prefs.diff, side: prefs.side === 'auto' ? null : prefs.side, gm: prefs.gm });
$('#quick').onclick = () => { initAudio(); joinOnline(Object.assign(baseJoin(), { mode: 'quick' })); };
$('#create').onclick = () => { initAudio(); joinOnline(Object.assign(baseJoin(), { mode: 'create', pub: $('#pubRoom').checked })); };
$('#pubRoom').checked = prefs.pubRoom !== false; $('#pubRoom').onchange = () => { prefs.pubRoom = $('#pubRoom').checked; savePrefs(); };
/* ---------- Lista de salas públicas ---------- */
const GM_N = { bomb: 'Con carga', elim: 'Sin carga', gg: 'Escalada de armas', tdm: 'Combate por equipos' }, DIFF_N = { recluta: 'bots recluta', veterano: 'bots veterano', elite: 'bots élite' };
let roomsTimer = null;
async function loadRooms() {
  if (location.protocol === 'file:') { $('#roomsBox').hidden = true; return; }
  if (G.state !== 'menu' || $('#menu').hidden) return;
  try {
    const r = await fetch('/api/rooms', { cache: 'no-store' }); const list = await r.json();
    if (!list.length) { $('#roomList').innerHTML = '<div class="small">No hay salas públicas activas. Crea una con «Pública» marcada o entra a Partida rápida.</div>'; return; }
    $('#roomList').innerHTML = list.map(x => {
      const full = x.players >= 8; const st = x.mode === 'gg' ? 'en juego' : x.mode === 'tdm' ? 'en juego · ' + x.sc[0] + '-' + x.sc[1] : x.phase === 'buy' ? 'compra · ronda ' + x.round : x.phase === 'over' ? 'terminando' : 'ronda ' + x.round + ' · ' + x.sc[0] + '-' + x.sc[1];
      const T = x.teams || { atk: [], def: [] };
      const col = sd => { const L = T[sd] || []; const hum = L.filter(q => q.h).length; const cap = L.length || 4; const closed = full || hum >= cap;
        return `<div class="tcol ${sd}"><button type="button" class="thd" data-code="${esc(x.code)}" data-side="${sd}" ${closed ? 'aria-disabled="true"' : ''}><span>${SIDE_N[sd]}</span><b>${hum}/${cap}</b></button>
        ${L.map(q => q.h ? `<div class="slot on" title="Ocupado">${esc(q.n)}</div>` : `<button type="button" class="slot" data-code="${esc(x.code)}" data-side="${sd}" ${closed ? 'aria-disabled="true"' : ''}>Libre · entrar</button>`).join('')}</div>`; };
      return `<div class="room"><div class="rn">${esc(MAPS[x.map] ? MAPS[x.map].name : x.map)}<code>${esc(x.code)}</code></div><button type="button" class="auto" data-code="${esc(x.code)}" ${full ? 'aria-disabled="true"' : ''}>${full ? 'Llena' : 'Automático'}</button>
      <div class="rd">${x.players}/8 personas · ${GM_N[x.mode] || x.mode} · ${st} · ${DIFF_N[x.diff] || ''}</div>
      <div class="teams">${col('atk')}${col('def')}</div></div>`;
    }).join('');
  } catch (e) { $('#roomList').innerHTML = '<div class="small">No se pudo cargar la lista. El servidor puede estar despertando; intenta en unos segundos.</div>'; }
}
/* ---------- Escuadra de amigos (conexión propia, sigue abierta durante la partida) ---------- */
const SQ = { ws: null, st: null, ready: false };
function sqConnect(first) {
  if (SQ.ws && SQ.ws.readyState <= 1) { if (SQ.ws.readyState === 1) SQ.ws.send(JSON.stringify(first)); else SQ.pending = first; return; }
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); SQ.ws = ws; SQ.pending = first;
  ws.onopen = () => { if (SQ.pending) { ws.send(JSON.stringify(SQ.pending)); SQ.pending = null; } };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onSq(m); };
  ws.onclose = () => { if (SQ.ws !== ws) return; SQ.ws = null; if (SQ.st) { SQ.st = null; drawSquad(); $('#sqErr').textContent = 'Se perdió la conexión de la escuadra. Créala o únete de nuevo.'; } };
}
const sqSendMsg = m => { if (SQ.ws && SQ.ws.readyState === 1) SQ.ws.send(JSON.stringify(m)); };
const sqIdent = () => ({ name: cleanName(prefs.name), token: auth.me ? auth.token : undefined, gm: prefs.gm });
function onSq(m) {
  if (m.t === 'sq') { SQ.st = m; SQ.ready = !!m.mine; $('#sqErr').textContent = ''; drawSquad(); }
  else if (m.t === 'sq_err') $('#sqErr').textContent = m.msg;
  else if (m.t === 'sq_left') { SQ.st = null; drawSquad(); }
  else if (m.t === 'sq_go') {
    SQ.ready = false;
    if (G.state === 'playing') { if (G.code !== m.code) toast('Tu escuadra entró a la sala ' + m.code + '. Sal de esta partida y únete con ese código.'); return; }
    toast('Tu escuadra entra a la partida'); initAudio(); joinOnline(Object.assign(baseJoin(), { mode: 'code', code: m.code, side: m.side }));
  }
}
function drawSquad() {
  const st = SQ.st; $('#sqOut').hidden = !!st; $('#sqIn').hidden = !st; if (!st) return;
  $('#sqCodeV').textContent = st.code; $('#sqMode').textContent = 'Modo: ' + (GM_N[st.gm] || st.gm) + (st.lead ? ' · lo eliges arriba' : ' · lo elige el líder');
  $('#sqMembers').innerHTML = st.members.map(x => `<div class="sqm"><span>${esc(x.n)}</span><span class="chip ${x.l ? 'lead' : x.r ? 'ok' : 'wait'}">${x.l ? 'Líder' : x.r ? 'Listo' : 'Esperando'}</span></div>`).join('');
  const allReady = st.members.every(x => x.l || x.r);
  $('#sqReady').hidden = !!st.lead; $('#sqStart').hidden = !st.lead;
  $('#sqReady').textContent = SQ.ready ? 'No estoy listo' : 'Estoy listo';
  $('#sqStart').setAttribute('aria-disabled', allReady ? 'false' : 'true'); $('#sqStart').textContent = allReady ? 'Entrar a partida' : 'Esperando a la escuadra';
  $('#sqInfo').textContent = st.members.length + ' de 4 · mismo equipo';
}
$('#sqCreate').onclick = () => { $('#sqErr').textContent = ''; sqConnect(Object.assign({ t: 'sq_create' }, sqIdent())); };
$('#sqJoin').onclick = () => { const c = $('#sqCode').value.toUpperCase().trim(); if (c.length !== 5) { $('#sqErr').textContent = 'El código de escuadra tiene 5 letras.'; return; } $('#sqErr').textContent = ''; sqConnect(Object.assign({ t: 'sq_join', code: c }, sqIdent())); };
$('#sqCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#sqJoin').click(); });
$('#sqReady').onclick = () => { SQ.ready = !SQ.ready; sqSendMsg({ t: 'sq_ready', r: SQ.ready }); drawSquad(); };
$('#sqStart').onclick = () => { if ($('#sqStart').getAttribute('aria-disabled') === 'true') { $('#sqErr').textContent = 'Todos deben marcar «Estoy listo».'; return; } sqSendMsg({ t: 'sq_start' }); };
$('#sqLeave').onclick = () => { sqSendMsg({ t: 'sq_leave' }); SQ.st = null; SQ.ready = false; drawSquad(); };
$('#sqCopy').onclick = async () => { try { await navigator.clipboard.writeText(SQ.st.code); toast('Código de escuadra copiado'); } catch (e) { toast('Código: ' + SQ.st.code); } };
$('#roomList').addEventListener('click', e => { const b = e.target.closest('button[data-code]'); if (!b || b.getAttribute('aria-disabled') === 'true') return; initAudio(); codeEl.value = b.dataset.code; const j = Object.assign(baseJoin(), { mode: 'code', code: b.dataset.code }); if (b.dataset.side) j.side = b.dataset.side; else if (b.classList.contains('auto')) j.side = null; joinOnline(j); });
$('#roomsRefresh').onclick = () => loadRooms();
function startRoomsPoll() { loadRooms(); clearInterval(roomsTimer); roomsTimer = setInterval(loadRooms, 5000); }
startRoomsPoll();
$('#joinBtn').onclick = () => { initAudio(); const c = codeEl.value.trim().toUpperCase(); if (c.length !== 4) { $('#err').textContent = 'El código tiene 4 letras. Pídelo a quien creó la sala.'; return; } joinOnline(Object.assign(baseJoin(), { mode: 'code', code: c })); };
codeEl.addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });
$('#offline').onclick = () => { initAudio(); startOffline(); };
$('#rangeGo').onclick = () => { initAudio(); startOffline({ range: true }); };
if (location.protocol === 'file:') { $('#err').textContent = 'Abierto como archivo local: el modo en línea necesita el servidor. Puedes practicar sin conexión.'; }

function enterGame() {
  drawWheel();
  G.state = 'playing'; $('#menu').hidden = true; $('#end').hidden = true; $('#pause').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !isTouch;
  const link = location.origin + location.pathname + '?sala=' + G.code; $('#inviteUrl').textContent = link; $('#inviteBox').hidden = net.mode !== 'online';
  $('#roomCode').textContent = G.code; me.ammo = {}; me.shots = me.hits = me.heads = me.kills = 0; refillAmmo(); drawSlots();
  if (net.mode === 'online') try { history.replaceState(null, '', '?sala=' + G.code); } catch (e) { }
  try { history.pushState({ pc: 1 }, '', location.href); } catch (e) { }
  if (typeof SQ !== 'undefined' && SQ.st && SQ.ready && !SQ.st.lead) { SQ.ready = false; sqSendMsg({ t: 'sq_ready', r: false }); }
  $('#app').classList.add('playing'); blurUI(); resetAim(); applyCond(G.cond); if (G.cond && G.cond.night) setTimeout(() => toast(isTouch ? 'Es de noche: la linterna se enciende sola' : 'Es de noche: F enciende o apaga la linterna'), 2500);
}
function leaveToMenu() {
  clearFires();
  rangeStop();
  G.reveal = G.drone = 0; me.streak = 0;
  applyCond(null); clearDecals(); flashT = shake = 0; for (const d of dmgDirs) d.el.remove(); dmgDirs.length = 0; me.crouchToggle = false; $('#bCrouch').classList.remove('on'); lockFails = 0; lockFailed = false; if (meModel) { scene.remove(meModel.g); meModel = null; }
  leaveNet(); G.state = 'menu'; $('#app').classList.remove('playing'); toastT = annT = 0; $('#toast').classList.remove('on'); $('#announce').classList.remove('on'); $('#feed').innerHTML = ''; $('#hud').hidden = true; $('#touch').hidden = true; $('#pause').hidden = true; $('#end').hidden = true; $('#buy').hidden = true; $('#board').hidden = true; $('#menu').hidden = false;
  for (const a of actors) if (a && a.model) scene.remove(a.model.g); actors.length = 0; for (const el of tagEls.values()) el.remove(); tagEls.clear();
  stopKillcam(); closeChat(false); toggleWheel(false); for (const pg of pings) pg.el.remove(); pings.length = 0; $('#chatBox').innerHTML = ''; rec.length = 0; recShots.length = 0;
  for (const [id, s] of smokes) { scene.remove(s.g); } smokes.clear(); updateDrops([]); updateNades([]); bombMesh.visible = false; me.alive = false; releaseLock();
  try { history.replaceState(null, '', location.pathname); } catch (e) { }
  drawProfile(); loadRooms();
}
function openPause() { if (G.state !== 'playing') return; closeBuy(); $('#pause').hidden = false; me.fireHeld = false; me.altHeld = false; me.nadeArm = false; releaseLock(); }
$('#resume').onclick = () => { $('#pause').hidden = true; blurUI(); requestLock(true); };
confirmBtn($('#quit'), 'Confirmar: salir de la sala', () => leaveToMenu()); confirmBtn($('#toMenu'), 'Confirmar: salir de la sala', () => leaveToMenu());
$('#copyBtn').onclick = async () => { const txt = $('#inviteUrl').textContent; try { await navigator.clipboard.writeText(txt); $('#copyBtn').textContent = 'Copiado'; setTimeout(() => $('#copyBtn').textContent = 'Copiar link', 1600); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#inviteUrl')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('#copyBtn').textContent = 'Selecciona y copia'; } };

/* ================= PROGRESIÓN ================= */
const CH_POOL = [
  { id: 'kills', txt: 'Consigue {n} bajas', n: 15 }, { id: 'heads', txt: 'Consigue {n} bajas a la cabeza', n: 5 }, { id: 'rounds', txt: 'Gana {n} rondas', n: 4 },
  { id: 'plant', txt: 'Planta la carga {n} veces', n: 2 }, { id: 'defuse', txt: 'Desactiva la carga {n} vez', n: 1 }, { id: 'knife', txt: 'Consigue {n} bajas con cuchillo', n: 2 },
  { id: 'nade', txt: 'Consigue {n} baja con granada HE', n: 1 }, { id: 'ggwin', txt: 'Gana {n} escalada de armas', n: 1 }, { id: 'shotgun', txt: 'Consigue {n} bajas con la escopeta', n: 3 },
  { id: 'sniper', txt: 'Consigue {n} bajas con rifle de mira', n: 3 }
];
const needXP = l => 1000 + 150 * (l - 1);
function today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function ensureDaily() {
  const d = today(); if (prof.day === d && prof.ch && prof.ch.length === 3) return;
  let h = 7; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0; const pool = CH_POOL.slice(), pick = [];
  while (pick.length < 3) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; pick.push(pool.splice(h % pool.length, 1)[0]); }
  prof.day = d; prof.ch = pick.map(c => ({ id: c.id, n: c.n, p: 0, done: false })); saveProf();
}
function chText(c) { const d = CH_POOL.find(x => x.id === c.id); return d ? d.txt.replace('{n}', c.n) : ''; }
function addXP(n, why) {
  prof.xp += n; let up = false;
  while (prof.xp >= needXP(prof.lvl)) { prof.xp -= needXP(prof.lvl); prof.lvl++; up = true; const unl = PC.CAMOS.find(c => c.lvl === prof.lvl); announce('Subiste a nivel ' + prof.lvl, unl ? 'Desbloqueaste el camuflaje ' + unl.name + '. Elígelo en el menú principal.' : 'Sigue sumando experiencia', 3.2, 'var(--amber)'); }
  if (up) { sTone(660, .12, .2, 'triangle'); sTone(880, .12, .2, 'triangle', 0, .1); sTone(1180, .22, .2, 'triangle', 0, .2); }
  saveProf(); xpPop('+' + n + ' · ' + why);
}
function progress(id, amt = 1) { ensureDaily(); for (const c of prof.ch) if (c.id === id && !c.done) { c.p = Math.min(c.n, c.p + amt); if (c.p >= c.n) { c.done = true; toast('Desafío diario completado: ' + chText(c)); saveProf(); addXP(500, 'desafío diario'); } } saveProf(); }
function xpPop(s) { const el = $('#xpPop'); el.textContent = s; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function progressEvent(e) {
  if (me.id < 0 || G.state !== 'playing' || auth.me) return;
  switch (e.k) {
    case 'kill': if (e.a === me.id && e.v !== me.id && teamOf(e.v) !== me.team) { addXP(100 + (e.h ? 50 : 0), e.h ? 'baja a la cabeza' : 'baja'); progress('kills'); if (e.h) progress('heads'); if (e.w === 'knife') progress('knife'); if (e.w === 'he') progress('nade'); if (e.w === 'es12') progress('shotgun'); if (e.w === 'sr' || e.w === 'tr7') progress('sniper'); } else if (e.ast && e.ast.includes(me.id)) addXP(40, 'asistencia'); break;
    case 'plant': if (e.v === me.id) { addXP(150, 'carga plantada'); progress('plant'); } break;
    case 'defused': if (e.v === me.id) { addXP(200, 'carga desactivada'); progress('defuse'); } break;
    case 'rend': if (e.w === me.team) { addXP(100, 'ronda ganada'); progress('rounds'); } break;
    case 'mend': if (e.gg ? e.win === me.id : e.w === me.team) { addXP(500, 'partida ganada'); if (e.gg) progress('ggwin'); } break;
    case 'lvl': if (e.v === me.id) addXP(40, 'nivel de arma'); break;
  }
}
function drawProfile() {
  if (!auth.me) ensureDaily(); drawAccount(); const need = needXP(prof.lvl);
  const camos = [{ id: null, name: 'Sin camuflaje', lvl: 1 }].concat(PC.CAMOS);
  $('#profBox').innerHTML = `<div class="prof"><div class="lvl"><b>${prof.lvl}</b><span>nivel</span></div><div class="xpw"><div class="small">${prof.xp} / ${need} de experiencia</div><div class="xpbar"><s style="width:${Math.min(100, prof.xp / need * 100)}%"></s></div></div></div>
  <div class="invHead"><span class="lbl small">Camuflaje general (todas las armas)</span><button type="button" class="go ghost sm" id="invOpen">Inventario de skins</button></div><div class="camos">${camos.map(c => { const lock = prof.lvl < c.lvl || (c.top && !auth.me); const sel = (prof.camo || null) === c.id; return `<button type="button" class="camo" data-c="${c.id || ''}" aria-pressed="${sel}" ${lock ? 'aria-disabled="true"' : ''} title="${c.name}${c.top ? ' · solo para el top ' + c.top + ' de la temporada' + (auth.me ? '' : ' (requiere cuenta)') : lock ? ' · se desbloquea en nivel ' + c.lvl : ''}"><span class="sw" style="${c.id ? `background-image:url(${PCM.camoSwatch(c.id)})` : ''}"></span><span class="cn">${lock ? 'Nv ' + c.lvl : c.name}</span></button>`; }).join('')}</div>
  <div class="lbl small">Desafíos de hoy</div><div class="daily">${prof.ch.map(c => `<div class="ch${c.done ? ' done' : ''}"><span>${chText(c)}</span><b>${c.p}/${c.n}</b><i><s style="width:${c.p / c.n * 100}%"></s></i></div>`).join('')}</div>`;
}
$('#profBox').addEventListener('click', async e => {
  const b = e.target.closest('.camo'); if (!b || b.getAttribute('aria-disabled') === 'true') return; const c = b.dataset.c || null;
  if (auth.me) { const r = await apiCall('/api/camo', { camo: c }); if (r.me) applyMe(r.me); else if (r.error) toast(r.error); }
  else { prof.camo = c; saveProf(); }
  drawProfile(); rebuildVMs();
});
/* ---------- Cuenta: ingresar, crear y cerrar sesión ---------- */
async function apiCall(path, body, method) {
  try {
    const r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: Object.assign({ 'content-type': 'application/json' }, auth.token ? { authorization: 'Bearer ' + auth.token } : {}), body: body ? JSON.stringify(body) : undefined });
    return await r.json();
  } catch (e) { return { error: 'No hay conexión con el servidor. Puede estar despertando; intenta en unos segundos.' }; }
}
let acctTab = 'login';
function drawAccount() {
  const box = $('#acctBox'); if (!box) return;
  if (location.protocol === 'file:') { box.hidden = true; return; }
  setTimeout(() => { if (!$('#rankBtn')) box.insertAdjacentHTML('beforeend', '<button type="button" class="linkbtn" id="rankBtn">Ver el ranking de la temporada</button>'); $('#rankBtn').onclick = () => openRank(); }, 0);
  $('#pnameWrap').hidden = !!auth.me;
  if (auth.me) {
    const st = auth.me.stats || {};
    box.innerHTML = `<div class="acctOn"><div><div class="small">Conectado como</div><b>${esc(auth.me.name)}</b> <span class="small">@${esc(auth.me.user)}</span> <button type="button" class="linkbtn" id="renameBtn">Cambiar nombre</button></div><button type="button" class="linkbtn" id="logoutBtn">Cerrar sesión</button></div>
    <form id="renameForm" class="renameForm" hidden novalidate><label class="field" for="renameIn"><span class="lbl small">Nombre del personaje (3 a 14 caracteres)</span><input id="renameIn" type="text" maxlength="14" autocomplete="nickname" value="${esc(auth.me.name)}"></label><div class="sqrow"><button class="go sm" type="submit">Guardar nombre</button><button class="go ghost sm" type="button" id="renameCancel">Cancelar</button></div><div class="small" id="renameErr" role="status"></div><div class="small">Tu usuario para ingresar (@${esc(auth.me.user)}) no cambia.</div></form>
    <div class="small">Bajas ${st.kills || 0} · Muertes ${st.deaths || 0} · Victorias ${st.wins || 0} · Partidas ${st.matches || 0}. Tu progreso se guarda en tu cuenta.</div>`;
    $('#renameBtn').onclick = () => { $('#renameForm').hidden = false; $('#renameBtn').hidden = true; const i = $('#renameIn'); i.focus(); i.select(); };
    $('#renameCancel').onclick = () => { $('#renameForm').hidden = true; $('#renameBtn').hidden = false; };
    $('#renameForm').onsubmit = async ev => {
      ev.preventDefault(); const name = cleanName($('#renameIn').value); const err = $('#renameErr');
      if (name.length < 3 || name === 'Operador' && $('#renameIn').value.trim() === '') { err.textContent = 'El nombre debe tener entre 3 y 14 caracteres.'; return; }
      err.textContent = 'Guardando…'; const r = await apiCall('/api/name', { name });
      if (r && r.me) { applyMe(r.me); prefs.name = r.me.name; savePrefs(); drawProfile(); toast('Ahora te llamas ' + r.me.name); if (G.state === 'playing') toast('El nombre nuevo ya se ve en la partida'); }
      else err.textContent = (r && r.error) || 'No se pudo guardar el nombre. Intenta de nuevo.';
    };
    $('#logoutBtn').onclick = async () => { await apiCall('/api/logout', {}); auth.token = null; auth.me = null; try { localStorage.removeItem('pc2_tok'); } catch (e) { } for (const k of Object.keys(prof)) delete prof[k]; Object.assign(prof, guestProfile()); drawProfile(); rebuildVMs(); };
    return;
  }
  const reg = acctTab === 'register';
  box.innerHTML = `<div class="seg acctTabs"><button type="button" data-t="login" aria-pressed="${!reg}">Ingresar</button><button type="button" data-t="register" aria-pressed="${reg}">Crear cuenta</button></div>
  <form id="acctForm" class="acctForm" novalidate>
    <label class="field" for="acUser"><span class="small">Usuario</span><input id="acUser" type="text" maxlength="16" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="tu_usuario"></label>
    <label class="field" for="acPass"><span class="small">Clave${reg ? ' (mínimo 8 caracteres)' : ''}</span><input id="acPass" type="password" maxlength="100" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
    ${reg ? '<label class="field" for="acName"><span class="small">Nombre en el juego</span><input id="acName" type="text" maxlength="14" autocomplete="nickname" placeholder="Como te verán los demás"></label>' : ''}
    <button class="go sm" type="submit">${reg ? 'Crear cuenta' : 'Ingresar'}</button>
    <span class="acctErr" id="acctErr" role="status"></span>
  </form>
  <div class="small">Sin cuenta también puedes jugar; tu progreso queda solo en este navegador.</div>`;
  box.querySelectorAll('.acctTabs button').forEach(b => b.onclick = () => { acctTab = b.dataset.t; drawAccount(); });
  $('#acctForm').onsubmit = async e => {
    e.preventDefault(); const user = $('#acUser').value.trim(), pass = $('#acPass').value; const err = $('#acctErr');
    if (!user || !pass) { err.textContent = 'Escribe tu usuario y tu clave.'; return; }
    err.textContent = reg ? 'Creando tu cuenta…' : 'Ingresando…';
    const r = await apiCall(reg ? '/api/register' : '/api/login', reg ? { user, pass, name: ($('#acName').value || '').trim() } : { user, pass });
    $('#acPass').value = '';
    if (r.error) { err.textContent = r.error; return; }
    auth.token = r.token; try { localStorage.setItem('pc2_tok', r.token); } catch (e) { }
    applyMe(r.me); drawProfile(); rebuildVMs(); toast(reg ? 'Cuenta creada. ¡Bienvenido, ' + r.me.name + '!' : 'Hola de nuevo, ' + r.me.name);
  };
}
async function restoreSession() {
  if (!auth.token || location.protocol === 'file:') return;
  const r = await apiCall('/api/me');
  if (r.me) { applyMe(r.me); drawProfile(); rebuildVMs(); }
  else if (r.error && !/conexión/.test(r.error)) { auth.token = null; try { localStorage.removeItem('pc2_tok'); } catch (e) { } }
}

/* ================= REPETICIÓN DE LA BAJA ================= */
const rec = [], recShots = []; let kc = null, meModel = null; const spec = { id: -1, yaw: 0, pitch: 0, x: 0, y: 0, z: 0 };
function recordSnap(m, t) {
  const fr = { t, a: {} }; for (const r of m.a) fr.a[r[0]] = [r[1], r[2], r[3], r[4], r[5], r[6], r[8], r[9], r[7]];
  rec.push(fr); while (rec.length && t - rec[0].t > 7) rec.shift();
  for (const e of m.ev) if (e.k === 'shot') recShots.push({ t, s: e.s, e: e.e, w: e.w, hit: e.hit });
  while (recShots.length && t - recShots[0].t > 7) recShots.shift();
}
function kcState(rt) {
  if (!rec.length) return null; let i = 0; while (i < rec.length - 1 && rec[i + 1].t <= rt) i++;
  const p = rec[i], b = rec[Math.min(i + 1, rec.length - 1)]; const k = b.t > p.t ? clamp((rt - p.t) / (b.t - p.t), 0, 1) : 0; const out = {};
  for (const id in p.a) { const A = p.a[id], B = b.a[id] || A; out[id] = { x: lerp(A[0], B[0], k), y: lerp(A[1], B[1], k), z: lerp(A[2], B[2], k), yaw: A[3] + angDiff(A[3], B[3]) * k, pitch: lerp(A[4], B[4], k), h: lerp(A[5], B[5], k), alive: A[6], cur: A[7], hp: A[8] }; }
  return out;
}
function startKillcam(e) {
  if (G.mode === 'range' || e.a < 0 || e.a === me.id || !actors[e.a] || rec.length < 10) return;
  const t = nowS(); const last = rec[rec.length - 1].a[e.a]; const quick = G.mode === 'gg' || G.mode === 'tdm';
  const len = quick ? 1.9 : 4.2;
  // fase 1: los ojos del rival (con su arma y cámara lenta al final); fase 2: plano en tercera persona del rival y tu caída
  kc = { start: t + (quick ? .35 : .8), from: t - len, len, end: t, rt: t - len, killer: e.a, kteam: actors[e.a].team, w: e.w, h: e.h, dist: e.dist, lastRt: t - len, hp: last ? last[8] : null, cam: null, phase: 'eyes', orbitT: 0, orbitLen: quick ? .9 : 1.9, view: null };
}
function stopKillcam() { if (!kc) return; kc = null; $('#killcam').hidden = true; if (meModel) meModel.g.visible = false; PCM.setFpTeam(me.team); spec.id = -1; }
function kcActive() { return !!kc && !me.alive && G.state === 'playing' && nowS() >= kc.start; }
function kcRender(dt) {
  // tiempo de repetición: velocidad normal y cámara lenta en el último medio segundo
  if (kc.phase === 'eyes') { const slow = kc.end - kc.rt < .5; kc.rt += dt * (slow ? .32 : 1); if (kc.rt >= kc.end) { kc.rt = kc.end; kc.phase = 'orbit'; kc.orbitT = 0; } }
  else { kc.orbitT += dt; if (kc.orbitT >= kc.orbitLen) { stopKillcam(); return; } }
  const rt = kc.rt; const st = kcState(rt), st2 = kcState(rt - .06); if (!st) { stopKillcam(); return; }
  if (!meModel || meModel.tm !== me.team) { if (meModel) scene.remove(meModel.g); meModel = makeSoldier(me.team, me.id); meModel.tm = me.team; }
  if (meModel.setCamo) meModel.setCamo(mySkin());
  const place = (m, id) => {
    const s1 = st[id]; if (!s1 || !s1.alive) { m.g.visible = false; return; }
    const s0 = st2 && st2[id] ? st2[id] : s1; const spd = Math.hypot(s1.x - s0.x, s1.z - s0.z) / .06;
    m.g.visible = id != kc.killer || kc.phase === 'orbit'; m.g.position.set(s1.x, s1.y, s1.z); m.g.rotation.y = s1.yaw; m.body.rotation.x = 0; m.body.position.y = 0;
    m.kcPh = (m.kcPh || 0) + dt * spd * 2.2; m.animate(spd, m.kcPh, clamp((1.8 - s1.h) / .58, 0, 1), s1.pitch); m.setGun(s1.cur); m.flash.visible = false;
  };
  for (const a of actors) if (a && a.model) place(a.model, a.id);
  place(meModel, me.id);
  const k = st[kc.killer], k0 = st2 && st2[kc.killer];
  if (k) {
    kc.view = { cur: k.cur, spd: k0 ? Math.hypot(k.x - k0.x, k.z - k0.z) / .06 : 0 };
    if (kc.phase === 'eyes') kc.cam = { x: k.x, y: k.y + k.h - .12, z: k.z, yaw: k.yaw, pitch: k.pitch };
    else {
      // plano final: por detrás del hombro del rival mirando hacia donde caíste
      const v = st[me.id] || { x: k.x - Math.sin(k.yaw) * 5, y: 0, z: k.z - Math.cos(k.yaw) * 5 };
      const dx = v.x - k.x, dz = v.z - k.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, e = Math.min(1, kc.orbitT / .5), ee = e * e * (3 - 2 * e);
      const cx = k.x - ux * (1.4 + ee * 1.6) + uz * (.55 + ee * .9), cz = k.z - uz * (1.4 + ee * 1.6) - ux * (.55 + ee * .9), cy = k.y + 1.75 + ee * .9;
      const tx = (k.x + v.x) / 2, tz = (k.z + v.z) / 2, ty = .9; const hd = Math.hypot(tx - cx, tz - cz) || 1;
      kc.cam = { x: cx, y: cy, z: cz, yaw: Math.atan2(-(tx - cx), -(tz - cz)), pitch: Math.atan2(ty - cy, hd) };
    }
  }
  for (const sh of recShots) {
    if (sh.t <= kc.lastRt || sh.t > rt) continue;
    const a = actors[sh.s]; const m = a && a.model; if (!m) continue;
    const from = new THREE.Vector3(); const mine = sh.s === kc.killer && kc.phase === 'eyes'; if (mine) { from.copy(vmMuzzleWorld()); vm.kick = 1; vm.flashT = .05; } else m.muzzle.getWorldPosition(from);
    const end = new THREE.Vector3(sh.e[0], sh.e[1], sh.e[2]); tracer(from, end); if (sh.hit) burst(end, [0, .3, 0], [.55, .05, .04], 2.4, 8); const pa = posAudio(from.x, from.z); sShot(WEAPONS[sh.w] && WEAPONS[sh.w].snd, sh.s === kc.killer ? 0 : pa.d, pa.pan);
  }
  kc.lastRt = rt;
}

/* ================= RADIO, CHAT Y MARCAS ================= */
let chatOpen = false, wheelOpen = false; const pings = [];
function addChat(html) { const box = $('#chatBox'); const d = document.createElement('div'); d.className = 'cl'; d.innerHTML = html; box.appendChild(d); while (box.children.length > 6) box.firstChild.remove(); setTimeout(() => d.classList.add('old'), 9000); }
function openChat() { if (G.state !== 'playing' || chatOpen) return; chatOpen = true; for (const k in keys) keys[k] = false; me.fireHeld = false; me.altHeld = false; toggleWheel(false); const i = $('#chatIn'); i.hidden = false; i.value = ''; setTimeout(() => i.focus(), 0); }
function closeChat(send) { if (!chatOpen) return; const i = $('#chatIn'); if (send && i.value.trim()) sendMsg({ t: 'chat', m: i.value.trim().slice(0, 90) }); i.hidden = true; i.blur(); chatOpen = false; }
$('#chatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); closeChat(true); } else if (e.key === 'Escape') { e.preventDefault(); closeChat(false); } });
$('#chatIn').addEventListener('blur', () => { if (chatOpen) setTimeout(() => { if (chatOpen && document.activeElement !== $('#chatIn')) closeChat(false); }, 100); });
function drawWheel() { $('#radioWheel').innerHTML = PC.RADIO.map((r, i) => `<button type="button" data-c="${i}" style="--a:${i * 45}deg"><kbd>${i + 1}</kbd>${r}</button>`).join('') + '<div class="hub">Radio<br><small>1-8 o clic · Z cierra</small></div>'; }
$('#radioWheel').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); sendRadio(+b.dataset.c); });
function toggleWheel(on) { wheelOpen = on === undefined ? !wheelOpen : !!on; if (wheelOpen && (G.state !== 'playing' || chatOpen)) wheelOpen = false; $('#radioWheel').hidden = !wheelOpen; }
function sendRadio(i) { sendMsg({ t: 'radio', c: i }); toggleWheel(false); }
function doPing() {
  if (!me.alive || G.state !== 'playing') return; const o = [camera.position.x, camera.position.y, camera.position.z]; const d = aimDir(me.punchP, 0, 0); const r = traceShot(o, d, 140);
  sendMsg({ t: 'ping', p: [o[0] + d[0] * r.t, o[1] + d[1] * r.t, o[2] + d[2] * r.t].map(v => +v.toFixed(2)), e: r.hit ? r.hit.id : null });
}
function addPing(e) {
  const el = document.createElement('div'); el.className = 'ping' + (e.e >= 0 ? ' enemy' : ''); el.innerHTML = '<i></i><span></span>'; $('#tags').appendChild(el);
  pings.push({ p: e.p, e: e.e, by: e.v, until: nowS() + (e.e >= 0 ? 4 : 6), el }); while (pings.length > 6) pings.shift().el.remove();
  sTone(1500, .05, .12, 'sine'); sTone(1900, .07, .12, 'sine', 0, .06);
}
function pingPos(pg) { const a = pg.e >= 0 ? actors[pg.e] : null; if (a && a.alive && (nowS() - a.seenT < 1.5 || pg.until - nowS() > 3)) return { x: a.pos.x, y: a.pos.y + a.h + .2, z: a.pos.z }; return { x: pg.p[0], y: pg.p[1] + .3, z: pg.p[2] }; }
function drawPings(t) {
  for (let i = pings.length - 1; i >= 0; i--) {
    const pg = pings[i]; if (t > pg.until) { pg.el.remove(); pings.splice(i, 1); continue; }
    const q = pingPos(pg); _p.set(q.x, q.y, q.z).project(camera); const vis = _p.z < 1 && _p.z > -1;
    pg.el.style.display = vis ? 'block' : 'none'; if (!vis) continue;
    const d = Math.round(Math.hypot(q.x - camera.position.x, q.z - camera.position.z)); const txt = (pg.e >= 0 ? 'Enemigo · ' : '') + d + ' m';
    if (pg.el._t !== txt) { pg.el._t = txt; pg.el.lastChild.textContent = txt; }
    pg.el.style.transform = `translate(${(_p.x * .5 + .5) * innerWidth}px,${(-_p.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; pg.el.style.opacity = Math.min(1, (pg.until - t) / .8);
  }
}

/* ================= VOTACIÓN DEL PRÓXIMO MAPA ================= */
function voteLeader() { const v = G.votes || {}; let best = null, n = 0, tie = false; for (const id of PC.MAP_IDS) { const c = v[id] || 0; if (c > n) { best = id; n = c; tie = false; } else if (c === n && n > 0) tie = true; } return n > 0 && !tie ? best : null; }
function drawVotes() {
  const box = $('#voteBox'); if (!box) return; const v = G.votes || {};
  const sw = MAPSW;
  box.innerHTML = `<div class="lbl small">Vota el próximo mapa · gana el más votado; si nadie vota, sigue la rotación</div><div class="votes">${PC.MAP_IDS.map(id => { const M = MAPS[id]; const mine = G.myVote === id; return `<button type="button" class="vote" data-m="${id}" aria-pressed="${mine}"><span class="th" style="background:${sw[M.theme] || '#444'}"></span><span class="n">${M.name}</span><b>${v[id] || 0}</b></button>`; }).join('')}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.vote'); if (!b || G.state !== 'playing') return; G.myVote = b.dataset.m; sendMsg({ t: 'vote', map: b.dataset.m }); drawVotes(); sNoise(.05, .25, 1800); });

/* ================= RANKING ================= */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
let rankBy = 'xp';
async function openRank(by) {
  if (by) rankBy = by; $('#rank').hidden = false;
  document.querySelectorAll('#rankTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.by === rankBy));
  $('#rankT').innerHTML = '<div class="small">Cargando…</div>';
  const r = await apiCall('/api/ranking?by=' + rankBy);
  if (r.error && !r.top) { $('#rankT').innerHTML = `<div class="small">${esc(r.error)}</div>`; return; }
  const [y, mo] = (r.season || '').split('-').map(Number); const end = new Date(Date.UTC(y, mo, 1)); const days = Math.max(0, Math.ceil((end - Date.now()) / 864e5));
  $('#rankSeason').textContent = 'Temporada de ' + (MESES[mo - 1] || '') + ' · quedan ' + days + ' días';
  const col = { xp: 'Experiencia', kills: 'Bajas', wins: 'Victorias' }[rankBy];
  const row = (x, cls) => `<tr class="${cls || ''}"><td>${x.pos}</td><td>${esc(x.name)}</td><td>${x.lvl}</td><td>${x[rankBy]}</td></tr>`;
  let html = `<table><tr><th>#</th><th>Jugador</th><th>Nivel</th><th>${col}</th></tr>` + (r.top.length ? r.top.map(x => row(x, x.you ? 'me' : '')).join('') : `<tr><td colspan="4">Todavía nadie suma puntos esta temporada. ¡Juega una partida para estrenar el ranking!</td></tr>`);
  if (r.me && !r.top.some(x => x.you)) html += `<tr class="sep"><td colspan="4"></td></tr>` + row(r.me, 'me');
  html += '</table>';
  if (!auth.me) html += '<div class="small" style="margin-top:8px">Crea una cuenta para aparecer en el ranking.</div>';
  $('#rankT').innerHTML = html;
}
$('#rankTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) openRank(b.dataset.by); });
$('#rankClose').onclick = () => { $('#rank').hidden = true; };
$('#rank').addEventListener('pointerdown', e => { if (e.target === $('#rank')) $('#rank').hidden = true; });

/* ================= INVENTARIO DE SKINS ================= */
const INV = { open: false, w: 'ar', sel: null, scene: null, cam: null, gun: null, key: '', rot: 0, drag: null, auto: true };
const INV_GROUPS = [['Pistolas', ['p9', 'r50', 'ap18']], ['Subfusiles y escopeta', ['smg', 'es12']], ['Fusiles', ['ar', 'fr9', 'tr7', 'lmg']], ['Francotirador', ['sr']], ['Cuerpo a cuerpo', ['knife']]];
function invSkinOf(w) { const v = (prof.camos || {})[w]; return v === undefined ? null : v; }
function invSetup() {
  if (INV.scene) return; const sc = new THREE.Scene(); INV.scene = sc; INV.cam = new THREE.PerspectiveCamera(30, 1.6, .05, 20);
  sc.add(new THREE.HemisphereLight(0xdfe8f5, 0x3a3226, .9)); const d1 = new THREE.DirectionalLight(0xfff1dc, 1.5); d1.position.set(2, 3, 2.5); sc.add(d1); const d2 = new THREE.DirectionalLight(0x9fc4ff, .7); d2.position.set(-3, 1, -2); sc.add(d2);
}
function invBuildGun() {
  const w = INV.w, sv = INV.sel === undefined ? invSkinOf(w) : INV.sel, eff = sv === null ? (prof.camo || null) : sv === 'none' ? null : sv;
  const key = w + '|' + eff; if (key === INV.key) return; INV.key = key;
  if (INV.gun) INV.scene.remove(INV.gun); const g = PCM.buildGun(w, { shadow: false, camo: eff }); const pivot = new THREE.Group(); pivot.add(g);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()); g.position.sub(c);
  const r = Math.max(sz.x, sz.y, sz.z) * .5 || .3; INV.cam.position.set(0, r * .3, r / Math.tan(15 * Math.PI / 180) * .78); INV.cam.lookAt(0, 0, 0);
  INV.scene.add(pivot); INV.gun = pivot;
}
function renderInv(now) {
  // se dibuja en la esquina del lienzo principal y se copia al lienzo del inventario antes del cuadro normal
  const el = $('#invView'); if (!el || !INV.gun) return; const r = el.getBoundingClientRect(); const cw0 = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
  const w = Math.min(r.width, cw0), h = Math.min(r.height, H); if (w < 10 || h < 10) return;
  const pr = renderer.getPixelRatio(), pw = Math.floor(w * pr), ph = Math.floor(h * pr); if (el.width !== pw || el.height !== ph) { el.width = pw; el.height = ph; }
  if (INV.auto && !INV.drag) INV.rot += .006; INV.gun.rotation.set(.18, INV.rot + Math.PI / 2, 0);
  INV.cam.aspect = w / h; INV.cam.updateProjectionMatrix();
  renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setScissor(0, H - h, w, h); renderer.setViewport(0, H - h, w, h);
  const ac = renderer.autoClear, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(); renderer.autoClear = false; renderer.setClearColor(0x14191e, 1); renderer.clear(true, true, false); renderer.render(INV.scene, INV.cam);
  renderer.autoClear = ac; renderer.setScissorTest(false); renderer.setViewport(0, 0, cw0, H); renderer.setClearColor(cc, ca);
  const ctx = el.getContext('2d'); ctx.clearRect(0, 0, pw, ph); ctx.drawImage(renderer.domElement, 0, 0, pw, ph, 0, 0, pw, ph);
}
function drawInv() {
  const cur = INV.w; const eff = (w) => { const v = invSkinOf(w); return v === 'none' ? null : v || prof.camo || null; };
  $('#invList').innerHTML = INV_GROUPS.map(([gname, ids]) => `<div class="lbl small">${gname}</div>` + ids.filter(id => WEAPONS[id]).map(id => { const e = eff(id); return `<button type="button" class="invW" data-w="${id}" aria-pressed="${id === cur}"><span class="sw" style="${e ? `background-image:url(${PCM.camoSwatch(e)})` : ''}"></span><span>${esc(WEAPONS[id].name)}</span><small>${invSkinOf(id) ? 'propia' : 'general'}</small></button>`; }).join('')).join('');
  const own = invSkinOf(cur); const sel = INV.sel === undefined ? own : INV.sel;
  const opts = [{ id: null, name: 'Usar la general', lvl: 1 }, { id: 'none', name: 'Sin skin', lvl: 1 }].concat(PC.CAMOS);
  $('#invSkins').innerHTML = opts.map(c => { const lock = c.id && c.id !== 'none' && (prof.lvl < c.lvl || (c.top && !auth.me)); const on = (sel || null) === c.id; return `<button type="button" class="camo" data-c="${c.id || ''}" aria-pressed="${on}" ${lock ? 'aria-disabled="true"' : ''} title="${esc(c.name)}"><span class="sw" style="${c.id && c.id !== 'none' ? `background-image:url(${PCM.camoSwatch(c.id)})` : ''}"></span><span>${c.id === null ? 'General' : c.id === 'none' ? 'Ninguna' : esc(c.name.split(' ·')[0])}</span><small>${lock ? (c.top ? 'Top 10' : 'Nv ' + c.lvl) : ''}</small></button>`; }).join('');
  const W = WEAPONS[cur]; const c = PC.CAMOS.find(x => x.id === sel); const lock = c && (prof.lvl < c.lvl || (c.top && !auth.me));
  $('#invName').textContent = W.name; $('#invCls').textContent = W.cls || '';
  $('#invSkinName').textContent = sel === null || sel === undefined ? 'Usa tu camuflaje general' + (prof.camo ? ' (' + (PC.CAMOS.find(x => x.id === prof.camo) || {}).name + ')' : ' (ninguno)') : sel === 'none' ? 'Sin skin' : c ? c.name + (lock ? ' · ' + (c.top ? 'solo top 10 de la temporada' : 'se desbloquea en nivel ' + c.lvl) : '') : '';
  const changed = (sel === undefined ? own : sel) !== own; $('#invEquip').disabled = !changed || !!lock; $('#invEquip').textContent = changed ? (lock ? 'Bloqueada' : 'Equipar en ' + W.name) : 'Equipada';
  invBuildGun();
}
function openInv() { invSetup(); INV.open = true; INV.sel = undefined; INV.key = ''; $('#inv').hidden = false; drawInv(); }
function closeInv() { INV.open = false; $('#inv').hidden = true; if (INV.gun) { INV.scene.remove(INV.gun); INV.gun = null; INV.key = ''; } }
async function invSave(w, camo) {
  if (auth.me) { const r = await apiCall('/api/camo', { camo, w }); if (r.me) applyMe(r.me); else { toast(r.error || 'No se pudo guardar la skin'); return false; } }
  else { const cm = prof.camos || (prof.camos = {}); if (camo === null) delete cm[w]; else cm[w] = camo; saveProf(); }
  rebuildVMs(); drawProfile(); return true;
}
document.addEventListener('click', async e => {
  if (e.target.id === 'invOpen') { openInv(); return; }
  if (!INV.open) return;
  const wb = e.target.closest('.invW'); if (wb) { INV.w = wb.dataset.w; INV.sel = undefined; drawInv(); return; }
  const cb = e.target.closest('#invSkins .camo'); if (cb) { const v = cb.dataset.c || null; INV.sel = v; drawInv(); if (cb.getAttribute('aria-disabled') === 'true') sNoise(.05, .15, 600); return; }
});
$('#invEquip').onclick = async () => { const sel = INV.sel === undefined ? invSkinOf(INV.w) : INV.sel; if (await invSave(INV.w, sel)) { INV.sel = undefined; drawInv(); toast('Skin equipada en ' + WEAPONS[INV.w].name); } };
$('#invAll').onclick = async () => { const ids = INV_GROUPS.flatMap(g => g[1]).filter(id => invSkinOf(id) !== null); for (const id of ids) if (!(await invSave(id, null))) return; INV.sel = undefined; drawInv(); toast('Todas tus armas usan ahora el camuflaje general'); };
$('#invClose').onclick = () => closeInv();
$('#inv').addEventListener('pointerdown', e => { if (e.target === $('#inv')) closeInv(); });
$('#invView').addEventListener('pointerdown', e => { INV.drag = { x: e.clientX, r: INV.rot }; INV.auto = false; $('#invView').setPointerCapture(e.pointerId); });
$('#invView').addEventListener('pointermove', e => { if (INV.drag) INV.rot = INV.drag.r + (e.clientX - INV.drag.x) * .012; });
$('#invView').addEventListener('pointerup', () => { INV.drag = null; });
addEventListener('keydown', e => { if (INV.open && e.key === 'Escape') closeInv(); });

/* ================= CAMPO DE TIRO ================= */
const RG = { on: false, group: null, targets: [], chal: false, endT: 0, score: 0, shots: 0, hits: 0, heads: 0, kills: 0, reacts: [], nextT: 0, sug: 1 };
const TGM = { body: std({ color: 0xd9ccae, roughness: .85 }), ring: std({ color: 0xb8322a, roughness: .7 }), head: std({ color: 0xece2c8, roughness: .85 }), post: std({ color: 0x3b4450, metalness: .6, roughness: .45 }) };
const TGG = { body: new THREE.BoxGeometry(.56, 1.26, .05), ring: new THREE.BoxGeometry(.26, .26, .06), head: new THREE.BoxGeometry(.3, .3, .05), post: new THREE.BoxGeometry(.06, .34, .06) };
function rangeStart() {
  rangeStop(); RG.on = true; RG.group = new THREE.Group(); scene.add(RG.group);
  for (let i = 0; i < 4; i++) spawnTarget(false);
  setTimeout(() => { if (RG.on) announce('Campo de tiro', (isTouch ? 'Toca «Empezar desafío»' : 'Pulsa Enter') + ' para el desafío de 60 segundos. Con B compras cualquier arma gratis.', 4); }, 600);
}
function rangeStop() { if (RG.group) scene.remove(RG.group); RG.group = null; RG.targets = []; RG.on = false; RG.chal = false; $('#rangeEnd').hidden = true; $('#rangeBtn').hidden = true; }
function spawnTarget(chal) {
  for (let k = 0; k < 50; k++) {
    const x = rand(-11.5, 11.5), z = chal ? rand(-40, -8) : rand(-30, -8);
    if (!WORLD.walk[WORLD.cIdx(x, z)] || !WORLD.visible([0, 1.65, 1.5], [x, 1.2, z]) || !WORLD.visible([0, 1.65, 1.5], [x, 1.75, z])) continue;
    if (RG.targets.some(t => t.alive && Math.abs(t.g.position.x - x) < 1.6 && Math.abs(t.g.position.z - z) < 3)) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); };
    add(TGG.body, TGM.body, .95); add(TGG.ring, TGM.ring, 1.08); add(TGG.head, TGM.head, 1.76); add(TGG.post, TGM.post, .17);
    g.scale.y = .02; RG.group.add(g);
    const mv = Math.random() < (chal ? .5 : .3);
    const t = { g, vx: mv ? rand(1.3, 3.2) * (Math.random() < .5 ? -1 : 1) : 0, born: nowS(), alive: true, deadT: 0, chal, life: chal ? rand(2.4, 3.4) : 1e9 };
    RG.targets.push(t); return t;
  }
  return null;
}
function rangeHit(o, d, maxT) {
  let best = null;
  for (const t of RG.targets) {
    if (!t.alive || t.g.scale.y < .8) continue; const x = t.g.position.x, z = t.g.position.z;
    for (const [zone, b] of [['h', { minX: x - .15, maxX: x + .15, minY: 1.61, maxY: 1.91, minZ: z - .05, maxZ: z + .05 }], ['c', { minX: x - .28, maxX: x + .28, minY: .32, maxY: 1.58, minZ: z - .05, maxZ: z + .05 }]]) {
      const r = PC.rayBox(o, d, b, best ? best.t : maxT); if (r && r.t < (best ? best.t : maxT)) best = { t: r.t, zone, tg: t };
    }
  }
  return best;
}
function rangeOnHit(rh, end) {
  const t = rh.tg; if (!t.alive) return; t.alive = false; t.deadT = 0;
  const head = rh.zone === 'h'; burst(end, [0, 0, 1], [.85, .8, .7], 2, 8);
  sTone(head ? 2500 : 1700, .12, .16, 'triangle'); sNoise(.06, .2, 3200, 0, 0, 3); showHit(head, true);
  if (t.chal && RG.chal) { RG.kills++; if (head) RG.heads++; RG.score += head ? 150 : 100; RG.reacts.push(nowS() - t.born - .15); RG.nextT = nowS() + rand(.15, .45); }
}
function rangeChallenge() {
  if (!RG.on) return; $('#rangeEnd').hidden = true; blurUI();
  for (const t of RG.targets) if (t.alive) { t.alive = false; t.deadT = 0; }
  Object.assign(RG, { chal: true, endT: nowS() + 60, score: 0, shots: 0, hits: 0, heads: 0, kills: 0, reacts: [], nextT: nowS() + .8 });
  refillAmmo(); announce('¡Desafío!', '60 segundos: derriba todos los blancos que puedas', 1.4, 'var(--amber)'); sTone(880, .15, .15, 'square'); sTone(1320, .25, .15, 'square', 0, .18);
}
function rangeEnd() {
  RG.chal = false; for (const t of RG.targets) if (t.alive) { t.alive = false; t.deadT = 0; }
  const acc = RG.shots ? RG.hits / RG.shots : 0, hp = RG.kills ? RG.heads / RG.kills : 0, rt = RG.reacts.length ? RG.reacts.reduce((a, b) => a + b, 0) / RG.reacts.length : 0;
  const best = prefs.rangeBest || 0; const rec = RG.score > best; if (rec) { prefs.rangeBest = RG.score; savePrefs(); }
  $('#rgTitle').textContent = RG.score.toLocaleString('es-CL') + ' puntos' + (rec ? ' · ¡récord!' : '');
  $('#rgStats').innerHTML = [[RG.kills, 'Blancos derribados'], [Math.round(acc * 100) + '%', 'Precisión'], [Math.round(hp * 100) + '%', 'A la cabeza'], [rt ? Math.round(rt * 1000) + ' ms' : '—', 'Reacción media'], [(rec ? RG.score : best).toLocaleString('es-CL'), 'Tu récord']].map(([b, x]) => `<div class="stat"><b>${b}</b><span>${x}</span></div>`).join('');
  // sugerencia orientativa de sensibilidad
  let tip = 'Tu sensibilidad se ve equilibrada. Sigue practicando para bajar el tiempo de reacción.'; RG.sug = 1;
  if (RG.shots >= 8 && acc < .35) { RG.sug = .9; tip = 'Fallas muchos tiros: suele pasar cuando la mira se pasa del blanco. Prueba bajar la sensibilidad un 10%.'; }
  else if (RG.kills >= 4 && acc > .55 && rt > .95) { RG.sug = 1.1; tip = 'Eres preciso pero tardas en llegar al blanco. Prueba subir la sensibilidad un 10%.'; }
  if (isTouch) tip += ' En celular, la sensibilidad está en el menú de pausa.';
  $('#rgTip').textContent = tip; $('#rgApply').hidden = RG.sug === 1;
  $('#rgApply').textContent = RG.sug < 1 ? 'Bajar sensibilidad 10%' : 'Subir sensibilidad 10%';
  $('#rangeEnd').hidden = false; releaseLock(); sTone(660, .2, .15, 'triangle'); sTone(440, .3, .15, 'triangle', 0, .2);
}
function updateRange(dt) {
  if (!RG.on) return; const t0 = nowS();
  if (!$('#pause').hidden) { RG.endT += dt; RG.nextT += dt; for (const t of RG.targets) t.born += dt; return; }
  for (const t of RG.targets) {
    const g = t.g;
    if (t.alive) {
      g.scale.y = Math.min(1, g.scale.y + dt * 7);
      if (t.vx) { const nx = g.position.x + t.vx * dt; if (Math.abs(nx) > 11.5 || !WORLD.walk[WORLD.cIdx(nx, g.position.z)]) t.vx = -t.vx; else g.position.x = nx; }
      if (t.chal && t0 - t.born > t.life) { t.alive = false; t.deadT = 0; t.missed = true; if (RG.chal) RG.nextT = t0 + .1; }
    } else { t.deadT += dt; g.rotation.x = Math.max(-Math.PI / 2, g.rotation.x - dt * 9); if (t.missed) g.scale.y = Math.max(.02, g.scale.y - dt * 6); }
  }
  for (let i = RG.targets.length - 1; i >= 0; i--) if (!RG.targets[i].alive && RG.targets[i].deadT > .7) { RG.group.remove(RG.targets[i].g); RG.targets.splice(i, 1); }
  const live = RG.targets.filter(t => t.alive).length;
  if (RG.chal) { if (t0 >= RG.endT) rangeEnd(); else if (live < 2 && t0 >= RG.nextT) { spawnTarget(true); RG.nextT = t0 + rand(.25, .6); } }
  else if ($('#rangeEnd').hidden && live < 4 && !RG.targets.some(t => !t.alive)) spawnTarget(false);
}
$('#rangeBtn').addEventListener('click', e => { e.preventDefault(); rangeChallenge(); requestLock(true); });
$('#rgAgain').onclick = () => { rangeChallenge(); requestLock(true); };
$('#rgQuit').onclick = () => leaveToMenu();
$('#rgApply').onclick = () => { prefs.sens = Math.round(clamp(prefs.sens * RG.sug, .3, 2.4) * 100) / 100; savePrefs(); $('#sens').value = $('#sens2').value = prefs.sens; toast('Sensibilidad ajustada a ' + prefs.sens.toFixed(2)); $('#rgApply').hidden = true; };

/* ================= NOCHE Y CLIMA ================= */
let condKey = '', envGroup = null, flashOn = true, weatherFx = null, weatherNode = null;
const flashlight = new THREE.SpotLight(0xffeedd, 0, 42, .5, .8, 2); flashlight.position.set(.15, -.08, 0); flashlight.target.position.set(0, -.05, -1); camera.add(flashlight); camera.add(flashlight.target);
const glowWarm = texSpot('rgba(255,196,120,1)', .25);
function condLabel(c) { if (!c) return ''; if (c.night) return ' · de noche'; return { lluvia: ' · con lluvia', arena: ' · tormenta de arena', niebla: ' · con niebla', nieve: ' · nevando' }[c.weather] || ''; }
function stopWeatherSound() { if (!weatherNode) return; try { weatherNode.src.stop(); if (weatherNode.lfo) weatherNode.lfo.stop(); } catch (e) { } try { weatherNode.g.disconnect(); } catch (e) { } weatherNode = null; }
function weatherSound(kind) {
  stopWeatherSound(); if (!AC) return; let lfo = null; const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = AC.createBiquadFilter(); const g = AC.createGain();
  if (kind === 'lluvia') { f.type = 'highpass'; f.frequency.value = 1400; g.gain.value = .07; } else { f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = .6; g.gain.value = .11; lfo = AC.createOscillator(); const l = lfo; l.frequency.value = .17; const lg = AC.createGain(); lg.gain.value = .06; l.connect(lg); lg.connect(g.gain); l.start(); }
  src.connect(f); f.connect(g); g.connect(bus.amb); src.start(); weatherNode = { src, g, lfo };
}
function addNightLamps() {
  const M = WORLD.map; const pts = []; for (const k in M.sites) pts.push(M.sites[k].c);
  const avg = (l) => [l.reduce((a, p) => a + p[0], 0) / l.length, l.reduce((a, p) => a + p[1], 0) / l.length];
  pts.push(avg(M.spawns.atk), avg(M.spawns.def), [(M.bounds[0] + M.bounds[2]) / 2, (M.bounds[1] + M.bounds[3]) / 2]);
  const n = prefs.gfx === 'high' ? pts.length : 2;
  for (const [x, z] of pts.slice(0, n)) {
    const L = new THREE.PointLight(0xffc27a, 1.7, 24, 2); L.position.set(x, 4.6, z); envGroup.add(L);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowWarm, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(x, 4.6, z); sp.scale.set(1.6, 1.6, 1); envGroup.add(sp);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 })); lamp.position.set(x, 4.6, z); envGroup.add(lamp);
  }
}
function makeRain() {
  const N = prefs.gfx === 'high' ? 1600 : 650; const pos = new Float32Array(N * 6); const g = new THREE.BufferGeometry();
  for (let i = 0; i < N; i++) { const x = rand(-18, 18), y = rand(0, 16), z = rand(-18, 18); pos.set([x, y, z, x + .04, y + .55, z], i * 6); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c6d4, transparent: true, opacity: .45, depthWrite: false })); l.frustumCulled = false; envGroup.add(l);
  return { kind: 'lluvia', obj: l, N };
}
function makeSnowFx() {
  const N = prefs.gfx === 'high' ? 1400 : 550; const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([rand(-18, 18), rand(0, 14), rand(-18, 18)], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .09, transparent: true, opacity: .85, depthWrite: false })); p.frustumCulled = false; envGroup.add(p);
  return { kind: 'nieve', obj: p, N };
}
function makeSand() {
  const N = prefs.gfx === 'high' ? 1100 : 450; const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([rand(-18, 18), rand(0, 8), rand(-18, 18)], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc9a06a, size: .13, transparent: true, opacity: .6, depthWrite: false })); p.frustumCulled = false; envGroup.add(p);
  return { kind: 'arena', obj: p, N };
}
function updateWeather(dt) {
  flashlight.intensity = G.night && me.alive && flashOn && G.state === 'playing' ? 3.2 : 0;
  if (!weatherFx) return; const o = weatherFx.obj; o.position.set(Math.floor(camera.position.x / 4) * 4, 0, Math.floor(camera.position.z / 4) * 4);
  const a = o.geometry.attributes.position.array;
  if (weatherFx.kind === 'lluvia') { for (let i = 0; i < a.length; i += 6) { a[i + 1] -= 24 * dt; a[i + 4] -= 24 * dt; if (a[i + 1] < 0) { const x = rand(-18, 18), z = rand(-18, 18), y = rand(12, 16); a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = x + .04; a[i + 4] = y + .55; a[i + 5] = z; } } }
  else if (weatherFx.kind === 'nieve') { const t = nowS(); for (let i = 0; i < a.length; i += 3) { a[i + 1] -= 1.6 * dt; a[i] += Math.sin(t * .8 + i) * dt * .5 + .6 * dt; if (a[i + 1] < 0) { a[i] = rand(-18, 18); a[i + 1] = rand(12, 14); a[i + 2] = rand(-18, 18); } } }
  else { const t = nowS(); for (let i = 0; i < a.length; i += 3) { a[i] += (9 + Math.sin(t + i) * 2) * dt; a[i + 1] += Math.sin(t * 2 + i * .3) * dt * .6; if (a[i] > 18) { a[i] = -18; a[i + 1] = rand(0, 8); a[i + 2] = rand(-18, 18); } } }
  o.geometry.attributes.position.needsUpdate = true;
}
function applyCond(cond) {
  const c = cond || { night: false, weather: null }; if (!WORLD) return; const key = (c.night ? 'n' : 'd') + (c.weather || '') + '|' + CURMAP; if (key === condKey) return; condKey = key;
  const T = THEMES[WORLD.map.theme];
  skyU.top.value.set(...T.top); skyU.hor.value.set(...T.hor); scene.fog.color.setHex(T.fog); scene.fog.density = T.fogD; hemi.color.setHex(T.hs); hemi.groundColor.setHex(T.hg); hemi.intensity = T.hi; sun.color.setHex(T.sunC); sun.intensity = T.sunI;
  if (envGroup) { scene.remove(envGroup); envGroup.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } envGroup = new THREE.Group(); scene.add(envGroup); weatherFx = null; stopWeatherSound();
  let th = .93;
  if (c.night) { skyU.top.value.set(.015, .025, .07); skyU.hor.value.set(.06, .075, .13); scene.fog.color.setHex(0x0b1120); scene.fog.density = .017; hemi.color.setHex(0x3a4a70); hemi.groundColor.setHex(0x0e0f14); hemi.intensity = .34; sun.color.setHex(0x9db4ff); sun.intensity = .3; th = .82; addNightLamps(); }
  if (c.weather === 'lluvia') { skyU.top.value.set(.22, .25, .3); skyU.hor.value.set(.42, .45, .5); scene.fog.color.setHex(0x5a626c); scene.fog.density = .02; sun.intensity *= .45; hemi.intensity *= .85; weatherFx = makeRain(); weatherSound('lluvia'); }
  if (c.weather === 'arena') { skyU.top.value.set(.55, .42, .28); skyU.hor.value.set(.78, .6, .4); scene.fog.color.setHex(0xa8824f); scene.fog.density = .03; sun.intensity *= .55; weatherFx = makeSand(); weatherSound('arena'); }
  if (c.weather === 'nieve') { skyU.top.value.set(.55, .6, .68); skyU.hor.value.set(.82, .85, .9); scene.fog.color.setHex(0xcfd8e2); scene.fog.density = .026; sun.intensity *= .55; weatherFx = makeSnowFx(); weatherSound('nieve'); }
  if (c.weather === 'niebla') { skyU.top.value.set(.6, .66, .72); skyU.hor.value.set(.8, .83, .86); scene.fog.color.setHex(0xc5ccd3); scene.fog.density = .034; sun.intensity *= .6; }
  vmSun.intensity = c.night ? .3 : 1.1; vmHemi.intensity = c.night ? .45 : .8;
  if (post.bloom) post.bloom.threshold = th; G.night = !!c.night;
}

/* ================= POSPROCESADO ================= */
const post = { composer: null, grade: null, fxaa: null, vmPass: null, bloom: null, sat: 1.06 };
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, sat: { value: 1.06 }, contrast: { value: 1.07 }, vig: { value: .32 }, grain: { value: .025 }, hurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform sampler2D tDiffuse;uniform float time,sat,contrast,vig,grain,hurt;varying vec2 vUv;' +
    'vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}' +
    'void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;c=mix(c,aces(c*1.08),.55);float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,sat);c=(c-.5)*contrast+.5;' +
    'c+=mix(vec3(-.012,.0,.022),vec3(.022,.012,-.012),smoothstep(.15,.85,l));float d=distance(vUv,vec2(.5));c*=1.-vig*smoothstep(.42,.9,d);' +
    'c=mix(c,c*vec3(1.25,.55,.5),hurt*smoothstep(.3,.8,d));float n=fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.,1.)))*43758.5453);c+=(n-.5)*grain;gl_FragColor=vec4(clamp(c,0.,1.),1.);}'
};
function disposePost() {
  const c = post.composer; if (!c) return; post.composer = null;
  try { c.renderTarget1.dispose(); c.renderTarget2.dispose(); for (const p of c.passes) { if (p.dispose) p.dispose(); if (p.material && p.material.dispose) p.material.dispose(); } } catch (e) { }
}
function setupPost() {
  disposePost();
  if (prefs.gfx !== 'high' || !THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass || !THREE.UnrealBloomPass) return;
  try {
    let rt = null; const pr = renderer.getPixelRatio();
    if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) { rt = new THREE.WebGLMultisampleRenderTarget(Math.max(1, Math.floor(innerWidth * pr)), Math.max(1, Math.floor(innerHeight * pr)), { format: THREE.RGBAFormat }); rt.samples = 4; }
    const c = new THREE.EffectComposer(renderer, rt || undefined); post.fxaa = null;
    c.addPass(new THREE.RenderPass(scene, camera));
    const vp = new THREE.RenderPass(vmScene, vmCam); vp.clear = false; vp.clearDepth = true; c.addPass(vp); post.vmPass = vp;
    post.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .28, .45, .93); c.addPass(post.bloom);
    post.grade = new THREE.ShaderPass(GradeShader); c.addPass(post.grade);
    if (!rt && THREE.FXAAShader) { post.fxaa = new THREE.ShaderPass(THREE.FXAAShader); c.addPass(post.fxaa); }
    post.composer = c; resizePost();
  } catch (e) { post.composer = null; }
}
function resizePost() {
  if (!post.composer) return; const pr = renderer.getPixelRatio(); post.composer.setPixelRatio(pr); post.composer.setSize(innerWidth, innerHeight);
  if (post.fxaa) post.fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
}
function applyGfx() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, prefs.gfx === 'high' ? (isTouch ? 1.5 : 2) : 1));
  const sm = prefs.gfx === 'high' ? 2048 : 1024; if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resize(); setupPost();
}

/* ================= CICLO ================= */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); vmCam.aspect = w / h; vmCam.updateProjectionMatrix(); resizePost(); }
addEventListener('resize', resize); resize();
buildWorld(prefs.map); applyGfx();
let last = performance.now(), menuT = 0;
// Resolución adaptable: si los cuadros por segundo caen, baja la resolución interna; si sobra margen, la sube
const perf = { acc: 0, n: 0, slow: 0, fast: 0, level: 0 };
const PR_STEPS = [2, 1.75, 1.5, 1.25, 1];
function adaptRes(dtReal) {
  if (prefs.gfx !== 'high' || G.state !== 'playing' || document.hidden) return;
  perf.acc += dtReal; perf.n++; if (perf.acc < 1) return;
  const fps = perf.n / perf.acc; perf.acc = 0; perf.n = 0;
  if (fps < 48) { perf.slow++; perf.fast = 0; } else if (fps > 58) { perf.fast++; perf.slow = 0; } else { perf.slow = perf.fast = 0; }
  const maxPr = Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2); let idx = -1;
  if (perf.slow >= 2) idx = 1; else if (perf.fast >= 8) idx = -1; else return;
  perf.slow = perf.fast = 0;
  const cur = renderer.getPixelRatio(); const list = PR_STEPS.filter(v => v <= maxPr + 1e-6); let i = list.findIndex(v => Math.abs(v - cur) < .01); if (i < 0) i = 0;
  const ni = clamp(i + idx, 0, list.length - 1); if (ni === i) return;
  renderer.setPixelRatio(list[ni]); resize();
}
function frame(now) {
  requestAnimationFrame(frame); const dtReal = (now - last) / 1000; const dt = Math.min(.05, dtReal); last = now; if (dtReal > 0 && dtReal < .5) adaptRes(dtReal);
  if (G.state === 'playing' && WORLD) {

    updateWeather(dt);
    updateLocal(dt); updateArc(); sendInput(); updateRemotes(dt); updateFx(dt); animSmokes(); animFires(dt);
    // cámara
    if (me.alive) {
      camera.position.set(me.pos.x, me.pos.y + me.h - .12, me.pos.z);
      const bob = Math.hypot(me.vel.x, me.vel.z) > .5 && me.grounded ? Math.sin(vm.bobT * 2) * .03 : 0; camera.position.y += bob - Math.sin((me.landT || 0) * Math.PI) * .12;
      camera.rotation.set(me.pitch + me.punchP, me.yaw + me.punchY, me.roll || 0); camYaw = me.yaw;
    } else {
      const tg = me.deadT > 1.2 ? specTarget() : null;
      if (kcActive() && kc.cam) { const c = kc.cam; camera.position.set(c.x, c.y, c.z); camera.rotation.set(c.pitch, c.yaw, 0); camYaw = c.yaw; }
      else if (tg) {
        // primera persona del compañero, con el giro suavizado (los datos de red llegan a saltos)
        if (spec.id !== tg.id) { spec.id = tg.id; spec.yaw = tg.yaw; spec.pitch = tg.pitch; spec.x = tg.pos.x; spec.y = tg.pos.y + tg.h - .12; spec.z = tg.pos.z; }
        const kk = 1 - Math.exp(-dt * 16); spec.yaw += angDiff(spec.yaw, tg.yaw) * kk; spec.pitch = lerp(spec.pitch, tg.pitch, kk);
        const kp = 1 - Math.exp(-dt * 22); spec.x = lerp(spec.x, tg.pos.x, kp); spec.y = lerp(spec.y, tg.pos.y + tg.h - .12, kp); spec.z = lerp(spec.z, tg.pos.z, kp);
        camera.position.set(spec.x, spec.y, spec.z); camera.rotation.set(spec.pitch, spec.yaw, 0); camYaw = spec.yaw;
      }
      else { const k = Math.min(1, me.deadT * 2); camera.position.set(me.pos.x, me.pos.y + lerp(1.6, .4, k), me.pos.z); camera.rotation.set(me.pitch * (1 - k) - .2 * k, me.yaw, .5 * k); camYaw = me.yaw; }
    }
    if (shake > 0) { shake = Math.max(0, shake - dt * 2); camera.rotation.x += gauss() * shake * .03; camera.rotation.y += gauss() * shake * .03; }
    const w = WEAPONS[me.cur]; const adsF = w && w.auto ? 58 : 64; const fovT = w && w.scope ? lerp(74, me.cur === 'sr' ? 18 : 26, me.scopeK) : lerp(74, adsF, me.adsK || 0); if (Math.abs(camera.fov - fovT) > .01) { camera.fov = fovT; camera.updateProjectionMatrix(); }
    if (me.alive && me.scopeK > .5) { const tt = nowS(), mv = Math.min(1, Math.hypot(me.vel.x, me.vel.z) / 3); camera.rotation.x += Math.sin(tt * 1.3) * .0012 * (1 + mv * 4); camera.rotation.y += Math.sin(tt * .9) * .0014 * (1 + mv * 4); }
    updateVM(dt); updateRange(dt); updateHUD(dt); radarT += dt; if (radarT >= .05) { radarT = 0; drawRadar(); }
  } else {
    menuT += dt * .04; const M = MAPS[CURMAP]; const cx = (M.bounds[0] + M.bounds[2]) / 2, cz = (M.bounds[1] + M.bounds[3]) / 2;
    camera.position.set(cx + Math.cos(menuT) * 34, 16, cz + Math.sin(menuT) * 26); camera.lookAt(cx, 1.5, cz); if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    animSmokes();
  }
  sky.position.copy(camera.position);
  const showVm = G.state === 'playing' && vm.group.visible;
  if (INV.open) renderInv(now);
  if (post.composer) {
    post.vmPass.enabled = showVm; const u = post.grade.uniforms; u.time.value = now * .001 % 100; u.sat.value = post.sat;
    u.hurt.value = G.state === 'playing' && me.alive ? clamp((nowS() - (me.lastHurt || -9) < .4 ? .8 : 0) + (me.hp < 30 ? .35 : 0), 0, 1) : 0;
    post.composer.render();
  } else { renderer.clear(); renderer.render(scene, camera); if (showVm) { renderer.clearDepth(); renderer.render(vmScene, vmCam); } }
}
function updateSpecVM(dt) {
  const kcOn = kcActive(); let view = null, team = me.team;
  if (kcOn) { if (kc.phase === 'eyes' && kc.view) { view = kc.view; team = kc.kteam; } }
  else if (me.deadT > 1.2) { const tg = specTarget(); if (tg) view = { cur: tg.cur, spd: Math.hypot(tg.vx || 0, tg.vz || 0) }; team = tg ? tg.team : me.team; }
  if (!view || !vm.models[view.cur]) { vm.group.visible = false; return; }
  if (vm.spec !== view.cur || vm.specTeam !== team) { vm.spec = view.cur; vm.specTeam = team; showVM(view.cur); PCM.setFpTeam(team); }
  const g = vm.cur; if (!g) { vm.group.visible = false; return; } vm.group.visible = true;
  vm.kick = lerp(vm.kick, 0, 1 - Math.exp(-dt * 18)); vm.bobT += dt * Math.min(view.spd, 6) * 1.7;
  const m = Math.min(1, view.spd / 4), bx = Math.sin(vm.bobT) * .011 * m, by = Math.abs(Math.cos(vm.bobT)) * .009 * m;
  g.g.position.set(g.pos[0] + bx, g.pos[1] - by, g.pos[2] + vm.kick * .035); g.g.rotation.set(vm.kick * .05, 0, 0);
  vm.flashT = (vm.flashT || 0) - dt; g.flash.visible = vm.flashT > 0; g.flash.material.rotation = Math.random() * 6; g.light.intensity = vm.flashT > 0 ? 3 : 0;
}
function updateVM(dt) {
  if (!me.alive) { updateSpecVM(dt); return; }
  if (vm.spec) { vm.spec = null; vm.specTeam = null; PCM.setFpTeam(me.team); showVM(me.cur); }
  const g = vm.cur; if (!g) return; vm.group.visible = me.alive && me.scopeK < .5;
  vm.kick = lerp(vm.kick, 0, 1 - Math.exp(-dt * 18)); vm.swing = Math.max(0, vm.swing - dt * 3); vm.throwT = Math.max(0, vm.throwT - dt * 2.5);
  const isKnife = !!(WEAPONS[me.cur] && WEAPONS[me.cur].melee), bobK = isKnife ? 1.9 : 1;
  const spd = Math.hypot(me.vel.x, me.vel.z); const bx = Math.sin(vm.bobT) * .011 * bobK * Math.min(1, spd / 4), by = Math.abs(Math.cos(vm.bobT)) * .009 * bobK * Math.min(1, spd / 4);
  // movimiento propio: tajo, estocada, respiración del cuchillo e inspección
  vm.slash = Math.max(0, vm.slash - dt / .34); vm.stab = Math.max(0, vm.stab - dt / .62);
  if (me.fireHeld && !isKnife || me.reloadT > 0 || (me.adsK || 0) > .1 || me.scoped || !me.alive) vm.inspT = 0;
  let ox = 0, oy = 0, oz = 0, rx = 0, ry = 0, rz = 0;
  if (vm.slash > 0) { const k = 1 - vm.slash, sd = vm.slashSide, e = k * k * (3 - 2 * k), arc = Math.sin(k * Math.PI); ox += lerp(.13, -.17, e) * sd; oy += arc * .06 - .02; oz -= arc * .09; rz += lerp(.95, -1.05, e) * sd; rx -= arc * .55; ry += lerp(.5, -.45, e) * sd; }
  if (vm.stab > 0) { const k = 1 - vm.stab; const w = k < .35 ? -Math.sin(k / .35 * Math.PI / 2) * .08 : k < .5 ? lerp(-.08, .26, (k - .35) / .15) : lerp(.26, 0, (k - .5) / .5); oz -= w; oy += k < .35 ? .04 * k / .35 : .04 * Math.max(0, 1 - (k - .35) / .3); rx += -.25 * Math.sin(Math.min(1, k * 1.6) * Math.PI); }
  if (isKnife && vm.slash <= 0 && vm.stab <= 0) { const tt = nowS(); ox += Math.sin(tt * 1.3) * .004; oy += Math.sin(tt * 2.1) * .003; rz += Math.sin(tt * 1.1) * .035; }
  if (isKnife && me.drawT > 0) rx += (me.drawT / .3) * Math.PI * 2;
  if (vm.inspT > 0) { vm.inspT -= dt; const k = 1 - vm.inspT / INSP; const e = Math.sin(Math.min(1, k / .16) * Math.PI / 2) * Math.sin(Math.min(1, (1 - k) / .16) * Math.PI / 2);
    if (isKnife) { const sp = clamp((k - .2) / .5, 0, 1); ry += e * .7 + sp * sp * (3 - 2 * sp) * Math.PI * 2; rz += e * .4; ox -= e * .05; oy += e * .04; }
    else { ry += e * (.95 + Math.sin(k * Math.PI * 2) * .3); rz += e * (.3 + (k > .55 ? Math.sin((k - .55) / .45 * Math.PI) * .5 : 0)); rx += e * (k > .55 ? -.25 : .08); ox -= e * .07; oy += e * .035; oz += e * .05; } }
  const reloadK = me.reloadT > 0 ? Math.sin(Math.min(1, 1 - me.reloadT / (WEAPONS[me.cur].reload || 1)) * Math.PI) : 0;
  const draw = me.drawT > 0 ? me.drawT / .5 : 0;
  const ak = me.adsK || 0, ap = g.ads || g.pos, calm = 1 - ak * .85;
  const px = lerp(g.pos[0], ap[0], ak), py = lerp(g.pos[1], ap[1], ak), pz = lerp(g.pos[2], ap[2], ak);
  vm.swX = lerp(vm.swX || 0, 0, 1 - Math.exp(-dt * 8)); vm.swY = lerp(vm.swY || 0, 0, 1 - Math.exp(-dt * 8)); me.recoilJolt = Math.max(0, (me.recoilJolt || 0) - dt * 6);
  const land = Math.sin((me.landT || 0) * Math.PI) * .03;
  g.g.position.set(px + ox + (bx + vm.swing * -.08 - vm.swX * .02) * calm, py + oy + (-by - reloadK * .09 - (isKnife ? 0 : draw * .25) + (me.nadeArm ? .05 : 0) + vm.swY * .015 - land) * calm, pz + oz + vm.kick * (.035 - ak * .02) - vm.throwT * .15 + (me.recoilJolt || 0) * .02 * calm);
  g.g.rotation.set(rx + (vm.kick * .05 + vm.swY * .05) * calm + reloadK * .55 + (isKnife ? 0 : draw * -.6) + vm.swing * -.6, ry + vm.swing * 1.2 + vm.swX * .08 * calm, rz + reloadK * -.35 + vm.swing * .3 + (vm.swX * .05 - (me.roll || 0) * 1.5) * calm);
  vm.flashT = (vm.flashT || 0) - dt; g.flash.visible = vm.flashT > 0; g.flash.material.rotation = Math.random() * 6; g.light.intensity = vm.flashT > 0 ? 3 : 0;
}
drawProfile(); restoreSession();
if (/[?&]debug=1/.test(location.search)) window.__pc = { me, vm, applyCond, buildWorld, renderer, applyGfx, RG, rangeOnHit, rangeEnd, net, get kc() { return kc; } };
requestAnimationFrame(frame);
})();
