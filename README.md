# sweeper-fixtures

Public data feeds for the Sweeper app. A GitHub Action rebuilds them from
ESPN's public scoreboard API (no key required) and commits the result; the app
reads the raw files straight from this repo.

```
competitions/<id>.json   one config per competition — the only thing you edit
scripts/
  fetch-competition.mjs  the generic builder
  validate-feed.mjs      structural check before you trust a new config
  lib/                   ESPN client, transform, elimination
fixtures.json            feed for `wc26` (path is fixed — the app ships with it)
feeds/<id>.json          feed for every other competition
```

## Adding a competition

Adding one is a config file, not a code change.

1. Find the ESPN league slug by hitting the scoreboard endpoint for a date you
   know has matches:

   ```bash
   curl -s "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20261021" \
     | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['events']), d['events'][0]['season']['slug'])"
   ```

   The second value is the round slug — you need one per round for `rounds`.

2. Copy an existing `competitions/*.json` and edit it. Fields:

   | field | meaning |
   |---|---|
   | `id` | must match the `Competition.id` in the app. Alphanumeric only. |
   | `output` | where the feed is written; must match the app's `feedPath`. |
   | `espn.site` / `espn.core` | league slugs |
   | `window` | the season's outer bounds. Runs outside it do nothing. |
   | `groupMap` | only for parallel-group competitions; `null` otherwise |
   | `rounds` | ESPN round slug → the label the app scores against |
   | `defaultRound` | fallback when a slug isn't in `rounds` |
   | `stagePriority` | furthest-first, drives the home screen's stage badge |
   | `multiMatchRounds` | rounds where a tie spans several fixtures (two legs, best-of-N) |
   | `format` | `knockoutRounds`, `resolver` (`single` / `aggregate` / `bestOf`), `winsNeeded` |
   | `badges` | `flags` for national teams, `initials` for clubs and franchises |

3. Check it before trusting it:

   ```bash
   node scripts/validate-feed.mjs <id>
   ```

   This fails on unmapped rounds, knockout rounds the config can't produce,
   untagged ties in a multi-match round, and oversized ties. It warns about
   placeholder teams and missing badges.

4. Build it, then flip `available: true` on the matching `Competition` in the
   app so it becomes selectable:

   ```bash
   node scripts/fetch-competition.mjs <id> --full
   ```

## Incremental vs full

ESPN's scoreboard has no range query — a date range returns HTTP 400 — so a
build costs one request per day in its window. A season-long competition would
be ~260 requests per run, which at half-hourly would be abusive.

So the default run is **incremental**: a rolling window of today −3 to +14 days,
merged over the fixtures already on disk. Fixtures outside the window are
preserved. Use `--full` for the first build of a competition, or after changing
`rounds`, `multiMatchRounds` or `badges` — those change every fixture, so a
merge alone won't apply them retroactively.

A competition whose season window hasn't started (or has ended) makes zero
requests and exits, so off-season competitions cost nothing.

## Ties

`multiMatchRounds` is what stops a team being knocked out at half time of a
two-legged tie. Fixtures in those rounds are paired on round + team pair and
given a shared `tieId` and a `gameNumber`, and the app refuses to resolve a tie
until every leg has been played. Every fixture in such a round is tagged even
when it's the only one published so far — otherwise a lone first leg would look
like a one-off match.

Rounds *not* listed resolve on their own scoreline, which is how a two-legged
competition can still have a single-leg final.

## Elimination

`lib/eliminate.mjs` mirrors `lib/services/formats/` in the app. The app derives
eliminations itself; the feed's `eliminatedTeamIds` exists so hand-entered edge
cases (a forfeit, a result the scoreline can't settle) survive regeneration —
it's a union, never an overwrite.

The generic builder was verified to produce output identical to the
World-Cup-specific script it replaced, on live data: 104 fixtures, same rounds,
same groups, same stage, same 31 eliminated teams.
