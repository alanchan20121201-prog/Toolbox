'use strict';

/**
 * 本地測試用靜態服務（可選）—— 在開發期以 localhost 模擬 GitHub 雲端。
 * 啟動後，主程式可將清單來源指向：
 *   http://127.0.0.1:8787/tools.json
 *
 * 用法：node dev-server/serve.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '8787', 10);

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/tools.json';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`Toolbox 本地清單服務已啟動 → http://127.0.0.1:${PORT}/tools.json`);
});
