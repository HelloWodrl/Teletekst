# Teletekst vijesti: stanje projekta (28.10.2026.)

## Dogovoreno
- **PWA** aplikacija u teletekst stilu, za obitelj, sve besplatno (GitHub Pages + GitHub Actions + Gemini besplatna razina).
- **Izvori (13):** Jutarnji, Večernji, Index, Dnevnik.hr, Net.hr, N1, tportal, RTL, Telegram + regionalni SiB, Osijek031, Vinkulja, Budica.
- **Nogomet (550–557):** HNL, Prva NL i lige petice s LiveScorea; 1/2 utakmice (danas + zadnji/sljedeći dani), 2/2 tablica. Osvježava se svakih 15 minuta (`.github/workflows/nogomet.yml`, objava samo kad se nešto promijeni).
- **Brojčane tipke** se mogu sakriti; tada se slova izdužuju (do 1,6×) za bolju čitljivost.
  HRT i Glas Slavonije su preskočeni; 24sata je maknut jer blokira zahtjeve s GitHuba (HTTP 403).
- **Osvježavanje:** svakih sat vremena, novija/važnija tema zamjenjuje slabiju.
- **Sažeci:** 5–6 rečenica, Gemini (za početak), uz izvore i link na članak.
- **Podstranice** se listaju tipkom „Sljedeća“ (ili prstom), bez automatskog izmjenjivanja.
- **Stranice:** vidi README.md (100 naslovnica, 101 vodič, 200–700 rubrike, 800/820/840 regije, 900 prognoza Vinkovci, 199 info).

## Gotovo
- [x] Obrada vijesti (`pipeline/`): RSS, grupiranje u teme, rangiranje, rubrike, regije, Gemini sažeci
- [x] Teletekst sučelje (`public/`): ekran 40×24, daljinski upravljač, upis broja, obojene tipke, listanje prstom
- [x] Vodič 101, prognoza 900 (Open-Meteo), info 199
- [x] PWA: manifest, service worker (radi i bez interneta), ikone
- [x] GitHub Actions: satno osvježavanje i objava na GitHub Pages
- [x] Lokalno testiranje (`dev/`): PowerShell poslužitelj, preuzimanje feedova, testna obrada
- [x] Testirano lokalno na stvarnim vijestima: mobitel (375 px) i računalo

## Nije još provjereno
- Gemini sažeci (potreban API ključ) i `pipeline/run.js` pod Node.js-om: prvi put će se pokrenuti na GitHubu
- Instalacija na mobitel (traži https, dakle tek nakon objave)

## Sljedeće
- [ ] Postavljanje: GitHub račun i repozitorij, Gemini API ključ, uključivanje GitHub Pages
- [ ] Prvo pokretanje na GitHubu i provjera AI sažetaka
- [ ] Instalacija na mobitele obitelji
- [ ] Moguća poboljšanja: dulje zadržavanje regionalnih vijesti (Vinkulja ima samo 10 zadnjih u feedu)
