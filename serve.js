const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'www');
const mime = { html:'text/html', js:'application/javascript', css:'text/css', json:'application/json', png:'image/png', jpg:'image/jpeg', svg:'image/svg+xml', ico:'image/x-icon', webp:'image/webp', woff2:'font/woff2' };
http.createServer((req, res) => {
  let p = path.join(root, req.url.split('?')[0]);
  if (p === root || p === root + path.sep) p = path.join(root, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(p).slice(1);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(8080, () => console.log('PaMarket dev server: http://localhost:8080'));
