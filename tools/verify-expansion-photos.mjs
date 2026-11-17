/* Optional network check for the source thumbnails (not run by offline tests).
   node tools/verify-expansion-photos.mjs */
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(new URL('../js/expansion.js', import.meta.url), 'utf8'), context);
const items = context.window.MISE_EXPANSION.drinks;
const failed = [];
let cursor = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < items.length) {
    const item = items[cursor++];
    try {
      const res = await fetch(item.image, {
        method: 'HEAD',
        signal: AbortSignal.timeout(12000),
        headers: { 'user-agent': 'Mise personal image QA (https://github.com/BadImps/mise)' },
      });
      if (!res.ok || !String(res.headers.get('content-type') || '').startsWith('image/')) {
        failed.push(`${item.name}: ${res.status} ${res.headers.get('content-type')}`);
      }
    } catch (error) {
      failed.push(`${item.name}: ${error.message}`);
    }
  }
}));
console.log(`Checked ${items.length} source photographs; ${failed.length} failed.`);
if (failed.length) {
  console.error(failed.join('\n'));
  process.exitCode = 1;
}
