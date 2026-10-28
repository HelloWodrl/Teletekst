// Pokreće se svaki sat na GitHub Actionsu: node pipeline/run.js
// Varijable okruženja:
//   GEMINI_API_KEY  ključ za Gemini (bez njega sažeci su prve rečenice iz RSS-a)
//   GEMINI_MODEL    model, zadano gemini-flash-latest
//   SITE_URL        adresa objavljene stranice, odakle se čita prethodno izdanje

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseFeed, buildEdition, applySummaries, articleText } from './core.js';
import { summarize } from './gemini.js';

const OUT = new URL('../public/data/news.json', import.meta.url);
// Iskreno predstavljanje; lažni "Chrome" neki portali (Osijek031) prepoznaju i blokiraju.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TeletekstVijesti/1.0; obiteljska aplikacija)',
  'Accept': 'application/rss+xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.5',
  'Accept-Language': 'hr-HR,hr;q=0.9,en;q=0.5',
};
const MAX_ARTICLE_FETCH = 25;

async function get(url, ms = 20000) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function loadPrev() {
  const site = process.env.SITE_URL;
  if (site) {
    try { return JSON.parse(await get(new URL('data/news.json', site.endsWith('/') ? site : site + '/').href)); }
    catch (e) { console.warn(`Prethodno izdanje sa stranice nije dostupno: ${e.message}`); }
  }
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return null; }
}

async function main() {
  const sources = JSON.parse(await readFile(new URL('./sources.json', import.meta.url), 'utf8'));
  const feeds = await Promise.all(sources.flatMap(s => s.urls.map(async url => {
    try {
      const items = parseFeed(await get(url), s);
      console.log(`${s.name.padEnd(12)} ${String(items.length).padStart(3)}  ${url}`);
      return { source: s.id, items };
    } catch (e) {
      console.warn(`${s.name.padEnd(12)} GREŠKA ${e.message}  ${url}`);
      return { source: s.id, items: [] };
    }
  })));

  const prev = await loadPrev();
  const srcName = Object.fromEntries(sources.map(s => [s.id, s.name]));
  let { edition, pending } = buildEdition({ sources, feeds, prev });
  console.log(`Teme: ${Object.keys(edition.topics).length}, za sažetak: ${pending.length}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && pending.length) {
    // Kad RSS ima malo teksta, dohvati početak članka da sažetak ima od čega nastati.
    let fetched = 0;
    const input = [];
    for (const p of pending) {
      const items = [];
      for (const it of p.items.slice(0, 3)) {
        let text = it.body || it.desc;
        if (text.length < 500 && fetched < MAX_ARTICLE_FETCH) {
          fetched++;
          try { text = articleText(await get(it.link, 15000)) || text; } catch { /* ostaje RSS opis */ }
        }
        items.push({ sourceName: srcName[it.source], title: it.title, text });
      }
      input.push({ id: p.id, items });
    }
    const results = await summarize(input, { apiKey, model: process.env.GEMINI_MODEL || 'gemini-flash-latest' });
    console.log(`AI sažetaka: ${Object.keys(results).length}/${pending.length}`);
    applySummaries(edition, results);
    // Drugi prolaz: AI je možda premjestio teme u druge rubrike.
    ({ edition } = buildEdition({ sources, feeds, prev: edition }));
  }

  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(edition));
  console.log(`Spremljeno: ${OUT.pathname}`);
}

main().catch(e => { console.error(e); process.exit(1); });
