import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/infographics');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 2880, height: 1782 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  const svg = await readFile(path.join(out, 'mmx-mission-profile.svg'), 'utf8');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:16in 9.9in;margin:0}html,body{margin:0;background:#101418}svg{display:block;width:100%;height:auto}@media print{svg{width:16in;height:9.9in}}</style></head><body>${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, 'mmx-mission-profile.png') });
  const python = process.env.ASTRO_PYTHON || path.join(os.homedir(), '.venvs/astro313/bin/python');
  execFileSync(python, ['-I', '-c', 'from PIL import Image; import sys; p=sys.argv[1]; im=Image.open(p); im.load(); im.save(p,dpi=(180,180))', path.join(out, 'mmx-mission-profile.png')]);
  await page.pdf({ path: path.join(out, 'mmx-mission-profile.pdf'), width: '16in', height: '9.9in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  await mkdir(path.join(root, 'test-results'), { recursive: true });
  await page.setViewportSize({ width: 1600, height: 990 });
  await page.screenshot({ path: path.join(root, 'test-results/infographic-preview.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Rendered 2880 × 1782 PNG and 16 × 9.9 inch vector PDF.');
} finally { await browser.close(); }
