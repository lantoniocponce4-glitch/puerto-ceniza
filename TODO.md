# TODO — pendientes y errores conocidos

Fecha: 18-11-2026. Prioridad: 🔴 alta · 🟠 media · 🟢 baja.

## Errores conocidos (con pasos para reproducirlos)

| # | Prioridad | Error | Cómo reproducirlo |
|---|---|---|---|
| 1 | 🟠 | **Oasis favorece a los atacantes**, sobre el límite de la meta: 60–61 % (margen 58–63 %, veredicto «dudoso») tras el arreglo del medio tiempo. Se probó agregar coberturas en la ruta de recuperación de los defensores y empeoró (64 %); retrasar a los defensores no dio una diferencia significativa | `G=200 node tools/balance.js oasis` |
| 2 | 🟠 | **Ping alto desde Sudamérica** (~200 ms medidos por el jugador) porque el servidor está en Virginia (EE. UU.). Hay compensación de latencia en los disparos, pero no baja el número | Jugar en `puerto-ceniza.onrender.com` desde Chile y mirar «ms» arriba |
| 3 | 🟠 | **El servidor gratuito se apaga sin jugadores**: la primera visita tras un rato tarda 30–60 s (en los registros hubo 5 arranques en 8 horas) | Entrar después de ~15 min sin jugadores |
| 4 | 🟠 | **Sin protección contra «aimbots»**: el servidor valida los impactos con tolerancia a favor del tirador | — |
| 5 | 🟢 | ~1,5–2 % de rondas de Distrito terminan por tiempo (sobre todo cuando el portador muere tarde; ocasionalmente un portador vivo no planta) | `G=200 node tools/balance.js distrito` (columna «rondas por tiempo») |
| 6 | 🟢 | La carga en la mano es solo visual en el propio cliente; los demás ven la mochila | Con la carga, pulsar 5 y mirar desde otro jugador |
| 7 | 🟢 | El filtro de chat no detecta algunas variantes con 3+ letras repetidas en palabras de doble letra (por ejemplo «perrrra») | `node -e "console.log(require('./shared/core.js').cleanChat('perrrra'))"` |
| 8 | 🟢 | La P-9S, al apuntar, deja la corredera bajo el centro (igual que la P-9); la medición automática la marca alta, pero visualmente es correcto | Campo de tiro → equipar la P-9S y apuntar (clic derecho) |
| 9 | 🟢 | `npm run test:bots` (2 partidas) da resultados muy dispersos (puede dar 19 % o 71 % en un mapa); no sirve para decidir equilibrio | `npm run test:bots` dos veces |

## Funcionalidades pendientes (por prioridad)

1. 🔴 Publicar los cambios de la rama de desarrollo que aún no están en `main` (tutorial, miras, arreglos de dinero/carga/teclas): ver HANDOFF.md, «Última versión estable».
2. 🟠 Ajustar el equilibrio de Oasis hacia 50 % (medir cada intento con `G=200`).
3. 🟠 Emparejamiento por nivel de habilidad (clasificación tipo ELO y salas públicas por rango).
4. 🟠 Bajar el ping para Sudamérica (servidor más cercano). El dueño pidió excluir las opciones que dependen de Render.
5. 🟢 Versión en inglés (i18n de los textos de `index.html` y `client.js`).
6. 🟢 Tienda de cosméticos sin ventaja en combate.
7. 🟢 Dividir `public/client.js` (3.800 líneas) en módulos y minificar para cargar más rápido en celulares.
8. 🟢 Actualizar Three.js desde r128.
9. 🟢 Mostrar a los demás la carga en la mano (enviar el estado al servidor).
10. 🟢 Pruebas automáticas de red e interfaz (hoy cubren mapas, contacto, equilibrio y economía solo en scripts).

## Comprobado por última vez
Ver HANDOFF.md, sección de verificación en INVENTARIO.md.
