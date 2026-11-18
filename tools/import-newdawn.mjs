// Übernimmt New Dawn (BanioX/new-dawn) als eigene Seite nach /newdawn/index.html.
// Das Spiel selbst bleibt unverändert; eingesetzt wird nur eine schmale Leiste «‹ Spielpause»
// oben. Kein iframe: Safari auf dem iPhone gibt eingebetteten Rahmen oft keine Höhe.
//
//   sh <new-dawn>/tools/build-single.sh          # baut dist/new-dawn.html im New-Dawn-Repo
//   node tools/import-newdawn.mjs <pfad>/dist/new-dawn.html
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) {
  console.error('Aufruf: node tools/import-newdawn.mjs <pfad zu new-dawn.html>');
  process.exit(1);
}
let html = await readFile(src, 'utf8');

const BAR = 44;
const style = `
<style id="spielpause-bar-style">
  /* Spielpause: Leiste oben, das Spiel darunter (body ist das Spielfeld, siehe fit()) */
  html { height: 100%; background: #05081a; }
  body {
    height: calc(100% - ${BAR}px - env(safe-area-inset-top, 0px)) !important;
    margin-top: calc(${BAR}px + env(safe-area-inset-top, 0px)) !important;
  }
  #spielpause-bar {
    position: fixed; left: 0; right: 0; top: 0; z-index: 10; box-sizing: border-box;
    height: calc(${BAR}px + env(safe-area-inset-top, 0px));
    padding: env(safe-area-inset-top, 0px) 10px 0 calc(6px + env(safe-area-inset-left, 0px));
    display: flex; align-items: center; background: #05081a;
    font-family: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  #spielpause-bar a {
    display: inline-flex; align-items: center; gap: 4px; min-height: 40px; padding: 0 12px 0 4px;
    border-radius: 999px; color: #e8e6ff; text-decoration: none; font-weight: 750; font-size: 15px;
    -webkit-tap-highlight-color: transparent;
  }
  #spielpause-bar a:active { background: rgba(255, 255, 255, .08); }
  #spielpause-bar svg { width: 22px; height: 22px; }
</style>
<link rel="manifest" href="../manifest.webmanifest">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Spielpause">
`;
const bar = `
<div id="spielpause-bar">
  <a href="../" id="spielpause-back" aria-label="Zurück zu Spielpause">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
    <span>Spielpause</span>
  </a>
</div>
<script>
  (function () {
    var en = false;
    try {
      var saved = JSON.parse(localStorage.getItem('spielpause.lang') || 'null');
      en = saved ? saved === 'en' : !String(navigator.language || 'de').toLowerCase().startsWith('de');
      localStorage.setItem('spielpause.summary.newdawn', JSON.stringify({ text: en ? 'A puzzle of light' : 'Ein Lichträtsel', t: Date.now() }));
    } catch (e) {}
    if (en) document.getElementById('spielpause-back').setAttribute('aria-label', 'Back to Spielpause');
  })();
</script>
`;
if (!html.includes('</head>') || !html.includes('</body>')) throw new Error('Unerwartetes HTML');
html = html.replace('</head>', style + '</head>');
html = html.replace(/<\/body>(?![\s\S]*<\/body>)/, bar + '</body>');
html = html.replace('<title>New Dawn</title>', '<title>New Dawn – Spielpause</title>');

await mkdir(path.join(root, 'newdawn'), { recursive: true });
await writeFile(path.join(root, 'newdawn/index.html'), html);
console.log(`newdawn/index.html geschrieben (${(html.length / 1024).toFixed(0)} KB)`);
