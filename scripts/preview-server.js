// 本機預覽用的迷你 HTTP server。
// 純粹是因為瀏覽器直接開 file:// 無法載入 ES module 與 fetch data.json。
// 部署到 GitHub Pages 時不會用到。

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = 8080;
const ROOT = process.cwd();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 防止 path traversal:normalize 後若超出 ROOT 就拒絕。
  const fullPath = normalize(join(ROOT, urlPath));
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  try {
    const body = await readFile(fullPath);
    const type =
      CONTENT_TYPES[extname(fullPath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`preview: http://localhost:${PORT}`);
});
