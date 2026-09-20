const SITE_ROOT = 'https://site.api.espn.com/apis/site/v2/sports';
const CORE_ROOT = 'https://sports.core.api.espn.com/v2/sports';

export async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}`);
  return res.json();
}

export const siteUrl = (slug, path) => `${SITE_ROOT}/${slug}${path}`;
export const coreUrl = (slug, path) => `${CORE_ROOT}/${slug}${path}`;

/** Inclusive YYYYMMDD list between two ISO dates. */
export function dateRange(from, to) {
  const dates = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Group-stage name map: { eventId -> 'Group A' }.
 * Only competitions with parallel groups configure this.
 */
export async function buildGroupMap(config) {
  const cfg = config.groupMap;
  if (!cfg) return {};
  const { core, season } = config.espn;
  const map = {};
  for (let g = 1; g <= cfg.groups; g++) {
    const base = coreUrl(core, `/seasons/${season}/types/${cfg.seasonType}/groups/${g}`);
    try {
      const [groupData, eventsData] = await Promise.all([
        apiGet(base),
        apiGet(`${base}/events?limit=25`),
      ]);
      const name = groupData.name ?? `Group ${String.fromCharCode(64 + g)}`;
      for (const item of eventsData.items ?? []) {
        const m = String(item.$ref ?? '').match(/\/events\/(\d+)/);
        if (m) map[m[1]] = name;
      }
    } catch (e) {
      console.warn(`  Group ${g} error: ${e.message}`);
    }
  }
  return map;
}

/** Every distinct event in the competition's date window. */
export async function fetchEvents(config) {
  const events = [];
  const seen = new Set();
  for (const date of dateRange(config.window.from, config.window.to)) {
    try {
      const data = await apiGet(
        siteUrl(config.espn.site, `/scoreboard?dates=${date}`),
      );
      const found = data.events ?? [];
      for (const ev of found) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        events.push(ev);
      }
      if (found.length) console.log(`  ${date}: ${found.length} match(es)`);
    } catch (e) {
      console.warn(`  ${date}: ${e.message}`);
    }
  }
  return events;
}
