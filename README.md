# Puerto Ceniza

Shooter táctico por rondas, 5 contra 5, en el navegador. Los atacantes plantan la carga en el sitio A o B; los defensores lo impiden o la desactivan. Hasta 10 personas por sala; los cupos vacíos los ocupan bots.

- Mapas originales: **Alcazaba** (pueblo de adobe) y **Muelle 9** (terminal portuaria).
- Economía y menú de compra, armas que se sueltan al morir, granadas HE, cegadoras y de humo.
- Servidor autoritativo en Node.js con WebSockets (`ws`); el mismo núcleo (`shared/core.js`) corre en el servidor y en el modo sin conexión del navegador.

## Correr en local

```bash
npm install
npm start
```

Abre http://localhost:3000. Para jugar con alguien, crea una sala privada y comparte el link con `?sala=CÓDIGO`.

## Despliegue

Cualquier servicio Node que acepte WebSockets (por ejemplo Render). Comando de build `npm install`, comando de inicio `npm start`. El puerto se toma de `PORT`.
