const TIME_ZONE = 'America/Toronto';
const FIXTURE_SPORTS = [
  '', 'Soccer', 'American Football', 'Basketball', 'Ice Hockey', 'Baseball',
  'Fighting', 'Boxing', 'Tennis', 'Motorsport', 'Rugby', 'Volleyball', 'Darts'
];
const LIVE_CHECK_SPORTS = ['', 'Soccer', 'Rugby', 'Volleyball', 'Darts'];
const SCOREBOARDS = [
  ['football/nfl', 'American Football', 'NFL'], ['basketball/nba', 'Basketball', 'NBA'],
  ['basketball/wnba', 'Basketball', 'WNBA'], ['hockey/nhl', 'Ice Hockey', 'NHL'],
  ['baseball/mlb', 'Baseball', 'MLB'], ['soccer/eng.1', 'Soccer', 'Premier League'],
  ['soccer/esp.1', 'Soccer', 'La Liga'], ['soccer/ita.1', 'Soccer', 'Serie A'],
  ['soccer/ger.1', 'Soccer', 'Bundesliga'], ['soccer/fra.1', 'Soccer', 'Ligue 1'],
  ['soccer/uefa.champions', 'Soccer', 'UEFA Champions League']
];
const cacheOptions = { cacheEverything: true, cacheTtlByStatus: { '200-299': 120, '429': 120, '400-428': 0, '430-599': 0 } };
const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});
const localTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
});

function fixtureFrom(row) {
  const timestamp = row.strTimestamp || (row.dateEvent && row.strTime && `${row.dateEvent}T${row.strTime}`);
  const start = Date.parse(timestamp && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  return {
    id: row.idEvent, start, timeLabel: Number.isFinite(start) ? localTime.format(start) : '',
    competition: row.strLeague || '', category: row.strSport || '',
    teamA: row.strHomeTeam || '', teamB: row.strAwayTeam || '',
    badgeA: row.strHomeTeamBadge, badgeB: row.strAwayTeamBadge,
    status: row.strStatus || '', postponed: row.strPostponed
  };
}

async function scoreboardFixtures(date, fetchJson) {
  const day = date.replaceAll('-', '');
  const results = await Promise.allSettled(SCOREBOARDS.map(async ([path, category, competition]) => {
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${day}`, 8000, cacheOptions);
    return (data.events || []).flatMap(event => {
      const competitors = event.competitions?.[0]?.competitors;
      const home = competitors?.find(entry => entry.homeAway === 'home')?.team;
      const away = competitors?.find(entry => entry.homeAway === 'away')?.team;
      const status = event.status?.type;
      if (!home?.displayName || !away?.displayName || /cancel|postpon|abandon/i.test(status?.name)) return [];
      return [fixtureFrom({
        idEvent: `espn:${path}:${event.id}`, strTimestamp: event.date, strLeague: competition,
        strSport: category, strHomeTeam: home.displayName, strAwayTeam: away.displayName,
        strHomeTeamBadge: home.logo, strAwayTeamBadge: away.logo,
        strStatus: status?.completed ? 'finished' : status?.state === 'in' ? 'live' : ''
      })];
    });
  }));
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}

export async function loadFixtures(env, fetchJson, upcoming, { compact = false, now = Date.now() } = {}) {
  const date = localDate.format(now);
  const utcToday = new Date(now).toISOString().slice(0, 10);
  const midnight = Date.parse(`${upcoming ? date : utcToday}T00:00:00Z`);
  const key = encodeURIComponent(env.THESPORTSDB_API_KEY || '123');
  const urls = (upcoming ? [0, 1] : [0, -1]).flatMap(offset => {
    const utcDate = new Date(midnight + offset * 86400000).toISOString().slice(0, 10);
    const base = `https://www.thesportsdb.com/api/v1/json/${key}/eventsday.php?d=${utcDate}`;
    return (compact ? LIVE_CHECK_SPORTS : FIXTURE_SPORTS).map(sport => sport ? `${base}&s=${encodeURIComponent(sport)}` : base);
  });
  const [results, scoreboards] = await Promise.all([
    Promise.allSettled(urls.map(url => fetchJson(url, 8000, cacheOptions))),
    scoreboardFixtures(date, fetchJson)
  ]);
  const fixtures = new Map();
  for (const result of results) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value?.events)) continue;
    for (const row of result.value.events) {
      if (!row?.idEvent) continue;
      const fixture = fixtureFrom(row);
      if ((fixture.teamA || row.strEvent) && !/cancel|postpon|abandon/i.test(fixture.status) && !/^yes$/i.test(fixture.postponed)) {
        fixture.title = row.strEvent;
        fixtures.set(fixture.id, fixture);
      }
    }
  }
  for (const fixture of scoreboards) fixtures.set(fixture.id, fixture);
  return {
    fixtures: [...fixtures.values()],
    requests: results.reduce((counts, result) => {
      const status = result.status === 'fulfilled' ? 'ok'
        : /^HTTP (\d{3})$/.exec(result.reason?.message)?.[1] || 'failed';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {}),
    isUpcoming: fixture => fixture.start > now && localDate.format(fixture.start) === date
      && !/finished|completed|ended|after extra time|after penalties|^ft$|^live$/i.test(fixture.status)
  };
}

const xml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[char]));

async function badgeData(value) {
  try {
    const url = new URL(value);
    const sportsDbBadge = ['www.thesportsdb.com', 'r2.thesportsdb.com'].includes(url.hostname) && url.pathname.startsWith('/images/');
    const espnBadge = url.hostname === 'a.espncdn.com' && url.pathname.startsWith('/i/teamlogos/');
    if (url.protocol !== 'https:' || (!sportsDbBadge && !espnBadge) || url.port || url.username || url.password) return '';
    const result = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(3500) });
    const type = result.headers.get('content-type')?.split(';')[0];
    if (!result.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) return '';
    const bytes = new Uint8Array(await result.arrayBuffer());
    if (bytes.length > 512000) return '';
    if (typeof bytes.toBase64 === 'function') return `data:${type};base64,${bytes.toBase64()}`;
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return '';
  }
}

export async function matchupPoster(event, wide = false) {
  const width = wide ? 960 : 420;
  const height = wide ? 540 : 630;
  if (event.empty) {
    return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="24" fill="#101a2a"/>
      <g text-anchor="middle" font-family="Arial, sans-serif" font-weight="700">
        <text x="${width / 2}" y="${height / 2 - 32}" font-size="22" fill="#a8c3eb">${xml(event.competition)}</text>
        <text x="${width / 2}" y="${height / 2 + 20}" font-size="34" fill="#f4f7fc">No games today</text>
      </g></svg>`, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  const [badgeA, badgeB] = await Promise.all([badgeData(event.badgeA), badgeData(event.badgeB)]);
  const label = (name, badge, x, y) => {
    const initials = name.trim().split(/\s+/).slice(0, 3).map(word => [...word][0]).join('').toUpperCase();
    const mark = badge
      ? `<image href="${badge}" x="${x - 76}" y="${y}" width="152" height="152"/>`
      : `<circle cx="${x}" cy="${y + 76}" r="69" fill="#253750"/><text x="${x}" y="${y + 90}" font-size="44">${xml(initials)}</text>`;
    const size = Math.min(29, Math.floor(620 / Math.max(name.length, 1)));
    return `${mark}<text x="${x}" y="${y + 190}" font-size="${Math.max(10, size)}">${xml(name)}</text>`;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="24" fill="#101a2a"/>
    <g fill="#f4f7fc" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">
      <text x="${width / 2}" y="51" font-size="16" fill="#a8c3eb">${xml(event.competition.slice(0, 42))}</text>
      ${label(event.teamA, badgeA, wide ? 260 : 210, wide ? 127 : 74)}
      ${wide ? '' : '<path d="M50 313h123m74 0h123" stroke="#4a607e"/>'}
      <text x="${width / 2}" y="${wide ? 209 : 320}" font-size="19" fill="#a8c3eb">VS</text>
      ${label(event.teamB, badgeB, wide ? 700 : 210, wide ? 127 : 353)}
      <text x="${width / 2}" y="${height - 34}" font-size="16" fill="#a8c3eb">${xml(event.upcoming ? event.timeLabel : 'LIVE')}</text>
    </g></svg>`;
  return new Response(svg, { headers: {
    'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': badgeA && badgeB ? 'public, max-age=3600' : 'public, max-age=60',
    'content-security-policy': "default-src 'none'; img-src data:"
  } });
}
