// Autronis Dashboard Widget — Scriptable (iOS)
// Premium dark theme met accent glow

const API_KEY = "autronis-dashboard-2026-geheim-minimaal-32-tekens!!";
const BASE_URL = "https://dashboard.autronis.nl";

// ─── Autronis palette ───
const BG_TOP = new Color("#14222A");
const BG_BOT = new Color("#0B1315");
const BORDER = new Color("#2A3538");
const ACCENT = new Color("#17B8A5");
const ACCENT_DIM = new Color("#0F7A6E");
const TEXT = new Color("#E8ECED");
const TEXT_DIM = new Color("#B5C0C4");
const MUTED = new Color("#6A7A7E");
const HOOG = new Color("#F87171");
const NORMAAL = new Color("#FBBF24");
const LAAG = new Color("#4A5558");

// ─── Data ───
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

function formatTijd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
}

// Strip prefixes zoals "Quick Capture: " voor cleaner display
function cleanTitel(titel) {
  if (!titel) return "—";
  return titel.replace(/^Quick Capture:\s*/i, "").trim();
}

// ─── Priority indicator als gekleurd vierkantje ───
function priorityColor(p) {
  if (p === "hoog") return HOOG;
  if (p === "normaal") return NORMAAL;
  return LAAG;
}

// ─── Accent divider lijn (via DrawContext) ───
function makeDivider(width) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, 1);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setFillColor(ACCENT_DIM);
  ctx.fillRect(new Rect(0, 0, width * 0.35, 1));
  ctx.setFillColor(BORDER);
  ctx.fillRect(new Rect(width * 0.35, 0, width * 0.65, 1));
  return ctx.getImage();
}

// ─── Section header met accent bar ───
function addSectionHeader(widget, label, count) {
  const row = widget.addStack();
  row.centerAlignContent();
  row.spacing = 6;

  const bar = row.addStack();
  bar.size = new Size(3, 12);
  bar.backgroundColor = ACCENT;
  bar.cornerRadius = 2;

  const title = row.addText(label);
  title.textColor = ACCENT;
  title.font = Font.boldSystemFont(10);

  row.addSpacer();

  const badge = row.addStack();
  badge.cornerRadius = 6;
  badge.backgroundColor = new Color("#17B8A5", 0.15);
  badge.setPadding(1, 7, 1, 7);
  const c = badge.addText(`${count}`);
  c.textColor = ACCENT;
  c.font = Font.boldMonospacedSystemFont(10);
}

// ─── Widget ───
async function buildWidget() {
  const data = await fetchData();
  const w = new ListWidget();

  // Gradient background
  const gradient = new LinearGradient();
  gradient.colors = [BG_TOP, BG_BOT];
  gradient.locations = [0, 1];
  gradient.startPoint = new Point(0, 0);
  gradient.endPoint = new Point(1, 1);
  w.backgroundGradient = gradient;

  w.setPadding(14, 16, 12, 16);
  w.url = `${BASE_URL}/agenda`;

  if (!data || data.fout) {
    const err = w.addText(data?.fout || "Geen verbinding");
    err.textColor = HOOG;
    err.font = Font.mediumSystemFont(13);
    return w;
  }

  // ── Header row: tijd + datum + Autronis mark ──
  const header = w.addStack();
  header.centerAlignContent();

  const tijdTxt = header.addText(data.tijd);
  tijdTxt.textColor = ACCENT;
  tijdTxt.font = Font.boldMonospacedSystemFont(28);
  tijdTxt.shadowColor = new Color("#17B8A5", 0.35);
  tijdTxt.shadowRadius = 8;

  header.addSpacer();

  const rightCol = header.addStack();
  rightCol.layoutVertically();

  const dagNamen = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const maandNamen = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const now = new Date();

  const dagRow = rightCol.addText(`${dagNamen[now.getDay()]} ${now.getDate()} ${maandNamen[now.getMonth()]}`);
  dagRow.textColor = TEXT_DIM;
  dagRow.font = Font.mediumSystemFont(13);
  dagRow.rightAlignText();

  const brandRow = rightCol.addText("AUTRONIS");
  brandRow.textColor = ACCENT_DIM;
  brandRow.font = Font.boldSystemFont(8);
  brandRow.rightAlignText();

  w.addSpacer(10);

  // Accent divider
  const familyWidth = config.widgetFamily === "large" ? 340 : 320;
  const div = w.addImage(makeDivider(familyWidth));
  div.imageSize = new Size(familyWidth, 1);
  div.resizable = false;

  w.addSpacer(10);

  // ── AGENDA sectie ──
  addSectionHeader(w, "AGENDA", data.agenda.length);
  w.addSpacer(6);

  if (data.agenda.length === 0) {
    const leeg = w.addText("Geen items vandaag");
    leeg.textColor = MUTED;
    leeg.font = Font.italicSystemFont(11);
  } else {
    const max = config.widgetFamily === "large" ? 5 : 2;
    for (const item of data.agenda.slice(0, max)) {
      const row = w.addStack();
      row.centerAlignContent();
      row.spacing = 8;

      // Tijd chip
      const tijdChip = row.addStack();
      tijdChip.cornerRadius = 4;
      tijdChip.backgroundColor = new Color("#17B8A5", 0.12);
      tijdChip.setPadding(2, 6, 2, 6);
      const tijdTxt2 = tijdChip.addText(item.heleDag ? "allday" : formatTijd(item.startDatum));
      tijdTxt2.textColor = ACCENT;
      tijdTxt2.font = Font.boldMonospacedSystemFont(10);

      const titel = row.addText(cleanTitel(item.titel));
      titel.textColor = TEXT;
      titel.font = Font.mediumSystemFont(12);
      titel.lineLimit = 1;

      w.addSpacer(4);
    }
    if (data.agenda.length > max) {
      const meer = w.addText(`+${data.agenda.length - max} meer`);
      meer.textColor = MUTED;
      meer.font = Font.italicSystemFont(10);
    }
  }

  w.addSpacer(10);

  // ── TAKEN sectie ──
  addSectionHeader(w, "TAKEN", data.taken.length);
  w.addSpacer(6);

  if (data.taken.length === 0) {
    const leeg = w.addText("Geen open taken");
    leeg.textColor = MUTED;
    leeg.font = Font.italicSystemFont(11);
  } else {
    const max = config.widgetFamily === "large" ? 6 : 3;
    for (const taak of data.taken.slice(0, max)) {
      const row = w.addStack();
      row.centerAlignContent();
      row.spacing = 8;

      // Priority square
      const sq = row.addStack();
      sq.size = new Size(6, 6);
      sq.backgroundColor = priorityColor(taak.prioriteit);
      sq.cornerRadius = 1.5;

      const titel = row.addText(cleanTitel(taak.titel));
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

      w.addSpacer(4);
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

  const dot = footer.addStack();
  dot.size = new Size(4, 4);
  dot.backgroundColor = ACCENT;
  dot.cornerRadius = 2;

  footer.addSpacer(4);

  const updated = footer.addText(`Live · ${data.tijd}`);
  updated.textColor = MUTED;
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
