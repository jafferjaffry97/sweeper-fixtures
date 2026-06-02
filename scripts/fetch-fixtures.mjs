#!/usr/bin/env node
// fetch-fixtures.mjs
// Fetches World Cup 2026 + International Friendly match data from
// football-data.org and writes fixtures.json in the format expected by the
// Sweeper Flutter app.
//
// Required env var: FOOTBALL_API_KEY  (free key from football-data.org)
// If not set, a placeholder fixtures.json with test friendlies is written.

import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'fixtures.json');

const API_KEY = process.env.FOOTBALL_API_KEY ?? '';
const BASE    = 'https://api.football-data.org/v4';

// ── Team registry ─────────────────────────────────────────────────────────────
// Keyed by the TLA the app uses (matches FIFA standard & football-data.org TLAs).
const TEAMS = {
  ARG: { name: 'Argentina',    flag: '🇦🇷' },
  FRA: { name: 'France',       flag: '🇫🇷' },
  ESP: { name: 'Spain',        flag: '🇪🇸' },
  ENG: { name: 'England',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  BRA: { name: 'Brazil',       flag: '🇧🇷' },
  POR: { name: 'Portugal',     flag: '🇵🇹' },
  NED: { name: 'Netherlands',  flag: '🇳🇱' },
  ITA: { name: 'Italy',        flag: '🇮🇹' },
  GER: { name: 'Germany',      flag: '🇩🇪' },
  COL: { name: 'Colombia',     flag: '🇨🇴' },
  CRO: { name: 'Croatia',      flag: '🇭🇷' },
  MAR: { name: 'Morocco',      flag: '🇲🇦' },
  USA: { name: 'USA',          flag: '🇺🇸' },
  JPN: { name: 'Japan',        flag: '🇯🇵' },
  MEX: { name: 'Mexico',       flag: '🇲🇽' },
  URU: { name: 'Uruguay',      flag: '🇺🇾' },
  SEN: { name: 'Senegal',      flag: '🇸🇳' },
  SUI: { name: 'Switzerland',  flag: '🇨🇭' },
  DEN: { name: 'Denmark',      flag: '🇩🇰' },
  AUT: { name: 'Austria',      flag: '🇦🇹' },
  KOR: { name: 'South Korea',  flag: '🇰🇷' },
  SRB: { name: 'Serbia',       flag: '🇷🇸' },
  AUS: { name: 'Australia',    flag: '🇦🇺' },
  HUN: { name: 'Hungary',      flag: '🇭🇺' },
  IRN: { name: 'Iran',         flag: '🇮🇷' },
  TUR: { name: 'Turkey',       flag: '🇹🇷' },
  POL: { name: 'Poland',       flag: '🇵🇱' },
  NGA: { name: 'Nigeria',      flag: '🇳🇬' },
  EGY: { name: 'Egypt',        flag: '🇪🇬' },
  ALG: { name: 'Algeria',      flag: '🇩🇿' },
  ECU: { name: 'Ecuador',      flag: '🇪🇨' },
  VEN: { name: 'Venezuela',    flag: '🇻🇪' },
  KSA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  CIV: { name: 'Ivory Coast',  flag: '🇨🇮' },
  SVK: { name: 'Slovakia',     flag: '🇸🇰' },
  QAT: { name: 'Qatar',        flag: '🇶🇦' },
  CAN: { name: 'Canada',       flag: '🇨🇦' },
  RSA: { name: 'South Africa', flag: '🇿🇦' },
  GHA: { name: 'Ghana',        flag: '🇬🇭' },
  CMR: { name: 'Cameroon',     flag: '🇨🇲' },
  PAN: { name: 'Panama',       flag: '🇵🇦' },
  JOR: { name: 'Jordan',       flag: '🇯🇴' },
  UZB: { name: 'Uzbekistan',   flag: '🇺🇿' },
  JAM: { name: 'Jamaica',      flag: '🇯🇲' },
  HND: { name: 'Honduras',     flag: '🇭🇳' },
  NZL: { name: 'New Zealand',  flag: '🇳🇿' },
  CRC: { name: 'Costa Rica',   flag: '🇨🇷' },
  MLI: { name: 'Mali',         flag: '🇲🇱' },
};

// football-data.org sometimes uses TLAs that differ from FIFA standard.
// Map those → our app TLA.
const TLA_REMAP = {
  HOL: 'NED',  // Netherlands
  IRI: 'IRN',  // Iran
  NGR: 'NGA',  // Nigeria
  SAU: 'KSA',  // Saudi Arabia
  ZAF: 'RSA',  // South Africa (ISO 3166 code)
};

function normalizeTla(tla) {
  if (!tla) return null;
  const up = tla.toUpperCase();
  return TLA_REMAP[up] ?? up;
}

// ── Status / round / group mappers ────────────────────────────────────────────

function mapStatus(s) {
  switch (s) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    case 'POSTPONED':
    case 'CANCELLED':
    case 'ABANDONED':
    case 'SUSPENDED':
      return 'postponed';
    default:
      return 'scheduled'; // SCHEDULED, TIMED, etc.
  }
}

function mapRound(stage) {
  const map = {
    GROUP_STAGE:                 'Group Stage',
    ROUND_OF_32:                 'Round of 32',
    LAST_32:                     'Round of 32',
    PRELIMINARY_FINAL:           'Round of 32',
    PRELIMINARY_SEMI_FINALS:     'Round of 32',
    ROUND_OF_16:                 'Round of 16',
    LAST_16:                     'Round of 16',
    QUARTER_FINALS:              'Quarter-Finals',
    SEMI_FINALS:                 'Semi-Finals',
    THIRD_PLACE:                 'Third Place',
    FINAL:                       'Final',
  };
  return map[stage] ?? (stage ?? 'Unknown');
}

function mapGroup(group) {
  if (!group) return null;
  // "GROUP_A" → "Group A",  "GROUP_B" → "Group B", etc.
  return group.replace(/^GROUP_/, 'Group ') || null;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchWC2026() {
  const data = await apiGet('/competitions/WC/matches?season=2026');
  return data.matches ?? [];
}

// International Friendlies — available on free tier for the current season.
// football-data.org competition code FRNL covers senior international matches.
async function fetchFriendlies() {
  try {
    const data = await apiGet('/competitions/FRNL/matches?season=2026');
    return data.matches ?? [];
  } catch (e) {
    console.warn(`Friendlies not available (${e.message}) — skipping`);
    return [];
  }
}

// ── Transform a single API match → app fixture format ────────────────────────

function transformMatch(m) {
  const homeTla = normalizeTla(m.homeTeam?.tla);
  const awayTla = normalizeTla(m.awayTeam?.tla);
  if (!homeTla || !awayTla) return null;

  const home = TEAMS[homeTla];
  const away = TEAMS[awayTla];
  if (!home || !away) return null; // not a WC-qualified team

  const status    = mapStatus(m.status);
  const homeScore = m.score?.fullTime?.home ?? null;
  const awayScore = m.score?.fullTime?.away ?? null;

  return {
    id:            String(m.id),
    homeTeamId:    homeTla,
    homeTeamName:  home.name,
    homeTeamFlag:  home.flag,
    awayTeamId:    awayTla,
    awayTeamName:  away.name,
    awayTeamFlag:  away.flag,
    kickoffUtc:    m.utcDate,
    status,
    homeScore:     status !== 'scheduled' ? homeScore : null,
    awayScore:     status !== 'scheduled' ? awayScore : null,
    minutePlayed:  status === 'live' ? (m.minute ?? null) : null,
    round:         mapRound(m.stage),
    groupName:     mapGroup(m.group),
  };
}

// ── Elimination logic ─────────────────────────────────────────────────────────
// A team is eliminated when it loses a finished knockout match.
// Group-stage elimination requires knowing final standings, which the admin
// triggers manually via the Sync button after the group stage is complete.

const KNOCKOUT_ROUNDS = new Set([
  'Round of 32', 'Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Third Place', 'Final',
]);

function computeEliminatedIds(fixtures) {
  const eliminated = new Set();

  for (const f of fixtures) {
    if (f.status !== 'finished') continue;
    if (!KNOCKOUT_ROUNDS.has(f.round)) continue;
    if (f.homeScore == null || f.awayScore == null) continue;

    if (f.homeScore < f.awayScore) eliminated.add(f.homeTeamId);
    else if (f.awayScore < f.homeScore) eliminated.add(f.awayTeamId);
    // draws → extra time / penalties handled by score.winner in some APIs;
    // extend here if needed.
  }

  return [...eliminated].sort();
}

// ── Determine currentStage ────────────────────────────────────────────────────

function currentStage(fixtures) {
  const priority = [
    'Final', 'Third Place', 'Semi-Finals', 'Quarter-Finals',
    'Round of 16', 'Round of 32', 'Group Stage',
  ];
  const active = fixtures.filter(f => f.status === 'live' || f.status === 'finished');
  for (const stage of priority) {
    if (active.some(f => f.round === stage)) return stage;
  }
  // Nothing active yet — show earliest upcoming round
  const upcoming = fixtures.filter(f => f.status === 'scheduled');
  for (const stage of priority.reverse()) {
    if (upcoming.some(f => f.round === stage)) return stage;
  }
  return fixtures.length > 0 ? (fixtures[0].round ?? 'Friendlies') : 'Group Stage';
}

// ── Placeholder (no API key) ──────────────────────────────────────────────────

function buildPlaceholder() {
  return {
    lastUpdated: new Date().toISOString(),
    currentStage: 'Friendlies',
    fixtures: [
      fixture('test-001', 'ARG', 'GER', '2026-06-04T19:00:00Z', 'finished', 2, 1),
      fixture('test-002', 'FRA', 'BRA', '2026-06-05T20:00:00Z', 'scheduled'),
      fixture('test-003', 'ENG', 'JPN', '2026-06-06T19:45:00Z', 'scheduled'),
      fixture('test-004', 'ESP', 'ITA', '2026-06-07T20:45:00Z', 'scheduled'),
      fixture('test-005', 'USA', 'MEX', '2026-06-07T23:00:00Z', 'scheduled'),
      fixture('test-006', 'POR', 'MAR', '2026-06-09T19:00:00Z', 'scheduled'),
      fixture('test-007', 'NED', 'COL', '2026-06-08T14:00:00Z', 'scheduled'),
      fixture('test-008', 'GER', 'TUR', '2026-06-05T18:00:00Z', 'scheduled'),
    ],
    eliminatedTeamIds: [],
  };
}

function fixture(id, homeTla, awayTla, kickoffUtc, status, homeScore = null, awayScore = null) {
  const home = TEAMS[homeTla];
  const away = TEAMS[awayTla];
  return {
    id,
    homeTeamId:   homeTla,
    homeTeamName: home.name,
    homeTeamFlag: home.flag,
    awayTeamId:   awayTla,
    awayTeamName: away.name,
    awayTeamFlag: away.flag,
    kickoffUtc,
    status,
    homeScore:    status !== 'scheduled' ? homeScore : null,
    awayScore:    status !== 'scheduled' ? awayScore : null,
    minutePlayed: null,
    round:        'Friendly',
    groupName:    null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.warn('⚠  FOOTBALL_API_KEY not set — writing placeholder fixtures');
    writeFileSync(OUTPUT, JSON.stringify(buildPlaceholder(), null, 2) + '\n');
    return;
  }

  let apiMatches = [];
  try {
    const [wc, friendlies] = await Promise.all([fetchWC2026(), fetchFriendlies()]);
    apiMatches = [...wc, ...friendlies];
    console.log(`Fetched ${wc.length} WC matches + ${friendlies.length} friendly matches`);
  } catch (e) {
    console.error('API fetch failed:', e.message);
    if (existsSync(OUTPUT)) {
      console.log('Keeping existing fixtures.json unchanged');
      return;
    }
    writeFileSync(OUTPUT, JSON.stringify(buildPlaceholder(), null, 2) + '\n');
    return;
  }

  // Transform and filter to WC-qualified teams only
  const fixtures = apiMatches.map(transformMatch).filter(Boolean);

  // Deduplicate (WC and friendly endpoints can overlap)
  const seen = new Set();
  const unique = fixtures.filter(f => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  // Sort chronologically
  unique.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  const eliminatedTeamIds = computeEliminatedIds(unique);
  const stage = currentStage(unique);

  const output = {
    lastUpdated: new Date().toISOString(),
    currentStage: stage,
    fixtures: unique,
    eliminatedTeamIds,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`✓ Written ${unique.length} fixtures, stage="${stage}", ${eliminatedTeamIds.length} eliminated`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
