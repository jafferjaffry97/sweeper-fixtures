import { badgeFor, nameFor, normalizeTla } from './teams.mjs';

function mapStatus(state, completed) {
  if (state === 'in') return 'live';
  if (state === 'post' || completed) return 'finished';
  return 'scheduled';
}

function mapRound(event, config) {
  const slug = event.season?.slug ?? String(event.competitions?.[0]?.type?.id ?? '');
  return config.rounds[slug] ?? config.defaultRound;
}

/** One ESPN event → one fixture, or null when it can't be understood. */
export function transformEvent(event, groupMap, config) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find((c) => c.homeAway === 'home');
  const away = comp.competitors?.find((c) => c.homeAway === 'away');
  if (!home || !away) return null;

  const homeId = normalizeTla(home.team?.abbreviation);
  const awayId = normalizeTla(away.team?.abbreviation);
  if (!homeId || !awayId) return null;

  const badges = config.badges;
  const statusType = comp.status?.type ?? {};
  const status = mapStatus(statusType.state, statusType.completed);

  const score = (side) =>
    status !== 'scheduled' && Number.isFinite(parseInt(side.score))
      ? parseInt(side.score)
      : null;

  const shootout = (side) =>
    Number.isFinite(parseInt(side.shootoutScore))
      ? parseInt(side.shootoutScore)
      : null;

  return {
    id: event.id,
    homeTeamId: homeId,
    homeTeamName: nameFor(homeId, home.team?.displayName, badges),
    homeTeamFlag: badgeFor(homeId, home.team?.displayName, badges),
    awayTeamId: awayId,
    awayTeamName: nameFor(awayId, away.team?.displayName, badges),
    awayTeamFlag: badgeFor(awayId, away.team?.displayName, badges),
    kickoffUtc: event.date,
    status,
    homeScore: score(home),
    awayScore: score(away),
    minutePlayed:
      status === 'live' ? Math.floor(comp.status?.clock ?? 0) || null : null,
    round: mapRound(event, config),
    groupName: groupMap[event.id] ?? null,
    homeShootout: shootout(home),
    awayShootout: shootout(away),
  };
}

/**
 * Fills groupName on group-stage fixtures the group map missed — ESPN's
 * per-group events endpoint sometimes returns an incomplete list, and every
 * team's group is known from any of its already-labelled fixtures.
 */
export function backfillGroups(fixtures, config) {
  if (!config.groupMap) return 0;
  const stageRound = config.defaultRound;
  const teamGroup = {};
  for (const f of fixtures) {
    if (f.round === stageRound && f.groupName) {
      teamGroup[f.homeTeamId] = f.groupName;
      teamGroup[f.awayTeamId] = f.groupName;
    }
  }
  let filled = 0;
  for (const f of fixtures) {
    if (f.round === stageRound && !f.groupName) {
      const g = teamGroup[f.homeTeamId] ?? teamGroup[f.awayTeamId];
      if (g) {
        f.groupName = g;
        filled++;
      }
    }
  }
  return filled;
}

/**
 * Marks fixtures that settle together — the legs of a two-legged tie, or the
 * games of a best-of-N series — by pairing on round + the unordered team pair.
 *
 * Every fixture in a round listed as multi-match gets a tieId, even while it's
 * the only one published so far. Without that, a first leg would look like a
 * one-off match and the app would knock a team out at half time of the tie.
 */
export function assignTies(fixtures, config) {
  const rounds = new Set(config.multiMatchRounds ?? []);
  if (rounds.size === 0) return 0;

  const buckets = new Map();
  for (const f of fixtures) {
    if (!rounds.has(f.round)) continue;
    const pair = [f.homeTeamId, f.awayTeamId].sort().join('-');
    const key = `${f.round}:${pair}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  }

  let tagged = 0;
  for (const [key, group] of buckets) {
    group.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
    group.forEach((f, i) => {
      f.tieId = key;
      f.gameNumber = i + 1;
      tagged++;
    });
  }
  return tagged;
}

/** The furthest round the competition has actually reached. */
export function currentStage(fixtures, config) {
  const priority = config.stagePriority;
  const active = fixtures.filter(
    (f) => f.status === 'live' || f.status === 'finished',
  );
  for (const s of priority) {
    if (active.some((f) => f.round === s)) return s;
  }
  const upcoming = fixtures.filter((f) => f.status === 'scheduled');
  for (const s of [...priority].reverse()) {
    if (upcoming.some((f) => f.round === s)) return s;
  }
  return config.defaultRound;
}

/** Distinct teams seen in the feed, so the app can read its roster from here. */
export function rosterOf(fixtures) {
  const teams = new Map();
  for (const f of fixtures) {
    if (!teams.has(f.homeTeamId)) {
      teams.set(f.homeTeamId, {
        id: f.homeTeamId,
        name: f.homeTeamName,
        badge: f.homeTeamFlag,
      });
    }
    if (!teams.has(f.awayTeamId)) {
      teams.set(f.awayTeamId, {
        id: f.awayTeamId,
        name: f.awayTeamName,
        badge: f.awayTeamFlag,
      });
    }
  }
  return [...teams.values()].sort((a, b) => a.id.localeCompare(b.id));
}
