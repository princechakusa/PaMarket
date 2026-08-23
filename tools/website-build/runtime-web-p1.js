'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { ROOT } = require('./file-utils');

const SITE = path.join(ROOT, 'dist-site');
const PORT = 4174;

function localFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  let file = path.join(SITE, clean === '/' ? 'index.html' : clean.replace(/^\//, ''));
  if (!path.extname(file)) {
    const index = path.join(file, 'index.html');
    file = fs.existsSync(index) ? index : file + '.html';
  }
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
      res.end(body);
    });
  });
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const routes = [
    ['home', '/'],
    ['browse', '/browse'],
    ['business dynamic', '/business?id=fd5bc54a-78ae-45ee-bed9-ea596f7bce17'],
    ['business canonical', '/b/pue-s-fashion-hats-and-fascinators-fd5bc54a-78ae-45ee-bed9-ea596f7bce17'],
    ['rentals', '/rentals'],
    ['rental canonical', '/r/land-rover-range-rover-2026-4d010f8b-02b3-4a55-8171-b4cc71a9d78d'],
    ['listing canonical', '/l/iphones-and-androids-for-sell-1cce0cbf-bb10-4d02-8f75-b1fa660c3f7d'],
    ['profile', '/profile?id=e85046b4-27a1-4be2-b813-3f47a6c14fce'],
    ['sitemap', '/sitemap.xml'],
  ];
  const results = [];
  try {
    for (const [name, route] of routes) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push('page: ' + error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
      page.on('requestfailed', request => errors.push('request: ' + request.url() + ' ' + (request.failure()?.errorText || 'failed')));
      page.on('response', response => {
        if (response.status() >= 400 && response.url().includes('supabase.co')) errors.push('HTTP ' + response.status() + ': ' + response.url());
      });
      const response = await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2500);
      assert.equal(response.status(), 200, `${name} local HTTP status`);
      if (name === 'sitemap') assert.match(await page.textContent('body'), /<urlset/);
      const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
      if (name.startsWith('business') || name === 'profile') {
        assert.equal(links.filter(href => /(?:^|\/)detail\?id=/.test(href || '')).length, 0, `${name} legacy listing links`);
      }
      if (name === 'rentals') {
        assert.equal(links.filter(href => /rental-detail\?id=/.test(href || '')).length, 0, 'rentals legacy links');
      }
      assert.deepEqual(errors, [], `${name} browser errors: ${JSON.stringify(errors)}`);
      results.push({ name, status: response.status(), links: links.length, errors: 0 });
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(JSON.stringify({ ok: true, routes: results }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
