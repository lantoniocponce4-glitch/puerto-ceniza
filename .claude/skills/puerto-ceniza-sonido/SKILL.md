---
name: puerto-ceniza-sonido
description: Diseño de sonido para Puerto Ceniza. Todo el audio se sintetiza en vivo con Web Audio (sin archivos). Úsala al crear o cambiar sonidos de armas, pasos, explosiones, granadas, interfaz, ambiente, voces de radio o mezcla; o cuando digan "suena feo", "no se escucha de dónde viene", "suena a juguete", "más realista" o "se escucha mal en el celular".
---

# Sonido de Puerto Ceniza

En un shooter táctico el sonido es información: de dónde viene un disparo, qué arma es, si hay pasos cerca, cuánto falta para la carga. La prioridad es **claridad y dirección**; el realismo va después.

## Arquitectura (`public/client.js`)

- `initAudio()` crea el contexto al primer toque o clic (los navegadores lo exigen).
- Cadena: sonidos → buses `fx` / `amb` / `ui` → (`fx` pasa por el filtro `MUF.f`) → `master` → compresor → salida. Cada bus tiene su volumen en el menú.
- Reverberación por convolución (`REV`): respuesta al impulso generada por entorno (`REV_DEF`: al aire libre por tema de mapa, `indoor` bajo techo). Cambia sola según `roofedNow`. Manda señal con `revSend(nodo, cantidad)`.
- Posición: `posAudio(x, z)` devuelve distancia y paneo; los paneos `Pan` usan HRTF (se distingue adelante, atrás y los lados).
- Primitivas: `sTone` (oscilador), `sNoise` (ruido filtrado), `sShot` (disparo por capas), `sBoom` (explosión), `sStep` (pasos por superficie), `sReload`, `killSound`.
- `voice(dur)` limita los sonidos simultáneos (24): los lejanos se omiten si hay demasiados, para no saturar el procesador del celular.

## Cómo suena un disparo (`sShot`)

Capas, cada una con su función:

1. **Chasquido mecánico** (solo el arma propia): ruido agudo muy corto.
2. **Cuerpo**: ruido con filtro paso bajo que baja de `snd.cut` a 260 Hz en `snd.dec` segundos. Define el carácter del arma.
3. **Golpe grave**: triángulo de `snd.thump` Hz que cae a 35 Hz. Da peso.
4. **Retumbe lejano** (más de 25 m): ruido muy grave con ataque lento.
5. **Reverberación** del entorno, más fuerte bajo techo.

Capas agregadas (`shotExtras`):

6. **Ataque**: estallido de 8-14 ms en 2,1-3,3 kHz; es el «golpe» que hace que suene a disparo y no a soplido.
7. **Ladrido**: banda media en `cut × 0,32` que da el carácter del arma a media distancia.
8. **Chasquido supersónico**: a más de 18 m, las armas con `vol` ≥ 0,9 crujen **antes** del estampido (la bala llega antes que el sonido). Da dirección y distancia.
9. **Solo el arma propia**: saturación suave (`WaveShaper` con curva en caché), patada grave de 62 Hz, mecanismo (corredera, cerrojo, bomba, cerrojo manual según el arma) y casquillos que tintinean al caer (no en arena, nieve ni agua; en automáticas, uno de cada tres). El cuerpo del disparo propio va al 60 % para que las capas extra no suban el volumen total.

Además: retardo por la velocidad del sonido, atenuación por distancia, filtro de oclusión si hay una pared de por medio y variación aleatoria de ±7 % en tono y filtro en cada disparo (sin ella, una ráfaga suena a máquina).

Parámetros por arma en `WEAPONS[id].snd` (`core.js`):

| Tipo | `cut` (Hz) | `dec` (s) | `thump` (Hz) | `vol` |
|---|---|---|---|---|
| Pistola | 3600-3900 | .11-.14 | 140-160 | .6-.7 |
| Pistola pesada / revólver | 2100-2600 | .3-.45 | 66-90 | 1.05-1.2 |
| Subfusil | 2900-4600 | .11-.17 | 128-170 | .66-.8 |
| Fusil | 2500-3400 | .2-.3 | 92-115 | .9-1.02 |
| Escopeta | 1900-2100 | .36-.42 | 55-65 | 1.2 |
| Francotirador | 1700-2700 | .32-.65 | 55-85 | 1.1-1.3 |
| Silenciada | `sup: 1`, `cut` 1500-1700, `dec` .07-.08 | | 0 | .38 |

Regla: dos armas de la misma categoría deben diferenciarse en al menos un parámetro notorio (`cut` ±400 Hz o `dec` ±0,05 s), para reconocerlas de oído.

## Explosiones (`sBoom(dist, grande, pan, ocluida)`)

Capas: estallido de 30 ms (cerca), cuerpo con paso bajo que cae a 70 Hz, banda media que «empuja», golpe sub-grave de 62-75 Hz, retumbe lejano (más de 30 m) y escombros que caen entre 0,2 y 1,5 s después (menos de 45 m). Llega con retardo por la velocidad del sonido, pierde agudos con la distancia y con una pared de por medio, y viene del lado correcto.

## Ambiente

Cada tema tiene una cama mono más una cama ancha en estéreo (dos fuentes desfasadas a izquierda y derecha con ritmos de ráfaga distintos), así el viento va y viene de un lado a otro.

## Pasos (`sStep(v, pan, superficie, distancia)`)

- Dos golpes: talón y, 65-85 ms después, punta o roce; el pie izquierdo y el derecho alternan con un tono 12 % distinto (sin eso suenan a metrónomo).
- A lo lejos pierden agudos (`lp`); cerca se suma un golpe grave de peso del cuerpo y, al correr, a veces el roce de correas y hebillas.
- Superficie: metal resuena, madera golpea hueco, nieve cruje, agua salpica, arena y tierra raspan, piedra suena seca.

## Medir sin parlantes

Con `?debug=1`, `PCDBG.sndTest(() => PCDBG.sShot(...), segundos)` genera el sonido en un `OfflineAudioContext` y devuelve el pico y el nivel medio (RMS). Compara con la versión anterior antes de subir un cambio: una capa nueva no debe subir el RMS del disparo propio más de un 20 %.

## Mezcla

- Lo táctico manda: pasos enemigos, recarga cercana, carga plantada y disparos deben oírse por encima del ambiente.
- El ambiente (`amb`) es una cama suave: viento, lluvia o ciudad por mapa, nunca más fuerte que los pasos.
- Interfaz (`ui`): tonos cortos y limpios; usa `uiSound()` para que no reciban reverberación ni el filtro de poca vida.
- Con poca vida (menos de 30) el bus de efectos se apaga (filtro paso bajo) y suena un latido (`updateHealthAudio`).
- En segundo plano el audio se suspende.

## Rendimiento

- Cada sonido crea nodos de Web Audio: los sonidos frecuentes (disparos automáticos, pasos) deben ser cortos y pasar por `voice()`.
- No crees respuestas al impulso en cada cambio: `setReverb` las guarda en caché.
- Nada de `ScriptProcessor` ni procesamiento por muestra en el hilo principal.

## Cómo verificar

- Escucha en el juego con auriculares: dirección (adelante/atrás), distancia (cerca/lejos) y oclusión (detrás de una pared).
- Dispara una ráfaga larga de cada arma nueva: no debe saturar ni sonar repetitiva.
- Prueba en el celular: con muchos bots disparando, el sonido no debe entrecortarse.
