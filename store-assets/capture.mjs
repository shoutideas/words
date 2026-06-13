import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const pagesDir = join(__dirname, 'pages');
const outDir = join(__dirname, 'output');

function findDistAsset(prefix, ext = '') {
  const assets = readdirSync(join(dist, 'assets'));
  const match = assets.find((name) => name.startsWith(prefix) && name.endsWith(ext));
  if (!match) throw new Error(`Missing dist asset with prefix "${prefix}"${ext}`);
  return `/dist/assets/${match}`;
}

function injectDistAssets(html) {
  const popupCss = findDistAsset('popup-', '.css');
  const logoInAssets = existsSync(join(dist, 'assets', 'ft.png'));
  const logo = logoInAssets ? '/dist/assets/ft.png' : '/dist/icons/128.png';
  return html
    .replaceAll('{{POPUP_CSS}}', popupCss)
    .replaceAll('{{WORD_CARD_CSS}}', '/dist/src/ui/word-card.css')
    .replaceAll('{{LOGO}}', logo);
}

function startServer() {
  const mime = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        let filePath = url.pathname;

        if (filePath.startsWith('/pages/')) {
          filePath = join(pagesDir, filePath.slice('/pages/'.length));
        } else if (filePath.startsWith('/dist/')) {
          filePath = join(root, filePath.slice(1));
        } else if (filePath === '/' || filePath === '') {
          res.writeHead(404);
          res.end('Not found');
          return;
        } else {
          filePath = join(pagesDir, filePath.replace(/^\//, ''));
        }

        const ext = filePath.slice(filePath.lastIndexOf('.'));
        const raw = readFileSync(filePath);
        const body =
          ext === '.html' ? Buffer.from(injectDistAssets(raw.toString('utf8')), 'utf8') : raw;

        res.writeHead(200, { 'Content-Type': mime[ext] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function capture(page, baseUrl, pageFile, viewport, outputName) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/pages/${pageFile}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(outDir, outputName),
    type: 'jpeg',
    quality: 92,
  });
  console.log(`Wrote ${outputName} (${viewport.width}x${viewport.height})`);
}

async function main() {
  if (!existsSync(join(dist, 'manifest.json'))) {
    console.log('Building extension…');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  }

  mkdirSync(outDir, { recursive: true });

  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  try {
    await capture(page, baseUrl, 'screenshot-reading.html', { width: 1280, height: 800 }, 'screenshot-1-reading.jpg');
    await capture(page, baseUrl, 'screenshot-popup.html', { width: 1280, height: 800 }, 'screenshot-2-popup.jpg');
    await capture(page, baseUrl, 'promo-small.html', { width: 440, height: 280 }, 'promo-small.jpg');
    await capture(page, baseUrl, 'promo-marquee.html', { width: 1400, height: 560 }, 'promo-marquee.jpg');
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nStore assets saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
