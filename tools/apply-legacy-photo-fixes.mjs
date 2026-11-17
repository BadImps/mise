/* Reapply the reviewed publisher-photo map to legacy records after rebuilds. */
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(new URL('../js/legacy-photo-fixes.js', import.meta.url), 'utf8'), context);
const fixes = context.window.MISE_LEGACY_PHOTO_FIXES;
let changed = 0;
for (const file of ['caribbean-sources.js', 'africa-sources.js']) {
  const path = new URL('../js/' + file, import.meta.url);
  const text = fs.readFileSync(path, 'utf8');
  const prefix = text.slice(0, text.indexOf('= [') + 2);
  const records = JSON.parse(text.slice(prefix.length).replace(/;\s*$/, ''));
  for (const record of records) {
    const image = fixes[record.sourceUrl];
    if (image === undefined || record.image === image) continue;
    if (!/wikimedia\.org/.test(record.image || '')) throw new Error(`Refusing to replace a non-Commons photograph: ${record.name}`);
    record.image = image;
    record.imageCredit = image ? `${record.source} (photograph on source page)` : '';
    changed++;
  }
  fs.writeFileSync(path, prefix + JSON.stringify(records, null, 2) + ';\n');
}
console.log(`Corrected ${changed} old recipe photographs`);
