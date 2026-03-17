import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>myparts upload</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, sans-serif;
      background: #111;
      color: #eee;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 24px;
    }
    h1 { font-size: 1.2rem; font-weight: 600; opacity: 0.7; letter-spacing: 0.05em; }
    label {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 200px;
      height: 200px;
      border: 2px dashed #555;
      border-radius: 20px;
      cursor: pointer;
      font-size: 4rem;
      transition: border-color 0.2s, background 0.2s;
    }
    label:active { background: #222; border-color: #888; }
    label span { font-size: 0.9rem; opacity: 0.5; }
    input[type=file] { display: none; }
    #status {
      font-size: 1rem;
      min-height: 1.5em;
      text-align: center;
      transition: color 0.3s;
    }
    .ok  { color: #4caf50; }
    .err { color: #f44336; }
    .sending { color: #888; }
  </style>
</head>
<body>
  <h1>myparts</h1>
  <label for="file">
    📷
    <span>tap to take photo</span>
  </label>
  <input type="file" id="file" accept="image/*" capture="environment">
  <div id="status"></div>
  <script>
    const input = document.getElementById('file');
    const status = document.getElementById('status');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      status.className = 'sending';
      status.textContent = 'uploading…';
      try {
        const res = await fetch('/upload', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-Filename': encodeURIComponent(file.name),
          },
          body: file,
        });
        const data = await res.json();
        if (res.ok) {
          status.className = 'ok';
          status.textContent = '✓ uploaded: ' + data.filename;
        } else {
          throw new Error(data.error || res.statusText);
        }
      } catch (e) {
        status.className = 'err';
        status.textContent = '✗ ' + e.message;
      }
      input.value = '';
    });
  </script>
</body>
</html>`;

let _uploadUrls = [];
export function getUploadUrls() { return _uploadUrls; }

function getLocalIPs() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i.family === 'IPv4' && !i.internal)
    .map(i => i.address);
}

export async function startUploadServer(uploadsDir, port) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML);
      return;
    }

    if (req.method === 'POST' && req.url === '/upload') {
      const rawName = req.headers['x-filename'];
      const originalName = rawName ? decodeURIComponent(rawName) : 'photo';
      const ext = path.extname(originalName) || '.jpg';
      const filename = `${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFile(filePath, buf, err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ filename }));
          }
        });
      });
      req.on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  function bind(p) {
    return new Promise((resolve, reject) => {
      server.listen(p, '0.0.0.0', () => resolve(server.address().port));
      server.once('error', reject);
    });
  }

  let boundPort;
  try {
    boundPort = await bind(port);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      server.removeAllListeners('error');
      boundPort = await bind(0);
    } else {
      throw err;
    }
  }

  const ips = getLocalIPs();
  _uploadUrls = ips.length
    ? ips.map(ip => `http://${ip}:${boundPort}`)
    : [`http://localhost:${boundPort}`];
  process.stderr.write(`[myparts] photo upload ready:\n${_uploadUrls.map(u => `  ${u}`).join('\n')}\n`);

  return server;
}

export function getLatestPhoto(uploadsDir) {
  if (!fs.existsSync(uploadsDir)) return null;
  const files = fs.readdirSync(uploadsDir)
    .filter(f => /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(uploadsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) return null;
  const file = files[0];
  const filePath = path.join(uploadsDir, file.name);
  const data = fs.readFileSync(filePath);
  const ext = path.extname(file.name).toLowerCase().replace('.', '');
  const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
  const mimeType = mimeMap[ext] ?? 'image/jpeg';
  return { filename: file.name, filePath, data: data.toString('base64'), mimeType };
}
