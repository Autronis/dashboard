"use client";

import { useState, useCallback, useRef } from "react";
import {
  Shield,
  Lightbulb,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Check,
  X,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useScreenTimeRegels,
  useScreenTimeRegelMutatie,
  useScreenTimeSuggesties,
  useScreenTimeSuggestieMutatie,
  useCategoriseer,
} from "@/hooks/queries/use-screen-time";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScreenTimeRegel, ScreenTimeCategorie } from "@/types";
import {
  CATEGORIE_LABELS,
  CategorieBadge,
  TypeIcon,
} from "./constants";

// ============ RULES SECTION ============

function RegelsSection() {
  const { addToast } = useToast();
  const { data: regels, isLoading } = useScreenTimeRegels();
  const { create, update, remove } = useScreenTimeRegelMutatie();
  const categoriseer = useCategoriseer();

  const [toonForm, setToonForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formType, setFormType] = useState<ScreenTimeRegel["type"]>("app");
  const [formPatroon, setFormPatroon] = useState("");
  const [formCategorie, setFormCategorie] = useState<ScreenTimeCategorie>("development");
  const formRef = useRef<HTMLDivElement>(null);

  const resetForm = useCallback(() => {
    setToonForm(false);
    setEditId(null);
    setFormType("app");
    setFormPatroon("");
    setFormCategorie("development");
  }, []);

  const handleOpslaan = useCallback(async () => {
    if (!formPatroon.trim()) return;
    try {
      if (editId !== null) {
        await update.mutateAsync({
          id: editId,
          body: { type: formType, patroon: formPatroon.trim(), categorie: formCategorie },
        });
        addToast("Regel bijgewerkt", "succes");
      } else {
        await create.mutateAsync({
          type: formType,
          patroon: formPatroon.trim(),
          categorie: formCategorie,
        });
        addToast("Regel aangemaakt", "succes");
      }
      resetForm();
    } catch {
      addToast("Kon regel niet opslaan", "fout");
    }
  }, [formPatroon, formType, formCategorie, editId, create, update, addToast, resetForm]);

  const handleVerwijder = useCallback(
    async (id: number) => {
      try {
        await remove.mutateAsync(id);
        addToast("Regel verwijderd", "succes");
      } catch {
        addToast("Kon regel niet verwijderen", "fout");
      }
    },
    [remove, addToast]
  );

  const handleBewerk = useCallback((regel: ScreenTimeRegel) => {
    setEditId(regel.id);
    setFormType(regel.type);
    setFormPatroon(regel.patroon);
    setFormCategorie(regel.categorie);
    setToonForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  const handleCategoriseer = useCallback(async () => {
    try {
      await categoriseer.mutateAsync({ entryIds: [] });
      addToast("AI categorisering gestart", "succes");
    } catch {
      addToast("Kon niet categoriseren", "fout");
    }
  }, [categoriseer, addToast]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { resetForm(); setToonForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl font-medium text-sm hover:bg-autronis-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuwe regel
        </button>
        <button
          onClick={handleCategoriseer}
          disabled={categoriseer.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-autronis-card border border-autronis-border text-autronis-text-primary rounded-xl font-medium text-sm hover:border-autronis-accent/40 transition-colors disabled:opacity-50"
        >
          {categoriseer.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-yellow-400" />
          )}
          AI Categoriseren
        </button>
      </div>

      {/* Inline form */}
      {toonForm && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-autronis-text-primary">
            {editId !== null ? "Regel bewerken" : "Nieuwe regel"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-autronis-text-secondary mb-1.5">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ScreenTimeRegel["type"])}
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
              >
                <option value="app">App</option>
                <option value="url">URL</option>
                <option value="venstertitel">Venster</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-autronis-text-secondary mb-1.5">Patroon</label>
              <input
                type="text"
                value={formPatroon}
                onChange={(e) => setFormPatroon(e.target.value)}
                placeholder="bijv. VS Code, *slack*"
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-autronis-text-secondary mb-1.5">Categorie</label>
              <select
                value={formCategorie}
                onChange={(e) => setFormCategorie(e.target.value as ScreenTimeCategorie)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
              >
                {Object.entries(CATEGORIE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpslaan}
              disabled={!formPatroon.trim() || create.isPending || update.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-autronis-accent text-autronis-bg rounded-lg font-medium text-sm hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Opslaan
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 text-autronis-text-secondary hover:text-autronis-text-primary text-sm transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {!regels?.length && !toonForm ? (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-autronis-text-secondary mx-auto mb-4 opacity-40" />
          <p className="text-autronis-text-secondary text-lg">Nog geen regels ingesteld</p>
          <p className="text-autronis-text-secondary text-sm mt-1 opacity-60">
            Regels koppelen apps en websites automatisch aan categorieën.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {regels?.map((regel) => (
            <div
              key={regel.id}
              className="bg-autronis-card border border-autronis-border rounded-xl p-4 flex items-center gap-4 hover:border-autronis-accent/20 transition-colors card-glow"
            >
              <TypeIcon type={regel.type} />
              <span className="text-sm font-mono text-autronis-text-primary flex-1 truncate">
                {regel.patroon}
              </span>
              <CategorieBadge categorie={regel.categorie} />
              {(regel.projectNaam || regel.klantNaam) && (
                <span className="text-xs text-autronis-text-secondary truncate max-w-32">
                  {regel.projectNaam ?? regel.klantNaam}
                </span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleBewerk(regel)}
                  className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors rounded-lg hover:bg-autronis-accent/10"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleVerwijder(regel.id)}
                  className="p-1.5 text-autronis-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ SUGGESTIONS SECTION ============

function SuggestiesSection() {
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"openstaand" | "goedgekeurd" | "afgewezen">(
    "openstaand"
  );
  const { data: suggesties, isLoading } = useScreenTimeSuggesties(statusFilter);
  const mutatie = useScreenTimeSuggestieMutatie();

  const handleActie = useCallback(
    async (id: number, status: "goedgekeurd" | "afgewezen") => {
      try {
        await mutatie.mutateAsync({ id, status });
        addToast(status === "goedgekeurd" ? "Suggestie goedgekeurd" : "Suggestie afgewezen", "succes");
      } catch {
        addToast("Kon suggestie niet bijwerken", "fout");
      }
    },
    [mutatie, addToast]
  );

  const handleAllesGoedkeuren = useCallback(async () => {
    if (!suggesties?.length) return;
    try {
      await Promise.all(suggesties.map((s) => mutatie.mutateAsync({ id: s.id, status: "goedgekeurd" })));
      addToast(`${suggesties.length} suggesties goedgekeurd`, "succes");
    } catch {
      addToast("Kon niet alle suggesties goedkeuren", "fout");
    }
  }, [suggesties, mutatie, addToast]);

  const STATUS_TABS: { key: typeof statusFilter; label: string }[] = [
    { key: "openstaand", label: "Openstaand" },
    { key: "goedgekeurd", label: "Goedgekeurd" },
    { key: "afgewezen", label: "Afgewezen" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status filter + bulk action */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-autronis-card border border-autronis-border rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                statusFilter === t.key
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {statusFilter === "openstaand" && (suggesties?.length ?? 0) > 1 && (
          <button
            onClick={handleAllesGoedkeuren}
            disabled={mutatie.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl text-sm font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Alles goedkeuren ({suggesties?.length})
          </button>
        )}
      </div>

      {/* Suggestions list */}
      {!suggesties?.length ? (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
          <Lightbulb className="w-12 h-12 text-autronis-text-secondary mx-auto mb-4 opacity-40" />
          <p className="text-autronis-text-secondary text-lg">
            Geen {statusFilter === "openstaand" ? "openstaande" : statusFilter === "goedgekeurd" ? "goedgekeurde" : "afgewezen"} suggesties
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggesties.map((s) => (
            <div
              key={s.id}
              className="bg-autronis-card border border-autronis-border rounded-xl p-5 flex items-start gap-4 hover:border-autronis-accent/20 transition-colors card-glow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      s.type === "categorie"
                        ? "bg-purple-500/15 text-purple-400"
                        : s.type === "tijdregistratie"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-yellow-500/15 text-yellow-400"
                    )}
                  >
                    {s.type === "categorie"
                      ? "Categorie"
                      : s.type === "tijdregistratie"
                        ? "Tijdregistratie"
                        : "Project koppeling"}
                  </span>
                  <span className="text-xs text-autronis-text-secondary tabular-nums">
                    {new Date(s.startTijd).toLocaleString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" - "}
                    {new Date(s.eindTijd).toLocaleTimeString("nl-NL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-autronis-text-primary">{s.voorstel}</p>
              </div>
              {statusFilter === "openstaand" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleActie(s.id, "goedgekeurd")}
                    disabled={mutatie.isPending}
                    className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Goedkeuren"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleActie(s.id, "afgewezen")}
                    disabled={mutatie.isPending}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Afwijzen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ COMBINED EXPORT ============

export function TabRegelsSuggesties() {
  return (
    <div className="space-y-10">
      {/* Rules section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-autronis-accent" />
          <h2 className="text-lg font-semibold text-autronis-text-primary">Categoriseerregels</h2>
        </div>
        <RegelsSection />
      </div>

      {/* Divider */}
      <div className="border-t border-autronis-border" />

      {/* Suggestions section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-autronis-text-primary">AI Suggesties</h2>
        </div>
        <SuggestiesSection />
      </div>
    </div>
  );
}
