---
name: puerto-ceniza-graficos
description: Dirección de arte y calidad gráfica para Puerto Ceniza (Three.js r128, PC y celular). Úsala al tocar iluminación, materiales, texturas, modelos de armas o soldados, animaciones, efectos (fogonazos, impactos, humo, partículas), cielo, clima, posproceso o cuando pidan "mejores gráficos", "que se vea más realista/profesional", "se ve plano" o "se ve feo". Explica cómo subir la calidad sin romper el rendimiento en celular.
---

# Gráficos de Puerto Ceniza

Regla de oro: **cada mejora visual se paga en el celular**. Primero se busca la mejora que no cuesta nada (color, forma, composición); después la barata (una malla fundida, una textura compartida); y lo caro (pasadas de pantalla completa, luces dinámicas, sombras extra) solo en «Ultra» o apagable por la calidad adaptable.

## Dirección de arte

- Estilo: realista estilizado, legible a distancia. Siluetas claras de soldados contra el fondo, colores de equipo inconfundibles (Halcón celeste `#5cc8e0`, Cobra naranja `#ef6a45`).
- Cada mapa tiene un tema (`THEMES` en `client.js`: desierto, puerto, rural, ciudad, nieve, refinería) con cielo, niebla, color del sol y saturación propios. Mantén la paleta del tema: un objeto nuevo usa materiales del mismo tono.
- Legibilidad táctica antes que detalle: nada de follaje o partículas que oculten a un enemigo en una línea de tiro. Las coberturas deben leerse como cobertura (sacos, barriles, hormigón).
- Evita superficies grandes lisas y claras al sol: se queman en blanco (pasó con los techos). Dales textura, un tono medio y detalles encima.

## Iluminación y color

- Sol direccional con sombras + hemisférica + entorno de reflejos (PMREM) para los metales.
- Corrección de color: con posproceso la hace `GradeShader` (curva ACES parcial, saturación, contraste, viñeta, grano). **Sin posproceso** (celular en «Altos», o «Livianos») la hace la GPU con `THREE.ACESFilmicToneMapping` (`syncToneMap()`). Nunca las dos a la vez (oscurece y apaga los colores).
- Si cambias `renderer.toneMapping`, marca `material.needsUpdate = true` en las escenas (lo hace `syncToneMap`).
- Condiciones: día, atardecer, noche y clima por mapa (`pickCond`, `applyCond`). Prueba cada cambio de iluminación en las cuatro.

## Materiales y texturas

- Texturas procedurales en canvas (`TX.*`) y mapas normales calculados con Sobel (`normalOf`). Reutiliza las existentes antes de crear otras.
- Objetos repetidos: material compartido con `shMat(clave, () => std({...}))` y geometría en `geoCache`. `mergeStatic` funde las mallas estáticas por material: un material nuevo por objeto = una llamada de dibujo más por objeto.
- Lo que se rompe (`BRKM`) queda como malla propia y no se funde.
- Metales: `metalness` alto + `roughness` 0,3-0,5 se ven bien solo con entorno; sin entorno («Livianos») baja el metalness o se ven negros.

## Modelos y animación

- Armas: `DEF.<id>` en `models.js` con las utilidades `ex` (extrusión de un perfil), `bx`, `cyl`, `sph`, `rail`, `holo`, `notch`, `gripG`, `trig`. Adelante = +x; hay que dar `muzzle`, `boreY`, `grip`, `fore`, `cls` (`rifle`/`pistol`), `sight` y `adsZ`. Las piezas se funden por material automáticamente. Usa los materiales de `MG` (`metal`, `park`, `poly`, `tan`, `od`, `wood`, `rubber`, `glass`): los de camuflaje (`poly`, `tan`, `od`, `park`, `wood`) aceptan aspectos.
- Soldados: `buildSoldier` arma el cuerpo por articulaciones y los brazos usan cinemática inversa hacia el arma (`poseArms`). `animate()` combina locomoción (direccional, agachado, salto), giro en el lugar, reposo, retroceso al disparar, recarga (la mano izquierda va al cargador), lanzar granada, cuchillazo y plantar. Las acciones de una vez se disparan con `model.act('fire'|'throw'|'slash')`; las continuas llegan por los bits de estado (1024 = recargando, 8 = plantando/desactivando).
- Una animación nueva: curva suave (seno o `e*e*(3-2e)`), duración corta (0,2 a 0,7 s), y que vuelva exactamente a la pose base.

## Efectos

- Fogonazo con llamas en cruz, casquillos, chispas e impactos por material, humo volumétrico con sprites, rastros de bala. Los efectos de partículas usan grupos fijos reciclados (sin crear objetos por disparo).
- En «Livianos» o con `perf.level` alto, recorta la cantidad de partículas, no la claridad del efecto.

## Rendimiento (presupuesto)

| Plataforma | Posproceso | Sombras | Resolución |
|---|---|---|---|
| PC «Ultra» | resplandor + oclusión ambiental + color | 4096, cada cuadro | hasta 2× |
| PC «Altos» | resplandor + color | 2048, cada 2 cuadros | hasta 2× |
| Celular «Altos» | ninguno (mapeo de tonos de la GPU) | 1024, cada 3 cuadros | 0,75-1,25 adaptable |
| «Livianos» | ninguno | 1024 | ≤ 1 |

## Cómo verificar

1. `PORT=3111 npm start` y `node tools/shots.cjs cam <mapa> x z yaw` (PC) y `node tools/shots.cjs mobile <mapa>`.
2. Mira la captura de verdad: colores quemados, objetos negros, piezas flotando o atravesando paredes.
3. Revisa que `PCDBG.perf` no muestre caídas de nivel nuevas tras el cambio.
