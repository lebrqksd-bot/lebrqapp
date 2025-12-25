// Patch constants/events.ts to point to generated images using require()
// Usage: node scripts/wire-generated-images.mjs

import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.cwd(), 'constants', 'events.ts');
let src = fs.readFileSync(filePath, 'utf8');

const map = {
  t1: "require('../assets/images/generated/t1.jpg')",
  t2: "require('../assets/images/generated/t2.jpg')",
  t3: "require('../assets/images/generated/t3.jpg')",
  r1: "require('../assets/images/generated/r1.jpg')",
  r2: "require('../assets/images/generated/r2.jpg')",
  r3: "require('../assets/images/generated/r3.jpg')",
  r4: "require('../assets/images/generated/r4.jpg')",
};

let replaced = 0;
for (const [id, reqStr] of Object.entries(map)) {
  const re = new RegExp(`(id:\\s*'${id}'[\\s\\S]*?\\bimage:)\\s*undefined`, 'm');
  if (re.test(src)) {
    src = src.replace(re, `$1 ${reqStr}`);
    replaced++;
  }
}

fs.writeFileSync(filePath, src);
console.log(`Updated images for ${replaced} items in constants/events.ts`);
