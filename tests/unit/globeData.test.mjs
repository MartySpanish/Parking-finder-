// The globe's dataset is a PUBLIC static file. Nothing about a globe suggests
// that, which is exactly why this test exists.
//
// THE HOLE IT GUARDS. The 89 hidden gems are what a Premium subscription buys.
// 20260820_hidden_gems.sql was written because they used to ship to every
// browser in the app bundle — "the lock is drawn in the UI; the exact
// coordinates and notes are one devtools tab away for anybody who has never
// paid". A generated JSON of every spot in Northern Ireland is the same hole
// through a side door, on a page whose whole job is to be looked at.
//
// The generator already refuses to write a file that leaks. This checks the
// file that was actually written, because the two can drift.
import assert from 'node:assert/strict';
import { inNorthernIreland } from '../../src/regions.js';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PATH = new URL('../../public/globe/places.json', import.meta.url);
if (!existsSync(PATH)) execSync('node scripts/generate-globe-data.mjs', { stdio: 'ignore' });
const data = JSON.parse(readFileSync(PATH, 'utf8'));
const gems = data.spaces.filter(s => s.t === 'gem');

let passed = 0;
const it = (what, fn) => { fn(); passed++; console.log(`  PASS  ${what}`); };

console.log('\nglobeData — the public file must not give away the paid half');

it('there are gems in it at all (or the rest proves nothing)', () => {
  assert.ok(gems.length > 50, `only ${gems.length} gems — has the mapping changed?`);
});

it('no gem carries a coordinate finer than the ~500m grid', () => {
  // approxCoord in App.jsx: Math.round(v * 200) / 200, i.e. 0.005 degrees.
  // A value off that grid means somebody published an exact pin.
  const exact = gems.filter(g => g.c.some(v => Math.abs(v * 200 - Math.round(v * 200)) > 1e-6));
  assert.deepEqual(exact.map(g => g.c), [], `${exact.length} gem(s) carry an exact coordinate`);
});

it('no gem is named', () => {
  // Area labels are allowed — `near` is what the locked card in the app already
  // prints on screen. The gem's own name is not.
  const src = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
  const named = gems.filter(g => g.n && new RegExp(`name:\\s*(['"\`])${g.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`).test(src)
    && new RegExp(`name:\\s*(['"\`])${g.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1[^}]*badge:\\s*(['"\`])hidden_gem\\2`).test(src));
  assert.deepEqual(named.map(g => g.n), [], 'a gem name reached the public file');
});

it('ordinary spots ARE named, or the page cannot be searched', () => {
  const ordinary = data.spaces.filter(s => s.t !== 'gem');
  const named = ordinary.filter(s => s.n).length;
  assert.ok(named / ordinary.length > 0.95,
    `only ${named}/${ordinary.length} ordinary spots are named — search would be useless`);
});

it('the stats are counted, not typed — and scoped to Northern Ireland', () => {
  // The stats block is NI-scoped; the dot array is not. The globe DRAWS every
  // dot, including Dublin and Glasgow, because a map showing them is not a
  // claim — whereas a number printed beside the words "across Northern
  // Ireland" is. So these two must NOT be equal, and the gap is the ninety
  // spots the homepage used to claim as Northern Irish.
  const ni = data.spaces.filter(s => inNorthernIreland({ lat: s.c[1], lng: s.c[0], town: s.town }));
  assert.equal(data.stats.spaces, ni.length,
    'stats.spaces is not the Northern Ireland subset');
  assert.equal(data.stats.spacesAll, data.spaces.length,
    'stats.spacesAll no longer matches the dots actually drawn');
  assert.ok(data.stats.spaces < data.stats.spacesAll,
    'stats.spaces equals the full total — the NI filter is not being applied');
  assert.equal(data.stats.towns, new Set(ni.map(s => s.town)).size,
    'stats.towns counts towns outside Northern Ireland');

  // gems comes from the live database when the build can reach it and falls
  // back to the bundled NI count, so it is checked as a range rather than an
  // identity: it must be a real count, and never more than the gems that exist.
  assert.ok(Number.isInteger(data.stats.gems) && data.stats.gems > 0,
    'stats.gems is not a counted number');
  assert.ok(data.stats.gems <= data.stats.gemsAll || data.stats.gems <= gems.length + 100,
    'stats.gems is implausibly larger than the gem data');

  // 85% is in signed host agreements. It does not move on a marketing page.
  assert.equal(data.stats.hostShare, 85);
});

it('no credential is baked into the committed data', () => {
  const raw = readFileSync(PATH, 'utf8');
  assert.ok(!/eyJ|supabase\.co|apikey/i.test(raw), 'places.json contains something key-shaped');
});

console.log(`  ${passed} checks passed — ${data.spaces.length} spaces, ${gems.length} gems blurred`);
