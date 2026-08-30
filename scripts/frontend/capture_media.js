// Captures real screenshots and short GIFs of the frontend for the
// README -- every screen shown is driven by the same generated data file
// (frontend/data/generated/tier-b.latest.js) the app itself reads, never
// a mocked-up state. Requires `node scripts/frontend/generate_data.js` to
// have been run first.
//
// Uses Playwright (devDependency, headless Chromium) to load the app
// exactly the way a browser would, and the system `ffmpeg` binary (not
// an npm dependency -- an already-installed external tool, same category
// as relying on `git`/`bash` elsewhere in this project) only to convert
// Playwright's recorded .webm clips into .gif for the two animated
// moments. Screenshots need no such conversion.
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'assets');
const PORT = 4173;
const TIER = 'tier-b';
// tb-2 has a real multi-hop reachable_path (good trace diagram) and 8
// evidence entries including one SEARCH-type citation -- the richest
// single case to show off both the trace diagram and the evidence panel.
const CASE_ID = 'tb-2-marked-sanitize-bypass';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(FRONTEND_DIR, decodeURIComponent(urlPath));
    if (!filePath.startsWith(FRONTEND_DIR)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function screenshot(context, base, hash, outFile, waitSelector) {
  const page = await context.newPage();
  await page.goto(`${base}/index.html${hash}`, { waitUntil: 'networkidle' });
  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(700); // let entrance animations/count-ups settle
  await page.screenshot({ path: outFile, fullPage: true });
  await page.close();
  console.log('wrote', outFile);
}

async function recordGif(browser, base, videoDir, { hash, waitSelector, ms, gifName }) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 900 } },
  });
  await context.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
  const page = await context.newPage();
  await page.goto(`${base}/index.html${hash}`, { waitUntil: 'networkidle' });
  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(ms);
  const video = page.video();
  await context.close(); // flushes the recording to disk
  const videoPath = video ? await video.path() : null;
  if (!videoPath || !fs.existsSync(videoPath)) {
    console.warn('No video captured for', gifName);
    return;
  }

  const gifOut = path.join(OUT_DIR, gifName);
  const paletteOut = path.join(videoDir, `${path.basename(gifName, '.gif')}.palette.png`);
  execFileSync('ffmpeg', ['-y', '-i', videoPath, '-vf', 'fps=12,scale=760:-1:flags=lanczos,palettegen', paletteOut]);
  execFileSync('ffmpeg', [
    '-y', '-i', videoPath, '-i', paletteOut,
    '-filter_complex', 'fps=12,scale=760:-1:flags=lanczos[x];[x][1:v]paletteuse',
    gifOut,
  ]);
  console.log('wrote', gifOut);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch();

  const screens = [
    { name: 'landing', hash: '#/', wait: '.hero__title' },
    { name: 'dashboard', hash: `#/dashboard/${TIER}`, wait: '.case-table' },
    { name: 'case-detail', hash: `#/case/${TIER}/${CASE_ID}`, wait: '.evidence-list' },
    { name: 'comparison', hash: '#/compare', wait: '.compare-hero' },
  ];

  for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await context.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
    for (const s of screens) {
      await screenshot(context, base, s.hash, path.join(OUT_DIR, `${s.name}-${theme}.png`), s.wait);
    }
    await context.close();
  }

  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffm-capture-'));
  await recordGif(browser, base, videoDir, {
    hash: `#/replay/${TIER}/${CASE_ID}`,
    waitSelector: '.replay-stage',
    ms: 7000,
    gifName: 'demo-pipeline-replay.gif',
  });
  await recordGif(browser, base, videoDir, {
    hash: `#/case/${TIER}/${CASE_ID}`,
    waitSelector: '.trace-diagram',
    ms: 3200,
    gifName: 'demo-trace-diagram.gif',
  });
  fs.rmSync(videoDir, { recursive: true, force: true });

  await browser.close();
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
