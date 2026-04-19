"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Loader2, Check, Plus, Trash2, Pencil, Calendar, Settings2, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SlimmeTaakTemplate {
  id: string; // slug (back-compat)
  dbId: number;
  slug: string;
  naam: string;
  beschrijving: string | null;
  cluster: string;
  geschatteDuur: number | null;
  prompt: string;
  velden: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: "text" | "number" | "url";
  }> | null;
  isSysteem: boolean;
  recurringDayOfWeek: number | null;
  uitvoerder: "claude" | "handmatig";
}

interface TemplateSuggestie {
  dbId: number;
  slug: string;
  naam: string;
  beschrijving: string | null;
  cluster: string;
  geschatteDuur: number | null;
  prompt: string;
  velden: Array<{ key: string; label: string }> | null;
  bron: string | null;
}

type ModalMode = "browse" | "form" | "multi-select" | "beheer" | "edit";

const CLUSTER_KLEUR: Record<string, { bg: string; text: string; border: string }> = {
  "backend-infra": { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/30" },
  "frontend": { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/30" },
  "klantcontact": { bg: "bg-pink-500/10", text: "text-pink-300", border: "border-pink-500/30" },
  "content": { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/30" },
  "admin": { bg: "bg-gray-500/10", text: "text-gray-300", border: "border-gray-500/30" },
  "research": { bg: "bg-autronis-accent/10", text: "text-autronis-accent", border: "border-autronis-accent/30" },
};

const DAG_LABELS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

// Tijdslots: 08:00 tot 17:00 in stappen van 30 minuten
const TIJD_SLOTS = Array.from({ length: 19 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const DUUR_OPTIES = [15, 30, 45, 60, 90, 120];

function getDefaultStartTijd(ingeplandVoor?: string): string {
  if (!ingeplandVoor) return "09:00";
  const nu = new Date();
  const vandaag = nu.toISOString().slice(0, 10);
  if (ingeplandVoor !== vandaag) return "09:00";
  // Vandaag: rond af naar volgende 30-min slot
  const minuten = nu.getHours() * 60 + nu.getMinutes();
  const volgend = Math.ceil(minuten / 30) * 30;
  const h = Math.floor(volgend / 60);
  const m = volgend % 60;
  if (h >= 17) return "09:00"; // te laat, fall back
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function SlimmeTakenModal({ open, onClose, onCreated, ingeplandVoor, preSelectedSlug }: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** ISO datum (YYYY-MM-DD). Als gezet wordt de taak direct gepland op
   *  09:00 van die dag. Gebruikt vanuit /agenda "Slimme taak" knop. */
  ingeplandVoor?: string;
  /** Als gezet, springt de modal direct naar form mode voor deze template.
   *  Gebruikt vanuit /agenda sidebar wanneer een specifieke template
   *  wordt aangeklikt. */
  preSelectedSlug?: string;
}) {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<SlimmeTaakTemplate[]>([]);
  const [persistedSuggesties, setPersistedSuggesties] = useState<TemplateSuggestie[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ModalMode>("browse");
  const [selected, setSelected] = useState<SlimmeTaakTemplate | null>(null);
  const [veldWaarden, setVeldWaarden] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Planning controls (alleen relevant als ingeplandVoor is gezet)
  const [startTijd, setStartTijd] = useState(() => getDefaultStartTijd(ingeplandVoor));
  const [duur, setDuur] = useState<number>(15); // wordt overschreven bij template selectie

  // AI analyse + stappenplan state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ toelichting: string; stappen: string[] } | null>(null);

  // Multi-select state: set van geselecteerde slugs + hun velden
  const [bulkSlugs, setBulkSlugs] = useState<Set<string>>(new Set());
  const [bulkVelden, setBulkVelden] = useState<Record<string, Record<string, string>>>({});

  // AI suggesties state — gegenereerde template ideeën van Claude
  type SuggestedTemplate = {
    naam: string;
    beschrijving: string;
    cluster: string;
    geschatteDuur: number;
    prompt: string;
    velden?: Array<{ key: string; label: string }>;
  };
  const [suggesties, setSuggesties] = useState<SuggestedTemplate[]>([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  // Template form state (aanmaken / bewerken)
  const [formData, setFormData] = useState<{
    naam: string;
    beschrijving: string;
    cluster: string;
    geschatteDuur: number;
    prompt: string;
    velden: Array<{ key: string; label: string; placeholder?: string }>;
    recurringDayOfWeek: number | null;
    uitvoerder: "claude" | "handmatig";
  }>({
    naam: "",
    beschrijving: "",
    cluster: "research",
    geschatteDuur: 15,
    prompt: "",
    velden: [],
    recurringDayOfWeek: null,
    uitvoerder: "claude",
  });

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/taken/slim");
      const data = await res.json();
      setTemplates(data.templates ?? []);
      setPersistedSuggesties(data.suggesties ?? []);
    } catch {
      addToast("Kon templates niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (!open) return;
    loadTemplates().then(() => {
      // Als preSelectedSlug is meegegeven, auto-select die template
      if (preSelectedSlug) {
        // templates state is nog niet geüpdate op dit punt,
        // dus we doen de lookup in de volgende tick
        setTimeout(() => {
          setTemplates((prev) => {
            const match = prev.find((t) => t.slug === preSelectedSlug);
            if (match) {
              setSelected(match);
              setVeldWaarden({});
              setDuur(match.geschatteDuur ?? 15);
              setMode("form");
            }
            return prev;
          });
        }, 0);
      }
    });
  }, [open, loadTemplates, preSelectedSlug]);

  useEffect(() => {
    if (!open) {
      setMode("browse");
      setSelected(null);
      setVeldWaarden({});
      setBulkSlugs(new Set());
      setBulkVelden({});
      setStartTijd(getDefaultStartTijd(ingeplandVoor));
      setDuur(15);
      setAiResult(null);
      setAiLoading(false);
      setFormData({
        naam: "",
        beschrijving: "",
        cluster: "research",
        geschatteDuur: 15,
        prompt: "",
        velden: [],
        recurringDayOfWeek: null,
        uitvoerder: "claude",
      });
    }
  }, [open, ingeplandVoor]);

  // Auto-fetch AI analyse wanneer een template geselecteerd wordt (form mode)
  useEffect(() => {
    if (mode !== "form" || !selected) return;
    setAiResult(null);
    setAiLoading(true);
    const controller = new AbortController();
    fetch("/api/agenda/taken/schat-duur", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titel: selected.naam,
        omschrijving: selected.prompt,
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setAiResult({ toelichting: data.toelichting, stappen: data.stappen ?? [] });
          // Update duur als AI een betere schatting geeft
          if (data.geschatteDuur && data.geschatteDuur !== duur) {
            setDuur(data.geschatteDuur);
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setAiLoading(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAiLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selected?.slug]);

  async function handleSingleSubmit() {
    if (!selected) return;
    // Bij quick-plan (ingeplandVoor) zijn velden optioneel
    if (!ingeplandVoor && selected.velden) {
      for (const veld of selected.velden) {
        if (!veldWaarden[veld.key]?.trim()) {
          addToast(`${veld.label} is verplicht`, "fout");
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/taken/slim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.slug,
          velden: veldWaarden,
          ingeplandVoor: ingeplandVoor ?? undefined,
          startTijd: ingeplandVoor ? startTijd : undefined,
          duur: ingeplandVoor ? duur : undefined,
          stappen: aiResult?.stappen,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Aanmaken mislukt");
      const suffix = ingeplandVoor ? ` en gepland om ${startTijd}` : "";
      addToast(`"${data.taak.titel}" toegevoegd${suffix}`, "succes");
      onCreated?.();
      // Blijf in de modal, ga terug naar browse
      setSelected(null);
      setVeldWaarden({});
      setAiResult(null);
      setMode("browse");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Aanmaken mislukt", "fout");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkSubmit() {
    if (bulkSlugs.size === 0) {
      addToast("Selecteer minstens één taak", "fout");
      return;
    }
    // Validatie: check of alle templates met velden gevuld zijn
    for (const slug of bulkSlugs) {
      const template = templates.find((t) => t.slug === slug);
      if (!template) continue;
      if (template.velden) {
        for (const veld of template.velden) {
          if (!bulkVelden[slug]?.[veld.key]?.trim()) {
            addToast(`${template.naam}: "${veld.label}" is verplicht`, "fout");
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/taken/slim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: Array.from(bulkSlugs).map((slug) => ({
            templateId: slug,
            velden: bulkVelden[slug] ?? {},
          })),
          ingeplandVoor: ingeplandVoor ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Bulk aanmaken mislukt");
      const n = data.aangemaakt?.length ?? 0;
      const suffix = ingeplandVoor ? " en gepland in de agenda" : "";
      addToast(`${n} taken toegevoegd${suffix}`, "succes");
      if (data.fouten && data.fouten.length > 0) {
        addToast(`${data.fouten.length} fouten: ${data.fouten[0]}`, "fout");
      }
      onCreated?.();
      setBulkSlugs(new Set());
      setBulkVelden({});
      setMode("browse");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Bulk mislukt", "fout");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFormSubmit(isEdit: boolean) {
    if (!formData.naam.trim()) {
      addToast("Naam is verplicht", "fout");
      return;
    }
    if (formData.uitvoerder === "claude" && !formData.prompt.trim()) {
      addToast("Prompt is verplicht voor Claude templates", "fout");
      return;
    }
    setSubmitting(true);
    try {
      const url = isEdit && selected
        ? `/api/taken/slim/templates/${selected.dbId}`
        : "/api/taken/slim/templates";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: formData.naam,
          beschrijving: formData.beschrijving,
          cluster: formData.cluster,
          geschatteDuur: formData.geschatteDuur,
          prompt: formData.prompt,
          velden: formData.velden,
          recurringDayOfWeek: formData.recurringDayOfWeek,
          uitvoerder: formData.uitvoerder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Opslaan mislukt");
      addToast(isEdit ? "Template bijgewerkt" : "Template aangemaakt", "succes");
      await loadTemplates();
      setMode("beheer");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(template: SlimmeTaakTemplate) {
    const label = template.isSysteem ? "deactiveren" : "verwijderen";
    if (!window.confirm(`Template "${template.naam}" ${label}?`)) return;
    try {
      const res = await fetch(`/api/taken/slim/templates/${template.dbId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon niet verwijderen");
      addToast(`Template ${label === "verwijderen" ? "verwijderd" : "gedeactiveerd"}`, "succes");
      await loadTemplates();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Verwijderen mislukt", "fout");
    }
  }

  async function handleGenereerSuggesties() {
    setSuggLoading(true);
    setSuggesties([]);
    try {
      const res = await fetch("/api/taken/slim/templates/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aantal: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Genereren mislukt");
      setSuggesties(data.suggesties ?? []);
      if ((data.suggesties ?? []).length === 0) {
        addToast("Claude returnde geen suggesties", "fout");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Genereren mislukt", "fout");
    } finally {
      setSuggLoading(false);
    }
  }

  async function handleSaveSuggestie(idx: number) {
    const s = suggesties[idx];
    if (!s) return;
    setSavingIdx(idx);
    try {
      const res = await fetch("/api/taken/slim/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: s.naam,
          beschrijving: s.beschrijving,
          cluster: s.cluster,
          geschatteDuur: s.geschatteDuur,
          prompt: s.prompt,
          velden: s.velden ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Opslaan mislukt");
      addToast(`"${s.naam}" toegevoegd`, "succes");
      setSuggesties((curr) => curr.filter((_, i) => i !== idx));
      await loadTemplates();
      window.dispatchEvent(new CustomEvent("autronis:slimme-templates-updated"));
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    } finally {
      setSavingIdx(null);
    }
  }

  async function handleAcceptSuggestie(dbId: number) {
    try {
      const res = await fetch(`/api/taken/slim/templates/${dbId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActief: 1 }),
      });
      if (!res.ok) throw new Error("Accepteren mislukt");
      addToast("Template toegevoegd", "succes");
      setPersistedSuggesties((curr) => curr.filter((s) => s.dbId !== dbId));
      await loadTemplates();
      // Triggert refetch in andere componenten (bv. agenda right panel)
      window.dispatchEvent(new CustomEvent("autronis:slimme-templates-updated"));
      // Genereer 1 nieuwe suggestie ter vervanging (fire-and-forget)
      fetch("/api/taken/slim/templates/suggest-and-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aantal: 1, bron: "refill" }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.opgeslagen > 0) loadTemplates();
        })
        .catch(() => {});
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout", "fout");
    }
  }

  async function handleDismissSuggestie(dbId: number) {
    try {
      const res = await fetch(`/api/taken/slim/templates/${dbId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      setPersistedSuggesties((curr) => curr.filter((s) => s.dbId !== dbId));
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout", "fout");
    }
  }

  function startEdit(template: SlimmeTaakTemplate) {
    setSelected(template);
    setFormData({
      naam: template.naam,
      beschrijving: template.beschrijving ?? "",
      cluster: template.cluster,
      geschatteDuur: template.geschatteDuur ?? 15,
      prompt: template.prompt,
      velden: template.velden ?? [],
      recurringDayOfWeek: template.recurringDayOfWeek,
      uitvoerder: template.uitvoerder ?? "claude",
    });
    setMode("edit");
  }

  function toggleBulkSelect(slug: string) {
    setBulkSlugs((curr) => {
      const next = new Set(curr);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function setBulkVeld(slug: string, key: string, value: string) {
    setBulkVelden((curr) => ({
      ...curr,
      [slug]: { ...(curr[slug] ?? {}), [key]: value },
    }));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="w-full max-w-3xl bg-autronis-card border border-autronis-border rounded-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-autronis-border">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-autronis-accent/15 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-autronis-accent" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-autronis-text-primary">Slimme taken</h2>
                    <p className="text-xs text-autronis-text-secondary">
                      {mode === "browse" && "Kies een taak die Claude voor je kan doen"}
                      {mode === "multi-select" && `${bulkSlugs.size} geselecteerd — bulk toevoegen`}
                      {mode === "form" && "Vul de velden in om aan te maken"}
                      {mode === "beheer" && "Beheer je templates"}
                      {mode === "edit" && "Bewerk template"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mode === "browse" && (
                    <>
                      <button
                        onClick={() => setMode("multi-select")}
                        className="text-[11px] text-autronis-accent hover:text-autronis-accent-hover font-medium px-2 py-1 rounded hover:bg-autronis-accent/10 transition-colors"
                      >
                        Multi
                      </button>
                      <button
                        onClick={() => setMode("beheer")}
                        title="Beheer templates"
                        className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {ingeplandVoor && mode !== "beheer" && mode !== "edit" && (
                  <div className="mb-4 rounded-lg border border-autronis-accent/30 bg-autronis-accent/[0.06] px-3 py-2 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-autronis-accent flex-shrink-0" />
                    <span className="text-xs text-autronis-text-secondary">
                      Wordt ingepland op{" "}
                      <span className="text-autronis-accent font-semibold">
                        {new Date(ingeplandVoor).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                    </span>
                  </div>
                )}
                {loading && (
                  <div className="flex items-center justify-center py-12 text-autronis-text-secondary text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Laden...
                  </div>
                )}

                {/* BROWSE mode — suggesties + grid van templates */}
                {!loading && mode === "browse" && persistedSuggesties.length > 0 && (
                  <div className="mb-4 space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-300">
                        {persistedSuggesties.length} nieuwe suggesties
                      </span>
                      <span className="text-[10px] text-amber-400/50 ml-auto">
                        {persistedSuggesties[0]?.bron === "weekly-cron" ? "wekelijks" : persistedSuggesties[0]?.bron?.replace("project:", "") ?? ""}
                      </span>
                    </div>
                    {persistedSuggesties.map((s) => {
                      const cfg = CLUSTER_KLEUR[s.cluster] ?? CLUSTER_KLEUR.admin;
                      return (
                        <div
                          key={s.dbId}
                          className="rounded-lg border border-autronis-border/60 bg-autronis-bg/40 p-2.5 flex items-start gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-xs font-semibold text-autronis-text-primary truncate">
                                {s.naam}
                              </h4>
                              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0", cfg.bg, cfg.text, cfg.border)}>
                                {s.cluster}
                              </span>
                              <span className="text-[9px] text-autronis-text-secondary/60 tabular-nums flex-shrink-0">
                                {s.geschatteDuur}m
                              </span>
                            </div>
                            <p className="text-[11px] text-autronis-text-secondary line-clamp-2">
                              {s.beschrijving}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleAcceptSuggestie(s.dbId)}
                              className="p-1.5 rounded text-amber-400 hover:bg-amber-500/15 transition-colors"
                              title="Toevoegen"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDismissSuggestie(s.dbId)}
                              className="p-1.5 rounded text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Verwerpen"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!loading && mode === "browse" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {templates.map((t) => {
                      const cfg = CLUSTER_KLEUR[t.cluster] ?? CLUSTER_KLEUR.admin;
                      return (
                        <button
                          key={t.slug}
                          onClick={() => {
                            setSelected(t);
                            setDuur(t.geschatteDuur ?? 15);
                            setMode("form");
                          }}
                          className="text-left rounded-xl border border-autronis-border bg-autronis-bg/30 p-4 hover:border-autronis-accent/40 hover:bg-autronis-accent/[0.03] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-autronis-text-primary leading-tight">
                              {t.naam}
                            </h3>
                            <span
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0",
                                cfg.bg,
                                cfg.text,
                                cfg.border
                              )}
                            >
                              {t.cluster}
                            </span>
                          </div>
                          <p className="text-xs text-autronis-text-secondary mb-2 line-clamp-2">
                            {t.beschrijving}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-autronis-text-secondary/60">
                            <span>{t.geschatteDuur} min</span>
                            {t.velden && t.velden.length > 0 && (
                              <span>· {t.velden.length} veld(en)</span>
                            )}
                            {t.recurringDayOfWeek !== null && (
                              <span className="text-autronis-accent">· wekelijks {DAG_LABELS[t.recurringDayOfWeek]}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* MULTI-SELECT mode */}
                {!loading && mode === "multi-select" && (
                  <div className="space-y-3">
                    {templates.map((t) => {
                      const cfg = CLUSTER_KLEUR[t.cluster] ?? CLUSTER_KLEUR.admin;
                      const isSelected = bulkSlugs.has(t.slug);
                      return (
                        <div
                          key={t.slug}
                          className={cn(
                            "rounded-xl border p-4 transition-colors cursor-pointer",
                            isSelected
                              ? "border-autronis-accent/60 bg-autronis-accent/[0.08]"
                              : "border-autronis-border bg-autronis-bg/30 hover:border-autronis-accent/30"
                          )}
                          onClick={() => toggleBulkSelect(t.slug)}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex-shrink-0 w-4 h-4 rounded border-2 mt-0.5 flex items-center justify-center transition-all",
                                isSelected
                                  ? "bg-autronis-accent border-autronis-accent"
                                  : "border-autronis-text-secondary/60"
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3 text-autronis-bg" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-semibold text-autronis-text-primary">{t.naam}</h3>
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", cfg.bg, cfg.text, cfg.border)}>
                                  {t.cluster}
                                </span>
                              </div>
                              <p className="text-xs text-autronis-text-secondary">{t.beschrijving}</p>
                              {isSelected && t.velden && t.velden.length > 0 && (
                                <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                  {t.velden.map((veld) => (
                                    <input
                                      key={veld.key}
                                      type={veld.type ?? "text"}
                                      value={bulkVelden[t.slug]?.[veld.key] ?? ""}
                                      onChange={(e) => setBulkVeld(t.slug, veld.key, e.target.value)}
                                      placeholder={`${veld.label}${veld.placeholder ? ` — ${veld.placeholder}` : ""}`}
                                      className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1.5 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* FORM mode — single template invullen */}
                {!loading && mode === "form" && selected && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-autronis-border bg-autronis-bg/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-autronis-text-primary">{selected.naam}</h3>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                          CLUSTER_KLEUR[selected.cluster]?.bg,
                          CLUSTER_KLEUR[selected.cluster]?.text,
                          CLUSTER_KLEUR[selected.cluster]?.border
                        )}>
                          {selected.cluster}
                        </span>
                      </div>
                      <p className="text-xs text-autronis-text-secondary">{selected.beschrijving}</p>
                    </div>

                    {/* Starttijd + duur — alleen als ingeplandVoor is gezet */}
                    {ingeplandVoor && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">
                            <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                            Starttijd
                          </label>
                          <select
                            value={startTijd}
                            onChange={(e) => setStartTijd(e.target.value)}
                            className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                          >
                            {TIJD_SLOTS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">
                            Duur
                          </label>
                          <select
                            value={duur}
                            onChange={(e) => setDuur(parseInt(e.target.value))}
                            className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                          >
                            {DUUR_OPTIES.map((d) => (
                              <option key={d} value={d}>
                                {d >= 60 ? `${Math.floor(d / 60)}u${d % 60 ? ` ${d % 60}m` : ""}` : `${d} min`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {selected.velden && selected.velden.length > 0 && (
                      <div className="space-y-3">
                        {selected.velden.map((veld) => (
                          <div key={veld.key}>
                            <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">
                              {veld.label}
                              {ingeplandVoor && (
                                <span className="text-autronis-text-secondary/40 font-normal ml-1">(optioneel)</span>
                              )}
                            </label>
                            <input
                              type={veld.type ?? "text"}
                              value={veldWaarden[veld.key] ?? ""}
                              onChange={(e) => setVeldWaarden({ ...veldWaarden, [veld.key]: e.target.value })}
                              placeholder={veld.placeholder}
                              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI Stappenplan */}
                    {(aiLoading || (aiResult?.stappen && aiResult.stappen.length > 0)) && (
                      <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          {aiLoading ? (
                            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          )}
                          <span className="text-xs font-semibold text-purple-300">
                            {aiLoading ? "Analyse bezig..." : "Stappenplan"}
                          </span>
                          {aiResult?.toelichting && !aiLoading && (
                            <span className="text-[10px] text-purple-400/60 ml-auto">{aiResult.toelichting}</span>
                          )}
                        </div>
                        {aiResult?.stappen && aiResult.stappen.length > 0 && (
                          <ol className="space-y-1.5 ml-0.5">
                            {aiResult.stappen.map((stap, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="text-xs text-purple-200/80 leading-relaxed">{stap}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}

                    <div className="text-[11px] text-autronis-text-secondary/60 italic">
                      De taak wordt als &apos;vrij&apos; aangemaakt zodat jij of Syb &apos;m kan oppakken.
                    </div>
                  </div>
                )}

                {/* BEHEER mode — lijst met edit/delete per template */}
                {!loading && mode === "beheer" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelected(null);
                          setFormData({
                            naam: "",
                            beschrijving: "",
                            cluster: "research",
                            geschatteDuur: 15,
                            prompt: "",
                            velden: [],
                            recurringDayOfWeek: null,
                            uitvoerder: "claude",
                          });
                          setMode("edit");
                        }}
                        className="flex-1 rounded-xl border border-dashed border-autronis-accent/40 bg-autronis-accent/[0.03] p-3 flex items-center justify-center gap-2 text-xs font-medium text-autronis-accent hover:bg-autronis-accent/[0.08] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Nieuwe template
                      </button>
                      <button
                        onClick={handleGenereerSuggesties}
                        disabled={suggLoading}
                        className="flex-1 rounded-xl border border-autronis-accent/40 bg-autronis-accent/10 p-3 flex items-center justify-center gap-2 text-xs font-medium text-autronis-accent hover:bg-autronis-accent/20 transition-colors disabled:opacity-60"
                      >
                        {suggLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        AI genereer 5 ideeën
                      </button>
                    </div>

                    {/* AI suggesties lijst — verschijnt na klik op "AI genereer" */}
                    {suggesties.length > 0 && (
                      <div className="space-y-2 rounded-xl border border-autronis-accent/30 bg-autronis-accent/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-autronis-accent" />
                          <span className="text-xs font-semibold text-autronis-accent">
                            {suggesties.length} suggesties — kies wat je wil bewaren
                          </span>
                        </div>
                        {suggesties.map((s, idx) => {
                          const cfg = CLUSTER_KLEUR[s.cluster] ?? CLUSTER_KLEUR.admin;
                          return (
                            <div
                              key={idx}
                              className="rounded-lg border border-autronis-border/60 bg-autronis-bg/40 p-2.5 flex items-start gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <h4 className="text-xs font-semibold text-autronis-text-primary truncate">
                                    {s.naam}
                                  </h4>
                                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0", cfg.bg, cfg.text, cfg.border)}>
                                    {s.cluster}
                                  </span>
                                  <span className="text-[9px] text-autronis-text-secondary/60 tabular-nums flex-shrink-0">
                                    {s.geschatteDuur}m
                                  </span>
                                </div>
                                <p className="text-[11px] text-autronis-text-secondary line-clamp-2">
                                  {s.beschrijving}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleSaveSuggestie(idx)}
                                  disabled={savingIdx === idx}
                                  className="p-1.5 rounded text-autronis-accent hover:bg-autronis-accent/15 transition-colors disabled:opacity-60"
                                  title="Toevoegen"
                                >
                                  {savingIdx === idx ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => setSuggesties((curr) => curr.filter((_, i) => i !== idx))}
                                  className="p-1.5 rounded text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Verwerpen"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {templates.map((t) => {
                      const cfg = CLUSTER_KLEUR[t.cluster] ?? CLUSTER_KLEUR.admin;
                      return (
                        <div
                          key={t.slug}
                          className="rounded-xl border border-autronis-border bg-autronis-bg/30 p-3 flex items-start gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-autronis-text-primary truncate">{t.naam}</h3>
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0", cfg.bg, cfg.text, cfg.border)}>
                                {t.cluster}
                              </span>
                              {t.isSysteem && (
                                <span className="text-[10px] text-autronis-text-secondary/60 flex-shrink-0">systeem</span>
                              )}
                              {t.recurringDayOfWeek !== null && (
                                <span className="text-[10px] text-autronis-accent flex-shrink-0 flex items-center gap-0.5">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {DAG_LABELS[t.recurringDayOfWeek]}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-autronis-text-secondary truncate">{t.beschrijving}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => startEdit(t)}
                              className="p-1.5 rounded text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors"
                              title="Bewerken"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              className="p-1.5 rounded text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title={t.isSysteem ? "Deactiveren" : "Verwijderen"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* EDIT mode — template form (aanmaken of bewerken) */}
                {!loading && mode === "edit" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Uitvoerder</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, uitvoerder: "claude" })}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                            formData.uitvoerder === "claude"
                              ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                              : "bg-autronis-bg text-autronis-text-secondary border-autronis-border hover:border-autronis-text-secondary/40"
                          }`}
                        >
                          Claude (research/analyse)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, uitvoerder: "handmatig" })}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                            formData.uitvoerder === "handmatig"
                              ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                              : "bg-autronis-bg text-autronis-text-secondary border-autronis-border hover:border-autronis-text-secondary/40"
                          }`}
                        >
                          Handmatig (Sem zelf)
                        </button>
                      </div>
                      <p className="text-[10px] text-autronis-text-secondary/60 mt-1">
                        Handmatige taken (LinkedIn posts, cold outreach, demo calls) worden niet door Claude uitgevoerd.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Naam *</label>
                      <input
                        type="text"
                        value={formData.naam}
                        onChange={(e) => setFormData({ ...formData, naam: e.target.value })}
                        placeholder="bv. Nieuwsbrief sturen aan mailing list"
                        className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                      />
                      <p className="text-[10px] text-autronis-text-secondary/60 mt-1">
                        Gebruik {"{veld}"} voor placeholders (bv. &quot;10 bedrijven zoeken in {"{branche}"}&quot;)
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Beschrijving</label>
                      <input
                        type="text"
                        value={formData.beschrijving}
                        onChange={(e) => setFormData({ ...formData, beschrijving: e.target.value })}
                        className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Cluster *</label>
                        <select
                          value={formData.cluster}
                          onChange={(e) => setFormData({ ...formData, cluster: e.target.value })}
                          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                        >
                          {Object.keys(CLUSTER_KLEUR).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Duur (min)</label>
                        <input
                          type="number"
                          min={5}
                          max={120}
                          value={formData.geschatteDuur}
                          onChange={(e) => setFormData({ ...formData, geschatteDuur: parseInt(e.target.value || "15") })}
                          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">
                        {formData.uitvoerder === "claude" ? "Prompt *" : "Instructies / checklist (optioneel)"}
                      </label>
                      <textarea
                        value={formData.prompt}
                        onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                        rows={8}
                        placeholder={
                          formData.uitvoerder === "claude"
                            ? "De letterlijke opdracht voor Claude. Gebruik {veld} placeholders die de UI invult."
                            : "Optionele checklist of context voor jezelf. Bv. stappen, doelen, hoe het eruit moet zien."
                        }
                        className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 resize-none"
                      />
                    </div>

                    {/* Velden editor */}
                    <div>
                      <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Invoervelden</label>
                      <div className="space-y-2">
                        {formData.velden.map((veld, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={veld.key}
                              onChange={(e) => {
                                const next = [...formData.velden];
                                next[idx] = { ...veld, key: e.target.value };
                                setFormData({ ...formData, velden: next });
                              }}
                              placeholder="key"
                              className="w-24 bg-autronis-bg border border-autronis-border rounded px-2 py-1 text-xs text-autronis-text-primary"
                            />
                            <input
                              type="text"
                              value={veld.label}
                              onChange={(e) => {
                                const next = [...formData.velden];
                                next[idx] = { ...veld, label: e.target.value };
                                setFormData({ ...formData, velden: next });
                              }}
                              placeholder="Label"
                              className="flex-1 bg-autronis-bg border border-autronis-border rounded px-2 py-1 text-xs text-autronis-text-primary"
                            />
                            <button
                              onClick={() => setFormData({ ...formData, velden: formData.velden.filter((_, i) => i !== idx) })}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setFormData({ ...formData, velden: [...formData.velden, { key: "", label: "" }] })}
                          className="text-[11px] text-autronis-accent hover:text-autronis-accent-hover"
                        >
                          + Veld toevoegen
                        </button>
                      </div>
                    </div>

                    {/* Recurring */}
                    <div>
                      <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">
                        Wekelijks terugkerend op
                      </label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setFormData({ ...formData, recurringDayOfWeek: null })}
                          className={cn(
                            "px-3 py-1 rounded text-xs font-medium transition-colors",
                            formData.recurringDayOfWeek === null
                              ? "bg-autronis-bg border border-autronis-border text-autronis-text-primary"
                              : "text-autronis-text-secondary hover:text-autronis-text-primary"
                          )}
                        >
                          nooit
                        </button>
                        {DAG_LABELS.map((label, i) => (
                          <button
                            key={i}
                            onClick={() => setFormData({ ...formData, recurringDayOfWeek: i })}
                            className={cn(
                              "w-9 h-7 rounded text-xs font-medium transition-colors",
                              formData.recurringDayOfWeek === i
                                ? "bg-autronis-accent text-autronis-bg"
                                : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-autronis-text-secondary/60 mt-1">
                        Als ingesteld maakt de cron elke week op deze dag automatisch een taak aan
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer — context-dependent */}
              <div className="px-6 py-4 border-t border-autronis-border flex items-center justify-between gap-3">
                {mode === "browse" && (
                  <>
                    <div className="text-[11px] text-autronis-text-secondary/60">
                      {templates.length} templates beschikbaar
                    </div>
                    <div />
                  </>
                )}

                {mode === "form" && selected && (
                  <>
                    <button
                      onClick={() => { setSelected(null); setMode("browse"); }}
                      className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      ← Terug
                    </button>
                    <button
                      onClick={handleSingleSubmit}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Aanmaken
                    </button>
                  </>
                )}

                {mode === "multi-select" && (
                  <>
                    <button
                      onClick={() => { setBulkSlugs(new Set()); setBulkVelden({}); setMode("browse"); }}
                      className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      ← Terug
                    </button>
                    <button
                      onClick={handleBulkSubmit}
                      disabled={submitting || bulkSlugs.size === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Voeg {bulkSlugs.size} taken toe
                    </button>
                  </>
                )}

                {mode === "beheer" && (
                  <>
                    <button
                      onClick={() => setMode("browse")}
                      className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      ← Terug naar overzicht
                    </button>
                    <div />
                  </>
                )}

                {mode === "edit" && (
                  <>
                    <button
                      onClick={() => setMode("beheer")}
                      className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      Annuleer
                    </button>
                    <button
                      onClick={() => handleFormSubmit(!!selected)}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {selected ? "Bijwerken" : "Aanmaken"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
