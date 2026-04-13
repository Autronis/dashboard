import { NextResponse } from "next/server";

// GET: API Documentation (public, no auth)
export async function GET(): Promise<NextResponse> {
  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autronis API Documentatie</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0E1719; color: #E8ECED; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { color: #17B8A5; font-size: 2rem; margin-bottom: 0.5rem; }
    h2 { color: #17B8A5; font-size: 1.4rem; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 1px solid #2A3538; padding-bottom: 0.5rem; }
    h3 { font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #8A9BA0; margin-bottom: 0.8rem; line-height: 1.6; }
    code { background: #192225; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; color: #4DC9B4; }
    pre { background: #192225; padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1rem; border: 1px solid #2A3538; }
    pre code { background: none; padding: 0; }
    .method { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8em; margin-right: 8px; }
    .get { background: #22c55e20; color: #22c55e; }
    .post { background: #3b82f620; color: #3b82f6; }
    .put { background: #f59e0b20; color: #f59e0b; }
    .delete { background: #ef444420; color: #ef4444; }
    .endpoint { background: #192225; padding: 0.8rem 1rem; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid #2A3538; }
    .endpoint code { color: #E8ECED; }
    .subtitle { color: #8A9BA0; font-size: 1rem; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>Autronis API</h1>
  <p class="subtitle">REST API documentatie voor het Autronis Dashboard</p>

  <h2>Authenticatie</h2>
  <p>Gebruik een API key in de <code>Authorization</code> header:</p>
  <pre><code>Authorization: Bearer aut_jouw_api_key_hier</code></pre>
  <p>API keys kunnen aangemaakt worden via Instellingen → Integraties → API Keys.</p>

  <h2>Klanten</h2>
  <div class="endpoint"><span class="method get">GET</span><code>/api/klanten</code> — Lijst van alle klanten</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/klanten</code> — Nieuwe klant aanmaken</div>
  <div class="endpoint"><span class="method get">GET</span><code>/api/klanten/:id</code> — Klant details</div>
  <div class="endpoint"><span class="method put">PUT</span><code>/api/klanten/:id</code> — Klant bijwerken</div>
  <div class="endpoint"><span class="method delete">DELETE</span><code>/api/klanten/:id</code> — Klant archiveren</div>

  <h2>Projecten</h2>
  <div class="endpoint"><span class="method get">GET</span><code>/api/projecten</code> — Lijst van alle projecten</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/projecten</code> — Nieuw project aanmaken</div>

  <h2>Facturen</h2>
  <div class="endpoint"><span class="method get">GET</span><code>/api/facturen</code> — Lijst van facturen (filter: ?status=, ?zoek=)</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/facturen</code> — Nieuwe factuur aanmaken</div>
  <div class="endpoint"><span class="method get">GET</span><code>/api/facturen/:id</code> — Factuur details</div>
  <div class="endpoint"><span class="method put">PUT</span><code>/api/facturen/:id</code> — Factuur bijwerken</div>
  <div class="endpoint"><span class="method get">GET</span><code>/api/facturen/:id/pdf</code> — Download PDF</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/facturen/:id/verstuur</code> — Verstuur per email</div>
  <div class="endpoint"><span class="method put">PUT</span><code>/api/facturen/:id/betaald</code> — Markeer als betaald</div>

  <h2>Offertes</h2>
  <div class="endpoint"><span class="method get">GET</span><code>/api/offertes</code> — Lijst van offertes</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/offertes</code> — Nieuwe offerte</div>
  <div class="endpoint"><span class="method get">GET</span><code>/api/offertes/:id</code> — Offerte details</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/offertes/:id/converteer</code> — Converteer naar factuur</div>

  <h2>Tijdregistraties</h2>
  <div class="endpoint"><span class="method get">GET</span><code>/api/tijdregistraties</code> — Lijst van registraties</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/tijdregistraties</code> — Nieuwe registratie</div>
  <div class="endpoint"><span class="method get">GET</span><code>/api/tijdregistraties/export</code> — Export als CSV</div>

  <h2>Taken</h2>
  <div class="endpoint"><span class="method get">GET</span><code>/api/taken</code> — Lijst van taken</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/taken</code> — Nieuwe taak</div>
  <div class="endpoint"><span class="method put">PUT</span><code>/api/taken/:id</code> — Taak bijwerken</div>

  <h2>Leads</h2>
  <div class="endpoint"><span class="method get">GET</span><code>/api/klant-leads</code> — Pipeline overzicht</div>
  <div class="endpoint"><span class="method post">POST</span><code>/api/klant-leads</code> — Nieuwe lead</div>
  <div class="endpoint"><span class="method put">PUT</span><code>/api/klant-leads/:id</code> — Lead bijwerken</div>

  <h2>Webhooks</h2>
  <p>Ondersteunde events: <code>factuur.aangemaakt</code>, <code>factuur.betaald</code>, <code>lead.gewonnen</code>, <code>project.afgerond</code>, <code>proposal.ondertekend</code>, <code>offerte.geaccepteerd</code></p>
  <p>Elke webhook bevat een <code>X-Webhook-Signature</code> header (HMAC-SHA256).</p>

  <h2>Foutafhandeling</h2>
  <p>Alle fouten worden geretourneerd als JSON:</p>
  <pre><code>{ "fout": "Beschrijving van de fout" }</code></pre>

  <p style="margin-top: 3rem; color: #8A9BA0; font-size: 0.85rem;">Autronis Dashboard API v1.0 — Gegenereerd op ${new Date().toLocaleDateString("nl-NL")}</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
