// Sažeci pomoću Google Gemini API-ja (besplatna razina).
// Više tema ide u jedan zahtjev kako bi se ostalo daleko ispod dnevnog ograničenja.
// Kad je model preopterećen (503/429), prelazi se na sljedeći; kad ni jedan ne radi,
// sažeci se preskaču i pokušavaju ponovno idući sat.

import { SECTIONS } from './core.js';

const BATCH = 8;
const PAUSE_MS = 4000;
const REQUEST_TIMEOUT_MS = 90e3;
const BUDGET_MS = 6 * 60e3;
const MAX_FAILED_BATCHES = 2;
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function prompt(batch) {
  const teme = batch.map(t => {
    const izvori = t.items.slice(0, 3).map(i => `- [${i.sourceName}] ${i.title}\n  ${(i.text || '').slice(0, 1400)}`).join('\n');
    return `### TEMA ${t.id}\n${izvori}`;
  }).join('\n\n');
  return `Ti si urednik teleteksta. Za svaku temu napiši na hrvatskom jeziku:
- naslov: kratak, informativan naslov, najviše 55 znakova, bez navodnika, uskličnika i senzacionalizma
- sazetak: neutralan sažetak od 5 do 6 kratkih rečenica (ukupno najviše 650 znakova), vlastitim riječima,
  samo s činjenicama iz priloženih tekstova, bez nagađanja, bez pozivanja na "članak" ili "portal".
  Ako se izvori razlikuju u brojkama, navedi najnoviju ili napiši da se podaci razlikuju.
- rubrika: jedna od: ${SECTIONS.map(s => s.key).join(', ')}

Vrati JSON niz s poljima id, naslov, sazetak, rubrika, po jedan objekt za svaku temu.

${teme}`;
}

function body(batch) {
  return JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt(batch) }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            naslov: { type: 'STRING' },
            sazetak: { type: 'STRING' },
            rubrika: { type: 'STRING', enum: SECTIONS.map(s => s.key) },
          },
          required: ['id', 'naslov', 'sazetak', 'rubrika'],
        },
      },
    },
  });
}

// Vraća rezultat, 'busy' (pokušaj drugi model) ili 'gone' (model ne postoji, makni ga s popisa).
async function callModel(model, batch, apiKey) {
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: body(batch),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    console.warn(`Gemini ${model}: ${e.message}`);
    return 'busy';
  }
  if (res.status === 404) { console.warn(`Gemini ${model}: model ne postoji`); return 'gone'; }
  if (res.status === 429 || res.status >= 500) { console.warn(`Gemini ${model}: ${res.status}`); return 'busy'; }
  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
  try { return JSON.parse(text); } catch { console.warn(`Gemini ${model}: neispravan JSON`); return 'busy'; }
}

/** pending: [{ id, items: [{ sourceName, title, text }] }] → { id: { naslov, sazetak, rubrika } } */
export async function summarize(pending, { apiKey, model }) {
  const models = [...new Set([model, ...FALLBACK_MODELS].filter(Boolean))];
  const deadline = Date.now() + BUDGET_MS;
  const out = {};
  let failedInRow = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    if (Date.now() > deadline) { console.warn('Isteklo vrijeme za sažetke, ostatak idući sat'); break; }
    if (failedInRow >= MAX_FAILED_BATCHES) { console.warn('Gemini trenutno ne radi, ostatak idući sat'); break; }
    const batch = pending.slice(i, i + BATCH);
    let result = null;
    for (let round = 0; round < 2 && !result; round++) {
      if (round) await sleep(15000);
      for (const m of [...models]) {
        const r = await callModel(m, batch, apiKey);
        if (r === 'gone') models.splice(models.indexOf(m), 1);
        else if (r !== 'busy') { result = r; console.log(`Sažeci ${i + 1}-${i + batch.length}: ${m}`); break; }
      }
      if (!models.length) break;
    }
    if (result) {
      failedInRow = 0;
      for (const r of result) if (r?.id) out[r.id] = r;
    } else {
      failedInRow++;
      console.error(`Sažeci ${i + 1}-${i + batch.length} nisu uspjeli`);
    }
    if (!models.length) { console.error('Nijedan Gemini model nije dostupan'); break; }
    if (i + BATCH < pending.length) await sleep(PAUSE_MS);
  }
  return out;
}
