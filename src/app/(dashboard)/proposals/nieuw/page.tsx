"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, UserPlus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { DeckEditor } from "@/components/proposal-deck/DeckEditor";
import { defaultSlides } from "@/components/proposal-deck/defaults";
import { Slide } from "@/components/proposal-deck/types";
import { useKlanten } from "@/hooks/queries/use-klanten";

type Regel = {
  id: number;
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
};

let localRegelId = 1;
const newRegel = (): Regel => ({
  id: localRegelId++,
  omschrijving: "",
  aantal: 1,
  eenheidsprijs: 0,
});

export default function NieuweProposalPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { data: klantenData } = useKlanten();
  const klanten = klantenData?.klanten ?? [];

  const [klantId, setKlantId] = useState<number | null>(null);
  const [titel, setTitel] = useState("");
  const [geldigTot, setGeldigTot] = useState("");
  const [slides, setSlides] = useState<Slide[]>(defaultSlides());
  const [regels, setRegels] = useState<Regel[]>([newRegel()]);
  const [saving, setSaving] = useState(false);

  // Inline nieuwe klant modal
  const [newKlantOpen, setNewKlantOpen] = useState(false);
  const [newKlantNaam, setNewKlantNaam] = useState("");
  const [newKlantContact, setNewKlantContact] = useState("");
  const [newKlantEmail, setNewKlantEmail] = useState("");
  const [creatingKlant, setCreatingKlant] = useState(false);

  const createKlant = async () => {
    if (!newKlantNaam.trim()) {
      addToast("Bedrijfsnaam is verplicht", "fout");
      return;
    }
    setCreatingKlant(true);
    try {
      const res = await fetch("/api/klanten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedrijfsnaam: newKlantNaam.trim(),
          contactpersoon: newKlantContact.trim() || undefined,
          email: newKlantEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Aanmaken mislukt");
      addToast(`${data.klant.bedrijfsnaam} toegevoegd`, "succes");
      await queryClient.invalidateQueries({ queryKey: ["klanten"] });
      setKlantId(data.klant.id);
      setNewKlantOpen(false);
      setNewKlantNaam("");
      setNewKlantContact("");
      setNewKlantEmail("");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Aanmaken mislukt", "fout");
    } finally {
      setCreatingKlant(false);
    }
  };

  const totaal = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs, 0);

  const save = async () => {
    if (!klantId) {
      addToast("Selecteer een klant", "fout");
      return;
    }
    if (!titel.trim()) {
      addToast("Titel is verplicht", "fout");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId,
          titel: titel.trim(),
          secties: slides,
          geldigTot: geldigTot || null,
          regels: regels
            .filter((r) => r.omschrijving.trim())
            .map((r) => ({
              omschrijving: r.omschrijving,
              aantal: r.aantal,
              eenheidsprijs: r.eenheidsprijs,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Opslaan mislukt");
      addToast("Proposal aangemaakt", "succes");
      router.push(`/proposals/${data.proposal.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        <Link
          href="/proposals"
          className="inline-flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar proposals
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Nieuwe proposal</h1>
        </div>

        {/* Metadata */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
              Klant *
            </label>
            <div className="flex gap-2">
              <select
                value={klantId ?? ""}
                onChange={(e) => setKlantId(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
              >
                <option value="">Selecteer klant...</option>
                {klanten.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.bedrijfsnaam}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNewKlantOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary hover:bg-autronis-card hover:border-autronis-accent hover:text-autronis-accent transition whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                Nieuwe klant
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
              Titel *
            </label>
            <input
              type="text"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Bv. AI-gedreven projectdashboard"
              className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
              Geldig tot
            </label>
            <input
              type="date"
              value={geldigTot}
              onChange={(e) => setGeldigTot(e.target.value)}
              className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
            />
          </div>
        </div>

        {/* Slides */}
        <div>
          <h2 className="text-xl font-bold text-autronis-text-primary mb-4">Slides</h2>
          <DeckEditor slides={slides} onChange={setSlides} />
        </div>

        {/* Prijsregels */}
        <div>
          <h2 className="text-xl font-bold text-autronis-text-primary mb-4">Prijsregels</h2>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-3">
            {regels.map((r, idx) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_80px_120px_120px_auto] gap-2 items-center"
              >
                <input
                  type="text"
                  placeholder="Omschrijving"
                  value={r.omschrijving}
                  onChange={(e) => {
                    const next = [...regels];
                    next[idx] = { ...r, omschrijving: e.target.value };
                    setRegels(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
                />
                <input
                  type="number"
                  value={r.aantal}
                  onChange={(e) => {
                    const next = [...regels];
                    next[idx] = { ...r, aantal: Number(e.target.value) };
                    setRegels(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary tabular-nums"
                />
                <input
                  type="number"
                  step="0.01"
                  value={r.eenheidsprijs}
                  onChange={(e) => {
                    const next = [...regels];
                    next[idx] = { ...r, eenheidsprijs: Number(e.target.value) };
                    setRegels(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary tabular-nums"
                />
                <div className="text-right tabular-nums font-semibold text-autronis-text-primary">
                  € {(r.aantal * r.eenheidsprijs).toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => setRegels(regels.filter((x) => x.id !== r.id))}
                  className="px-2 text-autronis-text-secondary hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRegels([...regels, newRegel()])}
              className="text-sm text-autronis-accent hover:underline"
            >
              + regel toevoegen
            </button>
            <div className="pt-4 border-t border-autronis-border text-right">
              <span className="text-xs uppercase text-autronis-text-secondary mr-3">Totaal</span>
              <span className="text-2xl font-bold text-autronis-accent tabular-nums">
                € {totaal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end sticky bottom-4 bg-autronis-bg/80 backdrop-blur p-3 rounded-2xl border border-autronis-border">
          <Link
            href="/proposals"
            className="px-5 py-2.5 rounded-xl border border-autronis-border text-autronis-text-primary hover:bg-autronis-card"
          >
            Annuleren
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-autronis-bg font-semibold disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Opslaan..." : "Opslaan als concept"}
          </button>
        </div>
      </div>

      {/* Inline nieuwe klant modal */}
      {newKlantOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !creatingKlant && setNewKlantOpen(false)}
        >
          <div
            className="w-full max-w-md bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold text-autronis-text-primary">Nieuwe klant</h2>
              <button
                type="button"
                onClick={() => !creatingKlant && setNewKlantOpen(false)}
                className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-autronis-text-secondary">
              Snel een prospect of klant toevoegen. Je kan later meer details invullen op de klantenpagina.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
                Bedrijfsnaam *
              </label>
              <input
                type="text"
                value={newKlantNaam}
                onChange={(e) => setNewKlantNaam(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
                placeholder="Bv. Bosch Bouw"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
                Contactpersoon
              </label>
              <input
                type="text"
                value={newKlantContact}
                onChange={(e) => setNewKlantContact(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
                placeholder="Optioneel"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={newKlantEmail}
                onChange={(e) => setNewKlantEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
                placeholder="Optioneel"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                disabled={creatingKlant}
                onClick={() => setNewKlantOpen(false)}
                className="px-4 py-2 rounded-xl border border-autronis-border text-autronis-text-primary hover:bg-autronis-bg"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={creatingKlant || !newKlantNaam.trim()}
                onClick={createKlant}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-autronis-accent text-autronis-bg font-semibold disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {creatingKlant ? "Toevoegen..." : "Toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
