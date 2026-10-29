// Nogometni rezultati i tablice s javnog LiveScore API-ja (bez ključa).
// Radi i u Node.js-u i u pregledniku: ovdje je samo obrada, dohvat je u run.js / dev/harness.html.

export const LEAGUES = [
  { key: 'hnl',     name: 'SuperSport HNL',   page: 551, path: 'croatia/1st-league' },
  { key: 'prvanl',  name: 'Prva NL',          page: 552, path: 'croatia/2nd-league' },
  { key: 'epl',     name: 'Premier League',   page: 553, path: 'england/premier-league' },
  { key: 'laliga',  name: 'LaLiga',           page: 554, path: 'spain/laliga' },
  { key: 'bundes',  name: 'Bundesliga',       page: 555, path: 'germany/bundesliga' },
  { key: 'seriea',  name: 'Serie A',          page: 556, path: 'italy/serie-a' },
  { key: 'ligue1',  name: 'Ligue 1',          page: 557, path: 'france/ligue-1' },
];

// Zadnja 0 u adresi je vremenska zona: vremena dolaze u UTC-u, aplikacija ih prikazuje po zagrebačkom.
export const stageUrl = l => `https://prod-public-api.livescore.com/v1/api/app/stage/soccer/${l.path}/0?MD=1`;

const PAST_MS = 5 * 864e5;   // da se vidi i zadnje kolo kad je bilo prošlog vikenda
const AHEAD_MS = 7 * 864e5;

// Kraći i hrvatski nazivi klubova, da stanu u stupac teleteksta.
const NAMES = {
  'NK Varazdin': 'Varaždin', 'Rudes': 'Rudeš', 'Slaven': 'Slaven Belupo', 'NK Kustosija': 'Kustošija',
  'Mladost Zdralovi': 'Mladost Ždralovi', 'Dinamo Zagreb B': 'Dinamo Zg. B', 'Dubrava Zagreb': 'Dubrava',
  'Manchester City': 'Man. City', 'Manchester United': 'Man. United', 'Newcastle United': 'Newcastle',
  'Tottenham Hotspur': 'Tottenham', 'Crystal Palace': 'C. Palace', 'Nottingham Forest': 'Nott. Forest', 'Wolverhampton Wanderers': 'Wolves',
  'West Ham United': 'West Ham', 'Brighton & Hove Albion': 'Brighton', 'Leeds United': 'Leeds',
  'Atletico Madrid': 'Atlético', 'Deportivo Alaves': 'Alavés', 'Deportivo A Coruna': 'Deportivo',
  'Racing Santander': 'Racing', 'Athletic Club': 'Athletic', 'Cadiz': 'Cádiz', 'Malaga': 'Málaga',
  'Bayern Munich': 'Bayern', 'Borussia Dortmund': 'Dortmund', 'Bayer Leverkusen': 'Leverkusen',
  'Eintracht Frankfurt': 'E. Frankfurt', "Borussia M'gladbach": "M'gladbach", 'FC Cologne': 'Köln',
  'Werder Bremen': 'Werder', 'VfB Stuttgart': 'Stuttgart', 'Hamburger SV': 'Hamburg',
  'Paris Saint-Germain': 'PSG', 'AS Monaco': 'Monaco', 'AC Milan': 'Milan', 'AS Roma': 'Roma', 'Como 1907': 'Como',
};

export function teamName(n) {
  return NAMES[n] || n.replace(/^(NK|HNK|GNK|FC|AFC|SC|SK|AS|AC|CF|SV)\s+/, '');
}

// "20261031140000" → milisekunde (UTC)
function esdTime(esd) {
  const s = String(esd);
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));
}

// Iz odgovora stage API-ja uzme utakmice od prije 5 dana do za 7 dana i ukupnu tablicu.
export function parseStage(json, league, now = Date.now()) {
  const stage = json?.Stages?.[0];
  if (!stage) throw new Error('nema podataka o ligi');
  const matches = (stage.Events || [])
    .map(e => ({
      t: esdTime(e.Esd),
      h: teamName(e.T1?.[0]?.Nm || '?'),
      a: teamName(e.T2?.[0]?.Nm || '?'),
      s1: e.Tr1 ?? null,
      s2: e.Tr2 ?? null,
      st: e.Eps || 'NS',
    }))
    .filter(m => m.t >= now - PAST_MS && m.t <= now + AHEAD_MS)
    .sort((x, y) => x.t - y.t);
  const tables = stage.LeagueTable?.L?.[0]?.Tables || [];
  const overall = tables.find(t => t.LTT === 1) || tables[0];
  const table = (overall?.team || [])
    .map(r => [r.rnk, teamName(r.Tnm), r.pld, r.win, r.drw, r.lst, r.gf, r.ga, r.pts])
    .sort((x, y) => x[0] - y[0]);
  return { key: league.key, name: league.name, page: league.page, matches, table };
}

// Dohvati sve lige; liga koja se ne uspije dohvatiti zadržava podatke iz prethodnog izdanja.
export async function loadFootball(get, prev) {
  const leagues = await Promise.all(LEAGUES.map(async l => {
    try {
      const lg = parseStage(JSON.parse(await get(stageUrl(l))), l);
      console.log(`${l.name.padEnd(16)} utakmica ${lg.matches.length}, klubova ${lg.table.length}`);
      return { ...lg, updated: new Date().toISOString() };
    } catch (e) {
      console.warn(`${l.name.padEnd(16)} GREŠKA ${e.message}`);
      return prev?.leagues?.find(p => p.key === l.key) || { key: l.key, name: l.name, page: l.page, matches: [], table: [], updated: null };
    }
  }));
  return { leagues };
}

// Jesu li se utakmice ili tablice promijenile (vrijeme dohvata se ne gleda)
export function footballChanged(a, b) {
  const strip = f => JSON.stringify((f?.leagues || []).map(({ updated, ...rest }) => rest));
  return strip(a) !== strip(b);
}
