// Sažeci pomoću Google Gemini API-ja (besplatna razina).
// Više tema ide u jedan zahtjev kako bi se ostalo daleko ispod dnevnog ograničenja.

import { SECTIONS } from './core.js';

const BATCH = 8;
const PAUSE_MS = 5000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function prompt(batch) {
  const teme = batch.map(t => {
    const izvori = t.items.slice(0, 3).map(i => `- [${i.sourceName}] ${i.title}\n  ${(i.text || '').slice(0, 1400)}`).join('\n');
    return `### TEMA ${t.id}\n${izvori}`;
  }).join('\n\n');
  return `Ti si urednik teleteksta. Za svaku temu napiši na hrvatskom jeziku:
- naslov: kratak, informativan naslov, najviše 55 znakova, bez navodnika, uskličnika i senzacionalizma
- sazetak: neutralan sažetak od 5 do 6 kratkih rečenica (ukupno najviše 650 znakova), vlastitim riječima,
  samo s činjenicama iz priloženih tekstova, bez nagađanja, bez pozivanja na "članak" ili "portal"
- rubrika: jedna od: ${SECTIONS.map(s => s.key).join(', ')}

Vrati JSON niz s poljima id, naslov, sazetak, rubrika, po jedan objekt za svaku temu.

${teme}`;
}

async function call(batch, { apiKey, model }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
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
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      console.warn(`Gemini ${res.status}, ponovni pokušaj za 30 s`);
      await sleep(30000);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    return JSON.parse(text);
  }
  throw new Error('Gemini nije odgovorio nakon 3 pokušaja');
}

/** pending: [{ id, items: [{ sourceName, title, text }] }] → { id: { naslov, sazetak, rubrika } } */
export async function summarize(pending, opts) {
  const out = {};
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    try {
      for (const r of await call(batch, opts)) if (r?.id) out[r.id] = r;
    } catch (e) {
      console.error(`Sažeci ${i + 1}-${i + batch.length} nisu uspjeli: ${e.message}`);
    }
    if (i + BATCH < pending.length) await sleep(PAUSE_MS);
  }
  return out;
}
