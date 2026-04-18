# Upwork Proposal Engine — Setup

## 1. Gmail / Workspace

1. Maak twee mailboxes in Google Workspace:
   - `upworksem@autronis.com`
   - `upworksyb@autronis.com`
2. Per inbox: voeg een filter toe:
   - Criteria: `from:(no-reply@upwork.com) OR from:(mailer@upwork.com)`
   - Actie: `Apply label: upwork-alert`, `Never send to spam`, `Mark as important`
3. Verifieer IMAP-toegang (Settings → Forwarding and POP/IMAP → IMAP Enable).

## 2. Upwork accounts

Voor zowel Sem als Syb:
1. Registreer account op `upworksem@` resp `upworksyb@`.
2. Profile polish:
   - Title: "AI & Automation Engineer — n8n, Claude, Next.js, Supabase"
   - Hourly rate: start met iets onder €95 (bv $60) voor eerste reviews, verhoog na 5 reviews
   - Skills: `n8n`, `Claude`, `OpenAI`, `LLM`, `Next.js`, `Supabase`, `TypeScript`, `React`, `Automation`, `Web Scraping`, `Data Pipeline`, `AI Agent`
   - Portfolio: 3 Autronis cases uit case-study-generator
   - Intro video (optioneel maar helpt win-rate)

## 3. Saved searches

Voeg per account 10 saved searches toe. Voor elke: zet "Email alerts: Instantly" aan.

| Naam | Query |
|---|---|
| `n8n automation` | `n8n` |
| `Workflow automation` | `workflow automation` |
| `AI agent` | `ai agent` |
| `Claude integration` | `claude` |
| `LLM integration` | `LLM integration` |
| `Next.js full stack` | `next.js full stack` |
| `Supabase backend` | `supabase` |
| `Chatbot for SMB` | `chatbot small business` |
| `AI web scraping` | `ai web scraping` |
| `Data pipeline` | `data pipeline automation` |

Tip: filter per search op `Experience level: Intermediate / Expert` en stel voorkeuren in voor klant-locatie op basis van budget-signaal (geen discriminatie — correlatie met project-budget).

## 4. Session cookies

Na eerste login via de website:
```bash
UPWORK_COOKIE_SECRET=$(openssl rand -base64 32) npm run upwork:login -- sem
UPWORK_COOKIE_SECRET=<dezelfde key> npm run upwork:login -- syb
```
De gegenereerde `UPWORK_COOKIE_SECRET` MOET je bewaren — zelfde key wordt gebruikt om later te decrypten bij deep-fetch. Zet 'm in `.env.local` én Vercel env vars. Herhaal de login zodra je een Discord alert "session expired" krijgt (~1x per maand).

## 5. Env vars

In `.env.local` en Vercel production:
```
UPWORK_COOKIE_SECRET=<base64-32-bytes>
UPWORK_INGEST_API_KEY=<random 32 chars>
```

Genereer `UPWORK_INGEST_API_KEY`:
```bash
openssl rand -hex 16
```

## 6. n8n workflow

Import `docs/upwork-n8n-workflow.json` in jouw n8n instance. Bewerk de Gmail-account credentials (2 stuks: upworksem + upworksyb) en de environment variables:
- `DASHBOARD_URL` = `https://dashboard.autronis.nl`
- `UPWORK_INGEST_API_KEY` = zelfde value als in `.env.local`

Activeer de workflow. De Gmail trigger pollt elke minuut.

## 7. Verificatie

Na 24u:
- Open `/upwork` in het dashboard
- Verifieer dat er >5 jobs zijn binnengekomen
- Check dat de `seenBy` variabele klopt (als Sem en Syb dezelfde queries hebben, zouden de meeste jobs `["sem","syb"]` moeten zijn)
- Check `sqlite3 data/autronis.db "SELECT parse_error, COUNT(*) FROM upwork_email_raw GROUP BY parse_error"` — >95% zou NULL (geen error) moeten zijn

## 8. Troubleshooting

**Geen jobs in dashboard na 24u:**
- Gmail filter label `upwork-alert` correct toegepast? Check Gmail UI → Labels.
- n8n workflow actief? Check n8n "Executions" tab.
- Is de Bearer token correct geconfigureerd in de n8n HTTP node?

**Session expired alerts gaan te vaak af:**
- Upwork detecteert mogelijk bot-achtige fetches. Deep-fetch throttle is 1 per 15s per account; verhoog indien nodig in `src/lib/upwork/deep-fetch.ts`.
- Check of je Chrome up-to-date is (oude Chrome user-agents triggeren bot-detection sneller).

**Parse errors hoog:**
- Upwork heeft mogelijk z'n email template gewijzigd. Check `sqlite3 data/autronis.db "SELECT * FROM upwork_email_raw WHERE parse_error IS NOT NULL LIMIT 5"`, exporteer body_html, update fixtures en parser regex in `src/lib/upwork/email-parser.ts`.
