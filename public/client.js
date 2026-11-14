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
// Modo de control: una PC con pantalla táctil o lápiz sigue siendo PC si tiene mouse o panel táctil (puntero fino).
// Se puede forzar desde el menú (prefs.input = 'pc' | 'touch').
const INPUT_OVR = (() => { try { return JSON.parse(localStorage.getItem('pc2_prefs') || '{}').input || 'auto'; } catch (e) { return 'auto'; } })();
const isTouch = INPUT_OVR === 'pc' ? false : INPUT_OVR === 'touch' ? true
  : matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches);
const nowS = () => performance.now() / 1000;
const TEAMC = ['#5cc8e0', '#ef6a45'], TEAMN = ['Halcón', 'Cobra'];
const SIDE_N = { atk: 'Terroristas', def: 'Antiterroristas' }, SIDE_L = { atk: 'terroristas', def: 'antiterroristas' };
const SHORT = { k11: 'K-11', pump: 'P-12', bp9: 'BP-9', dmr: 'M-14', ax50: 'AX-50', b3: 'B-3', knife: 'CUCHILLO', p9: 'P-9', r50: 'R-50', smg: 'SMG-9', ar: 'AR-17', sr: 'SR-8', ap18: 'AP-18', es12: 'ES-12', fr9: 'FR-9', lmg: 'LMG-60', tr7: 'TR-7', he: 'HE', in: 'FUEGO', bomb: 'CARGA' };
const PIST = new Set(['p9', 'r50', 'ap18']);
const NADE_IDS = ['he', 'fl', 'sm', 'in', 'de'];
const GUN_IDS = Object.keys(WEAPONS).concat(NADE_IDS);

/* ---------- Preferencias ---------- */
let prefs = { name: '', sens: 1, map: 'alcazaba', diff: 'veterano', side: 'auto', gm: 'bomb', gfx: isTouch ? 'low' : 'high' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('pc2_prefs') || '{}')); } catch (e) { }
if (!MAPS[prefs.map]) prefs.map = 'alcazaba'; prefs.vol = Object.assign({ m: 1, fx: 1, amb: 1, ui: 1 }, prefs.vol || {}); prefs.mc = Object.assign({ sensT: 1, gyro: 'off', gyroS: 1, gyroInv: false, autoFire: false }, prefs.mc || {}); if (!['low', 'high', 'ultra'].includes(prefs.gfx)) prefs.gfx = 'high';
if (isTouch && prefs.gfxV !== 2) { if (prefs.gfx === 'low') prefs.gfx = 'high'; prefs.gfxV = 2; try { localStorage.setItem('pc2_prefs', JSON.stringify(prefs)); } catch (e) { } }
let prof = { xp: 0, lvl: 1, camo: null, day: '', ch: [] };
try { Object.assign(prof, JSON.parse(localStorage.getItem('pc2_prof') || '{}')); } catch (e) { }
if (prof.camo && !(PC.CAMOS.find(c => c.id === prof.camo && c.lvl <= prof.lvl && !c.top && !c.pass))) prof.camo = null;
if (prof.camos) for (const k of Object.keys(prof.camos)) if (prof.camos[k] !== 'none' && !(PC.CAMOS.find(c => c.id === prof.camos[k] && c.lvl <= prof.lvl && !c.top && !c.pass))) delete prof.camos[k];
const camoLocked = c => !!c && (prof.lvl < c.lvl || (c.top && !auth.me) || (c.pass && !(prof.owned || []).includes('camo:' + c.id)));
const camoLockTxt = c => c.top ? 'solo top ' + c.top + ' de la temporada' : c.pass ? 'se gana en el pase de temporada' : 'se desbloquea en nivel ' + c.lvl;
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
const skyU = { top: { value: new THREE.Vector3(.33, .55, .82) }, hor: { value: new THREE.Vector3(.86, .8, .7) }, sunDir: { value: new THREE.Vector3(.4, .8, .3).normalize() }, time: { value: 0 }, night: { value: 0 }, cloud: { value: .35 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: [
    'uniform vec3 top;uniform vec3 hor;uniform vec3 sunDir;uniform float time;uniform float night;uniform float cloud;varying vec3 vW;',
    'float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n2(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){vec3 d=normalize(vW-cameraPosition);float h=d.y;',
    'vec3 c=mix(hor,top,pow(smoothstep(0.,.6,h),.8));c=mix(c,hor*.78,smoothstep(0.,-.22,h));',
    'float s=max(dot(d,sunDir),0.);',
    'c+=vec3(1.,.82,.58)*pow(s,6.)*.32*(1.-night)+vec3(1.,.96,.88)*smoothstep(.9994,.9998,s)*3.*(1.-night);',
    // nubes: proyección sobre una cúpula, se mueven con el viento
    'if(h>0.){vec2 uv=d.xz/(h+.12)*1.4+vec2(time*.012,time*.004);float cl=fbm(uv);float cov=smoothstep(1.-cloud-.2,1.-cloud+.25,cl)*smoothstep(0.,.18,h);',
    'vec3 lit=mix(vec3(1.,.97,.93),hor*1.1,.25)*(1.-night*.85)+vec3(1.,.75,.5)*pow(s,4.)*.35*(1.-night);vec3 dark=mix(hor,top,.5)*.72*(1.-night*.6);',
    'c=mix(c,mix(dark,lit,smoothstep(.35,.85,fbm(uv+vec2(.15,.1)))),cov*.85);',
    // estrellas y luna de noche
    'if(night>.5){vec2 g=floor(d.xz/(h+.2)*90.+vec2(d.y*40.));float st=step(.9965,h1(g))*smoothstep(.05,.3,h)*(1.-cov);c+=vec3(.85,.9,1.)*st*(.6+.4*sin(time*2.+h1(g)*30.));',
    'vec3 md=normalize(vec3(-.4,.55,-.6));float m=max(dot(d,md),0.);c+=vec3(.9,.93,1.)*smoothstep(.9993,.9996,m)*1.4+vec3(.5,.6,.8)*pow(m,60.)*.25;}}',
    'gl_FragColor=vec4(c,1.);}'].join('\n')
}));
sky.renderOrder = -1; scene.add(sky);
const hemi = new THREE.HemisphereLight(0xbfd8f5, 0x9c8160, .75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.0); sun.castShadow = true;
const SM = prefs.gfx === 'ultra' ? 4096 : prefs.gfx !== 'low' && !isTouch ? 2048 : 1024; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(sun); scene.add(sun.target);
const THEMES = {
  desert: { top: [.30, .52, .80], hor: [.88, .82, .72], fog: 0xd8cbb0, fogD: .0058, sun: [.42, .62, .32], sunC: 0xffe8c8, sunI: 1.55, hs: 0xb4cce6, hg: 0x8a704f, hi: .55 },
  rural: { top: [.12, .36, .84], hor: [.68, .8, .95], fog: 0xb6c8de, fogD: .0042, sun: [.32, .86, .38], sunC: 0xfff4e2, sunI: 1.4, hs: 0xbad4f4, hg: 0x6c7448, hi: .55, sat: 1.12 },
  city: { top: [.30, .40, .56], hor: [.70, .74, .80], fog: 0x8d97a6, fogD: .0075, sun: [.55, .55, -.45], sunC: 0xffe6c4, sunI: 1.3, hs: 0xa8bcd8, hg: 0x4a4e56, hi: .7, sat: 1.0 },
  snow: { top: [.34, .52, .78], hor: [.86, .9, .95], fog: 0xd8e2ec, fogD: .0065, sun: [-.5, .42, .5], sunC: 0xfff0dc, sunI: 1.25, hs: 0xd4e4f8, hg: 0x8a96a8, hi: .78, sat: .96 },
  port: { top: [.24, .32, .46], hor: [.84, .62, .45], fog: 0xd09a70, fogD: .0095, sun: [-.78, .28, .34], sunC: 0xffc690, sunI: 1.9, hs: 0xb8cce2, hg: 0x7a5c40, hi: .88 },
  refinery: { top: [.2, .2, .36], hor: [1.0, .56, .32], fog: 0xb4795a, fogD: .0088, sun: [.82, .2, -.3], sunC: 0xffa25e, sunI: 1.85, hs: 0xffc6a0, hg: 0x4a3628, hi: .82, sat: 1.1 }
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
/* ---------- Relieve: mapas normales calculados desde las texturas (filtro Sobel sobre la luminancia) ---------- */
const NMC = new Map();
function normalOf(t, str) {
  if (NMC.has(t)) return NMC.get(t); const img = t.image; if (!img || !img.getContext) return null;
  const w = img.width, h = img.height, src = img.getContext('2d').getImageData(0, 0, w, h).data, Lm = new Float32Array(w * h);
  for (let k = 0, p = 0; k < Lm.length; k++, p += 4) Lm[k] = (src[p] * .3 + src[p + 1] * .59 + src[p + 2] * .11) / 255;
  const [c, x] = cnv(w, h), out = x.createImageData(w, h), D = out.data, L = (i, j) => Lm[((j + h) % h) * w + ((i + w) % w)];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (L(i + 1, j - 1) + 2 * L(i + 1, j) + L(i + 1, j + 1)) - (L(i - 1, j - 1) + 2 * L(i - 1, j) + L(i - 1, j + 1));
    const dy = (L(i - 1, j + 1) + 2 * L(i, j + 1) + L(i + 1, j + 1)) - (L(i - 1, j - 1) + 2 * L(i, j - 1) + L(i + 1, j - 1));
    const nx = -dx * str, ny = dy * str, l = Math.hypot(nx, ny, 1), k = (j * w + i) * 4;
    D[k] = (nx / l * .5 + .5) * 255; D[k + 1] = (ny / l * .5 + .5) * 255; D[k + 2] = (1 / l * .5 + .5) * 255; D[k + 3] = 255;
  }
  x.putImageData(out, 0, 0); const n = tex(c); n.repeat.copy(t.repeat); NMC.set(t, n); return n;
}
const NML = { bld: 2, bld2: 2, stone: 3, wood: 1.6, crate: 1.6, concrete: 2.2, slab: 2, ware: 2.6, ware2: 2.6, roof: 2.6, wareDark: 2.6, roofDark: 2.6, city: 1.2, city2: 1.2, stationH: 3, concrete2: 2, stoneC: 2.2, bench: 1.6, vine: 2, hedge: 2, snowpile: 1.2 };
function applyNormals(on) {
  for (const k in NML) { const m = MAT[k]; if (!m || !m.map) continue; const n = on ? normalOf(m.map, NML[k]) : null; if (m.normalMap !== n) { m.normalMap = n; if (n) m.normalScale = new THREE.Vector2(.85, .85); m.needsUpdate = true; } }
}
applyNormals(prefs.gfx !== 'low');
/* ---------- Iluminación de entorno: el cielo de cada mapa ilumina y se refleja en todo ---------- */
let envTex = null; const pmrem = new THREE.PMREMGenerator(renderer);
function setEnv(sunOn) {
  const [c, x] = cnv(256, 128); const v2c = (v, k = .72) => `rgb(${Math.min(255, v.x * 255 * k) | 0},${Math.min(255, v.y * 255 * k) | 0},${Math.min(255, v.z * 255 * k) | 0})`;
  const fg = scene.fog.color, gC = `rgb(${fg.r * 95 | 0},${fg.g * 88 | 0},${fg.b * 80 | 0})`;
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, v2c(skyU.top.value)); g.addColorStop(.46, v2c(skyU.hor.value)); g.addColorStop(.52, gC); g.addColorStop(1, gC); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  if (sunOn) { const d = skyU.sunDir.value; const u = (Math.atan2(d.x, -d.z) / (2 * Math.PI) + .5) * 256, vv = (Math.acos(clamp(d.y, -1, 1)) / Math.PI) * 128; const sg = x.createRadialGradient(u, vv, 0, u, vv, 26); sg.addColorStop(0, 'rgba(255,246,225,1)'); sg.addColorStop(1, 'rgba(255,246,225,0)'); x.fillStyle = sg; x.fillRect(0, 0, 256, 128); }
  const et = new THREE.CanvasTexture(c); et.mapping = THREE.EquirectangularReflectionMapping; const rt = pmrem.fromEquirectangular(et); et.dispose();
  if (envTex) envTex.dispose(); envTex = rt.texture; scene.environment = prefs.gfx === 'low' ? null : envTex;
}
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
const BRKM = new Map();
const BRK_COL = { crate: [.55, .4, .24], wood: [.5, .36, .22], bench: [.5, .36, .22], plank: [.55, .4, .24], glassC: [.75, .88, .95] };
function applyBreak(id, fx) {
  const b = WORLD.breakables[id]; if (!b || b.gone) return; WORLD.breakBox(b); const m = BRKM.get(id); if (m) m.visible = false;
  if (!fx) return; const p = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 }; const col = BRK_COL[b.mat] || [.6, .5, .4];
  for (let i = 0; i < 4; i++) burst(p, [rand(-1, 1), 1, rand(-1, 1)], col, 3.2, 12);
  const pa = posAudio(p.x, p.z), v = clamp(1 - pa.d / 45, .05, 1);
  if (b.mat === 'glassC') { for (let i = 0; i < 6; i++) sTone(rand(2600, 5200), rand(.08, .25), .06 * v, 'triangle', 0, i * .03); sNoise(.4, .45 * v, 5200, 0, pa.pan, 1.2); }
  else { sNoise(.25, .6 * v, 520, 0, pa.pan, 1.4); sNoise(.5, .35 * v, 260, .05, pa.pan, .9); sNoise(.12, .4 * v, 1900, .02, pa.pan, 2); }
}
function restoreBreaks() { WORLD.restoreAll(); for (const m of BRKM.values()) m.visible = true; }
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
  worldGroup = new THREE.Group(); scene.add(worldGroup); BRKM.clear();
  WORLD = new PC.World(mapId); CURMAP = mapId; const M = WORLD.map; const T = THEMES[M.theme]; const desert = M.theme === 'desert', rural = M.theme === 'rural', city = M.theme === 'city', snow = M.theme === 'snow';
  post.sat = T.sat || (desert ? 1.06 : 1.04);
  // ambiente
  skyU.top.value.set(...T.top); skyU.hor.value.set(...T.hor); skyU.sunDir.value.set(...T.sun).normalize();
  scene.fog.color.setHex(T.fog); scene.fog.density = T.fogD; hemi.color.setHex(T.hs); hemi.groundColor.setHex(T.hg); hemi.intensity = T.hi;
  sun.color.setHex(T.sunC); sun.intensity = T.sunI;
  const cx = (M.bounds[0] + M.bounds[2]) / 2, cz = (M.bounds[1] + M.bounds[3]) / 2, hw = (M.bounds[2] - M.bounds[0]) / 2 + 6, hd = (M.bounds[3] - M.bounds[1]) / 2 + 6;
  G.sunBase = { c: [cx, cz], d: T.sun.slice() };
  sun.position.set(cx + T.sun[0] * 120, T.sun[1] * 120, cz + T.sun[2] * 120); sun.target.position.set(cx, 0, cz);
  const R = Math.hypot(hw, hd); Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 20, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
  vmSun.color.setHex(T.sunC); vmHemi.color.setHex(T.hs); vmHemi.groundColor.setHex(T.hg);
  // suelo
  const gt = desert ? TX.sand : rural ? TX.gravel : city ? TX.asphalt : snow ? TX.snow : TX.concrete; const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std({ map: gt, color: desert || city || snow ? 0xffffff : rural ? 0x8f8676 : 0xb9ab96, roughness: city ? .55 : 1, metalness: city ? .15 : 0 }));
  ground.material.map = gt.clone(); ground.material.map.needsUpdate = true; ground.material.map.repeat.set(400 / 7, 400 / 7);
  if (prefs.gfx !== 'low') { const nm = normalOf(gt, desert ? 1.4 : snow ? 1 : 2.4); if (nm) { const n2 = nm.clone(); n2.needsUpdate = true; n2.repeat.set(400 / 7, 400 / 7); ground.material.normalMap = n2; ground.material.normalScale = new THREE.Vector2(.7, .7); } }
  G.groundMat = ground.material; G.groundBase = { r: ground.material.roughness, m: ground.material.metalness }; ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; worldGroup.add(ground);
  // cajas del mapa
  for (const b of WORLD.colliders) {
    if (b.mat === 'perim') continue;
    if (specialBox(b)) continue;
    const mat = MAT[b.mat] || MAT.stone; const s = TEXSCALE[b.mat] || 0;
    const bm = boxAt(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, mat, s);
    if (b.bid !== undefined) { bm.userData.keep = true; BRKM.set(b.bid, bm); continue; } // rompible: malla propia (no se funde) para poder ocultarla
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
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position || o.userData.keep) return;
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
  if (prefs.gfx === 'low') return;
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
  tufts([[-12, 3.5, -2.6, 11], [2.6, 3.5, 14, 11], [x0, z0, x1, -12], [19, -12, x1, 18], [x0, 18, -20, z1]], prefs.gfx !== 'low' ? 1400 : 500);
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
function tracer(a, b) { const t = fx.tracers[tIdx++ % fx.tracers.length]; const p = t.l.geometry.attributes.position.array; const k = .15; p[0] = lerp(a.x, b.x, k); p[1] = lerp(a.y, b.y, k); p[2] = lerp(a.z, b.z, k); p[3] = b.x; p[4] = b.y; p[5] = b.z; t.l.geometry.attributes.position.needsUpdate = true; t.l.visible = true; t.life = .05; streak(a, b); }
const decalGeo = new THREE.PlaneGeometry(.11, .11); const decalMat = new THREE.MeshBasicMaterial({ map: TX.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const DECALS = 200; const decalIM = new THREE.InstancedMesh(decalGeo, decalMat, DECALS); decalIM.frustumCulled = false; { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < DECALS; i++) decalIM.setMatrixAt(i, z); } scene.add(decalIM);
const _dO = new THREE.Object3D(); const _dC = new THREE.Color(1, 1, 1); for (let i = 0; i < DECALS; i++) decalIM.setColorAt(i, _dC);
const _v = new THREE.Vector3();
function clearDecals() { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < DECALS; i++) decalIM.setMatrixAt(i, z); decalIM.instanceMatrix.needsUpdate = true; fx.di = 0; }
function decal(p, n, tint) { const i = fx.di++ % DECALS; _dO.position.set(p.x + n[0] * .012, p.y + n[1] * .012, p.z + n[2] * .012); _v.set(_dO.position.x + n[0], _dO.position.y + n[1], _dO.position.z + n[2]); _dO.lookAt(_v); _dO.rotateZ(Math.random() * 6); _dO.scale.setScalar(rand(.8, 1.2)); _dO.updateMatrix(); decalIM.setMatrixAt(i, _dO.matrix); decalIM.instanceMatrix.needsUpdate = true; const tc = tint || [1, 1, 1]; _dC.setRGB(tc[0], tc[1], tc[2]); decalIM.setColorAt(i, _dC); decalIM.instanceColor.needsUpdate = true; }
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
// impactos según el material de la superficie
const SURF_OF = { metal: 'metal', metalP: 'metal', tank: 'metal', dumpster: 'metal', ware: 'metal', ware2: 'metal', wareDark: 'metal', kiosk: 'metal', pole: 'metal', stationH: 'metal', roofP: 'metal', roof: 'metal', barrier: 'metal',
  crate: 'wood', wood: 'wood', bench: 'wood', plank: 'wood', planter: 'wood', glassC: 'glass', snowpile: 'snow', tarp: 'soft' };
const GROUND_COL = { refinery: [.42, .39, .36], snow: [.9, .92, .96], desert: [.78, .64, .44], rural: [.4, .33, .22], city: [.5, .5, .49], port: [.48, .47, .45] };
function surfOf(stop) { if (!stop) { const th = MAPS[CURMAP] && MAPS[CURMAP].theme; return th === 'snow' ? 'snow' : 'ground'; } return SURF_OF[stop.mat] || 'stone'; }
// busca la caja en la que cayó un impacto remoto (solo llega el punto y la normal)
function stopAt(p, n) { if (!WORLD || !WORLD.colliders) return null; const x = p.x - n[0] * .03, y = p.y - n[1] * .03, z = p.z - n[2] * .03; for (const b of WORLD.colliders) if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ) return b; return null; }
const dpuffs = []; for (let i = 0; i < 28; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.smoke, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; scene.add(sp); dpuffs.push({ s: sp, life: 0, max: 1, sz: 1 }); } let dpI = 0;
function dustPuff(p, n, col, sz, life) { const q = dpuffs[dpI++ % dpuffs.length]; q.s.position.set(p.x + n[0] * .12, p.y + n[1] * .12, p.z + n[2] * .12); q.s.material.color.setRGB(col[0], col[1], col[2]); q.s.material.rotation = Math.random() * 6; q.life = q.max = life; q.sz = sz; q.s.visible = true; q.s.scale.setScalar(sz * .25); }
const DECAL_TINT = { metal: [1.6, 1.6, 1.7], wood: [1.15, .85, .6], glass: [2.2, 2.4, 2.6], stone: [1, 1, 1], ground: [.9, .85, .8], snow: [.8, .85, .95], soft: [1, 1, 1] };
function impactFx(end, n, stop, scale = 1) {
  const kind = surfOf(stop), few = prefs.gfx === 'low';
  if (kind !== 'soft') decal(end, n, DECAL_TINT[kind]);
  if (kind === 'metal') { sparks(end, n, Math.round((few ? 3 : 7) * scale)); burst(end, n, [.35, .35, .37], 2.6, Math.round(3 * scale)); if (!few) dustPuff(end, n, [.55, .55, .56], .5, .5); }
  else if (kind === 'wood') { burst(end, n, [.62, .45, .26], 3.4, Math.round(7 * scale)); if (!few) dustPuff(end, n, [.6, .5, .38], .6, .7); }
  else if (kind === 'glass') { burst(end, n, [.8, .92, 1], 3.8, Math.round(9 * scale)); sparks(end, n, 2); }
  else if (kind === 'snow') { burst(end, n, [.95, .97, 1], 2.2, Math.round(6 * scale)); if (!few) dustPuff(end, n, [.95, .96, 1], .9, 1.1); }
  else if (kind === 'ground') { const c = GROUND_COL[MAPS[CURMAP] && MAPS[CURMAP].theme] || [.5, .44, .34]; burst(end, n, c, 2.4, Math.round(6 * scale)); if (!few) dustPuff(end, n, c, .9, 1.2); }
  else if (kind === 'soft') { burst(end, n, [.55, .55, .5], 1.6, 3); }
  else { burst(end, n, [.62, .6, .56], 2.4, Math.round(6 * scale)); if (Math.random() < .35) sparks(end, n, 2); if (!few) dustPuff(end, n, [.7, .68, .64], .75, .9); }
}
// trazadoras luminosas: un trazo brillante que viaja del cañón al impacto
const streakGeo = new THREE.CylinderGeometry(.011, .011, 1, 5, 1, true); const streakMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const streaks = []; for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(streakGeo, streakMat); m.visible = false; m.frustumCulled = false; scene.add(m); streaks.push({ m, a: new THREE.Vector3(), d: new THREE.Vector3(), L: 0, t: 0 }); } let stI = 0;
const _yAx = new THREE.Vector3(0, 1, 0);
function streak(a, b) { if (prefs.gfx === 'low') return; const q = streaks[stI++ % streaks.length]; q.a.copy(a); q.d.subVectors(b, a); q.L = q.d.length(); if (q.L < 2) return; q.d.multiplyScalar(1 / q.L); q.t = 0; q.m.quaternion.setFromUnitVectors(_yAx, q.d); q.m.visible = true; }
// motas de polvo al sol
let dust = null;
function buildDust(on) {
  if (dust) { scene.remove(dust); dust.geometry.dispose(); dust.material.dispose(); dust = null; } if (!on || prefs.gfx === 'low') return;
  const N = 420, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-18, 18); pos[i * 3 + 1] = rand(.2, 6); pos[i * 3 + 2] = rand(-18, 18); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ size: .028, color: 0xfff2d6, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); dust.frustumCulled = false; scene.add(dust);
}
const boomLight = new THREE.PointLight(0xffb070, 0, 40); scene.add(boomLight);
function updateFx(dt) {
  { const c = $('#sprayPad'); if (c && c.hidden === RG.on) { c.hidden = !RG.on; if (RG.on) drawSprayPad(); } }
  updateLife(dt);
  roofedT -= dt; if (roofedT <= 0) { roofedT = .3; roofedNow = roofed(camera.position.x, camera.position.y, camera.position.z); }
  if (ambNode) { ambT -= dt; if (ambT <= 0) { ambT = rand(4, 11); ambOneShot(); } } else if (AC && WORLD && G.state === 'playing' && bus.amb) startAmbience();
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
  for (const q of dpuffs) if (q.life > 0) { q.life -= dt; const k = 1 - q.life / q.max; q.s.scale.setScalar(q.sz * (.25 + Math.sqrt(k) * .9)); q.s.position.y += dt * .25; q.s.material.opacity = (1 - k) * (1 - k) * .55; if (q.life <= 0) q.s.visible = false; }
  for (const q of streaks) if (q.m.visible) { q.t += dt * 260; const len = Math.min(3, q.L * .5), head = Math.min(q.t, q.L); if (q.t - len > q.L) { q.m.visible = false; continue; } const tail = Math.max(0, head - len); q.m.position.copy(q.a).addScaledVector(q.d, (head + tail) / 2); q.m.scale.set(1, Math.max(.01, head - tail), 1); }
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
  const N = prefs.gfx !== 'low' ? 34 : 16; for (let i = 0; i < N; i++) { const s = new THREE.Sprite(mat); const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r * .92; s.position.set(Math.cos(a) * rr, rand(.15, .6), Math.sin(a) * rr); s.userData = { b: rand(.5, 1.1), ph: Math.random() * 6 }; g.add(s); fl.push(s); }
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
function animSmokes() { const t = nowS(); for (const s of smokes.values()) { const grow = clamp((t - s.born) / 1.2, 0, 1), fade = clamp((s.until - t) / 2.5, 0, 1); const hk = s.hole ? clamp(Math.min((s.hole - t) / .3, 1 - (s.hole - t - 1.9) / .3), 0, 1) : 0; s.mat.opacity = Math.min(grow, fade) * .96 * (1 - hk * .85); s.g.scale.setScalar(.4 + .6 * grow); s.g.rotation.y += .0015; } }

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
// en segundo plano (otra pestaña, app minimizada o pantalla bloqueada) el juego se silencia; al volver, el sonido regresa
document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend().catch(() => {}); else AC.resume().catch(() => {}); });
addEventListener('pagehide', () => { if (AC) AC.suspend().catch(() => {}); });
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
const ECHO = { city: .3, port: .26, refinery: .32, desert: .2, snow: .17, rural: .12 };
function sShot(s, dist, pan, occ) {
  if (!AC || !s) return; const t = AC.currentTime; const far = clamp(dist / 90, 0, 1); const vol = s.vol * (dist < 1 ? 1 : clamp(1.5 / (1 + dist * .08), .04, 1)) * (occ ? .62 : 1);
  const ek = (WORLD ? ECHO[WORLD.map.theme] || .15 : .15) * (roofedNow ? .55 : 1.25), tail = roofedNow ? .12 : .75; if (ek > 0 && (dist < 1 || dist > 14)) { const e = AC.createBufferSource(); e.buffer = noiseBuf; const ef = AC.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = occ ? 420 : 900; const eg = AC.createGain(); const d0 = t + .08 + Math.min(dist, 80) * .003; eg.gain.setValueAtTime(.0001, t); eg.gain.linearRampToValueAtTime(vol * ek, d0); eg.gain.exponentialRampToValueAtTime(.001, d0 + tail + ek); const ep = panNode(-pan * .5); e.connect(ef); ef.connect(eg); eg.connect(ep); ep.connect(OUT()); e.start(t, Math.random() * .6, 2); }
  const src = AC.createBufferSource(); src.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(s.cut * (1 - far * .75) * (occ ? .3 : 1), t); f.frequency.exponentialRampToValueAtTime(260, t + s.dec);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + s.dec * (1 + far)); const p = panNode(pan);
  src.connect(f); f.connect(g); g.connect(p); p.connect(OUT()); src.start(t, Math.random() * 1.5, s.dec * 2 + .1);
  const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(s.thump, t); o.frequency.exponentialRampToValueAtTime(35, t + .14); const og = AC.createGain(); og.gain.setValueAtTime(vol * (1 - far) * .9, t); og.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(og); og.connect(p); o.start(t); o.stop(t + .2);
}
function killSound(head) { sNoise(.09, .45, 160, 0, 0, .8); sTone(620, .09, .16, 'triangle', 0, .02); sTone(930, .14, .16, 'triangle', 0, .08); sTone(1240, .22, .12, 'sine', 0, .14); if (head) { sTone(3100, .35, .1, 'sine', 2900, .05); sNoise(.12, .25, 5200, .05, 0, 4); } }
function sTone(freq, dur, vol, type = 'sine', slide, delay = 0) { if (!AC) return; const t = AC.currentTime + delay; const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(OUT()); o.start(t); o.stop(t + dur + .02); }
function sNoise(dur, vol, freq, delay = 0, pan = 0, q = 1.2) { if (!AC) return; const t = AC.currentTime + delay; const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); const p = panNode(pan); s.connect(f); f.connect(g); g.connect(p); p.connect(OUT()); s.start(t, Math.random(), dur + .05); }
function sBoom(dist, big) { if (!AC) return; const t = AC.currentTime; const vol = clamp(2 / (1 + dist * .05), .08, 1.4) * (big ? 1.4 : 1); const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 1600 : 2200, t); f.frequency.exponentialRampToValueAtTime(80, t + (big ? 2 : 1)); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + (big ? 2.4 : 1.2)); s.connect(f); f.connect(g); g.connect(OUT()); s.start(t, 0, 2.5); const o = AC.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(25, t + .6); const og = AC.createGain(); og.gain.setValueAtTime(vol * .9, t); og.gain.exponentialRampToValueAtTime(.001, t + .8); o.connect(og); og.connect(OUT()); o.start(t); o.stop(t + .9); }
function surfAtFeet(x, z, y) {
  if (!WORLD) return 'stone'; let best = null; for (const b of WORLD.colliders) if (b.mat !== 'perim' && x > b.minX - .05 && x < b.maxX + .05 && z > b.minZ - .05 && z < b.maxZ + .05 && Math.abs(b.maxY - y) < .2) { best = b; break; }
  if (best) { const k = SURF_OF[best.mat]; return k === 'metal' || best.mat === 'metalP' ? 'metal' : k === 'wood' ? 'wood' : k === 'snow' ? 'snow' : 'stone'; }
  const th = WORLD.map.theme; if (G.cond && G.cond.weather === 'lluvia') return 'water'; return th === 'snow' ? 'snow' : th === 'desert' ? 'sand' : th === 'rural' ? 'dirt' : 'stone';
}
// pasos distintos por superficie: metal resuena, madera golpea, nieve cruje, agua salpica, tierra y arena suenan suaves
function sStep(v, pan, surf) {
  pan = pan || 0;
  switch (surf) {
    case 'metal': sNoise(.05, v * 1.1, 2600 + Math.random() * 600, 0, pan, 3); sTone(rand(380, 520), .09, v * .35, 'triangle'); break;
    case 'wood': sNoise(.07, v * 1.1, 260 + Math.random() * 80, 0, pan, 2); sTone(rand(150, 190), .06, v * .3, 'sine'); break;
    case 'snow': sNoise(.13, v * .9, 1100 + Math.random() * 400, 0, pan, .7); sNoise(.06, v * .5, 3200, .04, pan, 1); break;
    case 'water': sNoise(.12, v * .9, 1900 + Math.random() * 500, 0, pan, .8); sNoise(.08, v * .6, 700, .03, pan, 1.2); break;
    case 'sand': case 'dirt': sNoise(.09, v * .8, 520 + Math.random() * 200, 0, pan, .9); break;
    default: sNoise(.06, v, 420 + Math.random() * 260, 0, pan, 1.6);
  }
}
// ¿bajo techo? (eco corto y seco) o al aire libre (cola larga)
function roofed(x, y, z) { if (!WORLD) return false; for (const b of WORLD.colliders) if (b.mat !== 'perim' && b.minY > y + .3 && b.minY < y + 7 && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true; return false; }
let roofedNow = false, roofedT = 0;
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
  if (!wid || me.cur === wid) return; me.lastCur = me.cur; me.cur = wid; me.burstLeft = 0; me.drawT = WEAPONS[wid] && WEAPONS[wid].melee ? .3 : .5; me.reloadT = 0; me.scoped = false; me.altScope = false; me.rescopeT = 0; me.adsToggle = false; me.adsK = 0; me.scopeK = 0; me.nadeArm = false; me.sprayI = 0; $('#bAds').classList.remove('on');
  ensureAmmo(wid); showVM(wid); if (send) sendMsg({ t: 'eq', w: wid }); drawSlots();
}

/* ================= ARMA EN PRIMERA PERSONA ================= */
const vm = { group: new THREE.Group(), models: {}, cur: null, kick: 0, bobT: 0, swing: 0, throwT: 0, slash: 0, stab: 0, slashSide: 1, inspT: 0 };
const INSP = 2.6;
vmScene.add(vm.group);
const VMPOS = { rifle: [.15, -.18, -.44], pistol: [.12, -.14, -.38], knife: [.18, -.19, -.42], nade: [.2, -.21, -.48] }, VMS = .78;
function buildVM(id) {
  const g = PCM.buildGun(id, { shadow: false, camo: PCM.camoFor(mySkin(), id) }); const info = g.userData.info; const pos = VMPOS[info.cls] || VMPOS.rifle;
  PCM.fpArms(g, pos, VMS); PCM.addCharm(g, myCharm());
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
  const room = new PC.Room({ code: 'LOCAL', map: prefs.map, diff: prefs.diff, isPublic: false, mode: opt.range ? 'range' : prefs.gm, rules: opt.range ? null : prefs.rules }); net.room = room;
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
      setBusy(false); G.code = m.code; G.mapId = m.map; G.pub = m.pub; G.mode = m.gm === 'comp' ? 'bomb' : m.gm || 'bomb'; G.comp = m.gm === 'comp' || (net.mode === 'offline' && prefs.gm === 'comp'); G.cond = m.cond || null; me.id = m.you; me.team = m.team;
      buildWorld(m.map); PCM.setFpTeam(me.team); for (const a of actors) if (a && a.model) scene.remove(a.model.g); actors.length = 0;
      enterGame(); break;
    }
    case 'r': {
      G.roster = m.r; if (m.gm) G.mode = m.gm; if (m.rules) { G.rules = m.rules; G.comp = m.rules.rounds === 24; } if (m.map && m.map !== CURMAP) buildWorld(m.map); if (m.brk) { for (const id of m.brk) applyBreak(id, false); if (!m.brk.length && WORLD.breakables.some(b => b.gone)) restoreBreaks(); } if (m.cond) G.cond = m.cond; if (G.state === 'playing') applyCond(G.cond);
      for (const [id, name, team, k, d, as, sc, hum, money, lvl, camo, card, title, ctag] of m.r) { const a = getActor(id, team); a.card = card || null; a.title = title || null; a.clanTag = ctag || null; a.camo = camo || null; if (a.model && a.model.setCamo) a.model.setCamo(a.camo); a.name = name; a.human = hum; a.k = k; a.d = d; a.as = as; a.score = sc; a.money = money; a.lvl = lvl | 0; if (id === me.id && team !== me.team) { me.team = team; PCM.setFpTeam(team); } }
      $('#roomCode').textContent = G.code; $('#mapName').textContent = '· ' + MAPS[CURMAP].name + ' · ' + m.r.filter(x => x[7]).length + ' en línea';
      break;
    }
    case 'fix': if (m.p) { me.pos = { x: m.p[0], y: m.p[1], z: m.p[2] }; me.vel = { x: 0, y: 0, z: 0 }; } break;
    case 'p': { if (m.tm) { G.tm = m.tm; if (!$('#buy').hidden) drawTeamBuy(); }
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
      for (const r of m.pass || []) setTimeout(() => { announce('Pase · escalón ' + r.t, 'Ganaste ' + passRewardName(r), 3, 'var(--amber)'); sTone(784, .12, .14, 'triangle'); sTone(1175, .25, .14, 'triangle', 0, .12); }, 600);
      for (const id of m.done || []) { if (id.startsWith('w:')) { const c = (prof.wch || []).find(x => x.id === id.slice(2)); if (c) toast('Reto semanal completado: ' + wkText(c) + ' · +' + PC.WEEKLY_XP); continue; } const c = prof.ch.find(x => x.id === id); if (c) toast('Desafío diario completado: ' + chText(c) + ' · +500'); }
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
    const [id, x, y, z, yaw, pitch, h, hp, alive, cur, flags, vx, vz, ln] = r; const a = getActor(id);
    a.hp = hp; a.cur = cur; a.flags = flags; a.vx = vx; a.vz = vz; a.lean = ln || 0;
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
    case 'sp': if (e.v === me.id) { me.pos = { x: e.p[0], y: e.p[1], z: e.p[2] }; me.vel = { x: 0, y: 0, z: 0 }; me.yaw = e.y; me.pitch = 0; me.alive = true; me.hp = 100; me.deadT = 0; me.h = 1.8; me.lean = 0; me.slideT = 0; resetAim(); stopKillcam(); if (G.mode === 'tdm' || G.mode === 'gg') { me.ammo = {}; if (me.inv.p) ensureAmmo(me.inv.p); if (me.inv.s) ensureAmmo(me.inv.s); } } else { const a = actors[e.v]; if (a) a.buf = []; } break;
    case 'round': clearFires(); G.reveal = G.drone = 0; stopKillcam(); refillAmmo(); me.sprayI = 0; announce('Ronda ' + e.n, 'Eres ' + SIDE_L[sideOf(me.team)] + ' · ' + (G.mode === 'elim' ? 'compra y elimina al otro bando' : sideOf(me.team) === 'atk' ? 'compra y después planta la carga en A o B' : 'compra y después defiende los sitios A y B'), 3.2); if (e.n === ROUND.half + 1) toast('Medio tiempo: cambio de bando, ahora eres ' + SIDE_L[sideOf(me.team)]); break;
    case 'half': if (G.comp) announce('Cambio de bando', 'Se reinicia el dinero de todos', 2.6, 'var(--amber)'); break;
    case 'ot': announce('Prórroga ' + e.n, 'Seis rondas más: gana quien llegue primero a 4 · $10.000 para todos', 3.4, 'var(--amber)'); break;
    case 'tpause': toast((e.tm === me.team ? 'Tu equipo' : 'El rival') + ' pidió pausa táctica (le quedan ' + e.left + '): empieza con la próxima compra'); break;
    case 'tpauseon': announce('Pausa táctica', (e.tm === me.team ? 'Tu equipo' : 'El rival') + ' tiene 30 segundos más para hablar y comprar', 3, 'var(--t' + e.tm + ')'); break;
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
      if (G.mode === 'waves' && actors[e.v] && actors[e.v].team !== me.team && G.waveLeft > 0) G.waveLeft--;
      addFeed(e); const v = actors[e.v]; if (v) v.deadT = 0; G.lastKill = { a: e.a, v: e.v, w: e.w, h: e.h, t: nowS() };
      if (e.a === me.id && e.v !== me.id) { me.kills++; killSound(!!e.h); }
      heatAdd(e); if (e.v === me.id) { me.alive = false; me.deadT = 0; me.killer = e.a; me.specIdx = 0; closeBuy(); resetAim(); closeChat(false); toggleWheel(false); startKillcam(e); }
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
    case 'smhole': { const sm = smokes.get(e.id); if (sm) sm.hole = nowS() + 2.2; break; }
    case 'smoke': makeSmoke(e.id, e.p[0], e.p[1], e.p[2], e.d); { const p = posAudio(e.p[0], e.p[2]); sNoise(1.8, .25 * clamp(1 - p.d / 40, .05, 1), 900, 0, p.pan, .5); } break;
    case 'throw': { const a = actors[e.s]; if (a && e.s !== me.id && sideOf(a.team) === sideOf(me.team)) { const msg = { he: 'Granada', fl: 'Cegadora', sm: 'Humo', in: 'Incendiaria', de: 'Señuelo' }[e.g]; toast(nameOf(e.s) + ': ¡' + msg + ' va!'); } break; }
    case 'bounce': { const p = posAudio(e.p[0], e.p[2]); if (p.d < 25) sTone(2400 + rand(-300, 300), .04, .12 * (1 - p.d / 25), 'triangle'); break; }
    case 'rend': {
      const mine = e.w === me.team; const why = { elim: 'Eliminaron al bando rival', time: G.mode === 'elim' ? 'Se acabó el tiempo · más jugadores en pie' : 'Se acabó el tiempo', bomb: 'La carga explotó', defuse: 'Desactivaron la carga' }[e.why];
      announce('Ganan los ' + SIDE_L[e.side], TEAMN[e.w] + ' · ' + why, 4, TEAMC[e.w]);
      { const L = G.lastKill; if (e.why === 'elim' && L && nowS() - L.t < 1.5 && actors[L.a] && L.a !== L.v && (G.mode === 'bomb' || G.mode === 'elim')) setTimeout(() => startFinalKill(L), 1300); }
      if (mine) { sTone(523, .18, .18, 'triangle'); sTone(659, .18, .18, 'triangle', 0, .16); sTone(784, .3, .18, 'triangle', 0, .32); } else { sTone(392, .22, .16, 'triangle'); sTone(311, .4, .16, 'triangle', 0, .2); }
      break;
    }
    case 'mend': histAdd(e); if (RV.cur && RV.cur.frames.length > 20) { RV.list.push(RV.cur); RV.cur = null; } stopKillcam(); if (e.hl && G.hlBest && G.hlBest.v === e.hl.v && G.hlBest.d === e.hl.d && G.hlBest.frames.length > 10) startHighlight(e); else showEnd(e); break;
    case 'hl': { const sc = e.sc; setTimeout(() => { if (G.state !== 'playing' || (G.hlBest && G.hlBest.sc > sc)) return; const t = nowS(), from = t - 1.2 - e.w; G.hlBest = { v: e.v, sc, d: e.d, ev: t - 1.2, from: Math.max(from, rec.length ? rec[0].t : from), to: t, frames: rec.filter(f => f.t >= from - .1), shots: recShots.filter(x => x.t >= from - .1) }; }, 1200); break; }
    case 'chat': if (e.tm === me.team) { addChat(`<b class="t${e.tm}">${esc(nameOf(e.v))}</b>: ${esc(e.m)}`); uiSound(() => sTone(1200, .05, .08, 'triangle')); } break;
    case 'radio': if (e.tm === me.team) { addChat(`<span class="rd">Radio</span><b class="t${e.tm}">${esc(nameOf(e.v))}</b>: ${esc(PC.RADIO[e.c] || '')}`); uiSound(() => sTone(980, .06, .1, 'square')); uiSound(() => sTone(1320, .07, .1, 'square', 0, .08)); const a = actors[e.v]; if (a) a.radioT = nowS(); } break;
    case 'ping': if (e.tm === me.team) addPing(e); break;
    case 'wave': {
      G.wave = e.n;
      if (e.st === 'buy') { G.waveLeft = e.q; refillAmmo(); announce('Oleada ' + e.n, 'Compra con B · vienen ' + e.q + ' enemigos', 3, 'var(--amber)'); }
      else if (e.st === 'go') { G.waveLeft = e.q; announce('¡Ahí vienen!', 'Oleada ' + e.n + ' · ' + e.q + ' enemigos', 1.8, 'var(--bad)'); sTone(330, .3, .16, 'sawtooth', 220); }
      else if (e.st === 'clear') { G.waveLeft = 0; announce('Oleada ' + e.n + ' superada', 'Tu equipo se recupera y recibe dinero', 2.4, 'var(--t0)'); sTone(660, .12, .15, 'triangle'); sTone(990, .25, .15, 'triangle', 0, .12); }
      break;
    }
    case 'revive': if (e.v === me.id) { G.reviveAt = nowS() + e.t; toast('Reapareces en ' + e.t + ' s si tu equipo resiste'); } break;
    case 'brk': applyBreak(e.id, true); break;
    case 'brkreset': restoreBreaks(); for (const id of e.keep || []) applyBreak(id, false); break;
    case 'order': if (e.tm === me.team) { addChat(`<span class="rd">Orden</span><b class="t${e.tm}">${esc(nameOf(e.v))}</b> → bots: ${esc(PC.ORDERS[e.c] || '')}`); uiSound(() => sTone(740, .06, .1, 'square')); } break;
    case 'medal': if (e.v === me.id) { const md = PC.MEDALS.find(x => x.id === e.m); if (md) { setTimeout(() => announce('Medalla · ' + md.name, md.desc + ' · +' + md.xp + ' XP', 2.2, md.c), 250); sTone(988, .1, .12, 'triangle'); sTone(1318, .18, .12, 'triangle', 0, .1); if (!auth.me) { const m = prof.medals || (prof.medals = {}); m[md.id] = (m[md.id] || 0) + 1; saveProf(); } } } break;
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
    case 'mstart': me.spr = [0, 0, 0, 0]; G.hlBest = null; $('#hlSave').hidden = true; $('#end').hidden = true; me.shots = me.hits = me.heads = me.kills = 0; if (e.map && e.map !== CURMAP) { for (const [id, sm] of smokes) scene.remove(sm.g); smokes.clear(); clearFires(); buildWorld(e.map); G.mapId = e.map; } G.cond = e.cond || null; applyCond(G.cond); if (e.map) announce(MAPS[e.map].name + condLabel(G.cond), (e.voted ? 'Elegido por votación' + (G.mode === 'gg' || G.mode === 'tdm' ? '' : ' · ') : '') + (G.mode === 'gg' || G.mode === 'tdm' || G.mode === 'waves' ? (e.voted ? '' : GM_N[G.mode]) : 'al mejor de ' + ((G.rules && G.rules.rounds) || 5) + ' rondas'), 3); if (G.cond && G.cond.night) setTimeout(() => toast(isTouch ? 'Es de noche: la linterna se enciende sola' : 'Es de noche: F enciende o apaga la linterna'), 3200); break;
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
  const end = new THREE.Vector3(e.e[0], e.e[1], e.e[2]); a.flashT = .05; lifeShot(a.pos.x, a.pos.z);
  if (!me.alive && !kcActive() && me.deadT > 1.2 && specTarget() === a && vm.spec) { vm.kick = 1; vm.flashT = .05; tracer(vmMuzzleWorld(), end); } else tracer(mw, end);
  if (e.n) impactFx(end, e.n, stopAt(end, e.n), .7);
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
  if (e.code === 'KeyL') { flashOn = !flashOn; sNoise(.03, .2, 3000); return; }
  if (e.code === 'KeyI') { inspect(); return; }
  if (orderOpen && /^Digit[1-7]$/.test(e.code)) { const c = Object.keys(PC.ORDERS)[+e.code.slice(5) - 1]; toggleOrders(false); sendOrder(c); return; }
  if (e.code === 'KeyT') { if (SR && !VOICE.denied) voiceStart(); else toggleOrders(); return; }
  if (e.code === 'Escape' && orderOpen) { toggleOrders(false); return; }
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
  if (e.code === 'KeyX') { if (slotList().includes(me.lastCur)) setCur(me.lastCur); }
  if (e.code === 'KeyL' && NADES[me.cur] && me.alive) { toggleLineup(); return; }
  if (e.code === 'KeyG') sendMsg({ t: 'drop', bomb: me.cur === 'knife' ? 1 : 0 });
  if (!me.alive && (e.code === 'Space' || e.code === 'KeyD' || e.code === 'KeyA')) me.specIdx++;
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') showBoard(false); if (e.code === 'KeyT') voiceStop(); });
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
addEventListener('wheel', e => { if (MK.on) { MK.sel = (MK.sel + (e.deltaY > 0 ? 1 : 2)) % 3; drawMark(); return; } if (G.state !== 'playing' || uiOpen() || !me.alive) return; const l = slotList(); const i = l.indexOf(me.cur); setCur(l[(i + (e.deltaY > 0 ? 1 : -1) + l.length) % l.length]); }, { passive: true });
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
  if (e.button === 1) { e.preventDefault(); markStart(); return; }
  if (kcActive()) { stopKillcam(); return; }
  if (wheelOpen) { toggleWheel(false); return; }
  if (e.button === 0) me.fireHeld = true; if (e.button === 2) { me.altHeld = true; onAlt(); }
});
addEventListener('mouseup', e => { if (e.button === 1 && MK.on) markEnd(); if (isTouch) { if (e.button === 0 && !firePtrs.size && !me.autoFiring) me.fireHeld = false; return; } if (e.button === 0) me.fireHeld = false; if (e.button === 2) me.altHeld = false; });
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
  else if (lookPtr.has(e.pointerId)) { const p = lookPtr.get(e.pointerId); const k = .005 * (prefs.mc.sensT / (prefs.sens || 1)); look.dx += (e.clientX - p[0]) * k; look.dy += (e.clientY - p[1]) * k; p[0] = e.clientX; p[1] = e.clientY; }
});
function endPtr(e) { if (e.pointerId === joy.id) { joy.id = null; joy.vx = joy.vy = joy.mag = 0; knob.style.transform = ''; joyEl.style.opacity = 0; } lookPtr.delete(e.pointerId); if (firePtrs.has(e.pointerId)) { firePtrs.delete(e.pointerId); if (!firePtrs.size) { me.fireHeld = false; $('#bFire').classList.remove('on'); $('#bFireL').classList.remove('on'); } } }
TL.addEventListener('pointerup', endPtr); TL.addEventListener('pointercancel', endPtr);
function fireBtn(el) { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); firePtrs.add(e.pointerId); lookPtr.set(e.pointerId, [e.clientX, e.clientY]); me.fireHeld = true; el.classList.add('on'); try { TL.setPointerCapture(e.pointerId); } catch (_) { } }); }
fireBtn($('#bFire')); fireBtn($('#bFireL'));
function tapBtn(el, fn, up) { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); fn(el); }); if (up) { el.addEventListener('pointerup', () => up(el)); el.addEventListener('pointercancel', () => up(el)); el.addEventListener('pointerleave', () => up(el)); } }
tapBtn($('#bAds'), el => { const w = WEAPONS[me.cur]; if (w && w.scope) onAlt(); else if (canAds()) { me.adsToggle = !me.adsToggle; } el.classList.toggle('on', !!(me.scoped || me.adsToggle)); });
tapBtn($('#bReload'), () => { me.reloadReq = true; });
tapBtn($('#bInsp'), () => inspect());
tapBtn($('#bLeanL'), el => { me.touchLean = me.touchLean === -1 ? 0 : -1; el.classList.toggle('on', me.touchLean === -1); $('#bLeanR').classList.remove('on'); });
tapBtn($('#bLeanR'), el => { me.touchLean = me.touchLean === 1 ? 0 : 1; el.classList.toggle('on', me.touchLean === 1); $('#bLeanL').classList.remove('on'); });
tapBtn($('#bVoice'), () => { if (SR && !VOICE.denied) { if (VOICE.on) voiceStop(); else voiceStart(); } else toggleOrders(); });
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
const RPAT = {}; function patOf(w) { if (RPAT[w.id]) return RPAT[w.id]; let h = 5; for (const c of w.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (RPAT[w.id] = { dir: h % 2 ? 1 : -1, f: .38 + (h % 5) * .07, ph: (h % 7) * .45, first: 5 + (h % 4) }); }
function pattern(w, i) {
  if (!w.auto) return { p: w.kick * Math.min(i, 4) * .55, y: 0 };
  const P = patOf(w); const up = w.kick * 9 * (1 - Math.exp(-i / 4.5)); const side = i < P.first ? P.dir * i * .12 * w.kick : P.dir * (P.first * .12 * w.kick + Math.sin((i - P.first) * P.f + P.ph) * w.kick * 3.4 - Math.sin(P.ph) * w.kick * 3.4);
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
  // disparo automático (celular): dispara solo cuando la mira está sobre un enemigo visible
  if (isTouch && prefs.mc.autoFire && !firePtrs.size && G.state === 'playing') {
    const w0 = WEAPONS[me.cur]; const on = !!(w0 && !w0.melee && !NADES[me.cur] && G.phase !== 'buy' && aimedEnemy());
    me.afT = on ? (me.afT || 0) + dt : 0; const go = me.afT > .12; me.fireHeld = go && (w0.auto || w0.burst ? true : !me.fireHeld); me.autoFiring = go;
  } else if (me.autoFiring) { me.autoFiring = false; if (!firePtrs.size) me.fireHeld = false; }
  const frozen = G.phase === 'buy' || !$('#pause').hidden || !$('#end').hidden || !$('#rangeEnd').hidden;
  // mirar
  const s = prefs.sens * (camera.fov / 74);
  me.yaw -= look.dx * s; me.pitch -= look.dy * s; vm.swX = lerp(vm.swX || 0, clamp(look.dx * 4, -.6, .6), .35); vm.swY = lerp(vm.swY || 0, clamp(look.dy * 4, -.6, .6), .35); look.dx = look.dy = 0; me.pitch = clamp(me.pitch, -1.5, 1.5);
  // mover
  let fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - joy.vy; let st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.vx;
  const L = Math.hypot(fw, st); if (L > 1) { fw /= L; st /= L; }
  const crouchIn = !!(keys.KeyC || me.crouchToggle);
  // sin deslizamiento: agacharse corriendo solo agacha (mecánica clásica de shooter táctico)
  const spd0 = Math.hypot(me.vel.x, me.vel.z);
  if (false && crouchIn && !me.crouchPrev && me.grounded && spd0 > 4 && !me.walkHeld && !frozen && !(me.slideT > 0)) { me.slideT = .8; me.slideDir = [me.vel.x / spd0, me.vel.z / spd0]; sNoise(.5, .22, 700, 0, 0, .7); sNoise(.25, .12, 2400, .05, 0, 1); }
  me.crouchPrev = crouchIn; me.crouch = crouchIn || me.slideT > 0;
  // asomarse: Q / E (o los botones táctiles), sin atravesar paredes
  const leanWant = clamp((keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0) + (me.touchLean || 0), -1, 1);
  let leanMax = 1; if (leanWant) { const eye = [me.pos.x, me.pos.y + me.h - .14, me.pos.z], d = [Math.cos(me.yaw) * Math.sign(leanWant), 0, -Math.sin(me.yaw) * Math.sign(leanWant)]; const r = WORLD.traceWorld(eye, d, .5); leanMax = clamp((r.t - .12) / .32, 0, 1); }
  me.lean = lerp(me.lean || 0, leanWant * leanMax, 1 - Math.exp(-dt * 10)); if (Math.abs(me.lean) < .01) me.lean = 0;
  me.walkHeld = !!(keys.ShiftLeft || keys.ShiftRight) || (isTouch && joy.mag > 0 && joy.mag < .55);
  const w = WEAPONS[me.cur] || WEAPONS.knife; let sp = NADES[me.cur] ? 5.0 : w.speed; if (w.scope && me.scoped) sp *= .45;
  const wantAds = canAds() && (me.altHeld || me.adsToggle) && me.reloadT <= 0 && me.drawT <= 0 && !frozenAds();
  if (wantAds !== !!me.wasAds) { me.wasAds = wantAds; if (wantAds) { sNoise(.07, .16, 900, 0, 0, .9); sTone(210, .05, .07, 'triangle'); } else sNoise(.05, .1, 700, 0, 0, .9); }
  me.adsK = lerp(me.adsK || 0, wantAds ? 1 : 0, 1 - Math.exp(-dt * (wantAds ? 16 : 20))); if (!canAds()) { me.adsK = 0; me.adsToggle = false; }
  sp *= 1 - .3 * me.adsK;
  if (me.crouch) sp *= .34; else if (me.walkHeld) sp *= .52;
  sp *= 1 - .35 * Math.abs(me.lean || 0);
  if (frozen) sp = 0;
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  let tx = (-sy * fw + cy * st) * sp, tz = (-cy * fw - sy * st) * sp; let acc = me.grounded ? 15 : 2;
  if (me.slideT > 0) { me.slideT -= dt; const k = Math.max(0, me.slideT / .8); const v = frozen ? 0 : 3 + 4.4 * k; tx = me.slideDir[0] * v; tz = me.slideDir[1] * v; acc = 30; } me.vel.x = lerp(me.vel.x, tx, 1 - Math.exp(-acc * dt)); me.vel.z = lerp(me.vel.z, tz, 1 - Math.exp(-acc * dt));
  if (me.jumpReq && me.grounded && !frozen) { me.vel.y = 5.2; me.grounded = false; } me.jumpReq = false;
  me.h = lerp(me.h, me.crouch ? 1.22 : 1.8, 1 - Math.exp(-dt * (me.slideT > 0 ? 22 : 12)));
  const fallV = me.vel.y, wasG = me.grounded;
  WORLD.moveActor(me, dt);
  if (!wasG && me.grounded && fallV < -3) { me.landT = clamp(-fallV / 9, .2, .8); sStep(.25); }
  me.landT = Math.max(0, (me.landT || 0) - dt * 3);
  const lat = me.vel.x * Math.cos(me.yaw) - me.vel.z * Math.sin(me.yaw); me.roll = lerp(me.roll || 0, -lat * .006, 1 - Math.exp(-dt * 8));
  const spd = Math.hypot(me.vel.x, me.vel.z);
  if (me.grounded && spd > 1 && !me.walkHeld && !me.crouch) { me.stepT -= dt * spd; if (me.stepT <= 0) { me.stepT = 2.3; sStep(.12, 0, surfAtFeet(me.pos.x, me.pos.z, me.pos.y)); } }
  vm.bobT += dt * spd * 1.3;
  // acción (plantar / desactivar)
  if ($('#bAct').hidden) $('#bAct').classList.remove('on');
  me.act = keys.KeyF || $('#bAct').classList.contains('on');
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
    if ((me.fireHeld || me.altHeld) && me.drawT <= 0) me.nadeArm = me.nadeArm === 'mid' || (me.fireHeld && me.altHeld) ? 'mid' : me.fireHeld ? 'far' : 'lob';
    else if (me.nadeArm && !me.fireHeld && !me.altHeld) throwNade(me.nadeArm);
    return;
  }
  if (w.melee) { if ((me.fireHeld || me.altHeld) && T - me.lastShot >= (me.altHeld ? 1.0 : .42) && me.drawT <= 0) knife(me.altHeld); return; }
  if (w.burst) {
    // pistola de ráfaga: un clic dispara 3 balas seguidas
    if (me.fireHeld && !me.trigLock && !me.burstLeft && me.reloadT <= 0 && me.drawT <= 0 && T - me.lastShot >= w.gap) { me.burstLeft = w.burst; me.trigLock = true; }
    if (me.burstLeft > 0 && T - me.lastShot >= 60 / w.rpm) { const am = me.ammo[me.cur]; if (am && am.mag > 0 && me.reloadT <= 0) { shoot(w, am); me.burstLeft--; } else { if (me.burstLeft === w.burst) sTone(1800, .03, .15, 'square'); me.burstLeft = 0; if (am && am.mag <= 0 && am.res > 0) me.reloadReq = true; } }
    if (!me.fireHeld) me.trigLock = false; return;
  }
  if (me.fireHeld && me.reloadT <= 0 && me.drawT <= 0 && (w.auto || !me.trigLock) && T - me.lastShot >= 60 / w.rpm) {
    const am = me.ammo[me.cur];
    if (am && am.mag > 0) { shoot(w, am); me.trigLock = true; }
    else if (!me.trigLock) { sTone(1800, .03, .15, 'square'); me.trigLock = true; if (am && am.res > 0) me.reloadReq = true; }
  }
  if (!me.fireHeld) me.trigLock = false;
}
const SPR = { y0: 0, p0: 0, raw: [], act: [], t: 0 };
function sprayRec(i, pat) {
  if (i === 0) { SPR.y0 = me.yaw; SPR.p0 = me.pitch; SPR.raw = []; SPR.act = []; SPR.w = me.cur; }
  SPR.raw.push([pat.y, pat.p]); SPR.act.push([me.yaw - SPR.y0 + pat.y, me.pitch - SPR.p0 + pat.p]); SPR.t = nowS(); drawSprayPad();
}
function drawSprayPad() {
  const c = $('#sprayPad'); if (!c) return; c.hidden = !RG.on; if (!RG.on) return; const x = c.getContext('2d'), W = c.width, H = c.height, s = 900, cx = W / 2, cy = H * .82;
  x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(12,15,18,.78)'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(cx, 8); x.lineTo(cx, H - 8); x.moveTo(8, cy); x.lineTo(W - 8, cy); x.stroke();
  const pt = (p, col, r) => { x.fillStyle = col; x.beginPath(); x.arc(cx - p[0] * s, cy - p[1] * s, r, 0, 7); x.fill(); };
  for (const p of SPR.raw) pt(p, 'rgba(200,200,200,.35)', 2.5); SPR.act.forEach((p, i) => pt(p, i < 3 ? '#9fd88a' : '#f2b33d', 3));
  x.strokeStyle = '#ff4d3a'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.stroke();
  const dev = SPR.act.length ? SPR.act.reduce((a, p) => a + Math.hypot(p[0], p[1]), 0) / SPR.act.length * 1000 : 0;
  x.fillStyle = '#e9dcc0'; x.font = '600 12px system-ui'; x.fillText('Práctica de spray' + (SPR.w && WEAPONS[SPR.w] ? ' · ' + WEAPONS[SPR.w].name : ''), 10, 18);
  x.font = '11px system-ui'; x.fillStyle = '#a29a88'; x.fillText('Gris: patrón sin compensar', 10, 34); x.fillText('Color: tus balas (verde, las 3 primeras)', 10, 48); x.fillText(SPR.act.length ? `Desvío medio: ${dev.toFixed(0)} · ${SPR.act.length} balas` : 'Mantén el clic con un fusil o subfusil', 10, H - 10);
}
// Lineups: posiciones guardadas en este navegador por mapa y tipo de granada
const LU = { g: null, marks: [] };
function lineups() { const all = prefs.lineups || (prefs.lineups = {}); return all[CURMAP] || (all[CURMAP] = []); }
function toggleLineup() {
  const L = lineups(), near = L.findIndex(l => l.k === me.cur && Math.hypot(l.x - me.pos.x, l.z - me.pos.z) < .6);
  if (near >= 0) { L.splice(near, 1); toast('Lineup borrado'); }
  else { if (L.length >= 30) L.shift(); L.push({ k: me.cur, x: +me.pos.x.toFixed(2), z: +me.pos.z.toFixed(2), y: +me.pos.y.toFixed(2), yaw: +me.yaw.toFixed(4), pitch: +me.pitch.toFixed(4), m: me.nadeArm || 'far' }); toast('Lineup guardado: párate en el círculo y apunta al rombo'); }
  savePrefs(); LU.key = '';
}
function updateLineups() {
  const key = CURMAP + '|' + me.cur + '|' + (prefs.lineups && prefs.lineups[CURMAP] ? prefs.lineups[CURMAP].length : 0);
  if (LU.key !== key) { LU.key = key; if (LU.g) scene.remove(LU.g); LU.g = new THREE.Group(); scene.add(LU.g); LU.marks = [];
    for (const l of lineups().filter(l => l.k === me.cur)) { const ring = new THREE.Mesh(new THREE.RingGeometry(.28, .36, 24), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .85, side: THREE.DoubleSide, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(l.x, l.y + .03, l.z); ring.renderOrder = 6; LU.g.add(ring);
      const dir = [-Math.sin(l.yaw) * Math.cos(l.pitch), Math.sin(l.pitch), -Math.cos(l.yaw) * Math.cos(l.pitch)], eye = l.y + 1.62; const tg = new THREE.Mesh(new THREE.OctahedronGeometry(.09), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, depthTest: false })); tg.position.set(l.x + dir[0] * 6, eye + dir[1] * 6, l.z + dir[2] * 6); tg.renderOrder = 6; LU.g.add(tg); LU.marks.push({ l, ring, tg }); } }
  if (LU.g) LU.g.visible = !!(me.alive && NADES[me.cur]);
  for (const M of LU.marks) { const on = Math.hypot(M.l.x - me.pos.x, M.l.z - me.pos.z) < .35; M.ring.material.color.setHex(on ? 0x8fd694 : 0x9fd8ff); M.tg.visible = on; M.tg.rotation.y += .05; }
}
function aimDir(extraP, extraY, inacc) {
  const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * inacc;
  const py = me.pitch + extraP + Math.sin(ang) * r, yy = me.yaw + extraY + Math.cos(ang) * r;
  return [-Math.sin(yy) * Math.cos(py), Math.sin(py), -Math.cos(yy) * Math.cos(py)];
}
function traceShot(o, d, maxT) {
  const wt = WORLD.traceShot(o, d, maxT); let hit = null, t = wt.t, zone = null;
  for (const a of actors) { if (!a || a.id === me.id || !a.alive || a.team === me.team) continue; const r = PC.rayActor(o, d, a, t); if (r && r.t < t) { t = r.t; hit = a; zone = r.zone; } }
  return { wt, hit, t, zone };
}
function shoot(w, am) {
  am.mag--; me.lastShot = nowS(); me.shots++; lifeShot(me.pos.x, me.pos.z); const sprIdx = me.sprayI;
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
    for (const h of r.wt.through || []) if (h.t < r.t && h.n) { const hp = new THREE.Vector3(o[0] + d[0] * h.t, o[1] + d[1] * h.t, o[2] + d[2] * h.t); burst(hp, h.n, BRK_COL[h.b.mat] || [.62, .55, .45], 2, 4); if (h.b.bid === undefined) decal(hp, h.n); }
    if (r.hit) burst(end, [-d[0], -d[1], -d[2]], [.5, .06, .04], 2.2, 6);
    else if (r.wt.n && r.wt.stop && r.wt.stop.bid !== undefined) { burst(end, r.wt.n, BRK_COL[r.wt.stop.mat] || [.62, .55, .45], 2.2, 6); }
    else if (r.wt.n) impactFx(end, r.wt.n, r.wt.stop, w.pellets ? .4 : 1);
    const rec = { d: d.map(v => +v.toFixed(4)), tt: +r.t.toFixed(2), hit: r.hit ? r.hit.id : null, z: r.zone, n: r.wt.n };
    pel.push(rec); if (!main) { main = rec; const sp = me.spr || (me.spr = [0, 0, 0, 0]), first = sprIdx < 3; sp[first ? 1 : 3]++; if (r.hit) sp[first ? 0 : 2]++; if (RG.on && w.auto) sprayRec(sprIdx, pat); }
  }
  if (RG.chal) { RG.shots++; if (anyRange) RG.hits++; }
  const msg = Object.assign({ t: 'shot', w: me.cur, o: o.map(v => +v.toFixed(3)) }, main); if (w.pellets) msg.pel = pel;
  sendMsg(msg);
  vm.kick = 1; vm.flashT = .05; worldFlash.position.copy(mw); worldFlash.intensity = 2; sShot(w.snd, 0, 0);
  if (prefs.gfx !== 'low') { if (!w.pellets || Math.random() < .5) ejectCasing(!!w.pellets); if (Math.random() < .85) muzzlePuff(mw); }
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
function throwNade(mode) {
  const k = me.cur; me.nadeArm = false; vm.throwT = 1; const d = aimDir(0, 0, 0);
  sendMsg({ t: 'nade', k, d, lob: mode === 'lob' ? 1 : 0, mid: mode === 'mid' ? 1 : 0 }); sNoise(.15, .25, 900);
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
  sendMsg({ t: 'in', p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)], v: [+me.vel.x.toFixed(2), +me.vel.y.toFixed(2), +me.vel.z.toFixed(2)], y: +me.yaw.toFixed(3), pi: +(me.pitch + me.punchP).toFixed(3), h: +me.h.toFixed(2), ln: +(me.lean || 0).toFixed(2), w: me.walkHeld || me.crouch ? 1 : 0, act: me.act ? 1 : 0 });
}

/* ---------- Trayectoria de granada ---------- */
const arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3));
const arcLine = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0xf2b33d, dashSize: .25, gapSize: .15, transparent: true, opacity: .9, depthTest: false })); arcLine.frustumCulled = false; arcLine.visible = false; arcLine.renderOrder = 5; scene.add(arcLine);
const arcDots = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: 0xffd27a, size: .09, transparent: true, opacity: .95, depthTest: false })); arcDots.frustumCulled = false; arcDots.renderOrder = 5; arcLine.add(arcDots);
const arcRing = new THREE.Mesh(new THREE.RingGeometry(.32, .42, 28), new THREE.MeshBasicMaterial({ color: 0xf2b33d, transparent: true, opacity: .9, side: THREE.DoubleSide, depthTest: false })); arcRing.rotation.x = -Math.PI / 2; arcRing.visible = false; arcRing.renderOrder = 6; scene.add(arcRing);
function updateArc() {
  if (WORLD) updateLineups();
  const k = me.cur; const show = me.alive && NADES[k] && me.nadeArm && WORLD;
  arcLine.visible = arcRing.visible = !!show; if (!show) return;
  const d = aimDir(0, 0, 0); const sp = me.nadeArm === 'mid' ? 11 : me.nadeArm === 'lob' ? 7.5 : 15;
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
    m.animate(spd, a.walkPh, cr, a.pitch); a.leanS = lerp(a.leanS || 0, a.lean || 0, .3); m.upper.rotation.z = -a.leanS * .42;
    setModelGun(m, a.cur); m.setHelmet(!!(a.flags & 128)); m.pack.visible = !!(a.flags & 4);
    a.flashT = (a.flashT || 0) - dt; m.flash.visible = a.flashT > 0;
    // pasos audibles
    if (spd > 2.8 && !(a.flags & 2) && cr < .3 && Math.abs(a.pos.y - WORLD.groundAt(a.pos.x, a.pos.z, a.pos.y)) < .1) { a.stepT -= dt * spd; if (a.stepT <= 0) { a.stepT = 2.3; const p = posAudio(a.pos.x, a.pos.z); if (p.d < 28) sStep(.22 * (1 - p.d / 28) * (a.team === me.team ? .6 : 1), p.pan, surfAtFeet(a.pos.x, a.pos.z, a.pos.y)); } }
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
// íconos dibujados de armas para el registro de bajas (siluetas propias, viewBox 64x20)
const WICON = {
  pistol: 'M6 5h24v5H19l-2 9h-6l2-9H6z',
  smg: 'M3 6h38v4h-7v3h-4l-1 6h-5l1-6h-6v-3H3zM41 7h9v2h-9zM8 10h5v7H8z',
  rifle: 'M2 8l8-2h29V5h4v1h18v3H44v2H31l-2 3h-5l-1 6h-5l1-6h-4l-2-3H10l-8 2z',
  sniper: 'M2 9l10-2h21V5h14v2h-5v1h20v2H40v2H28l-2 3h-5l1 5h-5l-1-5h-4l-1-3H12l-10 2zM30 3h18v2H30z',
  shotgun: 'M2 9l9-2h47v3H34v2h12v2H32l-2 2h-6l1 3h-5l-1-3H12l-1-2-9 2z',
  lmg: 'M2 8l8-2h29V5h4v1h18v3H44v2H31l-2 3h-5l1 6h-5l-1-6h-4l-2-3H10l-8 2zM24 12h9v6h-9z',
  knife: 'M5 9h13l2-2h2v6h-2l-2-2H5zM22 8.5l34 .5-7 3H22z',
  nade: 'M33 5a7 7 0 1 0 .1 0zM30 1h7v3h-7zM37 2l5 3-1 1-5-2z',
  fire: 'M32 2c5 5 9 9 9 13a9 9 0 0 1-18 0c0-4 3-6 5-9 1 3 2 4 4 5 0-3-1-6 0-9z',
  bomb: 'M18 5h28v12H18zM22 8h8v6h-8zM34 8h8v2h-8zM34 12h8v2h-8z'
};
function wIconKey(w) { if (w === 'knife') return 'knife'; if (w === 'he' || w === 'fl' || w === 'sm' || w === 'de') return 'nade'; if (w === 'in') return 'fire'; if (w === 'bomb') return 'bomb'; const c = ((WEAPONS[w] || {}).cls || '').toLowerCase();
  return c.includes('pistola') ? 'pistol' : c.includes('subfusil') ? 'smg' : c.includes('escopeta') ? 'shotgun' : c.includes('ametralladora') ? 'lmg' : c.includes('franco') || c.includes('designado') ? 'sniper' : c ? 'rifle' : 'rifle'; }
const ICO_HEAD = '<svg class="ki" viewBox="0 0 20 20" aria-label="a la cabeza"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 1v5M10 14v5M1 10h5M14 10h5" stroke="currentColor" stroke-width="2"/></svg>';
const ICO_WALL = '<svg class="ki" viewBox="0 0 24 20" aria-label="a través de la pared"><path d="M9 2h5v16H9z" fill="currentColor" opacity=".55"/><path d="M1 10h21M17 6l5 4-5 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
function addFeed(e) {
  const k = actors[e.a], v = actors[e.v]; if (!v) return; const d = document.createElement('div'); d.className = 'kf' + (e.a === me.id || e.v === me.id ? ' me' : '');
  const kn = k ? `<span class="t${k.team}">${esc(k.name)}</span>` : '';
  const ast = (e.ast || []).map(id => actors[id]).filter(Boolean).map(a => `<span class="t${a.team}" style="opacity:.75">+ ${esc(a.name)}</span>`).join('');
  d.innerHTML = `${kn}${ast}<svg class="wi" viewBox="0 0 64 20" role="img" aria-label="${esc((WEAPONS[e.w] || {}).name || SHORT[e.w] || '')}"><path d="${WICON[wIconKey(e.w)]}"/></svg>${e.wb ? '<span class="hs wb">' + ICO_WALL + '</span>' : ''}${e.h ? '<span class="hs">' + ICO_HEAD + '</span>' : ''}<span class="t${v.team}">${esc(v.name)}</span>`;
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
    if (!mate && t - a.seenT > 1.6 && !(a.flags & 1) && !(a.flags & (me.team === 0 ? 256 : 512)) && !(G.reveal > t)) continue;
    rctx.fillStyle = TEAMC[a.team]; rctx.beginPath(); rctx.arc(a.pos.x, a.pos.z, 1.1, 0, 7); rctx.fill();
    if (mate) { rctx.strokeStyle = TEAMC[a.team]; rctx.lineWidth = .4; rctx.beginPath(); rctx.moveTo(a.pos.x, a.pos.z); rctx.lineTo(a.pos.x - Math.sin(a.yaw) * 2.4, a.pos.z - Math.cos(a.yaw) * 2.4); rctx.stroke(); }
    if (mate && (a.flags & 4)) { rctx.fillStyle = '#f2b33d'; rctx.fillRect(a.pos.x - .5, a.pos.z + 1.3, 1, .7); }
  }
  rctx.restore();
  rctx.save(); rctx.translate(S, S); rctx.rotate(yaw); rctx.scale(sc, sc); rctx.translate(-cx, -cz);
  for (const pg of pings) { const q = pingPos(pg); rctx.fillStyle = { enemy: '#ff4d3a', killer: '#ff4d3a', hold: '#9fd8ff', dead: '#a29a88' }[pg.kind] || '#f2b33d'; rctx.save(); rctx.translate(q.x, q.z); rctx.rotate(Math.PI / 4); rctx.fillRect(-1.1, -1.1, 2.2, 2.2); rctx.restore(); }
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
  else if (G.mode === 'waves' && G.phase === 'live') { setTxt('#timer', 'O' + (G.wave || 1)); setCls('#timer', ''); }
  else if (G.bomb[0] === 'planted') { setTxt('#timer', 'CARGA'); setCls('#timer', 'bomb'); }
  else { setTxt('#timer', Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0')); setCls('#timer', G.phase === 'buy' ? 'buy' : ''); }
  if (RG.on) { }
  else if (G.mode === 'gg') { const lead = actors.filter(Boolean).sort((p, q) => (q.lvl - p.lvl) || (q.k - p.k))[0]; setTxt('#rlabel', G.phase === 'over' ? 'Fin de la escalada' : (lead ? 'Líder: ' + lead.name + ' · nivel ' + (lead.lvl + 1) : 'Escalada')); }
  else if (G.mode === 'waves') setTxt('#rlabel', G.phase === 'over' ? 'Fin de las oleadas' : G.phase === 'buy' ? 'Compra · oleada ' + (G.wave || 1) : 'Oleada ' + (G.wave || 1) + ' · quedan ' + Math.max(0, G.waveLeft | 0));
  else if (G.mode === 'tdm') setTxt('#rlabel', G.phase === 'over' ? 'Fin del combate' : 'Combate · meta ' + PC.TDM.goal + ' bajas');
  else setTxt('#rlabel', G.phase === 'buy' ? 'Compra · ronda ' + G.rd : G.phase === 'over' ? 'Fin de partida' : 'Ronda ' + G.rd + ' de ' + ((G.rules && G.rules.rounds) || ROUND.total));
  if (G.mode === 'gg') { setTxt('#role0', 'Halcón'); setTxt('#role1', 'Cobra'); }
  // vitales
  const hp = Math.max(0, me.hp); setTxt('#hpN', String(me.alive ? hp : 0)); setCls('#hpN', hp <= 25 ? 'low' : '');
  { const hb = $('#hpBar'), ab = $('#arBar'), mb = $('#amBar'); const hv = me.alive ? hp / 100 : 0; if (hb && hb._v !== hv) { hb._v = hv; hb.style.transform = 'scaleX(' + hv + ')'; hb.parentElement.classList.toggle('low', hv <= .25 && hv > 0); }
    if (ab) { const av = (me.armor || 0) / 100; if (ab._v !== av) { ab._v = av; ab.style.transform = 'scaleX(' + av + ')'; } }
    if (mb) { const W0 = WEAPONS[me.cur], am0 = me.ammo && me.ammo[me.cur]; const mv = W0 && W0.mag && am0 ? am0.mag / W0.mag : W0 && !W0.mag ? 1 : 0; if (mb._v !== mv) { mb._v = mv; mb.style.transform = 'scaleX(' + mv + ')'; mb.parentElement.classList.toggle('low', mv <= .25 && !!(W0 && W0.mag)); } } }
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
  $('#scope').classList.toggle('on', scoped); if (me.alive && !(kc && kc.cine && kcActive())) vm.group.visible = !scoped;
  const hideXh = !me.alive || scoped || (w && w.scope) || NADES[me.cur] || (me.adsK || 0) > .35; xh.style.opacity = hideXh ? 0 : 1;
  if (w && !hideXh) { const inacc = inaccuracy(w); const gap = 3 + inacc * (innerHeight / 2) / Math.tan(camera.fov * Math.PI / 360) * .9 + me.sprayI * .6; xh.children[0].style.top = (-gap - 7) + 'px'; xh.children[1].style.top = gap + 'px'; xh.children[2].style.left = (-gap - 7) + 'px'; xh.children[3].style.left = gap + 'px'; }
  // punto central al apuntar: referencia de tiro siempre visible, también con miras de hierro
  $('#adsDot').style.opacity = me.alive && (me.adsK || 0) > .6 && !(w && w.scope) ? 1 : 0;
  if (hitT > 0) { hitT -= dt; $('#hit').style.opacity = clamp(hitT / .1, 0, 1); } else $('#hit').style.opacity = 0; setCls('#xh', hitT > 0 ? ($('#hit').className === 'kill' ? 'hk' : 'hh') : '');
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
  if (kcOn) { setTxt('#kcTag', kc.cine ? 'ÚLTIMA BAJA' : kc.hl ? 'JUGADA DE LA PARTIDA' : 'REPETICIÓN'); setTxt('#kcSub', kc.hl ? (kc.desc || '') : 'Te eliminó'); const k = actors[kc.killer]; const txt = (k ? k.name : '—') + '|' + kc.w + '|' + (kc.hl ? 1 : 0); if ($('#killcam')._t !== txt) { $('#killcam')._t = txt; setTxt('#kcName', k ? (k.clanTag ? '[' + k.clanTag + '] ' : '') + k.name : '—'); { const cd = k && PC.CARDS.find(c => c.id === k.card), tl = k && PC.TITLES.find(c => c.id === k.title); $('#kcCard').style.cssText = cd ? cardCss(cd) : ''; $('#kcCard').hidden = !cd && !tl; setTxt('#kcTitle', tl ? tl.name : ''); } setCls('#kcName', k ? 't' + k.team : ''); setTxt('#kcInfo', (kc.hl ? (k && k.id === me.id ? '¡Es tuya! Al terminar puedes descargar el video' : 'Mira cómo lo hizo') : (WEAPONS[kc.w] ? WEAPONS[kc.w].name : kc.w === 'he' ? 'Granada HE' : kc.w === 'in' ? 'Incendiaria' : 'Carga') + (kc.h ? ' · a la cabeza' : '') + ' · ' + kc.dist + ' m' + (kc.hp != null ? ' · le quedó ' + kc.hp + ' de vida' : ''))); } $('#kcBar').style.width = clamp(kc.phase === 'eyes' ? (kc.rt - kc.from) / kc.len * .8 : .8 + kc.orbitT / kc.orbitLen * .2, 0, 1) * 100 + '%'; }
  const sp = $('#spec'); if (kcOn) sp.hidden = true; else if (!me.alive && G.mode === 'waves' && me.deadT <= 1.2) { sp.hidden = false; setTxt('#specName', 'Reapareces en ' + Math.max(0, Math.ceil((G.reviveAt || 0) - nowS())) + ' s'); setCls('#specName', ''); setTxt('#specHint', 'Si todo tu equipo cae, termina la partida'); }
  else if (!me.alive && (G.mode === 'gg' || G.mode === 'tdm')) { sp.hidden = false; setTxt('#specName', 'Reapareces en un momento'); setCls('#specName', ''); setTxt('#specHint', 'Te toca ' + ((WEAPONS[PC.LADDER[me.lvl | 0]] || {}).name || '')); } else if (!me.alive && me.deadT > 1.2) { const tg = specTarget(); sp.hidden = false; setTxt('#specName', tg ? tg.name + ' · ' + Math.max(0, tg.hp | 0) + ' de vida' : 'Nadie en pie'); setCls('#specName', tg ? 't' + tg.team : ''); setTxt('#specHint', (tg && WEAPONS[tg.cur] ? WEAPONS[tg.cur].name + ' · ' : '') + (isTouch ? 'toca para cambiar de compañero' : 'clic para cambiar de compañero')); } else sp.hidden = true;
  // enemigos vistos (radar) y nombres
  spotT -= dt; if (spotT <= 0 && me.alive) { spotT = .15; const o = [camera.position.x, camera.position.y, camera.position.z]; const sl = smokeList(); for (const a of actors) { if (!a || !a.alive || a.team === me.team || a.id === me.id) continue; if (WORLD.visible(o, [a.pos.x, a.pos.y + a.h * .7, a.pos.z], sl)) a.seenT = t; } }
  const aim = aimedEnemy();
  for (const a of actors) {
    if (!a || a.id === me.id) continue; let el = tagEls.get(a.id); if (!el) { el = document.createElement('div'); el.className = 'tag'; $('#tags').appendChild(el); tagEls.set(a.id, el); }
    const droned = G.drone > t && a.team !== me.team;
    let show = a.alive && (a.team === me.team || a === aim || droned) && !(!me.alive && specTarget() === a);
    el.classList.toggle('dron', droned && a !== aim);
    if (show) { _p.set(a.pos.x, a.pos.y + a.h + .3, a.pos.z).project(camera); if (_p.z > 1 || _p.z < -1) show = false; else { el.style.transform = `translate(${(_p.x * .5 + .5) * innerWidth}px,${(-_p.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; const txt = (a.clanTag ? '[' + a.clanTag + '] ' : '') + a.name + (a.flags & 4 ? ' ◆' : ''); if (el._t !== txt) { el.textContent = txt; el._t = txt; } el.style.color = TEAMC[a.team]; } }
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
  ['Pistolas', ['p9', 'b3', 'ap18', 'r50']], ['Subfusiles y escopetas', ['smg', 'k11', 'es12', 'pump']], ['Fusiles', ['fr9', 'bp9', 'ar', 'lmg']], ['Precisión', ['tr7', 'dmr', 'sr', 'ax50']], ['Equipo', ['kevlar', 'helm', 'kit']], ['Granadas', NADE_IDS]
];
const GEARN = { kevlar: ['Chaleco', 650], helm: ['Chaleco + casco', 1000], kit: ['Kit de desactivación', 400] };
function priceOf(i) { if (WEAPONS[i]) return WEAPONS[i].price; if (NADES[i]) return NADES[i].price; if (i === 'helm' && me.armor >= 100) return 350; return GEARN[i][1]; }
function owned(i) { if (WEAPONS[i]) return me.inv.p === i || me.inv.s === i; if (NADES[i]) return me.inv.n[i] >= NADES[i].max; if (i === 'kevlar') return me.armor >= 100; if (i === 'helm') return me.helmet && me.armor >= 100; if (i === 'kit') return me.kit; return false; }
function drawTeamBuy() {
  const el = $('#teamBuy'); if (!el) return; const tm = (G.tm || []).filter(r => actors[r[0]]);
  if (!tm.length) { el.innerHTML = ''; return; }
  const st = m => m >= 4500 ? ['Compra completa', 'ok'] : m >= 2500 ? ['Compra parcial', 'mid'] : ['Ahorra', 'low'];
  el.innerHTML = `<div class="lbl small">Tu equipo</div>` + tm.map(([id, m, p, al]) => { const s = st(m); return `<div class="tbr${al ? '' : ' dead'}"><b>${esc(actors[id].name)}</b><span class="mono">$${m.toLocaleString('es')}</span><span class="tbs ${s[1]}">${p && WEAPONS[p] ? esc(WEAPONS[p].name) : s[0]}</span></div>`; }).join('') +
    `<div class="sqrow"><button type="button" class="go ghost sm" id="askGun">Pedir un arma</button><button type="button" class="go ghost sm" id="dropGun">Soltar mi arma principal</button></div>`;
  $('#askGun').onclick = () => { sendMsg({ t: 'chat', m: `Necesito un arma: tengo $${me.money || 0}` }); toast('Pediste un arma a tu equipo'); };
  $('#dropGun').onclick = () => { if (me.inv && me.inv.p) { if (me.cur !== me.inv.p) setCur(me.inv.p); setTimeout(() => sendMsg({ t: 'drop', bomb: 0 }), 60); toast('Soltaste tu arma: tu compañero la recoge pasando por encima'); } else toast('No tienes arma principal'); };
}
function drawBuy() {
  drawTeamBuy();
  $('#bcols').innerHTML = BUY.map(([title, items]) => `<div class="bcol"><div class="lbl">${title}</div>${items.map(i => {
    if (i === 'kit' && sideOf(me.team) !== 'def') return '';
    const name = WEAPONS[i] ? WEAPONS[i].name : NADES[i] ? NADES[i].name : GEARN[i][0]; const p = priceOf(i); const own = owned(i); const ban = WEAPONS[i] && G.rules && G.rules.arms !== 'all' && !({ pistolas: w => w.slot === 2, franco: w => w.slot === 2 || !!w.scope, escopetas: w => w.slot === 2 || !!w.pellets, cuchillo: () => false }[G.rules.arms] || (() => true))(WEAPONS[i]); const dis = own || ban || p > me.money;
    const sub = WEAPONS[i] ? `${WEAPONS[i].cls} · ${WEAPONS[i].mag}/${WEAPONS[i].res}` : NADES[i] ? (NADES[i].max > 1 ? 'máx. ' + NADES[i].max : 'máx. 1') : '';
    return `<button type="button" class="bi${own ? ' own' : ''}" data-i="${i}" aria-disabled="${dis}"><span class="n">${name}</span><span class="p">$${p}</span><span class="k">${ban ? 'No permitida en esta sala' : sub}</span></button>`;
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
    list.map(a => `<tr class="${a.id === me.id ? 'me' : ''}${a.alive ? '' : ' dead'}"><td>${a.clanTag ? `<span class="ctag">[${esc(a.clanTag)}]</span> ` : ''}${esc(a.name)}${a.human ? '' : '<span class="hum">BOT</span>'}${a.flags & 4 ? ' <span class="bombTag">CARGA</span>' : ''}</td>${gg ? `<td>${a.lvl + 1} · ${SHORT[PC.LADDER[a.lvl]] || ''}</td>` : mine ? `<td>${a.money}</td>` : ''}<td>${a.k}</td><td>${a.as}</td><td>${a.d}</td><td>${a.score}</td></tr>`).join('') + '</table>';
}
function showBoard(on) { if (G.state !== 'playing') return; if (on) { $('#boardT').innerHTML = teamTable(me.team) + teamTable(1 - me.team); $('#board').hidden = false; } else $('#board').hidden = true; }
function drawEndMore(e) {
  const mv = $('#endMvp'), mi = $('#endMine'); mv.innerHTML = mi.innerHTML = ''; if (!e.st) { mv.parentElement.hidden = true; return; } mv.parentElement.hidden = false;
  const row = id => e.st.find(r => r[0] === id); const a = actors[e.mvp], r = row(e.mvp);
  if (a && r) { const cd = PC.CARDS.find(c => c.id === a.card), tl = PC.TITLES.find(t => t.id === a.title); mv.style.cssText = cd ? cardCss(cd) : ''; mv.innerHTML = `<span class="lbl small">MVP DE LA PARTIDA${e.mvp === me.id ? ' · ¡ERES TÚ!' : ''}</span><b>${a.clanTag ? '[' + esc(a.clanTag) + '] ' : ''}${esc(a.name)}</b><span>${tl ? esc(tl.name) + ' · ' : ''}${r[2]} bajas · ${r[1]} de daño · ${r[4]} a la cabeza</span>`; }
  const m = row(me.id); if (!m) return; const acc = m[5] ? Math.round(m[6] / m[5] * 100) : 0, hp = m[2] ? Math.round(m[4] / m[2] * 100) : 0;
  const wk = (e.wk && e.wk[me.id]) || {}; const ws = Object.entries(wk).filter(([w, v]) => WEAPONS[w] && (v[0] || v[2])).sort((x, y) => y[1][2] - x[1][2] || y[1][0] - x[1][0]).slice(0, 4);
  const sp = me.spr || [0, 0, 0, 0], pf = sp[1] ? Math.round(sp[0] / sp[1] * 100) : null, pr = sp[3] ? Math.round(sp[2] / sp[3] * 100) : null;
  mi.innerHTML = `<div class="lbl small">Tu partida · ${m[1]} de daño · ${acc}% de precisión · ${hp}% a la cabeza</div>` + (pf !== null || pr !== null ? `<div class="small sprst">Primeras 3 balas: <b>${pf === null ? '—' : pf + '%'}</b> · Ráfagas largas: <b>${pr === null ? '—' : pr + '%'}</b>${pf !== null && pr !== null && pf - pr > 25 ? ' · practica el control de spray en el campo de tiro' : ''}</div>` : '') + (ws.length ? `<table><tr><th>Arma</th><th>Disparos</th><th>Precisión</th><th>Bajas</th></tr>${ws.map(([w, v]) => `<tr><td>${esc(WEAPONS[w].name)}</td><td>${v[0]}</td><td>${v[0] ? Math.round(v[1] / v[0] * 100) : 0}%</td><td>${v[2]}</td></tr>`).join('')}</table>` : '');
}
function showEnd(e) {
  drawEndMore(e);
  G.nextMap = e.next || null; G.votes = {}; G.myVote = null; drawVotes();
  if (e.waves) {
    const best = (prefs.wavesBest || {})[CURMAP] || 0, rec = e.wave > best; if (rec) { prefs.wavesBest = Object.assign({}, prefs.wavesBest, { [CURMAP]: e.wave }); savePrefs(); }
    $('#endTitle').textContent = 'Llegaron a la oleada ' + e.wave + (rec ? ' · ¡récord!' : ''); $('#endTitle').className = 't' + me.team;
    $('#endEye').textContent = 'OLEADAS · ' + MAPS[CURMAP].name.toUpperCase();
    const a = actors[me.id] || { k: 0, d: 0 }; const acc = me.shots ? Math.round(me.hits / me.shots * 100) : 0;
    $('#endStats').innerHTML = [[e.wave, 'Oleada alcanzada'], [Math.max(best, e.wave), 'Récord en este mapa'], [a.k + ' / ' + a.d, 'Bajas / muertes'], [acc + '%', 'Precisión']].map(([b, x]) => `<div class="stat"><b>${b}</b><span>${x}</span></div>`).join('');
    $('#endT').innerHTML = teamTable(me.team); $('#end').hidden = false; closeBuy(); releaseLock(); return;
  }
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
const MAPSW = { refinery: 'linear-gradient(90deg,#3a2a4a,#e07a3a 60%,#ffb35a)', desert: 'linear-gradient(90deg,#d6c19d,#4c8fc8)', port: 'linear-gradient(90deg,#d09a70,#2f5f80)', rural: 'linear-gradient(90deg,#1f4f9c,#6a9a4a)', city: 'linear-gradient(90deg,#2a3440,#3fe0f0 70%,#d9a22e)', snow: 'linear-gradient(90deg,#e9eef4,#8c2f24 75%,#2b4f7a)' };
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
const RULE_IDS = { rRounds: 'rounds', rTime: 'time', rMoney: 'money', rArms: 'arms', rBots: 'bots', rFF: 'ff' };
prefs.rules = PC.cleanRules(prefs.rules);
function rulesSummary(r) { const d = PC.RULES_DEF, p = []; if (r.rounds !== d.rounds) p.push(r.rounds + ' rondas'); if (r.time !== d.time) p.push(r.time + ' s'); if (r.money !== d.money) p.push('$' + r.money.toLocaleString('es-CL')); if (r.arms !== 'all') p.push({ pistolas: 'solo pistolas', franco: 'solo francotiradores', escopetas: 'solo escopetas', cuchillo: 'solo cuchillo' }[r.arms]); if (!r.bots) p.push('sin bots'); if (r.ff) p.push('fuego amigo'); return p.join(' · '); }
function drawRules() { for (const [id, k] of Object.entries(RULE_IDS)) $('#' + id).value = String(prefs.rules[k]); const s = rulesSummary(prefs.rules); $('#rulesSum').textContent = s ? '· ' + s : '· normales'; }
for (const [id, k] of Object.entries(RULE_IDS)) $('#' + id).onchange = () => { const v = $('#' + id).value; prefs.rules[k] = k === 'arms' ? v : Number(v); prefs.rules = PC.cleanRules(prefs.rules); savePrefs(); drawRules(); };
drawRules();
const baseJoin = () => ({ t: 'join', token: auth.me ? auth.token : undefined, camo: mySkin(), name: cleanName(prefs.name), map: prefs.map, diff: prefs.diff, side: prefs.side === 'auto' ? null : prefs.side, gm: prefs.gm });
$('#quick').onclick = () => { initAudio(); joinOnline(Object.assign(baseJoin(), { mode: 'quick' })); };
$('#create').onclick = () => { initAudio(); joinOnline(Object.assign(baseJoin(), { mode: 'create', pub: $('#pubRoom').checked, rules: prefs.rules })); };
$('#pubRoom').checked = prefs.pubRoom !== false; $('#pubRoom').onchange = () => { prefs.pubRoom = $('#pubRoom').checked; savePrefs(); };
/* ---------- Lista de salas públicas ---------- */
const GM_N = { bomb: 'Con carga', elim: 'Sin carga', gg: 'Escalada de armas', tdm: 'Combate por equipos', waves: 'Oleadas' }, DIFF_N = { recluta: 'bots recluta', veterano: 'bots veterano', elite: 'bots élite' };
let roomsTimer = null;
async function loadRooms() {
  if (location.protocol === 'file:') { $('#roomsBox').hidden = true; return; }
  if (G.state !== 'menu' || $('#menu').hidden) return;
  try {
    const r = await fetch('/api/rooms', { cache: 'no-store' }); const list = await r.json();
    if (!list.length) { $('#roomList').innerHTML = '<div class="small">No hay salas públicas activas. Crea una con «Pública» marcada o entra a Partida rápida.</div>'; return; }
    $('#roomList').innerHTML = list.map(x => {
      const full = x.players >= 8; const st = x.mode === 'gg' ? 'en juego' : x.mode === 'waves' ? 'oleada ' + x.round : x.mode === 'tdm' ? 'en juego · ' + x.sc[0] + '-' + x.sc[1] : x.phase === 'buy' ? 'compra · ronda ' + x.round : x.phase === 'over' ? 'terminando' : 'ronda ' + x.round + ' · ' + x.sc[0] + '-' + x.sc[1];
      const T = x.teams || { atk: [], def: [] };
      const col = sd => { const L = T[sd] || []; const hum = L.filter(q => q.h).length; const cap = L.length || 4; const closed = full || hum >= cap || (x.mode === 'waves' && sd === 'atk');
        return `<div class="tcol ${sd}"><button type="button" class="thd" data-code="${esc(x.code)}" data-side="${sd}" ${closed ? 'aria-disabled="true"' : ''}><span>${SIDE_N[sd]}</span><b>${hum}/${cap}</b></button>
        ${L.map(q => q.h ? `<div class="slot on" title="Ocupado">${esc(q.n)}</div>` : `<button type="button" class="slot" data-code="${esc(x.code)}" data-side="${sd}" ${closed ? 'aria-disabled="true"' : ''}>Libre · entrar</button>`).join('')}</div>`; };
      return `<div class="room"><div class="rn">${esc(MAPS[x.map] ? MAPS[x.map].name : x.map)}<code>${esc(x.code)}</code></div><button type="button" class="auto" data-code="${esc(x.code)}" ${full ? 'aria-disabled="true"' : ''}>${full ? 'Llena' : 'Automático'}</button>
      <div class="rd">${x.players}/8 personas · ${GM_N[x.mode] || x.mode} · ${st} · ${DIFF_N[x.diff] || ''}${x.rules && rulesSummary(x.rules) ? ' · <b class="rtag">' + esc(rulesSummary(x.rules)) + '</b>' : ''}</div>
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

// Tarjeta de entrada a la partida: arte del mapa, nombre, descripción y un consejo
const TIPS = ['Caminar con Shift no hace ruido: los enemigos no te oyen llegar.', 'Las cajas de madera y los tablones se pueden atravesar a tiros; el metal y el concreto no.', 'Recargar a mitad de un duelo te deja vendido: cambia a la pistola, es más rápido.',
  'Los primeros disparos de una ráfaga son los más precisos: dispara en ráfagas cortas a distancia.', 'Agáchate para ganar precisión, pero te mueves más lento.', 'Sin casco, el chaleco no te protege de los tiros a la cabeza.',
  'Una granada cegadora bien lanzada gana más rondas que la mejor puntería.', 'Escucha los pasos: el sonido te dice por dónde viene el enemigo.', 'Comprar en equipo gana partidas: si tu equipo ahorra, ahorra con ellos.', 'Desactivar con el kit tarda la mitad del tiempo.'];
function showLoadCard() {
  const el = $('#loadCard'); if (!el) return; const M = MAPS[CURMAP] || {};
  el.style.setProperty('--lc', MAPSW[M.theme] || 'linear-gradient(90deg,#333,#555)'); $('#lcMap').textContent = M.name || ''; $('#lcBlurb').textContent = M.blurb || ''; $('#lcTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  el.hidden = false; el.classList.remove('out'); clearTimeout(showLoadCard.t); clearTimeout(showLoadCard.t2);
  showLoadCard.t = setTimeout(() => { el.classList.add('out'); showLoadCard.t2 = setTimeout(() => { el.hidden = true; }, 600); }, 2200);
}
function enterGame() {
  drawWheel(); showLoadCard();
  G.state = 'playing'; $('#menu').hidden = true; $('#end').hidden = true; $('#pause').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !isTouch;
  const link = location.origin + location.pathname + '?sala=' + G.code; $('#inviteUrl').textContent = link; $('#inviteBox').hidden = net.mode !== 'online';
  $('#roomCode').textContent = G.code; me.ammo = {}; me.shots = me.hits = me.heads = me.kills = 0; refillAmmo(); drawSlots();
  if (net.mode === 'online') try { history.replaceState(null, '', '?sala=' + G.code); } catch (e) { }
  try { history.pushState({ pc: 1 }, '', location.href); } catch (e) { }
  if (typeof SQ !== 'undefined' && SQ.st && SQ.ready && !SQ.st.lead) { SQ.ready = false; sqSendMsg({ t: 'sq_ready', r: false }); }
  $('#app').classList.add('playing'); blurUI(); resetAim(); applyCond(G.cond); if (G.cond && G.cond.night) setTimeout(() => toast(isTouch ? 'Es de noche: la linterna se enciende sola' : 'Es de noche: F enciende o apaga la linterna'), 2500);
}
function leaveToMenu() {
  G.hlBest = null; stopRec(); $('#hlSave').hidden = true;
  me.touchLean = 0; me.lean = 0; me.slideT = 0; $('#bLeanL').classList.remove('on'); $('#bLeanR').classList.remove('on');
  toggleOrders(false); voiceStop();
  clearFires();
  rangeStop();
  G.reveal = G.drone = 0; me.streak = 0;
  applyCond(null); clearDecals(); flashT = shake = 0; for (const d of dmgDirs) d.el.remove(); dmgDirs.length = 0; me.crouchToggle = false; $('#bCrouch').classList.remove('on'); lockFails = 0; lockFailed = false; if (meModel) { scene.remove(meModel.g); meModel = null; }
  leaveNet(); stopAmbience(); G.state = 'menu'; $('#app').classList.remove('playing'); toastT = annT = 0; $('#toast').classList.remove('on'); $('#announce').classList.remove('on'); $('#feed').innerHTML = ''; $('#hud').hidden = true; $('#touch').hidden = true; $('#pause').hidden = true; $('#end').hidden = true; $('#buy').hidden = true; $('#board').hidden = true; $('#menu').hidden = false;
  for (const a of actors) if (a && a.model) scene.remove(a.model.g); actors.length = 0; for (const el of tagEls.values()) el.remove(); tagEls.clear();
  stopKillcam(); closeChat(false); toggleWheel(false); for (const pg of pings) pg.el.remove(); pings.length = 0; $('#chatBox').innerHTML = ''; rec.length = 0; recShots.length = 0;
  for (const [id, s] of smokes) { scene.remove(s.g); } smokes.clear(); updateDrops([]); updateNades([]); bombMesh.visible = false; me.alive = false; releaseLock();
  try { history.replaceState(null, '', location.pathname); } catch (e) { }
  drawProfile(); loadRooms();
}
function openPause() { if (G.state !== 'playing') return; $('#tpRow').hidden = !G.comp; closeBuy(); $('#pause').hidden = false; me.fireHeld = false; me.altHeld = false; me.nadeArm = false; releaseLock(); }
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
function wkText(c) { const d = PC.WK_POOL.find(x => x.id === c.id); return d ? d.txt.replace('{n}', c.n) : ''; }
function ensureWeekly() { const w = PC.weekId(); if (prof.wk === w && prof.wch && prof.wch.length === 3) return; prof.wk = w; prof.wch = PC.weeklyFor(w); saveProf(); }
function addXP(n, why) {
  prof.xp += n; let up = false;
  while (prof.xp >= needXP(prof.lvl)) { prof.xp -= needXP(prof.lvl); prof.lvl++; up = true; const unl = PC.CAMOS.find(c => c.lvl === prof.lvl); announce('Subiste a nivel ' + prof.lvl, unl ? 'Desbloqueaste el camuflaje ' + unl.name + '. Elígelo en el menú principal.' : 'Sigue sumando experiencia', 3.2, 'var(--amber)'); }
  if (up) { sTone(660, .12, .2, 'triangle'); sTone(880, .12, .2, 'triangle', 0, .1); sTone(1180, .22, .2, 'triangle', 0, .2); }
  saveProf(); xpPop('+' + n + ' · ' + why);
}
function progress(id, amt = 1) { ensureWeekly(); for (const c of prof.wch) if (c.id === id && !c.done) { c.p = Math.min(c.n, c.p + amt); if (c.p >= c.n) { c.done = true; toast('Reto semanal completado: ' + wkText(c) + ' · +' + PC.WEEKLY_XP); saveProf(); addXP(PC.WEEKLY_XP, 'reto semanal'); } }
  ensureDaily(); for (const c of prof.ch) if (c.id === id && !c.done) { c.p = Math.min(c.n, c.p + amt); if (c.p >= c.n) { c.done = true; toast('Desafío diario completado: ' + chText(c)); saveProf(); addXP(500, 'desafío diario'); } } saveProf(); }
function xpPop(s) { const el = $('#xpPop'); el.textContent = s; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function progressEvent(e) {
  if (me.id < 0 || G.state !== 'playing' || auth.me) return;
  switch (e.k) {
    case 'kill': if (e.a === me.id && e.v !== me.id && teamOf(e.v) !== me.team) { addXP(100 + (e.h ? 50 : 0), e.h ? 'baja a la cabeza' : 'baja'); progress('kills'); if (e.h) progress('heads'); if (e.w === 'knife') progress('knife'); if (e.w === 'he') progress('nade'); if (e.w === 'es12') progress('shotgun'); if (e.wb) progress('wb'); if (e.dist >= 35) progress('far'); if (e.w === 'sr' || e.w === 'tr7') progress('sniper'); } else if (e.ast && e.ast.includes(me.id)) addXP(40, 'asistencia'); break;
    case 'plant': if (e.v === me.id) { addXP(150, 'carga plantada'); progress('plant'); } break;
    case 'defused': if (e.v === me.id) { addXP(200, 'carga desactivada'); progress('defuse'); } break;
    case 'rend': if (e.w === me.team) { addXP(100, 'ronda ganada'); progress('rounds'); } break;
    case 'mend': if (e.gg ? e.win === me.id : e.w === me.team) { addXP(500, 'partida ganada'); progress('win'); if (e.gg) progress('ggwin'); } progress('match'); if (e.comp && e.w !== -1) { const r0 = PC.rankOf(prof.rank), d = e.w === me.team ? 25 : -20; prof.rank = Math.max(0, (prof.rank || 0) + d); saveProf(); const r1 = PC.rankOf(prof.rank); xpPop((d > 0 ? '+' : '') + d + ' de rango' + (r1 !== r0 ? ' · ' + PC.RANKS[r1] : '')); } break;
    case 'lvl': if (e.v === me.id) addXP(40, 'nivel de arma'); break;
  }
}
function rankBadge(pts, size = 34) {
  const i = PC.rankOf(pts), tier = i < 4 ? ['#b98a5a', '#5a3d22'] : i < 8 ? ['#e8c35c', '#6b4a12'] : ['#ff7a5a', '#5a1410'], n = i % 4 + 1;
  let marks = ''; for (let k = 0; k < (i >= 8 ? 0 : n); k++) marks += `<path d="M10 ${28 - k * 5}l7-4 7 4" fill="none" stroke="${tier[0]}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (i >= 8) marks = `<path d="M17 ${i === 9 ? 9 : 12}l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.8-4.9 2.8 1.1-5.3-4-3.7 5.4-.6z" fill="${tier[0]}"/>` + (i === 9 ? `<path d="M9 27h16" stroke="${tier[0]}" stroke-width="2.4" stroke-linecap="round"/>` : '');
  return `<svg class="rkb" width="${size}" height="${size}" viewBox="0 0 34 34" role="img" aria-label="Rango ${PC.RANKS[i]}"><path d="M17 2l13 5v9c0 8-5.6 13.7-13 16-7.4-2.3-13-8-13-16V7z" fill="${tier[1]}" stroke="${tier[0]}" stroke-width="1.5"/>${marks}</svg>`;
}
function drawProfile() {
  if (!auth.me) { ensureDaily(); ensureWeekly(); } drawAccount(); const need = needXP(prof.lvl);
  const camos = [{ id: null, name: 'Sin camuflaje', lvl: 1 }].concat(PC.CAMOS);
  const rk = prof.rank || 0, ri = PC.rankOf(rk);
  $('#profBox').innerHTML = `<div class="rankRow">${rankBadge(rk)}<div><div class="lbl small">Rango competitivo</div><b>${PC.RANKS[ri]}</b><span class="small"> · ${ri >= PC.RANKS.length - 1 ? rk + ' puntos' : (rk % 100) + ' / 100 para ' + PC.RANKS[ri + 1]}</span></div><button type="button" class="go ghost sm" id="statsOpen">Estadísticas</button></div><div class="prof"><div class="lvl"><b>${prof.lvl}</b><span>nivel</span></div><div class="xpw"><div class="small">${prof.xp} / ${need} de experiencia</div><div class="xpbar"><s style="width:${Math.min(100, prof.xp / need * 100)}%"></s></div></div></div>
  <div class="invHead"><span class="lbl small">Camuflaje general (todas las armas)</span><span class="sqrow" style="margin:0"><button type="button" class="go ghost sm" id="passOpen">Pase de temporada</button><button type="button" class="go ghost sm" id="invOpen">Inventario de skins</button></span></div><div class="camos">${camos.map(c => { const lock = c.id ? camoLocked(c) : false; const sel = (prof.camo || null) === c.id; return `<button type="button" class="camo" data-c="${c.id || ''}" aria-pressed="${sel}" ${lock ? 'aria-disabled="true"' : ''} title="${c.name}${lock ? ' · ' + camoLockTxt(c) : ''}"><span class="sw" style="${c.id ? `background-image:url(${PCM.camoSwatch(c.id)})` : ''}"></span><span class="cn">${lock ? 'Nv ' + c.lvl : c.name}</span></button>`; }).join('')}</div>
  <div class="lbl small">Medallas · ${Object.keys(prof.medals || {}).length} de ${PC.MEDALS.length}</div><div class="medals">${PC.MEDALS.map(m => { const n = (prof.medals || {})[m.id] || 0; const ini = m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); return `<div class="medal${n ? '' : ' off'}" title="${esc(m.name + ': ' + m.desc)}"><i style="background:${m.c}">${ini}</i><b>${esc(m.name)}</b>${n ? `<small>×${n}</small>` : `<span>${esc(m.desc)}</span>`}</div>`; }).join('')}</div>
  <div class="lbl small">Desafíos de hoy</div><div class="daily">${prof.ch.map(c => `<div class="ch${c.done ? ' done' : ''}"><span>${chText(c)}</span><b>${c.p}/${c.n}</b><i><s style="width:${c.p / c.n * 100}%"></s></i></div>`).join('')}</div>
  <div class="lbl small">Retos de la semana · +${PC.WEEKLY_XP} cada uno</div><div class="daily">${(prof.wch || []).map(c => `<div class="ch${c.done ? ' done' : ''}"><span>${wkText(c)}</span><b>${c.p}/${c.n}</b><i><s style="width:${c.p / c.n * 100}%"></s></i></div>`).join('')}</div>`;
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
  const box = $('#acctBox'); if (!box) return; if (typeof CLAN !== 'undefined') { if (auth.me && CLAN.lastUser !== auth.me.user) { CLAN.lastUser = auth.me.user; loadClan(); } else if (!auth.me) { CLAN.st = null; CLAN.lastUser = null; } drawClan(); }
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

/* ================= ESTADÍSTICAS PERSONALES: MAPA DE CALOR E HISTORIAL ================= */
function heatAdd(e) {
  if (G.mode === 'range' || me.id < 0) return; const H = prefs.heat || (prefs.heat = {}), M = H[CURMAP] || (H[CURMAP] = { d: [], k: [] });
  if (e.v === me.id) M.d.push([+me.pos.x.toFixed(1), +me.pos.z.toFixed(1)]); else if (e.a === me.id && e.v !== me.id) M.k.push([+me.pos.x.toFixed(1), +me.pos.z.toFixed(1)]); else return;
  if (M.d.length > 400) M.d.shift(); if (M.k.length > 400) M.k.shift(); savePrefs();
}
function histAdd(e) {
  if (G.mode === 'range' || me.id < 0 || !e.st) return; const row = e.st.find(r => r[0] === me.id); const ro = (G.roster || []).find(r => r[0] === me.id); if (!row) return;
  const rounds = (e.sc || [0, 0]).reduce((a, b) => a + b, 0) || 1, wk = (e.wk && e.wk[me.id]) || {};
  const H = prefs.hist || (prefs.hist = []); H.unshift({ t: Date.now(), map: CURMAP, mode: G.comp ? 'comp' : G.mode, res: e.gg ? (e.win === me.id ? 'v' : 'd') : e.w === -1 ? 'e' : e.w === me.team ? 'v' : 'd', sc: e.sc, k: ro ? ro[3] : 0, d: ro ? ro[4] : 0, a: ro ? ro[5] : 0, dmg: row[1], adr: Math.round(row[1] / rounds), acc: row[5] ? Math.round(row[6] / row[5] * 100) : 0, hs: row[2] ? Math.round(row[4] / row[2] * 100) : 0,
    w: Object.entries(wk).filter(([w]) => WEAPONS[w]).map(([w, v]) => [w, v[0], v[1], v[2]]) });
  while (H.length > 20) H.pop(); savePrefs();
}
const MODE_TXT = { bomb: 'Con carga', elim: 'Sin carga', gg: 'Escalada', tdm: 'Por equipos', waves: 'Oleadas', comp: 'Competitivo' };
function drawStats(tab) {
  const el = $('#statsBody'); if (!el) return; tab = tab || drawStats.tab || 'hist'; drawStats.tab = tab; document.querySelectorAll('#statsTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === tab));
  const H = prefs.hist || [];
  if (tab === 'hist') { el.innerHTML = H.length ? `<table class="hist"><tr><th>Resultado</th><th>Mapa</th><th>Modo</th><th>B/M/A</th><th>Daño/ronda</th><th>Precisión</th><th>Cabeza</th></tr>${H.map(h => `<tr><td class="r-${h.res}">${{ v: 'Victoria', d: 'Derrota', e: 'Empate' }[h.res]}${h.sc ? ' ' + h.sc.join('-') : ''}</td><td>${esc((MAPS[h.map] || {}).name || h.map)}</td><td>${MODE_TXT[h.mode] || h.mode}</td><td>${h.k}/${h.d}/${h.a}</td><td>${h.adr}</td><td>${h.acc}%</td><td>${h.hs}%</td></tr>`).join('')}</table>` : '<p class="small">Juega una partida y aquí aparecerán tus últimas 20.</p>'; return; }
  if (tab === 'arms') { const agg = {}; for (const h of H) for (const [w, s, hi, k] of h.w || []) { const a = agg[w] || (agg[w] = [0, 0, 0, 0]); a[0] += s; a[1] += hi; a[2] += k; a[3]++; }
    const rows = Object.entries(agg).sort((a, b) => b[1][2] - a[1][2] || b[1][0] - a[1][0]);
    el.innerHTML = rows.length ? `<table class="hist"><tr><th>Arma</th><th>Partidas</th><th>Disparos</th><th>Precisión</th><th>Bajas</th></tr>${rows.map(([w, a]) => `<tr><td>${esc(WEAPONS[w].name)}</td><td>${a[3]}</td><td>${a[0]}</td><td>${a[0] ? Math.round(a[1] / a[0] * 100) : 0}%</td><td>${a[2]}</td></tr>`).join('')}</table>` : '<p class="small">Aún no hay datos de armas.</p>'; return; }
  const map = drawStats.map || CURMAP || PC.MAP_IDS[0]; drawStats.map = map;
  el.innerHTML = `<div class="seg" id="heatMaps">${PC.MAP_IDS.map(id => `<button type="button" data-m="${id}" aria-pressed="${id === map}">${esc(MAPS[id].name)}</button>`).join('')}</div><canvas id="heatCv" width="560" height="420"></canvas><div class="small"><span style="color:#ff4d3a">●</span> donde caíste · <span style="color:#8fd694">●</span> donde conseguiste bajas</div>`;
  const cv = $('#heatCv'), x = cv.getContext('2d'), M = MAPS[map], [x0, z0, x1, z1] = M.bounds, sc = Math.min(cv.width / (x1 - x0), cv.height / (z1 - z0)) * .95, ox = (cv.width - (x1 - x0) * sc) / 2, oz = (cv.height - (z1 - z0) * sc) / 2;
  const P = (px, pz) => [ox + (px - x0) * sc, oz + (pz - z0) * sc];
  x.fillStyle = '#12161a'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = 'rgba(233,220,192,.08)'; x.fillRect(ox, oz, (x1 - x0) * sc, (z1 - z0) * sc);
  for (const [bx0, bz0, bx1, bz1, h, mat, y0] of M.boxes) { if ((y0 || 0) > 1.5) continue; const [a, b] = P(Math.min(bx0, bx1), Math.min(bz0, bz1)); x.fillStyle = h > 1.5 ? 'rgba(233,220,192,.32)' : 'rgba(233,220,192,.16)'; x.fillRect(a, b, Math.abs(bx1 - bx0) * sc, Math.abs(bz1 - bz0) * sc); }
  for (const k in M.sites) { const [a, b] = P(...M.sites[k].c); x.fillStyle = '#ff6e50'; x.font = '700 16px system-ui'; x.fillText(k, a - 5, b + 6); }
  const D = ((prefs.heat || {})[map]) || { d: [], k: [] }; x.globalCompositeOperation = 'lighter';
  const blob = (pts, rgb) => { for (const [px, pz] of pts) { const [a, b] = P(px, pz), g = x.createRadialGradient(a, b, 0, a, b, 16); g.addColorStop(0, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(a - 16, b - 16, 32, 32); } };
  blob(D.d, '255,77,58'); blob(D.k, '143,214,148'); x.globalCompositeOperation = 'source-over';
  if (!D.d.length && !D.k.length) { x.fillStyle = '#a29a88'; x.font = '13px system-ui'; x.fillText('Aún no hay datos en este mapa', 20, 28); }
  document.querySelectorAll('#heatMaps button').forEach(b => b.onclick = () => { drawStats.map = b.dataset.m; drawStats('heat'); });
}
document.addEventListener('click', e => { if (e.target.id === 'statsOpen') { $('#stats').hidden = false; drawStats(); drawRvList(); } const tb = e.target.closest('#statsTabs button'); if (tb) drawStats(tb.dataset.t); if (e.target.id === 'statsClose') $('#stats').hidden = true; });

/* ================= VISOR DE REPETICIONES (rondas de tu última partida) ================= */
const RV = { list: [], cur: null, on: false, r: null, t: 0, play: true, speed: 1, view: 'free', models: {}, yaw: .6, pitch: -.75, dist: 38, tgt: [0, 0], lastShot: 0, drag: null };
function drawRvList() { const el = $('#rvList'); if (!el) return; el.innerHTML = RV.list.length ? RV.list.map((r, i) => `<button type="button" class="go ghost sm" data-rv="${i}">Ronda ${r.round} · ${esc((MAPS[r.map] || {}).name || '')} · ${r.kills.length} bajas</button>`).join('') : '<span class="small">Juega una partida: aquí quedan sus últimas 12 rondas para verlas desde cualquier jugador.</span>'; }
document.addEventListener('click', e => { const b = e.target.closest('[data-rv]'); if (b) startReplay(+b.dataset.rv); });
function startReplay(i) {
  const R = RV.list[i]; if (!R || G.state === 'playing') { if (G.state === 'playing') toast('Las repeticiones se ven desde el menú, al salir de la partida'); return; }
  $('#stats').hidden = true; $('#menu').hidden = true; if (CURMAP !== R.map) buildWorld(R.map);
  for (const k in RV.models) scene.remove(RV.models[k].g); RV.models = {};
  for (const id in R.frames[0].a) { const m = PCM.buildSoldier(R.teams[id] || 0, +id, { flashMat }); scene.add(m.g); RV.models[id] = m; }
  const M = MAPS[R.map]; RV.tgt = [(M.bounds[0] + M.bounds[2]) / 2, (M.bounds[1] + M.bounds[3]) / 2];
  RV.on = true; RV.r = R; RV.t = R.frames[0].t; RV.play = true; RV.view = 'free'; RV.lastShot = RV.t; $('#rv').hidden = false;
  $('#rvView').innerHTML = '<option value="free">Cámara libre</option>' + Object.keys(R.frames[0].a).map(id => `<option value="${id}">${esc(R.names[id] || 'Jugador ' + id)} (${(R.teams[id] || 0) === 0 ? 'antiterroristas' : 'terroristas'})</option>`).join('');
  const T0 = R.frames[0].t, T1 = R.frames[R.frames.length - 1].t; $('#rvSeek').max = (T1 - T0).toFixed(2); $('#rvSeek').value = 0;
  $('#rvTicks').innerHTML = R.kills.map(k => `<i style="left:${((k.t - T0) / (T1 - T0) * 100).toFixed(2)}%" title="${esc(R.names[k.a] || '')} → ${esc(R.names[k.v] || '')}" class="t${R.teams[k.a] || 0}"></i>`).join('');
  $('#rvTitle').textContent = `Ronda ${R.round} · ${(MAPS[R.map] || {}).name || ''}`;
}
function stopReplay() { RV.on = false; for (const k in RV.models) scene.remove(RV.models[k].g); RV.models = {}; $('#rv').hidden = true; $('#menu').hidden = false; }
function rvState(t) { const F = RV.r.frames; let i = 0; while (i < F.length - 1 && F[i + 1].t <= t) i++; const p = F[i], b = F[Math.min(i + 1, F.length - 1)], k = b.t > p.t ? clamp((t - p.t) / (b.t - p.t), 0, 1) : 0, out = {};
  for (const id in p.a) { const A = p.a[id], B = b.a[id] || A; out[id] = { x: lerp(A[0], B[0], k), y: lerp(A[1], B[1], k), z: lerp(A[2], B[2], k), yaw: A[3] + angDiff(A[3], B[3]) * k, pitch: lerp(A[4], B[4], k), h: lerp(A[5], B[5], k), alive: A[6], cur: A[7] }; } return out; }
function rvRender(dt) {
  const R = RV.r, T0 = R.frames[0].t, T1 = R.frames[R.frames.length - 1].t;
  if (RV.play) { RV.t = Math.min(T1, RV.t + dt * RV.speed); if (RV.t >= T1) RV.play = false; $('#rvSeek').value = (RV.t - T0).toFixed(2); $('#rvPlay').textContent = RV.play ? 'Pausa' : 'Reproducir'; }
  const st = rvState(RV.t), st2 = rvState(RV.t - .1);
  for (const id in RV.models) { const m = RV.models[id], s = st[id]; if (!s || !s.alive) { m.g.visible = false; continue; } const s0 = st2[id] || s, spd = Math.hypot(s.x - s0.x, s.z - s0.z) / .1;
    m.g.visible = RV.view !== id; m.g.position.set(s.x, s.y, s.z); m.g.rotation.y = s.yaw; m.ph = (m.ph || 0) + dt * spd * 2.2 * RV.speed; m.animate(spd, m.ph, clamp((1.8 - s.h) / .58, 0, 1), s.pitch); m.setGun(s.cur); m.flash.visible = false; }
  for (const sh of R.shots) { if (sh.t <= RV.lastShot || sh.t > RV.t) continue; const m = RV.models[sh.s]; if (!m || !m.g.visible) continue; const from = new THREE.Vector3(); m.muzzle.getWorldPosition(from); tracer(from, new THREE.Vector3(sh.e[0], sh.e[1], sh.e[2])); m.flash.visible = true; }
  for (const k of R.kills) if (k.t > RV.lastShot && k.t <= RV.t) toast(`${R.names[k.a] || '—'} eliminó a ${R.names[k.v] || '—'}${k.h ? ' (a la cabeza)' : ''}`);
  RV.lastShot = RV.t;
  const v = RV.view !== 'free' ? st[RV.view] : null;
  if (v && v.alive) { camera.position.set(v.x, v.y + v.h - .12, v.z); camera.rotation.set(v.pitch, v.yaw, 0); }
  else { const cy = Math.cos(RV.pitch), [tx, tz] = RV.tgt; camera.position.set(tx + Math.sin(RV.yaw) * cy * RV.dist, Math.max(3, -Math.sin(RV.pitch) * RV.dist), tz + Math.cos(RV.yaw) * cy * RV.dist); camera.lookAt(tx, 0, tz); }
  if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
}
// controles del visor: arrastrar para girar, rueda para acercar, WASD para mover la cámara libre
renderer.domElement.addEventListener('pointerdown', e => { if (RV.on) RV.drag = [e.clientX, e.clientY]; });
addEventListener('pointerup', () => { RV.drag = null; });
addEventListener('pointermove', e => { if (!RV.on || !RV.drag) return; RV.yaw -= (e.clientX - RV.drag[0]) * .006; RV.pitch = clamp(RV.pitch - (e.clientY - RV.drag[1]) * .005, -1.45, -.15); RV.drag = [e.clientX, e.clientY]; });
addEventListener('wheel', e => { if (RV.on) RV.dist = clamp(RV.dist * (e.deltaY > 0 ? 1.1 : .9), 6, 90); }, { passive: true });
addEventListener('keydown', e => { if (!RV.on) return; const s = 2.2, f = [-Math.sin(RV.yaw), -Math.cos(RV.yaw)]; if (e.code === 'KeyW') { RV.tgt[0] += f[0] * s; RV.tgt[1] += f[1] * s; } if (e.code === 'KeyS') { RV.tgt[0] -= f[0] * s; RV.tgt[1] -= f[1] * s; } if (e.code === 'KeyA') { RV.tgt[0] += f[1] * s; RV.tgt[1] -= f[0] * s; } if (e.code === 'KeyD') { RV.tgt[0] -= f[1] * s; RV.tgt[1] += f[0] * s; } if (e.code === 'Space') { RV.play = !RV.play; e.preventDefault(); } if (e.code === 'Escape') stopReplay(); });

/* ================= REPETICIÓN DE LA BAJA ================= */
const rec = [], recShots = []; const REC0 = rec; let kc = null, meModel = null; const spec = { id: -1, yaw: 0, pitch: 0, x: 0, y: 0, z: 0 };
function recordSnap(m, t) {
  const fr = { t, a: {} }; for (const r of m.a) fr.a[r[0]] = [r[1], r[2], r[3], r[4], r[5], r[6], r[8], r[9], r[7]];
  rec.push(fr); while (rec.length && t - rec[0].t > 7) rec.shift();
  if (G.mode !== 'range') { let R = RV.cur; if (!R || R.round !== m.rd) { if (R && R.frames.length > 20) { RV.list.push(R); while (RV.list.length > 12) RV.list.shift(); } R = RV.cur = { round: m.rd, map: CURMAP, frames: [], shots: [], kills: [], names: {}, teams: {} }; }
    if (!R.lastT || t - R.lastT >= .12) { R.lastT = t; R.frames.push(fr); }
    for (const e of m.ev) { if (e.k === 'shot') R.shots.push({ t, s: e.s, e: e.e, w: e.w, hit: e.hit }); else if (e.k === 'kill') R.kills.push({ t, a: e.a, v: e.v, w: e.w, h: e.h }); }
    for (const r of m.a) if (!R.names[r[0]] && actors[r[0]]) { R.names[r[0]] = actors[r[0]].name; R.teams[r[0]] = actors[r[0]].team; } }
  for (const e of m.ev) if (e.k === 'shot') recShots.push({ t, s: e.s, e: e.e, w: e.w, hit: e.hit });
  while (recShots.length && t - recShots[0].t > 7) recShots.shift();
}
function kcState(rt) {
  const rec = (kc && kc.frames) || REC0;
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
function stopKillcam() { if (!kc) return; const k0 = kc; kc = null; if (k0.onDone) setTimeout(k0.onDone, 0); $('#killcam').hidden = true; if (meModel) meModel.g.visible = false; PCM.setFpTeam(me.team); spec.id = -1; }
function kcActive() { return !!kc && (kc.hl || !me.alive) && G.state === 'playing' && nowS() >= kc.start; }
// Jugada de la partida: se repite al terminar desde los ojos de quien la hizo; si es tuya, se graba un video
function startHighlight(e) {
  const H = G.hlBest; const a = actors[H.v]; if (!a) { showEnd(e); return; }
  G.hlVideo && URL.revokeObjectURL(G.hlVideo); G.hlVideo = null;
  kc = { hl: true, frames: H.frames, shots: H.shots, start: nowS() + .4, from: H.from, len: H.to - H.from, end: H.to, slowEnd: H.ev + .15, rt: H.from, killer: H.v, kteam: a.team, w: a.cur, h: 0, dist: 0, lastRt: H.from, hp: null, cam: null, phase: 'eyes', orbitT: 0, orbitLen: 1.6, view: null, desc: H.d, onDone: () => { stopRec(); if (G.state === 'playing' && G.phase === 'over') showEnd(e); } };
  closeBuy(); releaseLock();
  if (H.v === me.id && renderer.domElement.captureStream && window.MediaRecorder) {
    try { const st = renderer.domElement.captureStream(30); const mt = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)); const mr = new MediaRecorder(st, mt ? { mimeType: mt, videoBitsPerSecond: 4e6 } : undefined); const parts = []; mr.ondataavailable = ev => { if (ev.data.size) parts.push(ev.data); }; mr.onstop = () => { if (parts.length) { G.hlVideo = URL.createObjectURL(new Blob(parts, { type: 'video/webm' })); const b = $('#hlSave'); b.href = G.hlVideo; b.hidden = false; } }; setTimeout(() => { if (kc && kc.hl) mr.start(); }, 400); G.hlRec = mr; } catch (err) { G.hlRec = null; }
  }
}
function startFinalKill(L) {
  if (G.state !== 'playing' || kc || rec.length < 20 || !actors[L.a]) return; const t0 = L.t - 1.4, t1 = L.t + .35;
  kc = { hl: true, cine: true, frames: rec.filter(f => f.t >= t0 - .1), shots: recShots.filter(x => x.t >= t0 - .1), start: nowS(), from: t0, len: t1 - t0, end: t1, rt: t0, killer: L.a, victim: L.v, kteam: actors[L.a].team, w: L.w, h: L.h, dist: 0, lastRt: t0, hp: null, cam: null, phase: 'cine', orbitT: 0, orbitLen: .01, view: null, desc: 'Última baja de la ronda', ang: Math.random() * 6 };
}
function stopRec() { const mr = G.hlRec; G.hlRec = null; if (mr && mr.state === 'recording') try { mr.stop(); } catch (e) { } }
function kcRender(dt) {
  // tiempo de repetición: velocidad normal y cámara lenta en el último medio segundo
  if (kc.cine) { kc.rt += dt * .42; if (kc.rt >= kc.end) { stopKillcam(); return; } }
  else if (kc.phase === 'eyes') { const slow = (kc.slowEnd || kc.end) - kc.rt < .5 && (kc.slowEnd || kc.end) - kc.rt > -.4; kc.rt += dt * (slow ? .32 : 1); if (kc.rt >= kc.end) { kc.rt = kc.end; kc.phase = 'orbit'; kc.orbitT = 0; } }
  else { kc.orbitT += dt; if (kc.orbitT >= kc.orbitLen) { stopKillcam(); return; } }
  const rt = kc.rt; const st = kcState(rt), st2 = kcState(rt - .06); if (!st) { stopKillcam(); return; }
  if (!meModel || meModel.tm !== me.team) { if (meModel) scene.remove(meModel.g); meModel = makeSoldier(me.team, me.id); meModel.tm = me.team; }
  if (meModel.setCamo) meModel.setCamo(mySkin());
  const place = (m, id) => {
    const s1 = st[id]; if (!s1 || !s1.alive) { m.g.visible = false; return; }
    const s0 = st2 && st2[id] ? st2[id] : s1; const spd = Math.hypot(s1.x - s0.x, s1.z - s0.z) / .06;
    m.g.visible = id != kc.killer || kc.phase === 'orbit' || !!kc.cine; m.g.position.set(s1.x, s1.y, s1.z); m.g.rotation.y = s1.yaw; m.body.rotation.x = 0; m.body.position.y = 0;
    m.kcPh = (m.kcPh || 0) + dt * spd * 2.2; m.animate(spd, m.kcPh, clamp((1.8 - s1.h) / .58, 0, 1), s1.pitch); m.setGun(s1.cur); m.flash.visible = false;
  };
  for (const a of actors) if (a && a.model) place(a.model, a.id);
  place(meModel, me.id);
  const k = st[kc.killer], k0 = st2 && st2[kc.killer];
  if (k) {
    kc.view = { cur: k.cur, spd: k0 ? Math.hypot(k.x - k0.x, k.z - k0.z) / .06 : 0 };
    if (kc.cine) { // órbita lenta, baja y abierta, entre quien dispara y quien cae
      const v = st[kc.victim] || k, mx = (k.x + v.x) / 2, mz = (k.z + v.z) / 2, sep = Math.hypot(v.x - k.x, v.z - k.z), R = clamp(sep * .6 + 2.2, 3, 9), a = kc.ang + (kc.rt - kc.from) * .5;
      let cx = mx + Math.cos(a) * R, cz = mz + Math.sin(a) * R; const cy = 1.1 + R * .12; if (WORLD && !WORLD.visible([mx, 1.3, mz], [cx, cy, cz], [])) { cx = mx + (cx - mx) * .45; cz = mz + (cz - mz) * .45; }
      const hd = Math.hypot(mx - cx, mz - cz) || 1; kc.cam = { x: cx, y: cy, z: cz, yaw: Math.atan2(-(mx - cx), -(mz - cz)), pitch: Math.atan2(1.1 - cy, hd) };
    }
    else if (kc.phase === 'eyes') kc.cam = { x: k.x, y: k.y + k.h - .12, z: k.z, yaw: k.yaw, pitch: k.pitch };
    else {
      // plano final: por detrás del hombro del rival mirando hacia donde caíste
      const v = st[me.id] || { x: k.x - Math.sin(k.yaw) * 5, y: 0, z: k.z - Math.cos(k.yaw) * 5 };
      const dx = v.x - k.x, dz = v.z - k.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, e = Math.min(1, kc.orbitT / .5), ee = e * e * (3 - 2 * e);
      const cx = k.x - ux * (1.4 + ee * 1.6) + uz * (.55 + ee * .9), cz = k.z - uz * (1.4 + ee * 1.6) - ux * (.55 + ee * .9), cy = k.y + 1.75 + ee * .9;
      const tx = (k.x + v.x) / 2, tz = (k.z + v.z) / 2, ty = .9; const hd = Math.hypot(tx - cx, tz - cz) || 1;
      kc.cam = { x: cx, y: cy, z: cz, yaw: Math.atan2(-(tx - cx), -(tz - cz)), pitch: Math.atan2(ty - cy, hd) };
    }
  }
  for (const sh of kc.shots || recShots) {
    if (sh.t <= kc.lastRt || sh.t > rt) continue;
    const a = actors[sh.s]; const m = a && a.model; if (!m) continue;
    const from = new THREE.Vector3(); const mine = sh.s === kc.killer && kc.phase === 'eyes' && !kc.cine; if (mine) { from.copy(vmMuzzleWorld()); vm.kick = 1; vm.flashT = .05; } else m.muzzle.getWorldPosition(from);
    const end = new THREE.Vector3(sh.e[0], sh.e[1], sh.e[2]); tracer(from, end); if (sh.hit) burst(end, [0, .3, 0], [.55, .05, .04], 2.4, 8); const pa = posAudio(from.x, from.z); sShot(WEAPONS[sh.w] && WEAPONS[sh.w].snd, sh.s === kc.killer ? 0 : pa.d, pa.pan);
  }
  kc.lastRt = rt;
}

/* ================= ÓRDENES POR VOZ A LOS BOTS ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const VOICE = { rec: null, on: false, txt: '', handled: false, denied: false };
let orderOpen = false;
function parseOrder(raw) {
  const t = ' ' + String(raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (/ humo /.test(t)) return 'smoke';
  if (/reagrup|vuelvan|junten|juntense|regresen/.test(t)) return 'regroup';
  if (/sigan|siganme|sigueme|conmigo|vengan|seguime|vente|venganse/.test(t)) return 'follow';
  if (/esperen|espera |alto |quietos|detenganse|aguanten|quedense/.test(t)) return 'wait';
  if (/avancen|ataquen|empujen|cacen|vamos por ellos|a por ellos|al ataque|presionen/.test(t)) return 'push';
  const site = / (b|be|bravo|sitio b|punto b) /.test(t) ? 'B' : / (alfa|sitio a|punto a|zona a) /.test(t) || / a $/.test(t) ? 'A' : null;
  if (site && /cubr|defiend|vayan|vamos|tomen|al sitio|sitio|punto|vayanse|corran/.test(t)) return site === 'A' ? 'holdA' : 'holdB';
  return null;
}
function sendOrder(c) {
  if (G.state !== 'playing' || !c) return; let p;
  if (c === 'smoke') { const o = [camera.position.x, camera.position.y, camera.position.z]; const d = aimDir(0, 0, 0); const r = WORLD.traceWorld(o, d, 45); p = [+(o[0] + d[0] * r.t).toFixed(2), +(o[2] + d[2] * r.t).toFixed(2)]; }
  sendMsg({ t: 'order', c, p });
}
function handleVoice(txt) {
  if (VOICE.handled) return; VOICE.handled = true; const c = parseOrder(txt);
  if (c) sendOrder(c); else if (txt) toast('No entendí «' + txt + '». Prueba: síganme, esperen, cubran A, avancen o tiren humo');
}
function voiceStart() {
  if (!SR || VOICE.on || G.state !== 'playing') return; let r;
  try { r = new SR(); } catch (e) { VOICE.denied = true; toggleOrders(true); return; }
  const lg = navigator.language || ''; r.lang = /^es/i.test(lg) ? lg : 'es-ES'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = false;
  r.onresult = ev => { let txt = ''; let fin = false; for (let i = ev.resultIndex; i < ev.results.length; i++) { txt += ev.results[i][0].transcript; if (ev.results[i].isFinal) { fin = true; for (let k = 0; k < ev.results[i].length; k++) if (parseOrder(ev.results[i][k].transcript)) { txt = ev.results[i][k].transcript; break; } } } VOICE.txt = txt.trim(); $('#voiceTxt').textContent = VOICE.txt ? '«' + VOICE.txt + '»' : ''; if (fin) handleVoice(VOICE.txt); };
  r.onerror = ev => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { VOICE.denied = true; toast('Sin permiso de micrófono: usa el menú de órdenes (T) o permite el micrófono en el navegador'); } else if (ev.error === 'network') toast('El reconocimiento de voz necesita internet. Usa el menú de órdenes (T).'); };
  r.onend = () => { VOICE.on = false; $('#voiceInd').hidden = true; $('#bVoice').classList.remove('on'); if (!VOICE.handled && VOICE.txt) handleVoice(VOICE.txt); };
  VOICE.rec = r; VOICE.on = true; VOICE.handled = false; VOICE.txt = ''; $('#voiceTxt').textContent = ''; $('#voiceInd').hidden = false; $('#bVoice').classList.add('on');
  try { r.start(); } catch (e) { VOICE.on = false; $('#voiceInd').hidden = true; }
}
function voiceStop() { if (VOICE.rec && VOICE.on) try { VOICE.rec.stop(); } catch (e) { } }
function drawOrders() { const ks = Object.keys(PC.ORDERS); $('#orderWheel').innerHTML = ks.map((k, i) => `<button type="button" data-o="${k}" style="--a:${i * (360 / ks.length)}deg"><kbd>${i + 1}</kbd>${PC.ORDERS[k]}</button>`).join('') + `<div class="hub">Órdenes<br><small>${SR ? 'o mantén T y habla' : '1-7 o clic · T cierra'}</small></div>`; }
function toggleOrders(on) { orderOpen = on === undefined ? !orderOpen : !!on; if (orderOpen && G.state !== 'playing') orderOpen = false; if (orderOpen) { drawOrders(); toggleWheel(false); } $('#orderWheel').hidden = !orderOpen; }
$('#orderWheel').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); toggleOrders(false); sendOrder(b.dataset.o); });

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
const MK = { on: false, sel: 0 }, MK_L = [['enemy', 'Enemigo aquí'], ['go', 'Voy por aquí'], ['hold', 'Cubre esta zona']];
function markStart() { if (!me.alive || G.state !== 'playing') return; const o = [camera.position.x, camera.position.y, camera.position.z], r = traceShot(o, aimDir(me.punchP, 0, 0), 140); MK.on = true; MK.sel = r.hit ? 0 : 1; drawMark(); }
function drawMark() { const el = $('#markSel'); if (!el) return; el.hidden = !MK.on; el.innerHTML = MK_L.map((m, i) => `<span class="${i === MK.sel ? 'on' : ''} k-${m[0]}">${m[1]}</span>`).join('') + '<small>Rueda para cambiar · suelta para marcar</small>'; }
function markEnd() { MK.on = false; drawMark(); doPing(MK_L[MK.sel][0]); }
function doPing(kind) {
  if (!me.alive || G.state !== 'playing') return; const o = [camera.position.x, camera.position.y, camera.position.z]; const d = aimDir(me.punchP, 0, 0); const r = traceShot(o, d, 140);
  sendMsg({ t: 'ping', p: [o[0] + d[0] * r.t, o[1] + d[1] * r.t, o[2] + d[2] * r.t].map(v => +v.toFixed(2)), e: r.hit && kind !== 'go' && kind !== 'hold' ? r.hit.id : null, kind: kind || null });
}
function addPing(e) {
  const kind = e.kind || (e.e >= 0 ? 'enemy' : 'go'); const el = document.createElement('div'); el.className = 'ping k-' + kind + (e.e >= 0 ? ' enemy' : ''); el.innerHTML = '<i></i><span></span>'; $('#tags').appendChild(el);
  pings.push({ p: e.p, e: e.e, by: e.v, kind, until: nowS() + ({ enemy: 4, go: 6, hold: 8, dead: 9, killer: 5 }[kind] || 5), el }); while (pings.length > 8) pings.shift().el.remove(); if (kind === 'dead' || kind === 'killer') return;
  sTone(1500, .05, .12, 'sine'); sTone(1900, .07, .12, 'sine', 0, .06);
}
function pingPos(pg) { const a = pg.e >= 0 ? actors[pg.e] : null; if (a && a.alive && (nowS() - a.seenT < 1.5 || pg.until - nowS() > 3)) return { x: a.pos.x, y: a.pos.y + a.h + .2, z: a.pos.z }; return { x: pg.p[0], y: pg.p[1] + .3, z: pg.p[2] }; }
function drawPings(t) {
  for (let i = pings.length - 1; i >= 0; i--) {
    const pg = pings[i]; if (t > pg.until) { pg.el.remove(); pings.splice(i, 1); continue; }
    const q = pingPos(pg); _p.set(q.x, q.y, q.z).project(camera); const vis = _p.z < 1 && _p.z > -1;
    pg.el.style.display = vis ? 'block' : 'none'; if (!vis) continue;
    const d = Math.round(Math.hypot(q.x - camera.position.x, q.z - camera.position.z)); const txt = ({ enemy: 'Enemigo · ', go: 'Voy · ', hold: 'Cubre · ', dead: (actors[pg.by] ? actors[pg.by].name : 'Compañero') + ' cayó · ', killer: 'Lo eliminó · ' }[pg.kind] || '') + d + ' m';
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
  if (rankBy === 'clans') {
    const c = await apiCall('/api/clans/top'); const [y, mo] = (c.season || '').split('-').map(Number); $('#rankSeason').textContent = 'Clanes · temporada de ' + (MESES[mo - 1] || '') + ' · el n.º 1 gana el título «Campeón de clanes»';
    const mine = CLAN.st && CLAN.st.tag;
    $('#rankT').innerHTML = `<table><tr><th>#</th><th>Clan</th><th>Bajas</th><th>Experiencia</th></tr>` + ((c.top || []).length ? c.top.map(x => `<tr class="${x.tag === mine ? 'me' : ''}"><td>${x.pos}</td><td><span class="ctag">[${esc(x.tag)}]</span> ${esc(x.name)}</td><td>${x.kills}</td><td>${x.xp.toLocaleString('es-CL')}</td></tr>`).join('') : '<tr><td colspan="4">Ningún clan suma puntos todavía esta temporada.</td></tr>') + '</table>';
    return;
  }
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

/* ================= ACTUALIZACIÓN DE LA APP ANDROID ================= */
// La app pasa su versión en la dirección (?app=1&apk=N); si en GitHub hay un APK más nuevo, se ofrece descargarlo
(async function checkApk() {
  const q = new URLSearchParams(location.search); if (q.get('app') !== '1' || !/Android/i.test(navigator.userAgent)) return;
  const mine = parseInt(q.get('apk') || '0', 10);
  try {
    const r = await fetch('https://api.github.com/repos/lantoniocponce4-glitch/puerto-ceniza/releases/tags/apk', { cache: 'no-store' }); if (!r.ok) return;
    const j = await r.json(); const m = /versi[oó]n\s+(\d+)/i.exec(j.name || ''); if (!m) return; const latest = 100 + parseInt(m[1], 10);
    if (latest <= mine) return;
    const url = 'https://github.com/lantoniocponce4-glitch/puerto-ceniza/releases/download/apk/puerto-ceniza.apk';
    const box = $('#apkUpd'); box.hidden = false;
    box.innerHTML = `<span>${mine ? 'Hay una versión nueva de la app (1.' + (latest - 100) + '). Se instala encima, sin perder nada.' : 'Hay una app nueva que se actualiza sola en el futuro. Esta vez desinstala la app anterior antes de instalarla.'}</span><a href="${url}" target="_blank" rel="noopener">Descargar</a>`;
  } catch (e) { }
})();

/* ================= iPhone y iPad: instalar desde Safari ================= */
(function iosInstall() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  let seen = false; try { seen = localStorage.getItem('pc2_iosx') === '1'; } catch (e) { }
  if (!ios || standalone || seen) return; $('#iosInst').hidden = false;
  $('#iosInstX').onclick = () => { $('#iosInst').hidden = true; try { localStorage.setItem('pc2_iosx', '1'); } catch (e) { } };
})();

/* ================= CONTROLES MÓVILES AVANZADOS ================= */
// Giroscopio: girar el teléfono apunta (en horizontal); se calcula según hacia qué lado está girado
let gyroOk = false, gyroSeen = 0, gyroSrc = null, gyroPrev = null, gyroAsked = false;
const gyroNeedsPerm = !!(window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function');
function gyroActive() { const m = prefs.mc; if (m.gyro === 'off' || !gyroOk || G.state !== 'playing' || !me.alive || !$('#pause').hidden || HE.on) return false; return m.gyro !== 'ads' || (me.adsK || 0) > .5 || me.scoped; }
function gyroSign() { const ang = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 90); return ang === 270 || ang === -90 ? -1 : 1; }
// aplica un giro en grados: yawD = giro horizontal del teléfono, pitchD = inclinación hacia adelante/atrás
function gyroApply(yawD, pitchD) { const m = prefs.mc, sg = gyroSign(), D = Math.PI / 180 * m.gyroS * .9; me.yaw += yawD * D * sg; me.pitch = clamp(me.pitch - pitchD * D * sg * (m.gyroInv ? -1 : 1), -1.5, 1.5); }
addEventListener('devicemotion', e => {
  const rr = e.rotationRate; if (!rr || (rr.beta == null && rr.gamma == null)) return;
  if (!gyroSeen) { gyroSeen = performance.now(); gyroSrc = 'motion'; gyroOk = true; drawGyroState(); } if (gyroSrc !== 'motion' || !gyroActive()) return;
  const dt = Math.min(.05, (e.interval > 1 ? e.interval / 1000 : e.interval) || .016); gyroApply((rr.beta || 0) * dt, (rr.gamma || 0) * dt);
});
// respaldo: teléfonos cuyo navegador solo entrega la orientación (sin velocidad de giro)
addEventListener('deviceorientation', e => {
  if (e.beta == null) return; if (!gyroSeen) setTimeout(() => { if (!gyroSrc) { gyroSrc = 'orient'; gyroSeen = performance.now(); gyroOk = true; drawGyroState(); } }, 600);
  if (gyroSrc !== 'orient') return; const cur = { a: e.alpha || 0, b: e.beta, g: e.gamma || 0 }, p = gyroPrev; gyroPrev = cur; if (!p || !gyroActive()) return;
  const wrap = d => ((d + 540) % 360) - 180; let dg = cur.g - p.g; if (Math.abs(dg) > 30) dg = 0; gyroApply(wrap(cur.a - p.a) * gyroSign(), -dg);
});
async function enableGyro(quiet) {
  gyroAsked = true;
  try {
    if (gyroNeedsPerm) {
      const r = await DeviceMotionEvent.requestPermission(); gyroOk = r === 'granted' || !!gyroSeen;
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().catch(() => {});
      if (!gyroOk) toast(/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Sin permiso de movimiento: actívalo en Ajustes › Safari › Movimiento y orientación' : 'El navegador bloqueó los sensores de movimiento: permítelos en la configuración del sitio');
    } else gyroOk = !!(window.DeviceMotionEvent || window.DeviceOrientationEvent);
  } catch (e) { gyroOk = false; if (!quiet) toast('Toca «Activar giroscopio» para dar el permiso de movimiento'); }
  if (gyroOk) setTimeout(() => { if (!gyroSeen) toast('Este teléfono no envía datos del giroscopio al navegador'); drawGyroState(); }, 1500);
  drawGyroState();
}
function drawGyroState() {
  for (const el of document.querySelectorAll('.gyst')) {
    const m = prefs.mc; el.textContent = m.gyro === 'off' ? 'Apagado' : !gyroOk ? (gyroNeedsPerm ? 'Falta permiso: toca «Activar giroscopio»' : 'Sin sensor de movimiento') : gyroSeen ? 'Activo ✓' : 'Esperando al sensor…';
    el.className = 'gyst small ' + (m.gyro !== 'off' && gyroOk && gyroSeen ? 'ok' : '');
  }
}
if (prefs.mc.gyro !== 'off' && !gyroNeedsPerm) gyroOk = true;
// iPhone olvida el permiso al recargar: se vuelve a pedir con el primer toque real en la pantalla
addEventListener('touchend', () => { if (prefs.mc.gyro !== 'off' && !gyroOk && gyroNeedsPerm && !gyroAsked) enableGyro(true); }, { passive: true });
function setInputMode(m) { prefs.input = m; savePrefs(); location.reload(); }
if (!isTouch && navigator.maxTouchPoints > 0 && $('#tmodeRow')) { $('#tmodeRow').hidden = false; $('#tmodeBtn').onclick = () => setInputMode('touch'); }
function drawMctl() {
  if (!isTouch) return; const m = prefs.mc;
  for (const box of document.querySelectorAll('.mctl')) {
    box.hidden = false;
    box.innerHTML = `<div class="lbl small">Controles táctiles</div><div class="mrow">
      <label>Sensibilidad táctil <b>${m.sensT.toFixed(2)}</b><input type="range" data-mc="sensT" min="0.3" max="2.5" step="0.05" value="${m.sensT}"></label>
      <label>Giroscopio<select data-mc="gyro" class="mcsel"><option value="off"${m.gyro === 'off' ? ' selected' : ''}>Apagado</option><option value="ads"${m.gyro === 'ads' ? ' selected' : ''}>Solo al apuntar</option><option value="always"${m.gyro === 'always' ? ' selected' : ''}>Siempre</option></select></label>
      <label>Sensibilidad del giroscopio <b>${m.gyroS.toFixed(2)}</b><input type="range" data-mc="gyroS" min="0.3" max="3" step="0.05" value="${m.gyroS}"></label>
      <label class="chk"><input type="checkbox" data-mc="gyroInv"${m.gyroInv ? ' checked' : ''}> Invertir giroscopio vertical</label>
      <div class="gyrow"><button type="button" class="btn small gybtn">Activar giroscopio</button><span class="gyst small"></span></div>
      <label class="chk"><input type="checkbox" data-mc="autoFire"${m.autoFire ? ' checked' : ''}> Disparo automático al apuntar a un enemigo</label></div>
      <div class="gyrow"><button type="button" class="btn small pcmode">Usar mouse y teclado (modo PC)</button><span class="small" style="color:var(--dim)">Si estás en una computadora con pantalla táctil</span></div>`;
    box.querySelector('.pcmode').onclick = () => setInputMode('pc');
    box.querySelector('.gybtn').onclick = () => { if (prefs.mc.gyro === 'off') { prefs.mc.gyro = 'always'; savePrefs(); } gyroAsked = false; enableGyro().then(drawMctl); };
  }
  drawGyroState();
}
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.mc; if (!k || e.target.type !== 'range') return; prefs.mc[k] = +e.target.value; savePrefs(); const b = e.target.parentElement.querySelector('b'); if (b) b.textContent = prefs.mc[k].toFixed(2); });
document.addEventListener('change', async e => { const k = e.target.dataset && e.target.dataset.mc; if (!k || e.target.type === 'range') return; prefs.mc[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; savePrefs(); if (k === 'gyro' && prefs.mc.gyro !== 'off') await enableGyro(); drawMctl(); });
drawMctl();

/* ================= EDITOR DEL HUD (celular y PC) ================= */
// Disposición táctil por defecto (centro en % de la pantalla): nada se superpone
const HUD_TOUCH = { bFire: [86, 60], bAds: [76, 73], bReload: [78, 46], bJump: [94, 82], bCrouch: [86, 88], bWeap: [77, 90], bNade: [68, 88], bAct: [67, 62], bLeanL: [83, 29], bLeanR: [90, 29], bBoard: [96, 44], bPause: [96, 56], bFireL: [31, 68], bRadio: [4, 52], bPing: [10, 52], bInsp: [16, 52], bChat: [22, 52], bVoice: [28, 52], bBuy: [34, 52], rightbot: [57, 91], roomChip: [50, 21] };
const HUD_PANELS = ['radar', 'topbar', 'feed', 'leftbot', 'rightbot', 'chatBox', 'roomChip'];
const HE = { on: false, sel: null, drag: null, work: null };
const hudKey = () => isTouch ? 't' : 'd';
function hudIds() { return HUD_PANELS.concat(isTouch ? [...document.querySelectorAll('#touch .tb')].map(e => e.id) : []); }
function hudLayout() { const saved = (prefs.hudL || {})[hudKey()] || {}; const out = { op: saved.op || 1, el: {} }; for (const id of hudIds()) { const d = isTouch && HUD_TOUCH[id] ? [HUD_TOUCH[id][0], HUD_TOUCH[id][1], 1] : null; out.el[id] = saved.el && saved.el[id] ? saved.el[id] : d; } return out; }
function placeEl(el, v) {
  if (!v) { el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.transform = el.style.margin = ''; return; }
  el.style.left = v[0] + '%'; el.style.top = v[1] + '%'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0'; el.style.transform = 'translate(-50%,-50%) scale(' + (v[2] || 1) + ')'; el.style.transformOrigin = '50% 50%';
}
function applyHud(L) {
  L = L || hudLayout(); for (const id of hudIds()) { const el = document.getElementById(id); if (el) placeEl(el, L.el[id]); }
  for (const b of document.querySelectorAll('#touch .tb')) b.style.opacity = L.op < 1 ? L.op : '';
}
function hudOpen() {
  if (HE.on) return; HE.on = true; HE.work = JSON.parse(JSON.stringify(hudLayout())); HE.wasPause = !$('#pause').hidden; HE.wasMenu = !$('#menu').hidden;
  $('#pause').hidden = true; $('#menu').hidden = true; releaseLock();
  HE.hudHidden = $('#hud').hidden; HE.touchHidden = $('#touch').hidden; $('#hud').hidden = false; if (isTouch) $('#touch').hidden = false;
  $('#app').classList.add('hudedit'); $('#app').classList.toggle('touchedit', isTouch); for (const id of hudIds()) { const el = document.getElementById(id); if (el) el.classList.add('hed'); }
  $('#hbOp').value = HE.work.op; $('#hbOp').disabled = !isTouch; $('#hbOp').parentElement.style.opacity = isTouch ? '' : '.4'; hudSelect(null); $('#hudBar').hidden = false;
  if (!isTouch) $('#hbHint').textContent = 'Arrastra el minimapa, el marcador, la vida, la munición, las bajas o el chat. Haz clic en uno para cambiar su tamaño.';
}
function hudClose(save) {
  if (!HE.on) return; HE.on = false; HE.drag = null; $('#hudBar').hidden = true; $('#app').classList.remove('hudedit', 'touchedit');
  for (const el of document.querySelectorAll('.hed')) el.classList.remove('hed', 'sel');
  if (save) { prefs.hudL = Object.assign({}, prefs.hudL, { [hudKey()]: HE.work }); savePrefs(); toast('HUD guardado'); }
  applyHud(); $('#hud').hidden = HE.hudHidden; $('#touch').hidden = HE.touchHidden;
  if (HE.wasPause) $('#pause').hidden = false; else if (HE.wasMenu) $('#menu').hidden = false;
}
const HUD_NAMES = { radar: 'Minimapa', topbar: 'Marcador', feed: 'Bajas', leftbot: 'Vida y dinero', rightbot: 'Munición', chatBox: 'Chat', roomChip: 'Sala' };
function hudSelect(el) {
  for (const e of document.querySelectorAll('.hed.sel')) e.classList.remove('sel'); HE.sel = el;
  if (!el) { $('#hbSel').textContent = '—'; $('#hbSize').disabled = true; return; }
  el.classList.add('sel'); $('#hbSize').disabled = false; const v = HE.work.el[el.id]; $('#hbSize').value = v ? v[2] || 1 : 1;
  $('#hbSel').textContent = '· ' + (HUD_NAMES[el.id] || el.getAttribute('aria-label') || el.textContent.trim());
}
function hudCenter(el) { const r = el.getBoundingClientRect(); return [(r.left + r.width / 2) / innerWidth * 100, (r.top + r.height / 2) / innerHeight * 100]; }
// arrastre: se captura antes que los controles, así no disparan, saltan ni recargan mientras editas
document.addEventListener('pointerdown', e => {
  if (!HE.on) return; const el = e.target.closest && e.target.closest('.hed'); if (!el || e.target.closest('#hudBar')) return;
  e.preventDefault(); e.stopPropagation(); hudSelect(el); const c = HE.work.el[el.id] ? HE.work.el[el.id].slice(0, 2) : hudCenter(el);
  HE.drag = { el, id: el.id, sx: e.clientX, sy: e.clientY, cx: c[0], cy: c[1] };
}, true);
document.addEventListener('pointermove', e => {
  if (!HE.on || !HE.drag) return; const d = HE.drag; e.preventDefault();
  const x = clamp(d.cx + (e.clientX - d.sx) / innerWidth * 100, 2, 98), y = clamp(d.cy + (e.clientY - d.sy) / innerHeight * 100, 2, 98);
  const s = HE.work.el[d.id] ? HE.work.el[d.id][2] || 1 : 1; HE.work.el[d.id] = [+x.toFixed(2), +y.toFixed(2), s]; placeEl(d.el, HE.work.el[d.id]);
}, true);
document.addEventListener('pointerup', () => { HE.drag = null; }, true);
$('#hbSize').oninput = () => { const el = HE.sel; if (!el) return; const v = HE.work.el[el.id] || hudCenter(el).concat(1); v[2] = +$('#hbSize').value; HE.work.el[el.id] = v; placeEl(el, v); };
$('#hbOp').oninput = () => { HE.work.op = +$('#hbOp').value; for (const b of document.querySelectorAll('#touch .tb')) b.style.opacity = HE.work.op; };
$('#hbReset').onclick = () => { const keep = prefs.hudL; prefs.hudL = Object.assign({}, keep); delete prefs.hudL[hudKey()]; HE.work = JSON.parse(JSON.stringify(hudLayout())); prefs.hudL = keep; for (const id of hudIds()) { const el = document.getElementById(id); if (el) placeEl(el, HE.work.el[id]); } $('#hbOp').value = 1; for (const b of document.querySelectorAll('#touch .tb')) b.style.opacity = ''; hudSelect(null); };
$('#hbCancel').onclick = () => hudClose(false);
$('#hbMove').onclick = () => $('#hudBar').classList.toggle('low');
$('#hbSave').onclick = () => hudClose(true);
$('#hudEdit1').onclick = () => hudOpen(); $('#hudEdit2').onclick = () => hudOpen();
addEventListener('keydown', e => { if (HE.on && e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); hudClose(false); } }, true);
addEventListener('resize', () => { if (!HE.on) applyHud(); });
applyHud();

/* ================= CLAN ================= */
const CLAN = { st: null, timer: null };
async function loadClan() { if (!auth.me || location.protocol === 'file:') { CLAN.st = null; drawClan(); return; } const r = await apiCall('/api/clan'); if (r && !r.error) { CLAN.st = r.clan; drawClan(); } }
function drawClan() {
  const box = $('#clanBox'); box.hidden = !auth.me; if (!auth.me) return; const c = CLAN.st; $('#clanOut').hidden = !!c; $('#clanIn').hidden = !c;
  if (!c) { $('#clanInfo').textContent = 'sin clan'; return; }
  $('#clanInfo').textContent = (c.rank ? 'Puesto ' + c.rank + ' del mes' : 'Sin puesto aún') + (c.champ && c.champ.length ? ' · campeón ' + c.champ.length + '×' : '');
  $('#clanTitle').innerHTML = `<code>[${esc(c.tag)}]</code>${esc(c.name)}`; $('#clanStats').textContent = c.season.xp.toLocaleString('es-CL') + ' de experiencia · ' + c.season.kills + ' bajas · ' + c.members.length + '/' + c.max + ' integrantes';
  $('#clanWeekly').innerHTML = c.weekly.map(w => `<div class="ch${w.done ? ' done' : ''}"><span>${esc(w.txt)}</span><b>${w.p}/${w.n}</b><i><s style="width:${w.p / w.n * 100}%"></s></i></div>`).join('');
  $('#clanMemSum').textContent = 'Integrantes (' + c.members.length + ')';
  $('#clanMembers').innerHTML = c.members.map(m => `<div class="clanRow"><span>${m.lead ? '★ ' : ''}${esc(m.name)}${m.you ? ' <small>(tú)</small>' : ''}</span><small>Nv ${m.lvl} · ${m.xp.toLocaleString('es-CL')}</small>${c.lead && !m.you ? `<button type="button" class="linkbtn" data-kick="${m.id}">Expulsar</button>` : '<span></span>'}</div>`).join('');
  const ch = $('#clanChat'); const atEnd = ch.scrollTop + ch.clientHeight >= ch.scrollHeight - 8;
  ch.innerHTML = c.chat.length ? c.chat.map(m => m.sys ? `<div class="sys">${esc(m.m)}</div>` : `<div><b>${esc(m.n)}:</b> ${esc(m.m)}</div>`).join('') : '<div class="small">Todavía no hay mensajes.</div>'; if (atEnd) ch.scrollTop = ch.scrollHeight;
}
async function clanDo(path, body) { $('#clanErr').textContent = ''; const r = await apiCall(path, body || {}); if (r.error) { $('#clanErr').textContent = r.error; return false; } if (r.me) applyMe(r.me); CLAN.st = r.clan; drawClan(); return true; }
$('#clanJoin').onclick = () => clanDo('/api/clan/join', { tag: $('#clanTagIn').value });
$('#clanCreate').onclick = () => clanDo('/api/clan/create', { name: $('#clanNameIn').value, tag: $('#clanNewTag').value });
$('#clanSend').onclick = async () => { const i = $('#clanMsg'); if (!i.value.trim()) return; if (await clanDo('/api/clan/say', { m: i.value })) i.value = ''; };
$('#clanMsg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#clanSend').click(); } });
$('#clanLeave').onclick = () => { if ($('#clanLeave').dataset.sure) { delete $('#clanLeave').dataset.sure; $('#clanLeave').textContent = 'Salir del clan'; clanDo('/api/clan/leave'); } else { $('#clanLeave').dataset.sure = 1; $('#clanLeave').textContent = 'Confirmar salida'; setTimeout(() => { delete $('#clanLeave').dataset.sure; $('#clanLeave').textContent = 'Salir del clan'; }, 3500); } };
$('#clanMembers').addEventListener('click', e => { const b = e.target.closest('[data-kick]'); if (b) clanDo('/api/clan/kick', { id: +b.dataset.kick }); });
CLAN.timer = setInterval(() => { if (G.state === 'menu' && auth.me && !document.hidden) loadClan(); }, 7000);

/* ================= PASE DE TEMPORADA ================= */
const PAT = { diag: 'repeating-linear-gradient(135deg,rgba(255,255,255,.10) 0 6px,transparent 6px 14px)', dots: 'radial-gradient(rgba(255,255,255,.16) 1.5px,transparent 1.6px) 0 0/10px 10px', grid: 'linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px) 0 0/12px 12px,linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px) 0 0/12px 12px', wave: 'repeating-radial-gradient(circle at 0 100%,rgba(255,255,255,.09) 0 4px,transparent 4px 12px)' };
const cardCss = c => `background:${PAT[c.pat] || ''}${PAT[c.pat] ? ',' : ''}linear-gradient(110deg,${c.a},${c.b})`;
function passRewardName(r) { if (r.k === 'camo') { const c = PC.CAMOS.find(x => x.id === r.id); return 'el acabado ' + (c ? c.name.split(' ·')[0] : r.id); } if (r.k === 'card') { const c = PC.CARDS.find(x => x.id === r.id); return 'la tarjeta ' + (c ? c.name : r.id); } const t = PC.TITLES.find(x => x.id === r.id); return 'el título «' + (t ? t.name : r.id) + '»'; }
function seasonXP() { const s = auth.me && auth.me.stats && auth.me.stats.season; const id = new Date().toISOString().slice(0, 7); return s && s.id === id ? s.xp || 0 : 0; }
function drawPass() {
  const own = prof.owned || []; const xp = seasonXP(), tier = PC.passTier(xp), into = tier >= PC.PASS.tiers ? PC.PASS.xp : xp - tier * PC.PASS.xp;
  const mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][new Date().getUTCMonth()];
  $('#passSeason').textContent = 'Temporada de ' + mes + ' · ' + (auth.me ? 'escalón ' + tier + ' de ' + PC.PASS.tiers : 'necesitas una cuenta para avanzar');
  $('#passBar').style.width = (tier >= PC.PASS.tiers ? 100 : into / PC.PASS.xp * 100) + '%';
  $('#passNext').textContent = !auth.me ? 'Crea una cuenta o ingresa: la experiencia de temporada solo se guarda con cuenta.' : tier >= PC.PASS.tiers ? '¡Completaste el pase de este mes!' : `${into.toLocaleString('es-CL')} / ${PC.PASS.xp.toLocaleString('es-CL')} de experiencia para el escalón ${tier + 1}`;
  $('#passTrack').innerHTML = PC.PASS.rewards.map(r => {
    const got = own.includes(r.k + ':' + r.id), now = r.t === tier + 1; let vis = '';
    if (r.k === 'camo') vis = `<span class="pv" style="background-image:url(${PCM.camoSwatch(r.id)})"></span>`;
    else if (r.k === 'card') { const c = PC.CARDS.find(x => x.id === r.id); vis = `<span class="pv" style="${cardCss(c)}"></span>`; }
    else vis = `<span class="pv tt">${esc((PC.TITLES.find(x => x.id === r.id) || {}).name || '')}</span>`;
    return `<div class="pt${got ? ' got' : ''}${now ? ' now' : ''}" title="${esc(passRewardName(r))}"><b>${r.t}</b>${vis}<small>${r.k === 'camo' ? 'Acabado' : r.k === 'card' ? 'Tarjeta' : 'Título'}</small></div>`;
  }).join('');
  const cards = PC.CARDS.filter(c => own.includes('card:' + c.id)), titles = PC.TITLES.filter(t => own.includes('title:' + t.id));
  $('#passCards').innerHTML = `<button type="button" class="pc" data-card="" aria-pressed="${!prof.card}">Ninguna</button>` + cards.map(c => `<button type="button" class="pc" data-card="${c.id}" aria-pressed="${prof.card === c.id}" style="${cardCss(c)}">${esc(c.name)}</button>`).join('') + (cards.length ? '' : '<span class="small">Aún no ganas tarjetas.</span>');
  $('#passTitles').innerHTML = `<button type="button" class="ptl" data-title="" aria-pressed="${!prof.title}">Sin título</button>` + titles.map(t => `<button type="button" class="ptl" data-title="${t.id}" aria-pressed="${prof.title === t.id}">${esc(t.name)}</button>`).join('') + (titles.length ? '' : '<span class="small">Aún no ganas títulos.</span>');
  const cd = PC.CARDS.find(c => c.id === prof.card), tl = PC.TITLES.find(t => t.id === prof.title);
  $('#passPreview').style.cssText = cd ? cardCss(cd) : ''; $('#passPrevName').textContent = auth.me ? auth.me.name : cleanName(prefs.name); $('#passPrevTitle').textContent = tl ? tl.name : '';
  setTimeout(() => { const n = $('#passTrack .pt.now') || $('#passTrack .pt.got:last-of-type'); if (n) n.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 0);
}
function extrasOwned() { const tier = auth.me ? PC.passTier(seasonXP()) : 0, ex = prefs.extras || (prefs.extras = []); let ch = false; for (const r of PC.PASS.extra) { const k = r.k + ':' + r.id; if (r.t <= tier && !ex.includes(k)) { ex.push(k); ch = true; } } if (ch) savePrefs(); return ex; }
function drawExtras() {
  const own = extrasOwned(), tier = auth.me ? PC.passTier(seasonXP()) : 0;
  $('#passExtra').innerHTML = PC.PASS.extra.map(r => { const got = own.includes(r.k + ':' + r.id), nm = (r.k === 'charm' ? PC.CHARMS : PC.POSES).find(x => x.id === r.id).name;
    return `<div class="px${got ? ' got' : ''}${r.t === tier + 1 ? ' now' : ''}"><b>${r.t}</b><span class="pxi ${r.k}">${r.k === 'charm' ? '◆' : '♟'}</span><small>${r.k === 'charm' ? 'Dije' : 'Pose'}: ${esc(nm)}</small></div>`; }).join('');
  const charms = PC.CHARMS.filter(c => own.includes('charm:' + c.id)), poses = PC.POSES.filter(p => p.id === 'listo' || own.includes('pose:' + p.id));
  $('#passCharms').innerHTML = `<button type="button" class="ptl" data-charm="" aria-pressed="${!prefs.charm}">Sin dije</button>` + charms.map(c => `<button type="button" class="ptl" data-charm="${c.id}" aria-pressed="${prefs.charm === c.id}">${esc(c.name)}</button>`).join('') + (charms.length ? '' : '<span class="small">Gana tu primer dije en el escalón 2.</span>');
  $('#passPoses').innerHTML = poses.map(p => `<button type="button" class="ptl" data-pose="${p.id}" aria-pressed="${(prefs.pose || 'listo') === p.id}">${esc(p.name)}</button>`).join('');
}
function openPass() { $('#pass').hidden = false; drawPass(); drawExtras(); }
document.addEventListener('click', e => {
  const b = e.target.closest('#passCharms .ptl, #passPoses .ptl'); if (!b) return;
  if (b.dataset.charm !== undefined) { prefs.charm = b.dataset.charm || null; rebuildVMs(); } else prefs.pose = b.dataset.pose || 'listo';
  savePrefs(); SHOW.key = ''; drawExtras(); toast('Listo: míralo en la vitrina del menú');
});
document.addEventListener('click', async e => {
  if (e.target.id === 'passOpen') { openPass(); return; }
  if ($('#pass').hidden) return;
  const b = e.target.closest('#passCards .pc, #passTitles .ptl'); if (!b) return;
  if (!auth.me) { toast('Necesitas una cuenta para usar premios del pase'); return; }
  const body = b.dataset.card !== undefined ? { card: b.dataset.card || null } : { title: b.dataset.title || null };
  const r = await apiCall('/api/look', body); if (r.me) { applyMe(r.me); drawPass(); toast('Listo: se verá en tu próxima partida'); } else toast(r.error || 'No se pudo guardar');
});
$('#passClose').onclick = () => { $('#pass').hidden = true; };
$('#pass').addEventListener('pointerdown', e => { if (e.target === $('#pass')) $('#pass').hidden = true; });
addEventListener('keydown', e => { if (!$('#pass').hidden && e.key === 'Escape') $('#pass').hidden = true; });

/* ================= INVENTARIO DE SKINS ================= */
// Vitrina del menú: tu soldado con tu arma y camuflaje, con luz de estudio, a la derecha del menú
const SHOW = { m: null, key: '', g: null, t: 0 };
function showcaseOn() { return G.state === 'menu' && !$('#menu').hidden && innerWidth >= 900 && innerWidth / innerHeight > 1.2 && $('#inv').hidden; }
function showPose() { const ex = prefs.extras || []; return prefs.pose && prefs.pose !== 'listo' && ex.includes('pose:' + prefs.pose) ? prefs.pose : null; }
function myCharm() { const ex = prefs.extras || []; return prefs.charm && ex.includes('charm:' + prefs.charm) ? prefs.charm : null; }
function updateShowcase(dt) {
  const on = showcaseOn(); if (!on) { if (SHOW.g) SHOW.g.visible = false; return false; }
  const team = prefs.side === 'atk' ? 1 : 0, gun = 'ar', key = team + '|' + gun + '|' + (prof.camo || '') + '|' + showPose() + '|' + myCharm();
  if (key !== SHOW.key) {
    SHOW.key = key; if (SHOW.g) vmScene.remove(SHOW.g); const g = new THREE.Group(); SHOW.g = g; vmScene.add(g);
    const m = PCM.buildSoldier(team, 1, { flashMat, camo: prof.camo || null }); if (showPose()) m.poseOv = showPose(); m.setGun(gun); m.setHelmet(true); m.animate(0, 0, 0, -.05); SHOW.m = m; g.add(m.g); { const hg = m.hand.children.find(o => o.userData && o.userData.info); if (hg) PCM.addCharm(hg, myCharm()); }
    const rim = new THREE.DirectionalLight(team ? 0xffb27a : 0x9fd8ff, 1.3); rim.position.set(-2, 2.5, -3); g.add(rim); const key2 = new THREE.DirectionalLight(0xfff3e2, .9); key2.position.set(2, 3, 3); g.add(key2);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.62, 40), new THREE.MeshBasicMaterial({ map: TX.hole, transparent: true, opacity: .55, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = .01; g.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.66, .69, 64), new THREE.MeshBasicMaterial({ color: team ? 0xef6a45 : 0x5cc8e0, transparent: true, opacity: .7, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .012; g.add(ring);
  }
  SHOW.t += dt; const a = innerWidth / innerHeight; SHOW.g.visible = true; SHOW.g.position.set(Math.min(1.8, .95 * a), -1.5, -3.3);
  SHOW.g.rotation.set(.05, Math.PI - 1.05 + Math.sin(SHOW.t * .25) * .35, 0); SHOW.m.upper.rotation.x = -.05 + Math.sin(SHOW.t * 1.6) * .012; SHOW.m.head.rotation.y = Math.sin(SHOW.t * .4) * .15;
  if (vmCam.fov !== 60) { vmCam.fov = 60; vmCam.updateProjectionMatrix(); } return true;
}
const INV = { open: false, w: 'ar', sel: null, scene: null, cam: null, gun: null, key: '', rot: 0, drag: null, auto: true };
const INV_GROUPS = [['Pistolas', ['p9', 'b3', 'r50', 'ap18']], ['Subfusiles y escopetas', ['smg', 'k11', 'es12', 'pump']], ['Fusiles', ['ar', 'bp9', 'fr9', 'lmg']], ['Precisión', ['tr7', 'dmr', 'sr', 'ax50']], ['Cuerpo a cuerpo', ['knife']]];
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
// Ficha técnica del arma en la armería: barras comparables entre todas las armas
function wStats(W) {
  const pel = W.pellets || 1, acc = W.scoped || W.stand || .01;
  return [['Daño', Math.min(1, W.dmg * pel / 120), Math.round(W.dmg * pel) + (pel > 1 ? ' (' + pel + '×' + W.dmg + ')' : '')], ['Cadencia', Math.min(1, (W.rpm || 60) / 950), (W.rpm || '—') + ' dpm'],
    ['Alcance', clamp(((W.rm || .8) - .6) / .4, .05, 1), ''], ['Precisión', clamp(1 - acc / .06, .05, 1), ''], ['Control', clamp(1 - (W.kick || .02) / .065, .05, 1), ''], ['Movilidad', clamp(((W.speed || 4.5) - 3.5) / 1.7, .05, 1), (W.speed || '') + ' m/s'],
    ['Cargador', Math.min(1, (W.mag || 1) / 100), W.mag ? W.mag + ' / ' + (W.res || 0) : '—']];
}
function drawWStats(W) { const el = $('#invStats'); if (!el) return; if (W.melee) { el.innerHTML = '<div class="small">Arma cuerpo a cuerpo: golpe rápido y estocada fuerte por la espalda.</div>'; return; }
  el.innerHTML = wStats(W).map(([n, v, t]) => `<div class="wst"><span>${n}</span><i><b style="width:${Math.round(v * 100)}%"></b></i><em>${t}</em></div>`).join('') + (W.price ? `<div class="small wprice">Precio en la tienda: $${W.price.toLocaleString('es')}</div>` : ''); }
function drawInv() {
  const cur = INV.w; const eff = (w) => { const v = invSkinOf(w); return v === 'none' ? null : v || prof.camo || null; };
  $('#invList').innerHTML = INV_GROUPS.map(([gname, ids]) => `<div class="lbl small">${gname}</div>` + ids.filter(id => WEAPONS[id]).map(id => { const e = eff(id); return `<button type="button" class="invW" data-w="${id}" aria-pressed="${id === cur}"><span class="sw" style="${e ? `background-image:url(${PCM.camoSwatch(e)})` : ''}"></span><span>${esc(WEAPONS[id].name)}</span><small>${invSkinOf(id) ? 'propia' : 'general'}</small></button>`; }).join('')).join('');
  const own = invSkinOf(cur); const sel = INV.sel === undefined ? own : INV.sel;
  const opts = [{ id: null, name: 'Usar la general', lvl: 1 }, { id: 'none', name: 'Sin skin', lvl: 1 }].concat(PC.CAMOS);
  $('#invSkins').innerHTML = opts.map(c => { const lock = c.id && c.id !== 'none' && camoLocked(c); const on = (sel || null) === c.id; return `<button type="button" class="camo" data-c="${c.id || ''}" aria-pressed="${on}" ${lock ? 'aria-disabled="true"' : ''} title="${esc(c.name)}"><span class="sw" style="${c.id && c.id !== 'none' ? `background-image:url(${PCM.camoSwatch(c.id)})` : ''}"></span><span>${c.id === null ? 'General' : c.id === 'none' ? 'Ninguna' : esc(c.name.split(' ·')[0])}</span><small>${lock ? (c.top ? 'Top 10' : c.pass ? 'Pase' : 'Nv ' + c.lvl) : ''}</small></button>`; }).join('');
  const W = WEAPONS[cur]; const c = PC.CAMOS.find(x => x.id === sel); const lock = camoLocked(c);
  $('#invName').textContent = W.name; $('#invCls').textContent = W.cls || ''; drawWStats(W);
  $('#invSkinName').textContent = sel === null || sel === undefined ? 'Usa tu camuflaje general' + (prof.camo ? ' (' + (PC.CAMOS.find(x => x.id === prof.camo) || {}).name + ')' : ' (ninguno)') : sel === 'none' ? 'Sin skin' : c ? c.name + (lock ? ' · ' + camoLockTxt(c) : '') : '';
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
function condLabel(c) { if (!c) return ''; if (c.night) return ' · de noche'; if (c.dusk) return ' · al atardecer'; return { lluvia: ' · con lluvia', arena: ' · tormenta de arena', niebla: ' · con niebla', nieve: ' · nevando' }[c.weather] || ''; }
function stopWeatherSound() { if (!weatherNode) return; try { weatherNode.src.stop(); if (weatherNode.lfo) weatherNode.lfo.stop(); } catch (e) { } try { weatherNode.g.disconnect(); } catch (e) { } weatherNode = null; }
// Ambiente de cada mapa: un fondo continuo y sonidos sueltos al azar (todo sintetizado)
let ambNode = null, ambT = 0;
function stopAmbience() { if (!ambNode) return; try { for (const n of ambNode.src) n.stop(); } catch (e) { } ambNode = null; }
function startAmbience() {
  stopAmbience(); if (!AC || !WORLD || !bus.amb) return; const th = WORLD.map.theme, src = [];
  const bed = (type, freq, q, vol, lfoF, lfoD) => { const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); g.gain.value = vol;
    if (lfoF) { const l = AC.createOscillator(); l.frequency.value = lfoF; const lg = AC.createGain(); lg.gain.value = vol * lfoD; l.connect(lg); lg.connect(g.gain); l.start(); src.push(l); } s.connect(f); f.connect(g); g.connect(bus.amb); s.start(0, Math.random() * 1.5); src.push(s); };
  const hum = (freq, vol) => { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; const g = AC.createGain(); g.gain.value = vol; o.connect(f); f.connect(g); g.connect(bus.amb); o.start(); src.push(o); };
  if (th === 'port') { bed('lowpass', 180, .7, .05, .08, .6); bed('bandpass', 500, .5, .012, .13, .8); }
  else if (th === 'snow') { bed('bandpass', 420, .8, .045, .11, .9); }
  else if (th === 'rural') { bed('lowpass', 300, .5, .012, .05, .5); }
  else if (th === 'city') { bed('lowpass', 160, .6, .055, .03, .5); }
  else if (th === 'desert') { bed('bandpass', 650, .6, .03, .09, .9); }
  else if (th === 'refinery') { hum(55, .016); hum(110.5, .008); bed('lowpass', 140, .7, .04, .06, .4); }
  ambNode = { src, th }; ambT = rand(2, 5);
}
function ambOneShot() {
  if (!AC || !ambNode || !bus.amb) return; const th = ambNode.th, pan = rand(-.8, .8), out = (g) => { const p = panNode(pan); g.connect(p); p.connect(bus.amb); };
  const chirp = (f0, f1, dur, vol, delay = 0, type = 'sine') => { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .2); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); out(g); o.start(t); o.stop(t + dur + .05); };
  const clank = (f, vol, delay = 0) => { const t = AC.currentTime + delay; for (const m of [1, 2.76, 5.4]) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(vol / m, t); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4 / m); o.connect(g); out(g); o.start(t); o.stop(t + 1.5); } };
  if (th === 'port') { if (Math.random() < .6) { for (let i = 0; i < 3; i++) chirp(rand(1500, 1900), rand(900, 1200), .28, .025, i * .32, 'triangle'); } else clank(rand(90, 140), .03); }
  else if (th === 'snow') { if (Math.random() < .5) chirp(rand(70, 110), rand(50, 70), 1.6, .025, 0, 'sawtooth'); else clank(rand(200, 300), .012); }
  else if (th === 'rural') { if (Math.random() < .5) { const n = 3 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) chirp(rand(2800, 4200), rand(2000, 3200), .09, .018, i * .12); } else { for (let i = 0; i < 14; i++) chirp(4600, 4500, .04, .01, i * .05, 'square'); } }
  else if (th === 'city') { if (Math.random() < .4) { chirp(440, 430, .35, .015, 0, 'square'); chirp(554, 540, .35, .012, 0, 'square'); } else sNoise(2.2, .04, 300, 0, pan, .6); }
  else if (th === 'desert') { if (Math.random() < .5) chirp(rand(1700, 2100), rand(1300, 1500), .5, .015); else sNoise(1.8, .035, 900, 0, pan, .5); }
  else if (th === 'refinery') { if (Math.random() < .55) clank(rand(60, 100), .035); else chirp(rand(160, 220), rand(120, 150), 1.2, .02, 0, 'sawtooth'); }
}
function weatherSound(kind) {
  stopWeatherSound(); if (!AC) return; let lfo = null; const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = AC.createBiquadFilter(); const g = AC.createGain();
  if (kind === 'lluvia') { f.type = 'highpass'; f.frequency.value = 1400; g.gain.value = .07; } else { f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = .6; g.gain.value = .11; lfo = AC.createOscillator(); const l = lfo; l.frequency.value = .17; const lg = AC.createGain(); lg.gain.value = .06; l.connect(lg); lg.connect(g.gain); l.start(); }
  src.connect(f); f.connect(g); g.connect(bus.amb); src.start(); weatherNode = { src, g, lfo };
}
function addNightLamps() {
  const M = WORLD.map; const pts = []; for (const k in M.sites) pts.push(M.sites[k].c);
  const avg = (l) => [l.reduce((a, p) => a + p[0], 0) / l.length, l.reduce((a, p) => a + p[1], 0) / l.length];
  pts.push(avg(M.spawns.atk), avg(M.spawns.def), [(M.bounds[0] + M.bounds[2]) / 2, (M.bounds[1] + M.bounds[3]) / 2]);
  const n = prefs.gfx !== 'low' ? pts.length : 2;
  for (const [x, z] of pts.slice(0, n)) {
    const L = new THREE.PointLight(0xffc27a, 1.7, 24, 2); L.position.set(x, 4.6, z); envGroup.add(L);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowWarm, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(x, 4.6, z); sp.scale.set(1.6, 1.6, 1); envGroup.add(sp);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 })); lamp.position.set(x, 4.6, z); envGroup.add(lamp);
  }
}
function makeRain() {
  const N = prefs.gfx !== 'low' ? 1600 : 650; const pos = new Float32Array(N * 6); const g = new THREE.BufferGeometry();
  for (let i = 0; i < N; i++) { const x = rand(-18, 18), y = rand(0, 16), z = rand(-18, 18); pos.set([x, y, z, x + .04, y + .55, z], i * 6); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c6d4, transparent: true, opacity: .45, depthWrite: false })); l.frustumCulled = false; envGroup.add(l);
  return { kind: 'lluvia', obj: l, N };
}
function makeSnowFx() {
  const N = prefs.gfx !== 'low' ? 1400 : 550; const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([rand(-18, 18), rand(0, 14), rand(-18, 18)], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .09, transparent: true, opacity: .85, depthWrite: false })); p.frustumCulled = false; envGroup.add(p);
  return { kind: 'nieve', obj: p, N };
}
function makeSand() {
  const N = prefs.gfx !== 'low' ? 1100 : 450; const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([rand(-18, 18), rand(0, 8), rand(-18, 18)], i * 3);
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
  // posición del sol (el atardecer lo baja hacia el horizonte)
  if (G.sunBase) { const b = G.sunBase, d = c.dusk ? [b.d[0], .11, b.d[2]] : b.d; skyU.sunDir.value.set(...d).normalize(); const v = skyU.sunDir.value; sun.position.set(b.c[0] + v.x * 120, v.y * 120 + (c.dusk ? 8 : 0), b.c[1] + v.z * 120); sun.target.position.set(b.c[0], 0, b.c[1]); }
  if (c.dusk) { skyU.top.value.set(.24, .27, .46); skyU.hor.value.set(1.02, .6, .36); scene.fog.color.setHex(0xc4865e); scene.fog.density = .0085; sun.color.setHex(0xffa860); sun.intensity = 1.75; hemi.color.setHex(0xffb98a); hemi.groundColor.setHex(0x4a3428); hemi.intensity = .55; th = .8; }
  if (c.night) { skyU.top.value.set(.015, .025, .07); skyU.hor.value.set(.06, .075, .13); scene.fog.color.setHex(0x0b1120); scene.fog.density = .017; hemi.color.setHex(0x3a4a70); hemi.groundColor.setHex(0x0e0f14); hemi.intensity = .34; sun.color.setHex(0x9db4ff); sun.intensity = .3; th = .82; addNightLamps(); }
  if (c.weather === 'lluvia') { skyU.top.value.set(.22, .25, .3); skyU.hor.value.set(.42, .45, .5); scene.fog.color.setHex(0x5a626c); scene.fog.density = .02; sun.intensity *= .45; hemi.intensity *= .85; weatherFx = makeRain(); weatherSound('lluvia'); }
  if (c.weather === 'arena') { skyU.top.value.set(.55, .42, .28); skyU.hor.value.set(.78, .6, .4); scene.fog.color.setHex(0xa8824f); scene.fog.density = .03; sun.intensity *= .55; weatherFx = makeSand(); weatherSound('arena'); }
  if (c.weather === 'nieve') { skyU.top.value.set(.55, .6, .68); skyU.hor.value.set(.82, .85, .9); scene.fog.color.setHex(0xcfd8e2); scene.fog.density = .026; sun.intensity *= .55; weatherFx = makeSnowFx(); weatherSound('nieve'); }
  if (c.weather === 'niebla') { skyU.top.value.set(.6, .66, .72); skyU.hor.value.set(.8, .83, .86); scene.fog.color.setHex(0xc5ccd3); scene.fog.density = .034; sun.intensity *= .6; }
  vmSun.intensity = c.night ? .3 : 1.1; vmHemi.intensity = c.night ? .45 : .8;
  if (post.bloom) post.bloom.threshold = th; G.night = !!c.night;
  skyU.night.value = c.night ? 1 : 0; skyU.cloud.value = c.dusk ? .55 : { lluvia: .82, niebla: .66, nieve: .76, arena: .5 }[c.weather] || .33;
  setEnv(!c.night && !c.weather); if (prefs.gfx !== 'low') hemi.intensity *= .55;
  buildLife(c); if (G.state === 'playing') startAmbience();
  const wet = c.weather === 'lluvia'; if (G.groundMat) { G.groundMat.roughness = wet ? .2 : G.groundBase.r; G.groundMat.metalness = wet ? .3 : G.groundBase.m; G.groundMat.envMapIntensity = wet ? 1.8 : .4; }
}

/* ================= VIDA DEL MAPA ================= */
// viento con hojas o papeles, banderas que ondean, charcos con lluvia, huellas en la nieve, pájaros que huyen de los disparos y luces que parpadean de noche
const LIFE = { g: null, deb: null, flags: [], birds: [], lamps: [], steps: null, si: 0, last: {}, wind: [1, 0], t: 0, steam: [], beacons: [] };
function freeSpot(x, z, r) { for (const b of WORLD.colliders) if (b.mat !== 'perim' && x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r && b.minY < 2) return false; return true; }
function buildLife(c) {
  if (LIFE.g) { scene.remove(LIFE.g); LIFE.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); }
  LIFE.g = new THREE.Group(); scene.add(LIFE.g); LIFE.flags = []; LIFE.birds = []; LIFE.lamps = []; LIFE.deb = null; LIFE.steps = null; LIFE.last = {}; LIFE.steam = []; LIFE.beacons = [];
  if (!WORLD) return;
  // vapor de tuberías (tapa la vista a ratos) y balizas rojas giratorias: también en gráficos bajos, porque afectan el juego
  for (const [x, z] of WORLD.map.steam || []) { const puffs = []; for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.smoke, color: 0xe8e4de, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; LIFE.g.add(sp); puffs.push({ sp, life: 0 }); } LIFE.steam.push({ x, z, puffs, t: rand(0, 6), on: false, i: 0 }); }
  for (const [x, y, z] of WORLD.map.beacons || []) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glow, color: 0xff3020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); sp.position.set(x, y, z); sp.scale.setScalar(1.6); LIFE.g.add(sp);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .22, 10), new THREE.MeshBasicMaterial({ color: 0xff3a24 })); cap.position.set(x, y - .05, z); LIFE.g.add(cap); const b = { sp, cap, ph: Math.random() * 6 }; if (!LIFE.beacons.length && prefs.gfx !== 'low') { b.pl = new THREE.PointLight(0xff3020, 0, 14); b.pl.position.set(x, y - .3, z); LIFE.g.add(b.pl); } LIFE.beacons.push(b); }
  if (prefs.gfx === 'low') return; const M = WORLD.map, th = M.theme, [x0, z0, x1, z1] = M.bounds; const wa = Math.random() * 6.28; LIFE.wind = [Math.cos(wa), Math.sin(wa)];
  const rx = () => rand(x0 + 2, x1 - 2), rz = () => rand(z0 + 2, z1 - 2);
  // hojas, papeles o arena arrastrados por el viento
  if (c.weather !== 'nieve' && th !== 'snow') {
    const N = 70, cols = th === 'rural' ? [0x6b7a2e, 0x8a6a2a, 0x5a4a22] : th === 'desert' ? [0xb89a6a, 0xa0825a] : [0xe8e4da, 0xcfc8b8, 0x9a8f7a];
    const geo = new THREE.PlaneGeometry(th === 'rural' ? .09 : .14, th === 'rural' ? .06 : .1); const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; const col = new THREE.Color(); const P = [];
    for (let i = 0; i < N; i++) { col.setHex(cols[i % cols.length]); im.setColorAt(i, col); P.push({ x: camera.position.x + rand(-20, 20), z: camera.position.z + rand(-20, 20), y: rand(0, .6), vy: 0, r: Math.random() * 6, s: rand(.6, 1.4), ph: Math.random() * 6 }); }
    LIFE.g.add(im); LIFE.deb = { im, P };
  }
  // banderas en mástiles (los colores de los dos bandos y uno neutro)
  const fcol = [0x5cc8e0, 0xef6a45, 0xd9c79a]; let made = 0;
  for (let tries = 0; tries < 60 && made < 3; tries++) {
    const x = rx(), z = rz(); if (!freeSpot(x, z, 1.2)) continue; const gy = WORLD.groundAt ? WORLD.groundAt(x, z, 10) : 0;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 5.2, 8), std({ color: 0x8a8d90, metalness: .7, roughness: .4 })); pole.position.set(x, gy + 2.6, z); pole.castShadow = true; LIFE.g.add(pole);
    const fg = new THREE.PlaneGeometry(1.5, .9, 12, 6); fg.translate(.75, 0, 0); const fl = new THREE.Mesh(fg, std({ color: fcol[made], roughness: .85, side: THREE.DoubleSide })); fl.position.set(x + .04, gy + 4.6, z); fl.castShadow = true;
    fl.rotation.y = Math.atan2(-LIFE.wind[1], LIFE.wind[0]); LIFE.g.add(fl); LIFE.flags.push({ m: fl, base: Float32Array.from(fg.attributes.position.array), ph: Math.random() * 6 }); made++;
  }
  // charcos con lluvia: espejos oscuros en el suelo
  if (c.weather === 'lluvia') {
    const pm = std({ color: 0x1a1e22, roughness: .04, metalness: .55, envMapIntensity: 2.2, transparent: true, opacity: .85 }); pm.envMap = scene.environment || null;
    for (let i = 0, n = 0; i < 80 && n < 14; i++) { const x = rx(), z = rz(); if (!freeSpot(x, z, .8)) continue; const r = rand(.6, 1.6); const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), pm); m.rotation.x = -Math.PI / 2; m.scale.set(1, rand(.5, .9), 1); m.position.set(x, (WORLD.groundAt ? WORLD.groundAt(x, z, 10) : 0) + .012, z); m.receiveShadow = true; LIFE.g.add(m); n++; }
  }
  // huellas en la nieve
  if (th === 'snow' || c.weather === 'nieve') {
    const N = 160, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(.11, .26), new THREE.MeshBasicMaterial({ color: 0x8e9cb0, transparent: true, opacity: .45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), N);
    const z0m = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < N; i++) im.setMatrixAt(i, z0m); im.frustumCulled = false; LIFE.g.add(im); LIFE.steps = im; LIFE.si = 0;
  }
  // pájaros posados en los techos más altos (de día)
  if (!c.night) {
    const roofs = WORLD.colliders.filter(b => b.mat !== 'perim' && b.maxY > 3.5 && (b.maxX - b.minX) > 2 && (b.maxZ - b.minZ) > 2).sort(() => Math.random() - .5).slice(0, 3);
    const bm = new THREE.MeshLambertMaterial({ color: 0x23211f, side: THREE.DoubleSide }); const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -.06, -.16, .02, .02, 0, 0, .05, 0, 0, -.06, .16, .02, .02, 0, 0, .05]), 3)); wg.computeVertexNormals();
    for (const b of roofs) for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(wg, bm); const hx = rand(b.minX + .3, b.maxX - .3), hz = rand(b.minZ + .3, b.maxZ - .3); m.position.set(hx, b.maxY + .03, hz); m.rotation.y = Math.random() * 6; m.scale.setScalar(.8); LIFE.g.add(m); LIFE.birds.push({ m, home: m.position.clone(), st: 0, v: new THREE.Vector3(), t: 0, ph: Math.random() * 6 }); }
  }
  // luces de bodega que parpadean de noche
  if (c.night) {
    const walls = WORLD.colliders.filter(b => b.mat !== 'perim' && b.maxY > 3).sort(() => Math.random() - .5).slice(0, 5);
    for (const b of walls) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glow, color: 0xffd9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); const side = Math.random() < .5; const x = side ? (Math.random() < .5 ? b.minX - .05 : b.maxX + .05) : (b.minX + b.maxX) / 2, z = side ? (b.minZ + b.maxZ) / 2 : (Math.random() < .5 ? b.minZ - .05 : b.maxZ + .05);
      sp.position.set(x, Math.min(b.maxY - .4, 3.4), z); sp.scale.setScalar(1.1); LIFE.g.add(sp); const lamp = new THREE.Mesh(new THREE.BoxGeometry(.3, .1, .3), new THREE.MeshBasicMaterial({ color: 0xfff1d0 })); lamp.position.copy(sp.position); LIFE.g.add(lamp); LIFE.lamps.push({ sp, lamp, ph: Math.random() * 20, bad: Math.random() < .5 }); }
    const pl = new THREE.PointLight(0xffc888, 0, 9); if (LIFE.lamps[0]) { pl.position.copy(LIFE.lamps[0].sp.position); pl.position.y -= .3; LIFE.g.add(pl); LIFE.lamps[0].pl = pl; }
  }
}
// un disparo cerca espanta a los pájaros
function lifeShot(x, z) { for (const b of LIFE.birds) if (b.st === 0 && Math.hypot(b.home.x - x, b.home.z - z) < 22) { b.st = 1; b.t = 0; const a = Math.random() * 6.28; b.v.set(Math.cos(a) * rand(4, 7), rand(3, 5), Math.sin(a) * rand(4, 7)); b.m.rotation.y = Math.atan2(b.v.x, b.v.z); } }
const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _le = new THREE.Euler(), _lp = new THREE.Vector3(), _ls = new THREE.Vector3(1, 1, 1);
function updateLife(dt) {
  if (!LIFE.g) return; LIFE.t += dt; const t = LIFE.t, [wx, wz] = LIFE.wind, gust = .6 + Math.max(0, Math.sin(t * .35)) * 1.4;
  for (const S of LIFE.steam) { S.t -= dt; if (S.t <= 0) { S.on = !S.on; S.t = S.on ? rand(2.5, 4.5) : rand(4, 9); if (S.on && AC && G.state === 'playing') { const pa = posAudio(S.x, S.z); if (pa.d < 30) sNoise(S.t, .16 * (1 - pa.d / 30), 3800, 0, pa.pan, .4); } }
    if (S.on && Math.random() < dt * 9) { const q = S.puffs[S.i++ % S.puffs.length]; q.life = 2.4; q.sp.visible = true; q.sp.position.set(S.x + rand(-.2, .2), .6, S.z + rand(-.2, .2)); q.sp.material.rotation = Math.random() * 6; }
    for (const q of S.puffs) if (q.life > 0) { q.life -= dt; const k = 1 - q.life / 2.4; q.sp.position.y += dt * (1.6 - k); q.sp.position.x += wx * dt * .6; q.sp.position.z += wz * dt * .6; q.sp.scale.setScalar(.8 + k * 4.2); q.sp.material.opacity = Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - k) * .75; if (q.life <= 0) q.sp.visible = false; } }
  for (const b of LIFE.beacons) { const a = t * 3.2 + b.ph, k = Math.pow(Math.max(0, Math.cos(a)), 6); b.sp.material.opacity = .25 + k * .95; b.sp.scale.setScalar(1.2 + k * 2.2); if (b.pl) b.pl.intensity = k * 2.4; }
  if (LIFE.deb) { const { im, P } = LIFE.deb, cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < P.length; i++) { const q = P[i]; q.x += (wx * gust * q.s + Math.sin(t * 2 + q.ph) * .3) * dt; q.z += (wz * gust * q.s + Math.cos(t * 1.7 + q.ph) * .3) * dt;
      const lift = gust > 1.4 ? .9 : 0; q.vy += (lift * q.s - 1.2) * dt; q.y = Math.max(.02, Math.min(1.6, q.y + q.vy * dt)); if (q.y <= .02) q.vy = 0; q.r += dt * gust * 3 * q.s;
      if (Math.abs(q.x - cx) > 22 || Math.abs(q.z - cz) > 22) { q.x = cx - wx * 20 + rand(-14, 14); q.z = cz - wz * 20 + rand(-14, 14); q.y = rand(0, .3); }
      const gy = WORLD.groundAt ? WORLD.groundAt(q.x, q.z, q.y + 2) : 0; _lp.set(q.x, gy + q.y + .02, q.z); _le.set(q.y > .05 ? q.r : -Math.PI / 2, q.r * .7, q.y > .05 ? q.r * .5 : 0); _lq.setFromEuler(_le); _lm.compose(_lp, _lq, _ls); im.setMatrixAt(i, _lm); }
    im.instanceMatrix.needsUpdate = true; }
  for (const f of LIFE.flags) { const a = f.m.geometry.attributes.position, B = f.base; for (let i = 0; i < a.count; i++) { const x = B[i * 3], y = B[i * 3 + 1], k = x / 1.5; a.array[i * 3 + 2] = Math.sin(x * 3.2 - t * 6 * (.6 + gust * .3) + f.ph) * .16 * k * gust + Math.sin(y * 4 + t * 3) * .03 * k; a.array[i * 3 + 1] = y - k * k * .12 * (1.6 - gust * .5); } a.needsUpdate = true; f.m.geometry.computeVertexNormals(); }
  for (const b of LIFE.birds) {
    if (b.st === 0) { b.ph += dt; b.m.position.y = b.home.y + (Math.sin(b.ph * 7) > .97 ? .02 : 0); if (Math.random() < dt * .2) b.m.rotation.y += rand(-1, 1); continue; }
    b.t += dt; b.m.position.addScaledVector(b.v, dt); b.v.y += dt * .6; const flap = Math.sin(b.t * 28) * .7; b.m.scale.set(.8, .8 + flap * .6, .8);
    if (b.t > 18) { b.st = 0; b.m.position.copy(b.home); b.m.scale.setScalar(.8); } }
  for (const L of LIFE.lamps) { let k = 1; if (L.bad) { const n = Math.sin(t * 23 + L.ph) * Math.sin(t * 7.3 + L.ph * 2); k = n > .55 ? .1 : n > .4 ? .55 : 1; } L.sp.material.opacity = k; L.lamp.material.color.setScalar(.3 + .7 * k); if (L.pl) L.pl.intensity = 1.6 * k; }
  if (LIFE.steps) { for (const a of actors) { if (!a || !a.alive || !a.pos) continue; const id = a.id, L = LIFE.last[id] || (LIFE.last[id] = { x: a.pos.x, z: a.pos.z, s: 1 }); const d = Math.hypot(a.pos.x - L.x, a.pos.z - L.z);
      if (d > .75 && a.pos.y < .3) { const yaw = Math.atan2(a.pos.x - L.x, a.pos.z - L.z); L.s = -L.s; _lp.set(a.pos.x + Math.cos(yaw) * .12 * L.s, (WORLD.groundAt ? WORLD.groundAt(a.pos.x, a.pos.z, 1) : 0) + .015, a.pos.z - Math.sin(yaw) * .12 * L.s); _le.set(-Math.PI / 2, 0, yaw); _lq.setFromEuler(_le); _lm.compose(_lp, _lq, _ls); LIFE.steps.setMatrixAt(LIFE.si++ % LIFE.steps.count, _lm); LIFE.steps.instanceMatrix.needsUpdate = true; L.x = a.pos.x; L.z = a.pos.z; }
      else if (d > 3) { L.x = a.pos.x; L.z = a.pos.z; } } }
}

/* ================= POSPROCESADO ================= */
const post = { composer: null, grade: null, fxaa: null, vmPass: null, bloom: null, sat: 1.06 };
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, sat: { value: 1.06 }, contrast: { value: 1.07 }, vig: { value: .32 }, grain: { value: .025 }, hurt: { value: 0 }, dof: { value: 0 }, px: { value: new THREE.Vector2(1 / 1280, 1 / 720) } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform sampler2D tDiffuse;uniform float time,sat,contrast,vig,grain,hurt,dof;uniform vec2 px;varying vec2 vUv;' +
    'vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}' +
    'void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;if(dof>.001){float r=dof*smoothstep(.12,.55,distance(vUv,vec2(.5)))*6.;vec3 b=c;for(int i=0;i<8;i++){float a=float(i)*.785;b+=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*px*r).rgb+texture2D(tDiffuse,vUv+vec2(cos(a+.39),sin(a+.39))*px*r*2.).rgb;}c=b/17.;}c=mix(c,aces(c*1.08),.55);float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,sat);c=(c-.5)*contrast+.5;' +
    'c+=mix(vec3(-.012,.0,.022),vec3(.022,.012,-.012),smoothstep(.15,.85,l));float d=distance(vUv,vec2(.5));c*=1.-vig*smoothstep(.42,.9,d);' +
    'c=mix(c,c*vec3(1.25,.55,.5),hurt*smoothstep(.3,.8,d));float n=fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.,1.)))*43758.5453);c+=(n-.5)*grain;gl_FragColor=vec4(clamp(c,0.,1.),1.);}'
};
function disposePost() {
  const c = post.composer; if (!c) return; post.composer = null;
  try { c.renderTarget1.dispose(); c.renderTarget2.dispose(); for (const p of c.passes) { if (p.dispose) p.dispose(); if (p.material && p.material.dispose) p.material.dispose(); } } catch (e) { }
}
function setupPost() {
  disposePost();
  if (prefs.gfx === 'low' || !THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass || !THREE.UnrealBloomPass) return;
  try {
    let rt = null; const pr = renderer.getPixelRatio();
    if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) { rt = new THREE.WebGLMultisampleRenderTarget(Math.max(1, Math.floor(innerWidth * pr)), Math.max(1, Math.floor(innerHeight * pr)), { format: THREE.RGBAFormat }); rt.samples = isTouch ? 2 : 4; }
    const c = new THREE.EffectComposer(renderer, rt || undefined); post.fxaa = null;
    // Ultra: la pasada de oclusión ambiental dibuja la escena ella misma (reemplaza a la pasada normal)
    post.ao = null;
    if (prefs.gfx === 'ultra' && THREE.SSAOPass) { try { const ao = new THREE.SSAOPass(scene, camera, innerWidth, innerHeight); ao.kernelRadius = .6; ao.minDistance = .0008; ao.maxDistance = .04; ao.output = THREE.SSAOPass.OUTPUT.Default; c.addPass(ao); post.ao = ao; } catch (e) { post.ao = null; } }
    if (!post.ao) c.addPass(new THREE.RenderPass(scene, camera));
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
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, prefs.gfx !== 'low' ? (isTouch ? 1.5 : 2) : 1));
  const sm = prefs.gfx === 'ultra' ? 4096 : prefs.gfx !== 'low' && !isTouch ? 2048 : 1024; if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resize(); setupPost(); applyNormals(prefs.gfx !== 'low'); scene.environment = prefs.gfx === 'low' ? null : envTex; vmScene.environment = scene.environment;
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
  if (prefs.gfx === 'low' || G.state !== 'playing' || document.hidden) return;
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
    if (me.alive && !(kc && kc.hl && kcActive())) {
      camera.position.set(me.pos.x, me.pos.y + me.h - .12, me.pos.z);
      const bob = Math.hypot(me.vel.x, me.vel.z) > .5 && me.grounded ? Math.sin(vm.bobT * 2) * .03 : 0; camera.position.y += bob - Math.sin((me.landT || 0) * Math.PI) * .12;
      const ln = me.lean || 0; if (ln) { camera.position.x += Math.cos(me.yaw) * ln * .32; camera.position.z -= Math.sin(me.yaw) * ln * .32; camera.position.y -= Math.abs(ln) * .04; }
      camera.rotation.set(me.pitch + me.punchP, me.yaw + me.punchY, (me.roll || 0) - ln * .14 + (me.slideT > 0 ? .05 : 0)); camYaw = me.yaw;
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
      else {
        const k = Math.min(1, me.deadT * 2), ka = actors[me.killer];
        if (ka && ka.id !== me.id && ka.pos && me.deadT < 2.5) { // gira y se acerca hacia quien te eliminó
          const e = Math.min(1, me.deadT / .9), ee = e * e * (3 - 2 * e), dx = ka.pos.x - me.pos.x, dz = ka.pos.z - me.pos.z, L = Math.hypot(dx, dz) || 1;
          const ty = Math.atan2(-dx, -dz), yaw = me.yaw + angDiff(me.yaw, ty) * ee, adv = Math.min(L * .35, 2.2) * ee;
          camera.position.set(me.pos.x + dx / L * adv, me.pos.y + lerp(1.6, .7, k), me.pos.z + dz / L * adv);
          const tp = Math.atan2(ka.pos.y + 1.3 - camera.position.y, L - adv); camera.rotation.set(lerp(me.pitch, tp, ee), yaw, .18 * k * (1 - ee)); camYaw = yaw;
        } else { camera.position.set(me.pos.x, me.pos.y + lerp(1.6, .4, k), me.pos.z); camera.rotation.set(me.pitch * (1 - k) - .2 * k, me.yaw, .5 * k); camYaw = me.yaw; }
      }
    }
    if (shake > 0) { shake = Math.max(0, shake - dt * 2); camera.rotation.x += gauss() * shake * .03; camera.rotation.y += gauss() * shake * .03; }
    const w = WEAPONS[me.cur]; const adsF = w && w.auto ? 58 : 64; const fovT = w && w.scope ? lerp(74, w.zoom || 26, me.scopeK) : lerp(74, adsF, me.adsK || 0); if (Math.abs(camera.fov - fovT) > .01) { camera.fov = fovT; camera.updateProjectionMatrix(); }
    if (me.alive && me.scopeK > .5) { const tt = nowS(), mv = Math.min(1, Math.hypot(me.vel.x, me.vel.z) / 3); camera.rotation.x += Math.sin(tt * 1.3) * .0012 * (1 + mv * 4); camera.rotation.y += Math.sin(tt * .9) * .0014 * (1 + mv * 4); }
    updateVM(dt); updateRange(dt); updateHUD(dt); radarT += dt; if (radarT >= .05) { radarT = 0; drawRadar(); }
  } else {
    if (RV.on) { rvRender(dt); updateFx(dt); animSmokes(); } else {
    menuT += dt * .04; const M = MAPS[CURMAP]; const cx = (M.bounds[0] + M.bounds[2]) / 2, cz = (M.bounds[1] + M.bounds[3]) / 2;
    camera.position.set(cx + Math.cos(menuT) * 34, 16, cz + Math.sin(menuT) * 26); camera.lookAt(cx, 1.5, cz); if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    animSmokes(); }
  }
  sky.position.copy(camera.position); PCM.tickCamo(now * .001);
  const shOn = G.state !== 'playing' ? updateShowcase(dt) : (SHOW.g && (SHOW.g.visible = false), false); if (shOn) vm.group.visible = false;
  const showVm = (G.state === 'playing' && vm.group.visible) || shOn;
  if (INV.open) renderInv(now);
  if (post.composer) {
    skyU.time.value = now * .001;
    post.vmPass.enabled = showVm; const u = post.grade.uniforms; u.time.value = now * .001 % 100; u.sat.value = post.sat;
    u.dof.value = kcActive() || (G.state === 'playing' && !me.alive && me.deadT < 1.2) ? 1 : lerp(u.dof.value, 0, .2); u.px.value.set(1 / Math.max(1, innerWidth), 1 / Math.max(1, innerHeight));
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
  if (kc && kc.cine && kcActive()) { vm.group.visible = false; return; }
  if (!me.alive || (kc && kc.hl)) { updateSpecVM(dt); return; }
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
  const rlP = me.reloadT > 0 ? Math.min(1, 1 - me.reloadT / (WEAPONS[me.cur].reload || 1)) : 0; PCM.poseReload(g.g, rlP);
  // respiración en reposo: el arma sube y baja suavemente
  if (!isKnife) { const tt = nowS(), still = 1 - Math.min(1, spd / 2), bk = still * (1 - (me.adsK || 0) * .8); oy += Math.sin(tt * 1.7) * .0032 * bk; rx += Math.sin(tt * 1.7 + .6) * .007 * bk; rz += Math.sin(tt * .8) * .006 * bk; }
  const draw = me.drawT > 0 ? me.drawT / .5 : 0;
  const ak = me.adsK || 0, ap = g.ads || g.pos, calm = 1 - ak * .85;
  rz -= (me.lean || 0) * .16;
  const px = lerp(g.pos[0], ap[0], ak), py = lerp(g.pos[1], ap[1], ak), pz = lerp(g.pos[2], ap[2], ak);
  vm.swX = lerp(vm.swX || 0, 0, 1 - Math.exp(-dt * 8)); vm.swY = lerp(vm.swY || 0, 0, 1 - Math.exp(-dt * 8)); me.recoilJolt = Math.max(0, (me.recoilJolt || 0) - dt * 6);
  const land = Math.sin((me.landT || 0) * Math.PI) * .03;
  g.g.position.set(px + ox + (bx + vm.swing * -.08 - vm.swX * .02) * calm, py + oy + (-by - reloadK * .09 - (isKnife ? 0 : draw * .25) + (me.nadeArm ? .05 : 0) + vm.swY * .015 - land) * calm, pz + oz + vm.kick * (.035 - ak * .02) - vm.throwT * .15 + (me.recoilJolt || 0) * .02 * calm);
  { const ch = g.g.userData.charm; if (ch) { const tt = nowS(); ch.rotation.z = clamp(-vm.swX * 1.4 + Math.sin(tt * 2.6) * .08 * (1 + spd * .3) - (me.roll || 0) * 2, -1, 1); ch.rotation.x = clamp(vm.kick * 1.2 + reloadK * .8 + Math.sin(tt * 3.1 + 1) * .06 * (1 + spd * .3), -1, 1); } }
  g.g.rotation.set(rx + (vm.kick * .05 + vm.swY * .05) * calm + reloadK * .55 + (isKnife ? 0 : draw * -.6) + vm.swing * -.6, ry + vm.swing * 1.2 + vm.swX * .08 * calm, rz + reloadK * -.35 + vm.swing * .3 + (vm.swX * .05 - (me.roll || 0) * 1.5) * calm);
  vm.flashT = (vm.flashT || 0) - dt; g.flash.visible = vm.flashT > 0; g.flash.material.rotation = Math.random() * 6; g.light.intensity = vm.flashT > 0 ? 3 : 0;
}
$('#rvClose').onclick = stopReplay; $('#rvPlay').onclick = () => { const R = RV.r; if (!RV.play && RV.t >= R.frames[R.frames.length - 1].t) RV.t = R.frames[0].t; RV.play = !RV.play; };
$('#rvSeek').oninput = e => { RV.t = RV.r.frames[0].t + +e.target.value; RV.lastShot = RV.t; }; $('#rvView').onchange = e => { RV.view = e.target.value; };
$('#rvSpeed').onchange = e => { RV.speed = +e.target.value; };
$('#tpBtn').onclick = () => { sendMsg({ t: 'tpause' }); };
drawProfile(); restoreSession();
if (/[?&]debug=1/.test(location.search)) window.__pc = { me, vm, applyCond, buildWorld, renderer, applyGfx, RG, rangeOnHit, rangeEnd, net, get kc() { return kc; }, addFeed, startFinalKill, LIFE, RV, startReplay, stopReplay, drawStats, leaveToMenu, gyro: () => ({ gyroOk, gyroSeen, gyroSrc, mode: prefs.mc.gyro, state: G.state, he: HE.on, act: gyroActive() }) };
requestAnimationFrame(frame);
})();
