"use client";

import { useState } from "react";
import {
  Lightbulb,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  X,
  Edit,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useIdeeen,
  useCreateIdee,
  useUpdateIdee,
  useDeleteIdee,
  useStartProject,
  useSyncBacklog,
  type Idee,
} from "@/hooks/queries/use-ideeen";

// ============ CONSTANTS ============

const statusOpties = [
  { key: "idee", label: "Idee" },
  { key: "uitgewerkt", label: "Uitgewerkt" },
  { key: "actief", label: "Actief" },
  { key: "gebouwd", label: "Gebouwd" },
] as const;

const categorieOpties = [
  { key: "saas", label: "SaaS" },
  { key: "productized_service", label: "Productized Service" },
  { key: "intern", label: "Intern" },
  { key: "dev_tools", label: "Dev Tools" },
  { key: "video", label: "Video" },
  { key: "design", label: "Design" },
  { key: "website", label: "Website" },
] as const;

const prioriteitOpties = [
  { key: "laag", label: "Laag" },
  { key: "normaal", label: "Normaal" },
  { key: "hoog", label: "Hoog" },
] as const;

const categorieBadgeKleuren: Record<string, string> = {
  saas: "bg-blue-500/15 text-blue-400",
  productized_service: "bg-purple-500/15 text-purple-400",
  intern: "bg-autronis-accent/15 text-autronis-accent",
  dev_tools: "bg-orange-500/15 text-orange-400",
  video: "bg-red-500/15 text-red-400",
  design: "bg-pink-500/15 text-pink-400",
  website: "bg-emerald-500/15 text-emerald-400",
};

const statusBadgeKleuren: Record<string, string> = {
  idee: "bg-gray-500/15 text-gray-400",
  uitgewerkt: "bg-yellow-500/15 text-yellow-400",
  actief: "bg-green-500/15 text-green-400",
  gebouwd: "bg-emerald-500/15 text-emerald-400",
};

function categorieLabel(key: string): string {
  return categorieOpties.find((c) => c.key === key)?.label || key;
}

function statusLabel(key: string): string {
  return statusOpties.find((s) => s.key === key)?.label || key;
}

function prioriteitLabel(key: string): string {
  return prioriteitOpties.find((p) => p.key === key)?.label || key;
}

// ============ MAIN PAGE ============

export default function IdeeenPage() {
  const { addToast } = useToast();

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");

  // Data
  const { data: ideeen = [], isLoading } = useIdeeen({
    status: filterStatus || undefined,
    categorie: filterCategorie || undefined,
  });

  // Mutations
  const createMutation = useCreateIdee();
  const updateMutation = useUpdateIdee();
  const deleteMutation = useDeleteIdee();
  const startProjectMutation = useStartProject();
  const syncBacklogMutation = useSyncBacklog();

  // Modal state
  const [detailIdee, setDetailIdee] = useState<Idee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editIdee, setEditIdee] = useState<Idee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [formNaam, setFormNaam] = useState("");
  const [formNummer, setFormNummer] = useState("");
  const [formCategorie, setFormCategorie] = useState("");
  const [formStatus, setFormStatus] = useState("idee");
  const [formPrioriteit, setFormPrioriteit] = useState("normaal");
  const [formOmschrijving, setFormOmschrijving] = useState("");
  const [formUitwerking, setFormUitwerking] = useState("");

  // KPIs
  const totaal = ideeen.length;
  const uitgewerkt = ideeen.filter((i) => i.status === "uitgewerkt").length;
  const actief = ideeen.filter((i) => i.status === "actief").length;
  const gebouwd = ideeen.filter((i) => i.status === "gebouwd").length;

  // ============ HANDLERS ============

  function openNieuwForm() {
    setEditIdee(null);
    setFormNaam("");
    setFormNummer("");
    setFormCategorie("");
    setFormStatus("idee");
    setFormPrioriteit("normaal");
    setFormOmschrijving("");
    setFormUitwerking("");
    setFormOpen(true);
  }

  function openEditForm(idee: Idee) {
    setEditIdee(idee);
    setFormNaam(idee.naam);
    setFormNummer(idee.nummer != null ? String(idee.nummer) : "");
    setFormCategorie(idee.categorie || "");
    setFormStatus(idee.status);
    setFormPrioriteit(idee.prioriteit);
    setFormOmschrijving(idee.omschrijving || "");
    setFormUitwerking(idee.uitwerking || "");
    setDetailIdee(null);
    setFormOpen(true);
  }

  function handleOpslaan() {
    if (!formNaam.trim()) {
      addToast("Naam is verplicht", "fout");
      return;
    }

    const body = {
      naam: formNaam.trim(),
      nummer: formNummer ? Number(formNummer) : null,
      categorie: formCategorie || null,
      status: formStatus,
      prioriteit: formPrioriteit,
      omschrijving: formOmschrijving.trim() || null,
      uitwerking: formUitwerking.trim() || null,
    };

    if (editIdee) {
      updateMutation.mutate(
        { id: editIdee.id, body },
        {
          onSuccess: () => {
            addToast("Idee bijgewerkt", "succes");
            setFormOpen(false);
          },
          onError: () => addToast("Kon idee niet bijwerken", "fout"),
        }
      );
    } else {
      createMutation.mutate(body, {
        onSuccess: () => {
          addToast("Idee aangemaakt", "succes");
          setFormOpen(false);
        },
        onError: () => addToast("Kon idee niet aanmaken", "fout"),
      });
    }
  }

  function handleDelete() {
    if (!detailIdee) return;
    deleteMutation.mutate(detailIdee.id, {
      onSuccess: () => {
        addToast("Idee verwijderd", "succes");
        setDetailIdee(null);
        setDeleteDialogOpen(false);
      },
      onError: () => addToast("Kon idee niet verwijderen", "fout"),
    });
  }

  function handleStartProject() {
    if (!detailIdee) return;
    startProjectMutation.mutate(detailIdee.id, {
      onSuccess: (data) => {
        addToast(`Project "${data.project.naam}" aangemaakt`, "succes");
        setDetailIdee(null);
      },
      onError: (err) => addToast(err.message || "Kon project niet starten", "fout"),
    });
  }

  function handleSyncBacklog() {
    syncBacklogMutation.mutate(undefined, {
      onSuccess: (data) => {
        addToast(`Sync klaar: ${data.nieuw} nieuw, ${data.bijgewerkt} bijgewerkt`, "succes");
      },
      onError: (err) => addToast(err.message || "Sync mislukt", "fout"),
    });
  }

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";
  const selectClasses =
    "bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  // ============ LOADING ============

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-autronis-text-primary">Ideeën</h1>
        <p className="text-base text-autronis-text-secondary mt-1">
          Product- en projectideeën beheren
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
              <Lightbulb className="w-5 h-5 text-autronis-accent" />
            </div>
          </div>
          <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{totaal}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Totaal ideeën</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl">
              <Edit className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-400 tabular-nums">{uitgewerkt}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Uitgewerkt</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-green-500/10 rounded-xl">
              <Rocket className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-400 tabular-nums">{actief}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Actieve projecten</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <ExternalLink className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-400 tabular-nums">{gebouwd}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Gebouwd</p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectClasses}
        >
          <option value="">Alle statussen</option>
          {statusOpties.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className={selectClasses}
        >
          <option value="">Alle categorieën</option>
          {categorieOpties.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={handleSyncBacklog}
          disabled={syncBacklogMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {syncBacklogMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sync backlog
        </button>

        <button
          onClick={openNieuwForm}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
        >
          <Plus className="w-4 h-4" />
          Nieuw idee
        </button>
      </div>

      {/* Cards grid */}
      {ideeen.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
          <p className="text-autronis-text-secondary">Geen ideeën gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ideeen.map((idee) => (
            <button
              key={idee.id}
              onClick={() => setDetailIdee(idee)}
              className="w-full text-left bg-autronis-card border border-autronis-border rounded-2xl p-6 hover:border-autronis-accent/50 transition-all card-glow group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {idee.nummer != null && (
                    <span className="text-xs text-autronis-text-secondary/60 font-mono flex-shrink-0">
                      #{idee.nummer}
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">
                    {idee.naam}
                  </h3>
                </div>
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0", statusBadgeKleuren[idee.status] || "bg-gray-500/15 text-gray-400")}>
                  {statusLabel(idee.status)}
                </span>
              </div>

              {idee.categorie && (
                <span className={cn("inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3", categorieBadgeKleuren[idee.categorie] || "bg-gray-500/15 text-gray-400")}>
                  {categorieLabel(idee.categorie)}
                </span>
              )}

              {idee.omschrijving && (
                <p className="text-sm text-autronis-text-secondary line-clamp-2">
                  {idee.omschrijving}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailIdee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {detailIdee.nummer != null && (
                    <span className="text-sm text-autronis-text-secondary font-mono">
                      #{detailIdee.nummer}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-autronis-text-primary">
                    {detailIdee.naam}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusBadgeKleuren[detailIdee.status] || "bg-gray-500/15 text-gray-400")}>
                    {statusLabel(detailIdee.status)}
                  </span>
                  {detailIdee.categorie && (
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", categorieBadgeKleuren[detailIdee.categorie] || "bg-gray-500/15 text-gray-400")}>
                      {categorieLabel(detailIdee.categorie)}
                    </span>
                  )}
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-autronis-border/50 text-autronis-text-secondary">
                    {prioriteitLabel(detailIdee.prioriteit)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailIdee(null)}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Omschrijving */}
            {detailIdee.omschrijving && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">
                  Omschrijving
                </h4>
                <p className="text-sm text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
                  {detailIdee.omschrijving}
                </p>
              </div>
            )}

            {/* Uitwerking */}
            {detailIdee.uitwerking && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">
                  Uitwerking
                </h4>
                <p className="text-sm text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
                  {detailIdee.uitwerking}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-autronis-border">
              <button
                onClick={() => openEditForm(detailIdee)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors"
              >
                <Edit className="w-4 h-4" />
                Bewerken
              </button>

              {(detailIdee.status === "idee" || detailIdee.status === "uitgewerkt") && (
                <button
                  onClick={handleStartProject}
                  disabled={startProjectMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500/15 text-green-400 hover:bg-green-500/25 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {startProjectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  Start als project
                </button>
              )}

              <div className="flex-1" />

              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-autronis-text-primary">
                {editIdee ? "Idee bewerken" : "Nieuw idee"}
              </h3>
              <button
                onClick={() => setFormOpen(false)}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Naam *</label>
                  <input
                    type="text"
                    value={formNaam}
                    onChange={(e) => setFormNaam(e.target.value)}
                    className={inputClasses}
                    placeholder="Naam van het idee"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Nummer</label>
                  <input
                    type="number"
                    value={formNummer}
                    onChange={(e) => setFormNummer(e.target.value)}
                    className={inputClasses}
                    placeholder="Optioneel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Categorie</label>
                  <select
                    value={formCategorie}
                    onChange={(e) => setFormCategorie(e.target.value)}
                    className={cn(inputClasses)}
                  >
                    <option value="">Geen</option>
                    {categorieOpties.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className={cn(inputClasses)}
                  >
                    {statusOpties.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Prioriteit</label>
                  <select
                    value={formPrioriteit}
                    onChange={(e) => setFormPrioriteit(e.target.value)}
                    className={cn(inputClasses)}
                  >
                    {prioriteitOpties.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Omschrijving</label>
                <textarea
                  value={formOmschrijving}
                  onChange={(e) => setFormOmschrijving(e.target.value)}
                  rows={3}
                  className={cn(inputClasses, "resize-none")}
                  placeholder="Korte omschrijving van het idee..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Uitwerking</label>
                <textarea
                  value={formUitwerking}
                  onChange={(e) => setFormUitwerking(e.target.value)}
                  rows={8}
                  className={cn(inputClasses, "resize-none")}
                  placeholder="Uitgebreide uitwerking van het idee..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setFormOpen(false)}
                className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleOpslaan}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Opslaan..." : editIdee ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onBevestig={handleDelete}
        titel="Idee verwijderen?"
        bericht={`Weet je zeker dat je "${detailIdee?.naam}" wilt verwijderen?`}
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </div>
  );
}
