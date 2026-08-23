'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { ROOT } = require('./file-utils');

const SITE = path.join(ROOT, 'dist-site');
const PORT = 4175;
const IMAGE_PATH = '/img/pamarket-social-share.png';
const IMAGE_URL = `https://pamarketzw.com${IMAGE_PATH}`;

function localFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  let file = path.join(SITE, clean === '/' ? 'index.html' : clean.replace(/^\//, ''));
  if (!path.extname(file)) file += '.html';
  return file;
}

async function main() {
  const server = http.createServer((req, res) => {
    const file = localFile(req.url);
    fs.readFile(file, (error, body) => {
      if (error) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, path.extname(file) === '.png' ? { 'Content-Type': 'image/png' } : {});
      res.end(body);
    });
  });
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const imageResponse = await fetch(`http://127.0.0.1:${PORT}${IMAGE_PATH}`);
    assert.equal(imageResponse.status, 200, 'social image local HTTP status');
    assert.equal(imageResponse.headers.get('content-type'), 'image/png');
    assert.ok((await imageResponse.arrayBuffer()).byteLength > 0, 'social image response must not be empty');

    const page = await browser.newPage();
    const response = await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200, 'homepage local HTTP status');
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), IMAGE_URL);
    assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), IMAGE_URL);
    assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary_large_image');
    await page.close();
    console.log(JSON.stringify({ ok: true, homepageStatus: response.status(), imageStatus: imageResponse.status }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
