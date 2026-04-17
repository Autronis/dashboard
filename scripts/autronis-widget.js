// Autronis Dashboard Widget — Scriptable (iOS)
// Toont: tijd, agenda vandaag, open taken
//
// Setup:
// 1. Installeer "Scriptable" uit de App Store
// 2. Maak een nieuw script, plak dit erin
// 3. Vul API_KEY hieronder in (SESSION_SECRET of INTERNAL_API_KEY)
// 4. Voeg Scriptable widget toe aan homescreen → kies dit script
// 5. Widget size: medium (aanbevolen) of large

const API_KEY = "autronis-dashboard-2026-geheim-minimaal-32-tekens!!";
const BASE_URL = "https://dashboard.autronis.nl";

// ─── Kleuren (Autronis dark theme) ───
const BG = new Color("#0E1719");
const CARD = new Color("#192225");
const ACCENT = new Color("#17B8A5");
const TEXT = new Color("#E8ECED");
const MUTED = new Color("#8A9599");
const HOOG = new Color("#F87171");
const NORMAAL = new Color("#FBBF24");

// ─── Data ophalen ───
async function fetchData() {
  const req = new Request(`${BASE_URL}/api/widget`);
  req.headers = { Authorization: `Bearer ${API_KEY}` };
  req.timeoutInterval = 10;
  try {
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

// ─── Tijd formatteren ───
function formatTijd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
}

// ─── Widget bouwen ───
async function buildWidget() {
  const data = await fetchData();
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(12, 14, 12, 14);
  w.url = `${BASE_URL}/agenda`;

  if (!data || data.fout) {
    const err = w.addText(data?.fout || "Geen verbinding");
    err.textColor = HOOG;
    err.font = Font.mediumSystemFont(13);
    return w;
  }

  // ── Header: tijd + datum ──
  const header = w.addStack();
  header.centerAlignContent();

  const tijdTxt = header.addText(data.tijd);
  tijdTxt.textColor = ACCENT;
  tijdTxt.font = Font.boldMonospacedSystemFont(22);

  header.addSpacer();

  const dagNamen = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const now = new Date();
  const dagNaam = dagNamen[now.getDay()];
  const datumTxt = header.addText(`${dagNaam} ${now.getDate()}/${now.getMonth() + 1}`);
  datumTxt.textColor = MUTED;
  datumTxt.font = Font.mediumSystemFont(13);

  w.addSpacer(8);

  // ── Agenda vandaag ──
  const agendaHeader = w.addStack();
  const ah = agendaHeader.addText("AGENDA");
  ah.textColor = ACCENT;
  ah.font = Font.boldSystemFont(10);
  agendaHeader.addSpacer();
  const ac = agendaHeader.addText(`${data.agenda.length}`);
  ac.textColor = MUTED;
  ac.font = Font.boldSystemFont(10);

  w.addSpacer(4);

  if (data.agenda.length === 0) {
    const leeg = w.addText("Geen items vandaag");
    leeg.textColor = MUTED;
    leeg.font = Font.italicSystemFont(11);
  } else {
    const max = config.widgetFamily === "large" ? 5 : 3;
    for (const item of data.agenda.slice(0, max)) {
      const row = w.addStack();
      row.centerAlignContent();
      row.spacing = 6;

      if (!item.heleDag) {
        const tijd = row.addText(formatTijd(item.startDatum));
        tijd.textColor = ACCENT;
        tijd.font = Font.monospacedSystemFont(11);
        tijd.lineLimit = 1;
      } else {
        const dag = row.addText("hele dag");
        dag.textColor = MUTED;
        dag.font = Font.monospacedSystemFont(11);
      }

      const titel = row.addText(item.titel || "—");
      titel.textColor = TEXT;
      titel.font = Font.mediumSystemFont(12);
      titel.lineLimit = 1;

      w.addSpacer(2);
    }
    if (data.agenda.length > max) {
      const meer = w.addText(`+${data.agenda.length - max} meer`);
      meer.textColor = MUTED;
      meer.font = Font.italicSystemFont(10);
    }
  }

  w.addSpacer(8);

  // ── Open taken ──
  const takenHeader = w.addStack();
  const th = takenHeader.addText("TAKEN");
  th.textColor = ACCENT;
  th.font = Font.boldSystemFont(10);
  takenHeader.addSpacer();
  const tc = takenHeader.addText(`${data.taken.length}`);
  tc.textColor = MUTED;
  tc.font = Font.boldSystemFont(10);

  w.addSpacer(4);

  if (data.taken.length === 0) {
    const leeg = w.addText("Geen open taken");
    leeg.textColor = MUTED;
    leeg.font = Font.italicSystemFont(11);
  } else {
    const max = config.widgetFamily === "large" ? 5 : 3;
    for (const taak of data.taken.slice(0, max)) {
      const row = w.addStack();
      row.centerAlignContent();
      row.spacing = 6;

      // Prioriteit dot
      const dot = row.addText("●");
      dot.font = Font.boldSystemFont(8);
      dot.textColor = taak.prioriteit === "hoog" ? HOOG : taak.prioriteit === "normaal" ? NORMAAL : MUTED;

      const titel = row.addText(taak.titel || "—");
      titel.textColor = TEXT;
      titel.font = Font.mediumSystemFont(12);
      titel.lineLimit = 1;

      if (taak.projectNaam) {
        row.addSpacer();
        const proj = row.addText(taak.projectNaam);
        proj.textColor = MUTED;
        proj.font = Font.mediumSystemFont(9);
        proj.lineLimit = 1;
      }

      w.addSpacer(2);
    }
    if (data.taken.length > max) {
      const meer = w.addText(`+${data.taken.length - max} meer`);
      meer.textColor = MUTED;
      meer.font = Font.italicSystemFont(10);
    }
  }

  w.addSpacer();

  // ── Footer ──
  const footer = w.addStack();
  footer.centerAlignContent();
  const updated = footer.addText(`Bijgewerkt ${data.tijd}`);
  updated.textColor = new Color("#4A5558");
  updated.font = Font.mediumSystemFont(9);

  return w;
}

// ─── Run ───
const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
