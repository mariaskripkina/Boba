// A tiny local web server for trying Boba Lab on your own computer.
//
//   npm run dev        (then open http://localhost:3000)
//
// It does two jobs, just like Vercel will once you deploy:
//   1. Serves the files in the public/ folder (the website).
//   2. Runs the files in api/ when the browser asks for /api/something.
//
// It uses only Node's built-in tools, so there is nothing to install.

import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Locally, show results after just 3 responses so you can test quickly.
// (On the live site the default is 10. See .env.example.)
process.env.MIN_RESPONSES ??= '3';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

async function handleApi(req, res, pathname) {
  const name = pathname.replace(/^\/api\//, '');
  if (!/^[a-z-]+$/.test(name)) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  try {
    const file = path.join(root, 'api', `${name}.js`);
    await fs.access(file);
    const module = await import(pathToFileURL(file).href);
    await module.default(req, res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.statusCode = 404;
      return res.end('Not found');
    }
    console.error(error);
    res.statusCode = 500;
    res.end('Server error');
  }
}

async function handleStatic(req, res, pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative.endsWith('/')) relative += 'index.html';
  const file = path.normalize(path.join(publicDir, relative));

  // Safety: never serve anything outside the public folder.
  if (!file.startsWith(publicDir + path.sep)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  try {
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Page not found');
  }
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
  return handleStatic(req, res, pathname);
});

server.listen(port, () => {
  console.log(`\nBoba Lab is running at http://localhost:${port}`);
  console.log('Answers are kept in memory while testing and reset when you stop this.');
  console.log('Press Ctrl+C to stop.\n');
});
