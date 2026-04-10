"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Tag,
  User,
  Clock,
  FileDown,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Artikel {
  id: number;
  titel: string;
  inhoud: string | null;
  categorie: string | null;
  tags: string | null;
  gepubliceerd: number | null;
  auteurId: number | null;
  auteurNaam: string | null;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
}

const categorieConfig: Record<string, { label: string; color: string; bg: string }> = {
  processen: { label: "Processen", color: "text-blue-400", bg: "bg-blue-500/15" },
  klanten: { label: "Klanten", color: "text-green-400", bg: "bg-green-500/15" },
  technisch: { label: "Technisch", color: "text-purple-400", bg: "bg-purple-500/15" },
  templates: { label: "Templates", color: "text-amber-400", bg: "bg-amber-500/15" },
  financien: { label: "Financieel", color: "text-red-400", bg: "bg-red-500/15" },
};

function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed: unknown = JSON.parse(tagsJson);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string");
    return [];
  } catch {
    return [];
  }
}

function isHtmlContent(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<") && (
    trimmed.startsWith("<h1") || trimmed.startsWith("<h2") || trimmed.startsWith("<p") ||
    trimmed.startsWith("<div") || trimmed.startsWith("<section") || trimmed.startsWith("<article") ||
    trimmed.startsWith("<!") || trimmed.startsWith("<html")
  );
}

function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre class="bg-autronis-bg border border-autronis-border rounded-xl p-4 my-4 overflow-x-auto"><code class="text-sm text-autronis-text-primary font-mono">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-autronis-bg border border-autronis-border rounded px-1.5 py-0.5 text-sm font-mono text-autronis-accent">$1</code>');

  // Headers
  html = html.replace(/^######\s(.+)$/gm, '<h6 class="text-sm font-semibold text-autronis-text-primary mt-6 mb-2">$1</h6>');
  html = html.replace(/^#####\s(.+)$/gm, '<h5 class="text-sm font-semibold text-autronis-text-primary mt-6 mb-2">$1</h5>');
  html = html.replace(/^####\s(.+)$/gm, '<h4 class="text-base font-semibold text-autronis-text-primary mt-6 mb-2">$1</h4>');
  html = html.replace(/^###\s(.+)$/gm, '<h3 class="text-lg font-semibold text-autronis-text-primary mt-8 mb-3">$1</h3>');
  html = html.replace(/^##\s(.+)$/gm, '<h2 class="text-xl font-bold text-autronis-text-primary mt-8 mb-3">$1</h2>');
  html = html.replace(/^#\s(.+)$/gm, '<h1 class="text-2xl font-bold text-autronis-text-primary mt-8 mb-4">$1</h1>');

  // Highlight ==text== as red voiceover text
  html = html.replace(/==(.+?)==/g, '<mark class="bg-transparent text-red-400 font-medium">$1</mark>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-autronis-text-primary">$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-autronis-accent hover:text-autronis-accent-hover underline transition-colors" target="_blank" rel="noopener noreferrer">$1</a>');

  // Unordered lists
  html = html.replace(/^[-*]\s(.+)$/gm, '<li class="text-autronis-text-secondary ml-4 pl-2">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li class="text-autronis-text-secondary ml-4 pl-2 list-decimal">$1</li>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="border-autronis-border my-6" />');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul class="list-disc space-y-1 my-3">$1</ul>');

  // Paragraphs - wrap lines that aren't already HTML
  html = html.replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p class="text-autronis-text-secondary leading-relaxed my-2">$1</p>');

  return html;
}

export default function WikiArtikelPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [artikel, setArtikel] = useState<Artikel | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  const fetchArtikel = useCallback(async () => {
    try {
      const res = await fetch(`/api/wiki/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setArtikel(json.artikel);
    } catch {
      addToast("Kon artikel niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchArtikel();
  }, [fetchArtikel]);

  async function handleDelete() {
    try {
      const res = await fetch(`/api/wiki/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Artikel verwijderd", "succes");
      router.push("/wiki");
    } catch {
      addToast("Kon artikel niet verwijderen", "fout");
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!artikel) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        <p className="text-autronis-text-secondary">Artikel niet gevonden.</p>
        <Link href="/wiki" className="text-autronis-accent hover:text-autronis-accent-hover mt-4 inline-block">
          Terug naar kennisbank
        </Link>
      </div>
    );
  }

  const cat = categorieConfig[artikel.categorie || "processen"] || categorieConfig.processen;
  const tags = parseTags(artikel.tags);

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Kennisbank", href: "/wiki" },
            { label: artikel.titel },
          ]}
        />

        {/* Header */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full font-medium",
                    cat.bg,
                    cat.color
                  )}
                >
                  {cat.label}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">
                {artikel.titel}
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => window.open(`/api/wiki/${id}/pdf`, "_blank")}
                className="inline-flex items-center gap-2 px-4 py-2 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors"
              >
                <FileDown className="w-4 h-4" />
                PDF
              </button>
              <Link
                href={`/wiki/${id}/bewerken`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Bewerken
              </Link>
              <button
                onClick={() => setShowDelete(true)}
                className="p-2 text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center flex-wrap gap-4 text-sm text-autronis-text-secondary">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {artikel.auteurNaam || "Onbekend"}
            </div>
            {artikel.bijgewerktOp && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Bijgewerkt op {formatDatum(artikel.bijgewerktOp)}
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-autronis-bg rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
          <div
            className="wiki-content prose max-w-none
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-autronis-text-primary [&_h1]:mt-8 [&_h1]:mb-4
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-autronis-text-primary [&_h2]:mt-8 [&_h2]:mb-3
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-autronis-text-primary [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:text-autronis-text-secondary [&_p]:leading-relaxed [&_p]:my-2
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ul]:text-autronis-text-secondary
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_ol]:text-autronis-text-secondary
              [&_li]:mb-1 [&_li]:leading-relaxed
              [&_pre]:bg-autronis-bg [&_pre]:border [&_pre]:border-autronis-border [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:my-4 [&_pre]:overflow-x-auto
              [&_code]:text-autronis-accent [&_code]:text-sm
              [&_strong]:text-autronis-text-primary [&_strong]:font-semibold
              [&_a]:text-autronis-accent [&_a]:underline
              [&_hr]:border-autronis-border [&_hr]:my-6
              [&_blockquote]:border-l-2 [&_blockquote]:border-autronis-accent/30 [&_blockquote]:pl-4 [&_blockquote]:italic
              [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
              [&_th]:border [&_th]:border-autronis-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-autronis-text-primary [&_th]:bg-autronis-bg
              [&_td]:border [&_td]:border-autronis-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-autronis-text-secondary"
            dangerouslySetInnerHTML={{
              __html: isHtmlContent(artikel.inhoud || "")
                ? artikel.inhoud || ""
                : renderMarkdown(artikel.inhoud || ""),
            }}
          />
        </div>

        {/* Back button */}
        <Link
          href="/wiki"
          className="inline-flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar kennisbank
        </Link>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onBevestig={handleDelete}
        bericht="Weet je zeker dat je dit artikel wilt verwijderen? Dit kan niet ongedaan gemaakt worden."
      />
    </PageTransition>
  );
}
