"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Camera,
  Loader2,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useScanBon } from "@/hooks/queries/use-facturen";

interface Uitgave {
  id: number;
  omschrijving: string;
  bedrag: number;
  datum: string;
  categorie: string | null;
  leverancier: string | null;
  btwBedrag: number | null;
  btwPercentage: number | null;
  fiscaalAftrekbaar: number | null;
  bonnetjeUrl: string | null;
}

interface UitgaveForm {
  omschrijving: string;
  bedrag: string;
  datum: string;
  categorie: string;
  leverancier: string;
  btwBedrag: string;
  btwPercentage: string;
  fiscaalAftrekbaar: boolean;
  bonnetjeUrl: string;
}

const EMPTY_FORM: UitgaveForm = {
  omschrijving: "",
  bedrag: "",
  datum: new Date().toISOString().slice(0, 10),
  categorie: "overig",
  leverancier: "",
  btwBedrag: "",
  btwPercentage: "21",
  fiscaalAftrekbaar: true,
  bonnetjeUrl: "",
};

const CATEGORIE_OPTIES = [
  { waarde: "kantoor", label: "Kantoor" },
  { waarde: "hardware", label: "Hardware" },
  { waarde: "software", label: "Software" },
  { waarde: "reiskosten", label: "Reiskosten" },
  { waarde: "marketing", label: "Marketing" },
  { waarde: "onderwijs", label: "Onderwijs" },
  { waarde: "telefoon", label: "Telefoon" },
  { waarde: "verzekeringen", label: "Verzekeringen" },
  { waarde: "accountant", label: "Accountant" },
  { waarde: "overig", label: "Overig" },
];

const CATEGORIE_KLEUREN: Record<string, string> = {
  kantoor: "bg-blue-500/15 text-blue-400",
  hardware: "bg-purple-500/15 text-purple-400",
  software: "bg-cyan-500/15 text-cyan-400",
  reiskosten: "bg-orange-500/15 text-orange-400",
  marketing: "bg-pink-500/15 text-pink-400",
  onderwijs: "bg-yellow-500/15 text-yellow-400",
  telefoon: "bg-emerald-500/15 text-emerald-400",
  verzekeringen: "bg-red-500/15 text-red-400",
  accountant: "bg-slate-500/15 text-slate-400",
  overig: "bg-gray-500/15 text-gray-400",
};

const MAAND_NAMEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

export function UitgavenTab() {
  const { addToast } = useToast();
  const [uitgaven, setUitgaven] = useState<Uitgave[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUitgave, setEditUitgave] = useState<Uitgave | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<UitgaveForm>(EMPTY_FORM);

  const [maand, setMaand] = useState(new Date().getMonth() + 1);
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [categorieFilter, setCategorieFilter] = useState("alle");

  const [totaalUitgaven, setTotaalUitgaven] = useState(0);
  const [totaalAftrekbaar, setTotaalAftrekbaar] = useState(0);
  const [totaalBtw, setTotaalBtw] = useState(0);

  const scanBonMutation = useScanBon();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScanBon = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    e.target.value = "";

    scanBonMutation.mutate(file, {
      onSuccess: (data) => {
        const extracted = data.extracted;
        const parts = [
          extracted.leverancier && `${extracted.leverancier}`,
          extracted.bedrag && `\u20AC${extracted.bedrag.toFixed(2)}`,
          extracted.categorie,
        ].filter(Boolean);
        addToast(
          `Bon gescand: ${parts.join(" - ") || data.uitgave.omschrijving}`,
          "succes"
        );
        fetchData();
      },
      onError: (err) => {
        addToast(err.message, "fout");
      },
    });
  };

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        maand: maand.toString(),
        jaar: jaar.toString(),
      });
      if (categorieFilter !== "alle") {
        params.set("categorie", categorieFilter);
      }

      const res = await fetch(`/api/uitgaven?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setUitgaven(json.uitgaven);
      setTotaalUitgaven(json.totaalUitgaven);
      setTotaalAftrekbaar(json.totaalAftrekbaar);
      setTotaalBtw(json.totaalBtw);
    } catch {
      addToast("Kon uitgaven niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [maand, jaar, categorieFilter, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openNieuwModal = () => {
    setEditUitgave(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (u: Uitgave) => {
    setEditUitgave(u);
    setForm({
      omschrijving: u.omschrijving,
      bedrag: u.bedrag.toString(),
      datum: u.datum,
      categorie: u.categorie || "overig",
      leverancier: u.leverancier || "",
      btwBedrag: u.btwBedrag?.toString() || "",
      btwPercentage: (u.btwPercentage ?? 21).toString(),
      fiscaalAftrekbaar: u.fiscaalAftrekbaar !== 0,
      bonnetjeUrl: u.bonnetjeUrl || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.omschrijving.trim() || !form.bedrag || !form.datum) {
      addToast("Vul alle verplichte velden in", "fout");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        omschrijving: form.omschrijving,
        bedrag: form.bedrag,
        datum: form.datum,
        categorie: form.categorie,
        leverancier: form.leverancier || null,
        btwBedrag: form.btwBedrag || null,
        btwPercentage: form.btwPercentage || "21",
        fiscaalAftrekbaar: form.fiscaalAftrekbaar,
        bonnetjeUrl: form.bonnetjeUrl || null,
      };

      const url = editUitgave ? `/api/uitgaven/${editUitgave.id}` : "/api/uitgaven";
      const method = editUitgave ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.fout || "Onbekende fout");
      }

      addToast(editUitgave ? "Uitgave bijgewerkt" : "Uitgave toegevoegd", "succes");
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon uitgave niet opslaan", "fout");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/uitgaven/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Uitgave verwijderd", "succes");
      setDeleteDialogOpen(false);
      setDeleteId(null);
      await fetchData();
    } catch {
      addToast("Kon uitgave niet verwijderen", "fout");
    }
  };

  // Auto-calculate BTW when bedrag changes
  const handleBedragChange = (value: string) => {
    const bedrag = parseFloat(value);
    const btwPct = parseFloat(form.btwPercentage) || 21;
    if (!isNaN(bedrag) && bedrag > 0) {
      const btwBedrag = (bedrag * btwPct) / (100 + btwPct);
      setForm({
        ...form,
        bedrag: value,
        btwBedrag: btwBedrag.toFixed(2),
      });
    } else {
      setForm({ ...form, bedrag: value });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-autronis-border rounded-2xl p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="border border-autronis-border rounded-2xl p-6 card-glow bg-autronis-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-red-500/10 rounded-xl">
              <Receipt className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <AnimatedNumber
            value={totaalUitgaven}
            format={formatBedrag}
            className="text-3xl font-bold text-red-400 tabular-nums"
          />
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
            Totaal deze maand
          </p>
        </div>

        <div className="border border-autronis-border rounded-2xl p-6 card-glow bg-autronis-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <AnimatedNumber
            value={totaalAftrekbaar}
            format={formatBedrag}
            className="text-3xl font-bold text-emerald-400 tabular-nums"
          />
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
            Totaal aftrekbaar {jaar}
          </p>
        </div>

        <div className="border border-autronis-border rounded-2xl p-6 card-glow bg-autronis-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
              <Receipt className="w-5 h-5 text-autronis-accent" />
            </div>
          </div>
          <AnimatedNumber
            value={totaalBtw}
            format={formatBedrag}
            className="text-3xl font-bold text-autronis-accent tabular-nums"
          />
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
            BTW betaald {jaar}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (maand === 1) { setMaand(12); setJaar(jaar - 1); } else { setMaand(maand - 1); }
            }}
            className="p-2 rounded-lg hover:bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-autronis-text-primary min-w-[140px] text-center">
            {MAAND_NAMEN[maand - 1]} {jaar}
          </span>
          <button
            onClick={() => {
              if (maand === 12) { setMaand(1); setJaar(jaar + 1); } else { setMaand(maand + 1); }
            }}
            className="p-2 rounded-lg hover:bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <select
          value={categorieFilter}
          onChange={(e) => setCategorieFilter(e.target.value)}
          className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 cursor-pointer"
        >
          <option value="alle">Alle categorieën</option>
          {CATEGORIE_OPTIES.map((c) => (
            <option key={c.waarde} value={c.waarde}>{c.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-3 sm:ml-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            onClick={handleScanBon}
            disabled={scanBonMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card border border-autronis-border hover:border-autronis-accent/50 hover:bg-autronis-accent/5 text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {scanBonMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 text-autronis-accent" />
            )}
            {scanBonMutation.isPending ? "Scannen..." : "Bon scannen"}
          </button>
          <button
            onClick={openNieuwModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
          >
            <Plus className="w-4 h-4" />
            Nieuwe uitgave
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
        {uitgaven.length === 0 ? (
          <EmptyState
            titel="Nog geen uitgaven"
            beschrijving="Voeg je eerste uitgave toe om je kosten bij te houden."
            actieLabel="Nieuwe uitgave"
            onActie={openNieuwModal}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-autronis-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Datum</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Omschrijving</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Leverancier</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Categorie</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">BTW</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Aftrekbaar</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                </tr>
              </thead>
              <tbody>
                {uitgaven.map((u) => {
                  const catKleuren = CATEGORIE_KLEUREN[u.categorie || "overig"] || CATEGORIE_KLEUREN.overig;
                  const catLabel = CATEGORIE_OPTIES.find((c) => c.waarde === u.categorie)?.label || u.categorie;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors"
                    >
                      <td className="py-4 px-4 text-sm text-autronis-text-secondary">
                        {formatDatumKort(u.datum)}
                      </td>
                      <td className="py-4 px-4 text-base text-autronis-text-primary max-w-[250px] truncate">
                        {u.omschrijving}
                      </td>
                      <td className="py-4 px-4 text-sm text-autronis-text-secondary">
                        {u.leverancier || "\u2014"}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", catKleuren)}>
                          {catLabel}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-base font-semibold text-autronis-text-primary text-right tabular-nums">
                        {formatBedrag(u.bedrag)}
                      </td>
                      <td className="py-4 px-4 text-sm text-autronis-text-secondary text-right tabular-nums">
                        {u.btwBedrag ? formatBedrag(u.btwBedrag) : "\u2014"}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {u.fiscaalAftrekbaar ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-autronis-text-secondary text-xs">Nee</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteId(u.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        titel={editUitgave ? "Uitgave bewerken" : "Nieuwe uitgave"}
        breedte="lg"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? "Opslaan..." : editUitgave ? "Bijwerken" : "Toevoegen"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Omschrijving"
            verplicht
            placeholder="Bijv. Adobe Creative Cloud licentie"
            value={form.omschrijving}
            onChange={(e) => setForm({ ...form, omschrijving: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Bedrag (incl. BTW)"
              type="number"
              verplicht
              placeholder="0.00"
              value={form.bedrag}
              onChange={(e) => handleBedragChange(e.target.value)}
            />
            <FormField
              label="Datum"
              type="date"
              verplicht
              value={form.datum}
              onChange={(e) => setForm({ ...form, datum: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Categorie"
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value })}
              opties={CATEGORIE_OPTIES}
            />
            <FormField
              label="Leverancier"
              placeholder="Bijv. Adobe"
              value={form.leverancier}
              onChange={(e) => setForm({ ...form, leverancier: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="BTW bedrag"
              type="number"
              placeholder="Wordt automatisch berekend"
              value={form.btwBedrag}
              onChange={(e) => setForm({ ...form, btwBedrag: e.target.value })}
            />
            <FormField
              label="BTW percentage"
              type="number"
              placeholder="21"
              value={form.btwPercentage}
              onChange={(e) => setForm({ ...form, btwPercentage: e.target.value })}
            />
          </div>

          <FormField
            label="Bonnetje URL"
            placeholder="Link naar bonnetje of factuur"
            value={form.bonnetjeUrl}
            onChange={(e) => setForm({ ...form, bonnetjeUrl: e.target.value })}
          />

          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="fiscaalAftrekbaar"
              checked={form.fiscaalAftrekbaar}
              onChange={(e) => setForm({ ...form, fiscaalAftrekbaar: e.target.checked })}
              className="w-4 h-4 rounded border-autronis-border bg-autronis-bg text-autronis-accent focus:ring-autronis-accent/50 cursor-pointer accent-[#17B8A5]"
            />
            <label htmlFor="fiscaalAftrekbaar" className="text-sm text-autronis-text-primary cursor-pointer">
              Fiscaal aftrekbaar
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteId(null);
        }}
        onBevestig={handleDelete}
        titel="Uitgave verwijderen?"
        bericht="Weet je zeker dat je deze uitgave wilt verwijderen?"
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </div>
  );
}
