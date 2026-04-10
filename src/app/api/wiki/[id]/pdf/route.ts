import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen, gebruikers, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

function renderMarkdownToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:12px;font-family:'Courier New',monospace;font-size:10pt;overflow-wrap:break-word;white-space:pre-wrap;margin:10pt 0;">${code.trim()}</pre>`
  );
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-family:\'Courier New\',monospace;font-size:10pt;">$1</code>');
  html = html.replace(/^###\s(.+)$/gm, '<h3 style="font-size:13pt;font-weight:600;color:#1a1a1a;margin:16pt 0 6pt;">$1</h3>');
  html = html.replace(/^##\s(.+)$/gm, '<h2 style="font-size:15pt;font-weight:600;color:#1a1a1a;margin:20pt 0 8pt;border-bottom:1px solid #e8ecee;padding-bottom:6pt;">$1</h2>');
  html = html.replace(/^#\s(.+)$/gm, '<h1 style="font-size:18pt;font-weight:700;color:#1a1a1a;margin:24pt 0 10pt;">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#17B8A5;">$1</a>');
  html = html.replace(/^[-*]\s(.+)$/gm, '<li style="margin-left:20pt;margin-bottom:3pt;">$1</li>');
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li style="margin-left:20pt;margin-bottom:3pt;list-style-type:decimal;">$1</li>');
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e0e0e0;margin:16pt 0;" />');
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul style="margin:8pt 0;">$1</ul>');
  html = html.replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p style="margin:6pt 0;line-height:1.6;">$1</p>');
  return html;
}

function isHtmlContent(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<") && (
    trimmed.startsWith("<h1") || trimmed.startsWith("<h2") || trimmed.startsWith("<p") ||
    trimmed.startsWith("<div") || trimmed.startsWith("<section") || trimmed.startsWith("<!") || trimmed.startsWith("<html")
  );
}

// GET /api/wiki/[id]/pdf — generate branded HTML for PDF printing
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const artikel = await db
      .select({
        id: wikiArtikelen.id,
        titel: wikiArtikelen.titel,
        inhoud: wikiArtikelen.inhoud,
        categorie: wikiArtikelen.categorie,
        auteurNaam: gebruikers.naam,
        bijgewerktOp: wikiArtikelen.bijgewerktOp,
      })
      .from(wikiArtikelen)
      .leftJoin(gebruikers, eq(wikiArtikelen.auteurId, gebruikers.id))
      .where(eq(wikiArtikelen.id, Number(id)))
      .get();

    if (!artikel) {
      return NextResponse.json({ fout: "Artikel niet gevonden" }, { status: 404 });
    }

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1);
    const bedrijfNaam = bedrijf?.bedrijfsnaam || "Autronis";
    const datum = artikel.bijgewerktOp
      ? new Date(artikel.bijgewerktOp).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
      : "";

    const inhoudHtml = isHtmlContent(artikel.inhoud || "")
      ? artikel.inhoud || ""
      : renderMarkdownToHtml(artikel.inhoud || "");

    const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>${artikel.titel} — ${bedrijfNaam}</title>
<style>
  @page { margin: 2cm 2.5cm; size: A4; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }
  .cover {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 85vh;
    text-align: center;
  }
  .cover-logo { width: 80px; margin-bottom: 32px; }
  .cover-label {
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #17B8A5;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .cover-title {
    font-size: 28pt;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .cover-meta {
    font-size: 10pt;
    color: #888;
    margin-top: 24px;
  }
  .cover-line {
    width: 60px;
    height: 3px;
    background: #17B8A5;
    margin: 24px auto;
    border-radius: 2px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8pt;
    border-bottom: 2px solid #17B8A5;
    margin-bottom: 20pt;
  }
  .header-brand {
    font-size: 10pt;
    font-weight: 600;
    color: #17B8A5;
    letter-spacing: 1px;
  }
  .header-date {
    font-size: 9pt;
    color: #888;
  }
  .content h1 { font-size: 18pt; font-weight: 700; margin: 24pt 0 10pt; color: #1a1a1a; }
  .content h2 { font-size: 15pt; font-weight: 600; margin: 20pt 0 8pt; color: #1a1a1a; border-bottom: 1px solid #e8ecee; padding-bottom: 6pt; }
  .content h3 { font-size: 13pt; font-weight: 600; margin: 16pt 0 6pt; color: #333; }
  .content p { margin: 6pt 0; }
  .content ul, .content ol { padding-left: 20pt; margin: 8pt 0; }
  .content li { margin-bottom: 3pt; }
  .content pre {
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px;
    font-family: 'Courier New', monospace;
    font-size: 9pt;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .content code {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    background: #f0f0f0;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .content pre code { background: none; padding: 0; }
  .content table { width: 100%; border-collapse: collapse; margin: 8pt 0; page-break-inside: avoid; }
  .content th, .content td { border: 1px solid #ccc; padding: 4pt 8pt; font-size: 10pt; text-align: left; }
  .content th { background: #f0f0f0; font-weight: 600; }
  .content blockquote { border-left: 3px solid #17B8A5; padding-left: 12pt; margin: 8pt 0; font-style: italic; color: #555; }
  .content a { color: #17B8A5; text-decoration: none; }
  .content img { max-width: 100%; height: auto; }
  .content hr { border: none; border-top: 1px solid #e0e0e0; margin: 16pt 0; }
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 8pt;
    color: #aaa;
    padding: 8pt 0;
    border-top: 1px solid #eee;
  }
  h1, h2, h3 { page-break-after: avoid; }
  figure, img, table, pre { page-break-inside: avoid; }
  @media print {
    .cover { min-height: 90vh; }
  }
</style>
</head>
<body>
  <div class="cover">
    <img class="cover-logo" src="https://dashboard.autronis.nl/logo.png" alt="${bedrijfNaam}" />
    <div class="cover-label">${bedrijfNaam}</div>
    <div class="cover-title">${artikel.titel}</div>
    <div class="cover-line"></div>
    <div class="cover-meta">
      ${artikel.auteurNaam ? `${artikel.auteurNaam} · ` : ""}${datum}
    </div>
  </div>

  <div class="header">
    <span class="header-brand">${bedrijfNaam}</span>
    <span class="header-date">${artikel.titel} · ${datum}</span>
  </div>

  <div class="content">
    ${inhoudHtml}
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${artikel.titel.replace(/[^a-zA-Z0-9 -]/g, "")}.html"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
