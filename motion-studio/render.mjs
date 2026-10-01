// Frame-accurate export: seeks the composition to every frame, screenshots it,
// then encodes an MP4 (with the voice-over clips mixed in) using ffmpeg.
//   node render.mjs                 → out/pamarket-<slug>.mp4 (1080p30; slug = SLUG in index.html)
//   node render.mjs --snap 2 6.5 9  → shots/t2.00.png … (half-size stills for review)
//   --page sample/index.html --slug cast-sample   render another composition
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30, DUR = 30;
const args = process.argv.slice(2);
const vert = args.includes('--9x16'); if (vert) args.splice(args.indexOf('--9x16'), 1);
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const pageFile = opt('--page', 'index.html'), slug = opt('--slug', 'for-sellers');
const snap = args[0] === '--snap';
const [VW, VH] = vert ? [1080, 1920] : [1920, 1080];
const url = (await serve(5179, pageFile)) + '?render=1' + (vert ? '&format=9x16' : '');

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}); }
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: snap ? 0.5 : 1 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
// Behind a TLS-re-terminating proxy (cloud sandboxes) Chromium may not trust the proxy CA;
// fetch external assets (CDN, fonts) from Node instead, which honours NODE_EXTRA_CA_CERTS.
if (process.env.HTTPS_PROXY) await page.route(/^https:/, async route => {
  try { const r = await fetch(route.request().url()); route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) }); }
  catch (e) { console.log('[route]', route.request().url(), e.message); route.abort(); }
});
page.on('console', m => m.type() === 'error' && console.log('[console]', m.text()));
await page.goto(url);
await page.evaluate(() => window.__ready);

if (snap) {
  mkdirSync(path.join(dir, 'shots'), { recursive: true });
  for (const t of args.slice(1).map(Number)) {
    await page.evaluate(t => window.__seek(t), t);
    const file = path.join(dir, 'shots', `${vert ? 'v' : 't'}${t.toFixed(2)}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close(); process.exit(0);
}

const vo = await page.evaluate(() => window.__vo.map(v => ({ src: v.src, at: v.at, gain: v.gain ?? 1 })));
const slug = await page.evaluate(() => window.__slug || 'for-sellers');
const frames = path.join(dir, 'frames');
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
mkdirSync(path.join(dir, 'out'), { recursive: true });
const total = FPS * DUR;
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.__seek(t), f / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
  if (f % 60 === 0) console.log(`frame ${f}/${total}`);
}
await browser.close();

let ffmpeg = 'ffmpeg';
try { ffmpeg = (await import('ffmpeg-static')).default || ffmpeg; } catch {}
const out = path.join(dir, 'out', `pamarket-${slug}${vert ? '-9x16' : ''}.mp4`);
const clips = vo.filter(v => existsSync(path.join(dir, v.src)));
console.log(`mixing ${clips.length} audio clips`);
const ff = ['-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.jpg')];
clips.forEach(c => ff.push('-i', path.join(dir, c.src)));
const hasMusic = false;
if (clips.length || hasMusic) {
  const parts = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}:all=1,volume=${c.gain}${c.src === "music.mp3" ? ",afade=t=out:st=28.3:d=1.7" : ""}[v${i}]`);
  const labels = clips.map((_, i) => `[v${i}]`);
  if (hasMusic) { parts.push(`[${clips.length + 1}:a]volume=0.16,afade=t=out:st=28:d=2[m]`); labels.push('[m]'); }
  parts.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0,alimiter=limit=0.95[a]`);
  ff.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
}
ff.push('-t', String(DUR), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
const r = spawnSync(ffmpeg, ff, { stdio: 'inherit' });
console.log(r.status === 0 ? `DONE → ${out}` : 'ffmpeg failed or not installed — frames are in ./frames');
process.exit(r.status === 0 ? 0 : 1);
