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
- **Exposición** (`EXPO = 0,9`, antes 1,12): en celular la usa el mapeo ACES de la GPU y en PC el `GradeShader` comprime los brillos con ACES al 90 %. Si la arena o las paredes al sol se ven blancas sin textura, la escena está sobreexpuesta y **los soldados dejan de leerse**: baja la luz o el color base de la superficie, no subas la exposición. Arena del desierto con color `0xc9bfae` y yeso de paredes ligeramente gris.
- Los uniformes deben contrastar con el mapa donde juegan: Cobra usa tierra/coyote oscuro (no beige claro como la arena).
- Condiciones: día, atardecer, noche y clima por mapa (`pickCond`, `applyCond`). Prueba cada cambio de iluminación en las cuatro.

## Sombras nítidas (caja que sigue al jugador)

- En partida, la cámara de sombras del sol cubre solo los alrededores del jugador (`shadowFollow`, semiancho 32 m en celular, 40 en PC y 46 en «Ultra») y se recoloca solo en los cuadros en que se actualizan las sombras. Con el mismo mapa de sombras, cada texel pasa de ~6,8 cm a ~3,9 cm en PC y de ~13,7 a ~6,3 cm en celular.
- El centro se alinea a la cuadrícula de texeles **en el espacio de la luz** (proyectando sobre los ejes derecha/arriba de la luz y redondeando al tamaño del texel): así los bordes no titilan al caminar ("shadow swimming").
- En los menús vuelve a cubrir el mapa entero. Si cambias el sol (`applyCond`), `shadowFollow` conserva la dirección nueva porque la lee de `sun.position - sun.target.position`.
- Fuentes: guía de sombras de Three.js en skills.sh («frustum lo más ajustado posible», texel snapping contra el titileo) y el hilo del foro de Three.js sobre mover el frustum de la luz con la cámara.

## Luz de contorno (rim light)

- `addRim(material, equipo)` en `models.js` agrega un borde suave del color del equipo donde la superficie queda de canto a la cámara (`onBeforeCompile`, antes de `tonemapping_fragment`). Mejora la lectura de la silueta sin luces extra.
- El color y la intensidad son uniformes **compartidos por equipo** (`RIMCOL[t]`, `RIMK[t]`): `PCM.setRim(equipo, k, color)` y `PCM.setTeamColors([c0, c1])` los cambian en vivo sin recompilar. Con `k` ≤ 0,5 suma un brillo suave (lo normal: 0,42); con `k` mayor, además pinta el borde con el color (es el «resaltar enemigos» de accesibilidad, `k` 2,6 en magenta `#ff2bd6`).
- Los materiales clonados (atuendos) no heredan `onBeforeCompile`: hay que volver a llamar a `addRim`.

## Accesibilidad visual

- Ajustes → «Accesibilidad visual» (`prefs.acc`, `applyAcc()` en `client.js`): modos daltónicos (`CB_PAL`: protanopia/deuteranopia azul y ámbar, tritanopia turquesa y rosa), resaltar enemigos (contorno magenta), brillo (exposición del mapeo de tonos y uniforme `expo` del `GradeShader`), tamaño de la interfaz (variable CSS `--uiS`) y modo calmo (sin sacudidas, destello de cegadora al 70 %, sin grano).
- Todo color de equipo nuevo debe leer `TEAMC` (cliente) o las variables CSS `--t0`/`--t1`, nunca un valor fijo: así respeta el modo daltónico.
- Nunca distingas equipos solo por color: acompaña con forma o texto (nombres, íconos).

## Materiales y texturas

- Texturas procedurales en canvas (`TX.*`) y mapas normales calculados con Sobel (`normalOf`). Reutiliza las existentes antes de crear otras.
- En PC con gráficos Altos o Ultra, `cnv(w, h)` crea el lienzo al doble de resolución (`HIRES`) y escala el contexto: dibuja siempre en coordenadas de 256/512. Para leer o escribir píxeles usa `cnv(w, h, true)` (tamaño exacto) y para copiar una textura en otra pasa el tamaño de destino a `drawImage`.
- Objetos repetidos: material compartido con `shMat(clave, () => std({...}))` y geometría en `geoCache`. `mergeStatic` funde las mallas estáticas por material: un material nuevo por objeto = una llamada de dibujo más por objeto.
- Lo que se rompe (`BRKM`) queda como malla propia y no se funde.
- Metales: `metalness` alto + `roughness` 0,3-0,5 se ven bien solo con entorno; sin entorno («Livianos») baja el metalness o se ven negros.

## Modelos y animación

- Armas: `DEF.<id>` en `models.js` con las utilidades `ex` (extrusión de un perfil), `bx`, `cyl`, `sph`, `rail`, `holo`, `notch`, `gripG`, `trig`. Adelante = +x; hay que dar `muzzle`, `boreY`, `grip`, `fore`, `cls` (`rifle`/`pistol`), `sight` y `adsZ`. Las piezas se funden por material automáticamente. Usa los materiales de `MG` (`metal`, `park`, `poly`, `tan`, `od`, `wood`, `rubber`, `glass`): los de camuflaje (`poly`, `tan`, `od`, `park`, `wood`) aceptan aspectos.
- Soldados: `buildSoldier` arma el cuerpo por articulaciones y los brazos usan cinemática inversa hacia el arma (`poseArms`). `animate()` combina locomoción (direccional, agachado, salto), giro en el lugar, reposo, retroceso al disparar, recarga (la mano izquierda va al cargador), lanzar granada, cuchillazo y plantar. Las acciones de una vez se disparan con `model.act('fire'|'throw'|'slash')`; las continuas llegan por los bits de estado (1024 = recargando, 8 = plantando/desactivando).
- Una animación nueva: curva suave (seno o `e*e*(3-2e)`), duración corta (0,2 a 0,7 s), y que vuelva exactamente a la pose base.

## Efectos
- Trazadoras: cilindro con degradado (punta casi blanca, cola naranja que se apaga) y un halo ancho y tenue; destello de 70 ms al impactar en metal, piedra o vidrio (`hitFlash`).
- Fachadas de ciudad (`texFacade`): marco, reflejo del cielo, alféizar y un mapa emisivo con las ventanas que se encienden de noche (`MAT.city.emissiveIntensity` en `applyCond`). Las casas del desierto llevan alféizares y algunas ventanas de vidrio (`MAT.winLit`) que brillan de noche.
- Cables entre edificios enfrentados (`hangCables`): solo adorno, más de 3,2 m de altura, máximo 18 por mapa, sin sombras.
- Armas: `bx()` hace cajas con aristas biseladas (salvo piezas de menos de 8 mm), y cada arma tiene el ánima oscura en la boca del cañón (`BOREG`). Tras una ráfaga larga o un disparo de escopeta o francotirador sale humo del cañón en primera persona (`vm.heat`).
- Muerte en dos tiempos (`client.js`, actores sin vida): ceden las rodillas en 0,18 s y luego cae el cuerpo flojo, con la cabeza vencida y el arma soltada (`m.hand.visible`). Al reaparecer se restablece todo en la rama de vivos.
- Impacto en un soldado (`bodyHitFx`): nube corta oscura detrás del golpe; en el casco, chispas, destello y un «tink». Con el modo calmo la nube es gris.
- Casquillos expulsados (`ejectCasing`/`updateCasings`): 28 en un grupo reciclado, salen a la derecha, rebotan con tintineo (no en arena, nieve ni agua) y desaparecen a los 2,6 s. En «Livianos» solo queda el sonido sintético.
- Polvo bajo los pies (`stepDust`): solo al correr sobre arena, tierra o nieve (caminar o agacharse no levanta polvo), hasta 55 m. Es información táctica: delata a quien corre.
- Bala cercana (`nearMiss`): si el disparo enemigo pasa a menos de 2,4 m, zumbido con barrido de 2,6 a 0,7 kHz (y chasquido si es fusil) desde ese lado, y la vista se cierra un instante (`#supOv`, no en modo calmo).
- Destello del sol (`updateFlare`): capas CSS en `#flare` sobre la línea sol-centro, solo de día y sin clima, se apaga si algo tapa el sol (rayo cada 0,12 s). Mantenerlo sutil: un destello fuerte tapa enemigos.
- Explosiones (`boomFx`/`updateBoomFx`): bola de fuego en dos capas, onda expansiva sobre el suelo, humo propio (16 sprites, no comparte grupo con el polvo de pasos, que lo reciclaba) que deriva con el viento, y marca quemada en el piso que se borra con `clearDecals`.
- Soldados: rostros pintados a 512×256 (poros, mejillas, ojos con iris y brillo, cejas por trazos, labios, barba o barba de días, cicatriz) con un leve mapa normal; tela con pliegues y costuras (`NCLOTH`); cordones en las botas y correa en las rodilleras.
- Armas: `TXWEAR` es el mapa de rugosidad compartido con rayones (brillan con la luz). Soldados: oclusión ambiental falsa en el sombreador de `addRim` (las caras que miran hacia abajo se oscurecen hasta 34 %).

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
