"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useContentProfiel, useUpdateProfiel, useContentInzichten, useCreateInzicht, useDeleteInzicht } from "@/hooks/queries/use-content";
import { useKlanten } from "@/hooks/queries/use-klanten";
import { useToast } from "@/hooks/use-toast";
import { INZICHT_CATEGORIE_LABELS, INZICHT_CATEGORIE_COLORS, type InzichtCategorie } from "@/types/content";
import { PageTransition } from "@/components/ui/page-transition";

const PROFIEL_LABELS: Record<string, string> = {
  over_ons: "Over ons",
  diensten: "Diensten",
  usps: "Unique Selling Points",
  tone_of_voice: "Tone of Voice",
};

const PROFIEL_VOLGORDE = ["over_ons", "diensten", "usps", "tone_of_voice"];

function ProfielKaart({ id, onderwerp, inhoud }: { id: number; onderwerp: string; inhoud: string }) {
  const [lokaleInhoud, setLokaleInhoud] = useState(inhoud);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const { addToast } = useToast();
  const updateProfiel = useUpdateProfiel();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleBlur() {
    if (lokaleInhoud === inhoud) return;
    updateProfiel.mutate(
      { id, onderwerp, inhoud: lokaleInhoud },
      {
        onSuccess: () => {
          setOpgeslagen(true);
          addToast("Opgeslagen", "succes");
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setOpgeslagen(false), 2000);
        },
        onError: (err) => {
          addToast(err.message ?? "Opslaan mislukt", "fout");
        },
      }
    );
  }

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-autronis-text-primary">
          {PROFIEL_LABELS[onderwerp] ?? onderwerp}
        </h3>
        {opgeslagen && (
          <span className="text-xs text-green-400 font-medium">Opgeslagen</span>
        )}
      </div>
      <textarea
        value={lokaleInhoud}
        onChange={(e) => setLokaleInhoud(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary resize-none focus:outline-none focus:border-autronis-accent transition-colors"
        placeholder={`Vul hier ${PROFIEL_LABELS[onderwerp]?.toLowerCase() ?? onderwerp} in...`}
      />
    </div>
  );
}

export default function KennisbankPage() {
  const { data: profielEntries, isLoading: profielLoading } = useContentProfiel();
  const { data: inzichten, isLoading: inzichtenLoading } = useContentInzichten();
  const { data: klantenData } = useKlanten();
  const klanten = klantenData?.klanten;
  const createInzicht = useCreateInzicht();
  const deleteInzicht = useDeleteInzicht();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [inhoud, setInhoud] = useState("");
  const [categorie, setCategorie] = useState<InzichtCategorie>("projectervaring");
  const [klantId, setKlantId] = useState<number | undefined>(undefined);
  const [bezig, setBezig] = useState(false);

  function resetForm() {
    setTitel("");
    setInhoud("");
    setCategorie("projectervaring");
    setKlantId(undefined);
  }

  function handleSluitModal() {
    setModalOpen(false);
    resetForm();
  }

  async function handleInzichtOpslaan() {
    if (!titel.trim() || !inhoud.trim()) {
      addToast("Titel en inhoud zijn verplicht.", "fout");
      return;
    }
    setBezig(true);
    createInzicht.mutate(
      { titel: titel.trim(), inhoud: inhoud.trim(), categorie, klantId },
      {
        onSuccess: () => {
          addToast("Inzicht opgeslagen", "succes");
          handleSluitModal();
          setBezig(false);
        },
        onError: (err) => {
          addToast(err.message ?? "Opslaan mislukt", "fout");
          setBezig(false);
        },
      }
    );
  }

  function handleVerwijder(id: number) {
    deleteInzicht.mutate(id, {
      onSuccess: () => addToast("Inzicht verwijderd", "succes"),
      onError: (err) => addToast(err.message ?? "Verwijderen mislukt", "fout"),
    });
  }

  const gesorteerdeEntries = profielEntries
    ? [...profielEntries].sort(
        (a, b) =>
          PROFIEL_VOLGORDE.indexOf(a.onderwerp) - PROFIEL_VOLGORDE.indexOf(b.onderwerp)
      )
    : [];

  return (
    <PageTransition>
    <div className="p-6 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Kennisbank</h1>
        <p className="text-autronis-text-secondary mt-1">
          Autronis profiel en inzichten voor content generatie.
        </p>
      </div>

      {/* Autronis Profiel */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-autronis-text-primary">Autronis Profiel</h2>

        {profielLoading ? (
          <div className="flex items-center gap-2 text-autronis-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Laden...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gesorteerdeEntries.map((entry) => (
              <ProfielKaart
                key={entry.id}
                id={entry.id}
                onderwerp={entry.onderwerp}
                inhoud={entry.inhoud}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inzichten */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-autronis-text-primary">Inzichten</h2>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-autronis-accent text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-autronis-accent/90 transition-colors btn-press"
          >
            <Plus className="w-4 h-4" />
            Nieuw inzicht
          </button>
        </div>

        {inzichtenLoading ? (
          <div className="flex items-center gap-2 text-autronis-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Laden...</span>
          </div>
        ) : inzichten && inzichten.length > 0 ? (
          <div className="space-y-3">
            {inzichten.map((inzicht) => {
              const kleuren = INZICHT_CATEGORIE_COLORS[inzicht.categorie];
              return (
                <div
                  key={inzicht.id}
                  className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow flex gap-4"
                >
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${kleuren.bg} ${kleuren.text}`}
                      >
                        {INZICHT_CATEGORIE_LABELS[inzicht.categorie]}
                      </span>
                      {inzicht.klantNaam && (
                        <span className="text-xs text-autronis-text-secondary">
                          {inzicht.klantNaam}
                        </span>
                      )}
                      <span className="text-xs text-autronis-text-secondary ml-auto">
                        {inzicht.aangemaaktOp
                          ? new Date(inzicht.aangemaaktOp).toLocaleDateString("nl-NL")
                          : ""}
                      </span>
                    </div>
                    <h3 className="font-semibold text-autronis-text-primary">{inzicht.titel}</h3>
                    <p className="text-sm text-autronis-text-secondary line-clamp-2">
                      {inzicht.inhoud}
                    </p>
                  </div>
                  <button
                    onClick={() => handleVerwijder(inzicht.id)}
                    disabled={deleteInzicht.isPending}
                    className="p-2 text-autronis-text-secondary hover:text-red-400 transition-colors flex-shrink-0 self-start"
                    title="Verwijderen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-8 text-center">
            <p className="text-autronis-text-secondary text-sm">
              Nog geen inzichten. Voeg er een toe om te beginnen.
            </p>
          </div>
        )}
      </section>

      {/* Modal: Nieuw inzicht */}
      <Modal
        open={modalOpen}
        onClose={handleSluitModal}
        titel="Nieuw inzicht toevoegen"
        breedte="md"
        footer={
          <>
            <button
              onClick={handleSluitModal}
              className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleInzichtOpslaan}
              disabled={bezig}
              className="flex items-center gap-2 bg-autronis-accent text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-autronis-accent/90 transition-colors disabled:opacity-50"
            >
              {bezig && <Loader2 className="w-4 h-4 animate-spin" />}
              Opslaan
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-autronis-text-primary mb-1.5">
              Titel
            </label>
            <input
              type="text"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary focus:outline-none focus:border-autronis-accent transition-colors"
              placeholder="Bijv. Klant A migratie succesvol afgerond"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-autronis-text-primary mb-1.5">
              Inhoud
            </label>
            <textarea
              value={inhoud}
              onChange={(e) => setInhoud(e.target.value)}
              rows={5}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary resize-none focus:outline-none focus:border-autronis-accent transition-colors"
              placeholder="Beschrijf het inzicht, de situatie of de les..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-autronis-text-primary mb-1.5">
              Categorie
            </label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as InzichtCategorie)}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
            >
              {(Object.keys(INZICHT_CATEGORIE_LABELS) as InzichtCategorie[]).map((cat) => (
                <option key={cat} value={cat}>
                  {INZICHT_CATEGORIE_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-autronis-text-primary mb-1.5">
              Klant <span className="text-autronis-text-secondary font-normal">(optioneel)</span>
            </label>
            <select
              value={klantId ?? ""}
              onChange={(e) =>
                setKlantId(e.target.value ? parseInt(e.target.value, 10) : undefined)
              }
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
            >
              <option value="">Geen klant</option>
              {klanten?.map((klant) => (
                <option key={klant.id} value={klant.id}>
                  {klant.bedrijfsnaam}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
    </PageTransition>
  );
}
