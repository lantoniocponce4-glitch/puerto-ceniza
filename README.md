# Puerto Ceniza

Shooter táctico 3D por rondas, 5 contra 5, que corre en el navegador (PC y celular) y como app Android. Los atacantes (Cobra) plantan una carga en el sitio A o B; los defensores (Halcón) lo impiden o la desactivan. Hasta 10 personas por sala; los cupos vacíos los ocupan bots.

Documentos de entrega: [HANDOFF.md](HANDOFF.md) (contexto y decisiones) · [TODO.md](TODO.md) (pendientes y errores) · [ASSETS-LICENSES.md](ASSETS-LICENSES.md) (recursos y licencias) · [INVENTARIO.md](INVENTARIO.md) (archivos y versión de entrega).

## Requisitos

| Para | Necesitas | Versión comprobada |
|---|---|---|
| Desarrollar y ejecutar el servidor | Node.js ≥ 18 y npm | Node 22.23.4 y npm 10.9.9 (Linux). La integración continua usa Node 20 |
| Jugar | Navegador con WebGL (Chrome, Edge, Firefox, Safari recientes) | Chromium de Playwright (sin GPU, por software) en escritorio y en un celular emulado |
| Cuentas persistentes (opcional) | PostgreSQL (por ejemplo Neon) | Producción usa Postgres. Sin base de datos se guarda en `data/cuentas.json` (solo para desarrollo) |
| App Android (opcional) | Node 20, JDK 17 y Android SDK (lo hace GitHub Actions) | Flujo `.github/workflows/android.yml`; no se compiló en esta entrega |

No hace falta ningún servicio pago para desarrollar ni para probar: sin `DATABASE_URL` las cuentas se guardan en un archivo local y la práctica contra bots funciona sin conexión.

## Instalar y ejecutar en desarrollo

```bash
npm ci                 # instala three 0.128.0, ws 8.23.0 y pg 8.23.1 exactamente como en package-lock.json
npm start              # servidor en http://localhost:3000 (cambia el puerto con PORT=3111 npm start)
```

Abre `http://localhost:3000`.

- **Partida rápida / Crear sala:** juego en línea contra el servidor local (bots en los cupos libres).
- **Practica solo contra bots / Campo de tiro / Tutorial:** corren enteros en el navegador, sin servidor de juego.
- Para jugar con otra persona en la misma red, comparte `http://TU-IP:3000/?sala=CÓDIGO`.
- `?debug=1` en la URL expone `window.PCDBG` y `window.__pc` para depurar y para las herramientas de capturas.

En desarrollo (sin `NODE_ENV=production`) el servidor relee los archivos de `public/` en cada petición: basta con recargar el navegador para ver los cambios.

## Compilación

No hay paso de compilación: el código se sirve tal cual. El servidor entrega Three.js en un solo archivo (`/vendor/three-bundle.js`, armado desde `node_modules/three`), comprime con brotli/gzip y usa ETag. Para producción:

```bash
npm ci --omit=dev
NODE_ENV=production PORT=3000 npm start
```

## Variables de entorno

Ver [.env.example](.env.example). El servidor no lee archivos `.env`: las variables se definen en el sistema o en el panel del alojamiento.

| Variable | Obligatoria | Uso |
|---|---|---|
| `PORT` | No (3000) | Puerto HTTP y WebSocket (`/ws`) |
| `NODE_ENV` | No | `production` deja los archivos de `public/` en caché (en desarrollo se releen en cada petición) |
| `DATABASE_URL_POOLED` / `DATABASE_URL` | No | Postgres para cuentas; si falta, archivo local `data/cuentas.json` |
| `RENDER`, `RENDER_GIT_COMMIT` | No | Las define Render; se usan para marcar producción y la versión en `/healthz` |

Puertos y conexiones: un solo puerto (HTTP + WebSocket en `/ws`). Conexiones salientes del navegador: Google Fonts (tipografías; el juego funciona sin ellas) y la API pública de GitHub (solo la app Android, para avisar de un APK nuevo).

## Pruebas

```bash
npm run test:maps      # mapas: spawns, rutas de bots, líneas de visión (sale con error si algo falla)
npm run test:contact   # primer contacto entre equipos ≥ 4,5 s
npm run test:balance   # equilibrio con margen de confianza (G=200 para decidir cambios; ~2 min en 4 núcleos)
npm run test:economy   # economía: medio tiempo, tope, precios, bono por derrotas
npm run test:bots      # 2 partidas por mapa: solo detecta errores, su varianza es enorme
npm test               # mapas + contacto + bots (lo que corre en cada push)
```

Capturas automáticas (necesitan Playwright: `npm i -D playwright` y `npx playwright install chromium`, con el servidor en `PORT=3111`):

```bash
node tools/shots.cjs plan alcazaba        # plano cenital
node tools/shots.cjs cam alcazaba 0 22 0  # vista en primera persona
node tools/shots.cjs mobile muelle        # celular emulado (HUD táctil)
```

## Despliegue

Cualquier servicio Node que acepte WebSockets. Build `npm install`, inicio `npm start`, puerto en `PORT`. La versión pública actual corre en Render (ver HANDOFF.md).
