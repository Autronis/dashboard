"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save, Eye, PenLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

const categorieOpties = [
  { value: "processen", label: "Processen" },
  { value: "klanten", label: "Klanten" },
  { value: "technisch", label: "Technisch" },
  { value: "templates", label: "Templates" },
  { value: "financien", label: "Financieel" },
  { value: "strategie", label: "Strategie" },
  { value: "geleerde-lessen", label: "Geleerde lessen" },
  { value: "tools", label: "Tools" },
  { value: "ideeen", label: "Ideeën" },
  { value: "educatie", label: "Educatie" },
];

function renderPreview(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="bg-autronis-bg border border-autronis-border rounded-xl p-4 my-4 overflow-x-auto"><code class="text-sm text-autronis-text-primary font-mono">${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code class="bg-autronis-bg border border-autronis-border rounded px-1.5 py-0.5 text-sm font-mono text-autronis-accent">$1</code>');
  html = html.replace(/^######\s(.+)$/gm, '<h6 class="text-sm font-semibold text-autronis-text-primary mt-6 mb-2">$1</h6>');
  html = html.replace(/^#####\s(.+)$/gm, '<h5 class="text-sm font-semibold text-autronis-text-primary mt-6 mb-2">$1</h5>');
  html = html.replace(/^####\s(.+)$/gm, '<h4 class="text-base font-semibold text-autronis-text-primary mt-6 mb-2">$1</h4>');
  html = html.replace(/^###\s(.+)$/gm, '<h3 class="text-lg font-semibold text-autronis-text-primary mt-8 mb-3">$1</h3>');
  html = html.replace(/^##\s(.+)$/gm, '<h2 class="text-xl font-bold text-autronis-text-primary mt-8 mb-3">$1</h2>');
  html = html.replace(/^#\s(.+)$/gm, '<h1 class="text-2xl font-bold text-autronis-text-primary mt-8 mb-4">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-autronis-text-primary">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-autronis-accent hover:text-autronis-accent-hover underline" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^[-*]\s(.+)$/gm, '<li class="text-autronis-text-secondary ml-4 pl-2">$1</li>');
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li class="text-autronis-text-secondary ml-4 pl-2 list-decimal">$1</li>');
  html = html.replace(/^---$/gm, '<hr class="border-autronis-border my-6" />');
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul class="list-disc space-y-1 my-3">$1</ul>');
  html = html.replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p class="text-autronis-text-secondary leading-relaxed my-2">$1</p>');

  return html;
}

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

export default function BewerkenWikiArtikelPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [titel, setTitel] = useState("");
  const [inhoud, setInhoud] = useState("");
  const [categorie, setCategorie] = useState("processen");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  const fetchArtikel = useCallback(async () => {
    try {
      const res = await fetch(`/api/wiki/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const a = json.artikel;
      setTitel(a.titel || "");
      setInhoud(a.inhoud || "");
      setCategorie(a.categorie || "processen");
      setTagsInput(parseTags(a.tags).join(", "));
    } catch {
      addToast("Kon artikel niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchArtikel();
  }, [fetchArtikel]);

  async function handleOpslaan() {
    if (!titel.trim()) {
      addToast("Titel is verplicht", "fout");
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/wiki/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel, inhoud, categorie, tags }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Onbekende fout");
      }

      addToast("Artikel bijgewerkt", "succes");
      router.push(`/wiki/${id}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon artikel niet opslaan", "fout");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
        <Breadcrumb
          items={[
            { label: "Kennisbank", href: "/wiki" },
            { label: titel || "Artikel", href: `/wiki/${id}` },
            { label: "Bewerken" },
          ]}
        />

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight">Artikel bewerken</h1>
          <button
            onClick={handleOpslaan}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>

        {/* Form fields */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-autronis-text-secondary">Titel</label>
              <input
                type="text"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="Artikeltitel..."
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Categorie</label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className={inputClasses}
              >
                {categorieOpties.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">
                Tags (komma-gescheiden)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="automatisering, make, api"
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
          <div className="flex items-center border-b border-autronis-border">
            <button
              onClick={() => setShowPreview(false)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                !showPreview
                  ? "text-autronis-accent border-autronis-accent"
                  : "text-autronis-text-secondary border-transparent hover:text-autronis-text-primary"
              }`}
            >
              <PenLine className="w-4 h-4" />
              Bewerken
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                showPreview
                  ? "text-autronis-accent border-autronis-accent"
                  : "text-autronis-text-secondary border-transparent hover:text-autronis-text-primary"
              }`}
            >
              <Eye className="w-4 h-4" />
              Voorbeeld
            </button>
          </div>

          <div className="p-6">
            {showPreview ? (
              <div className="min-h-[400px]">
                {inhoud ? (
                  <div
                    className="wiki-content"
                    dangerouslySetInnerHTML={{ __html: renderPreview(inhoud) }}
                  />
                ) : (
                  <p className="text-autronis-text-secondary/50 italic">
                    Nog geen inhoud om te tonen...
                  </p>
                )}
              </div>
            ) : (
              <textarea
                value={inhoud}
                onChange={(e) => setInhoud(e.target.value)}
                placeholder="Schrijf in Markdown..."
                rows={20}
                className="w-full bg-transparent text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/30 focus:outline-none resize-y min-h-[400px] font-mono leading-relaxed"
              />
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
