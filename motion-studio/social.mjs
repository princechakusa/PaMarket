// Opens a persistent Chrome profile (login survives restarts) with a CDP port so
// short helper scripts can drive Meta Business Suite step by step.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
spawn(chrome, ['--remote-debugging-port=9333', `--user-data-dir=${path.join(dir, '.social-profile')}`, '--start-maximized', '--no-first-run', 'https://business.facebook.com/latest/home'], { detached: true, stdio: 'ignore' }).unref();
console.log('opened');
