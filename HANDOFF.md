# Puerto Ceniza — entrega técnica (HANDOFF)

Documento para continuar el desarrollo sin depender de la conversación en la que se construyó. Fecha de entrega: 18-11-2026. Versión de entrega: ver [INVENTARIO.md](INVENTARIO.md).

> Origen de este documento: se escribió con acceso directo al repositorio, al código, a las pruebas y a los registros del servidor en producción. Lo que no se pudo comprobar está marcado como **no comprobado**.

---

## 1. Visión del juego

### Género, objetivo, plataformas y público
- **Género:** shooter táctico en primera persona, por rondas, 5 contra 5, con economía (inspirado en las reglas clásicas del género: plantar/desactivar, compra entre rondas, bono por derrotas). Los mapas y contenidos son **originales**: se usaron principios de diseño del género, no copias de mapas de otros juegos (decisión del dueño del proyecto).
- **Objetivo de una partida (modo principal):** los atacantes (Cobra, «terroristas») plantan una carga en el sitio A o B; los defensores (Halcón, «antiterroristas») lo impiden o la desactivan. Gana quien llega primero a la mitad más una de las rondas (5 rondas por defecto; competitivo 24 con prórroga).
- **Plataformas:** navegador de escritorio (teclado y mouse), navegador móvil (controles táctiles, giroscopio), app Android (Capacitor: abre la versión en línea a pantalla completa y en horizontal) e instalación como app desde Safari en iPhone/iPad (PWA).
- **Público:** jugadores hispanohablantes de shooters tácticos, con foco en celulares de gama media (hay calidad adaptable) y accesibilidad visual. Todos los textos están en español.

### Modos
| Modo | Descripción |
|---|---|
| `bomb` | Plantar/desactivar por rondas (principal) |
| `comp` | Competitivo: 24 rondas, prórroga con $10.000 |
| `elim` | Eliminación por rondas, sin carga |
| `tdm` | Combate por equipos con reaparición (meta de bajas) |
| `gg` | Escalada de armas (cada baja cambia el arma) |
| `waves` | Oleadas contra bots |
| `range` | Campo de tiro (práctica, desafío de 60 s y tutorial) |

### Mecánicas
- 24 armas (pistolas, subfusiles, fusiles, escopetas, ametralladora, tiradores y francotiradores), granadas HE, cegadora, humo, incendiaria y señuelo; chaleco, casco y kit de desactivación.
- Control de retroceso por patrones, imprecisión al moverse/saltar/aterrizar, frenado al recibir balas, contra-strafe, penetración de materiales, objetos rompibles.
- Economía: inicio $800, tope $16.000; victoria $3.250 (eliminación) / $3.500 (objetivo); derrota $1.400 + $500 por derrota seguida (máx. $3.400); plantar +$300 y +$800 al equipo si pierde; premio por baja según el arma. Al cambiar de lado todo vuelve a cero.
- Rachas: 3 bajas → radar (5 s), 5 → kit, 7 → dron (12 s).
- Pasadizos secretos: túneles que solo se cruzan agachado y pasillos tapiados con tablas rompibles.
- Bots con 3 dificultades (`recluta`, `veterano`, `elite`), economía de equipo, rotaciones, posiciones post-plantado y equilibrio dinámico fuera del competitivo.

### Controles
- **PC:** WASD mover · Shift caminar · C agacharse · Espacio saltar · clic disparar · clic derecho apuntar · R recargar · 1-4 armas/granadas · 5 sacar la carga · X arma anterior · F plantar/desactivar · G soltar · Q/E asomarse · B comprar · Tab marcador · Z radio · V marcar · Y chat · L linterna · I inspeccionar · K guardar posición de granada · T órdenes por voz. La lista visible está en `#keysHelp` (`public/index.html`).
- **Celular:** joystick izquierdo, arrastrar a la derecha para mirar, botones táctiles editables (editor de HUD), giroscopio estilo «visor» con calibración, pantalla forzada en horizontal.

### Cámara y física
- Primera persona; arma en primera persona en una escena aparte (`vmScene`). Repetición de la baja (killcam) y jugada de la partida.
- Física propia, simple (no hay motor de física): cajas alineadas a los ejes, gravedad, colisión por cilindro, altura de pie 1,8 m / agachado 1,22 m. Navegación de bots por cuadrícula de 1 m con A*.
- Servidor autoritativo a 20 Hz; el cliente predice su propio movimiento e interpola a los demás con 110 ms de retraso. Compensación de latencia en los disparos (hasta 350 ms).

### Progresión
Nivel y XP, desafíos diarios y semanales, rangos, pase de temporada con tarjetas y títulos, camuflajes (por arma y animados), atuendos, amuletos, clanes con objetivos semanales, ranking, historial de partidas y estadísticas por arma. Con cuenta se guarda en el servidor; sin cuenta, en el navegador.

### Historia, personajes, escenarios y estilo
- **Historia:** no hay narrativa; solo el marco «Operación Ceniza» y dos facciones: **Halcón** (antiterroristas, color celeste `#5cc8e0`) y **Cobra** (terroristas, color naranja `#ef6a45`, uniforme tierra/coyote).
- **Personajes:** soldados genéricos con rostros variados (4 por equipo), gafas, casco, chaleco, pañuelo (Cobra). Nombres de bots en `BOT_NAMES` (`core.js`).
- **Escenarios en rotación:** Alcazaba (pueblo de adobe), Muelle 9 (terminal portuaria), Distrito Lumen (ciudad), Fundición (industria) y Oasis (aldea del desierto). Retirados de la rotación (ocultos, siguen en el código): Fundo Azul, Estación Boreal, Refinería Ocaso, Villa Salitre y el polígono del campo de tiro.
- **Estilo visual:** realista estilizado, legible a distancia, con condiciones de día/atardecer/noche y clima (lluvia, arena, nieve, niebla). Todo se genera por código: geometría, texturas en canvas, cielo, efectos.
- **Estilo sonoro:** todo sintetizado en vivo con Web Audio (sin archivos de audio): disparos por capas, pasos por superficie, explosiones, ambiente estéreo por mapa, reverberación por convolución.

### Decisiones aprobadas por el dueño del proyecto
1. Mapas originales basados en principios del género, sin copiar mapas existentes; varios mapas viejos se retiraron de la rotación.
2. Spawns que no se enfrentan de frente: primer contacto ≥ 4,5 s, medido con `tools/contact.js`.
3. Pantalla forzada en horizontal en celular; giroscopio estilo PUBG con calibración.
4. HUD táctil rediseñado y editable; menú principal con pestañas; menú de compra compacto en celular.
5. Accesibilidad visual (modos daltónicos, resaltar enemigos, brillo, tamaño de interfaz, modo calmo).
6. Menos brillo general (exposición 0,9) y uniformes que contrastan con el escenario.
7. Ajustes guardados en la cuenta y respaldo por código.
8. Fase 1 de la auditoría: anti-wallhack en el servidor, registro de errores del cliente, filtro y moderación del chat.
9. Simulación de equilibrio automática cada noche.
10. Publicar solo con aprobación explícita (pull request a `main` y fusión).
11. **Excluir de las propuestas todo lo que dependa del alojamiento en Render** (plan pagado, cambio de región).

### Propuestas pendientes (no aprobadas todavía)
- Emparejamiento por nivel de habilidad (Fase 2 de la auditoría).
- Versión en inglés.
- Tienda de cosméticos sin ventaja en combate.
- Dividir `client.js` en módulos y minificar.
- Actualizar Three.js (r128 es de 2021).
- Más mapas y eventos de temporada.

---

## 2. Estado real

### Implementado y funcionando (comprobado en esta entrega)
- Partidas en línea contra el servidor local y modo sin conexión contra bots (navegador).
- Los 5 mapas pasan la validación (spawns, rutas, líneas de visión) y el primer contacto ≥ 4,5 s.
- Equilibrio de los 5 mapas dentro de 40–60 % para los atacantes (Oasis en el límite, ver TODO.md).
- Economía (pruebas de regresión: medio tiempo, tope, precios, bono por derrotas).
- Tutorial, miras de todas las armas, carga en la mano, teclas.
- Anti-wallhack, filtro de chat, reportes y registro de errores (probado con dos jugadores reales en la misma sala).

### Prototipo, simulación o placeholder
- **Física y colisiones:** cajas alineadas a los ejes; no hay rampas ni escaleras reales (solo apilar cajas).
- **Órdenes por voz (T):** usa el reconocimiento de voz del navegador (`SpeechRecognition`), solo donde exista; no es chat de voz entre jugadores.
- **«Radio»:** mensajes predefinidos, no voz.
- **La carga en la mano:** es solo visual en el propio cliente; los demás ven la mochila y la animación de plantar.
- **App Android:** es un contenedor que abre la versión en línea; no incluye el juego sin conexión.
- **Íconos de la app** (`public/*.png`): ver ASSETS-LICENSES.md (procedencia no documentada).
- **Pruebas visuales:** se hacen con GPU por software; los FPS de esas pruebas no representan un equipo real.

### Errores conocidos
Ver [TODO.md](TODO.md) (con pasos para reproducirlos).

### Última versión estable y cambios posteriores
- **Versión publicada (estable):** rama `main`, commit `4fdbb3752a1092574507268cfe880dc66842a3c9` (17-11-2026), desplegada en producción.
- **Cambios posteriores, aún no publicados** (rama `claude/charming-lovelace-3rxrx1`), en orden:
  1. `2adf87f` Tutorial guiado para jugadores nuevos.
  2. `3c1baf2` Miras de escopetas y pistola silenciada que ya no tapan la vista.
  3. `58eeff2` Arreglos: dinero en el medio tiempo, carga en la mano y teclas.
  4. El commit de esta entrega (documentos; no cambia el juego).

---

## 3. Tecnología y arquitectura

### Motor, lenguaje y versiones
- **Sin motor de juego**: JavaScript puro (ES2020) en el navegador y en Node.js. Sin TypeScript, sin paso de compilación, sin framework de interfaz.
- **Render 3D:** Three.js **0.128.0** (MIT), entregado por el servidor desde `node_modules/three` (no usa CDN). Se usan además los ejemplos de posproceso de esa versión (EffectComposer, UnrealBloomPass, SAO).
- **Servidor:** Node.js (≥ 18; comprobado 22.23.4; CI con 20), HTTP nativo + `ws` **8.23.0** (WebSocket) + `pg` **8.23.1** (Postgres, opcional).
- **Android:** Capacitor **6.x** (`@capacitor/android`, `@capacitor/cli`, `@capacitor/core` `^6.1.2`), JDK 17.
- **Herramientas:** Playwright (solo para capturas, no está en `package.json`).

### Estructura de carpetas
| Ruta | Función |
|---|---|
| `server.js` | Servidor HTTP (archivos estáticos comprimidos, `/healthz`, API `/api/*`) y WebSocket (`/ws`): salas, escuadras, emparejamiento por código o salas públicas, reconexión, límite de mensajes, anti-wallhack por equipo, reportes |
| `accounts.js` | Cuentas: registro/ingreso (scrypt), sesiones, perfil, ranking, clanes, ajustes; Postgres o archivo local |
| `shared/core.js` | Núcleo compartido (servidor y navegador): armas, mapas, colisiones y navegación (`World`), la sala con toda la lógica y la IA de bots (`Room`), economía, filtro de chat |
| `public/index.html` | Interfaz (HUD, menús, compra, ajustes) y todo el CSS |
| `public/client.js` | Cliente: render, efectos, sonido, controles (teclado, táctil, giroscopio), HUD, red, accesibilidad, tutorial, registro de errores |
| `public/models.js` | Modelos procedurales de soldados y armas, camuflajes, animaciones |
| `public/sw.js` | Service worker (juego sin conexión tras la primera visita) |
| `public/manifest.webmanifest`, `public/*.png` | App instalable (PWA) e íconos |
| `mobile/` | Proyecto Capacitor de la app Android (`capacitor.config.json`, `www/index.html` de arranque, `scripts/patch-android.js`) |
| `tools/` | Validador de mapas, primer contacto, simuladores de partidas, capturas, plano de mapas |
| `.github/workflows/` | `test.yml` (pruebas en cada push), `balance.yml` (equilibrio cada noche), `android.yml` (APK) |
| `.claude/skills/` | Guías internas de desarrollo, gráficos y sonido del proyecto (útiles como documentación técnica) |

### Escenas, módulos y estado
- **Escenas:** `scene` (mundo) y `vmScene` (arma en primera persona) en Three.js. El mapa se arma en `buildWorld(mapId)` desde las cajas de `MAPS` y se funden las mallas estáticas por material (`mergeStatic`).
- **Estado del juego:** el servidor (`Room`) es la fuente de verdad: fase (`buy`/`live`/`post`/`over`), ronda, marcador, carga, actores, granadas, humos. Envía un estado compacto a 20 Hz (`t: 's'`, filtrado por equipo) y un estado privado por jugador (`t: 'p'`: dinero, inventario). El cliente guarda su vista en `G`, `me` y `actors`.
- **Modo sin conexión:** el navegador crea una `Room` local con el mismo `core.js`.

### Sistema de guardado
- **Navegador (`localStorage`):** `pc2_prefs` (ajustes, HUD, sensibilidad, accesibilidad…; copia en `pc2_prefs_bak`), `pc2_prof` (perfil sin cuenta), `pc2_tok` (sesión), `pc2_mtab`.
- **Servidor:** cuentas, perfil (con ajustes sincronizados) y clanes en Postgres (tablas `pc_users`, `pc_sessions` y `pc_clans`; se crean solas al iniciar) o en `data/cuentas.json` sin base de datos.
- **Partidas:** en memoria; una sala vacía se borra a los 30 s.

### Dependencias y servicios externos
| Servicio | Uso | ¿Imprescindible? |
|---|---|---|
| Render (región Virginia, plan gratuito) | Aloja la versión pública | No para desarrollar |
| Postgres (Neon, según el código) | Cuentas en producción | No (hay archivo local) |
| GitHub (repositorio, Actions, Releases) | Código, pruebas, APK y su aviso de actualización | Solo para CI y la app Android |
| Google Fonts | Tipografías Saira Condensed, Barlow, JetBrains Mono | No (cae a fuentes del sistema) |

### Requisitos de hardware
- **Desarrollar:** cualquier equipo que ejecute Node 18+ (el servidor usa pocos recursos).
- **Ejecutar (jugar):** navegador con WebGL. Hay calidad adaptable para celulares; no se midió en un equipo físico durante esta entrega.
- **Alojar:** en producción el proceso usa unos 53–71 MB de RAM y el plan gratuito de Render da 0,15 de CPU, suficiente según las métricas: una sala con 10 bots cuesta ~0,1 ms por tick y unos 1,8 KB/s por jugador (comprimido).

### Requisitos según el uso
| | Desarrollar | Ejecutar (jugar) | Alojar |
|---|---|---|---|
| Node.js | ≥ 18 | — | ≥ 18 |
| Navegador WebGL | Sí (para probar) | Sí | — |
| Postgres | No | — | Recomendado (cuentas) |
| Puerto | 3000 local | — | `PORT` con WebSocket |
| Playwright | Opcional (capturas) | — | — |

---

## 4. Funcionamiento interno que conviene conocer
- Los mapas son listas de cajas `[x0, z0, x1, z1, alto, material, y0?]`; se escalan con `scaleMap` y se les excavan pasadizos con `carve`. Los cambios de mapas se validan con `npm run test:maps`, `npm run test:contact` y `G=200 node tools/balance.js`.
- Las guías en `.claude/skills/*/SKILL.md` describen reglas de diseño, presupuestos de rendimiento y cómo verificar cada tipo de cambio.
- Seguridad: los disparos los valida el servidor (con tolerancia a favor del tirador), el movimiento tiene un presupuesto de velocidad, hay límite de mensajes por conexión y un filtro anti-wallhack. No hay protección contra «aimbots».

## 5. Producción
- URL pública: `https://puerto-ceniza.onrender.com` (Render, despliegue automático desde `main`).
- Comprobación rápida: `GET /healthz` responde `{"ok":true,...}`.
- Registros: los errores del navegador aparecen como `[cliente]` y los reportes de jugadores como `[reporte]`.
