# Teletekst vijesti

Najvažnije vijesti s hrvatskih portala, sažete i prikazane kao teletekst na televizoru.
Web aplikacija (PWA) koja se s preglednika dodaje na početni zaslon mobitela (Android i iPhone).

## Kako radi

1. **Svaki sat** GitHub Actions pokrene `pipeline/run.js`:
   - dohvati RSS feedove 13 portala (`pipeline/sources.json`)
   - članke o istoj temi spoji u jednu temu i rangira ih po broju neovisnih portala i svježini
   - razvrsta teme po rubrikama i regijama (Slavonija, Vukovarsko-srijemska, Vinkovci)
   - za nove teme napravi sažetak od 5–6 rečenica pomoću Gemini AI-ja
   - dohvati nogometne rezultate i tablice 7 liga s LiveScorea (`pipeline/football.js`)
   - spremi sve u `public/data/news.json`
   Između toga, svakih 15 minuta `pipeline/nogomet.js` osvježi samo nogometne rezultate
   (`.github/workflows/nogomet.yml`) i objavi ih ako se nešto promijenilo.
2. **Aplikacija** (`public/`) čita taj JSON i crta teletekst stranice. Prognoza za Vinkovce dolazi izravno s Open-Meteo.

Sve je besplatno: GitHub Pages (hosting), GitHub Actions (satna obrada), Gemini (besplatna razina), Open-Meteo.

## Stranice

| Broj | Sadržaj |
|---|---|
| 100 | Naslovnica, 10 najvažnijih tema |
| 101 | Vodič kroz stranice i tipke |
| 199 | Izvori i informacije |
| 200–210 | Hrvatska |
| 300–310 | Svijet |
| 400–410 | Gospodarstvo |
| 500–510 | Sport |
| 550 | Nogomet: popis liga |
| 551–557 | HNL, Prva NL, Premier League, LaLiga, Bundesliga, Serie A, Ligue 1 (1/2 utakmice, 2/2 tablica) |
| 600–610 | Kultura i zabava |
| 700–710 | Znanost i tehnologija |
| 800–810 | Slavonija |
| 820–830 | Vukovarsko-srijemska županija |
| 840–850 | Vinkovci |
| 900 | Vrijeme u Vinkovcima |

Tipke: crvena = prethodna, zelena = sljedeća, žuta = rubrika/početna, plava = vodič.
Brojevi 0–9 otvaraju stranicu, a povlačenje prstom lijevo-desno lista podstranice.
Tipka „Sakrij brojke“ skriva brojčanu tipkovnicu, pa ekran i slova postaju veći (postavka se pamti na uređaju).

## Struktura

```
pipeline/
  sources.json   popis portala i RSS adresa
  core.js        čitanje RSS-a, grupiranje, rangiranje, rubrike, regije
  gemini.js      AI sažeci
  football.js    nogometni rezultati i tablice (LiveScore)
  nogomet.js     osvježavanje samo rezultata, svakih 15 minuta
  http.js        zajednički dohvat s interneta
  run.js         glavna skripta (Node.js 22, pokreće je GitHub Actions)
public/          aplikacija koja se objavljuje
  data/news.json zadnje izdanje vijesti (generira se)
.github/workflows/osvjezavanje.yml   satno osvježavanje i objava
dev/             alati za lokalno testiranje na Windowsima (bez Node.js-a)
```

## Lokalno testiranje

```powershell
powershell -ExecutionPolicy Bypass -File dev\snapshot.ps1   # preuzmi trenutne feedove
powershell -ExecutionPolicy Bypass -File dev\serve.ps1      # pokreni lokalni poslužitelj
```

Zatim u pregledniku:
- `http://localhost:8080/dev/harness.html` obradi preuzete feedove i spremi `public/data/news.json`
- `http://localhost:8080/public/` je aplikacija

Lokalno se ne rade AI sažeci, nego se koriste prve rečenice iz članaka.

## Postavljanje na internet

Upute korak po korak dolaze kad budemo postavljali hosting (GitHub račun, Gemini ključ, uključivanje GitHub Pages).
