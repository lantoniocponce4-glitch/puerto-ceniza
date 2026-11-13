// Ajusta el proyecto Android generado por Capacitor: horizontal, pantalla completa, pantalla encendida e ícono propio.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'android', 'app', 'src', 'main');
// 1) Manifiesto: orientación horizontal y sin barra de título
const mf = path.join(root, 'AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
if (!x.includes('screenOrientation')) x = x.replace(/<activity\b/, '<activity android:screenOrientation="sensorLandscape"');
fs.writeFileSync(mf, x);
// 2) Actividad principal: pantalla completa inmersiva y pantalla siempre encendida
const javaDir = path.join(root, 'java', 'com', 'puertoceniza', 'juego');
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), `package com.puertoceniza.juego;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
}
`);
// 3) Ícono: reemplaza los íconos por defecto en todas las densidades
const icon = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));
const res = path.join(root, 'res');
for (const d of fs.readdirSync(res)) {
  if (d.startsWith('mipmap-anydpi')) { fs.rmSync(path.join(res, d), { recursive: true, force: true }); continue; }
  if (!d.startsWith('mipmap-')) continue;
  for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const p = path.join(res, d, f); if (fs.existsSync(p)) fs.writeFileSync(p, icon);
  }
}
// 4) Versión y firma fija: cada compilación sube la versión y se firma siempre con la misma clave,
//    para que Android instale el APK nuevo encima del anterior (actualización sin desinstalar)
const run = parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10);
const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
g = g.replace(/versionCode\s+\d+/, 'versionCode ' + (100 + run)).replace(/versionName\s+"[^"]*"/, 'versionName "1.' + run + '"');
if (process.env.ANDROID_KEYSTORE_PASS && fs.existsSync(path.join(__dirname, '..', 'android', 'app', 'release.p12')) && !g.includes('signingConfigs {')) {
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        release {
            storeFile file('release.p12')
            storeType 'pkcs12'
            storePassword System.getenv('ANDROID_KEYSTORE_PASS')
            keyAlias System.getenv('ANDROID_KEY_ALIAS') ?: 'puertoceniza'
            keyPassword System.getenv('ANDROID_KEYSTORE_PASS')
        }
    }`);
  g = g.replace(/buildTypes\s*\{\s*release\s*\{/, "buildTypes {\n        release {\n            signingConfig signingConfigs.release");
  console.log('Firma de publicación configurada');
}
fs.writeFileSync(gradle, g);
// 5) La app le avisa al juego qué versión del APK es (para ofrecer actualizaciones)
const capCfg = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
if (fs.existsSync(capCfg)) { const c = JSON.parse(fs.readFileSync(capCfg, 'utf8')); if (c.server && c.server.url) { c.server.url = c.server.url.replace(/([?&])apk=\d+/, '$1').replace(/[?&]$/, '') + (c.server.url.includes('?') ? '&' : '?') + 'apk=' + (100 + run); fs.writeFileSync(capCfg, JSON.stringify(c, null, 2)); } }
console.log('Proyecto Android ajustado · versión 1.' + run);
