# Recursos y licencias

Fecha: 18-11-2026.

## Resumen
El juego **no contiene archivos de imágenes de juego, modelos 3D, texturas, música ni sonidos**: todo se genera por código en tiempo de ejecución. Los únicos archivos binarios del repositorio son tres íconos PNG.

| Recurso | Dónde | Cómo se crea | Procedencia y licencia |
|---|---|---|---|
| Modelos 3D de soldados y armas | `public/models.js` | Geometría de Three.js armada por código | Código del proyecto |
| Mapas y decoración | `shared/core.js` (cajas), `public/client.js` (decoración) | Cajas y geometría por código | Código del proyecto |
| Texturas (yeso, piedra, madera, camuflajes, rostros, carteles, cielo…) | `public/client.js`, `public/models.js` | Dibujadas en `<canvas>` al cargar | Código del proyecto. Los carteles y grafitis son inventados, sin marcas reales |
| Sonidos y música | `public/client.js` | Sintetizados con Web Audio | Código del proyecto |
| Íconos de la app | `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` | — | **Procedencia no documentada.** Se agregaron el 13-11-2026 (commits `88863c0` y `c779c74`) durante el desarrollo asistido por IA; no hay registro de su origen. Recomendación: confirmar o reemplazar por un ícono propio antes de publicar en tiendas |
| Tipografías | Google Fonts, cargadas desde `fonts.googleapis.com` (no están en el repositorio) | — | Saira Condensed, Barlow y JetBrains Mono: SIL Open Font License 1.1 |

## Bibliotecas
| Biblioteca | Versión | Licencia | Uso |
|---|---|---|---|
| three | 0.128.0 | MIT | Render 3D y posproceso (se sirve al navegador) |
| ws | 8.23.0 | MIT | WebSocket en el servidor |
| pg | 8.23.1 | MIT | Postgres (opcional) |
| @capacitor/android, @capacitor/cli, @capacitor/core | ^6.1.2 | MIT | App Android |
| playwright (no incluida) | — | Apache-2.0 | Capturas de prueba |

## Restricciones
- No se usan recursos de otros juegos. Los mapas siguen principios de diseño del género, sin copiar mapas existentes.
- El repositorio no tiene una licencia propia definida (no hay archivo `LICENSE`). Si se va a publicar o distribuir, el dueño debe elegir una.
- No hay Git LFS ni submódulos.
