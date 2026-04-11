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

const styles = StyleSheet.create({
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
  coverLogo: {
    width: 80,
    height: 40,
    marginBottom: 40,
  },
  coverLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: TEAL,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: TEXT_PRIMARY,
    textAlign: "center",
    lineHeight: 1.3,
    marginBottom: 16,
    maxWidth: 400,
  },
  coverLine: {
    width: 60,
    height: 3,
    backgroundColor: TEAL,
    borderRadius: 2,
    marginVertical: 24,
  },
  coverMeta: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 1.6,
  },
  coverCategorie: {
    fontSize: 8,
    fontWeight: 600,
    color: TEAL,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 30,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 4,
  },
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: TEXT_SECONDARY,
  },
  // ===== CONTENT PAGES =====
  contentPage: {
    fontFamily: "Inter",
    fontSize: 10,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
    paddingTop: 70,
    paddingBottom: 80,
    paddingHorizontal: 55,
  },
  // ===== PAGE HEADER (fixed) =====
  pageHeader: {
    position: "absolute",
    top: 0,
    left: 55,
    right: 55,
    paddingTop: 25,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
  },
  pageHeaderLogo: {
    width: 36,
    height: 18,
  },
  pageHeaderBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pageHeaderBrandText: {
    fontSize: 9,
    fontWeight: 600,
    color: TEAL,
    letterSpacing: 1,
  },
  pageHeaderRight: {
    fontSize: 8,
    color: "#9CA3AF",
  },
  // ===== CONTENT =====
  h1: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    marginTop: 24,
    marginBottom: 10,
  },
  h2: {
    fontSize: 14,
    fontWeight: 700,
    color: DARK_BG,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: TEAL,
  },
  h3: {
    fontSize: 11,
    fontWeight: 600,
    color: "#374151",
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 9.5,
    lineHeight: 1.7,
    color: "#374151",
    marginBottom: 6,
  },
  listItem: {
    fontSize: 9.5,
    lineHeight: 1.7,
    color: "#374151",
    marginBottom: 3,
    paddingLeft: 14,
  },
  codeBlock: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    padding: 12,
    marginVertical: 8,
  },
  codeText: {
    fontFamily: "Courier",
    fontSize: 8,
    color: "#1F2937",
    lineHeight: 1.6,
  },
  inlineCode: {
    fontFamily: "Courier",
    fontSize: 9,
    backgroundColor: "#F3F4F6",
    color: "#1F2937",
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    paddingLeft: 12,
    marginVertical: 8,
  },
  blockquoteText: {
    fontSize: 9.5,
    fontStyle: "italic",
    color: "#6B7280",
    lineHeight: 1.7,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginVertical: 16,
  },
  bold: {
    fontWeight: 700,
  },
  italic: {
    fontStyle: "italic",
  },
  link: {
    color: TEAL,
  },
  // ===== TABLE =====
  table: {
    marginVertical: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: DARK_BG,
    borderRadius: 3,
  },
  tableHeaderCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 600,
    color: TEXT_PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableCellText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  // ===== FOOTER =====
  footer: {
    position: "absolute",
    bottom: 0,
    left: 55,
    right: 55,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: "#9CA3AF",
  },
  footerPage: {
    fontSize: 7,
    color: "#9CA3AF",
  },
});

// ===== CONTENT PARSER =====

interface ParsedElement {
  type: "h1" | "h2" | "h3" | "paragraph" | "list-item" | "ordered-item" | "code-block" | "blockquote" | "hr" | "table";
  content: string;
  rows?: string[][];
}

function isHtmlContent(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<") && (
    trimmed.startsWith("<h1") || trimmed.startsWith("<h2") || trimmed.startsWith("<p") ||
    trimmed.startsWith("<div") || trimmed.startsWith("<section") || trimmed.startsWith("<!") || trimmed.startsWith("<html")
  );
}

/** Strip all HTML tags, decode entities, return plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote|pre|section)>/gi, "\n")
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
    .trim();
}

/** Extract text content from an HTML tag */
function getTagText(html: string): string {
  return stripHtml(html).trim();
}

function parseHtml(html: string): ParsedElement[] {
  const elements: ParsedElement[] = [];

  // Process line by line, matching HTML tags
  // We use regex to find block-level elements
  const blockPattern = /<(h[1-3]|p|div|pre|code|blockquote|li|hr|table|tr|th|td|ul|ol|section|span|strong|em|a|img|br)[^>]*>([\s\S]*?)<\/\1>|<(hr|br|img)\s*\/?>/gi;

  // First, extract structured content by walking the HTML
  // Split into meaningful blocks
  const lines = html.split("\n");
  let inCodeBlock = false;
  let codeContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip HTML comments
    if (trimmed.startsWith("<!--")) continue;

    // Detect code/pre blocks
    if (/<pre[^>]*>/i.test(trimmed) || (/<code[^>]*>/i.test(trimmed) && !/<\/code>/i.test(trimmed))) {
      inCodeBlock = true;
      codeContent = [];
      const codeText = getTagText(trimmed);
      if (codeText) codeContent.push(codeText);
      continue;
    }
    if (inCodeBlock) {
      if (/<\/pre>/i.test(trimmed) || /<\/code>/i.test(trimmed)) {
        const codeText = getTagText(trimmed);
        if (codeText) codeContent.push(codeText);
        elements.push({ type: "code-block", content: codeContent.join("\n") });
        inCodeBlock = false;
        codeContent = [];
      } else {
        codeContent.push(getTagText(trimmed));
      }
      continue;
    }

    // Headings
    const h1Match = trimmed.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      const text = getTagText(h1Match[1]);
      if (text) elements.push({ type: "h1", content: text });
      continue;
    }
    const h2Match = trimmed.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) {
      const text = getTagText(h2Match[1]);
      if (text) elements.push({ type: "h2", content: text });
      continue;
    }
    const h3Match = trimmed.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3Match) {
      const text = getTagText(h3Match[1]);
      if (text) elements.push({ type: "h3", content: text });
      continue;
    }

    // HR
    if (/<hr/i.test(trimmed)) {
      elements.push({ type: "hr", content: "" });
      continue;
    }

    // List items
    if (/<li[^>]*>/i.test(trimmed)) {
      const text = getTagText(trimmed);
      if (text) elements.push({ type: "list-item", content: text });
      continue;
    }

    // Blockquote
    if (/<blockquote[^>]*>/i.test(trimmed)) {
      const text = getTagText(trimmed);
      if (text) elements.push({ type: "blockquote", content: text });
      continue;
    }

    // Paragraphs
    if (/<p[^>]*>/i.test(trimmed)) {
      const text = getTagText(trimmed);
      if (text) elements.push({ type: "paragraph", content: text });
      continue;
    }

    // Inline code (single line)
    if (/<code[^>]*>.*<\/code>/i.test(trimmed)) {
      const codeMatch = trimmed.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
      if (codeMatch) {
        const text = getTagText(codeMatch[0]);
        if (text) elements.push({ type: "code-block", content: text });
      }
      continue;
    }

    // Skip structural divs that are just wrappers — extract text from divs with content
    if (/<div[^>]*>/i.test(trimmed)) {
      const text = getTagText(trimmed);
      // Only add if it has actual text content (not just nested tags)
      if (text && text.length > 1 && !text.startsWith("<")) {
        elements.push({ type: "paragraph", content: text });
      }
      continue;
    }

    // Any remaining text content
    const text = stripHtml(trimmed);
    if (text && text.length > 1) {
      elements.push({ type: "paragraph", content: text });
    }
  }

  return elements;
}

function parseMarkdown(markdown: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) { i++; continue; }

    // Code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push({ type: "code-block", content: codeLines.join("\n") });
      i++; // skip closing ```
      continue;
    }

    // Table (line with | characters, followed by separator)
    if (trimmed.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1].trim())) {
      const rows: string[][] = [];
      // Header row
      rows.push(trimmed.split("|").map(c => c.trim()).filter(c => c !== ""));
      i++; // skip separator
      i++;
      // Data rows
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(lines[i].trim().split("|").map(c => c.trim()).filter(c => c !== ""));
        i++;
      }
      elements.push({ type: "table", content: "", rows });
      continue;
    }

    // HR
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push({ type: "hr", content: "" });
      i++; continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push({ type: "h3", content: trimmed.slice(4) });
      i++; continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push({ type: "h2", content: trimmed.slice(3) });
      i++; continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push({ type: "h1", content: trimmed.slice(2) });
      i++; continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Unordered list item
    if (/^[-*]\s/.test(trimmed)) {
      elements.push({ type: "list-item", content: trimmed.replace(/^[-*]\s/, "") });
      i++; continue;
    }

    // Ordered list item
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push({ type: "ordered-item", content: trimmed.replace(/^\d+\.\s/, "") });
      i++; continue;
    }

    // Paragraph
    elements.push({ type: "paragraph", content: trimmed });
    i++;
  }

  return elements;
}

/** Parse content — auto-detect HTML vs markdown */
function parseContent(content: string): ParsedElement[] {
  if (isHtmlContent(content)) {
    return parseHtml(content);
  }
  return parseMarkdown(content);
}

function renderInlineText(text: string): React.ReactElement {
  // Handle bold, italic, inline code, and links
  const parts: React.ReactElement[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*(.+?)\*\*([\s\S]*)/);
    if (boldMatch && boldMatch[1].length < remaining.length) {
      if (boldMatch[1]) {
        parts.push(<Text key={key++}>{boldMatch[1]}</Text>);
      }
      parts.push(<Text key={key++} style={styles.bold}>{boldMatch[2]}</Text>);
      remaining = boldMatch[3];
      continue;
    }

    // Inline code
    const codeMatch = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)/);
    if (codeMatch && codeMatch[1].length < remaining.length) {
      if (codeMatch[1]) {
        parts.push(<Text key={key++}>{codeMatch[1]}</Text>);
      }
      parts.push(<Text key={key++} style={styles.inlineCode}> {codeMatch[2]} </Text>);
      remaining = codeMatch[3];
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^([\s\S]*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)/);
    if (linkMatch && linkMatch[1].length < remaining.length) {
      if (linkMatch[1]) {
        parts.push(<Text key={key++}>{linkMatch[1]}</Text>);
      }
      parts.push(<Text key={key++} style={styles.link}>{linkMatch[2]}</Text>);
      remaining = linkMatch[4];
      continue;
    }

    // No more matches
    parts.push(<Text key={key++}>{remaining}</Text>);
    break;
  }

  return <Text>{parts}</Text>;
}

function renderElement(el: ParsedElement, index: number): React.ReactElement {
  switch (el.type) {
    case "h1":
      return <Text key={index} style={styles.h1} minPresenceAhead={80}>{el.content}</Text>;
    case "h2":
      return <Text key={index} style={styles.h2} minPresenceAhead={80}>{el.content}</Text>;
    case "h3":
      return <Text key={index} style={styles.h3} minPresenceAhead={60}>{el.content}</Text>;
    case "paragraph":
      return <View key={index} style={{ marginBottom: 6 }}><Text style={styles.paragraph}>{renderInlineText(el.content)}</Text></View>;
    case "list-item":
      return <View key={index} style={{ marginBottom: 3 }}><Text style={styles.listItem}>{"\u2022  "}{renderInlineText(el.content)}</Text></View>;
    case "ordered-item":
      return <View key={index} style={{ marginBottom: 3 }}><Text style={styles.listItem}>{renderInlineText(el.content)}</Text></View>;
    case "code-block":
      return (
        <View key={index} style={styles.codeBlock} wrap={false}>
          <Text style={styles.codeText}>{el.content}</Text>
        </View>
      );
    case "blockquote":
      return (
        <View key={index} style={styles.blockquote}>
          <Text style={styles.blockquoteText}>{el.content}</Text>
        </View>
      );
    case "hr":
      return <View key={index} style={styles.hr} />;
    case "table":
      if (!el.rows || el.rows.length === 0) return <View key={index} />;
      return (
        <View key={index} style={styles.table} wrap={false}>
          {/* Header */}
          <View style={styles.tableHeaderRow}>
            {el.rows[0].map((cell, ci) => (
              <View key={ci} style={styles.tableHeaderCell}>
                <Text style={styles.tableHeaderText}>{cell}</Text>
              </View>
            ))}
          </View>
          {/* Data rows */}
          {el.rows.slice(1).map((row, ri) => (
            <View key={ri} style={[styles.tableRow, ri % 2 === 1 ? styles.tableRowAlt : {}]}>
              {row.map((cell, ci) => (
                <View key={ci} style={styles.tableCell}>
                  <Text style={styles.tableCellText}>{cell}</Text>
                </View>
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
  return new Date(datum).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function WikiPDF({ artikel, bedrijf }: WikiPDFProps) {
  const bedrijfsnaam = bedrijf.bedrijfsnaam || "Autronis";
  const datum = artikel.bijgewerktOp ? formatDatum(artikel.bijgewerktOp) : "";
  const elements = parseContent(artikel.inhoud || "");
  const logoSrc = getLogoSrc();

  return (
    <Document>
      {/* ===== COVER PAGE ===== */}
      <Page size="A4" style={styles.coverPage}>
        {logoSrc && <Image src={logoSrc} style={styles.coverLogo} />}
        <Text style={styles.coverLabel}>{bedrijfsnaam}</Text>
        <Text style={styles.coverTitle}>{artikel.titel}</Text>
        <View style={styles.coverLine} />
        <Text style={styles.coverMeta}>
          {artikel.auteurNaam ? `${artikel.auteurNaam}\n` : ""}
          {datum}
        </Text>
        {artikel.categorie && (
          <Text style={styles.coverCategorie}>{artikel.categorie}</Text>
        )}
        <Text style={styles.coverFooter}>
          {bedrijfsnaam} — Vertrouwelijk
        </Text>
      </Page>

      {/* ===== CONTENT PAGES ===== */}
      <Page size="A4" style={styles.contentPage} wrap>
        {/* Fixed header on every page */}
        <View style={styles.pageHeader} fixed>
          <View style={styles.pageHeaderBrand}>
            {logoSrc && <Image src={logoSrc} style={styles.pageHeaderLogo} />}
            <Text style={styles.pageHeaderBrandText}>{bedrijfsnaam.toUpperCase()}</Text>
          </View>
          <Text style={styles.pageHeaderRight}>{artikel.titel}</Text>
        </View>

        {/* Content */}
        {elements.map((el, i) => renderElement(el, i))}

        {/* Fixed footer on every page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {[bedrijfsnaam, bedrijf.email, bedrijf.website, bedrijf.kvkNummer ? `KvK: ${bedrijf.kvkNummer}` : null].filter(Boolean).join(" | ")}
          </Text>
          <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber - 1} van ${totalPages - 1}`} />
        </View>
      </Page>
    </Document>
  );
}
