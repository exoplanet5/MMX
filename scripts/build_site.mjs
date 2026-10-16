import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'web/vendor/three');
const result = await build({
  entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false, format: 'iife',
  target: ['es2022'], minify: true, legalComments: 'inline',
  plugins: [{ name: 'local-three', setup(builder) {
    builder.onResolve({ filter: /^three$/ }, () => ({ path: path.join(vendor, 'three.module.min.js') }));
    builder.onResolve({ filter: /^three\/addons\// }, args => ({ path: path.join(vendor, args.path.slice(6)) }));
  } }],
});
const [template, data, image, threeLicense, referenceLicense] = await Promise.all([
  readFile(path.join(root, 'web/index.template.html'), 'utf8'),
  readFile(path.join(root, 'docs/data/ephemeris.json'), 'utf8'),
  readFile(path.join(root, 'web/assets/earth_day.jpg')),
  readFile(path.join(vendor, 'LICENSE'), 'utf8'),
  readFile(path.join(root, 'web/vendor/STARSHIP_LICENSE'), 'utf8'),
]);
const license = `/* Three.js r170\n${threeLicense}\nLayout/control patterns adapted from Starship IFT-14\n${referenceLicense}\n*/\n`;
const html = template.replace('{{EPHEMERIS_JSON}}', () => data.replaceAll('<', '\\u003c'))
  .replace('{{EARTH_TEXTURE}}', () => 'data:image/jpeg;base64,' + image.toString('base64'))
  .replace('{{APP_SCRIPT}}', () => (license + result.outputFiles[0].text).replaceAll('</script', '<\\/script'))
  .replace(/[\t ]+$/gm, '');
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template placeholder');
await mkdir(path.join(root, 'docs'), { recursive: true });
await writeFile(path.join(root, 'docs/index.html'), html);
await writeFile(path.join(root, 'docs/.nojekyll'), '');
console.log(`Built standalone docs/index.html (${(Buffer.byteLength(html) / 1048576).toFixed(2)} MiB). No runtime imports or data fetches.`);
