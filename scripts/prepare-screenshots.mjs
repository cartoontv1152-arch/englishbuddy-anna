import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const records = JSON.parse(await readFile('output/screenshot-records.json', 'utf8'));
for (const record of records) {
  const target = `listing-assets/${record.name}.jpg`;
  await sharp(`output/${record.raw}.jpg`).extract(record.bounds).jpeg({ quality: 94 }).toFile(target);
  console.log(target);
}
