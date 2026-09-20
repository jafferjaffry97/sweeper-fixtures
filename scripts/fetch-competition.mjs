#!/usr/bin/env node
// Builds one competition's feed from ESPN's public API — no API key required.
//
//   node scripts/fetch-competition.mjs wc26           # incremental (default)
//   node scripts/fetch-competition.mjs wc26 --full    # whole season window
//
// Everything competition-specific lives in competitions/<id>.json: the ESPN
// league slug, the season window, the round-label map, which rounds are
// multi-match ties, and how elimination is resolved. Adding a competition is a
// config file, not a code change.
//
// ESPN's scoreboard has no range query (a date range returns HTTP 400), so a
// fetch costs one request per day in the window. A season-long competition is
// therefore fetched incrementally by default — a rolling window around today,
// merged into the fixtures already on disk — so a half-hourly job stays at a
// couple of dozen requests instead of several hundred.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildGroupMap, fetchEvents } from './lib/espn.mjs';
import { computeEliminated } from './lib/eliminate.mjs';
import {
  assignTies,
  backfillGroups,
  currentStage,
  rosterOf,
  transformEvent,
} from './lib/transform.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Days either side of today an incremental run looks at. */
const LOOK_BACK = 3;
const LOOK_AHEAD = 14;

export function loadConfig(id) {
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error(`Bad competition id: ${id}`);
  return JSON.parse(
    readFileSync(join(ROOT, 'competitions', `${id}.json`), 'utf8'),
  );
}

const iso = (d) => d.toISOString().slice(0, 10);

/** Rolling window around today, clamped to the competition's season. */
export function incrementalWindow(config, now = new Date()) {
  const back = new Date(now);
  back.setUTCDate(back.getUTCDate() - LOOK_BACK);
  const ahead = new Date(now);
  ahead.setUTCDate(ahead.getUTCDate() + LOOK_AHEAD);

  const from = iso(back) < config.window.from ? config.window.from : iso(back);
  const to = iso(ahead) > config.window.to ? config.window.to : iso(ahead);
  return from > to ? null : { from, to };
}

/** Fetches and transforms the events in [window]. No merging, no post-processing. */
export async function fetchSlice(config, window) {
  const groupMap = config.groupMap ? await buildGroupMap(config) : {};
  if (config.groupMap) {
    console.log(`  ✓ ${Object.keys(groupMap).length} group-stage events mapped`);
  }

  const events = await fetchEvents({ ...config, window });
  const fixtures = [];
  for (const ev of events) {
    const f = transformEvent(ev, groupMap, config);
    if (f) fixtures.push(f);
  }
  return fixtures;
}

/**
 * Merges freshly fetched fixtures over whatever is already on disk. Fresh data
 * wins per fixture id; fixtures outside the fetched window are preserved, which
 * is what makes an incremental run safe.
 */
export function merge(existing, fresh) {
  const byId = new Map(existing.map((f) => [f.id, f]));
  for (const f of fresh) byId.set(f.id, f);
  return [...byId.values()];
}

/** Sort, backfill groups, tag ties. Must run on the merged set, not a slice. */
export function postProcess(fixtures, config) {
  fixtures.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  const filled = backfillGroups(fixtures, config);
  if (filled) console.log(`  ✓ Backfilled groupName on ${filled} fixture(s)`);

  const tagged = assignTies(fixtures, config);
  if (tagged) console.log(`  ✓ Tagged ${tagged} fixture(s) into multi-match ties`);

  return fixtures;
}

/** Full build over the competition's whole season window. */
export async function build(config) {
  return postProcess(await fetchSlice(config, config.window), config);
}

function readExisting(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { fixtures: [], eliminatedTeamIds: [] };
  }
}

async function main() {
  const id = process.argv[2];
  const full = process.argv.includes('--full');
  if (!id) {
    console.error(
      'Usage: node scripts/fetch-competition.mjs <competition-id> [--full]',
    );
    process.exit(2);
  }

  const config = loadConfig(id);
  const outPath = join(ROOT, config.output);
  const existing = readExisting(outPath);

  const window = full ? config.window : incrementalWindow(config);
  if (!window) {
    console.log(`${config.name} — outside its season window, nothing to do`);
    return;
  }

  console.log(
    `\n${config.name} — ESPN ${config.espn.site}, ` +
      `${full ? 'full season' : 'incremental'} ${window.from}…${window.to}\n`,
  );

  const fresh = await fetchSlice(config, window);
  const fixtures = postProcess(
    full ? fresh : merge(existing.fixtures ?? [], fresh),
    config,
  );

  // Manual overrides in the existing file (edge cases the feed can't resolve,
  // e.g. forfeits) must survive regeneration — union, never overwrite.
  const manual = existing.eliminatedTeamIds ?? [];

  const output = {
    lastUpdated: new Date().toISOString(),
    currentStage: currentStage(fixtures, config),
    fixtures,
    eliminatedTeamIds: [
      ...new Set([...manual, ...computeEliminated(fixtures, config.format)]),
    ].sort(),
    teams: rosterOf(fixtures),
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(
    `\n✓ ${config.output}: ${fixtures.length} fixtures ` +
      `(+${fresh.length} fetched), ${output.teams.length} teams — ` +
      `stage "${output.currentStage}"`,
  );
}

if (process.argv[1] && process.argv[1].endsWith('fetch-competition.mjs')) {
  main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}
