'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function loadDownloadApi() {
  const listeners = {};
  const context = {
    URLSearchParams,
    window: {
      navigator: {},
      location: { search: '', replace() {} },
      setTimeout() {},
    },
    document: {
      readyState: 'loading',
      addEventListener(name, callback) { listeners[name] = callback; },
      documentElement: { dataset: {} },
      getElementById() { return null; },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'download.js'), 'utf8'), context, {
    filename: 'js/download.js',
  });
  return context.window.PMDownload;
}

function characterizeDownloadPage() {
  const api = loadDownloadApi();
  let assertions = 0;

  assert.equal(api.detectPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' }), 'android'); assertions++;
  assert.equal(api.detectPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), 'ios'); assertions++;
  assert.equal(api.detectPlatform({ platform: 'MacIntel', maxTouchPoints: 5 }), 'ios'); assertions++;
  assert.equal(api.detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', platform: 'Win32' }), null); assertions++;
  assert.equal(api.getDecision({ search: '?store=android', userAgent: 'Desktop' }).platform, 'android'); assertions++;
  assert.equal(api.getDecision({ search: '?store=ios', userAgent: 'Desktop' }).platform, 'ios'); assertions++;
  assert.equal(api.getDecision({ search: '?store=ios&no_redirect=1', userAgent: 'iPhone' }).redirect, false); assertions++;
  assert.equal(api.getDecision({ search: '', userAgent: 'facebookexternalhit/1.1' }).redirect, false); assertions++;
  assert.equal(api.getDecision({ search: '', userAgent: 'Googlebot' }).redirect, false); assertions++;
  assert.equal(api.STORE_URLS.android, 'https://play.google.com/store/apps/details?id=com.pamarket.app'); assertions++;
  assert.equal(api.STORE_URLS.ios, 'https://apps.apple.com/app/id6794616959'); assertions++;

  const html = fs.readFileSync(path.join(ROOT, 'download.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/pamarketzw\.com\/download">/); assertions++;
  assert.match(html, /img\/google-play-badge\.png/); assertions++;
  assert.match(html, /img\/app-store-badge\.svg/); assertions++;
  assert.match(html, /img\/screens\/screen-home\.png/); assertions++;

  return { assertions };
}

if (require.main === module) {
  console.log(JSON.stringify({ ok: true, ...characterizeDownloadPage() }, null, 2));
}

module.exports = { characterizeDownloadPage };
