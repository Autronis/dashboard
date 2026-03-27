"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Power, PowerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useTerugkerendeRitten,
  useSaveTerugkerendeRit,
  useUpdateTerugkerendeRit,
  useDeleteTerugkerendeRit,
  useKlantenProjecten,
  type TerugkerendeRit,
} from "@/hooks/queries/use-kilometers";
import { motion, AnimatePresence } from "framer-motion";

const DAG_NAMEN = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

const FREQUENTIE_LABELS: Record<string, string> = {
  dagelijks: "Dagelijks (ma-vr)",
  wekelijks: "Wekelijks",
  maandelijks: "Maandelijks",
};

const DOEL_OPTIES = [
  { waarde: "", label: "Geen doel" },
  { waarde: "klantbezoek", label: "Klantbezoek" },
  { waarde: "meeting", label: "Meeting" },
  { waarde: "inkoop", label: "Inkoop / Leverancier" },
  { waarde: "netwerk", label: "Netwerk event" },
  { waarde: "training", label: "Cursus / Training" },
  { waarde: "boekhouder", label: "Boekhouder / KVK / Bank" },
  { waarde: "overig", label: "Overig zakelijk" },
];

interface TerugkerendeRittenModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  naam: string;
  vanLocatie: string;
  naarLocatie: string;
  kilometers: string;
  isRetour: boolean;
  doelType: string;
  klantId: string;
  projectId: string;
  frequentie: string;
  dagVanWeek: string;
  dagVanMaand: string;
  startDatum: string;
  eindDatum: string;
}

const EMPTY_FORM: FormState = {
  naam: "",
  vanLocatie: "",
  naarLocatie: "",
  kilometers: "",
  isRetour: false,
  doelType: "",
  klantId: "",
  projectId: "",
  frequentie: "wekelijks",
  dagVanWeek: "0",
  dagVanMaand: "1",
  startDatum: new Date().toISOString().slice(0, 10),
  eindDatum: "",
};

export function TerugkerendeRittenModal({ open, onClose }: TerugkerendeRittenModalProps) {
  const { addToast } = useToast();
  const { data } = useTerugkerendeRitten();
  const { data: kpData } = useKlantenProjecten();
  const saveMutation = useSaveTerugkerendeRit();
  const updateMutation = useUpdateTerugkerendeRit();
  const deleteMutation = useDeleteTerugkerendeRit();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const ritten = data?.ritten ?? [];
  const klanten = kpData?.klanten ?? [];
  const projecten = kpData?.projecten ?? [];
  const filteredProjecten = form.klantId ? projecten.filter((p) => p.klantId === Number(form.klantId)) : projecten;

  function openNewForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(rit: TerugkerendeRit) {
    setEditId(rit.id);
    setForm({
      naam: rit.naam,
      vanLocatie: rit.vanLocatie,
      naarLocatie: rit.naarLocatie,
      kilometers: String(rit.kilometers),
      isRetour: rit.isRetour === 1,
      doelType: rit.doelType || "",
      klantId: rit.klantId ? String(rit.klantId) : "",
      projectId: rit.projectId ? String(rit.projectId) : "",
      frequentie: rit.frequentie,
      dagVanWeek: rit.dagVanWeek != null ? String(rit.dagVanWeek) : "0",
      dagVanMaand: rit.dagVanMaand != null ? String(rit.dagVanMaand) : "1",
      startDatum: rit.startDatum,
      eindDatum: rit.eindDatum || "",
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.naam.trim() || !form.vanLocatie.trim() || !form.naarLocatie.trim() || !form.kilometers) {
      addToast("Vul alle verplichte velden in", "fout");
      return;
    }

    const payload = {
      naam: form.naam,
      vanLocatie: form.vanLocatie,
      naarLocatie: form.naarLocatie,
      kilometers: parseFloat(form.kilometers),
      isRetour: form.isRetour,
      doelType: form.doelType || undefined,
      klantId: form.klantId ? Number(form.klantId) : undefined,
      projectId: form.projectId ? Number(form.projectId) : undefined,
      frequentie: form.frequentie,
      dagVanWeek: form.frequentie === "wekelijks" ? Number(form.dagVanWeek) : undefined,
      dagVanMaand: form.frequentie === "maandelijks" ? Number(form.dagVanMaand) : undefined,
      startDatum: form.startDatum,
      eindDatum: form.eindDatum || undefined,
    };

    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, ...payload });
        addToast("Terugkerende rit bijgewerkt", "succes");
      } else {
        await saveMutation.mutateAsync(payload);
        addToast("Terugkerende rit aangemaakt", "succes");
      }
      setShowForm(false);
      setEditId(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon niet opslaan", "fout");
    }
  }

  async function handleToggleActief(rit: TerugkerendeRit) {
    try {
      await updateMutation.mutateAsync({ id: rit.id, isActief: rit.isActief === 1 ? 0 : 1 });
      addToast(rit.isActief === 1 ? "Rit gepauzeerd" : "Rit geactiveerd", "succes");
    } catch {
      addToast("Kon status niet wijzigen", "fout");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      addToast("Terugkerende rit verwijderd", "succes");
      setDeleteId(null);
    } catch {
      addToast("Kon rit niet verwijderen", "fout");
    }
  }

  function getNextDate(rit: TerugkerendeRit): string {
    const now = new Date();
    if (rit.eindDatum && new Date(rit.eindDatum) < now) return "Verlopen";
    if (!rit.isActief) return "Gepauzeerd";

    switch (rit.frequentie) {
      case "dagelijks": {
        const next = new Date(now);
        while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
        return next.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
      }
      case "wekelijks": {
        const target = (rit.dagVanWeek ?? 0) + 1;
        const adjusted = target === 7 ? 0 : target;
        const next = new Date(now);
        while (next.getDay() !== adjusted) next.setDate(next.getDate() + 1);
        return next.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
      }
      case "maandelijks": {
        const day = rit.dagVanMaand ?? 1;
        const next = new Date(now.getFullYear(), now.getMonth(), day);
        if (next <= now) next.setMonth(next.getMonth() + 1);
        return next.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
      }
      default:
        return "—";
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} titel="Terugkerende ritten" breedte="lg">
        <div className="space-y-4">
          {/* List */}
          {ritten.length === 0 && !showForm && (
            <div className="text-center py-8 text-autronis-text-secondary text-sm">
              Nog geen terugkerende ritten. Maak er een aan voor automatische registratie.
            </div>
          )}

          <AnimatePresence>
            {ritten.map((rit) => (
              <motion.div
                key={rit.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "border rounded-xl p-4 group transition-colors",
                  rit.isActief ? "border-autronis-border bg-autronis-card" : "border-autronis-border/50 bg-autronis-card/50 opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-autronis-text-primary">{rit.naam}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent">
                        {FREQUENTIE_LABELS[rit.frequentie] || rit.frequentie}
                      </span>
                      {rit.frequentie === "wekelijks" && rit.dagVanWeek != null && (
                        <span className="text-xs text-autronis-text-secondary">{DAG_NAMEN[rit.dagVanWeek]}</span>
                      )}
                      {rit.frequentie === "maandelijks" && rit.dagVanMaand != null && (
                        <span className="text-xs text-autronis-text-secondary">dag {rit.dagVanMaand}</span>
                      )}
                    </div>
                    <div className="text-xs text-autronis-text-secondary mt-1">
                      {rit.vanLocatie} → {rit.naarLocatie} · {rit.isRetour ? rit.kilometers * 2 : rit.kilometers} km
                      {rit.isRetour === 1 && " (retour)"}
                      {rit.klantNaam && ` · ${rit.klantNaam}`}
                    </div>
                    <div className="text-xs text-autronis-text-secondary mt-0.5">
                      Volgende: {getNextDate(rit)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleToggleActief(rit)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-autronis-text-secondary"
                      title={rit.isActief ? "Pauzeren" : "Activeren"}
                    >
                      {rit.isActief ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => openEditForm(rit)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-autronis-text-secondary"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(rit.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-autronis-text-secondary hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* New/Edit form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-autronis-accent/30 rounded-xl p-4 bg-autronis-accent/5 space-y-3">
                  <h4 className="text-sm font-semibold text-autronis-text-primary">
                    {editId ? "Rit bewerken" : "Nieuwe terugkerende rit"}
                  </h4>

                  <FormField label="Naam" value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} placeholder="bijv. Woon-werk" />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Van" value={form.vanLocatie} onChange={(e) => setForm({ ...form, vanLocatie: e.target.value })} />
                    <FormField label="Naar" value={form.naarLocatie} onChange={(e) => setForm({ ...form, naarLocatie: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Kilometers (enkel)" type="number" value={form.kilometers} onChange={(e) => setForm({ ...form, kilometers: e.target.value })} />
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-sm text-autronis-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isRetour}
                          onChange={(e) => setForm({ ...form, isRetour: e.target.checked })}
                          className="accent-autronis-accent"
                        />
                        Retour ({form.kilometers ? parseFloat(form.kilometers) * 2 : 0} km totaal)
                      </label>
                    </div>
                  </div>

                  {/* Frequentie */}
                  <div>
                    <label className="block text-xs text-autronis-text-secondary mb-1.5">Frequentie</label>
                    <div className="flex gap-2">
                      {(["dagelijks", "wekelijks", "maandelijks"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setForm({ ...form, frequentie: f })}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            form.frequentie === f
                              ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                              : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                          )}
                        >
                          {FREQUENTIE_LABELS[f]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.frequentie === "wekelijks" && (
                    <SelectField
                      label="Dag van de week"
                      value={form.dagVanWeek}
                      onChange={(e) => setForm({ ...form, dagVanWeek: e.target.value })}
                      opties={DAG_NAMEN.map((naam, i) => ({ waarde: String(i), label: naam }))}
                    />
                  )}

                  {form.frequentie === "maandelijks" && (
                    <FormField
                      label="Dag van de maand"
                      type="number"
                      value={form.dagVanMaand}
                      onChange={(e) => setForm({ ...form, dagVanMaand: e.target.value })}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Startdatum" type="date" value={form.startDatum} onChange={(e) => setForm({ ...form, startDatum: e.target.value })} />
                    <FormField label="Einddatum (optioneel)" type="date" value={form.eindDatum} onChange={(e) => setForm({ ...form, eindDatum: e.target.value })} />
                  </div>

                  <SelectField
                    label="Doel"
                    value={form.doelType}
                    onChange={(e) => setForm({ ...form, doelType: e.target.value })}
                    opties={DOEL_OPTIES}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Klant"
                      value={form.klantId}
                      onChange={(e) => setForm({ ...form, klantId: e.target.value, projectId: "" })}
                      opties={[{ waarde: "", label: "Geen klant" }, ...klanten.map((k) => ({ waarde: String(k.id), label: k.bedrijfsnaam }))]}
                    />
                    <SelectField
                      label="Project"
                      value={form.projectId}
                      onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                      opties={[{ waarde: "", label: "Geen project" }, ...filteredProjecten.map((p) => ({ waarde: String(p.id), label: p.naam }))]}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => { setShowForm(false); setEditId(null); }}
                      className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={saveMutation.isPending || updateMutation.isPending}
                      className="px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-medium transition-colors"
                    >
                      {editId ? "Bijwerken" : "Toevoegen"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add button */}
          {!showForm && (
            <button
              onClick={openNewForm}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-autronis-border rounded-xl text-sm text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nieuwe terugkerende rit
            </button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onBevestig={handleDelete}
        titel="Terugkerende rit verwijderen?"
        bericht="De rit wordt verwijderd. Eerder gegenereerde ritten blijven bestaan."
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </>
  );
}
