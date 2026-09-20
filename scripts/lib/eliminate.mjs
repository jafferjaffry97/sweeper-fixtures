/**
 * Mirror of lib/services/formats/ in the app.
 *
 * The app derives eliminations itself; this exists so the feed carries a
 * precomputed set that the app unions in, covering cases the scoreline alone
 * can't resolve. The two implementations must agree — see verify-parity.mjs.
 */

function played(f) {
  return f.status === 'finished' && f.homeScore != null && f.awayScore != null;
}

function singleLoser(tie) {
  const f = tie.find(played);
  if (!f) return null;
  if (f.homeScore !== f.awayScore) {
    return f.homeScore > f.awayScore ? f.awayTeamId : f.homeTeamId;
  }
  if (
    f.homeShootout != null &&
    f.awayShootout != null &&
    f.homeShootout !== f.awayShootout
  ) {
    return f.homeShootout > f.awayShootout ? f.awayTeamId : f.homeTeamId;
  }
  return null;
}

function aggregateLoser(tie, legs = 2) {
  // No tieId anywhere means a genuine one-off match (a single-leg final).
  if (tie.every((f) => f.tieId == null)) return singleLoser(tie);

  const done = tie.filter(played);
  if (done.length < legs || tie.length < legs) return null;

  const goals = {};
  for (const f of done) {
    goals[f.homeTeamId] = (goals[f.homeTeamId] ?? 0) + f.homeScore;
    goals[f.awayTeamId] = (goals[f.awayTeamId] ?? 0) + f.awayScore;
  }
  const ids = Object.keys(goals);
  if (ids.length !== 2) return null;
  if (goals[ids[0]] !== goals[ids[1]]) {
    return goals[ids[0]] > goals[ids[1]] ? ids[1] : ids[0];
  }

  const decider = [...done].sort(
    (a, b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0),
  ).at(-1);
  if (
    decider.homeShootout != null &&
    decider.awayShootout != null &&
    decider.homeShootout !== decider.awayShootout
  ) {
    return decider.homeShootout > decider.awayShootout
      ? decider.awayTeamId
      : decider.homeTeamId;
  }
  return null;
}

function bestOfLoser(tie, winsNeeded) {
  const sides = new Set();
  for (const f of tie) {
    sides.add(f.homeTeamId);
    sides.add(f.awayTeamId);
  }
  if (sides.size !== 2) return null;

  const wins = {};
  for (const f of tie.filter(played)) {
    if (f.homeScore === f.awayScore) continue;
    const w = f.homeScore > f.awayScore ? f.homeTeamId : f.awayTeamId;
    wins[w] = (wins[w] ?? 0) + 1;
  }
  for (const side of sides) {
    if ((wins[side] ?? 0) >= winsNeeded) {
      return [...sides].find((s) => s !== side);
    }
  }
  return null;
}

export function computeEliminated(fixtures, format) {
  const knockout = new Set(format.knockoutRounds);
  const ties = new Map();
  for (const f of fixtures) {
    if (!knockout.has(f.round)) continue;
    const key = f.tieId ?? `fixture:${f.id}`;
    if (!ties.has(key)) ties.set(key, []);
    ties.get(key).push(f);
  }

  const out = new Set();
  for (const tie of ties.values()) {
    let loser = null;
    if (format.resolver === 'aggregate') loser = aggregateLoser(tie);
    else if (format.resolver === 'bestOf') {
      loser = bestOfLoser(tie, format.winsNeeded ?? 4);
    } else loser = singleLoser(tie);
    if (loser) out.add(loser);
  }
  return [...out].sort();
}
