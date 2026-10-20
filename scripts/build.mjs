import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('bundle/assets', { recursive: true });
await mkdir('listing-assets', { recursive: true });
await build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', target: 'es2022', outfile: 'bundle/app.js', minify: true, external: ['/static/*'], loader: { '.svg': 'text' }, legalComments: 'eof' });
await copyFile('src/index.html', 'bundle/index.html');
await copyFile('src/styles.css', 'bundle/styles.css');
await copyFile('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'bundle/assets/geist-latin-wght-normal.woff2');
await copyFile('node_modules/@fontsource-variable/geist/LICENSE', 'bundle/assets/Geist-LICENSE.txt');
await copyFile('node_modules/@phosphor-icons/core/LICENSE', 'bundle/assets/Phosphor-LICENSE.txt');
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="114" fill="#26352e"/><path d="M110 146h292v180a42 42 0 0 1-42 42H233l-63 46v-46h-18a42 42 0 0 1-42-42z" fill="#e5eedb"/><path d="M184 253h142m-142 45h94" fill="none" stroke="#5b7450" stroke-width="21" stroke-linecap="round"/></svg>`;
await writeFile('bundle/assets/favicon.svg', logo);
await sharp(Buffer.from(logo)).png().toFile('listing-assets/englishbuddy-logo.png');
console.log('Built EnglishBuddy: bundled JavaScript, local font, icons, and logo.');
