import { readFile } from 'node:fs/promises';
const expectedSlug = 'englishbuddy-chat';
const expectedAppId = 616;
const app = JSON.parse(await readFile('app.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (app.slug !== expectedSlug || app.version !== pkg.version) throw new Error('App identity or package version differs from the EnglishBuddy release contract.');
for (const file of ['.anna/app.json', '.anna/dev-app.json']) {
  let cache;
  try { cache = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const slug = cache.slug ?? cache.app_slug;
  const id = cache.app_id ?? cache.appId;
  if (slug && slug !== expectedSlug) throw new Error(`${file} refers to another app slug.`);
  if (id && Number(id) !== expectedAppId) throw new Error(`${file} refers to another app ID.`);
  if (cache.host && cache.host.replace(/\/$/, '') !== 'https://anna.partners') throw new Error(`${file} refers to another Anna host.`);
}
console.log('EnglishBuddy identity checked: englishbuddy-chat, Anna app 616, version ' + app.version);
