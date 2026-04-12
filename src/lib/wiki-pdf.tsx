import React from "react";
import path from "path";
import fs from "fs";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

let _logoSrc: string | null = null;
function getLogoSrc(): string {
  if (!_logoSrc) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
      _logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
    } catch { _logoSrc = ""; }
  }
  return _logoSrc;
}

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "Inter-400.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-600.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Inter-700.ttf"), fontWeight: 700 },
  ],
});

const TEAL = "#17B8A5";
const DARK_BG = "#0E1719";
const TEXT_PRIMARY = "#E8ECED";
const TEXT_SECONDARY = "#8A9BA0";

const s = StyleSheet.create({
  // ===== COVER PAGE =====
  coverPage: {
    fontFamily: "Inter",
    backgroundColor: DARK_BG,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  coverLogo: { width: 80, height: 40, marginBottom: 40 },
  coverLabel: { fontSize: 9, fontWeight: 600, color: TEAL, letterSpacing: 4, textTransform: "uppercase", marginBottom: 20 },
  coverTitle: { fontSize: 32, fontWeight: 700, color: TEXT_PRIMARY, textAlign: "center", lineHeight: 1.3, marginBottom: 16, maxWidth: 400 },
  coverLine: { width: 60, height: 3, backgroundColor: TEAL, borderRadius: 2, marginVertical: 24 },
  coverMeta: { fontSize: 10, color: TEXT_SECONDARY, textAlign: "center", lineHeight: 1.6 },
  coverCategorie: { fontSize: 8, fontWeight: 600, color: TEAL, letterSpacing: 2, textTransform: "uppercase", marginTop: 30, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: TEAL, borderRadius: 4 },
  coverFooter: { position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", fontSize: 8, color: TEXT_SECONDARY },
  // ===== CONTENT PAGES =====
  contentPage: { fontFamily: "Inter", fontSize: 10, color: "#1F2937", backgroundColor: "#FFFFFF", paddingTop: 70, paddingBottom: 80, paddingHorizontal: 55 },
  // ===== PAGE HEADER =====
  pageHeader: { position: "absolute", top: 0, left: 55, right: 55, paddingTop: 25, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: TEAL },
  pageHeaderLogo: { width: 36, height: 18 },
  pageHeaderBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  pageHeaderBrandText: { fontSize: 9, fontWeight: 600, color: TEAL, letterSpacing: 1 },
  pageHeaderRight: { fontSize: 8, color: "#9CA3AF" },
  // ===== TEXT CONTENT =====
  h1: { fontSize: 18, fontWeight: 700, color: "#111827", marginTop: 24, marginBottom: 10 },
  h2: { fontSize: 14, fontWeight: 700, color: DARK_BG, marginTop: 22, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: TEAL },
  h3: { fontSize: 11, fontWeight: 600, color: "#374151", marginTop: 14, marginBottom: 6 },
  paragraph: { fontSize: 9.5, lineHeight: 1.7, color: "#374151", marginBottom: 6 },
  bold: { fontWeight: 700 },
  italic: { fontStyle: "italic" },
  link: { color: TEAL },
  inlineCode: { fontFamily: "Courier", fontSize: 8.5, backgroundColor: "#F0FAF8", color: "#0F766E", paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 },
  listItem: { fontSize: 9.5, lineHeight: 1.7, color: "#374151", marginBottom: 3, paddingLeft: 14 },
  codeBlock: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 6, padding: 12, marginVertical: 8 },
  codeText: { fontFamily: "Courier", fontSize: 8, color: "#1F2937", lineHeight: 1.6 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: TEAL, paddingLeft: 12, marginVertical: 8 },
  blockquoteText: { fontSize: 9.5, fontStyle: "italic", color: "#6B7280", lineHeight: 1.7 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#E5E7EB", marginVertical: 16 },
  // ===== ARCHITECTURE DIAGRAM =====
  archDiagram: { marginVertical: 12, alignItems: "center" },
  archLayer: { width: "100%", marginVertical: 4 },
  archLabel: { fontSize: 7, fontWeight: 600, color: TEAL, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  archBoxRow: { flexDirection: "row", gap: 6 },
  archBoxCore: { flex: 1, backgroundColor: "#F0FAF8", borderWidth: 1, borderColor: TEAL, borderRadius: 6, padding: 10, alignItems: "center" },
  archBoxInfra: { flex: 1, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 6, padding: 10, alignItems: "center" },
  archBoxYou: { backgroundColor: DARK_BG, borderRadius: 6, padding: 12, alignItems: "center" },
  archBoxTitle: { fontSize: 9, fontWeight: 700, color: "#111827", marginBottom: 2 },
  archBoxSub: { fontSize: 7, color: "#6B7280" },
  archArrow: { fontSize: 14, color: TEAL, textAlign: "center", marginVertical: 2 },
  // ===== HOW CARDS =====
  howGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 },
  // Vaste breedte ipv percentage — react-pdf handelt % in flex-wrap niet altijd correct
  howCard: { width: 230, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderLeftWidth: 3, borderLeftColor: TEAL, borderRadius: 8, padding: 12, marginBottom: 8 },
  howNumber: { fontSize: 20, fontWeight: 700, color: TEAL, marginBottom: 4 },
  howTitle: { fontSize: 10, fontWeight: 700, color: "#111827", marginBottom: 6 },
  howText: { fontSize: 8.5, lineHeight: 1.6, color: "#4B5563" },
  // ===== WORKFLOW =====
  workflowContainer: { marginVertical: 10 },
  wfStep: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  wfTime: { width: 60, fontSize: 8, fontWeight: 600, color: TEAL, textTransform: "uppercase", paddingTop: 2 },
  wfContent: { flex: 1, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderLeftWidth: 2, borderLeftColor: TEAL, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  wfText: { fontSize: 9, color: "#374151" },
  wfCode: { fontFamily: "Courier", fontSize: 8.5, backgroundColor: "#F0FAF8", color: "#0F766E", paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 },
  wfConnector: { width: 1, height: 8, backgroundColor: "#D1D5DB", marginLeft: 30 },
  // ===== STATS =====
  statsRow: { flexDirection: "row", gap: 8, marginVertical: 10 },
  statBox: { flex: 1, backgroundColor: DARK_BG, borderRadius: 8, padding: 12, alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: 700, color: TEAL, marginBottom: 2 },
  statLabel: { fontSize: 7, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: 0.5 },
  // ===== SKILL CARDS =====
  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  // Vaste breedte ipv percentage — react-pdf handelt % in flex-wrap niet altijd correct
  skillCard: { width: 230, borderWidth: 1, borderColor: "#E5E7EB", borderLeftWidth: 3, borderLeftColor: TEAL, borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: "#FAFEFE" },
  skillCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  skillCardName: { fontSize: 10, fontWeight: 700, color: "#111827" },
  skillCardCmd: { fontSize: 8, fontFamily: "Courier", color: TEAL, backgroundColor: "#E8F8F6", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: "#B2E8E2" },
  skillCardDesc: { fontSize: 8, lineHeight: 1.5, color: "#4B5563", marginBottom: 6 },
  skillCardTags: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  tag: { fontSize: 6, fontWeight: 600, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.3 },
  tagAgent: { backgroundColor: "#EDE9FE", color: "#7C3AED" },
  tagDev: { backgroundColor: "#DBEAFE", color: "#2563EB" },
  tagOps: { backgroundColor: "#D1FAE5", color: "#059669" },
  tagClient: { backgroundColor: "#FEF3C7", color: "#D97706" },
  tagContent: { backgroundColor: "#FCE7F3", color: "#DB2777" },
  tagResearch: { backgroundColor: "#E0E7FF", color: "#4F46E5" },
  tagFinance: { backgroundColor: "#CCFBF1", color: "#0F766E" },
  tagSyb: { backgroundColor: "#F3F4F6", color: "#6B7280" },
  tagDefault: { backgroundColor: "#F3F4F6", color: "#374151" },
  // ===== LEGEND =====
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#F9FAFB", borderRadius: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 7, color: "#6B7280" },
  // ===== TABLE =====
  table: { marginVertical: 8 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: DARK_BG, borderRadius: 3 },
  tableHeaderCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  tableHeaderText: { fontSize: 7, fontWeight: 600, color: TEXT_PRIMARY, textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tableCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 10 },
  tableCellText: { fontSize: 9, color: "#374151", lineHeight: 1.5 },
  tableRowAlt: { backgroundColor: "#F9FAFB" },
  // ===== FOOTER =====
  footer: { position: "absolute", bottom: 0, left: 55, right: 55, borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 7, color: "#9CA3AF" },
  footerPage: { fontSize: 7, color: "#9CA3AF" },
});

// ===== HTML HELPERS =====

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8595;/g, "\u2193")
    .replace(/&#\d+;/g, "")
    .replace(/&\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Converteert HTML-inline-code (<code>) naar backtick notatie zodat renderInlineText het kan stijlen
function stripHtmlPreserveCode(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner) => `\`${stripHtml(inner)}\``)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_m, inner) => `**${stripHtml(inner)}**`)
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_m, inner) => `**${stripHtml(inner)}**`)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8595;/g, "\u2193")
    .replace(/&#\d+;/g, "")
    .replace(/&\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagColorStyle(tagClass: string) {
  if (tagClass.includes("tag-agent")) return s.tagAgent;
  if (tagClass.includes("tag-dev")) return s.tagDev;
  if (tagClass.includes("tag-ops")) return s.tagOps;
  if (tagClass.includes("tag-client")) return s.tagClient;
  if (tagClass.includes("tag-content")) return s.tagContent;
  if (tagClass.includes("tag-research")) return s.tagResearch;
  if (tagClass.includes("tag-finance")) return s.tagFinance;
  if (tagClass.includes("tag-syb")) return s.tagSyb;
  return s.tagDefault;
}

// ===== STRUCTURED HTML PARSER =====
// Parses Autronis wiki HTML into structured blocks for PDF rendering

interface ArchBox { title: string; sub: string }
interface ArchLayer { label: string; boxes: ArchBox[]; isYou?: boolean }
interface HowCard { number: string; title: string; text: string }
interface WfStep { time: string; text: string }
interface StatItem { number: string; label: string }
interface SkillCard { name: string; cmd: string; desc: string; tags: { text: string; className: string }[] }
interface LegendItem { text: string; className: string }

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list-item"; text: string }
  | { type: "code-block"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "hr" }
  | { type: "arch-diagram"; layers: ArchLayer[] }
  | { type: "how-grid"; cards: HowCard[] }
  | { type: "workflow"; steps: WfStep[] }
  | { type: "stats"; items: StatItem[] }
  | { type: "legend"; items: LegendItem[] }
  | { type: "skill-grid"; cards: SkillCard[] }
  | { type: "table"; rows: string[][] };

/** Find the closing tag for a div opened at startIdx, counting nesting */
function extractBlock(html: string, startIdx: number): string {
  let depth = 0;
  let i = startIdx;
  while (i < html.length) {
    if (html.substring(i).startsWith("<div")) { depth++; i += 4; }
    else if (html.substring(i).startsWith("</div>")) {
      depth--;
      if (depth === 0) return html.substring(startIdx, i + 6);
      i += 6;
    }
    else { i++; }
  }
  return html.substring(startIdx);
}

function matchAll(str: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) results.push(m);
  return results;
}

function parseArchDiagram(blockHtml: string): Block {
  const layers: ArchLayer[] = [];
  // Split by arch-arrow to get layers
  const parts = blockHtml.split(/<div class="arch-arrow">[\s\S]*?<\/div>/);
  for (const part of parts) {
    const labelMatch = part.match(/<div class="arch-label">(.*?)<\/div>/);
    const label = labelMatch ? stripHtml(labelMatch[1]) : "";
    const isYou = part.includes("arch-you");
    const boxes: ArchBox[] = [];
    const boxMatches = matchAll(part, /<div class="arch-box[^"]*">([\s\S]*?)<\/div>/gi);
    for (const bm of boxMatches) {
      const boxHtml = bm[1];
      const parts2 = boxHtml.split(/<br\s*\/?>/i);
      const title = stripHtml(parts2[0] || "");
      const subMatch = boxHtml.match(/<span class="arch-sub">(.*?)<\/span>/);
      const sub = subMatch ? stripHtml(subMatch[1]) : "";
      if (title) boxes.push({ title, sub });
    }
    if (label || boxes.length) layers.push({ label, boxes, isYou });
  }
  return { type: "arch-diagram", layers };
}

function parseHowGrid(blockHtml: string): Block {
  const cards: HowCard[] = [];
  // Each how-card is a self-contained div
  const cardBlocks = blockHtml.split(/<div class="how-card">/);
  for (const cb of cardBlocks.slice(1)) {
    const numMatch = cb.match(/<div class="how-number">(.*?)<\/div>/);
    const titleMatch = cb.match(/<div class="how-title">(.*?)<\/div>/);
    const textMatch = cb.match(/<div class="how-text">([\s\S]*?)<\/div>/);
    cards.push({
      number: numMatch ? stripHtml(numMatch[1]) : "",
      title: titleMatch ? stripHtml(titleMatch[1]) : "",
      text: textMatch ? stripHtml(textMatch[1]) : "",
    });
  }
  return { type: "how-grid", cards };
}

function parseWorkflow(blockHtml: string): Block {
  const steps: WfStep[] = [];
  const stepMatches = matchAll(blockHtml, /<div class="wf-step">([\s\S]*?)<\/div>/gi);
  for (const sm of stepMatches) {
    const timeMatch = sm[1].match(/<span class="wf-time">(.*?)<\/span>/);
    const time = timeMatch ? stripHtml(timeMatch[1]) : "";
    const text = stripHtml(sm[1].replace(/<span class="wf-time">.*?<\/span>/, ""));
    if (text) steps.push({ time, text });
  }
  return { type: "workflow", steps };
}

function parseStats(blockHtml: string): Block {
  const items: StatItem[] = [];
  const statParts = blockHtml.split(/<div class="stat">/);
  for (const sp of statParts.slice(1)) {
    const numMatch = sp.match(/<div class="stat-number">(.*?)<\/div>/);
    const labelMatch = sp.match(/<div class="stat-label">(.*?)<\/div>/);
    if (numMatch && labelMatch) {
      items.push({ number: stripHtml(numMatch[1]), label: stripHtml(labelMatch[1]) });
    }
  }
  return { type: "stats", items };
}

function parseLegend(blockHtml: string): Block {
  const items: LegendItem[] = [];
  const itemMatches = matchAll(blockHtml, /<div class="legend-item">([\s\S]*?)<\/div>/gi);
  for (const im of itemMatches) {
    const tagMatch = im[1].match(/<span class="(tag[^"]*)"[^>]*>.*?<\/span>\s*(.*)/);
    if (tagMatch) items.push({ text: stripHtml(tagMatch[2]), className: tagMatch[1] });
  }
  return { type: "legend", items };
}

function parseSkillGrid(blockHtml: string): Block {
  const cards: SkillCard[] = [];
  const cardParts = blockHtml.split(/<div class="card">/);
  for (const cp of cardParts.slice(1)) {
    const nameMatch = cp.match(/<span class="card-name">(.*?)<\/span>/);
    const cmdMatch = cp.match(/<span class="card-cmd">(.*?)<\/span>/);
    const descMatch = cp.match(/<div class="card-desc">([\s\S]*?)<\/div>/);
    const tags: { text: string; className: string }[] = [];
    const tagMatches = matchAll(cp, /<span class="(tag[^"]*)"[^>]*>(.*?)<\/span>/gi);
    for (const tm of tagMatches) {
      if (!tm[1].includes("card-")) tags.push({ text: stripHtml(tm[2]), className: tm[1] });
    }
    if (nameMatch) {
      cards.push({
        name: stripHtml(nameMatch[1]),
        cmd: cmdMatch ? stripHtml(cmdMatch[1]) : "",
        // Behoudt inline-code (<code>) als backtick-notatie voor opmaak in PDF
        desc: descMatch ? stripHtmlPreserveCode(descMatch[1]) : "",
        tags,
      });
    }
  }
  return { type: "skill-grid", cards };
}

function parseHtmlContent(html: string): Block[] {
  // Phase 1: Extract all structured blocks, replace them with markers
  const markers: { pos: number; block: Block }[] = [];
  let processed = html;

  // Helper: find all occurrences of a class and extract the full div block
  function extractAndMark(className: string, parser: (html: string) => Block) {
    const search = `class="${className}"`;
    let offset = 0;
    while (true) {
      const idx = processed.indexOf(search, offset);
      if (idx === -1) break;
      // Find the opening <div that contains this class
      let divStart = processed.lastIndexOf("<div", idx);
      if (divStart === -1) { offset = idx + 1; continue; }
      const blockHtml = extractBlock(processed, divStart);
      const marker = `{{BLOCK_${markers.length}}}`;
      markers.push({ pos: divStart, block: parser(blockHtml) });
      processed = processed.substring(0, divStart) + marker + processed.substring(divStart + blockHtml.length);
      offset = divStart + marker.length;
    }
  }

  extractAndMark("arch-diagram", parseArchDiagram);
  extractAndMark("how-grid", parseHowGrid);
  extractAndMark("workflow", parseWorkflow);
  extractAndMark("stats", parseStats);
  extractAndMark("legend", parseLegend);
  extractAndMark("grid", parseSkillGrid);

  // Phase 2: Parse remaining text content line by line
  const blocks: Block[] = [];
  const lines = processed.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("<!--")) continue;

    // Check for block markers
    const markerMatch = trimmed.match(/\{\{BLOCK_(\d+)\}\}/);
    if (markerMatch) {
      blocks.push(markers[parseInt(markerMatch[1])].block);
      continue;
    }

    // Skip wrapper divs and structural tags
    if (/^<\/?div/.test(trimmed) || /^<img /.test(trimmed) || /^<\/?section/.test(trimmed)) {
      // But check if it has text content worth keeping
      if (/<div[^>]*>/.test(trimmed)) {
        const t = stripHtml(trimmed);
        // Only keep if it looks like a subtitle/paragraph, not a wrapper
        if (t && t.length > 10 && !t.startsWith("<")) {
          blocks.push({ type: "paragraph", text: t });
        }
      }
      continue;
    }
    if (/^<\//.test(trimmed)) continue;

    // Headings
    const h1m = trimmed.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1m) { const t = stripHtml(h1m[1]); if (t) blocks.push({ type: "h1", text: t }); continue; }
    const h2m = trimmed.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2m) { const t = stripHtml(h2m[1]); if (t) blocks.push({ type: "h2", text: t }); continue; }
    const h3m = trimmed.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3m) { const t = stripHtml(h3m[1]); if (t) blocks.push({ type: "h3", text: t }); continue; }

    // HR
    if (/<hr/i.test(trimmed)) { blocks.push({ type: "hr" }); continue; }

    // Paragraphs
    if (/<p[^>]*>/i.test(trimmed)) {
      const t = stripHtml(trimmed); if (t) blocks.push({ type: "paragraph", text: t }); continue;
    }

    // List items
    if (/<li[^>]*>/i.test(trimmed)) {
      const t = stripHtml(trimmed); if (t) blocks.push({ type: "list-item", text: t }); continue;
    }

    // Blockquote
    if (/<blockquote/i.test(trimmed)) {
      const t = stripHtml(trimmed); if (t) blocks.push({ type: "blockquote", text: t }); continue;
    }

    // Any remaining content
    const t = stripHtml(trimmed);
    if (t && t.length > 1) blocks.push({ type: "paragraph", text: t });
  }

  return blocks;
}

// ===== MARKDOWN PARSER (fallback) =====

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { codeLines.push(lines[i]); i++; }
      blocks.push({ type: "code-block", text: codeLines.join("\n") });
      i++; continue;
    }
    if (trimmed.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1].trim())) {
      const rows: string[][] = [];
      rows.push(trimmed.split("|").map(c => c.trim()).filter(c => c !== ""));
      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(lines[i].trim().split("|").map(c => c.trim()).filter(c => c !== ""));
        i++;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) { blocks.push({ type: "hr" }); i++; continue; }
    if (trimmed.startsWith("### ")) { blocks.push({ type: "h3", text: trimmed.slice(4) }); i++; continue; }
    if (trimmed.startsWith("## ")) { blocks.push({ type: "h2", text: trimmed.slice(3) }); i++; continue; }
    if (trimmed.startsWith("# ")) { blocks.push({ type: "h1", text: trimmed.slice(2) }); i++; continue; }
    if (trimmed.startsWith("> ")) {
      const ql: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) { ql.push(lines[i].trim().slice(2)); i++; }
      blocks.push({ type: "blockquote", text: ql.join("\n") });
      continue;
    }
    if (/^[-*]\s/.test(trimmed)) { blocks.push({ type: "list-item", text: trimmed.replace(/^[-*]\s/, "") }); i++; continue; }
    if (/^\d+\.\s/.test(trimmed)) { blocks.push({ type: "list-item", text: trimmed.replace(/^\d+\.\s/, "") }); i++; continue; }
    blocks.push({ type: "paragraph", text: trimmed });
    i++;
  }
  return blocks;
}

function isHtmlContent(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<") && (
    trimmed.startsWith("<h1") || trimmed.startsWith("<h2") || trimmed.startsWith("<p") ||
    trimmed.startsWith("<div") || trimmed.startsWith("<section") || trimmed.startsWith("<!") || trimmed.startsWith("<html")
  );
}

function parseContent(content: string): Block[] {
  return isHtmlContent(content) ? parseHtmlContent(content) : parseMarkdown(content);
}

// ===== RENDER BLOCKS =====

function renderInlineText(text: string): React.ReactElement {
  const parts: React.ReactElement[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*(.+?)\*\*([\s\S]*)/);
    if (boldMatch && boldMatch[1].length < remaining.length) {
      if (boldMatch[1]) parts.push(<Text key={key++}>{boldMatch[1]}</Text>);
      parts.push(<Text key={key++} style={s.bold}>{boldMatch[2]}</Text>);
      remaining = boldMatch[3]; continue;
    }
    const codeMatch = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)/);
    if (codeMatch && codeMatch[1].length < remaining.length) {
      if (codeMatch[1]) parts.push(<Text key={key++}>{codeMatch[1]}</Text>);
      parts.push(<Text key={key++} style={s.inlineCode}> {codeMatch[2]} </Text>);
      remaining = codeMatch[3]; continue;
    }
    parts.push(<Text key={key++}>{remaining}</Text>);
    break;
  }
  return <Text>{parts}</Text>;
}

function renderBlock(block: Block, index: number): React.ReactElement {
  switch (block.type) {
    case "h1":
      return <Text key={index} style={s.h1} minPresenceAhead={80}>{block.text}</Text>;
    case "h2":
      return <Text key={index} style={s.h2} minPresenceAhead={80}>{block.text}</Text>;
    case "h3":
      return <Text key={index} style={s.h3} minPresenceAhead={60}>{block.text}</Text>;
    case "paragraph":
      return <View key={index} style={{ marginBottom: 6 }}><Text style={s.paragraph}>{renderInlineText(block.text)}</Text></View>;
    case "list-item":
      return <View key={index} style={{ marginBottom: 3 }}><Text style={s.listItem}>{"\u2022  "}{renderInlineText(block.text)}</Text></View>;
    case "code-block":
      return <View key={index} style={s.codeBlock} wrap={false}><Text style={s.codeText}>{block.text}</Text></View>;
    case "blockquote":
      return <View key={index} style={s.blockquote}><Text style={s.blockquoteText}>{block.text}</Text></View>;
    case "hr":
      return <View key={index} style={s.hr} />;

    // ===== ARCHITECTURE DIAGRAM =====
    case "arch-diagram":
      return (
        <View key={index} style={s.archDiagram} wrap={false}>
          {block.layers.map((layer, li) => (
            <React.Fragment key={li}>
              {li > 0 && <Text style={s.archArrow}>{"\u2193"}</Text>}
              <View style={s.archLayer}>
                <Text style={s.archLabel}>{layer.label}</Text>
                {layer.isYou ? (
                  layer.boxes.map((box, bi) => (
                    <View key={bi} style={s.archBoxYou}>
                      <Text style={[s.archBoxTitle, { color: TEXT_PRIMARY }]}>{box.title}</Text>
                      {box.sub ? <Text style={[s.archBoxSub, { color: TEXT_SECONDARY }]}>{box.sub}</Text> : null}
                    </View>
                  ))
                ) : (
                  <View style={s.archBoxRow}>
                    {layer.boxes.map((box, bi) => (
                      <View key={bi} style={layer.label === "Infra" ? s.archBoxInfra : s.archBoxCore}>
                        <Text style={s.archBoxTitle}>{box.title}</Text>
                        {box.sub ? <Text style={s.archBoxSub}>{box.sub}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </React.Fragment>
          ))}
        </View>
      );

    // ===== HOW CARDS =====
    case "how-grid":
      return (
        <View key={index} style={s.howGrid}>
          {block.cards.map((card, ci) => (
            <View key={ci} style={s.howCard} wrap={false}>
              <Text style={s.howNumber}>{card.number}</Text>
              <Text style={s.howTitle}>{card.title}</Text>
              <Text style={s.howText}>{card.text}</Text>
            </View>
          ))}
        </View>
      );

    // ===== WORKFLOW =====
    case "workflow":
      return (
        <View key={index} style={s.workflowContainer} wrap={false}>
          {block.steps.map((step, si) => (
            <React.Fragment key={si}>
              {si > 0 && <View style={s.wfConnector} />}
              <View style={s.wfStep}>
                <Text style={s.wfTime}>{step.time}</Text>
                <View style={s.wfContent}>
                  <Text style={s.wfText}>{step.text}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      );

    // ===== STATS =====
    case "stats":
      return (
        <View key={index} style={s.statsRow} wrap={false}>
          {block.items.map((item, si) => (
            <View key={si} style={s.statBox}>
              <Text style={s.statNumber}>{item.number}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      );

    // ===== LEGEND =====
    case "legend":
      return (
        <View key={index} style={s.legendRow} wrap={false}>
          {block.items.map((item, li) => (
            <View key={li} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: (getTagColorStyle(item.className) as Record<string, string>).backgroundColor || "#E5E7EB" }]} />
              <Text style={s.legendText}>{item.text}</Text>
            </View>
          ))}
        </View>
      );

    // ===== SKILL CARDS =====
    case "skill-grid":
      return (
        <View key={index} style={s.skillGrid}>
          {block.cards.map((card, ci) => (
            <View key={ci} style={s.skillCard} wrap={false}>
              <View style={s.skillCardHeader}>
                <Text style={s.skillCardName}>{card.name}</Text>
                <Text style={s.skillCardCmd}>{card.cmd}</Text>
              </View>
              <Text style={s.skillCardDesc}>{card.desc}</Text>
              <View style={s.skillCardTags}>
                {card.tags.map((tag, ti) => (
                  <Text key={ti} style={[s.tag, getTagColorStyle(tag.className)]}>{tag.text}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      );

    // ===== TABLE =====
    case "table":
      if (!block.rows || block.rows.length === 0) return <View key={index} />;
      return (
        <View key={index} style={s.table} wrap={false}>
          <View style={s.tableHeaderRow}>
            {block.rows[0].map((cell, ci) => (
              <View key={ci} style={s.tableHeaderCell}><Text style={s.tableHeaderText}>{cell}</Text></View>
            ))}
          </View>
          {block.rows.slice(1).map((row, ri) => (
            <View key={ri} style={[s.tableRow, ri % 2 === 1 ? s.tableRowAlt : {}]}>
              {row.map((cell, ci) => (
                <View key={ci} style={s.tableCell}><Text style={s.tableCellText}>{cell}</Text></View>
              ))}
            </View>
          ))}
        </View>
      );

    default:
      return <View key={index} />;
  }
}

// ===== COMPONENT =====

interface WikiPDFProps {
  artikel: {
    titel: string;
    inhoud: string;
    categorie: string | null;
    auteurNaam: string | null;
    bijgewerktOp: string | null;
  };
  bedrijf: {
    bedrijfsnaam: string | null;
    email: string | null;
    website: string | null;
    kvkNummer: string | null;
  };
}

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

export function WikiPDF({ artikel, bedrijf }: WikiPDFProps) {
  const bedrijfsnaam = bedrijf.bedrijfsnaam || "Autronis";
  const datum = artikel.bijgewerktOp ? formatDatum(artikel.bijgewerktOp) : "";
  const blocks = parseContent(artikel.inhoud || "");
  const logoSrc = getLogoSrc();

  return (
    <Document>
      {/* ===== COVER PAGE ===== */}
      <Page size="A4" style={s.coverPage}>
        {logoSrc && <Image src={logoSrc} style={s.coverLogo} />}
        <Text style={s.coverLabel}>{bedrijfsnaam}</Text>
        <Text style={s.coverTitle}>{artikel.titel}</Text>
        <View style={s.coverLine} />
        <Text style={s.coverMeta}>
          {artikel.auteurNaam ? `${artikel.auteurNaam}\n` : ""}
          {datum}
        </Text>
        {artikel.categorie && (
          <Text style={s.coverCategorie}>{artikel.categorie}</Text>
        )}
        <Text style={s.coverFooter}>{bedrijfsnaam} — Vertrouwelijk</Text>
      </Page>

      {/* ===== CONTENT PAGES ===== */}
      <Page size="A4" style={s.contentPage} wrap>
        <View style={s.pageHeader} fixed>
          <View style={s.pageHeaderBrand}>
            {logoSrc && <Image src={logoSrc} style={s.pageHeaderLogo} />}
            <Text style={s.pageHeaderBrandText}>{bedrijfsnaam.toUpperCase()}</Text>
          </View>
          <Text style={s.pageHeaderRight}>{artikel.titel}</Text>
        </View>

        {blocks.map((block, i) => renderBlock(block, i))}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {[bedrijfsnaam, bedrijf.email, bedrijf.website, bedrijf.kvkNummer ? `KvK: ${bedrijf.kvkNummer}` : null].filter(Boolean).join(" | ")}
          </Text>
          <Text style={s.footerPage} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber - 1} van ${totalPages - 1}`} />
        </View>
      </Page>
    </Document>
  );
}
