const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const PUBLIC_DIR = path.join(__dirname, 'docs');
const DAILY_NOTES_DIR = '/Users/remcovandenakker/SecondBrain/1. Persoonlijk/3.📝notities/1. Dagelijks';
const MAX_LOG_BODY_BYTES = 10000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
};

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Serialiseer schrijfacties: gelijktijdige verzoeken zouden elkaars regel anders overschrijven.
let logWriteQueue = Promise.resolve();

function appendToDailyLog(line, res) {
  const fileName = `${formatDateLocal(new Date())}.md`;
  const filePath = path.join(DAILY_NOTES_DIR, fileName);

  logWriteQueue = logWriteQueue.then(() => {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Dagnotitie niet gevonden: ${fileName}` }));
      return;
    }

    const trimmed = content.replace(/\s+$/, '');
    const hasLogHeading = /^## LOG\s*$/m.test(trimmed);
    const logIsEmpty = /## LOG$/.test(trimmed);
    const addition = !hasLogHeading
      ? `\n\n## LOG\n${line}`
      : (logIsEmpty ? `\n${line}` : `\n\n${line}`);

    try {
      fs.writeFileSync(filePath, `${trimmed}${addition}\n`, 'utf8');
    } catch (writeErr) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Kon dagnotitie niet opslaan' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  }).catch(() => {});
}

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];

  if (req.method === 'POST' && pathname === '/api/log') {
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_LOG_BODY_BYTES) {
        tooLarge = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Body te groot' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      let data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ongeldige JSON' }));
        return;
      }
      const line = typeof data.line === 'string' ? data.line.trim() : '';
      if (!line) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ontbrekende tekst' }));
        return;
      }
      appendToDailyLog(line, res);
    });
    return;
  }

  const urlPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, urlPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Timer draait op http://localhost:${PORT}`);
});
