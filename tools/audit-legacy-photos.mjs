/* Read-only audit of suspicious legacy Commons matches. Run from repo root.
   The report is evidence for manual review; it never changes recipe records. */
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
for (const file of ['caribbean-sources.js', 'africa-sources.js']) {
  vm.runInContext(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
}
const records = [...context.window.MISE_CARIBBEAN_SOURCES, ...context.window.MISE_AFRICA_SOURCES];
const suspicious = /headquarters|conky.orange|pom-pom.girls|medieval.coin|personvagn|portree|pan.ak.u.obce|caribbean.sea|mcbean|home.architecture|puffing.billy|thumbnail\.jpg/i;
const targets = records.filter(r => suspicious.test(decodeURIComponent(r.image || '')));
for (const record of targets) {
  try {
    const response = await fetch(record.sourceUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const image = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0]?.match(/content=["']([^"']+)["']/i)?.[1] || '';
    console.log(JSON.stringify({ name: record.name, sourceUrl: record.sourceUrl, current: record.image, ogImage: image.replace(/&amp;/g, '&') }));
  } catch (error) {
    console.log(JSON.stringify({ name: record.name, sourceUrl: record.sourceUrl, error: error.message }));
  }
}
