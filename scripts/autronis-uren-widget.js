// Autronis Uren Widget — Scriptable (iOS)
// Toont: totaal uren deze week, bar chart per dag, top klanten

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
const EMERALD = new Color("#34D399");

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

// Format minuten → "5u 23m" of "23m"
function formatDuur(min) {
  if (min < 60) return `${min}m`;
  const u = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${u}u`;
  return `${u}u ${m}m`;
}

// Format minuten → uur-decimaal zoals "4.2"
function formatUurDecimaal(min) {
  return (min / 60).toFixed(1).replace(".", ",");
}

// ─── Bar chart per dag ───
function makeBarChart(perDag, width, height) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const maxMin = Math.max(...perDag.map((p) => p.minuten), 60);
  const barWidth = (width - 6 * 6) / 7; // 7 bars met 6px gap
  const chartHeight = height - 18; // ruimte voor label onder
  const dagLabels = ["M", "D", "W", "D", "V", "Z", "Z"];

  for (let i = 0; i < 7; i++) {
    const p = perDag[i];
    const x = i * (barWidth + 6);
    const barHeight = Math.max(2, (p.minuten / maxMin) * chartHeight);
    const y = chartHeight - barHeight;

    // Bar
    const isVandaag = p.datum === perDag.find((_, idx) => idx === i)?.datum &&
      p.datum === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });

    ctx.setFillColor(p.minuten > 0 ? (isVandaag ? ACCENT : ACCENT_DIM) : BORDER);
    const rect = new Path();
    rect.addRoundedRect(new Rect(x, y, barWidth, barHeight), 2, 2);
    ctx.addPath(rect);
    ctx.fillPath();

    // Dag label
    ctx.setTextColor(isVandaag ? ACCENT : MUTED);
    ctx.setFont(Font.boldSystemFont(9));
    ctx.drawTextInRect(
      dagLabels[i],
      new Rect(x, chartHeight + 3, barWidth, 12)
    );
  }

  return ctx.getImage();
}

async function buildWidget() {
  const data = await fetchData();
  const w = new ListWidget();

  const gradient = new LinearGradient();
  gradient.colors = [BG_TOP, BG_BOT];
  gradient.locations = [0, 1];
  gradient.startPoint = new Point(0, 0);
  gradient.endPoint = new Point(1, 1);
  w.backgroundGradient = gradient;

  w.setPadding(14, 16, 12, 16);
  w.url = `${BASE_URL}/tijd`;

  if (!data || data.fout) {
    const err = w.addText(data?.fout || "Geen verbinding");
    err.textColor = new Color("#F87171");
    err.font = Font.mediumSystemFont(13);
    return w;
  }

  const uren = data.uren;
  const totaalMin = uren.totaalMinuten;

  // ── Header ──
  const header = w.addStack();
  header.centerAlignContent();

  const hoofdTxt = header.addText(formatUurDecimaal(totaalMin));
  hoofdTxt.textColor = ACCENT;
  hoofdTxt.font = Font.boldMonospacedSystemFont(32);
  hoofdTxt.shadowColor = new Color("#17B8A5", 0.35);
  hoofdTxt.shadowRadius = 8;

  const uSuffix = header.addText(" uur");
  uSuffix.textColor = TEXT_DIM;
  uSuffix.font = Font.mediumSystemFont(14);

  header.addSpacer();

  const rightCol = header.addStack();
  rightCol.layoutVertically();

  const labelTxt = rightCol.addText("DEZE WEEK");
  labelTxt.textColor = TEXT_DIM;
  labelTxt.font = Font.boldSystemFont(10);
  labelTxt.rightAlignText();

  const brandRow = rightCol.addText("AUTRONIS");
  brandRow.textColor = ACCENT_DIM;
  brandRow.font = Font.boldSystemFont(8);
  brandRow.rightAlignText();

  w.addSpacer(10);

  // ── Bar chart ──
  const chartImg = makeBarChart(uren.perDag, 300, 60);
  const chart = w.addImage(chartImg);
  chart.imageSize = new Size(300, 60);

  w.addSpacer(10);

  // ── Top klanten ──
  if (uren.perKlant && uren.perKlant.length > 0) {
    const sectionHeader = w.addStack();
    sectionHeader.centerAlignContent();
    sectionHeader.spacing = 6;

    const bar = sectionHeader.addStack();
    bar.size = new Size(3, 11);
    bar.backgroundColor = ACCENT;
    bar.cornerRadius = 2;

    const title = sectionHeader.addText("TOP KLANTEN");
    title.textColor = ACCENT;
    title.font = Font.boldSystemFont(10);

    w.addSpacer(6);

    const max = config.widgetFamily === "large" ? 5 : 3;
    for (const k of uren.perKlant.slice(0, max)) {
      const row = w.addStack();
      row.centerAlignContent();
      row.spacing = 8;

      // Percentage bar
      const pct = totaalMin > 0 ? k.minuten / totaalMin : 0;
      const barContainer = row.addStack();
      barContainer.size = new Size(50, 4);
      barContainer.backgroundColor = BORDER;
      barContainer.cornerRadius = 2;

      const barFill = barContainer.addStack();
      barFill.size = new Size(Math.max(2, 50 * pct), 4);
      barFill.backgroundColor = ACCENT;
      barFill.cornerRadius = 2;

      const naam = row.addText(k.naam);
      naam.textColor = TEXT;
      naam.font = Font.mediumSystemFont(12);
      naam.lineLimit = 1;

      row.addSpacer();

      const tijd = row.addText(formatDuur(k.minuten));
      tijd.textColor = EMERALD;
      tijd.font = Font.boldMonospacedSystemFont(11);

      w.addSpacer(4);
    }
  } else {
    const leeg = w.addText("Geen uren deze week");
    leeg.textColor = MUTED;
    leeg.font = Font.italicSystemFont(11);
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

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
