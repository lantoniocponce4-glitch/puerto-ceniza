---
name: puerto-ceniza-gamedev
description: Guía de desarrollo de videojuegos para Puerto Ceniza (shooter táctico 5 contra 5 en Three.js, PC y celular). Úsala siempre que se cambien mapas, bots, armas, mecánicas, gráficos, rendimiento, el HUD (táctil o de PC), el giroscopio o los controles; o cuando pidan "mejorar el juego", "más fluido", "más parecido a CS:GO/PUBG", "se calienta el celular" o algo similar. Trae las reglas de diseño del proyecto y las herramientas para comprobar cada cambio (validador de mapas, simulador de partidas con bots y capturas automáticas).
---

# Desarrollo de Puerto Ceniza

Shooter táctico por rondas (plantar/desactivar) que corre en el navegador, en PC y en celular. El mismo núcleo corre en el servidor y en la práctica sin conexión.

## Mapa del código

| Archivo | Qué contiene |
|---|---|
| `shared/core.js` | Núcleo compartido: armas (`WEAPONS`), mapas (`MAPS` + `MAP_EXTRA`), colisiones y navegación (`World`), la sala y toda la IA de los bots (`Room`). Cambiar aquí afecta al servidor **y** al modo sin conexión. |
| `public/client.js` | Todo el cliente: render Three.js, efectos, sonido, controles de PC y táctiles, HUD, giroscopio, calidad adaptable, red. |
| `public/models.js` | Modelos de soldados y armas. |
| `public/index.html` | HUD, menús y todo el CSS. |
| `server.js` | HTTP estático (comprimido, con ETag; Three.js desde `node_modules`) y WebSocket; reconexión con sala vacía guardada 30 s. |
| `tools/` | Herramientas de prueba (abajo). |

Los textos del juego, los comentarios y los mensajes de commit van **en español**.

## Cómo comprobar cada cambio (obligatorio)

1. `node --check` en cada archivo JS tocado.
2. Mapas o navegación: `npm run test:maps` debe dar ✓ en todos los mapas y `npm run test:contact` debe pasar (primer contacto ≥ 4,5 s, lejos de los spawns, y defensores llegando antes a los sitios). Con `LIST=8 node tools/contact.js <mapa>` ves los contactos más tempranos para corregirlos.
3. Bots, armas, economía o mapas: `npm run test:bots` (o `G=6 node tools/sim-bots.js` para más precisión). Meta: atacantes entre 40 % y 60 % por mapa, pocas rondas por `time` (si hay muchas, hay bots atascados) y sin errores. Con 2 partidas la varianza es alta: no se ajusta nada con menos de 6.
4. Algo visual: `PORT=3111 npm start` y luego `node tools/shots.cjs plan|cam|mobile ...`, y **mirar las capturas**. Hace falta Playwright (`npm i -D playwright` en local; en la nube ya viene).
5. `?debug=1` en la URL expone `window.PCDBG` (`me`, `G`, `camera`, `actors`, `perf`) y `PCDBG.cam = [x, y, z, yaw, pitch]` fija la cámara para capturas.

## Diseño de mapas (shooter táctico)

- Un mapa son cajas `[x0, z0, x1, z1, alto, material, y0?]`. Los añadidos van en `MAP_EXTRA` (al final de los mapas en `core.js`).
- **Nunca** una línea de visión de spawn a spawn ni desde la zona de spawn (el validador revisa los puntos exactos y `tools/contact.js` toda la zona). Se corta con un objeto de 2 m o más (la altura de los ojos es 1,66 m).
- Salidas de spawn en **chicane**: dos muros desplazados (uno con hueco a la izquierda y otro a la derecha) para que al salir haya que girar. Las calles largas llevan puertas desplazadas; el medio, una sala con bloque central (se entra por un lado y se sale por el otro). Los huecos deben medir 2 m o más para que los bots pasen; prueba con el validador.
- No copies mapas de otros juegos: diseña trazados propios con estos principios.
- Tiempos de referencia (los de los shooters tácticos clásicos): atacantes 15-20 s hasta un sitio, defensores 6-9 s, primer duelo a los 6-8 s. `tools/contact.js` los mide.
- Para agrandar un mapa usa `scaleMap(MAPS.x, factor)` (después de sumar `MAP_EXTRA`): agranda edificios, calles y muros; los objetos bajos (≤ 1,6 m) conservan su tamaño real y los muros delgados su grosor. La decoración con posiciones fijas del cliente usa `M.scale`.
- `holdCover(M)` pone sacos de arena frente a cada posición defensiva sin tapar rutas; úsalo si un mapa queda muy a favor de los atacantes.
- Los puntos de ruta y de defensa que queden dentro de un muro se corrigen solos al cargar el mapa (`World`, `M._snapped`).
- Mapas en rotación: Alcazaba, Muelle 9, Distrito Lumen, Fundición y Oasis. Retirados (ocultos con `hidden`): Fundo Azul, Estación Boreal, Refinería Ocaso y Villa Salitre.
- Estructura clásica: tres carriles (dos sitios y el medio) con puntos de choque. Cada sitio necesita: cobertura central para jugar alrededor de la carga, cobertura en cada entrada para quien ataca y posiciones para quien defiende con al menos dos ángulos.
- Alturas: 1,1 a 1,2 m = cobertura agachado (se dispara por encima de pie); 2 m o más = bloquea la vista; apilar 1,3 + 1,1 = caja para subirse.
- Materiales: `crate`, `wood`, `bench`, `glassC` se rompen y dejan pasar balas; `sandbag` y `barrel` (modelos propios) no se atraviesan; `concrete2` para bloques grandes. Evita `metalP` en bloques grandes (se ve negro liso).
- Los puntos de reagrupamiento de las rutas de los bots (`routes`, el penúltimo punto) deben quedar **detrás de una cobertura**: si quedan al descubierto, los atacantes mueren esperando y casi nunca plantan (le pasó a Fundo Azul).
- Distancias: el spawn defensor llega a los sitios antes que el atacante (unos 5 a 8 s de ventaja), pero si la diferencia es muy grande el mapa queda para los defensores.

## Bots

- La dificultad está en `DIFF` (`react`, `err`, `turn`, `hs` cabeza, `fov` campo de visión, `spray` control del retroceso).
- Ya hacen: reacción según distancia, postura y ángulo; economía de equipo; rotación de defensores (`this.rot`); reagruparse y entrar con cegadora; tras plantar, cobertura con vista a la carga; acudir cuando desactivan; equilibrio dinámico por marcador fuera del competitivo (`botSkill`).
- Para cambiar el comportamiento, primero mide con el simulador, cambia **una cosa** y vuelve a medir.
- Navegación: `nearestWalk(k, x, z)` elige la casilla alcanzable sin cruzar paredes y `lineWalk` revisa los costados del cuerpo al acortar rutas. Si aparecen rondas por `time` en la simulación, busca bots trabados (posición y `ri` de la ruta al terminar el tiempo).

## Armas: cómo agregar una

Hay 24 armas. Para una nueva hay que tocar **todos** estos lugares:

1. `WEAPONS` en `core.js`: daño, penetración de blindaje (`ap`), caída por distancia (`rm`), cadencia (`rpm`), cargador y reserva, imprecisiones (`stand`, `run`, `crouch`, `jump`), retroceso (`kick`), velocidad, premio por baja (`kill`), bando (`side`, opcional) y sonido (`snd`, ver la skill de sonido). Opcionales: `scope`/`zoom`/`scoped` (mira telescópica), `adsF`/`adsAcc` (mira de aumento al apuntar), `pellets`/`spreadP` (escopetas), `burst`/`gap` (ráfaga), `sup` (silenciada).
2. `BOT_RANGE` (distancia preferida de los bots), `botBuy` (cuándo la compran), `LADDER` (escalada de armas), `TDM.guns` y el grupo de oleadas si corresponde.
3. Modelo en `models.js` (`DEF.<id>`, ver la skill de gráficos).
4. Menú de compra (`BUY`) e inventario (`INV_GROUPS`) en `client.js`.
5. Equilibrio: el precio debe ir con el poder. Compara el tiempo para eliminar (balas necesarias × 60/rpm) con las armas de su categoría y corre `G=6 node tools/sim-bots.js`.

## Mecánicas tipo CS

Ya existen: control de spray con patrones, imprecisión al moverse, saltar y aterrizar, agacharse y caminar silencioso, frenado al recibir balas (`tagT` en el cliente, `tagUntil` en el núcleo), frenado más rápido que la aceleración (contra-strafe), economía con bono por derrotas, kit de desactivación, casco y blindaje, penetración de materiales. Los disparos se validan en el servidor (`humanShot`): toda mecánica de daño va en `core.js`.

## Rendimiento (la prioridad en celular)

- Presupuesto en celular: nada de posproceso salvo en «Ultra» (cada pasada de pantalla completa calienta el teléfono); antialias nativo; sombras cada 3 cuadros; menús a 30 FPS.
- La calidad adaptable (`adaptRes` / `setPerfLevel`) baja primero la resolución (hasta 0,75) y después apaga efectos; apunta a la frecuencia real de la pantalla (`FRM.hz`). Si agregas un efecto caro, que se apague en `perf.level >= 1`.
- Las mallas estáticas del mapa se funden por material (`mergeStatic`): los objetos nuevos deben usar materiales compartidos (`shMat`) y geometrías en `geoCache` para no multiplicar las llamadas de dibujo.
- No reescribas el DOM del HUD en cada cuadro: usa `setTxt`/`setCls` o compara antes de asignar `innerHTML`.

## HUD

- Táctil: la distribución por defecto está en `HUD_TOUCH` (posiciones en % del centro de cada elemento). Pulgar derecho: disparo, mira, recarga, salto, agacharse. Izquierda: joystick libre y segundo disparo. Arriba: asomarse, pausa y tabla. La comunicación va dentro de «más». Las armas se tocan abajo al centro. Si cambias la distribución de forma importante, sube la versión de `hudKey()` para que reemplace las guardadas.
- Botones de al menos 44 px, con íconos (`ICO`) y una etiqueta corta solo si el ícono no se entiende solo.
- Revisa siempre en horizontal (915×412) **y** en vertical: si la pantalla está vertical y no se puede bloquear, el juego se dibuja girado 90° (`FL.on`). Usa `px(e)`, `py(e)`, `VW()` y `VH()` en lugar de `clientX` e `innerWidth`.
- Giroscopio: estilo visor de PUBG (girar a la derecha mira a la derecha; inclinar hacia adelante baja la mira). Cada teléfono reporta los ejes distinto: por eso existe la calibración (`gcalStart`) y no se deben fijar signos a mano.

## Otras skills del proyecto

- `puerto-ceniza-graficos`: dirección de arte, iluminación, materiales, modelos, animación y presupuesto gráfico.
- `puerto-ceniza-sonido`: motor de audio procedural, cómo suena cada arma, mezcla y rendimiento del sonido.

## Lista rápida antes de subir

- [ ] `node --check` en los archivos tocados.
- [ ] `npm run test:maps` y `npm run test:bots` en verde.
- [ ] Capturas revisadas si hubo cambios visuales (PC y celular).
- [ ] Sin errores en la consola de la página (las herramientas los informan).
- [ ] Commit en español explicando qué se nota en el juego.
