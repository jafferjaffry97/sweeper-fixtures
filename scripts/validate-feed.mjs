#!/usr/bin/env node
// Structural check on a freshly built feed, before it's committed.
//
//   node scripts/validate-feed.mjs wc26
//
// Catches what actually breaks in practice: ESPN renaming a league slug or a
// round, a config typo, placeholder teams leaking into the feed, or a
// multi-match round whose ties didn't pair up.

import { build, loadConfig } from './fetch-competition.mjs';
import { assignTies, currentStage, rosterOf } from './lib/transform.mjs';
import { computeEliminated } from './lib/eliminate.mjs';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/validate-feed.mjs <competition-id>');
  process.exit(2);
}

const config = loadConfig(id);
console.log(`Validating ${config.name}\n`);

const fixtures = await build(config);
const problems = [];
const warnings = [];

if (fixtures.length === 0) {
  problems.push('no fixtures returned — check the ESPN slug and date window');
}

// Placeholder entries ("RD16 W1", "Quarterfinal 1 Winner") are legitimate
// before a bracket fills in, but they must never be treated as real teams.
const placeholder = /(winner|loser|\bW\d|\bL\d|tbd)/i;
const fake = fixtures.filter(
  (f) => placeholder.test(f.homeTeamName) || placeholder.test(f.awayTeamName),
);
if (fake.length) {
  warnings.push(`${fake.length} fixture(s) still have placeholder teams`);
}

// Every round must be one the config knows; an unmapped round silently falls
// back to defaultRound and would score as the wrong stage.
const known = new Set([
  ...Object.values(config.rounds),
  config.defaultRound,
]);
const unknownRounds = [...new Set(fixtures.map((f) => f.round))].filter(
  (r) => !known.has(r),
);
if (unknownRounds.length) {
  problems.push(`unmapped round(s): ${unknownRounds.join(', ')}`);
}

// Every knockout round in the format must exist in the config's round map, or
// eliminations for it can never fire.
for (const r of config.format.knockoutRounds) {
  if (!known.has(r)) {
    problems.push(`format knockout round "${r}" is not produced by rounds map`);
  }
}
for (const r of config.multiMatchRounds ?? []) {
  if (!known.has(r)) {
    problems.push(`multiMatchRound "${r}" is not produced by rounds map`);
  }
}

// Ties in a multi-match round must be tagged, and a two-legged tie must never
// hold more fixtures than its format allows.
const multi = new Set(config.multiMatchRounds ?? []);
const tieSizes = new Map();
for (const f of fixtures) {
  if (!multi.has(f.round)) continue;
  if (!f.tieId) {
    problems.push(`fixture ${f.id} in multi-match round "${f.round}" has no tieId`);
    continue;
  }
  tieSizes.set(f.tieId, (tieSizes.get(f.tieId) ?? 0) + 1);
}
const cap = config.format.resolver === 'bestOf'
  ? (config.format.winsNeeded ?? 4) * 2 - 1
  : 2;
for (const [tie, n] of tieSizes) {
  if (n > cap) problems.push(`tie ${tie} has ${n} fixtures (max ${cap})`);
}

// A stage the priority list can't express means the strip shows the wrong one.
const stage = currentStage(fixtures, config);
if (fixtures.length && !config.stagePriority.includes(stage)) {
  problems.push(`currentStage "${stage}" is not in stagePriority`);
}

const roster = rosterOf(fixtures);
const noBadge = roster.filter((t) => !t.badge || t.badge === '\u{1F3F3}\u{FE0F}');
if (noBadge.length) {
  warnings.push(
    `${noBadge.length} team(s) without a badge: ${noBadge.slice(0, 8).map((t) => t.id).join(', ')}`,
  );
}

const eliminated = computeEliminated(fixtures, config.format);

console.log(`\n  fixtures    ${fixtures.length}`);
console.log(`  teams       ${roster.length}`);
console.log(`  rounds      ${[...new Set(fixtures.map((f) => f.round))].join(', ') || '—'}`);
console.log(`  ties        ${tieSizes.size}`);
console.log(`  stage       ${stage}`);
console.log(`  eliminated  ${eliminated.length}`);

for (const w of warnings) console.warn(`\n⚠  ${w}`);
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\n✓ Feed is structurally sound');
