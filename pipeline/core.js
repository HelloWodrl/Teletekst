// Jezgra obrade vijesti. Nema ovisnosti o Node.js-u pa radi i u pregledniku
// (dev/harness.html) i na GitHub Actionsu (pipeline/run.js).

export const SECTIONS = [
  { key: 'hrvatska',     title: 'HRVATSKA',              page: 200 },
  { key: 'svijet',       title: 'SVIJET',                page: 300 },
  { key: 'gospodarstvo', title: 'GOSPODARSTVO',          page: 400 },
  { key: 'sport',        title: 'SPORT',                 page: 500 },
  { key: 'kultura',      title: 'KULTURA I ZABAVA',      page: 600 },
  { key: 'znanost',      title: 'ZNANOST I TEHNOLOGIJA', page: 700 },
];

export const REGIONS = [
  { key: 'slavonija', title: 'SLAVONIJA',            page: 800 },
  { key: 'vsz',       title: 'VUKOVARSKO-SRIJEMSKA', page: 820 },
  { key: 'vinkovci',  title: 'VINKOVCI',             page: 840 },
];

export const PER_LIST = 10;
const MAX_AGE_H = 36;

// ---------- tekst ----------

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bdquo: '„', laquo: '«', raquo: '»', euro: '€', shy: '' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(s) {
  return decodeEntities(
    s.replace(/<(script|style|figure|figcaption)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

const clean = s => s.replace(/\s+/g, ' ').trim();

// "FOTO, VIDEO / Naslov" → "Naslov"
const cleanTitle = s => s.replace(/^((foto|video|galerija|uživo|anketa|ekskluzivno|kviz)\b[\s,/|:]*)+/i, '').trim() || s;

// ---------- RSS / Atom ----------

function inner(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  const cd = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cd ? cd[1] : decodeEntities(m[1]);
}

function all(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'gi');
  const out = [];
  for (const m of block.matchAll(re)) {
    const cd = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
    out.push(clean(htmlToText(cd ? cd[1] : decodeEntities(m[1]))));
  }
  return out.filter(Boolean);
}

export function parseFeed(xml, source) {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map(m => m[0]);
  const items = [];
  for (const b of blocks) {
    const title = cleanTitle(clean(htmlToText(inner(b, 'title'))));
    let link = clean(inner(b, 'link'));
    if (!link) link = (b.match(/<link[^>]+href="([^"]+)"/i) || [])[1] || '';
    link = decodeEntities(link).trim();
    if (!title || !/^https?:\/\//.test(link)) continue;
    const desc = clean(htmlToText(inner(b, 'description') || inner(b, 'summary')));
    const body = htmlToText(inner(b, 'content:encoded') || inner(b, 'content'));
    const date = Date.parse(inner(b, 'pubDate') || inner(b, 'dc:date') || inner(b, 'published') || inner(b, 'updated'));
    items.push({
      source: source.id,
      title,
      link,
      desc: desc.slice(0, 600),
      body: body.length > desc.length + 40 ? body.slice(0, 3000) : '',
      cats: all(b, 'category'),
      t: Number.isFinite(date) ? date : null,
    });
  }
  return items;
}

// ---------- tokeni i sličnost ----------

const FOLD = { č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'd' };
export const fold = s => s.toLowerCase().replace(/[čćšžđ]/g, c => FOLD[c]);

const STOP = new Set(('ali ako bez bio bila bilo bili biti cak cijeli dana danas dok dva dvije evo foto galerija gdje ' +
  'godina godine godinu ima imaju iako ipak izmedu jedan jedna jedno jer jos joj jucer kada kako kao kod koja koje ' +
  'kojeg kojem koji kojima koju kroz moze mogu nakon nasa nase nasi neki neka neke nije nisu niti njih njegov njezin ' +
  'nova novi novo novu ono ova ove ovaj ovo ovih ovom pod prije prema prvi prva puta sada samo sebe sto svoj svoje ' +
  'sve svi tako takoder tek tijekom tko uvijek vec video vise vrlo zato zbog zasto sutra rekao rekla kaze kazao ' +
  'evo ovdje tamo jako veliki velika veliko mali mala ljudi covjek osoba osobe nakon tri cetiri pet sat sati').split(' '));

const ENDINGS = ['ima', 'ama', 'ega', 'emu', 'oga', 'omu', 'om', 'em', 'og', 'oj', 'ih', 'im', 'am', 'a', 'e', 'i', 'o', 'u'];

export function stem(w) {
  for (const e of ENDINGS) {
    if (w.length - e.length >= 3 && w.endsWith(e)) { w = w.slice(0, -e.length); break; }
  }
  return w.slice(0, 6);
}

export function tokens(text) {
  const out = new Set();
  for (const w of fold(text).split(/[^a-z0-9]+/)) {
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w) && w.length < 4) continue;
    out.add(stem(w));
  }
  return out;
}

function lead(it) {
  return (it.desc || it.body).split(/\s+/).slice(0, 30).join(' ');
}

// ---------- rubrike i regije ----------

const SECTION_RULES = [
  ['sport',        /\b(sport\w*|nogomet\w*|kosark\w*|rukomet\w*|tenis\w*|formula|vaterpol\w*|atletik\w*|hnl|liga)\b/],
  ['znanost',      /\b(znanost\w*|tehnolog\w*|tech|scitech|gadget\w*|zdravlj\w*|auto|automobil\w*|digital\w*|internet|klima)\b/],
  ['gospodarstvo', /\b(biznis\w*|novac|gospodarstv\w*|ekonomij\w*|financij\w*|poslovn\w*|tvrtk\w*|business|trziste|posao)\b/],
  ['kultura',      /\b(kultur\w*|showbiz\w*|zabav\w*|magazin|scena|lifestyle|zivot|celebrity|glazb\w*|film\w*|kino|zvijezde|stil|ljubimci|putovanj\w*|hrana|recepti|horoskop\w*|astro\w*|mame|food)\b/],
  ['svijet',       /\b(svijet|world|inozemstvo|europa|eu)\b/],
  ['hrvatska',     /\b(hrvatsk\w*|vijesti|kronika|crna|politik\w*|zagreb|lokaln\w*|novosti)\b/],
];

export function guessSection(it) {
  let path = '';
  try { path = new URL(it.link).pathname; } catch { /* prazno */ }
  const hay = fold(path.replace(/[\/_-]/g, ' ') + ' ' + it.cats.join(' '));
  for (const [key, re] of SECTION_RULES) if (re.test(hay)) return key;
  return 'hrvatska';
}

// Mjesta Vukovarsko-srijemske županije. "ctx" znači da se riječ koristi i za nešto drugo
// (npr. "Nijemci", "otok"), pa se broji samo ako tekst spominje i županiju ili Vinkovce/Vukovar.
const VSZ_PLACES = [
  /\bvinkov\w*/, /\bvukovar\w*/, /\bzupanj(a|e|i|u|om)\b/, /\bilo(k|ka|ku|kom)\b/, /\bandrijasev\w*/, /\bbabin\w* gred\w*/,
  /\bbogdanov\w*/, /\bborov(o|a|u)\b/, /\bcern(a|e|i)\b/, /\bdrenov\w*/, /\bgunj(a|e|i)\b/, /\bivankov\w*/, /\bjarmin\w*/,
  /\blovas\w*/, /\bmarkusic\w*/, /\bnegoslav\w*/, /\bnustar\w*/, /\bstar\w* jankov\w*/, /\bstar\w* mikanov\w*/,
  /\bstitar\w*/, /\btompojev\w*/, /\btordinc\w*/, /\btovarnik\w*/, /\btrpinj\w*/, /\bvodinc\w*/, /\bsrijem\w*/,
];
const VSZ_CTX = [/\botok(u|a)?\b/, /\bnijemc\w*/, /\bprivlak\w*/, /\bbosnjac\w*/, /\bgradist\w*/, /\bvrbanj\w*/];
const VSZ_ANCHOR = /\b(vinkov|vukovar|vukovarsko|zupanj[aeiu])\w*/;
const VINKOVCI_RE = /\bvinkov\w*/;
const SLAVONIJA_RE = /\b(slavonij\w*|slavonsk\w*|osijek\w*|osjeck\w*|baranj\w*|dakov\w*|nasic\w*|valpov\w*|belisc\w*|pozeg\w*|pozesk\w*|virovitic\w*|slatin\w*|nov\w* gradisk\w*|beli manastir\w*|brodsk\w*)\b/;

export function regionsOf(cluster, srcById) {
  const local = cluster.items.some(i => srcById[i.source].regional);
  const titles = fold(cluster.items.map(i => i.title).join(' '));
  // Lokalni portal (Vinkulja) u svakom opisu i oznakama spominje Vinkovce, pa se za njega gleda samo naslov.
  const texts = cluster.items.map(i => fold(srcById[i.source].local ? i.title : `${i.title} ${i.desc} ${i.cats.join(' ')}`));
  const all = texts.join(' ');
  // Kod nacionalnih vijesti usputni spomen mjesta nije dovoljan: mora biti u naslovu ili u dva članka.
  const hit = re => re.test(titles) || (local ? re.test(all) : texts.filter(t => re.test(t)).length >= 2);

  const r = new Set();
  if (VSZ_PLACES.some(hit) || (VSZ_ANCHOR.test(all) && VSZ_CTX.some(hit))) r.add('vsz');
  if (hit(VINKOVCI_RE)) r.add('vinkovci');
  for (const it of cluster.items) {
    const s = srcById[it.source];
    if (s.regional) r.add('slavonija');
    if (s.local === 'vinkovci') {
      // Vinkuljine rubrike: "Vinkovci", "Županija", "Crna kronika" su lokalne, "Hrvatska" i "Svijet" nisu.
      if (!it.cats.some(c => c === 'Hrvatska' || c === 'Svijet')) r.add('vsz');
      if (it.cats.includes('Vinkovci')) r.add('vinkovci');
    }
  }
  if (r.has('vsz') || hit(SLAVONIJA_RE)) r.add('slavonija');
  return [...r];
}

// ---------- grupiranje u teme ----------

export function cluster(items) {
  const n = items.length;
  const tTok = items.map(i => tokens(i.title));
  const fTok = items.map((i, k) => new Set([...tTok[k], ...tokens(lead(i))]));
  const df = new Map();
  for (const s of fTok) for (const w of s) df.set(w, (df.get(w) || 0) + 1);
  const idf = w => Math.log(1 + n / (df.get(w) || 1));
  const weight = s => { let x = 0; for (const w of s) x += idf(w); return x; };
  const wT = tTok.map(weight), wF = fTok.map(weight);

  const parent = items.map((_, k) => k);
  const find = k => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  const shared = (a, b) => { let c = 0, x = 0; for (const w of a) if (b.has(w)) { c++; x += idf(w); } return [c, x]; };

  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (items[a].source === items[b].source) continue;
      const [ct, xt] = shared(tTok[a], tTok[b]);
      const [cf, xf] = shared(fTok[a], fTok[b]);
      const simT = ct ? xt / Math.min(wT[a], wT[b]) : 0;
      const simF = cf ? xf / Math.min(wF[a], wF[b]) : 0;
      if ((ct >= 2 && simT >= 0.42) || (cf >= 4 && simF >= 0.3 && simT >= 0.15)) parent[find(a)] = find(b);
    }
  }

  const groups = new Map();
  items.forEach((it, k) => {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(it);
  });
  return [...groups.values()].map(list => ({ items: list.sort((x, y) => (y.t || 0) - (x.t || 0)) }));
}

// ---------- rangiranje ----------

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function sectionVote(items) {
  const votes = {};
  for (const it of items) { const s = guessSection(it); votes[s] = (votes[s] || 0) + (s === 'hrvatska' ? 0.8 : 1); }
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}

export function extractiveSummary(items) {
  const best = [...items].sort((a, b) => (b.body || b.desc).length - (a.body || a.desc).length)[0];
  const text = clean(best.body || best.desc || '');
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || (text ? [text] : []);
  let out = '';
  for (const s of sentences) {
    if (out.length + s.length > 650) break;
    out += s;
    if ((out.match(/[.!?](\s|$)/g) || []).length >= 6) break;
  }
  return clean(out || text.slice(0, 600));
}

/**
 * Gradi izdanje teleteksta iz svježih feedova.
 * feeds: [{ source, items }], prev: prethodni news.json (ili null)
 * Vraća { edition, pending } gdje su pending teme kojima treba (novi) AI sažetak.
 */
export function buildEdition({ sources, feeds, prev, now = Date.now() }) {
  const srcById = Object.fromEntries(sources.map(s => [s.id, s]));
  const seen = new Set();
  const items = [];
  for (const f of feeds) {
    for (const it of f.items) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      if (it.t && now - it.t > MAX_AGE_H * 3600e3) continue;
      if (!it.t) it.t = now - 6 * 3600e3;
      items.push(it);
    }
  }

  const prevTopics = Object.values(prev?.topics || {});
  const prevByUrl = new Map();
  for (const t of prevTopics) for (const u of t.urls || []) prevByUrl.set(u, t);
  const prevShown = new Set(prevTopics.map(t => t.id));
  const claimed = new Set();

  const topics = cluster(items).map(c => {
    const nat = c.items.filter(i => !srcById[i.source].regional);
    const groups = new Set(nat.map(i => srcById[i.source].group || i.source));
    const newest = Math.max(...c.items.map(i => i.t));
    // Ako se stara tema raspala na dvije, samo prva zadržava staro ime i sažetak.
    const old = c.items.map(i => prevByUrl.get(i.link)).find(t => t && !claimed.has(t.id));
    if (old) claimed.add(old.id);
    const first = old?.first || Math.min(...c.items.map(i => i.t));
    const ageH = (now - newest) / 3600e3;
    const lifeH = (now - first) / 3600e3;
    let score = groups.size * 10 + nat.length * 1.5 + 8 * Math.exp(-ageH / 8);
    if (lifeH > 24) score *= 0.6;
    if (old && prevShown.has(old.id)) score += 2;
    const regional = c.items.length * 3 + 8 * Math.exp(-ageH / 10);
    const srcs = [];
    for (const it of c.items) if (!srcs.some(s => s.n === srcById[it.source].name)) srcs.push({ n: srcById[it.source].name, u: it.link });
    return {
      id: old?.id || hash(c.items[c.items.length - 1].link),
      title: old?.ai ? old.title : c.items.find(i => !srcById[i.source].regional)?.title || c.items[0].title,
      summary: old?.summary || null,
      ai: !!old?.ai,
      sumN: old?.sumN || 0,
      section: old?.aiSection || sectionVote(nat.length ? nat : c.items),
      aiSection: old?.aiSection,
      regions: regionsOf(c, srcById),
      national: nat.length > 0,
      sources: srcs.slice(0, 6),
      urls: c.items.map(i => i.link),
      first,
      t: newest,
      score: Math.round(score * 10) / 10,
      rscore: regional,
      _items: c.items,
    };
  });

  const nationalSorted = topics.filter(t => t.national).sort((a, b) => b.score - a.score);
  const frontWeight = { sport: 0.8, kultura: 0.7 };
  const front = [...nationalSorted]
    .sort((a, b) => b.score * (frontWeight[b.section] || 1) - a.score * (frontWeight[a.section] || 1))
    .slice(0, PER_LIST);

  const sections = SECTIONS.map(s => {
    const list = nationalSorted.filter(t => t.section === s.key);
    const forced = front.filter(t => t.section === s.key);
    const pick = [...forced, ...list.filter(t => !forced.includes(t))].slice(0, PER_LIST)
      .sort((a, b) => b.score - a.score);
    return { ...s, items: pick.map(t => t.id) };
  });

  const regions = REGIONS.map(r => {
    const pick = topics.filter(t => t.regions.includes(r.key)).sort((a, b) => b.rscore - a.rscore).slice(0, PER_LIST);
    return { ...r, items: pick.map(t => t.id) };
  });

  const used = new Set([...sections, ...regions].flatMap(s => s.items));
  const out = {};
  const pending = [];
  for (const t of topics) {
    if (!used.has(t.id)) continue;
    const needAi = !t.ai || t.sources.length >= t.sumN + 2;
    if (needAi) pending.push({ id: t.id, items: t._items });
    if (!t.summary) t.summary = extractiveSummary(t._items);
    const { _items, national, rscore, ...keep } = t;
    out[t.id] = keep;
  }

  const counts = {};
  for (const it of items) counts[it.source] = (counts[it.source] || 0) + 1;

  return {
    edition: {
      v: 1,
      generated: new Date(now).toISOString(),
      front: front.map(t => t.id),
      sections,
      regions,
      topics: out,
      sources: sources.map(s => ({ id: s.id, name: s.name, n: counts[s.id] || 0, regional: !!s.regional })),
    },
    pending,
  };
}

/** Upisuje AI rezultate u izdanje. results: { id: { naslov, sazetak, rubrika } } */
export function applySummaries(edition, results) {
  for (const [id, r] of Object.entries(results)) {
    const t = edition.topics[id];
    if (!t || !r?.sazetak) continue;
    t.title = clean(r.naslov || t.title);
    t.summary = clean(r.sazetak);
    t.ai = true;
    t.sumN = t.sources.length;
    if (SECTIONS.some(s => s.key === r.rubrika)) t.aiSection = r.rubrika;
  }
  edition.ai = Object.values(edition.topics).some(t => t.ai);
  return edition;
}

/** Izvlači glavni tekst članka iz HTML-a (za bolje AI sažetke kad RSS ima premalo teksta). */
export function articleText(html) {
  const og = (html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i) || [])[1] || '';
  const paras = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map(m => clean(htmlToText(m[1])))
    .filter(p => p.length > 60 && !/kolačić|cookie|pretplat|newsletter|©/i.test(p));
  return clean(decodeEntities(og) + ' ' + paras.join(' ')).slice(0, 3000);
}
