#!/usr/bin/env node
/*!
 * PaMarket — strip the admin console out of the native app bundles.
 *
 * WHY: Capacitor copies the whole `webDir` (www/) into android/ and ios/. That
 * shipped admin.html — the full operations console, with every table name and
 * expected RLS policy — inside every installed app. It was only ever protected
 * by RLS; there is no reason to hand it to a million phones.
 *
 * The app still reaches the console: H.authLogoTap() opens the HOSTED admin
 * (https://pamarketzw.com/admin.html) in the system browser on native.
 *
 * RUN THIS AFTER EVERY `npx cap copy` / `npx cap sync`:
 *     node scripts/strip-admin.js
 * (or use `npm run sync`, which chains them — see package.json)
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Files that must never ship inside the native bundles.
const STRIP = ['admin.html'];

const TARGETS = [
  path.join('android', 'app', 'src', 'main', 'assets', 'public'),
  path.join('ios', 'App', 'App', 'public'),
  // Android packages a second copy under build/intermediates on release builds.
  path.join('android', 'app', 'build', 'intermediates', 'assets', 'release', 'mergeReleaseAssets', 'public'),
];

let removed = 0;
let scanned = 0;

for (const dir of TARGETS) {
  if (!fs.existsSync(dir)) continue;
  scanned++;
  for (const name of STRIP) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      removed++;
      console.log('  removed ' + file);
    }
  }
}

if (!scanned) {
  console.log('strip-admin: no native bundle directories found (nothing to do).');
} else if (!removed) {
  console.log('strip-admin: bundles already clean (' + scanned + ' checked).');
} else {
  console.log('strip-admin: removed ' + removed + ' file(s) from ' + scanned + ' bundle dir(s).');
}
