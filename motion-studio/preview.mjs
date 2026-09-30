// Live preview: opens the composition in a visible Chrome window and
// reloads it whenever a source file changes (playhead position is kept).
import { chromium } from 'playwright';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = await serve(5178, process.argv[2] || 'index.html');
const args = ['--start-maximized', '--autoplay-policy=no-user-gesture-required'];

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args });
} catch (e) {
  console.log('Chrome channel unavailable, falling back to bundled Chromium:', e.message.split('\n')[0]);
  browser = await chromium.launch({ headless: false, args });
}
const page = await (await browser.newContext({ viewport: null })).newPage();
page.on('console', m => console.log(`[page:${m.type()}]`, m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url);
await page.bringToFront();
console.log('PREVIEW OPEN', url);

let timer;
watch(dir, { recursive: true }, (_ev, name) => {
  if (!name || name.includes('node_modules') || name.startsWith('frames') || name.startsWith('shots') || !/\.(html|css|js|mp3)$/.test(name)) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    console.log('reload ←', name);
    try { await page.reload(); } catch (e) { console.log('reload failed:', e.message); }
  }, 250);
});
browser.on('disconnected', () => process.exit(0));
