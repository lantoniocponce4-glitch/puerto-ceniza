/* Puerto Ceniza — núcleo compartido (servidor Node y navegador).
   Modo plantar/desactivar por rondas: mapas, colisiones, rayos, economía, granadas, bots y la sala (Room). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PC = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const TAU = Math.PI * 2;
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (!isFinite(d)) return 0; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
  const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const r2 = v => Math.round(v * 100) / 100;
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

  /* ================= ARMAS Y EQUIPO ================= */
  const WEAPONS = {
    knife: { id: 'knife', name: 'Cuchillo', slot: 3, price: 0, dmg: 40, melee: true, rpm: 140, speed: 5.4, kill: 1500, ap: .85, stand: 0, run: 0, crouch: 0, jump: 0, kick: 0, mag: 0, res: 0, reload: 0 },
    p9: { id: 'p9', name: 'P-9 Lince', cls: 'Pistola', slot: 2, price: 200, dmg: 30, ap: .5, rm: .85, rpm: 400, auto: false, mag: 13, res: 52, reload: 2.2, stand: .0065, run: .07, crouch: .0045, jump: .16, kick: .022, speed: 5.2, kill: 300, snd: { cut: 3600, dec: .14, thump: 140, vol: .7 } },
    r50: { id: 'r50', name: 'R-50 Toro', cls: 'Pistola pesada', slot: 2, price: 700, dmg: 58, ap: .93, rm: .81, rpm: 240, auto: false, mag: 7, res: 35, reload: 2.2, stand: .006, run: .13, crouch: .0045, jump: .22, kick: .075, speed: 5.0, kill: 300, snd: { cut: 2600, dec: .3, thump: 90, vol: 1.05 } },
    smg: { id: 'smg', name: 'SMG-9 Tábano', cls: 'Subfusil', slot: 1, price: 1250, dmg: 26, ap: .6, rm: .75, rpm: 860, auto: true, mag: 30, res: 120, reload: 2.1, stand: .008, run: .045, crouch: .006, jump: .15, kick: .0095, speed: 5.0, kill: 600, snd: { cut: 4200, dec: .14, thump: 150, vol: .72 } },
    ar: { id: 'ar', name: 'AR-17 Saeta', cls: 'Fusil', slot: 1, price: 2700, dmg: 35, ap: .78, rm: .98, rpm: 600, auto: true, mag: 30, res: 90, reload: 2.5, stand: .0035, run: .13, crouch: .0026, jump: .22, kick: .016, speed: 4.6, kill: 300, snd: { cut: 3100, dec: .24, thump: 105, vol: .95 } },
    sr: { id: 'sr', name: 'SR-8 Garza', cls: 'Francotirador', slot: 1, price: 4750, dmg: 115, ap: .97, rm: .99, rpm: 41, auto: false, mag: 10, res: 30, reload: 3.6, stand: .06, scoped: .0006, run: .25, crouch: .05, jump: .32, kick: .06, speed: 4.0, kill: 100, scope: true, snd: { cut: 2000, dec: .5, thump: 70, vol: 1.2 } },
    ap18: { id: 'ap18', name: 'AP-18 Colibrí', cls: 'Pistola automática', slot: 2, price: 500, dmg: 23, ap: .47, rm: .8, rpm: 900, auto: true, mag: 20, res: 80, reload: 2.2, stand: .009, run: .05, crouch: .007, jump: .15, kick: .011, speed: 5.1, kill: 300, snd: { cut: 3900, dec: .11, thump: 160, vol: .62 } },
    es12: { id: 'es12', name: 'ES-12 Jabalí', cls: 'Escopeta', slot: 1, price: 1100, dmg: 24, pellets: 8, spreadP: .055, ap: .5, rm: .55, rpm: 70, auto: false, mag: 7, res: 32, reload: 2.9, stand: .004, run: .02, crouch: .004, jump: .08, kick: .07, speed: 4.9, kill: 900, snd: { cut: 2100, dec: .36, thump: 65, vol: 1.2 } },
    fr9: { id: 'fr9', name: 'FR-9 Cierzo', cls: 'Fusil ligero', slot: 1, price: 2050, dmg: 30, ap: .7, rm: .96, rpm: 666, auto: true, mag: 25, res: 90, reload: 2.3, stand: .0045, run: .12, crouch: .0032, jump: .2, kick: .014, speed: 4.75, kill: 300, snd: { cut: 3400, dec: .2, thump: 115, vol: .9 } },
    lmg: { id: 'lmg', name: 'LMG-60 Mula', cls: 'Ametralladora', slot: 1, price: 5200, dmg: 32, ap: .8, rm: .97, rpm: 750, auto: true, mag: 100, res: 200, reload: 5.0, stand: .008, run: .18, crouch: .005, jump: .3, kick: .013, speed: 4.2, kill: 300, snd: { cut: 2900, dec: .26, thump: 95, vol: 1.0 } },
    tr7: { id: 'tr7', name: 'TR-7 Cernícalo', cls: 'Rifle ligero', slot: 1, price: 1700, dmg: 75, ap: .85, rm: .98, rpm: 48, auto: false, mag: 10, res: 90, reload: 3.0, stand: .035, scoped: .001, run: .12, crouch: .03, jump: .05, kick: .05, speed: 4.85, kill: 300, scope: true, snd: { cut: 2500, dec: .4, thump: 80, vol: 1.1 } }
  };
  // Escalada de armas: una baja con el arma actual sube de nivel; la última es el cuchillo
  const LADDER = ['ar', 'fr9', 'lmg', 'smg', 'es12', 'tr7', 'sr', 'r50', 'ap18', 'p9', 'knife'];
  const TDM = { goal: 50, time: 480, respawn: 3, protect: 2.5, guns: ['ar', 'fr9', 'smg', 'es12', 'lmg', 'tr7', 'sr'] };
  const GG_TIME = 600;
  const NADES = {
    he: { id: 'he', name: 'Granada HE', price: 300, max: 1 },
    fl: { id: 'fl', name: 'Cegadora', price: 200, max: 2 },
    sm: { id: 'sm', name: 'Humo', price: 300, max: 1 }
  };
  const GEAR = {
    kevlar: { id: 'kevlar', name: 'Chaleco', price: 650 },
    helm: { id: 'helm', name: 'Chaleco + casco', price: 1000 },
    kit: { id: 'kit', name: 'Kit de desactivación', price: 400, side: 'def' }
  };
  const ZM = { h: 4, c: 1, l: .75 };
  function weaponDamage(w, dist, zone, v, alt) {
    let d;
    if (w.melee) d = alt ? 65 : 40;
    else d = w.dmg * Math.pow(w.rm || 1, dist / 12.7) * (ZM[zone] || 1);
    const armored = v.armor > 0 && (zone === 'c' || (zone === 'h' && v.helmet) || w.melee);
    if (armored) { const hp = d * w.ap; const arm = (d - hp) * .5; v.armor = Math.max(0, v.armor - arm); if (v.armor <= 0) v.helmet = false; d = hp; }
    return d;
  }
  const ROUND = { buy: 12, buyFirst: 15, live: 115, fuse: 40, post: 5, plant: 3.2, defuse: 10, defuseKit: 5, half: 2, win: 3, total: 5, buyWindow: 20, over: 14 };
  const MONEY = { start: 800, max: 16000, winElim: 3250, winObj: 3500, lossBase: 1400, lossStep: 500, lossMax: 3400, plant: 300, plantTeam: 800 };
  // Camuflajes de armas que se desbloquean con el nivel del jugador
  const CAMOS = [
    { id: 'bosque', name: 'Bosque', lvl: 2 }, { id: 'digital', name: 'Digital', lvl: 4 }, { id: 'desierto', name: 'Desierto', lvl: 6 },
    { id: 'acero', name: 'Acero cepillado', lvl: 7 }, { id: 'tigre', name: 'Tigre', lvl: 9 }, { id: 'cobre', name: 'Cobre', lvl: 11 }, { id: 'carbono', name: 'Carbono', lvl: 12 },
    { id: 'oceano', name: 'Océano anodizado', lvl: 14 }, { id: 'carmesi', name: 'Carmesí', lvl: 16 }, { id: 'grafito', name: 'Grafito', lvl: 18 }, { id: 'oro', name: 'Oro', lvl: 20 },
    { id: 'aurora', name: 'Aurora · temporada', lvl: 1, top: 10 }
  ];
  // Progresión compartida (servidor y cliente): experiencia por nivel y desafíos diarios
  const CH_POOL = [
    { id: 'kills', txt: 'Consigue {n} bajas', n: 15 }, { id: 'heads', txt: 'Consigue {n} bajas a la cabeza', n: 5 }, { id: 'rounds', txt: 'Gana {n} rondas', n: 4 },
    { id: 'plant', txt: 'Planta la carga {n} veces', n: 2 }, { id: 'defuse', txt: 'Desactiva la carga {n} vez', n: 1 }, { id: 'knife', txt: 'Consigue {n} bajas con cuchillo', n: 2 },
    { id: 'nade', txt: 'Consigue {n} baja con granada HE', n: 1 }, { id: 'ggwin', txt: 'Gana {n} escalada de armas', n: 1 }, { id: 'shotgun', txt: 'Consigue {n} bajas con la escopeta', n: 3 },
    { id: 'sniper', txt: 'Consigue {n} bajas con rifle de mira', n: 3 }
  ];
  const needXP = l => 1000 + 150 * (l - 1);
  function dailyFor(day) {
    let h = 7; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0; const pool = CH_POOL.slice(), pick = [];
    while (pick.length < 3) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; pick.push(pool.splice(h % pool.length, 1)[0]); }
    return pick.map(c => ({ id: c.id, n: c.n, p: 0, done: false }));
  }
  // Qué experiencia y qué desafíos genera un evento para un jugador (team y id del jugador)
  function xpFromEvent(e, id, team, teamOf) {
    const out = [];
    switch (e.k) {
      case 'kill': if (e.a === id && e.v !== id && teamOf(e.v) !== team) { const ch = ['kills']; if (e.h) ch.push('heads'); if (e.w === 'knife') ch.push('knife'); if (e.w === 'he') ch.push('nade'); if (e.w === 'es12') ch.push('shotgun'); if (e.w === 'sr' || e.w === 'tr7') ch.push('sniper'); out.push({ n: 100 + (e.h ? 50 : 0), why: e.h ? 'baja a la cabeza' : 'baja', ch, stat: 'kills' }); } else if (e.ast && e.ast.includes(id)) out.push({ n: 40, why: 'asistencia', ch: [] }); if (e.v === id) out.push({ n: 0, why: '', ch: [], stat: 'deaths' }); break;
      case 'plant': if (e.v === id) out.push({ n: 150, why: 'carga plantada', ch: ['plant'] }); break;
      case 'defused': if (e.v === id) out.push({ n: 200, why: 'carga desactivada', ch: ['defuse'] }); break;
      case 'rend': if (e.w === team) out.push({ n: 100, why: 'ronda ganada', ch: ['rounds'] }); break;
      case 'mend': if (e.gg ? e.win === id : e.w === team) out.push({ n: 500, why: 'partida ganada', ch: e.gg ? ['ggwin'] : [], stat: 'wins' }); out.push({ n: 0, why: '', ch: [], stat: 'matches' }); break;
      case 'lvl': if (e.v === id) out.push({ n: 40, why: 'nivel de arma', ch: [] }); break;
    }
    return out;
  }
  const RADIO = ['¡Vamos A!', '¡Vamos B!', 'Enemigo a la vista', 'Necesito ayuda', 'Cúbreme', 'Retirada', 'Afirmativo', 'Negativo'];
  const BOT_NAMES = [['Vega', 'Ríos', 'Tano', 'Brea'], ['Krell', 'Mazur', 'Osei', 'Duarte']];
  const TEAMS = [{ name: 'Halcón' }, { name: 'Cobra' }];

  /* ================= MAPAS ================= */
  // Caja: [x0, z0, x1, z1, alto, material, y0]
  const MAPS = {
    alcazaba: {
      id: 'alcazaba', name: 'Alcazaba', theme: 'desert', blurb: 'Pueblo de adobe a pleno sol. Mercado al centro, túnel cubierto hacia B, callejón largo hacia A.',
      bounds: [-40, -32, 40, 32], wallH: 7,
      boxes: [
        // manzanas
        [4, -24, 18, -14, 6.5, 'bld'], [4, -8, 18, 8, 7, 'bld'], [4, 8, 18, 24, 5.5, 'bld2'], [18, -6, 30, 24, 6, 'bld2'],
        [-18, -24, -4, -20, 6, 'bld2'], [-18, -15, -4, 6, 6.5, 'bld'], [-18, 6, -4, 24, 5, 'bld2'], [-27, -8, -18, 24, 6, 'bld'], [-40, -8, -34, 24, 6.5, 'bld2'],
        // túnel cubierto hacia B
        [-34, 0, -27, 18, .5, 'roof', 3.0], [-34, 9, -31.5, 11, 3.0, 'stone'],
        // puerta del callejón A
        [30, 5.6, 33.4, 6.4, 4.2, 'stone'], [36.6, 5.6, 40, 6.4, 4.2, 'stone'], [33.4, 5.6, 36.6, 6.4, 1.4, 'stone', 2.8],
        // mercado en mid
        [-4, -2.6, -3, -1.4, 3.4, 'stone'], [3, -2.6, 4, -1.4, 3.4, 'stone'], [-3, -2.6, 3, -1.4, .8, 'stone', 3.0],
        [-3.4, 9, -1.8, 11.4, 1.1, 'wood'], [1.6, 3, 3.4, 5.4, 1.1, 'wood'], [-4, -18, -.8, -17.4, 1.05, 'stone'],
        // sitio A
        [23.4, -14.6, 25.8, -13.4, 2.4, 'crate'], [23.4, -13.4, 24.6, -12.2, 1.2, 'crate'], [30, -18, 32.2, -15.8, 1.0, 'stone'], [20, -20.3, 26, -19.7, 1.1, 'stone'], [34, -11, 36, -9, 2.2, 'crate'], [36.5, -22, 38.5, -20.8, 1.2, 'crate'],
        // sitio B
        [-30.5, -14.5, -29.5, -13.5, 5.5, 'stone'], [-24.5, -14.5, -23.5, -13.5, 5.5, 'stone'], [-27.6, -18.6, -26.4, -17.4, 1.2, 'crate'], [-36, -13, -34.8, -10.6, 2.4, 'crate'], [-24, -11, -20, -10.4, 1.1, 'stone'], [-38.6, -23.4, -36.2, -22.2, 1.2, 'crate'],
        // calles
        [13, -29.5, 14.2, -28.3, 1.2, 'crate'], [-15, -26.5, -13.8, -25.3, 1.2, 'crate'], [-10.6, 26.4, -9.4, 27.6, 1.2, 'crate'], [9.4, 26.4, 10.6, 27.6, 1.2, 'crate'], [-31.5, 21, -29.5, 22.2, 1.1, 'wood'], [33, 14, 34.2, 15.2, 1.2, 'crate'], [36, 24.5, 38.4, 25.7, 1.2, 'crate']
      ],
      spawns: { atk: [[-6, 28.5], [-3, 29.5], [0, 28.5], [3, 29.5], [6, 28.5]], def: [[-5, -28.5], [-2, -29.5], [1, -28.5], [4, -29.5], [6, -27.5]] },
      buy: { atk: [-18, 22, 18, 32], def: [-16, -32, 16, -22] },
      sites: { A: { r: [21, -23, 39, -7], c: [28, -14] }, B: { r: [-39, -23, -19, -9], c: [-28, -16] } },
      routes: {
        A: [[[1, 18], [1, -4], [10, -11], [24, -11]], [[22, 27], [35, 18], [35, 0], [33, -9]]],
        B: [[[-22, 27], [-30, 20], [-30, 0], [-30, -11]], [[0, 18], [-1, -12], [-1, -17], [-14, -17], [-24, -17]]]
      },
      holds: { A: [[33, -8.5, Math.PI], [20.5, -11, Math.PI / 2], [27, -21.5, Math.PI * .8]], B: [[-30, -10, Math.PI], [-20.5, -17, -Math.PI / 2], [-37, -21, -Math.PI * .8]] },
      labels: [['A', 31.4, -24.9, 0], ['B', -27, -24.9, 0], ['A', 33.6, 5.5, Math.PI], ['B', -27.2, 23.9, 0]]
    },
    muelle: {
      id: 'muelle', name: 'Muelle 9', theme: 'port', blurb: 'Terminal portuaria al atardecer. Bodegas de chapa, contenedores y un carril central largo para francotiradores.',
      bounds: [-36, -30, 36, 30], wallH: 5,
      boxes: [
        [-26, -22, 0, -4, 7, 'ware'], [-26, 4, 0, 22, 7, 'ware2'], [6, -14, 26, -4, 6.5, 'ware2'], [6, 4, 26, 12, 6.5, 'ware'],
        // carril central
        [-15, -1.2, -9, 1.2, 2.6, 'cont:blue'], [11, -3.6, 17, -1.2, 2.6, 'cont:red'],
        // sitio A
        [10, -24, 16, -21.6, 5.2, 'cont:green'], [19, -29, 21.4, -23, 2.6, 'cont:orange'], [21.5, -17.6, 22.6, -16.5, 1.1, 'crate'], [8.5, -17.6, 9.6, -16.5, 1.1, 'crate'], [8.5, -16.5, 9.6, -15.4, 1.1, 'crate'],
        // sitio B
        [12, 18, 18, 20.4, 2.6, 'cont:teal'], [20, 22, 22.4, 28, 5.2, 'cont:red'], [8.4, 14.4, 9.6, 15.6, 1.1, 'crate'], [23.4, 14.4, 24.6, 15.6, 1.1, 'crate'], [9, 26, 10.2, 27.2, 1.1, 'crate'],
        // rutas
        [-18, -27.2, -12, -24.8, 2.6, 'cont:gray'], [-13, 24.8, -7, 27.2, 2.6, 'cont:orange'], [1.6, -16, 2.8, -14.8, 1.1, 'crate'], [3.2, 15, 4.4, 16.2, 1.1, 'crate'],
        [-31, -16, -29.8, -14.8, 1.1, 'crate'], [-31, 14, -29.8, 15.2, 1.1, 'crate'], [29.8, -18, 31, -16.8, 1.1, 'crate'], [29.8, 18, 31, 19.2, 1.1, 'crate'],
        [-23, -.6, -21.8, .6, 1.1, 'crate'], [22, -.6, 23.2, .6, 1.1, 'crate']
      ],
      spawns: { atk: [[-32, -8], [-32, -3], [-32, 2], [-32, 7], [-30, 0]], def: [[32, -6], [32, -2], [32, 2], [32, 6], [30, 0]] },
      buy: { atk: [-36, -30, -26, 30], def: [26, -30, 36, 30] },
      sites: { A: { r: [7, -29, 25, -15], c: [16, -18.5] }, B: { r: [7, 13, 25, 29], c: [16, 23] } },
      routes: {
        A: [[[-28, -26], [-10, -28.5], [4, -26], [14, -18]], [[-28, 0], [-3, 0], [3, -12], [12, -18]]],
        B: [[[-28, 26], [-10, 28.5], [4, 26], [14, 22]], [[-28, 0], [-3, 0], [3, 12], [12, 22]]]
      },
      holds: { A: [[24, -16, Math.PI / 2], [8, -15, Math.PI / 2], [17, -28.5, Math.PI / 2]], B: [[24, 16, Math.PI / 2], [8, 17, Math.PI / 2], [17, 28.5, Math.PI / 2]] },
      labels: [['A', 16, -29.9, 0], ['B', 16, 29.9, Math.PI]]
    },
    fundo: {
      id: 'fundo', name: 'Fundo Azul', theme: 'rural', blurb: 'Casa de contenedores bajo un gran techo a dos aguas, entre huertos y viñas. Mediodía de verano.',
      bounds: [-40, -34, 40, 34], wallH: 2.4,
      boxes: (function () {
        const b = [
          [-12, -10.5, 12, 3.5, .3, 'slab'],
          [-10, -10, -5, 2, 2.6, 'cont:blue', .3], [5, -10, 10, 2, 2.6, 'cont:blue', .3],
          [-5, -10.3, -1.1, -9.9, 2.9, 'wareDark', .3], [1.1, -10.3, 5, -9.9, 2.9, 'wareDark', .3],
          [-.95, -4.4, .95, -.2, 1.45, 'car:red', .3],
          [-22.3, -5.5, -20.5, -1, 1.5, 'car:navy'], [-17.8, -6.2, -16, -1.7, 1.55, 'car:silver'],
          [-24.2, -8.2, -23.8, -7.8, 3.2, 'metal'], [-24.2, 4.8, -23.8, 5.2, 3.2, 'metal'], [-17.2, -8.2, -16.8, -7.8, 3.2, 'metal'], [-17.2, 4.8, -16.8, 5.2, 3.2, 'metal'],
          [12.5, -8.5, 14.5, -6.5, 2.4, 'tank'], [-9.5, 8, -8.1, 9.4, 1.0, 'tarp'],
          [8, 12, 9.2, 13.2, 1.1, 'crate'], [9.2, 12, 10.4, 13.2, 1.1, 'crate'], [-4, 15, -2.8, 16.2, 1.1, 'crate'], [16, 20, 18.6, 21.4, 1.2, 'wood'], [-27, 16, -24.6, 17.4, 1.2, 'wood'], [-31, -2, -29.8, -.8, 1.1, 'crate'], [3, 19, 4.2, 20.2, 1.1, 'crate'],
          [31, 22, 31.3, 22.3, 9, 'pole']
        ];
        for (const x of [22, 26, 30, 34, 38]) { b.push([x - .35, -12, x + .35, -2.5, 1.7, 'vine']); b.push([x - .35, 2.5, x + .35, 14, 1.7, 'vine']); }
        for (const z of [-15, -20, -25]) for (let x = -36; x <= 36; x += 6) { if (z === -15 && Math.abs(x) < 4) continue; b.push([x - .18, z - .18, x + .18, z + .18, 2.2, 'trunk']); }
        for (const [x, z] of [[-36, 10], [-36, 16], [-36, 22], [-31, 28]]) b.push([x - .18, z - .18, x + .18, z + .18, 2.2, 'trunk']);
        return b;
      })(),
      spawns: { atk: [[-6, 30], [-3, 31], [0, 30], [3, 31], [6, 30]], def: [[-6, -30], [-3, -31], [0, -30], [3, -31], [6, -30]] },
      buy: { atk: [-16, 24, 16, 34], def: [-16, -34, 16, -26] },
      sites: { A: { r: [-5, -9.8, 5, 3.5], c: [0, -7] }, B: { r: [-24, -8, -12, 5], c: [-19, 2.5] } },
      routes: {
        A: [[[0, 22], [0, 8], [0, -6]], [[18, 22], [19, 4], [11, -12.5], [0, -12.5], [0, -8]]],
        B: [[[-12, 22], [-14, 10], [-19, 2.5]], [[-30, 22], [-30, 6], [-22, 2.5]]]
      },
      holds: { A: [[-3.5, -8.8, Math.PI], [3.5, -8.8, Math.PI], [0, -12.5, 0]], B: [[-23, -7, Math.PI * .85], [-12.5, -7.5, Math.PI], [-26, 4, -Math.PI / 2]] },
      labels: []
    },
    distrito: {
      id: 'distrito', name: 'Distrito Lumen', theme: 'city', blurb: 'Manzana urbana con avenida central, estacionamiento techado (A) y plaza con fuente (B).',
      bounds: [-40, -32, 40, 32], wallH: 6,
      boxes: [
        // manzanas norte y galería cubierta en el centro
        [-14, -24, -2, -8, 12, 'city'], [2, -24, 14, -8, 13, 'city2'], [-2, -24, 2, -8, .5, 'slabC', 3.4],
        // estacionamiento techado (sitio A)
        [14, -24, 38, -8, .4, 'slabC', 3.2], [14, -24.4, 26, -24, 3.6, 'concrete2'],
        [19.6, -20.4, 20.4, -19.6, 3.2, 'concrete2'], [25.6, -20.4, 26.4, -19.6, 3.2, 'concrete2'], [31.6, -20.4, 32.4, -19.6, 3.2, 'concrete2'],
        [19.6, -12.4, 20.4, -11.6, 3.2, 'concrete2'], [25.6, -12.4, 26.4, -11.6, 3.2, 'concrete2'], [31.6, -12.4, 32.4, -11.6, 3.2, 'concrete2'],
        [16.4, -23.6, 18.2, -19.2, 1.45, 'car:silver'], [28.2, -23.4, 30, -19, 1.5, 'car:navy'], [34.5, -16.8, 36.3, -12.4, 1.45, 'car:red'],
        // plaza con fuente (sitio B)
        [-28, -18, -24, -14, 1.0, 'stoneC'], [-36, -12, -33, -11, .9, 'planter'], [-20, -21, -17, -20, .9, 'planter'], [-35, -23, -31.6, -19.6, 2.6, 'kiosk'], [-17, -14, -15.4, -10.6, .9, 'planter'],
        // avenida
        [-30, -4.2, -25.6, -2.4, 1.45, 'car:red'], [-12, 2.2, -7.6, 4, 1.5, 'car:navy'], [16, -4, 20.4, -2.2, 1.45, 'car:silver'], [30, 2.4, 34.4, 4.2, 1.5, 'car:red'],
        [-6, -.3, -3, .3, .95, 'barrier'], [3, -.3, 6, .3, .95, 'barrier'], [8, 4.6, 12, 5.4, 2.6, 'glassC'], [-20, -5.4, -16, -4.6, 2.6, 'glassC'],
        // manzanas sur y callejones
        [-40, 6, -24, 24, 10, 'city2'], [-18, 6, -4, 24, 14, 'city'], [4, 6, 20, 24, 12, 'city2'], [26, 6, 40, 24, 10, 'city'],
        [-23, 14, -21.5, 16, 1.3, 'dumpster'], [21, 12, 22.5, 14, 1.3, 'dumpster'], [-3.2, 15, -2, 16.2, 1.1, 'crate'], [2.4, 20, 3.6, 21.2, 1.1, 'crate'],
        [-30, 26, -28.8, 27.2, 1.1, 'crate'], [28, 26.5, 29.2, 27.7, 1.1, 'crate'], [-34, -28, -32.8, -26.8, 1.1, 'crate'], [33, -29, 34.2, -27.8, 1.1, 'crate']
      ],
      spawns: { atk: [[-8, 28], [-4, 29], [0, 28], [4, 29], [8, 28]], def: [[-8, -28], [-4, -29], [0, -28], [4, -29], [8, -28]] },
      buy: { atk: [-16, 24, 16, 32], def: [-16, -32, 16, -24] },
      sites: { A: { r: [15, -23, 37, -9], c: [23, -16] }, B: { r: [-37, -23, -15, -9], c: [-21, -16] } },
      routes: {
        A: [[[23, 26], [23, 10], [23, 0], [24, -10]], [[0, 26], [0, 0], [0, -20], [10, -27], [30, -27], [30, -20]]],
        B: [[[-21, 26], [-21, 10], [-21, 0], [-22, -10]], [[0, 26], [0, 0], [-10, -2], [-30, -6], [-30, -12]]]
      },
      holds: { A: [[17, -10, Math.PI], [32, -22.5, 0], [37, -9.6, Math.PI * .75]], B: [[-16, -9.5, Math.PI], [-37, -9.5, Math.PI], [-26, -22.5, 0]] },
      labels: []
    },
    boreal: {
      id: 'boreal', name: 'Estación Boreal', theme: 'snow', blurb: 'Estación de trenes nevada: andén techado (A), patio de carga (B) y vagones como cobertura.',
      bounds: [-38, -30, 38, 30], wallH: 4,
      boxes: [
        // estación y andén techado (sitio A)
        [-12, -30, 6, -24.4, 6, 'stationH'], [-12, -24.4, 24, -18, .3, 'slabC'], [-12, -24.4, 24, -18, .4, 'roofP', 3.6],
        [-9.2, -18.7, -8.8, -18.3, 3.6, 'metalP'], [-1.2, -18.7, -.8, -18.3, 3.6, 'metalP'], [6.8, -18.7, 7.2, -18.3, 3.6, 'metalP'], [14.8, -18.7, 15.2, -18.3, 3.6, 'metalP'], [22.8, -18.7, 23.2, -18.3, 3.6, 'metalP'],
        [9, -23.6, 10.2, -22.4, 1.1, 'crate'], [17, -21.4, 19.4, -20.2, .9, 'bench'], [12.5, -22, 13.7, -20.8, 1.1, 'crate'],
        // vagones en tres vías
        [-24, -13.5, -12, -10.5, 3.2, 'wagon:red'], [-6, -13.5, 6, -10.5, 3.2, 'wagon:blue'], [14, -13.5, 26, -10.5, 3.2, 'wagon:green'],
        [-18, -3.5, -6, -.5, 3.2, 'wagon:gray'], [2, -3.5, 14, -.5, 3.2, 'wagon:red'],
        [-26, 6.5, -14, 9.5, 3.2, 'wagon:blue'], [-8, 6.5, 4, 9.5, 3.2, 'wagon:green'], [12, 6.5, 24, 9.5, 3.2, 'wagon:gray'],
        // patio de carga (sitio B) y alrededores
        [-22, 16, -17, 21, 3.4, 'stationH'], [14, 20, 20, 22.4, 2.6, 'cont:red'], [4, 22, 6.4, 28, 2.6, 'cont:blue'], [6, 15, 7.2, 16.2, 1.1, 'crate'], [7.2, 15, 8.4, 16.2, 1.1, 'crate'],
        [18, 13.5, 20.2, 15, .7, 'snowpile'], [24, 24, 25.6, 25.6, 1.1, 'crate'], [26, -6, 28, -4, 2.4, 'tank'], [-4, 18, -1.8, 19.4, .7, 'snowpile'],
        [-30, -22, -28.8, -20.8, 1.1, 'crate'], [-31, 22, -29.8, 23.2, 1.1, 'crate'], [30, -22, 31.2, -20.8, 1.1, 'crate'], [30, 22, 31.2, 23.2, 1.1, 'crate']
      ],
      spawns: { atk: [[-34, -8], [-34, -3], [-34, 2], [-34, 13], [-32, 0]], def: [[34, -8], [34, -3], [34, 2], [34, 13], [32, 0]] },
      buy: { atk: [-38, -30, -28, 30], def: [28, -30, 38, 30] },
      sites: { A: { r: [6, -24.5, 24, -17], c: [15, -21] }, B: { r: [0, 12, 24, 28], c: [11, 19] } },
      routes: {
        A: [[[-30, -16], [-14, -16], [0, -16], [10, -20]], [[-30, 0], [-4, 4], [10, -6], [12, -15], [14, -20]]],
        B: [[[-30, 14], [-10, 14], [4, 16], [10, 18]], [[-30, 0], [-3, 3], [8, 4], [10, 12], [12, 18]]]
      },
      holds: { A: [[7, -20, Math.PI / 2], [22, -17.5, Math.PI], [17, -23.5, Math.PI * .7]], B: [[22.5, 16, Math.PI / 2], [8, 26, Math.PI / 2], [16, 12.5, Math.PI]] },
      labels: []
    }
  };
  // Polígono de tiro: solo para el modo práctica 'range'; no entra en rotación ni votación
  MAPS.poligono = {
    id: 'poligono', name: 'Polígono de tiro', theme: 'port', hidden: true, blurb: 'Práctica de puntería.',
    bounds: [-14, -44, 14, 8], wallH: 4,
    boxes: [
      [-7, -1.3, 7, -.9, 1.05, 'concrete'], [-7.4, -1.3, -7, 5, 2.6, 'concrete'], [7, -1.3, 7.4, 5, 2.6, 'concrete'], [-7.4, 5, 7.4, 5.4, 2.6, 'concrete'],
      [-9, -12, -7.8, -10.8, 1.1, 'crate'], [5, -15, 6.2, -13.8, 1.1, 'crate'], [-2, -20, 0.4, -19, 1.1, 'crate'], [-11, -24, -5, -21.6, 2.6, 'cont:red'],
      [4, -27, 10, -24.6, 2.6, 'cont:blue'], [-4, -33, -2.8, -31.8, 1.1, 'crate'], [7.5, -36, 8.7, -34.8, 1.1, 'crate'], [-10, -39, -4, -36.6, 2.6, 'cont:green']
    ],
    spawns: { atk: [[0, 2], [-2, 3], [2, 3], [-4, 3], [4, 3]], def: [[0, -42], [-3, -42], [3, -42], [-6, -42], [6, -42]] },
    buy: { atk: [-14, -44, 14, 8], def: [-14, -44, 14, 8] },
    sites: { A: { r: [-13, -43, -12, -42], c: [-12.5, -42.5] }, B: { r: [12, -43, 13, -42], c: [12.5, -42.5] } },
    routes: { A: [[[0, 2], [-12, -42]]], B: [[[0, 2], [12, -42]]] }, holds: { A: [[-12.5, -42.5, 0]], B: [[12.5, -42.5, 0]] }, labels: []
  };
  const MAP_IDS = Object.keys(MAPS).filter(k => !MAPS[k].hidden);
  const WEATHER = { alcazaba: 'arena', muelle: 'lluvia', fundo: 'niebla', distrito: 'lluvia', boreal: 'nieve' };
  function pickCond(mapId) { const r = Math.random(); if (r < .4) return { night: false, weather: null }; if (r < .7) return { night: true, weather: null }; return { night: false, weather: WEATHER[mapId] || null }; }

  /* ================= MUNDO (colisiones, rayos, navegación) ================= */
  function rayBox(o, d, b, maxT) {
    let tmin = 0, tmax = maxT, ax = -1, sg = 0;
    const mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
    for (let k = 0; k < 3; k++) {
      const ok = o[k], dk = d[k];
      if (Math.abs(dk) < 1e-9) { if (ok < mn[k] || ok > mx[k]) return null; }
      else { let t1 = (mn[k] - ok) / dk, t2 = (mx[k] - ok) / dk, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tmin) { tmin = t1; ax = k; sg = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return null; }
    }
    return { t: tmin, ax, sg };
  }
  function hitZones(a) {
    return { hy: a.pos.y + a.h - .17, top: a.pos.y + a.h - .36, mid: a.pos.y + a.h * .5 };
  }
  function rayActor(o, d, a, maxT) {
    let best = null; const z = hitZones(a);
    const ox = o[0] - a.pos.x, oy = o[1] - z.hy, oz = o[2] - a.pos.z; const b = ox * d[0] + oy * d[1] + oz * d[2]; const c = ox * ox + oy * oy + oz * oz - .04; const disc = b * b - c;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) best = { t, zone: 'h' }; }
    const r1 = rayBox(o, d, { minX: a.pos.x - .27, maxX: a.pos.x + .27, minY: z.mid, maxY: z.top, minZ: a.pos.z - .27, maxZ: a.pos.z + .27 }, maxT);
    if (r1 && r1.t > 0 && (!best || r1.t < best.t)) best = { t: r1.t, zone: 'c' };
    const r2_ = rayBox(o, d, { minX: a.pos.x - .22, maxX: a.pos.x + .22, minY: a.pos.y, maxY: z.mid, minZ: a.pos.z - .22, maxZ: a.pos.z + .22 }, maxT);
    if (r2_ && r2_.t > 0 && (!best || r2_.t < best.t)) best = { t: r2_.t, zone: 'l' };
    return best;
  }

  class World {
    constructor(mapId) {
      const M = MAPS[mapId] || MAPS.alcazaba; this.map = M; this.id = M.id;
      this.colliders = []; this.mapRects = [];
      for (const [x0, z0, x1, z1, h, mat, y0] of M.boxes) {
        const b = { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minY: y0 || 0, maxY: (y0 || 0) + h, minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), mat };
        this.colliders.push(b); if (!y0 || y0 < 1.5) this.mapRects.push(b);
      }
      const [bx0, bz0, bx1, bz1] = M.bounds, H = M.wallH, T = 1;
      for (const [x0, z0, x1, z1] of [[bx0 - T, bz0 - T, bx1 + T, bz0], [bx0 - T, bz1, bx1 + T, bz1 + T], [bx0 - T, bz0, bx0, bz1], [bx1, bz0, bx1 + T, bz1]])
        this.colliders.push({ minX: x0, maxX: x1, minY: 0, maxY: H, minZ: z0, maxZ: z1, mat: 'perim' });
      // navegación
      this.GX0 = bx0; this.GZ0 = bz0; this.GW = Math.ceil(bx1 - bx0); this.GH = Math.ceil(bz1 - bz0);
      const N = this.GW * this.GH; this.walk = new Uint8Array(N);
      for (let j = 0; j < this.GH; j++) for (let i = 0; i < this.GW; i++) {
        const x = bx0 + i + .5, z = bz0 + j + .5; let ok = 1;
        for (const b of this.colliders) { if (b.minY > 1.5 || b.maxY <= .36) continue; if (x > b.minX - .5 && x < b.maxX + .5 && z > b.minZ - .5 && z < b.maxZ + .5) { ok = 0; break; } }
        this.walk[j * this.GW + i] = ok;
      }
      this.gS = new Float32Array(N); this.came = new Int32Array(N); this.stamp = new Uint32Array(N); this.closed = new Uint32Array(N); this.gen = 0;
    }
    traceWorld(o, d, maxT) {
      let best = { t: maxT, n: null };
      if (d[1] < -1e-6) { const t = -o[1] / d[1]; if (t > 0 && t < best.t) best = { t, n: [0, 1, 0] }; }
      for (const b of this.colliders) { const r = rayBox(o, d, b, best.t); if (r && r.t < best.t) { const n = [0, 0, 0]; if (r.ax >= 0) n[r.ax] = r.sg; best = { t: r.t, n }; } }
      return best;
    }
    visible(o, p, smokes) {
      const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; const L = Math.hypot(d[0], d[1], d[2]) || 1e-6; d[0] /= L; d[1] /= L; d[2] /= L;
      for (const b of this.colliders) { const r = rayBox(o, d, b, L); if (r && r.t < L - .08) return false; }
      if (smokes) for (const s of smokes) {
        const sx = s.x - o[0], sy = s.y - o[1], sz = s.z - o[2]; const t = clamp(sx * d[0] + sy * d[1] + sz * d[2], 0, L);
        const cx = o[0] + d[0] * t - s.x, cy = o[1] + d[1] * t - s.y, cz = o[2] + d[2] * t - s.z;
        if (cx * cx + cy * cy * 1.6 + cz * cz < s.r * s.r) return false;
      }
      return true;
    }
    resolve(a) {
      const r = .34;
      for (const b of this.colliders) {
        if (a.pos.y >= b.maxY - .05 || a.pos.y + a.h <= b.minY || b.maxY - a.pos.y <= .36) continue;
        const cx = clamp(a.pos.x, b.minX, b.maxX), cz = clamp(a.pos.z, b.minZ, b.maxZ); const dx = a.pos.x - cx, dz = a.pos.z - cz; const q = dx * dx + dz * dz;
        if (q < r * r) {
          if (q > 1e-8) { const d = Math.sqrt(q); a.pos.x = cx + dx / d * r; a.pos.z = cz + dz / d * r; }
          else { const p1 = a.pos.x - b.minX, p2 = b.maxX - a.pos.x, p3 = a.pos.z - b.minZ, p4 = b.maxZ - a.pos.z; const m = Math.min(p1, p2, p3, p4); if (m === p1) a.pos.x = b.minX - r; else if (m === p2) a.pos.x = b.maxX + r; else if (m === p3) a.pos.z = b.minZ - r; else a.pos.z = b.maxZ + r; }
        }
      }
    }
    groundAt(x, z, y) { let g = 0; for (const b of this.colliders) { if (b.maxY > y + .36 || b.maxY <= g) continue; if (x > b.minX - .2 && x < b.maxX + .2 && z > b.minZ - .2 && z < b.maxZ + .2) g = b.maxY; } return g; }
    moveActor(a, dt) {
      a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt; this.resolve(a);
      const g = this.groundAt(a.pos.x, a.pos.z, a.pos.y);
      a.vel.y -= 14 * dt; a.pos.y += a.vel.y * dt;
      if (a.pos.y <= g) { a.pos.y = g; a.vel.y = 0; a.grounded = true; } else a.grounded = a.pos.y - g < .03;
      const B = this.map.bounds; a.pos.x = clamp(a.pos.x, B[0] + .4, B[2] - .4); a.pos.z = clamp(a.pos.z, B[1] + .4, B[3] - .4);
    }
    cIdx(x, z) { const i = Math.floor(x - this.GX0), j = Math.floor(z - this.GZ0); if (i < 0 || j < 0 || i >= this.GW || j >= this.GH) return -1; return j * this.GW + i; }
    nearestWalk(k) {
      const GW = this.GW, GH = this.GH; if (k >= 0 && this.walk[k]) return k;
      const i0 = k < 0 ? 0 : k % GW, j0 = k < 0 ? 0 : (k / GW) | 0;
      for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= GW || j >= GH) continue; const q = j * GW + i; if (this.walk[q]) return q; }
      return -1;
    }
    lineWalk(x0, z0, x1, z1) { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), n = Math.ceil(L / .4); for (let s = 1; s <= n; s++) { const t = s / n; const k = this.cIdx(x0 + dx * t, z0 + dz * t); if (k < 0 || !this.walk[k]) return false; } return true; }
    findPath(sx, sz, tx, tz) {
      const GW = this.GW, GH = this.GH, walk = this.walk, gS = this.gS, came = this.came, stamp = this.stamp, closed = this.closed;
      const cX = k => this.GX0 + (k % GW) + .5, cZ = k => this.GZ0 + ((k / GW) | 0) + .5;
      const s = this.nearestWalk(this.cIdx(sx, sz)), t = this.nearestWalk(this.cIdx(tx, tz)); if (s < 0 || t < 0) return null;
      const gen = ++this.gen;
      const heap = []; const tI = t % GW, tJ = (t / GW) | 0;
      const h = k => { const di = Math.abs(k % GW - tI), dj = Math.abs(((k / GW) | 0) - tJ); return Math.max(di, dj) + .414 * Math.min(di, dj); };
      const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      stamp[s] = gen; gS[s] = 0; came[s] = -1; push(s, h(s)); let iter = 0;
      while (heap.length && iter++ < 12000) {
        const [, k] = pop(); if (closed[k] === gen) continue; closed[k] = gen; if (k === t) break;
        const i = k % GW, j = (k / GW) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue; const q = nj * GW + ni; if (!walk[q] || closed[q] === gen) continue;
          if (di && dj && (!walk[j * GW + ni] || !walk[nj * GW + i])) continue;
          const ng = gS[k] + (di && dj ? 1.414 : 1); if (stamp[q] !== gen || ng < gS[q]) { stamp[q] = gen; gS[q] = ng; came[q] = k; push(q, ng + h(q)); }
        }
      }
      if (closed[t] !== gen) return null;
      const raw = []; for (let k = t; k !== -1; k = came[k]) raw.push([cX(k), cZ(k)]); raw.reverse();
      const out = []; let cur = [sx, sz]; let i = 0;
      while (i < raw.length - 1) { let far = i + 1; for (let k = raw.length - 1; k > i + 1; k--) { if (this.lineWalk(cur[0], cur[1], raw[k][0], raw[k][1])) { far = k; break; } } out.push(raw[far]); cur = raw[far]; i = far; }
      if (!out.length) out.push(raw[raw.length - 1]);
      return out;
    }
  }

  /* ================= SALA ================= */
  const STREAKS = { 3: { id: 'radar', reveal: 5 }, 5: { id: 'kit' }, 7: { id: 'dron', reveal: 12 } };
  const BOT_STYLE = ['rush', 'flank', 'steady'];
  const BOT_RANGE = { knife: [0, 2], p9: [5, 16], r50: [6, 18], ap18: [5, 15], smg: [4, 13], es12: [2, 8], ar: [9, 26], fr9: [9, 26], tr7: [9, 26], lmg: [11, 30], sr: [20, 70] };
  const DIFF = {
    recluta: { react: .7, err: .07, turn: 4.5 },
    veterano: { react: .42, err: .045, turn: 7 },
    elite: { react: .27, err: .028, turn: 10 }
  };
  const eyeOf = a => [a.pos.x, a.pos.y + a.h - .14, a.pos.z];
  let nextEnt = 1;

  class Room {
    constructor(opts = {}) {
      this.code = opts.code || 'LOCAL';
      this.diffKey = has(DIFF, opts.diff) ? opts.diff : 'veterano'; this.D = DIFF[this.diffKey];
      this.mapId = opts.mode === 'range' ? 'poligono' : has(MAPS, opts.map) && !MAPS[opts.map].hidden ? opts.map : MAP_IDS[(Math.random() * MAP_IDS.length) | 0];
      this.W = new World(this.mapId); this.M = this.W.map;
      this.isPublic = opts.isPublic !== false;
      this.mode = opts.mode === 'elim' || opts.mode === 'gg' || opts.mode === 'tdm' || opts.mode === 'range' ? opts.mode : 'bomb';
      this.reveal = [0, 0];
      this.clients = new Map(); this.onSend = () => { }; this.onBroadcast = () => { };
      this.actors = []; this.events = []; this.now = 0; this.tickN = 0; this.teamRadio = [0, 0]; this.cond = { night: false, weather: null }; this.votes = new Map();
      for (let t = 0; t < 2; t++) for (let i = 0; i < 4; i++) this.actors.push(this.makeActor(t, i));
      this.newMatch();
    }
    makeActor(team, slot) {
      return {
        id: this.actors.length, team, slot, human: null, name: BOT_NAMES[team][slot], pos: V(), vel: V(), yaw: 0, pitch: 0, h: 1.8, crouch: false, walking: false, grounded: true,
        hp: 100, alive: false, armor: 0, helmet: false, kit: false, money: MONEY.start, inv: { p: null, s: 'p9', n: { he: 0, fl: 0, sm: 0 } }, cur: 'p9',
        kills: 0, deaths: 0, assists: 0, score: 0, dmgRound: 0, lastHit: -99, damagers: new Map(), firedAt: -9, lastShot: -9, act: false, blindUntil: 0, pdirty: true,
        ammo: 0, reloadT: 0, path: null, pi: 0, goalKey: '', target: null, seenT: 0, thinkT: 0, lastKnown: null, lastKnownT: -99, strafeT: 0, strafeDir: 0, burst: 0, burstPause: 0, alertUntil: 0, stuckT: 0, stuckP: V(), react: 0,
        route: null, ri: 0, hold: null, holdSite: null, planting: false
      };
    }
    side(team) { return (team === 0) === this.swap ? 'atk' : 'def'; } // equipo 0 empieza defendiendo
    teamOfSide(s) { return this.side(0) === s ? 0 : 1; }
    ev(e) { this.events.push(e); }
    get humanCount() { return this.clients.size; }

    /* --- partida y rondas --- */
    tally() { const t = {}; for (const id of MAP_IDS) t[id] = 0; for (const m of this.votes.values()) if (t[m] !== undefined) t[m]++; return t; }
    votedMap() { const t = this.tally(); let best = null, n = 0, tie = false; for (const id of MAP_IDS) { if (t[id] > n) { best = id; n = t[id]; tie = false; } else if (t[id] === n && n > 0) tie = true; } return n > 0 && !tie ? best : null; }
    nextMapId() { const i = MAP_IDS.indexOf(this.mapId); return MAP_IDS[(i + 1) % MAP_IDS.length]; }
    setMap(id) {
      if (!MAPS[id] || id === this.mapId) return;
      this.mapId = id; this.W = new World(id); this.M = this.W.map; this._gp = null;
      for (const a of this.actors) { a.path = null; a.goalKey = ''; a.route = null; a.hold = null; a.post = null; }
    }
    newMatch() {
      this.scores = [0, 0]; this.round = 0; this.swap = false; this.lossStreak = { atk: 0, def: 0 };
      for (const a of this.actors) { a.kills = a.deaths = a.assists = a.score = 0; this.resetLoadout(a, true); a.money = MONEY.start; }
      if (this.mode === 'gg') return this.startGG();
      if (this.mode === 'tdm') return this.startTDM();
      if (this.mode === 'range') return this.startRange();
      this.startRound();
    }
    /* --- campo de tiro: sin bots, compra libre en todo el polígono --- */
    startRange() {
      this.round = 1; this.phase = 'live'; this.phaseEnd = this.now + 1e7; this.liveStart = this.now; this.rotate = false;
      this.drops = []; this.nades = []; this.smokes = [];
      this.bomb = { st: 'none', by: -1, x: 0, y: 0, z: 0, site: null, explodeAt: 0, pp: 0, dp: 0, planter: -1, defuser: -1 };
      for (const a of this.actors) { a.alive = false; a.respawnAt = Infinity; }
      this.ev({ k: 'range' }); this.rosterDirty = true;
    }
    /* --- combate por equipos: reaparición, gana el primero en TDM.goal bajas --- */
    startTDM() {
      this.round = 1; this.phase = 'live'; this.phaseEnd = this.now + TDM.time; this.liveStart = this.now;
      this.drops = []; this.nades = []; this.smokes = [];
      this.bomb = { st: 'none', by: -1, x: 0, y: 0, z: 0, site: null, explodeAt: 0, pp: 0, dp: 0, planter: -1, defuser: -1 };
      for (const a of this.actors) { a.alive = false; a.tdmGun = null; }
      for (const a of this.actors) this.spawnTDM(a);
      this.ev({ k: 'tdm', t: TDM.time, goal: TDM.goal }); this.rosterDirty = true;
    }
    equipTDM(a) {
      const p = a.tdmGun || (a.human ? 'ar' : TDM.guns[(Math.random() * TDM.guns.length) | 0]);
      a.inv = { p, s: 'p9', n: { he: 1, fl: 1, sm: 0 } }; a.cur = p; a.ammo = WEAPONS[p].mag; a.reloadT = 0; a.armor = 100; a.helmet = true; a.kit = false; a.money = 0; a.pdirty = true;
    }
    spawnTDM(a) {
      let best = null, bs = -1e9;
      for (const p of this.ggPoints()) { let md = 60, mf = 60; for (const t of this.actors) { if (!t.alive || t === a) continue; const d = Math.hypot(t.pos.x - p[0], t.pos.z - p[1]); if (t.team !== a.team) md = Math.min(md, d); else mf = Math.min(mf, d); }
        const sc = Math.min(md, 32) - Math.max(0, Math.min(mf, 30) - 12) * .25 + Math.random() * 8; if (sc > bs) { bs = sc; best = p; } }
      this.equipTDM(a); this.spawn(a, best);
    }
    killTDM(v, att, head, wid) {
      v.streak = 0;
      v.respawnAt = this.now + TDM.respawn; v.pdirty = true; this.rosterDirty = true;
      if (WEAPONS[v.cur] && WEAPONS[v.cur].slot === 1) v.tdmGun = v.cur;
      const valid = att && att !== v && att.team !== v.team; const ast = [];
      if (valid) for (const [id, dm] of v.damagers) { if (id !== att.id && dm >= 40) { const a = this.actors[id]; a.assists++; a.score += 1; ast.push(id); } }
      this.ev({ k: 'kill', a: att ? att.id : -1, v: v.id, h: head ? 1 : 0, w: wid, ast, dist: att ? Math.round(d2(att.pos, v.pos)) : 0 });
      if (!valid) return;
      att.kills++; att.score += 2 + (head ? 1 : 0); this.scores[att.team]++; this.addStreak(att);
      if (this.scores[att.team] >= TDM.goal) this.endTDM(att.team);
    }
    endTDM(team) {
      if (this.phase === 'over') return; this.phase = 'over'; this.phaseEnd = this.now + ROUND.over;
      this.ev({ k: 'mend', tdm: 1, w: team, sc: this.scores.slice(), t: ROUND.over, next: this.rotate !== false ? this.nextMapId() : this.mapId }); this.rosterDirty = true;
    }
    /* --- escalada de armas --- */
    startGG() {
      this.round = 1; this.phase = 'live'; this.phaseEnd = this.now + GG_TIME; this.liveStart = this.now;
      this.drops = []; this.nades = []; this.smokes = [];
      this.bomb = { st: 'none', by: -1, x: 0, y: 0, z: 0, site: null, explodeAt: 0, pp: 0, dp: 0, planter: -1, defuser: -1 };
      for (const a of this.actors) { a.lvl = 0; a.alive = false; }
      for (const a of this.actors) this.spawnGG(a);
      this.ev({ k: 'gg', t: GG_TIME, n: LADDER.length }); this.rosterDirty = true;
    }
    equipGG(a) {
      const w = LADDER[clamp(a.lvl | 0, 0, LADDER.length - 1)];
      a.inv = { p: null, s: null, n: { he: 0, fl: 0, sm: 0 } };
      if (w !== 'knife') { if (WEAPONS[w].slot === 1) a.inv.p = w; else a.inv.s = w; }
      a.cur = w; a.ammo = WEAPONS[w].mag || 0; a.reloadT = 0; a.armor = 100; a.helmet = true; a.kit = false; a.pdirty = true;
    }
    ggPoints() {
      if (this._gp) return this._gp; const W = this.W; const pts = [...this.M.spawns.atk, ...this.M.spawns.def]; let tries = 0;
      while (pts.length < 70 && tries++ < 8000) {
        const k = (Math.random() * W.walk.length) | 0; if (!W.walk[k]) continue; let ok = true;
        for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) { const q = k + dj * W.GW + di; if (q < 0 || q >= W.walk.length || !W.walk[q]) { ok = false; break; } }
        if (ok) pts.push([W.GX0 + (k % W.GW) + .5, W.GZ0 + ((k / W.GW) | 0) + .5]);
      }
      return (this._gp = pts);
    }
    spawnGG(a) {
      let best = null, bs = -1e9;
      for (const p of this.ggPoints()) { let md = 60; for (const t of this.actors) if (t.alive && t !== a && t.team !== a.team) md = Math.min(md, Math.hypot(t.pos.x - p[0], t.pos.z - p[1])); const sc = Math.min(md, 30) + Math.random() * 12; if (sc > bs) { bs = sc; best = p; } }
      this.equipGG(a); this.spawn(a, best);
    }
    endGG(w) {
      if (this.phase === 'over') return; this.phase = 'over'; this.phaseEnd = this.now + ROUND.over;
      this.ev({ k: 'mend', gg: 1, win: w ? w.id : -1, w: w ? w.team : -1, sc: this.scores.slice(), t: ROUND.over, next: this.rotate !== false ? this.nextMapId() : this.mapId }); this.rosterDirty = true;
    }
    resetLoadout(a, full) {
      a.inv = { p: null, s: 'p9', n: { he: 0, fl: 0, sm: 0 } }; a.cur = 'p9'; a.kit = false;
      if (full) { a.armor = 0; a.helmet = false; }
      a.pdirty = true;
    }
    startRound() {
      this.round++;
      if (this.round === ROUND.half + 1) {
        this.swap = true; this.lossStreak = { atk: 0, def: 0 };
        for (const a of this.actors) { this.resetLoadout(a, true); a.money = MONEY.start; }
        this.ev({ k: 'half' });
      }
      this.phase = 'buy'; this.phaseEnd = this.now + (this.round === 1 || this.round === ROUND.half + 1 ? ROUND.buyFirst : ROUND.buy);
      this.drops = []; this.nades = []; this.smokes = []; this.liveStart = 1e9; this.reveal = [0, 0];
      for (const a of this.actors) {
        a.streak = 0;
        if (!a.alive) this.resetLoadout(a, true);
        if (!a.inv.s && !a.inv.p) a.inv.s = 'p9';
        a.cur = a.inv.p || a.inv.s || 'knife';
        this.spawn(a);
        a.snap = { inv: JSON.parse(JSON.stringify(a.inv)), armor: a.armor, helmet: a.helmet, kit: a.kit, money: a.money, cur: a.cur };
      }
      // carga explosiva a un terrorista (solo en modo con carga)
      const atks = this.actors.filter(a => this.side(a.team) === 'atk');
      const carrier = atks[(Math.random() * atks.length) | 0];
      this.bomb = { st: this.mode === 'bomb' ? 'carried' : 'none', by: this.mode === 'bomb' ? carrier.id : -1, x: 0, y: 0, z: 0, site: null, explodeAt: 0, pp: 0, dp: 0, planter: -1, defuser: -1 };
      this.plan = { site: Math.random() < .5 ? 'A' : 'B' };
      for (const a of this.actors) if (!a.human) this.botBuy(a);
      this.assignBots();
      this.ev({ k: 'round', n: this.round, s0: this.side(0), t: r2(this.phaseEnd - this.now) });
      this.rosterDirty = true;
    }
    spawn(a, at) {
      a.mvT = undefined; a.mvB = 3; a.mags = {}; a.rlW = null; a.mvIgnore = this.now + .35;
      const side = this.side(a.team); const pts = this.M.spawns[side]; const i = this.actors.filter(x => x.team === a.team).indexOf(a);
      const [x, z] = at || pts[i % pts.length];
      a.pos = V(x + rand(-.3, .3), 0, z + rand(-.3, .3)); a.vel = V(); a.hp = 100; a.alive = true; a.h = 1.8; a.crouch = false; a.damagers.clear();
      const cx = (this.M.bounds[0] + this.M.bounds[2]) / 2, cz = (this.M.bounds[1] + this.M.bounds[3]) / 2;
      a.yaw = Math.atan2(-(cx - a.pos.x), -(cz - a.pos.z)); a.pitch = 0; a.target = null; a.path = null; a.goalKey = ''; a.lastKnown = null; a.lastHit = -99; a.blindUntil = 0; a.act = false; a.planting = false; a.dmgRound = 0;
      a.ammo = WEAPONS[a.cur] ? WEAPONS[a.cur].mag : 0; a.reloadT = 0; a.pdirty = true; a.protectUntil = this.now + (this.mode === 'gg' ? 1.6 : this.mode === 'tdm' ? TDM.protect : 0);
      this.ev({ k: 'sp', v: a.id, p: [r2(a.pos.x), 0, r2(a.pos.z)], y: r2(a.yaw) });
    }
    endRound(winSide, reason) {
      if (this.phase === 'post' || this.phase === 'over') return;
      const wt = this.teamOfSide(winSide), lt = 1 - wt, loseSide = winSide === 'atk' ? 'def' : 'atk';
      this.scores[wt]++;
      const winCash = reason === 'bomb' || reason === 'defuse' ? MONEY.winObj : MONEY.winElim;
      const lossCash = Math.min(MONEY.lossMax, MONEY.lossBase + MONEY.lossStep * this.lossStreak[loseSide]);
      this.lossStreak[winSide] = Math.max(0, this.lossStreak[winSide] - 1); this.lossStreak[loseSide] = Math.min(4, this.lossStreak[loseSide] + 1);
      for (const a of this.actors) {
        let m = a.team === wt ? winCash : lossCash;
        if (a.team === lt && loseSide === 'atk' && this.bomb.st === 'planted') m += MONEY.plantTeam;
        this.give(a, m);
      }
      this.phase = 'post'; this.phaseEnd = this.now + ROUND.post;
      const over = this.scores[wt] >= ROUND.win || this.round >= ROUND.total;
      this.ev({ k: 'rend', w: wt, side: winSide, why: reason, sc: this.scores.slice(), over: over ? 1 : 0 });
      if (over) { this.phase = 'over'; this.phaseEnd = this.now + ROUND.over; const win = this.scores[0] === this.scores[1] ? -1 : (this.scores[0] > this.scores[1] ? 0 : 1); this.ev({ k: 'mend', w: win, sc: this.scores.slice(), t: ROUND.over, next: this.rotate !== false ? this.nextMapId() : this.mapId }); }
      this.rosterDirty = true;
    }
    give(a, m) { a.money = clamp(a.money + m, 0, MONEY.max); a.pdirty = true; }

    /* --- jugadores humanos --- */
    sideHumans(side) { let n = 0; for (const a of this.actors) if (a.human && this.side(a.team) === side) n++; return n; }
    addHuman(cid, name, pref, camo) {
      this.lastErr = '';
      if (this.clients.size >= 8) { this.lastErr = 'full'; return null; }
      const hum = [0, 0]; for (const a of this.actors) if (a.human) hum[a.team]++;
      let team = hum[0] <= hum[1] ? 0 : 1;
      const forced = pref === 'atk' || pref === 'def';
      if (forced) { team = this.teamOfSide(pref); if (hum[team] >= 4) { this.lastErr = 'side'; return null; } }
      let a = this.actors.find(x => x.team === team && !x.human && !x.alive) || this.actors.find(x => x.team === team && !x.human);
      if (!a && !forced) { team = 1 - team; a = this.actors.find(x => x.team === team && !x.human); }
      if (!a) { this.lastErr = 'full'; return null; }
      a.human = cid; a.joinedAt = this.now; a.joinedRound = this.round; a.mvT = undefined; a.mvB = 3; a.mags = {}; a.name = name; a.kills = a.deaths = a.assists = a.score = 0; a.target = null; a.path = null; a.act = false; a.camo = CAMOS.some(c => c.id === camo) ? camo : null;
      if (this.mode === 'gg') { a.lvl = 0; this.equipGG(a); }
      else if (this.mode === 'tdm') { a.tdmGun = null; this.equipTDM(a); }
      else if (this.mode === 'range') { a.inv = { p: 'ar', s: 'p9', n: { he: 1, fl: 1, sm: 1 } }; a.cur = 'ar'; a.money = 99999; this.spawn(a, this.M.spawns.atk[0]); a.yaw = 0; }
      else if (this.phase === 'buy' && a.snap && a.humanRound !== this.round) { Object.assign(a, { inv: JSON.parse(JSON.stringify(a.snap.inv)), armor: a.snap.armor, helmet: a.snap.helmet, kit: a.snap.kit, money: a.snap.money, cur: a.snap.cur }); }
      this.clients.set(cid, a.id);
      if (a.alive) this.ev({ k: 'sp', v: a.id, p: [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z)], y: r2(a.yaw) });
      a.pdirty = true; this.ev({ k: 'join', id: a.id, n: name }); this.rosterDirty = true;
      return a;
    }
    removeHuman(cid) {
      const id = this.clients.get(cid); if (id == null) return; this.clients.delete(cid); this.votes.delete(cid); this.actors[id].humanRound = this.round;
      const a = this.actors[id]; const n = a.name; a.human = null; a.camo = null; a.name = BOT_NAMES[a.team][a.slot]; a.act = false; a.path = null; a.goalKey = '';
      a.kills = a.deaths = a.assists = a.score = 0; a.cur = a.inv.p || a.inv.s || 'knife'; a.ammo = WEAPONS[a.cur].mag;
      this.ev({ k: 'leave', id, n }); this.rosterDirty = true;
    }
    canBuy(a) {
      if (this.mode === 'range') return a.alive;
      if (!a.alive || this.mode === 'gg' || this.mode === 'tdm') return false;
      const zone = this.M.buy[this.side(a.team)];
      return (this.phase === 'buy' || (this.phase === 'live' && this.now - this.liveStart < ROUND.buyWindow)) && inRect(zone, a.pos.x, a.pos.z);
    }
    buy(a, item) {
      if (!this.canBuy(a)) return false;
      const side = this.side(a.team);
      if (typeof item !== 'string') return false;
      const w = has(WEAPONS, item) ? WEAPONS[item] : null;
      if (w && w.price && !w.melee) {
        if (a.money < w.price) return false;
        const slot = w.slot === 1 ? 'p' : 's';
        if (a.inv[slot] === item) return false;
        if (a.inv[slot]) this.dropWeapon(a, a.inv[slot]);
        a.money -= w.price; a.inv[slot] = item; a.cur = item; a.ammo = w.mag; a.pdirty = true; return true;
      }
      const n = (has(NADES, item) && NADES[item]);
      if (n) {
        const tot = a.inv.n.he + a.inv.n.fl + a.inv.n.sm;
        if (a.money < n.price || a.inv.n[item] >= n.max || tot >= 4) return false;
        a.money -= n.price; a.inv.n[item]++; a.pdirty = true; return true;
      }
      if (item === 'kevlar') { if (a.armor >= 100 || a.money < 650) return false; a.money -= 650; a.armor = 100; a.pdirty = true; return true; }
      if (item === 'helm') { const p = a.armor >= 100 ? 350 : 1000; if ((a.helmet && a.armor >= 100) || a.money < p) return false; a.money -= p; a.armor = 100; a.helmet = true; a.pdirty = true; return true; }
      if (item === 'kit') { if (side !== 'def' || a.kit || a.money < 400) return false; a.money -= 400; a.kit = true; a.pdirty = true; return true; }
      return false;
    }
    inBounds(p) { const B = this.M.bounds; p.x = clamp(p.x, B[0] + .6, B[2] - .6); p.z = clamp(p.z, B[1] + .6, B[3] - .6); }
    dropWeapon(a, wid, fwd) {
      if (!wid || wid === 'knife') return;
      const slot = WEAPONS[wid].slot === 1 ? 'p' : 's';
      if (a.inv[slot] === wid) a.inv[slot] = null;
      const f = fwd ? 1.3 : .2; const x = a.pos.x - Math.sin(a.yaw) * f, z = a.pos.z - Math.cos(a.yaw) * f;
      const p = { x, z, y: 0 }; this.W.resolve({ pos: p, h: .3 }); this.inBounds(p);
      this.drops.push({ id: nextEnt++, w: wid, x: r2(p.x), y: r2(this.W.groundAt(p.x, p.z, a.pos.y + .3)), z: r2(p.z), t: this.now });
      if (a.cur === wid) a.cur = a.inv.p || a.inv.s || 'knife';
      a.pdirty = true;
    }
    // Movimiento del cliente con validación: presupuesto de velocidad, sin cruzar paredes y sin volar
    applyMove(a, cid, x, y, z) {
      const B = this.M.bounds; x = clamp(x, B[0] + .4, B[2] - .4); z = clamp(z, B[1] + .4, B[3] - .4);
      const el = Math.min(1, Math.max(0, this.now - (a.mvT === undefined ? this.now : a.mvT))); a.mvT = this.now;
      const vmax = ((WEAPONS[a.cur] && WEAPONS[a.cur].speed) || 5.4) * 1.45 + .6;
      a.mvB = Math.min(3, (a.mvB === undefined ? 3 : a.mvB) + vmax * el);
      let dx = x - a.pos.x, dz = z - a.pos.z; const d = Math.hypot(dx, dz);
      if (d > a.mvB) { const k = a.mvB / d; dx *= k; dz *= k; a.mvFix = (a.mvFix || 0) + 1; }
      const nx = a.pos.x + dx, nz = a.pos.z + dz;
      if (d > .05) { const ys = [.5, 1.05, 1.6]; if (ys.every(h => !this.W.visible([a.pos.x, a.pos.y + h, a.pos.z], [nx, y + h, nz]))) { a.mvFix = (a.mvFix || 0) + 3; this.fixPos(a, cid); return; } }
      a.mvB -= Math.hypot(dx, dz);
      const g = this.W.groundAt(nx, nz, Math.max(0, y));
      a.pos.x = nx; a.pos.z = nz; a.pos.y = clamp(y, g - .05, g + 1.7); a.grounded = a.pos.y - g < .12;
      if ((a.mvFix || 0) >= 6) this.fixPos(a, cid);
    }
    fixPos(a, cid) { a.mvFix = 0; this.onSend(cid, { t: 'fix', p: [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z)] }); }
    message(cid, m) {
      const id = this.clients.get(cid); if (id == null || !m || typeof m !== 'object') return; const a = this.actors[id];
      switch (m.t) {
        case 'in': {
          if (!a.alive || !Array.isArray(m.p) || !Array.isArray(m.v)) return;
          if (this.phase !== 'buy' && this.now >= (a.mvIgnore || 0)) this.applyMove(a, cid, num(m.p[0], a.pos.x), num(m.p[1], a.pos.y), num(m.p[2], a.pos.z));
          a.vel.x = clamp(num(m.v[0]), -8, 8); a.vel.y = clamp(num(m.v[1]), -20, 9); a.vel.z = clamp(num(m.v[2]), -8, 8);
          a.yaw = ((num(m.y, a.yaw) % TAU) + TAU) % TAU; a.pitch = clamp(num(m.pi), -1.5, 1.5); a.h = clamp(num(m.h, 1.8), 1.2, 1.8); a.crouch = a.h < 1.6; a.walking = !!m.w;
          a.act = !!m.act; break;
        }
        case 'shot': this.humanShot(a, m); break;
        case 'eq': { const w = String(m.w || ''); if (w === 'knife' || a.inv.p === w || a.inv.s === w || (has(NADES, w) && a.inv.n[w] > 0)) a.cur = w; break; }
        case 'buy': if (this.buy(a, String(m.i || ''))) this.ev({ k: 'bought', v: a.id, i: String(m.i) }); break;
        case 'drop': if (this.mode === 'gg' || this.mode === 'tdm') return; if (a.alive && (a.cur === a.inv.p || a.cur === a.inv.s)) this.dropWeapon(a, a.cur, true); else if (a.alive && this.bomb.st === 'carried' && this.bomb.by === a.id && m.bomb) this.dropBomb(a, true); break;
        case 'nade': this.throwNade(a, m); break;
        case 'rl': { const w = WEAPONS[a.cur]; if (a.alive && w && w.mag && !w.melee) { a.rlW = a.cur; a.rlEnd = this.now + w.reload * .8; } break; }
        case 'chat': {
          if (this.now - (a.chatT === undefined ? -9 : a.chatT) < .8) return; a.chatT = this.now;
          const msg = String(m.m || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90); if (!msg) return;
          this.ev({ k: 'chat', v: a.id, tm: a.team, m: msg }); break;
        }
        case 'vote': { if (this.phase !== 'over' || !has(MAPS, m.map) || MAPS[m.map].hidden || this.now - (a.voteT === undefined ? -9 : a.voteT) < .5) return; a.voteT = this.now; this.votes.set(cid, m.map); this.ev({ k: 'votes', v: this.tally() }); break; }
        case 'radio': { const c = m.c | 0; if (c < 0 || c >= RADIO.length || this.now - (a.radioT === undefined ? -9 : a.radioT) < 1) return; a.radioT = this.now; this.ev({ k: 'radio', v: a.id, tm: a.team, c }); break; }
        case 'ping': {
          if (!a.alive || !Array.isArray(m.p) || this.now - (a.pingT === undefined ? -9 : a.pingT) < .6) return; a.pingT = this.now;
          const e = typeof m.e === 'number' && this.actors[m.e | 0] && this.actors[m.e | 0].team !== a.team ? m.e | 0 : -1;
          this.ev({ k: 'ping', v: a.id, tm: a.team, p: [r2(num(m.p[0])), r2(num(m.p[1])), r2(num(m.p[2]))], e }); break;
        }
      }
    }
    humanShot(a, m) {
      if (!a.alive || this.phase === 'buy' || this.phase === 'over' || !Array.isArray(m.o) || !Array.isArray(m.d)) return;
      const wid = String(m.w || ''); const w = has(WEAPONS, wid) ? WEAPONS[wid] : null;
      if (!w || !(wid === 'knife' || a.inv.p === wid || a.inv.s === wid)) return;
      if (this.now - a.lastShot < 60 / w.rpm * .7) return;
      if (!w.melee && w.mag) {
        const mg = a.mags || (a.mags = {}); if (mg[wid] === undefined) mg[wid] = w.mag;
        if (a.rlW === wid) { if (this.now >= a.rlEnd) { mg[wid] = w.mag; a.rlW = null; } else return; }
        if (mg[wid] <= 0) { if (this.now - a.lastShot > w.reload * .8) mg[wid] = w.mag; else return; }
        mg[wid]--;
      }
      a.lastShot = this.now; a.cur = wid; if (!w.melee) a.firedAt = this.now;
      let o = [num(m.o[0]), num(m.o[1]), num(m.o[2])]; const eye = eyeOf(a);
      // el origen que manda el cliente debe estar cerca del ojo y sin pared de por medio
      if (Math.hypot(o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]) > 1.5 || !this.W.visible(eye, o)) o = eye;
      const rays = w.pellets && Array.isArray(m.pel) ? m.pel.slice(0, w.pellets) : [m];
      const dmgBy = new Map(); let first = null;
      for (const r of rays) {
        if (!r || !Array.isArray(r.d)) continue;
        const d = [num(r.d[0]), num(r.d[1]), num(r.d[2], -1)]; const L = Math.hypot(d[0], d[1], d[2]) || 1; d[0] /= L; d[1] /= L; d[2] /= L;
        const tt = clamp(num(r.tt, 160), 0, w.melee ? 2.4 : 200);
        const end = [o[0] + d[0] * tt, o[1] + d[1] * tt, o[2] + d[2] * tt];
        let ok = false, zone = 'c'; const v = (typeof r.hit === 'number') ? this.actors[r.hit | 0] : null;
        if (v && v.alive && v.team !== a.team) {
          const tol = 1.3 + Math.hypot(v.vel.x, v.vel.z) * .3; const hy = end[1] - v.pos.y;
          if (Math.hypot(end[0] - v.pos.x, end[2] - v.pos.z) < tol && hy > -.5 && hy < v.h + .6 && this.W.visible(o, end) && this.exposed(o, v)) {
            ok = true; zone = ['h', 'c', 'l'].includes(r.z) ? r.z : 'c'; if (zone === 'h' && hy < v.h - .5) zone = 'c';
          }
        }
        if (ok) { const cur = dmgBy.get(v) || { dmg: 0, zone: 'l' }; cur.dmg += weaponDamage(w, tt, zone, v, !!m.alt); if (zone === 'h' || (zone === 'c' && cur.zone === 'l')) cur.zone = zone; dmgBy.set(v, cur); }
        if (!first) first = { end, n: !ok && Array.isArray(r.n) ? [num(r.n[0]), num(r.n[1]), num(r.n[2])] : 0, hit: ok };
      }
      for (const [v, x] of dmgBy) this.damage(v, a, x.dmg, x.zone, wid);
      if (!first) return;
      if (!w.melee) { this.ev({ k: 'shot', s: a.id, w: wid, e: first.end.map(r2), n: first.n, hit: first.hit ? 1 : 0 }); this.alert(a, 40); }
      else this.ev({ k: 'slash', s: a.id, hit: first.hit ? 1 : 0 });
    }
    // ¿Alguna parte del cuerpo de v (en su posición actual en el servidor) se ve desde o? Evita impactos a través de paredes
    exposed(o, v) {
      const x = v.pos.x, y = v.pos.y, z = v.pos.z, h = v.h;
      for (const p of [[x, y + h - .12, z], [x, y + h * .62, z], [x, y + .35, z], [x + .3, y + h * .62, z], [x - .3, y + h * .62, z], [x, y + h * .62, z + .3], [x, y + h * .62, z - .3], [x + .25, y + .35, z], [x - .25, y + .35, z]])
        if (this.W.visible(o, p)) return true;
      return false;
    }
    alert(sh, R) { for (const b of this.actors) { if (b.human || !b.alive || b.team === sh.team || b.target) continue; if (d2(b.pos, sh.pos) < R) { b.lastKnown = V(sh.pos.x, sh.pos.y, sh.pos.z); b.lastKnownT = this.now; } } }

    /* --- daño --- */
    damage(v, att, dmg, zone, wid) {
      if (!v.alive || this.phase === 'over' || this.now < (v.protectUntil || 0)) return;
      const real = Math.min(v.hp, dmg);
      v.hp -= dmg; v.lastHit = this.now; v.damagers.set(att.id, (v.damagers.get(att.id) || 0) + real); att.dmgRound += real;
      if (!v.human) { v.alertUntil = this.now + 1.8; if (!v.target) { v.lastKnown = V(att.pos.x, att.pos.y, att.pos.z); v.lastKnownT = this.now; } }
      const kill = v.hp <= 0;
      this.ev({ k: 'hit', a: att.id, v: v.id, z: zone, x: kill ? 1 : 0, d: Math.round(real) });
      v.pdirty = true;
      if (kill) this.kill(v, att, zone === 'h', wid);
    }
    kill(v, att, head, wid) {
      v.alive = false; v.hp = 0; v.deaths++; v.act = false; v.planting = false;
      if (this.mode === 'gg') return this.killGG(v, att, head, wid);
      if (this.mode === 'tdm') return this.killTDM(v, att, head, wid);
      v.streak = 0;
      if (att && att !== v && att.team !== v.team) {
        att.kills++; att.score += 2 + (head ? 1 : 0); this.addStreak(att);
        const w = WEAPONS[wid]; this.give(att, w ? w.kill : 300);
      }
      const ast = [];
      for (const [id, dm] of v.damagers) { if (att && id !== att.id && dm >= 40) { const a = this.actors[id]; a.assists++; a.score += 1; ast.push(id); } }
      // soltar arma principal (o secundaria) y la carga
      const gun = v.inv.p || (v.inv.s && v.inv.s !== 'p9' ? v.inv.s : null);
      if (gun) this.dropWeapon(v, gun);
      if (this.bomb.st === 'carried' && this.bomb.by === v.id) this.dropBomb(v);
      this.ev({ k: 'kill', a: att ? att.id : -1, v: v.id, h: head ? 1 : 0, w: wid, ast, dist: att ? Math.round(d2(att.pos, v.pos)) : 0 });
      this.rosterDirty = true; v.pdirty = true;
    }
    /* --- rachas de bajas: 3 radar, 5 blindaje y munición, 7 dron --- */
    addStreak(a) {
      if (this.mode === 'gg' || !a.alive) return; a.streak = (a.streak || 0) + 1; const n = a.streak, S = STREAKS[n]; if (!S) return;
      if (S.reveal) { this.reveal[a.team] = Math.max(this.reveal[a.team], this.now + S.reveal); this.tipBots(a.team); }
      if (S.id === 'kit') { a.armor = 100; a.helmet = true; a.mags = {}; a.hp = Math.min(100, a.hp + 25); a.pdirty = true; }
      this.ev({ k: 'streak', v: a.id, tm: a.team, n, r: S.id, d: S.reveal || 0 });
    }
    // los bots del equipo que tiene el radar reciben la posición del enemigo más cercano
    tipBots(team) {
      for (const b of this.actors) { if (b.human || !b.alive || b.team !== team || b.target) continue; let n = null, nd = 1e9; for (const t of this.actors) { if (t.alive && t.team !== team) { const d = d2(t.pos, b.pos); if (d < nd) { nd = d; n = t; } } } if (n && nd < 45) { b.lastKnown = V(n.pos.x, n.pos.y, n.pos.z); b.lastKnownT = this.now; } }
    }
    killGG(v, att, head, wid) {
      v.respawnAt = this.now + 2; v.pdirty = true; this.rosterDirty = true;
      const valid = att && att !== v && att.team !== v.team;
      this.ev({ k: 'kill', a: att ? att.id : -1, v: v.id, h: head ? 1 : 0, w: wid, ast: [], dist: att ? Math.round(d2(att.pos, v.pos)) : 0 });
      if (!valid) return;
      att.kills++; att.score += 2 + (head ? 1 : 0); this.scores[att.team]++;
      const last = LADDER.length - 1;
      if (wid === 'knife' && att.lvl >= last) { this.endGG(att); return; }
      if (wid === 'knife' && v.lvl > 0) { v.lvl--; this.ev({ k: 'demote', v: v.id, a: att.id, l: v.lvl }); }
      if (wid === LADDER[att.lvl]) { att.lvl++; this.equipGG(att); this.ev({ k: 'lvl', v: att.id, l: att.lvl, w: LADDER[att.lvl] }); }
    }
    dropBomb(a, thrown) {
      const f = thrown ? 1.3 : 0; const x = a.pos.x - Math.sin(a.yaw) * f, z = a.pos.z - Math.cos(a.yaw) * f; const p = { x, z, y: 0 }; this.W.resolve({ pos: p, h: .3 }); this.inBounds(p);
      Object.assign(this.bomb, { st: 'dropped', by: -1, x: r2(p.x), y: r2(this.W.groundAt(p.x, p.z, a.pos.y + .3)), z: r2(p.z), dropT: this.now });
      this.ev({ k: 'bdrop', v: a.id }); a.pdirty = true;
    }

    /* --- granadas --- */
    throwNade(a, m) {
      const k = String(m.k || ''); if (!has(NADES, k) || !a.alive || a.inv.n[k] <= 0 || this.phase === 'buy' || this.phase === 'over') return;
      if (!Array.isArray(m.d)) return;
      const d = [num(m.d[0]), num(m.d[1]), num(m.d[2], -1)]; const L = Math.hypot(d[0], d[1], d[2]) || 1;
      const sp = m.lob ? 7.5 : 15; const eye = eyeOf(a);
      a.inv.n[k]--; a.pdirty = true; if (a.cur === k && a.inv.n[k] <= 0) a.cur = a.inv.p || a.inv.s || 'knife';
      this.spawnNade(a, k, eye, [d[0] / L * sp + a.vel.x * .6, d[1] / L * sp + 2.2, d[2] / L * sp + a.vel.z * .6]);
    }
    spawnNade(a, k, eye, v) {
      this.nades.push({ id: nextEnt++, k, by: a.id, team: a.team, p: V(eye[0], eye[1] - .1, eye[2]), v: V(v[0], v[1], v[2]), t: 0, still: 0 });
      this.ev({ k: 'throw', s: a.id, g: k });
    }
    stepNades(dt) {
      const out = [];
      for (const g of this.nades) {
        const steps = 3, h = dt / steps; let gone = false;
        for (let s = 0; s < steps && !gone; s++) {
          g.v.y -= 14 * h; const np = V(g.p.x + g.v.x * h, g.p.y + g.v.y * h, g.p.z + g.v.z * h);
          const inside = (x, y, z) => this.W.colliders.some(b => x > b.minX - .06 && x < b.maxX + .06 && y > b.minY - .06 && y < b.maxY + .06 && z > b.minZ - .06 && z < b.maxZ + .06);
          let bounced = false;
          if (inside(np.x, g.p.y, g.p.z)) { g.v.x *= -.45; np.x = g.p.x; bounced = true; }
          if (inside(np.x, g.p.y, np.z)) { g.v.z *= -.45; np.z = g.p.z; bounced = true; }
          if (inside(np.x, np.y, np.z)) { g.v.y *= -.35; np.y = g.p.y; g.v.x *= .7; g.v.z *= .7; bounced = true; }
          if (np.y < .08) { np.y = .08; g.v.y = Math.abs(g.v.y) > 1.5 ? -g.v.y * .35 : 0; g.v.x *= .72; g.v.z *= .72; bounced = true; }
          if (bounced) { const sp = Math.hypot(g.v.x, g.v.y, g.v.z); if (sp > 2 && this.tickN % 2 === 0) this.ev({ k: 'bounce', p: [r2(np.x), r2(np.y), r2(np.z)] }); }
          g.p = np;
        }
        g.t += dt; const speed = Math.hypot(g.v.x, g.v.y, g.v.z);
        if (g.k === 'sm' ? (g.t > 1.2 && speed < .8) || g.t > 3.5 : g.t >= 1.6) { this.detonate(g); gone = true; }
        if (!gone) out.push(g);
      }
      this.nades = out;
      this.smokes = this.smokes.filter(s => s.until > this.now);
    }
    detonate(g) {
      const p = g.p; const owner = this.actors[g.by];
      if (g.k === 'he') {
        this.ev({ k: 'boomhe', p: [r2(p.x), r2(p.y), r2(p.z)] });
        for (const a of this.actors) {
          if (!a.alive) continue; const dist = Math.hypot(a.pos.x - p.x, a.pos.y + 1 - p.y, a.pos.z - p.z); if (dist > 7.5) continue;
          if (!this.W.visible([p.x, p.y + .3, p.z], [a.pos.x, a.pos.y + 1.1, a.pos.z])) continue;
          if (a.team === g.team && a !== owner) continue;
          let dm = 98 * Math.pow(1 - dist / 7.5, 1.4); if (a.armor > 0) { dm *= .55; a.armor = Math.max(0, a.armor - dm * .3); }
          this.damage(a, owner, dm, 'c', 'he');
        }
        this.alert(owner, 30);
      } else if (g.k === 'fl') {
        this.ev({ k: 'flash', p: [r2(p.x), r2(p.y), r2(p.z)] });
        for (const a of this.actors) {
          if (!a.alive || a.human) continue; const e = eyeOf(a); const dist = Math.hypot(e[0] - p.x, e[1] - p.y, e[2] - p.z); if (dist > 22) continue;
          if (!this.W.visible(e, [p.x, p.y, p.z], this.smokes)) continue;
          const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw); const dot = ((p.x - e[0]) * fx + (p.z - e[2]) * fz) / (dist || 1);
          const k = (dot > .3 ? 1 : dot > -.2 ? .45 : .15) * (1 - dist / 22);
          if (k > .1) { a.blindUntil = this.now + .4 + k * 3; a.target = null; }
        }
      } else {
        const y = Math.max(1.4, p.y);
        this.smokes.push({ id: g.id, x: p.x, y, z: p.z, r: 3.4, until: this.now + 16 });
        this.ev({ k: 'smoke', id: g.id, p: [r2(p.x), r2(p.y), r2(p.z)], d: 16 });
      }
    }

    /* --- carga explosiva --- */
    bombTick(dt) {
      const B = this.bomb;
      if (B.st === 'dropped') {
        for (const a of this.actors) if (a.alive && this.side(a.team) === 'atk' && Math.hypot(a.pos.x - B.x, a.pos.z - B.z) < 1.1 && this.now - (B.dropT || 0) > .6) { B.st = 'carried'; B.by = a.id; a.pdirty = true; this.ev({ k: 'bpick', v: a.id }); break; }
      }
      if (this.phase !== 'live') return;
      if (B.st === 'carried') {
        const a = this.actors[B.by]; const site = a && this.siteAt(a.pos.x, a.pos.z);
        const wants = a && a.alive && (a.human ? a.act : a.planting);
        if (wants && site && a.grounded && Math.hypot(a.vel.x, a.vel.z) < 1.2) {
          if (B.planter !== a.id) { B.planter = a.id; B.pp = 0; this.ev({ k: 'planting', v: a.id }); }
          B.pp += dt;
          if (B.pp >= ROUND.plant) {
            Object.assign(B, { st: 'planted', by: -1, x: r2(a.pos.x), y: r2(this.W.groundAt(a.pos.x, a.pos.z, a.pos.y + .1)), z: r2(a.pos.z), site, explodeAt: this.now + ROUND.fuse, pp: 0, planter: -1 });
            this.give(a, MONEY.plant); a.score += 2; a.planting = false; a.pdirty = true;
            this.ev({ k: 'plant', v: a.id, site, p: [B.x, B.y, B.z] });
            for (const b of this.actors) if (!b.human && b.alive) { b.goalKey = ''; b.path = null; }
          }
        } else { B.planter = -1; B.pp = 0; }
      } else if (B.st === 'planted') {
        let defuser = null;
        for (const a of this.actors) {
          if (!a.alive || this.side(a.team) !== 'def') continue;
          const near = Math.hypot(a.pos.x - B.x, a.pos.z - B.z) < 1.7 && a.pos.y - B.y < 1.5 && B.y - a.pos.y < 2.7;
          const wants = a.human ? a.act : a.planting;
          if (near && wants) { defuser = a; break; }
        }
        if (defuser) {
          if (B.defuser !== defuser.id) { B.defuser = defuser.id; B.dp = 0; B.dneed = defuser.kit ? ROUND.defuseKit : ROUND.defuse; this.ev({ k: 'defusing', v: defuser.id, kit: defuser.kit ? 1 : 0 }); }
          B.dp += dt;
          if (B.dp >= B.dneed) { B.st = 'defused'; defuser.score += 2; this.ev({ k: 'defused', v: defuser.id }); this.endRound('def', 'defuse'); return; }
        } else { B.defuser = -1; B.dp = 0; }
        if (this.now >= B.explodeAt) {
          B.st = 'exploded'; this.ev({ k: 'boom', p: [B.x, B.y, B.z] });
          for (const a of this.actors) { if (!a.alive) continue; const d = Math.hypot(a.pos.x - B.x, a.pos.z - B.z); if (d < 16) { const dm = d < 8 ? 500 : 140 * (1 - (d - 8) / 8); a.hp -= dm; a.lastHit = this.now; if (a.hp <= 0) this.kill(a, null, false, 'bomb'); } }
          this.endRound('atk', 'bomb');
        }
      }
    }
    siteAt(x, z) { for (const k in this.M.sites) if (inRect(this.M.sites[k].r, x, z)) return k; return null; }

    /* ================= BOTS ================= */
    botBuy(b) {
      const side = this.side(b.team); let m = b.money;
      const buy = (i) => this.buy(b, i);
      const eco = m < 2000 && this.round !== 1 && this.round !== ROUND.half + 1;
      if (!b.inv.p) {
        if (m >= 4750 + 1000 && Math.random() < .18) buy('sr');
        else if (m >= 2700 + 650) buy('ar');
        else if (!eco && m >= 1250 + 650 && Math.random() < .7) buy('smg');
      }
      if (!b.inv.p) {
        const r = Math.random();
        if (b.money >= 5200 + 1000 && r < .08) buy('lmg');
        else if (b.money >= 2050 + 650 && r < .3) buy('fr9');
        else if (b.money >= 1700 + 650 && r < .15) buy('tr7');
        else if (!eco && b.money >= 1100 + 650 && r < .25) buy('es12');
      }
      if (!b.inv.p && b.inv.s === 'p9' && b.money >= 500 && Math.random() < .25) buy('ap18');
      if (b.helmet && b.armor >= 100) { } else if (b.money >= 1000 && b.inv.p) buy('helm'); else if (b.money >= 650 && (b.inv.p || this.round === 1 || this.round === ROUND.half + 1)) buy('kevlar');
      if (!b.inv.p && b.inv.s === 'p9' && b.money >= 700 && Math.random() < .35) buy('r50');
      if (side === 'def' && b.money >= 400 && b.inv.p) buy('kit');
      if (b.money >= 300 && b.inv.p && Math.random() < .6) buy('he');
      if (b.money >= 300 && b.inv.p && Math.random() < .5) buy('sm');
      if (b.money >= 200 && b.inv.p && Math.random() < .5) buy('fl');
      b.cur = b.inv.p || b.inv.s || 'knife'; b.ammo = WEAPONS[b.cur].mag;
    }
    assignBots() {
      const defs = this.actors.filter(a => this.side(a.team) === 'def'), atks = this.actors.filter(a => this.side(a.team) === 'atk');
      defs.forEach((b, i) => { const site = i % 2 === 0 ? 'A' : 'B'; const hs = this.M.holds[site]; b.holdSite = site; b.hold = hs[(i >> 1) % hs.length]; b.route = null; });
      const site = this.plan.site; const routes = this.M.routes[site];
      atks.forEach((b, i) => { b.route = routes[i % routes.length]; b.ri = 0; b.hold = null; b.holdSite = site; b.lurk = Math.random() < .2; b.staged = false; });
      this.execGo = false; this.stageAt = 0;
    }
    perceive(b) {
      const D = this.D; const e = eyeOf(b); let best = null, bd = 1e9;
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw); const alert = this.now < b.alertUntil;
      for (const t of this.actors) {
        if (t.team === b.team || !t.alive) continue;
        const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z; const dist = Math.hypot(dx, dz); if (dist > (this.cond.night ? 38 : this.cond.weather ? 46 : 80)) continue;
        const dot = (dx * fx + dz * fz) / (dist || 1);
        if (!(alert || dist < 5 || dot > .45)) continue;
        if (this.W.visible(e, [t.pos.x, t.pos.y + t.h * .72, t.pos.z], this.smokes) || this.W.visible(e, [t.pos.x, t.pos.y + t.h - .15, t.pos.z], this.smokes)) { const s = dist * (t === b.target ? .6 : 1); if (s < bd) { bd = s; best = t; } }
      }
      if (best) { if (best !== b.target) { if (!b.target && this.now > this.teamRadio[b.team] && this.phase === 'live') { this.teamRadio[b.team] = this.now + 7; this.ev({ k: 'radio', v: b.id, tm: b.team, c: 2 }); this.ev({ k: 'ping', v: b.id, tm: b.team, p: [r2(best.pos.x), r2(best.pos.y + 1), r2(best.pos.z)], e: best.id }); } b.target = best; b.seenT = 0; b.react = D.react * rand(.8, 1.3); } b.lastKnown = V(best.pos.x, best.pos.y, best.pos.z); b.lastKnownT = this.now; }
      else b.target = null;
    }
    goTo(b, x, z, key) {
      if (b.goalKey !== key || !b.path) { b.goalKey = key; b.path = this.W.findPath(b.pos.x, b.pos.z, x, z); b.pi = 0; b.stuckP = V(b.pos.x, 0, b.pos.z); b.stuckT = this.now; }
      if (!b.path || b.pi >= b.path.length) return true;
      const [wx, wz] = b.path[b.pi]; const dx = wx - b.pos.x, dz = wz - b.pos.z, d = Math.hypot(dx, dz);
      if (d < .6) { b.pi++; return b.pi >= b.path.length; }
      if (this.now - b.stuckT > 2) { if (d2(b.pos, b.stuckP) < .6) { b.path = null; } b.stuckP = V(b.pos.x, 0, b.pos.z); b.stuckT = this.now; }
      b.mx = dx / d; b.mz = dz / d; const dy = Math.atan2(-dx, -dz); b.yaw += clamp(angDiff(b.yaw, dy), -5 * this.dt, 5 * this.dt); b.pitch = lerp(b.pitch, 0, this.dt * 4);
      return false;
    }
    objective(b) {
      const side = this.side(b.team), B = this.bomb; b.mx = 0; b.mz = 0; b.walkSpeed = 4.6;
      if (this.mode === 'gg' || this.mode === 'tdm') {
        if (b.lastKnown && this.now - b.lastKnownT < 4) {
          let gx = b.lastKnown.x, gz = b.lastKnown.z;
          if (BOT_STYLE[b.id % BOT_STYLE.length] === 'flank') { const dx = gx - b.pos.x, dz = gz - b.pos.z, L = Math.hypot(dx, dz) || 1, sd = b.id % 2 ? 1 : -1; const k = this.W.nearestWalk(this.W.cIdx(gx - dz / L * 6 * sd, gz + dx / L * 6 * sd)); if (k >= 0 && L > 8) { gx = this.W.GX0 + (k % this.W.GW) + .5; gz = this.W.GZ0 + ((k / this.W.GW) | 0) + .5; } }
          this.goTo(b, gx, gz, 'lk' + Math.round(b.lastKnownT)); return;
        }
        let n = null, nd = 1e9; for (const t of this.actors) { if (t.alive && t.team !== b.team) { const d = d2(t.pos, b.pos); if (d < nd) { nd = d; n = t; } } }
        if (n) this.goTo(b, n.pos.x + rand(-4, 4), n.pos.z + rand(-4, 4), 'hunt' + n.id + Math.floor(this.now / 3)); else this.lookAround(b, b.yaw);
        return;
      }
      if (side === 'atk') {
        if (B.st === 'dropped') { const atks = this.actors.filter(a => a.alive && !a.human && this.side(a.team) === 'atk'); atks.sort((p, q) => Math.hypot(p.pos.x - B.x, p.pos.z - B.z) - Math.hypot(q.pos.x - B.x, q.pos.z - B.z)); if (atks[0] === b) { this.goTo(b, B.x, B.z, 'bomb'); return; } }
        if (B.st === 'planted') {
          if (!b.post) { const ang = Math.random() * Math.PI * 2; let px = B.x + Math.cos(ang) * rand(3, 7), pz = B.z + Math.sin(ang) * rand(3, 7); const k = this.W.nearestWalk(this.W.cIdx(px, pz)); if (k >= 0) { px = this.W.GX0 + (k % this.W.GW) + .5; pz = this.W.GZ0 + ((k / this.W.GW) | 0) + .5; } b.post = [px, pz]; }
          if (this.goTo(b, b.post[0], b.post[1], 'post')) this.lookAround(b, Math.atan2(-(b.pos.x - B.x), -(b.pos.z - B.z)));
          return;
        }
        b.post = null;
        const carrier = B.st === 'carried' && B.by === b.id; const site = this.M.sites[b.holdSite];
        if (carrier) {
          if (this.siteAt(b.pos.x, b.pos.z) && !b.target) { const dc = Math.hypot(b.pos.x - site.c[0], b.pos.z - site.c[1]); if (dc < 4 || this.siteAt(b.pos.x, b.pos.z) === b.holdSite) { b.planting = true; return; } }
        }
        if (this.now - this.liveStart < (b.lurk ? 14 : 3)) { b.walkSpeed = 2.4; }
        // reagruparse en la entrada del sitio y entrar juntos (con cegadora)
        if (b.route && b.ri === b.route.length - 1 && !this.execGo && !b.lurk) {
          b.staged = true; this.stageAt = this.stageAt || this.now;
          const team = this.actors.filter(a => a.alive && !a.human && !a.lurk && this.side(a.team) === 'atk');
          if (team.every(a => a.staged) || this.now - this.stageAt > 6 || this.now - this.liveStart > 50) {
            this.execGo = true;
            const fl = team.find(a => a.staged && a.inv.n.fl > 0);
            if (fl) { const c = site.c, e = eyeOf(fl); const dx = c[0] - fl.pos.x, dz = c[1] - fl.pos.z, L = Math.hypot(dx, dz) || 1, sp = Math.min(12, 4 + L * .4); fl.inv.n.fl--; this.spawnNade(fl, 'fl', e, [dx / L * sp, 5, dz / L * sp]); }
          } else { b.walkSpeed = 2.4; this.lookAround(b, Math.atan2(-(site.c[0] - b.pos.x), -(site.c[1] - b.pos.z))); return; }
        }
        if (b.route && b.ri < b.route.length) { const [x, z] = b.route[b.ri]; if (this.goTo(b, x, z, 'r' + b.ri)) { b.ri++; if (b.ri === b.route.length - 1 && b.inv.n.sm > 0 && Math.random() < .6) { const c = site.c, e = eyeOf(b); const dx = c[0] - b.pos.x, dz = c[1] - b.pos.z, L = Math.hypot(dx, dz) || 1, sp = Math.min(13, 4 + L * .45); b.inv.n.sm--; this.spawnNade(b, 'sm', e, [dx / L * sp, 4.5, dz / L * sp]); } } return; }
        if (this.mode === 'elim' && this.now - this.liveStart > 25) {
          let n = null, nd = 1e9; for (const t of this.actors) { if (t.alive && t.team !== b.team) { const d = d2(t.pos, b.pos); if (d < nd) { nd = d; n = t; } } }
          if (n) { const key = 'hunt' + n.id + Math.floor(this.now / 4); this.goTo(b, n.pos.x, n.pos.z, key); return; }
        }
        const c = site.c; if (!b.siteOff) b.siteOff = [rand(-3, 3), rand(-3, 3)];
        if (this.goTo(b, carrier ? c[0] : c[0] + b.siteOff[0], carrier ? c[1] : c[1] + b.siteOff[1], 'site')) this.lookAround(b, b.yaw);
      } else {
        if (B.st === 'planted') {
          if (this.goTo(b, B.x, B.z, 'defuse')) { if (!b.target) b.planting = true; }
          return;
        }
        if (b.lastKnown && this.now - b.lastKnownT < 6 && b.hold && Math.hypot(b.lastKnown.x - b.hold[0], b.lastKnown.z - b.hold[1]) < 14) { this.goTo(b, b.lastKnown.x, b.lastKnown.z, 'lk' + Math.round(b.lastKnownT)); return; }
        if (this.mode === 'elim' && this.now - this.liveStart > 60) {
          let n = null, nd = 1e9; for (const t of this.actors) { if (t.alive && t.team !== b.team) { const d = d2(t.pos, b.pos); if (d < nd) { nd = d; n = t; } } }
          if (n) { this.goTo(b, n.pos.x, n.pos.z, 'hunt' + n.id + Math.floor(this.now / 4)); return; }
        }
        if (b.hold) { if (this.goTo(b, b.hold[0], b.hold[1], 'hold' + b.hold[0])) { this.lookAround(b, b.hold[2]); b.crouch = false; } }
      }
    }
    lookAround(b, base) { const t = this.now * .6 + b.id; const want = base + Math.sin(t) * .5; b.yaw += clamp(angDiff(b.yaw, want), -2 * this.dt, 2 * this.dt); b.pitch = lerp(b.pitch, 0, this.dt * 3); }
    updateBot(b, dt) {
      const D = this.D;
      let w = WEAPONS[b.cur] || WEAPONS.knife;
      if (w.melee || NADES[b.cur]) { b.cur = b.inv.p || b.inv.s || 'knife'; w = WEAPONS[b.cur]; b.ammo = b.ammo || w.mag; }
      b.mx = 0; b.mz = 0; let sp = 4.6;
      if (this.phase === 'buy') { b.vel.x = b.vel.z = 0; this.lookAround(b, b.yaw); this.W.moveActor(b, dt); return; }
      if (this.now < b.blindUntil) {
        b.target = null; b.planting = false; b.yaw += Math.sin(this.now * 7 + b.id) * dt * 2;
        const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw); b.mx = -fx * .6; b.mz = -fz * .6;
      } else {
        b.thinkT -= dt; if (b.thinkT <= 0) { b.thinkT = rand(.1, .17); this.perceive(b); }
        const t = b.target;
        if (t && t.alive) {
          b.planting = false; b.seenT += dt;
          const e = eyeOf(b); const aimH = t.pos.y + t.h * .72;
          const dx = t.pos.x - e[0], dz = t.pos.z - e[2], dist = Math.hypot(dx, dz);
          const desY = Math.atan2(-dx, -dz), desP = Math.atan2(aimH - e[1], dist);
          const dy = angDiff(b.yaw, desY); const turn = D.turn * dt; b.yaw += clamp(dy, -turn, turn); b.pitch = lerp(b.pitch, desP, 1 - Math.exp(-dt * 8));
          if (w.melee) {
            // cuchillo: correr hacia el objetivo y apuñalar de cerca
            b.mx = -Math.sin(b.yaw); b.mz = -Math.cos(b.yaw); sp = 5.4; b.crouch = false;
            if (dist < 1.7 && this.now - b.lastShot > .7 && Math.abs(dy) < .6) { b.lastShot = this.now; const heavy = Math.random() < .35; this.ev({ k: 'slash', s: b.id, hit: 1 }); this.damage(t, b, weaponDamage(w, dist, 'c', t, heavy), 'c', 'knife'); }
          } else {
          // combate con movimiento: distancia preferida según el arma, ciclos de moverse y frenar para disparar,
          // personalidad (agresivo / flanqueador / firme) y retirada con poca vida o al recargar
          const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
          const shooting = b.seenT > b.react && Math.abs(dy) < .12;
          const style = BOT_STYLE[b.id % BOT_STYLE.length];
          const R = BOT_RANGE[b.cur] || [8, 24]; const rmin = R[0], rmax = R[1] * (style === 'rush' ? .7 : 1);
          const far = dist > rmax, close = dist < rmin, hurt = b.hp < 35 || b.reloadT > 0;
          b.cyc = (b.cyc || 0) - dt;
          if (b.cyc <= 0) {
            b.moving = !b.moving; b.strafeDir = Math.random() < .5 ? -1 : 1;
            b.cyc = b.moving ? (far ? rand(.6, 1.2) : rand(.25, .6)) : (far ? rand(.25, .45) : rand(.35, .8));
            b.crouch = !b.moving && !far && dist > 10 && Math.random() < .25;
          }
          if (b.moving || !shooting || hurt) {
            const fx = dx / (dist || 1), fz = dz / (dist || 1); let mx = rx * b.strafeDir, mz = rz * b.strafeDir;
            if (hurt) { mx -= fx * .9; mz -= fz * .9; }
            else if (far) {
              // acercarse por un camino real (sin dejar de apuntar)
              const y0 = b.yaw, p0 = b.pitch; this.goTo(b, t.pos.x, t.pos.z, 'ch' + t.id + Math.floor(this.now / 1.5)); b.yaw = y0; b.pitch = p0;
              mx = (b.mx || fx) + rx * b.strafeDir * .35; mz = (b.mz || fz) + rz * b.strafeDir * .35;
            }
            else if (close) { mx -= fx * .7; mz -= fz * .7; }
            else if (style === 'rush') { mx += fx * .6; mz += fz * .6; }
            else if (style === 'flank') { mx += rx * b.strafeDir * .5; mz += rz * b.strafeDir * .5; }
            const L = Math.hypot(mx, mz) || 1; b.mx = mx / L; b.mz = mz / L; sp = far && !hurt ? 4.9 : 4.3; b.crouch = false;
          }
          if (b.reloadT <= 0 && b.ammo <= 0) b.reloadT = w.reload;
          if (shooting && b.reloadT <= 0 && Math.hypot(b.vel.x, b.vel.z) < 1.6) this.botFire(b, t, dist, w);
          // granada ocasional a distancia media
          if (!b.nadeT || this.now > b.nadeT) { b.nadeT = this.now + rand(6, 12); const L = Math.hypot(dx, dz) || 1; if (dist > 8 && dist < 26 && b.inv.n.he > 0 && Math.random() < .35) { b.inv.n.he--; this.spawnNade(b, 'he', e, [dx / L * 11, 4 + dist * .12, dz / L * 11]); } else if (dist > 7 && dist < 22 && b.inv.n.fl > 0 && Math.random() < .25) { b.inv.n.fl--; this.spawnNade(b, 'fl', e, [dx / L * 10, 3 + dist * .1, dz / L * 10]); } }
          }
        } else {
          b.crouch = false;
          if (b.planting) {
            const B = this.bomb, side = this.side(b.team);
            const ok = side === 'atk' ? (B.st === 'carried' && B.by === b.id && this.siteAt(b.pos.x, b.pos.z)) : (B.st === 'planted' && Math.hypot(b.pos.x - B.x, b.pos.z - B.z) < 1.6);
            if (!ok) b.planting = false;
          }
          if (!b.planting) this.objective(b);
          sp = b.walkSpeed || 4.6;
          if (b.ammo < w.mag * .4 && b.reloadT <= 0) b.reloadT = w.reload;
        }
      }
      if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.ammo = w.mag; }
      if (b.planting) { b.mx = 0; b.mz = 0; }
      sp *= w.speed / 4.6;
      b.vel.x = lerp(b.vel.x, b.mx * sp, 1 - Math.exp(-dt * 10)); b.vel.z = lerp(b.vel.z, b.mz * sp, 1 - Math.exp(-dt * 10));
      b.h = lerp(b.h, b.crouch ? 1.22 : 1.8, 1 - Math.exp(-dt * 10));
      this.W.moveActor(b, dt);
    }
    botFire(b, t, dist, w) {
      const iv = 60 / w.rpm * (w.auto ? 1 : 1.5);
      if (this.now - b.lastShot < iv) return;
      if (b.burst <= 0) { if (b.burstPause > this.now) return; b.burst = w.auto ? (rand(dist > 20 ? 2 : 4, dist > 20 ? 5 : 10) | 0) : 1; b.sprayI = 0; }
      b.burst--; if (b.burst <= 0) b.burstPause = this.now + (w.auto ? rand(.2, .45) : rand(.3, .8));
      b.lastShot = this.now; b.ammo--; b.firedAt = this.now; b.sprayI = (b.sprayI || 0) + 1;
      const e = eyeOf(b); const tsp = Math.hypot(t.vel.x, t.vel.z);
      let err = this.D.err * (b.seenT < b.react + .5 ? 1.6 : 1) * (1 + tsp * .07) * (b.crouch ? .85 : 1) + (w.scope ? .002 : w.stand) + Math.min(b.sprayI, 10) * w.kick * .12;
      const head = Math.random() < (w.scope ? .1 : .22); const aimY = t.pos.y + (head ? t.h - .17 : t.h * .62);
      const dx = t.pos.x - e[0], dy = aimY - e[1], dz = t.pos.z - e[2]; const L = Math.hypot(dx, dy, dz);
      const n0 = w.pellets || 1;
      for (let p = 0; p < n0; p++) {
        const sp = w.pellets ? w.spreadP : 0;
        const d = [dx / L + gauss() * (err + sp), dy / L + gauss() * (err + sp) * .75, dz / L + gauss() * (err + sp)]; const n = Math.hypot(d[0], d[1], d[2]); d[0] /= n; d[1] /= n; d[2] /= n;
        this.fireBullet(b, e, d, w, p > 0);
      }
    }
    fireBullet(sh, o, d, w, silent) {
      const wt = this.W.traceWorld(o, d, 200); let hitA = null, hitT = wt.t, zone = 'c';
      for (const a of this.actors) { if (a === sh || !a.alive || a.team === sh.team) continue; const r = rayActor(o, d, a, hitT); if (r && r.t < hitT) { hitT = r.t; hitA = a; zone = r.zone; } }
      const end = [o[0] + d[0] * hitT, o[1] + d[1] * hitT, o[2] + d[2] * hitT];
      if (!silent) this.ev({ k: 'shot', s: sh.id, w: w.id, e: end.map(r2), n: hitA ? 0 : (wt.n || 0), hit: hitA ? 1 : 0 });
      if (hitA) this.damage(hitA, sh, weaponDamage(w, hitT, zone, hitA), zone, w.id);
      this.alert(sh, 40);
    }

    /* ================= CICLO ================= */
    tick(dt) {
      this.dt = dt; this.now += dt; this.tickN++;
      if (this.now >= this.phaseEnd) {
        if (this.phase === 'buy') { this.phase = 'live'; this.phaseEnd = this.now + ROUND.live; this.liveStart = this.now; this.ev({ k: 'live' }); }
        else if (this.phase === 'live') {
          if (this.mode === 'tdm') this.endTDM(this.scores[0] === this.scores[1] ? -1 : this.scores[0] > this.scores[1] ? 0 : 1);
          else if (this.mode === 'gg') { const lead = this.actors.slice().sort((p, q) => (q.lvl - p.lvl) || (q.kills - p.kills))[0]; this.endGG(lead); }
          else if (this.mode === 'elim') { const al = { atk: 0, def: 0 }; for (const a of this.actors) if (a.alive) al[this.side(a.team)]++; this.endRound(al.atk > al.def ? 'atk' : 'def', 'time'); }
          else if (this.bomb.st !== 'planted') this.endRound('def', 'time');
        }
        else if (this.phase === 'post') this.startRound();
        else if (this.phase === 'over') { const voted = this.votedMap(); if (voted) this.setMap(voted); else if (this.rotate !== false) this.setMap(this.nextMapId()); this.cond = pickCond(this.mapId); this.votes.clear(); this.newMatch(); this.ev({ k: 'mstart', map: this.mapId, cond: this.cond, voted: voted ? 1 : 0 }); this.rosterDirty = true; }
      }
      // pasos audibles para los bots
      if (this.tickN % 6 === 0) for (const a of this.actors) { if (!a.alive || !a.human || a.walking || a.crouch) continue; if (Math.hypot(a.vel.x, a.vel.z) > 3.2) this.alert(a, 16); }
      for (const a of this.actors) {
        if (!a.alive) { if (this.phase === 'live' && this.now >= a.respawnAt) { if (this.mode === 'gg') this.spawnGG(a); else if (this.mode === 'tdm') this.spawnTDM(a); } continue; }
        if (!a.human) this.updateBot(a, dt);
        // recoger armas del suelo si el espacio está libre
        if (this.mode !== 'gg' && this.mode !== 'tdm') for (let i = 0; i < this.drops.length; i++) {
          const dr = this.drops[i]; if (this.now - dr.t < .8) continue; if (Math.hypot(a.pos.x - dr.x, a.pos.z - dr.z) > 1.1) continue;
          const w = WEAPONS[dr.w]; const slot = w.slot === 1 ? 'p' : 's';
          if (!a.inv[slot] || (!a.human && slot === 'p' && w.price > (WEAPONS[a.inv.p] || { price: 0 }).price + 900)) {
            if (a.inv[slot]) this.dropWeapon(a, a.inv[slot]);
            a.inv[slot] = dr.w; if (!a.human || slot === 'p') a.cur = dr.w; a.ammo = w.mag; a.pdirty = true; this.drops.splice(i, 1); this.ev({ k: 'pick', v: a.id, w: dr.w }); break;
          }
        }
      }
      this.stepNades(dt);
      this.bombTick(dt);
      // eliminación
      if (this.mode === 'range') for (const a of this.actors) if (a.human && a.money < 99999) { a.money = 99999; a.pdirty = true; }
      if (this.phase === 'live' && this.mode !== 'gg' && this.mode !== 'tdm' && this.mode !== 'range') {
        const alive = { atk: 0, def: 0 }; for (const a of this.actors) if (a.alive) alive[this.side(a.team)]++;
        if (alive.def === 0) this.endRound('atk', 'elim');
        else if (alive.atk === 0 && this.bomb.st !== 'planted') this.endRound('def', 'elim');
      }
      this.broadcastState();
    }
    broadcastState() {
      const B = this.bomb;
      const snap = {
        t: 's', ph: this.phase, pt: r2(Math.max(0, this.phaseEnd - this.now)), rd: this.round, sc: this.scores, s0: this.side(0),
        b: [B.st, B.x, B.y, B.z, B.by, B.st === 'planted' ? r2(B.explodeAt - this.now) : 0, r2(B.pp / ROUND.plant), B.dneed ? r2(B.dp / B.dneed) : 0, B.site || ''],
        a: this.actors.map(a => [a.id, r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), Math.round(a.yaw * 1000) / 1000, r2(a.pitch), r2(a.h), Math.ceil(Math.max(0, a.hp)), a.alive ? 1 : 0, a.cur,
          ((this.now - a.firedAt < 1.5) ? 1 : 0) | (a.walking ? 2 : 0) | ((B.st === 'carried' && B.by === a.id) ? 4 : 0) | ((B.planter === a.id || B.defuser === a.id) ? 8 : 0) | (this.now < a.blindUntil ? 16 : 0) | (a.armor > 0 ? 32 : 0) | (a.kit ? 64 : 0) | (a.helmet ? 128 : 0),
          r2(a.vel.x), r2(a.vel.z)]),
        g: this.nades.map(g => [g.id, g.k, r2(g.p.x), r2(g.p.y), r2(g.p.z)]),
        sm: this.smokes.map(s => [s.id, r2(s.x), r2(s.z), r2(s.until - this.now)]),
        dr: this.drops.map(d => [d.id, d.w, d.x, d.y, d.z]),
        ev: this.events
      };
      this.events = [];
      this.onBroadcast(snap);
      for (const [cid, id] of this.clients) { const a = this.actors[id]; if (a.pdirty || this.tickN % 10 === 0) { a.pdirty = false; this.onSend(cid, this.privateState(a)); } }
      if (this.rosterDirty || this.tickN % 20 === 0) { this.rosterDirty = false; this.onBroadcast(this.roster()); }
    }
    privateState(a) { return { t: 'p', stk: a.streak | 0, lvl: a.lvl | 0, m: a.money, ar: Math.round(a.armor), hm: a.helmet ? 1 : 0, kit: a.kit ? 1 : 0, inv: a.inv, cur: a.cur, cb: this.canBuy(a) ? 1 : 0 }; }
    roster() { return { t: 'r', code: this.code, map: this.mapId, cond: this.cond, diff: this.diffKey, gm: this.mode, hs: { atk: this.sideHumans('atk'), def: this.sideHumans('def') }, r: this.actors.map(a => [a.id, a.name, a.team, a.kills, a.deaths, a.assists, a.score, a.human ? 1 : 0, a.money, a.lvl | 0, a.camo || '']) }; }
  }

  return { STREAKS, TDM, WEATHER, pickCond, CH_POOL, needXP, dailyFor, xpFromEvent, CAMOS, RADIO, LADDER, GG_TIME, WEAPONS, NADES, GEAR, ZM, ROUND, MONEY, DIFF, TEAMS, BOT_NAMES, MAPS, MAP_IDS, World, Room, rayBox, rayActor, weaponDamage, clamp, lerp, rand, gauss, angDiff, inRect };
});
