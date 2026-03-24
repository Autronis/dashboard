"use client";

import { useState } from "react";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAbonnementen,
  useCreateAbonnement,
  useUpdateAbonnement,
  useDeleteAbonnement,
  type Abonnement,
} from "@/hooks/queries/use-abonnementen";

const CATEGORIE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  tools: { label: "Tools", color: "text-blue-400", bg: "bg-blue-500/15" },
  hosting: { label: "Hosting", color: "text-cyan-400", bg: "bg-cyan-500/15" },
  ai: { label: "AI", color: "text-purple-400", bg: "bg-purple-500/15" },
  marketing: { label: "Marketing", color: "text-pink-400", bg: "bg-pink-500/15" },
  communicatie: { label: "Communicatie", color: "text-green-400", bg: "bg-green-500/15" },
  opslag: { label: "Opslag", color: "text-yellow-400", bg: "bg-yellow-500/15" },
  design: { label: "Design", color: "text-orange-400", bg: "bg-orange-500/15" },
  overig: { label: "Overig", color: "text-gray-400", bg: "bg-gray-500/15" },
};

const FREQUENTIE_LABELS: Record<string, string> = {
  maandelijks: "/maand",
  per_kwartaal: "/kwartaal",
  jaarlijks: "/jaar",
};

interface AbonnementForm {
  naam: string;
  leverancier: string;
  bedrag: string;
  frequentie: string;
  categorie: string;
  startDatum: string;
  volgendeBetaling: string;
  url: string;
  notities: string;
}

const EMPTY_FORM: AbonnementForm = {
  naam: "",
  leverancier: "",
  bedrag: "",
  frequentie: "maandelijks",
  categorie: "tools",
  startDatum: "",
  volgendeBetaling: "",
  url: "",
  notities: "",
};

export function AbonnementenTab() {
  const { addToast } = useToast();
  const { data, isLoading } = useAbonnementen();
  const createMut = useCreateAbonnement();
  const updateMut = useUpdateAbonnement();
  const deleteMut = useDeleteAbonnement();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Abonnement | null>(null);
  const [form, setForm] = useState<AbonnementForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterCategorie, setFilterCategorie] = useState<string>("alle");

  const abonnementen = data?.abonnementen ?? [];
  const totalen = data?.totalen;

  const filtered = filterCategorie === "alle"
    ? abonnementen
    : abonnementen.filter((a) => a.categorie === filterCategorie);

  // Categorieën met bedragen
  const categorieStats = abonnementen.reduce<Record<string, number>>((acc, a) => {
    const cat = a.categorie || "overig";
    const maandBedrag = a.frequentie === "maandelijks" ? a.bedrag : a.frequentie === "per_kwartaal" ? a.bedrag / 3 : a.bedrag / 12;
    acc[cat] = (acc[cat] || 0) + maandBedrag;
    return acc;
  }, {});

  function openNieuw() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: Abonnement) {
    setEditItem(item);
    setForm({
      naam: item.naam,
      leverancier: item.leverancier || "",
      bedrag: String(item.bedrag),
      frequentie: item.frequentie || "maandelijks",
      categorie: item.categorie || "tools",
      startDatum: item.startDatum || "",
      volgendeBetaling: item.volgendeBetaling || "",
      url: item.url || "",
      notities: item.notities || "",
    });
    setModalOpen(true);
  }

  async function handleOpslaan() {
    if (!form.naam.trim() || !form.bedrag) {
      addToast("Naam en bedrag zijn verplicht", "fout");
      return;
    }

    const payload = {
      naam: form.naam.trim(),
      leverancier: form.leverancier.trim() || null,
      bedrag: parseFloat(form.bedrag),
      frequentie: form.frequentie,
      categorie: form.categorie,
      startDatum: form.startDatum || null,
      volgendeBetaling: form.volgendeBetaling || null,
      url: form.url.trim() || null,
      notities: form.notities.trim() || null,
    };

    try {
      if (editItem) {
        await updateMut.mutateAsync({ id: editItem.id, ...payload });
        addToast("Abonnement bijgewerkt", "succes");
      } else {
        await createMut.mutateAsync(payload);
        addToast("Abonnement toegevoegd", "succes");
      }
      setModalOpen(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteMut.mutateAsync(deleteId);
      addToast("Abonnement verwijderd", "succes");
      setDeleteId(null);
    } catch {
      addToast("Verwijderen mislukt", "fout");
    }
  }

  const vandaag = new Date().toISOString().slice(0, 10);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <p className="text-xs text-autronis-text-secondary">Maandelijkse kosten</p>
          <p className="text-2xl font-bold text-autronis-text-primary mt-1">
            <AnimatedNumber value={totalen?.maandelijks ?? 0} format={(n) => `€${Math.round(n)}`} />
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <p className="text-xs text-autronis-text-secondary">Jaarlijkse kosten</p>
          <p className="text-2xl font-bold text-autronis-text-primary mt-1">
            <AnimatedNumber value={totalen?.jaarlijks ?? 0} format={(n) => `€${Math.round(n)}`} />
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <p className="text-xs text-autronis-text-secondary">Actieve abonnementen</p>
          <p className="text-2xl font-bold text-autronis-text-primary mt-1">
            <AnimatedNumber value={totalen?.aantal ?? 0} />
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <p className="text-xs text-autronis-text-secondary">Komende 7 dagen</p>
          <p className={cn("text-2xl font-bold mt-1", (totalen?.aankomend ?? 0) > 0 ? "text-orange-400" : "text-autronis-text-primary")}>
            <AnimatedNumber value={totalen?.aankomend ?? 0} />
          </p>
        </div>
      </div>

      {/* Categorie breakdown */}
      {Object.keys(categorieStats).length > 0 && (
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4">
          <p className="text-xs text-autronis-text-secondary mb-3">Kosten per categorie (per maand)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categorieStats)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, bedrag]) => {
                const config = CATEGORIE_CONFIG[cat] || CATEGORIE_CONFIG.overig;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategorie(filterCategorie === cat ? "alle" : cat)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                      filterCategorie === cat
                        ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                        : "border-autronis-border hover:border-autronis-accent/40"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", config.bg.replace("/15", ""))} style={{ backgroundColor: config.color.replace("text-", "").includes("400") ? undefined : undefined }} />
                    <span className={filterCategorie === cat ? "text-autronis-accent" : config.color}>{config.label}</span>
                    <span className="text-autronis-text-secondary">{formatBedrag(bedrag)}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Header + toevoegen */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-autronis-text-primary">
          {filterCategorie !== "alle" ? CATEGORIE_CONFIG[filterCategorie]?.label : "Alle abonnementen"}
          <span className="text-sm font-normal text-autronis-text-secondary ml-2">({filtered.length})</span>
        </h3>
        <button
          onClick={openNieuw}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
        >
          <Plus className="w-4 h-4" />
          Toevoegen
        </button>
      </div>

      {/* Lijst */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-8 h-8" />}
          titel="Nog geen abonnementen"
          beschrijving="Voeg je eerste abonnement toe om je vaste kosten bij te houden."
          actieLabel="Abonnement toevoegen"
          onActie={openNieuw}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((abo) => {
            const config = CATEGORIE_CONFIG[abo.categorie || "overig"] || CATEGORIE_CONFIG.overig;
            const isOverdue = abo.volgendeBetaling && abo.volgendeBetaling < vandaag;
            const isBinnenkort = abo.volgendeBetaling && !isOverdue && abo.volgendeBetaling <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
            const maandBedrag = abo.frequentie === "maandelijks" ? abo.bedrag : abo.frequentie === "per_kwartaal" ? abo.bedrag / 3 : abo.bedrag / 12;

            return (
              <div
                key={abo.id}
                className="bg-autronis-card border border-autronis-border rounded-xl p-4 hover:border-autronis-accent/30 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  {/* Categorie dot */}
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", config.bg)}>
                    <CreditCard className={cn("w-5 h-5", config.color)} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-autronis-text-primary truncate">{abo.naam}</p>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", config.bg, config.color)}>
                        {config.label}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Te laat
                        </span>
                      )}
                      {isBinnenkort && !isOverdue && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 flex items-center gap-1">
                          <CalendarClock className="w-2.5 h-2.5" />
                          Binnenkort
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-autronis-text-secondary">
                      {abo.leverancier && <span>{abo.leverancier}</span>}
                      {abo.projectNaam && <span className="text-autronis-accent">· {abo.projectNaam}</span>}
                      {abo.volgendeBetaling && (
                        <span className="tabular-nums">
                          Volgende: {new Date(abo.volgendeBetaling).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bedrag */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-autronis-text-primary tabular-nums">
                      {formatBedrag(abo.bedrag)}
                      <span className="text-xs font-normal text-autronis-text-secondary ml-0.5">
                        {FREQUENTIE_LABELS[abo.frequentie || "maandelijks"]}
                      </span>
                    </p>
                    {abo.frequentie !== "maandelijks" && (
                      <p className="text-[10px] text-autronis-text-secondary/60 tabular-nums">
                        ≈ {formatBedrag(maandBedrag)}/maand
                      </p>
                    )}
                  </div>

                  {/* Acties */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {abo.url && (
                      <a
                        href={abo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(abo)}
                      className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(abo.id)}
                      className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        titel={editItem ? "Abonnement bewerken" : "Nieuw abonnement"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Naam *" value={form.naam} onChange={(v) => setForm((f) => ({ ...f, naam: v }))} placeholder="OpenAI, Vercel, etc." />
            <FormField label="Leverancier" value={form.leverancier} onChange={(v) => setForm((f) => ({ ...f, leverancier: v }))} placeholder="Optioneel" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Bedrag *" value={form.bedrag} onChange={(v) => setForm((f) => ({ ...f, bedrag: v }))} type="number" placeholder="29.00" />
            <SelectField
              label="Frequentie"
              value={form.frequentie}
              onChange={(v) => setForm((f) => ({ ...f, frequentie: v }))}
              options={[
                { value: "maandelijks", label: "Maandelijks" },
                { value: "per_kwartaal", label: "Per kwartaal" },
                { value: "jaarlijks", label: "Jaarlijks" },
              ]}
            />
            <SelectField
              label="Categorie"
              value={form.categorie}
              onChange={(v) => setForm((f) => ({ ...f, categorie: v }))}
              options={Object.entries(CATEGORIE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Startdatum" value={form.startDatum} onChange={(v) => setForm((f) => ({ ...f, startDatum: v }))} type="date" />
            <FormField label="Volgende betaling" value={form.volgendeBetaling} onChange={(v) => setForm((f) => ({ ...f, volgendeBetaling: v }))} type="date" />
          </div>
          <FormField label="URL" value={form.url} onChange={(v) => setForm((f) => ({ ...f, url: v }))} placeholder="https://..." />
          <FormField label="Notities" value={form.notities} onChange={(v) => setForm((f) => ({ ...f, notities: v }))} placeholder="Optioneel" />

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
              Annuleren
            </button>
            <button
              onClick={handleOpslaan}
              disabled={createMut.isPending || updateMut.isPending}
              className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
            >
              {createMut.isPending || updateMut.isPending ? "Opslaan..." : editItem ? "Bijwerken" : "Toevoegen"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete bevestiging */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        titel="Abonnement verwijderen?"
        beschrijving="Dit abonnement wordt gedeactiveerd. Je kunt het later niet meer terugvinden."
        bevestigLabel="Verwijderen"
        variant="destructive"
        isLoading={deleteMut.isPending}
      />
    </div>
  );
}
