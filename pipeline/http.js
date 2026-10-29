// Zajednički dohvat za run.js i nogomet.js.
// Iskreno predstavljanje; lažni "Chrome" neki portali (Osijek031) prepoznaju i blokiraju.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TeletekstVijesti/1.0; obiteljska aplikacija)',
  'Accept': 'application/rss+xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.5',
  'Accept-Language': 'hr-HR,hr;q=0.9,en;q=0.5',
};

export async function get(url, ms = 20000) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Adresa zadnjeg objavljenog izdanja (news.json) na GitHub Pages
export function siteDataUrl(site) {
  return new URL('data/news.json', site.endsWith('/') ? site : site + '/').href;
}
