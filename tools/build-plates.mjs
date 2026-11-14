/* Mise / plate artwork.
   Writes the programmatic SVG cover plates used for records that have no
   publisher photograph. Charcoal and brass, line-art, one plate per dish
   style. Deterministic; run from the project root:

     node tools/build-plates.mjs
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets', 'plates');
fs.mkdirSync(OUT, { recursive: true });

const BRASS = '#cdb069';
const GOLD = '#e9cd85';
const STROKE = `stroke="${BRASS}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
const FILL_BRASS = `fill="${BRASS}"`;
const FILL_GOLD = `fill="${GOLD}"`;

const chrome = (body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" role="img" aria-label="${label}">
  <defs>
    <radialGradient id="halo" cx="50%" cy="40%" r="78%">
      <stop offset="0" stop-color="#2b2e33"/>
      <stop offset="1" stop-color="#17191b"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="#ffffff" fill-opacity="0.045"/>
    </pattern>
  </defs>
  <rect width="480" height="270" fill="url(#halo)"/>
  <rect width="480" height="270" fill="url(#dots)"/>
  <ellipse cx="240" cy="203" rx="140" ry="14" fill="#000000" fill-opacity="0.38"/>
  ${body}
</svg>
`;

const steam = (x) => `<path d="M${x} 92 q-6 -10 0 -20 q6 -10 0 -20" ${STROKE} opacity="0.85"/>`;

const plates = [
  ['feast', 'A covered dish and cutlery, the house plate', `<path d="M164 150 a76 76 0 0 1 152 0 Z" ${STROKE}/>
    <path d="M158 158 h164" ${STROKE}/>
    <circle cx="240" cy="66" r="5.5" ${FILL_BRASS}/>
    <path d="M240 60 v-8" ${STROKE}/>
    <path d="M110 128 v46 M102 134 v14 a8 8 0 0 0 16 0 v-14" ${STROKE} opacity="0.9"/>
    <path d="M368 128 l0 40 M360 128 v16 a10 10 0 0 0 20 0 v-16" ${STROKE} opacity="0.9"/>
    <path d="M240 176 v18" ${STROKE} opacity="0.5"/>`],

  ['rice', 'A bowl of rice with chopsticks', `<ellipse cx="240" cy="118" rx="112" ry="12" ${STROKE}/>
    <path d="M132 120 C140 190 180 212 240 212 C300 212 340 190 348 120" ${STROKE}/>
    <ellipse cx="240" cy="118" rx="112" ry="12" ${STROKE} opacity="0.6"/>
    <circle cx="196" cy="120" r="3" ${FILL_BRASS}/><circle cx="232" cy="114" r="3" ${FILL_BRASS}/><circle cx="268" cy="121" r="3" ${FILL_BRASS}/><circle cx="300" cy="116" r="3" ${FILL_BRASS}/><circle cx="215" cy="127" r="2.4" ${FILL_BRASS}/><circle cx="252" cy="126" r="2.4" ${FILL_BRASS}/>
    <path d="M300 74 L380 22 M316 88 L392 36" ${STROKE}/>`],

  ['curry', 'A karahi of curry over flame', `<path d="M132 128 C144 196 178 214 240 214 C302 214 336 196 348 128 Z" ${STROKE}/>
    <path d="M124 128 h232" ${STROKE}/>
    <path d="M124 128 c-14 0 -22 -8 -22 -18 M356 128 c14 0 22 -8 22 -18" ${STROKE}/>
    <circle cx="200" cy="166" r="4" ${FILL_BRASS}/><circle cx="286" cy="166" r="4" ${FILL_BRASS}/><circle cx="244" cy="184" r="4" ${FILL_BRASS}/>
    <path d="M204 216 q10 16 0 22 M240 216 q10 16 0 22 M276 216 q10 16 0 22" ${STROKE} opacity="0.9"/>`],

  ['soup', 'A bowl of soup with spoon', `<path d="M132 138 h216" ${STROKE}/>
    <path d="M150 142 C158 192 190 208 240 208 C290 208 322 192 330 142" ${STROKE}/>
    ${steam(210)}${steam(240)}${steam(270)}
    <path d="M330 150 L384 96 M376 104 l10 -10" ${STROKE}/>`],

  ['stew', 'A dutch oven of stew with ladle', `<path d="M136 132 h208 v44 a40 40 0 0 1 -40 40 H176 a40 40 0 0 1 -40 -40 Z" ${STROKE}/>
    <path d="M116 136 h20 M344 136 h20" ${STROKE}/>
    <path d="M136 104 v-8 a16 16 0 0 1 16 -16 h176 a16 16 0 0 1 16 16 v8" ${STROKE} opacity="0.9"/>
    <circle cx="200" cy="176" r="4.5" ${FILL_BRASS}/><circle cx="282" cy="176" r="4.5" ${FILL_BRASS}/><circle cx="240" cy="152" r="4.5" ${FILL_BRASS}/>
    <path d="M240 84 v-18" ${STROKE} opacity="0.8"/>`],

  ['fish', 'A plated fish with lemon', `<ellipse cx="240" cy="150" rx="150" ry="20" ${STROKE} opacity="0.9"/>
    <path d="M150 150 C200 106 280 106 330 150 C280 194 200 194 150 150 Z" ${STROKE}/>
    <path d="M330 150 l36 -22 M330 150 l36 22" ${STROKE}/>
    <circle cx="205" cy="146" r="4" ${FILL_BRASS}/>
    <path d="M225 140 l14 14 M245 136 l14 14 M265 136 l14 14" ${STROKE} opacity="0.8"/>
    <circle cx="330" cy="120" r="10" ${STROKE} opacity="0.85"/><path d="M322 120 h16 M330 112 v16" ${STROKE} opacity="0.85"/>`],

  ['chicken', 'Two drumsticks and a breast', `<ellipse cx="240" cy="168" rx="138" ry="16" ${STROKE} opacity="0.9"/>
    <path d="M168 132 a26 26 0 0 1 34 0 l-6 26 a22 22 0 0 1 -40 0 Z" ${STROKE}/>
    <path d="M160 160 l-12 12" ${STROKE}/><circle cx="143" cy="177" r="5" ${FILL_BRASS}/><circle cx="158" cy="178" r="5" ${FILL_BRASS}/>
    <path d="M268 108 a30 30 0 0 1 38 0 l-6 30 a24 24 0 0 1 -40 0 Z" ${STROKE}/>
    <path d="M262 141 l-10 10" ${STROKE}/><circle cx="248" cy="158" r="5" ${FILL_BRASS}/><circle cx="262" cy="160" r="5" ${FILL_BRASS}/>
    <circle cx="240" cy="150" r="2.6" ${FILL_BRASS}/><circle cx="210" cy="132" r="2.6" ${FILL_BRASS}/>`],

  ['meat', 'A seared cutlet with bone', `<ellipse cx="240" cy="176" rx="140" ry="15" ${STROKE} opacity="0.9"/>
    <path d="M160 128 c0-30 34-44 66-44 c40 0 78 18 78 54 c0 24 -28 38 -68 38 c-40 0 -76-16 -76-48 Z" ${STROKE}/>
    <path d="M204 112 l20 20 M236 104 l20 20 M268 100 l20 20" ${STROKE} opacity="0.85"/>
    <path d="M150 140 v22 M130 138 v10" ${STROKE} opacity="0.85"/>`],

  ['breakfast', 'A skillet with fried egg and bacon', `<circle cx="222" cy="150" r="66" ${STROKE}/>
    <path d="M288 150 h46" ${STROKE}/><path d="M326 138 v24" ${STROKE} opacity="0.8"/>
    <path d="M192 150 q30 -34 66 -8 q-28 26 -66 8 Z" stroke="#cdb069" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="${GOLD}" fill-opacity="0.18"/>
    <circle cx="226" cy="148" r="14" ${FILL_GOLD} fill-opacity="0.9" opacity="0.9"/>
    <path d="M356 96 q-8 -8 0 -16 M372 104 q-8 -8 0 -16" ${STROKE} opacity="0.8"/>`],

  ['roti', 'A stack of rotis', `<ellipse cx="222" cy="150" rx="96" ry="18" ${STROKE}/>
    <ellipse cx="240" cy="120" rx="96" ry="18" ${STROKE} opacity="0.85"/>
    <ellipse cx="222" cy="96" rx="96" ry="18" ${STROKE} opacity="0.7"/>
    <circle cx="200" cy="92" r="3" ${FILL_BRASS}/><circle cx="240" cy="90" r="2.4" ${FILL_BRASS}/><circle cx="262" cy="100" r="2.4" ${FILL_BRASS}/><circle cx="216" cy="104" r="2.2" ${FILL_BRASS}/>
    <path d="M330 96 l14 -14 M344 100 l14 -14" ${STROKE} opacity="0.75"/>`],

  ['bread', 'A loaf of bread and wheat', `<path d="M140 168 a66 66 0 0 1 0-44 a96 40 0 0 1 200 0 a66 66 0 0 1 0 44 Z" ${STROKE}/>
    <path d="M186 122 l24 16 M236 116 l24 16 M286 122 l24 16" ${STROKE} opacity="0.85"/>
    <path d="M368 92 v64 M368 112 q18 -10 18 -28 M368 132 q20 -8 20 -28 M368 152 q22 -6 22 -28" ${STROKE} opacity="0.85"/>`],

  ['dessert', 'A slice of cake with berries and fork', `<path d="M132 176 L132 108 L264 172 Z" ${STROKE}/>
    <path d="M132 140 L210 150" ${STROKE} opacity="0.8"/>
    <path d="M132 158 L184 166" ${STROKE} opacity="0.8"/>
    <path d="M264 172 h40 a14 14 0 0 0 14-14" ${STROKE} opacity="0.7"/>
    <circle cx="216" cy="96" r="8" ${FILL_GOLD} fill-opacity="0.85"/>
    <circle cx="236" cy="100" r="6.5" ${FILL_GOLD} fill-opacity="0.85"/>
    <path d="M360 80 v40 M352 80 v16 a8 8 0 0 0 16 0 v-16" ${STROKE} opacity="0.85"/>`],

  ['drink', 'A tall glass with straw and lime', `<path d="M196 60 h88 l-10 150 h-68 Z" ${STROKE}/>
    <path d="M210 116 h60" ${STROKE} opacity="0.7"/>
    <path d="M240 60 L280 16" ${STROKE}/>
    <circle cx="316" cy="170" r="13" ${STROKE} opacity="0.9"/><path d="M308 170 h16 M316 162 v16" ${STROKE} opacity="0.9"/>
    <circle cx="236" cy="140" r="3.4" ${FILL_BRASS} opacity="0.9"/><circle cx="260" cy="166" r="3.4" ${FILL_BRASS} opacity="0.9"/>`],

  ['veg', 'A bowl of greens', `<ellipse cx="240" cy="140" rx="108" ry="14" ${STROKE}/>
    <path d="M140 142 C152 192 190 210 240 210 C292 210 330 192 340 142" ${STROKE}/>
    <path d="M200 132 q-14 -26 10 -44 q10 16 -4 30 q-6 12 -6 14 Z" ${STROKE}/>
    <path d="M240 128 q-4 -30 18 -42 q6 18 -6 30 q-6 10 -4 12 Z" ${STROKE} opacity="0.9"/>
    <path d="M282 132 q10 -26 -12 -40 q-12 12 2 28 q4 10 10 12 Z" ${STROKE} opacity="0.8"/>
    <circle cx="222" cy="182" r="2.6" ${FILL_BRASS}/><circle cx="260" cy="176" r="2.6" ${FILL_BRASS}/>`],

  ['pasta', 'A nest of pasta and fork', `<ellipse cx="228" cy="150" rx="104" ry="16" ${STROKE} opacity="0.9"/>
    <circle cx="228" cy="140" r="46" ${STROKE}/>
    <path d="M196 132 a34 34 0 0 1 64 6 M208 154 a30 30 0 0 0 40 -8 M238 128 a26 26 0 0 1 18 32" ${STROKE} opacity="0.85"/>
    <path d="M330 84 v64 M322 84 v16 a8 8 0 0 0 16 0 v-16" ${STROKE}/>
    <path d="M322 92 h16" ${STROKE} opacity="0.75"/>`],

  ['noodle', 'A bowl of noodles with chopsticks', `<ellipse cx="240" cy="128" rx="112" ry="13" ${STROKE}/>
    <path d="M132 130 C142 196 186 214 240 214 C294 214 338 196 348 130" ${STROKE}/>
    <path d="M204 96 v30 M224 92 v30 M244 92 v30 M264 96 v30" ${STROKE} opacity="0.9"/>
    <path d="M294 66 L384 28 M312 80 L392 48" ${STROKE}/>`],

  ['snack', 'Three patties and a dip bowl', `<ellipse cx="150" cy="186" rx="64" ry="12" ${STROKE} opacity="0.8"/>
    <path d="M104 168 L140 122 L176 168 Z" ${STROKE}/>
    <path d="M150 176 L186 130 L222 176 Z" ${STROKE} opacity="0.9"/>
    <path d="M196 184 L230 140 L266 184 Z" ${STROKE} opacity="0.8"/>
    <ellipse cx="330" cy="176" rx="42" ry="10" ${STROKE} opacity="0.9"/>
    <path d="M296 178 C302 206 316 212 330 212 C344 212 358 206 364 178" ${STROKE} opacity="0.9"/>
    <circle cx="140" cy="158" r="2.2" ${FILL_BRASS}/><circle cx="186" cy="164" r="2.2" ${FILL_BRASS}/><circle cx="232" cy="172" r="2.2" ${FILL_BRASS}/>`],

  ['pickle', 'A jar of pickles and peppers', `<path d="M168 88 h76 a14 14 0 0 1 14 14 v106 a16 16 0 0 1 -16 16 h-72 a16 16 0 0 1 -16 -16 V102 a14 14 0 0 1 14 -14 Z" ${STROKE}/>
    <path d="M168 88 v-8 a10 10 0 0 1 10-10 h56 a10 10 0 0 1 10 10 v8" ${STROKE}/>
    <path d="M190 120 q10 10 0 20 M232 118 q-10 12 0 22 M212 160 q8 8 0 16" ${STROKE} opacity="0.85"/>
    <path d="M320 140 q30 -14 44 8 q-18 18 -44 0 Z M328 152 l-12 14" ${STROKE} opacity="0.9"/>
    <path d="M320 112 q22 -22 40 2 q-14 18 -40 0 Z M326 120 l-10 10" ${STROKE} opacity="0.75"/>`],

  ['beans', 'A bowl of channa or dhal', `<ellipse cx="240" cy="134" rx="104" ry="14" ${STROKE}/>
    <path d="M140 136 C152 196 190 212 240 212 C292 212 330 196 340 136" ${STROKE}/>
    <circle cx="196" cy="132" r="5" ${FILL_BRASS}/><circle cx="228" cy="126" r="5" ${FILL_BRASS}/><circle cx="262" cy="130" r="5" ${FILL_BRASS}/><circle cx="292" cy="126" r="5" ${FILL_BRASS}/><circle cx="214" cy="142" r="4" ${FILL_BRASS}/><circle cx="246" cy="146" r="4" ${FILL_BRASS}/><circle cx="276" cy="142" r="4" ${FILL_BRASS}/>
    <path d="M240 170 v24" ${STROKE} opacity="0.6"/>`],

  ['salad', 'A bowl of salad', `<ellipse cx="240" cy="148" rx="112" ry="16" ${STROKE}/>
    <path d="M132 150 C146 200 186 214 240 214 C294 214 334 200 348 150" ${STROKE}/>
    <path d="M188 142 q-16 -24 6 -38 q8 14 -2 26 q-2 10 8 12 Z" ${STROKE} opacity="0.9"/>
    <path d="M240 138 q-2 -26 16 -34 q4 18 -6 28 q0 8 6 10 Z" ${STROKE} opacity="0.85"/>
    <path d="M290 142 q12 -22 -10 -32 q-10 12 2 24 q2 8 8 8 Z" ${STROKE} opacity="0.8"/>
    <circle cx="216" cy="168" r="5" ${FILL_GOLD} fill-opacity="0.9"/><circle cx="268" cy="172" r="5" ${FILL_GOLD} fill-opacity="0.9"/>`],
];

let written = 0;
for (const [name, label, body] of plates) {
  const file = path.join(OUT, `plate-${name}.svg`);
  fs.writeFileSync(file, chrome(body, label), 'utf8');
  written += 1;
}
console.log(`wrote ${written} plates to ${path.relative(ROOT, OUT)}`);
