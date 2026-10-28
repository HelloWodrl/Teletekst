// Teletekst vijesti: ekran od 40×24 znaka kao na televizoru.
// Podaci dolaze iz data/news.json (osvježava ga pipeline svaki sat),
// a prognoza za Vinkovce izravno s Open-Meteo.

const W = 40;
const ROWS = 24;
const BODY = 21;              // redovi 2–22; 0 je zaglavlje, 1 traka rubrike, 23 obojene tipke
const TEXT_W = 38;            // tekst s razmakom od jednog znaka s lijeve strane
const DATA_REFRESH_MS = 10 * 60e3;
const WEATHER_MAX_AGE_MS = 30 * 60e3;
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=45.2883&longitude=18.8047' +
  '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&timezone=Europe%2FZagreb&forecast_days=7';

const DAYS = ['NED', 'PON', 'UTO', 'SRI', 'ČET', 'PET', 'SUB'];
const NAMES = {
  hrvatska: 'Hrvatska', svijet: 'Svijet', gospodarstvo: 'Gospodarstvo', sport: 'Sport',
  kultura: 'Kultura i zabava', znanost: 'Znanost i tehnologija',
  slavonija: 'Slavonija', vsz: 'Vukovarsko-srijemska ž.', vinkovci: 'Vinkovci',
};
// [pozadina, slova] trake na vrhu stranice
const BANNER = {
  front: ['b', 'y'], guide: ['m', 'w'], info: ['b', 'w'], weather: ['c', 'b'], missing: ['r', 'w'],
  hrvatska: ['b', 'y'], svijet: ['r', 'w'], gospodarstvo: ['c', 'b'], sport: ['g', 'k'],
  kultura: ['m', 'w'], znanost: ['y', 'b'], slavonija: ['g', 'k'], vsz: ['b', 'w'], vinkovci: ['r', 'y'],
};

// WMO kodovi vremena: [puni opis, kratki za tablicu]
const WMO = {
  0: ['Vedro', 'Vedro'], 1: ['Pretežno vedro', 'Pret.vedro'], 2: ['Djelomično oblačno', 'Djel.obl.'],
  3: ['Oblačno', 'Oblačno'], 45: ['Magla', 'Magla'], 48: ['Magla s injem', 'Magla'],
  51: ['Slaba rosulja', 'Rosulja'], 53: ['Rosulja', 'Rosulja'], 55: ['Jaka rosulja', 'Rosulja'],
  56: ['Ledena rosulja', 'Led.rosulja'], 57: ['Ledena rosulja', 'Led.rosulja'],
  61: ['Slaba kiša', 'Sl.kiša'], 63: ['Kiša', 'Kiša'], 65: ['Jaka kiša', 'Jaka kiša'],
  66: ['Ledena kiša', 'Led.kiša'], 67: ['Ledena kiša', 'Led.kiša'],
  71: ['Slab snijeg', 'Sl.snijeg'], 73: ['Snijeg', 'Snijeg'], 75: ['Jak snijeg', 'Jak snijeg'], 77: ['Zrnati snijeg', 'Snijeg'],
  80: ['Slabi pljuskovi', 'Pljusak'], 81: ['Pljuskovi', 'Pljusak'], 82: ['Jaki pljuskovi', 'Pljusak'],
  85: ['Snježni pljuskovi', 'Sn.pljusak'], 86: ['Snježni pljuskovi', 'Sn.pljusak'],
  95: ['Grmljavina', 'Grmljavina'], 96: ['Grmljavina s tučom', 'Tuča'], 99: ['Grmljavina s tučom', 'Tuča'],
};

let data = null;
let dataError = false;
let weather = null;
let weatherError = false;
let pages = new Map();
let order = [];
let cur = { p: 100, s: 0 };
let subCount = 1;
let fast = [];
let typed = '';
let typedTimer = null;

const screen = document.getElementById('screen');

// ---------- pomoćne funkcije za tekst ----------

const S = (t, f = 'w', b = null, x = {}) => ({ t, f, b, ...x });
const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const two = n => String(n).padStart(2, '0');
const blank = () => [];

function wrap(text, width) {
  const lines = [];
  let line = '';
  for (let w of String(text || '').split(/\s+/).filter(Boolean)) {
    while (w.length > width) {
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= width) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${DAYS[d.getDay()]} ${two(d.getDate())}.${two(d.getMonth() + 1)}. ${two(d.getHours())}:${two(d.getMinutes())}`;
}

// Naslov s točkicama do broja stranice: " Naslov vijesti .............. 201"
function entry(num, title, color) {
  let lines = wrap(title, 33);
  if (lines.length > 2) lines = [lines[0], lines[1].slice(0, 32) + '…'];
  const rows = lines.map(l => [S(' '), S(l, color, null, { go: num })]);
  const last = rows[rows.length - 1];
  const len = lines[lines.length - 1].length;
  last.push(S(' ' + '.'.repeat(34 - len) + ' ', 'b'), S(String(num), 'w', null, { go: num }));
  return rows;
}

function textRows(text, color) {
  return wrap(text, TEXT_W).map(l => [S(' ' + l, color)]);
}

// ---------- registar stranica ----------

function buildPages() {
  pages = new Map([[100, { kind: 'front' }], [101, { kind: 'guide' }], [199, { kind: 'info' }], [900, { kind: 'weather' }]]);
  for (const list of [...(data?.sections || []), ...(data?.regions || [])]) {
    pages.set(list.page, { kind: 'index', list });
    list.items.forEach((id, i) => pages.set(list.page + 1 + i, { kind: 'topic', list, id }));
  }
  order = [...pages.keys()].sort((a, b) => a - b);
}

function pageOf(id) {
  for (const list of [...(data?.sections || []), ...(data?.regions || [])]) {
    const i = list.items.indexOf(id);
    if (i >= 0) return list.page + 1 + i;
  }
  return null;
}

// ---------- sadržaj stranica ----------

function loadingRows() {
  if (dataError) return [blank(), ...textRows('Vijesti trenutno nisu dostupne. Provjerite internetsku vezu.', 'r')];
  return [blank(), [S(' Učitavanje vijesti...', 'w', null, { cls: 'blink' })]];
}

function weatherLine() {
  if (!weather) return null;
  const c = weather.current;
  const txt = `${Math.round(c.temperature_2m)}°C ${(WMO[c.weather_code] || ['', ''])[1]}`;
  const row = [S(' VINKOVCI ', 'y', null, { go: 900 }), S(txt, 'w', null, { go: 900 })];
  const used = 10 + txt.length;
  row.push(S(' ' + '.'.repeat(Math.max(1, 35 - used)) + ' ', 'b'), S('900', 'w', null, { go: 900 }));
  return row;
}

function frontPage() {
  const lines = [blank()];
  if (!data) lines.push(...loadingRows());
  else data.front.forEach((id, i) => {
    const t = data.topics[id];
    if (t) lines.push(...entry(pageOf(id), t.title, i % 2 ? 'w' : 'c'));
  });
  const wl = weatherLine();
  if (wl) lines.push(blank(), wl);
  return { kind: 'front', title: 'NAJVAŽNIJE VIJESTI', lines };
}

function guidePage() {
  const item = (num, name) => {
    const row = [S(' '), S(name, 'w', null, { go: num })];
    row.push(S(' ' + '.'.repeat(Math.max(1, 34 - name.length)) + ' ', 'b'), S(String(num), 'c', null, { go: num }));
    return row;
  };
  const lines = [blank(), [S(' STRANICE', 'y')]];
  lines.push(item(100, 'Naslovnica'));
  for (const s of data?.sections || []) lines.push(item(s.page, NAMES[s.key] || s.title));
  for (const r of data?.regions || []) lines.push(item(r.page, NAMES[r.key] || r.title));
  lines.push(item(900, 'Vrijeme Vinkovci'), item(199, 'Izvori i informacije'));
  lines.push(
    blank(),
    [S(' TIPKE', 'y')],
    [S(' Crvena  ', 'r'), S('prethodna stranica')],
    [S(' Zelena  ', 'g'), S('sljedeća stranica')],
    [S(' Žuta    ', 'y'), S('rubrika / početna')],
    [S(' Plava   ', 'c'), S('ovaj vodič')],
    [S(' 0 - 9   ', 'w'), S('upišite broj stranice')],
  );
  return { kind: 'guide', title: 'VODIČ KROZ TELETEKST', lines };
}

function indexPage({ list }) {
  const lines = [blank()];
  if (!list.items.length) lines.push(...textRows('Trenutno nema vijesti u ovoj rubrici.', 'w'));
  list.items.forEach((id, i) => {
    const t = data.topics[id];
    if (t) lines.push(...entry(list.page + 1 + i, t.title, i % 2 ? 'w' : 'c'));
  });
  return { kind: 'index', key: list.key, title: list.title, lines };
}

function topicPage({ list, id }) {
  const t = data.topics[id];
  const lines = [blank(), ...wrap(t.title, TEXT_W).map(l => [S(' ' + l, 'y')]), blank(), ...textRows(t.summary, 'w'), blank()];
  lines.push([S(' IZVORI', 'g'), S(' · dodirnite za cijeli članak', 'm')]);
  let row = [S(' ')], used = 1;
  for (const s of t.sources) {
    const label = `› ${s.n}`;
    if (used + label.length + 2 > W && used > 1) { lines.push(row); row = [S(' ')]; used = 1; }
    row.push(S(label, 'c', null, { href: s.u }), S('  '));
    used += label.length + 2;
  }
  lines.push(row, [S(` Zadnja vijest: ${fmtTime(t.t)}`, 'w')]);
  return { kind: 'topic', key: list.key, title: list.title, up: list.page, lines };
}

function infoPage() {
  const lines = [blank()];
  if (!data) lines.push(...loadingRows());
  else {
    lines.push(
      [S(' Osvježeno:  ', 'y'), S(fmtTime(data.generated))],
      [S(' Sažeci:     ', 'y'), S(data.ai ? 'AI (Google Gemini)' : 'početak članaka')],
      [S(' Osvježavanje svakih sat vremena', 'w')],
      blank(),
      [S(' IZVORI', 'y')],
      ...data.sources.map(s => [S(' ' + pad(s.name, 16), 'w'), s.n ? S(`${s.n} vijesti`, 'g') : S('nedostupno', 'r')]),
      blank(),
      ...textRows('Sažeci nastaju automatski i mogu sadržavati pogreške. Cijela vijest je na portalu izvora.', 'c'),
      [S(' Prognoza: Open-Meteo.com', 'c')],
    );
  }
  return { kind: 'info', title: 'IZVORI I INFORMACIJE', lines };
}

function weatherPage() {
  const lines = [blank()];
  if (!weather) {
    lines.push(weatherError ? [S(' Prognoza trenutno nije dostupna.', 'r')] : [S(' Učitavanje prognoze...', 'w', null, { cls: 'blink' })]);
  } else {
    const c = weather.current, d = weather.daily;
    lines.push(
      [S(' SADA', 'y')],
      [S(`  ${Math.round(c.temperature_2m)}°C`, 'y'), S(`  ${(WMO[c.weather_code] || ['?'])[0]}`, 'w')],
      [S(`  Vjetar ${Math.round(c.wind_speed_10m)} km/h   Vlaga ${Math.round(c.relative_humidity_2m)}%`, 'w')],
      blank(),
      [S(' PROGNOZA ZA 7 DANA', 'y')],
      [S(' DAN DATUM  ' + ' MIN' + '  MAX' + ' KIŠA' + ' VRIJEME', 'c')],
    );
    d.time.forEach((day, i) => {
      const dt = new Date(day + 'T12:00:00');
      const pp = d.precipitation_probability_max[i];
      lines.push([
        S(` ${DAYS[dt.getDay()]} ${two(dt.getDate())}.${two(dt.getMonth() + 1)}. `, i ? 'w' : 'y'),
        S(`${String(Math.round(d.temperature_2m_min[i])).padStart(3)}°`, 'c'),
        S(`${String(Math.round(d.temperature_2m_max[i])).padStart(4)}°`, 'y'),
        S(`${pp == null ? '  - ' : String(pp).padStart(4) + '%'} `, 'w'),
        S((WMO[d.weather_code[i]] || ['', '?'])[1], 'g'),
      ]);
    });
    lines.push(blank(), [S(` Ažurirano ${fmtTime(weather.at)}`, 'w')], [S(' Izvor: Open-Meteo.com', 'c')]);
  }
  return { kind: 'weather', title: 'VRIJEME - VINKOVCI', lines };
}

function missingPage(p) {
  return {
    kind: 'missing', title: `STRANICA ${p} NE POSTOJI`,
    lines: [blank(), ...textRows('Ova stranica trenutno nema sadržaja. Popis svih stranica je u vodiču na stranici 101.', 'w'), blank(), [S(' ›  Vodič ', 'c', null, { go: 101 }), S('101', 'w', null, { go: 101 })]],
  };
}

function buildPage(p) {
  const pg = pages.get(p);
  if (!pg) return data ? missingPage(p) : { kind: 'front', title: 'TELETEKST', lines: loadingRows() };
  if (pg.kind === 'front') return frontPage();
  if (pg.kind === 'guide') return guidePage();
  if (pg.kind === 'info') return infoPage();
  if (pg.kind === 'weather') return weatherPage();
  if (pg.kind === 'index') return indexPage(pg);
  return topicPage(pg);
}

// ---------- iscrtavanje ----------

function esc(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function rowHtml(row) {
  let used = 0;
  let html = '';
  for (const s of row) {
    const t = s.t.slice(0, W - used);
    if (!t) continue;
    used += t.length;
    const cls = [`fg-${s.f}`, s.b && `bg-${s.b}`, s.cls].filter(Boolean).join(' ');
    const attrs = (s.go ? ` data-go="${s.go}"` : '') + (s.href ? ` data-href="${esc(s.href)}"` : '') + (s.fast != null ? ` data-fast="${s.fast}"` : '');
    html += `<span class="${cls}"${attrs}>${esc(t)}</span>`;
  }
  if (used < W) html += `<span>${' '.repeat(W - used)}</span>`;
  return `<div class="row">${html}</div>`;
}

function clockText() {
  const d = new Date();
  return `${DAYS[d.getDay()].toLowerCase()} ${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

function headerRow() {
  const num = typed ? 'P' + pad(typed, 3).replace(/ /g, '-') : 'P' + cur.p;
  return [S(num, typed ? 'y' : 'w'), S('  '), S('TELETEKST', 'y', null, { go: 100 }), S('       '), S(clockText(), 'w', null, { cls: 'clock' })];
}

function bannerRow(pg) {
  const [bg, fg] = BANNER[pg.key] || BANNER[pg.kind] || ['b', 'w'];
  const ind = subCount > 1 ? `${cur.s + 1}/${subCount} ` : '';
  return [S(pad(' ' + pg.title, W - ind.length) + ind, fg, bg)];
}

function fastFor(pg) {
  const up = pg.kind === 'topic' ? [pg.up, 'Rubrika'] : pg.kind === 'front' ? [900, 'Vrijeme'] : [100, 'Početna'];
  const blue = cur.p === 101 ? [199, 'Izvori'] : [101, 'Vodič'];
  return [
    { label: 'Prethodna', act: prev },
    { label: 'Sljedeća', act: next },
    { label: up[1], act: () => go(up[0]) },
    { label: blue[1], act: () => go(blue[0]) },
  ];
}

function fastRow() {
  const colors = [['r', 'w'], ['g', 'k'], ['y', 'k'], ['c', 'k']];
  return fast.map((f, i) => {
    const l = f.label;
    const left = Math.floor((10 - l.length) / 2);
    return S(pad(' '.repeat(left) + l, 10), colors[i][1], colors[i][0], { fast: i });
  });
}

function render() {
  const pg = buildPage(cur.p);
  const chunks = [];
  for (let i = 0; i < pg.lines.length; i += BODY) chunks.push(pg.lines.slice(i, i + BODY));
  if (!chunks.length) chunks.push([]);
  subCount = chunks.length;
  if (cur.s >= subCount) cur.s = subCount - 1;
  fast = fastFor(pg);

  const rows = [headerRow(), bannerRow(pg)];
  for (let i = 0; i < BODY; i++) rows.push(chunks[cur.s][i] || []);
  rows.push(fastRow());
  screen.innerHTML = rows.map(rowHtml).join('');

  document.querySelectorAll('#remote [data-fast]').forEach((b, i) => { b.textContent = fast[i].label; });
  document.title = `${cur.p} · Teletekst vijesti`;
}

function tickClock() {
  const el = screen.querySelector('.clock');
  if (el) el.textContent = clockText();
}

// ---------- navigacija ----------

function go(p, s = 0, push = true) {
  typed = '';
  cur = { p, s };
  history[push ? 'pushState' : 'replaceState'](cur, '', '#' + p);
  render();
  window.scrollTo(0, 0);
}

function stepPage(dir) {
  const known = order.length ? order : [100];
  let i = known.indexOf(cur.p);
  if (i < 0) i = dir > 0 ? known.findIndex(p => p > cur.p) - 1 : known.findIndex(p => p >= cur.p);
  const next = known[(i + dir + known.length) % known.length];
  go(next);
}

function next() {
  if (cur.s < subCount - 1) { cur.s++; history.replaceState(cur, '', '#' + cur.p); render(); }
  else stepPage(1);
}

function prev() {
  if (cur.s > 0) { cur.s--; history.replaceState(cur, '', '#' + cur.p); render(); }
  else stepPage(-1);
}

function digit(d) {
  typed += d;
  clearTimeout(typedTimer);
  if (typed.length === 3) {
    const p = Number(typed);
    typed = '';
    if (p >= 100) go(p);
    else render();
    return;
  }
  typedTimer = setTimeout(() => { typed = ''; render(); }, 4000);
  render();
}

screen.addEventListener('click', e => {
  const el = e.target.closest('[data-go],[data-href],[data-fast]');
  if (!el) return;
  if (el.dataset.href) window.open(el.dataset.href, '_blank', 'noopener');
  else if (el.dataset.go) go(Number(el.dataset.go));
  else fast[Number(el.dataset.fast)]?.act();
});

document.getElementById('remote').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.fast != null) fast[Number(b.dataset.fast)]?.act();
  else if (b.dataset.digit != null) digit(b.dataset.digit);
  else if (b.dataset.step) stepPage(Number(b.dataset.step));
});

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key)) digit(e.key);
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowUp') stepPage(1);
  else if (e.key === 'ArrowDown') stepPage(-1);
  else if (e.key === 'Escape' || e.key === 'Home') go(100);
  else return;
  e.preventDefault();
});

let touchX = null, touchY = null;
document.getElementById('tv').addEventListener('touchstart', e => {
  touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
}, { passive: true });
document.getElementById('tv').addEventListener('touchend', e => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  touchX = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
});

window.addEventListener('popstate', e => {
  const p = e.state?.p ?? (Number(location.hash.slice(1)) || 100);
  cur = { p, s: e.state?.s ?? 0 };
  typed = '';
  render();
});

// ---------- veličina ekrana ----------

function fit() {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:100px;font-family:inherit';
  probe.textContent = '0'.repeat(W);
  document.body.appendChild(probe);
  const ratio = probe.getBoundingClientRect().width / 100;
  probe.remove();
  const remote = document.getElementById('remote');
  const side = getComputedStyle(document.body).flexDirection === 'row';
  const availW = (side ? innerWidth - remote.offsetWidth - 48 : innerWidth) - 16;
  const availH = (side ? innerHeight - 40 : innerHeight - remote.offsetHeight) - 16;
  const fs = Math.max(8, Math.floor(Math.min(availW / ratio, availH / ROWS) * 4) / 4);
  document.documentElement.style.setProperty('--fs', fs + 'px');
}

// ---------- podaci ----------

async function loadData() {
  try {
    const res = await fetch('data/news.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    dataError = false;
    if (!data || d.generated !== data.generated) {
      data = d;
      buildPages();
      render();
    }
  } catch {
    dataError = true;
    if (!data) render();
  }
}

async function loadWeather(force = false) {
  try {
    const cached = JSON.parse(localStorage.getItem('tt-weather') || 'null');
    if (cached && !weather) { weather = cached; render(); }
    if (!force && cached && Date.now() - cached.at < WEATHER_MAX_AGE_MS) return;
  } catch { /* localStorage nije dostupan */ }
  try {
    const res = await fetch(WEATHER_URL);
    if (!res.ok) throw new Error(res.status);
    weather = { ...(await res.json()), at: Date.now() };
    weatherError = false;
    try { localStorage.setItem('tt-weather', JSON.stringify(weather)); } catch { /* nije važno */ }
  } catch {
    weatherError = true;
  }
  render();
}

// ---------- pokretanje ----------

const start = Number(location.hash.slice(1));
cur = { p: start >= 100 && start <= 999 ? start : 100, s: 0 };
history.replaceState(cur, '', '#' + cur.p);
buildPages();
fit();
render();
document.fonts?.ready.then(fit);
addEventListener('resize', fit);
setInterval(tickClock, 1000);

loadData();
loadWeather();
setInterval(() => { if (!document.hidden) { loadData(); loadWeather(); } }, DATA_REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadData(); loadWeather(); } });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
