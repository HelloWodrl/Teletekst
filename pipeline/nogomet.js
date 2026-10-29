// Između satnih osvježavanja, svakih 15 minuta: node pipeline/nogomet.js
// Uzme objavljeno izdanje sa stranice (SITE_URL), osvježi samo nogomet i spremi ga u public/data/news.json.
// U GITHUB_OUTPUT zapiše changed=true/false, da se stranica objavi samo kad se nešto promijenilo.

import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import { loadFootball, footballChanged } from './football.js';
import { get, siteDataUrl } from './http.js';

const OUT = new URL('../public/data/news.json', import.meta.url);

async function main() {
  const site = process.env.SITE_URL;
  if (!site) throw new Error('SITE_URL nije postavljen');
  // Bez objavljenog izdanja nema se što osvježiti: objava bi izbrisala vijesti.
  const edition = JSON.parse(await get(siteDataUrl(site)));

  const football = await loadFootball(get, edition.football);
  const changed = footballChanged(football, edition.football);
  console.log(changed ? 'Rezultati su se promijenili' : 'Bez promjena, objava nije potrebna');

  if (changed) {
    edition.football = football;
    await mkdir(new URL('.', OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(edition));
  }
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
