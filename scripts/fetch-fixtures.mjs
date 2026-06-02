#!/usr/bin/env node
// fetch-fixtures.mjs
// Fetches WC 2026 match data from ESPN's public API — no API key required.
// Run: node scripts/fetch-fixtures.mjs
// Schedule: GitHub Actions workflow_dispatch or cron

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'fixtures.json');

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world';

// ── Team registry ─────────────────────────────────────────────────────────────
// Keyed by ESPN abbreviation → { name, flag }
// Covers all 48 WC 2026 qualified teams + common alternates.
const TEAMS = {
  // South America
  ARG: { name: 'Argentina',           flag: '🇦🇷' },
  BRA: { name: 'Brazil',              flag: '🇧🇷' },
  URU: { name: 'Uruguay',             flag: '🇺🇾' },
  COL: { name: 'Colombia',            flag: '🇨🇴' },
  ECU: { name: 'Ecuador',             flag: '🇪🇨' },
  VEN: { name: 'Venezuela',           flag: '🇻🇪' },
  PAR: { name: 'Paraguay',            flag: '🇵🇾' },
  CHI: { name: 'Chile',               flag: '🇨🇱' },
  BOL: { name: 'Bolivia',             flag: '🇧🇴' },
  PER: { name: 'Peru',                flag: '🇵🇪' },

  // Europe
  FRA: { name: 'France',              flag: '🇫🇷' },
  ESP: { name: 'Spain',               flag: '🇪🇸' },
  ENG: { name: 'England',             flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  GER: { name: 'Germany',             flag: '🇩🇪' },
  POR: { name: 'Portugal',            flag: '🇵🇹' },
  NED: { name: 'Netherlands',         flag: '🇳🇱' },
  ITA: { name: 'Italy',               flag: '🇮🇹' },
  CRO: { name: 'Croatia',             flag: '🇭🇷' },
  SRB: { name: 'Serbia',              flag: '🇷🇸' },
  HUN: { name: 'Hungary',             flag: '🇭🇺' },
  SVK: { name: 'Slovakia',            flag: '🇸🇰' },
  AUT: { name: 'Austria',             flag: '🇦🇹' },
  SUI: { name: 'Switzerland',         flag: '🇨🇭' },
  DEN: { name: 'Denmark',             flag: '🇩🇰' },
  TUR: { name: 'Turkey',              flag: '🇹🇷' },
  BEL: { name: 'Belgium',             flag: '🇧🇪' },
  POL: { name: 'Poland',              flag: '🇵🇱' },
  SCO: { name: 'Scotland',            flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  UKR: { name: 'Ukraine',             flag: '🇺🇦' },
  BIH: { name: 'Bosnia & Herzegovina',flag: '🇧🇦' },
  CZE: { name: 'Czech Republic',      flag: '🇨🇿' },
  SVN: { name: 'Slovenia',            flag: '🇸🇮' },
  ROU: { name: 'Romania',             flag: '🇷🇴' },
  GRE: { name: 'Greece',              flag: '🇬🇷' },
  NOR: { name: 'Norway',              flag: '🇳🇴' },
  WAL: { name: 'Wales',               flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  FIN: { name: 'Finland',             flag: '🇫🇮' },

  // North/Central America & Caribbean
  USA: { name: 'USA',                 flag: '🇺🇸' },
  MEX: { name: 'Mexico',              flag: '🇲🇽' },
  CAN: { name: 'Canada',              flag: '🇨🇦' },
  PAN: { name: 'Panama',              flag: '🇵🇦' },
  JAM: { name: 'Jamaica',             flag: '🇯🇲' },
  HND: { name: 'Honduras',            flag: '🇭🇳' },
  CRC: { name: 'Costa Rica',          flag: '🇨🇷' },
  CUB: { name: 'Cuba',                flag: '🇨🇺' },

  // Asia
  JPN: { name: 'Japan',               flag: '🇯🇵' },
  KOR: { name: 'South Korea',         flag: '🇰🇷' },
  AUS: { name: 'Australia',           flag: '🇦🇺' },
  IRN: { name: 'Iran',                flag: '🇮🇷' },
  KSA: { name: 'Saudi Arabia',        flag: '🇸🇦' },
  JOR: { name: 'Jordan',              flag: '🇯🇴' },
  UZB: { name: 'Uzbekistan',          flag: '🇺🇿' },
  IRQ: { name: 'Iraq',                flag: '🇮🇶' },
  QAT: { name: 'Qatar',               flag: '🇶🇦' },
  CHN: { name: 'China',               flag: '🇨🇳' },
  THA: { name: 'Thailand',            flag: '🇹🇭' },
  IDN: { name: 'Indonesia',           flag: '🇮🇩' },

  // Africa
  MAR: { name: 'Morocco',             flag: '🇲🇦' },
  EGY: { name: 'Egypt',               flag: '🇪🇬' },
  NGA: { name: 'Nigeria',             flag: '🇳🇬' },
  SEN: { name: 'Senegal',             flag: '🇸🇳' },
  CIV: { name: 'Ivory Coast',         flag: '🇨🇮' },
  CMR: { name: 'Cameroon',            flag: '🇨🇲' },
  GHA: { name: 'Ghana',               flag: '🇬🇭' },
  ALG: { name: 'Algeria',             flag: '🇩🇿' },
  MLI: { name: 'Mali',                flag: '🇲🇱' },
  RSA: { name: 'South Africa',        flag: '🇿🇦' },
  TUN: { name: 'Tunisia',             flag: '🇹🇳' },
  TGO: { name: 'Togo',                flag: '🇹🇬' },
  GAB: { name: 'Gabon',               flag: '🇬🇦' },
  ZIM: { name: 'Zimbabwe',            flag: '🇿🇼' },

  // Oceania
  NZL: { name: 'New Zealand',         flag: '🇳🇿' },
  FIJ: { name: 'Fiji',                flag: '🇫🇯' },

  // Additional WC 2026 qualifiers confirmed by ESPN fixture data
  SWE: { name: 'Sweden',              flag: '🇸🇪' },
  HAI: { name: 'Haiti',               flag: '🇭🇹' },
  CUW: { name: 'Curaçao',             flag: '🇨🇼' },
  CPV: { name: 'Cape Verde',          flag: '🇨🇻' },
  COD: { name: 'Congo DR',            flag: '🇨🇩' },
};

// ESPN occasionally uses non-standard TLAs — remap to our canonical ones.
const ESPN_REMAP = {
  HOL: 'NED',
  CZK: 'CZE',
};

function normalizeTla(tla) {
  if (!tla) return null;
  const up = tla.toUpperCase();
  return ESPN_REMAP[up] ?? up;
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}`);
  return res.json();
}

// ── Group name map ────────────────────────────────────────────────────────────
// Returns { eventId → 'Group A', ... } for all 72 group-stage matches.

async function buildGroupMap() {
  const map = {};
  for (let g = 1; g <= 12; g++) {
    try {
      const [groupData, eventsData] = await Promise.all([
        apiGet(`${CORE}/seasons/2026/types/1/groups/${g}`),
        apiGet(`${CORE}/seasons/2026/types/1/groups/${g}/events?limit=10`),
      ]);
      const name = groupData.name ?? `Group ${String.fromCharCode(64 + g)}`;
      for (const item of (eventsData.items ?? [])) {
        const m = String(item.$ref ?? '').match(/\/events\/(\d+)/);
        if (m) map[m[1]] = name;
      }
    } catch (e) {
      console.warn(`  Group ${g} error: ${e.message}`);
    }
  }
  return map;
}

// ── Round mapping ─────────────────────────────────────────────────────────────

function mapRound(seasonSlug) {
  const m = {
    'group-stage':   'Group Stage',
    'round-of-32':   'Round of 32',
    'round-of-16':   'Round of 16',
    'quarterfinals': 'Quarter-Finals',
    'semifinals':    'Semi-Finals',
    '3rd-place':     'Third Place',
    'final':         'Final',
  };
  return m[seasonSlug] ?? 'Group Stage';
}

// ── Status mapping ────────────────────────────────────────────────────────────

function mapStatus(state, completed) {
  if (state === 'in') return 'live';
  if (state === 'post' || completed) return 'finished';
  return 'scheduled';
}

// ── Transform ESPN event → fixture ───────────────────────────────────────────

function transformEvent(event, groupMap) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find(c => c.homeAway === 'home');
  const away = comp.competitors?.find(c => c.homeAway === 'away');
  if (!home || !away) return null;

  const homeTla = normalizeTla(home.team?.abbreviation);
  const awayTla = normalizeTla(away.team?.abbreviation);
  if (!homeTla || !awayTla) return null;

  const homeTeam = TEAMS[homeTla];
  const awayTeam = TEAMS[awayTla];

  const statusType = comp.status?.type ?? {};
  const statusStr  = mapStatus(statusType.state, statusType.completed);

  const homeScore = statusStr !== 'scheduled' ? (parseInt(home.score) ?? null) : null;
  const awayScore = statusStr !== 'scheduled' ? (parseInt(away.score) ?? null) : null;
  const minute    = statusStr === 'live'
    ? (Math.floor(comp.status?.clock ?? 0) || null)
    : null;

  const round     = mapRound(event.season?.slug);
  const groupName = groupMap[event.id] ?? null;

  return {
    id:            event.id,
    homeTeamId:    homeTla,
    homeTeamName:  homeTeam?.name ?? home.team?.displayName ?? homeTla,
    homeTeamFlag:  homeTeam?.flag ?? '🏳️',
    awayTeamId:    awayTla,
    awayTeamName:  awayTeam?.name ?? away.team?.displayName ?? awayTla,
    awayTeamFlag:  awayTeam?.flag ?? '🏳️',
    kickoffUtc:    event.date,
    status:        statusStr,
    homeScore,
    awayScore,
    minutePlayed:  minute,
    round,
    groupName,
  };
}

// ── Date range ────────────────────────────────────────────────────────────────
// WC 2026: June 11 – July 19, 2026

function wcDates() {
  const dates = [];
  const d = new Date('2026-06-11T00:00:00Z');
  const end = new Date('2026-07-20T00:00:00Z');
  while (d < end) {
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// ── Elimination ───────────────────────────────────────────────────────────────

const KNOCKOUT = new Set([
  'Round of 32', 'Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Third Place', 'Final',
]);

function computeEliminated(fixtures) {
  const out = new Set();
  for (const f of fixtures) {
    if (f.status !== 'finished') continue;
    if (!KNOCKOUT.has(f.round)) continue;
    if (f.homeScore == null || f.awayScore == null) continue;
    if (f.homeScore < f.awayScore) out.add(f.homeTeamId);
    else if (f.awayScore < f.homeScore) out.add(f.awayTeamId);
  }
  return [...out].sort();
}

// ── Current stage ─────────────────────────────────────────────────────────────

function currentStage(fixtures) {
  const priority = [
    'Final', 'Third Place', 'Semi-Finals', 'Quarter-Finals',
    'Round of 16', 'Round of 32', 'Group Stage',
  ];
  const active = fixtures.filter(f => f.status === 'live' || f.status === 'finished');
  for (const s of priority) {
    if (active.some(f => f.round === s)) return s;
  }
  const upcoming = fixtures.filter(f => f.status === 'scheduled');
  for (const s of [...priority].reverse()) {
    if (upcoming.some(f => f.round === s)) return s;
  }
  return 'Group Stage';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('⚽  Sweeper fixture fetch (ESPN, no API key)\n');

  console.log('Building group map...');
  const groupMap = await buildGroupMap();
  console.log(`  ✓ ${Object.keys(groupMap).length} group-stage events mapped\n`);

  console.log('Fetching fixtures by date...');
  const fixtures = [];
  const seen = new Set();

  for (const date of wcDates()) {
    try {
      const data = await apiGet(`${SITE}/scoreboard?dates=${date}`);
      const events = data.events ?? [];
      for (const ev of events) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        const f = transformEvent(ev, groupMap);
        if (f) fixtures.push(f);
      }
      if (events.length) console.log(`  ${date}: ${events.length} match(es)`);
    } catch (e) {
      console.warn(`  ${date}: ${e.message}`);
    }
  }

  // Sort chronologically
  fixtures.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  // Warn about any teams without flags in our registry
  const unknown = new Set(
    fixtures.flatMap(f => [f.homeTeamId, f.awayTeamId]).filter(t => !TEAMS[t])
  );
  if (unknown.size) {
    console.warn(`\n⚠  Unknown TLAs (add flags to TEAMS map): ${[...unknown].join(', ')}`);
  }

  const output = {
    lastUpdated:      new Date().toISOString(),
    currentStage:     currentStage(fixtures),
    fixtures,
    eliminatedTeamIds: computeEliminated(fixtures),
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`\n✓ Written ${fixtures.length} fixtures — stage: "${output.currentStage}"`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
