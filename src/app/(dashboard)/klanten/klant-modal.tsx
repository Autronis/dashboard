"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/hooks/use-toast";

interface KlantModalProps {
  open: boolean;
  onClose: () => void;
  klant: {
    id: number;
    bedrijfsnaam: string;
    contactpersoon: string | null;
    email: string | null;
    telefoon: string | null;
    adres: string | null;
    uurtarief: number | null;
    notities: string | null;
    website?: string | null;
    branche?: string | null;
    kvkNummer?: string | null;
    btwNummer?: string | null;
    type?: "klant" | "facturatie" | null;
    taal?: "nl" | "en" | null;
  } | null;
  onOpgeslagen: () => void;
}

interface FormFouten {
  bedrijfsnaam?: string;
  email?: string;
  uurtarief?: string;
}

const leegFormulier = {
  bedrijfsnaam: "",
  contactpersoon: "",
  email: "",
  telefoon: "",
  adres: "",
  uurtarief: "",
  notities: "",
  website: "",
  branche: "",
  kvkNummer: "",
  btwNummer: "",
  type: "klant" as "klant" | "facturatie",
  taal: "nl" as "nl" | "en",
};

export function KlantModal({ open, onClose, klant, onOpgeslagen }: KlantModalProps) {
  const [formulier, setFormulier] = useState(leegFormulier);
  const [fouten, setFouten] = useState<FormFouten>({});
  const [bezig, setBezig] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (open) {
      if (klant) {
        setFormulier({
          bedrijfsnaam: klant.bedrijfsnaam,
          contactpersoon: klant.contactpersoon ?? "",
          email: klant.email ?? "",
          telefoon: klant.telefoon ?? "",
          adres: klant.adres ?? "",
          uurtarief: klant.uurtarief != null ? String(klant.uurtarief) : "",
          notities: klant.notities ?? "",
          website: klant.website ?? "",
          branche: klant.branche ?? "",
          kvkNummer: klant.kvkNummer ?? "",
          btwNummer: klant.btwNummer ?? "",
          type: klant.type ?? "klant",
          taal: klant.taal ?? "nl",
        });
      } else {
        setFormulier(leegFormulier);
      }
      setFouten({});
    }
  }, [open, klant]);

  function valideer(): boolean {
    const nieuweFouten: FormFouten = {};

    if (!formulier.bedrijfsnaam.trim()) {
      nieuweFouten.bedrijfsnaam = "Bedrijfsnaam is verplicht";
    }

    if (formulier.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formulier.email.trim())) {
      nieuweFouten.email = "Ongeldig e-mailadres";
    }

    if (formulier.uurtarief.trim() && (isNaN(Number(formulier.uurtarief)) || Number(formulier.uurtarief) <= 0)) {
      nieuweFouten.uurtarief = "Uurtarief moet een positief getal zijn";
    }

    setFouten(nieuweFouten);
    return Object.keys(nieuweFouten).length === 0;
  }

  async function handleOpslaan() {
    if (!valideer()) return;

    setBezig(true);
    try {
      const body = {
        bedrijfsnaam: formulier.bedrijfsnaam.trim(),
        contactpersoon: formulier.contactpersoon.trim() || null,
        email: formulier.email.trim() || null,
        telefoon: formulier.telefoon.trim() || null,
        adres: formulier.adres.trim() || null,
        uurtarief: formulier.uurtarief.trim() ? Number(formulier.uurtarief) : null,
        notities: formulier.notities.trim() || null,
        website: formulier.website.trim() || null,
        branche: formulier.branche.trim() || null,
        kvkNummer: formulier.kvkNummer.trim() || null,
        btwNummer: formulier.btwNummer.trim() || null,
        type: formulier.type,
        taal: formulier.taal,
      };

      const url = klant ? `/api/klanten/${klant.id}` : "/api/klanten";
      const method = klant ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Opslaan mislukt");
      }

      addToast(klant ? "Klant bijgewerkt" : "Klant aangemaakt");
      onOpgeslagen();
      onClose();
    } catch {
      addToast("Er ging iets mis bij het opslaan", "fout");
    } finally {
      setBezig(false);
    }
  }

  function updateVeld(veld: string, waarde: string) {
    setFormulier((prev) => ({ ...prev, [veld]: waarde }));
    if (fouten[veld as keyof FormFouten]) {
      setFouten((prev) => ({ ...prev, [veld]: undefined }));
    }
  }

  const textareaClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none";

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel={klant ? "Klant bewerken" : "Nieuwe klant"}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleOpslaan}
            disabled={bezig}
            className="px-4 py-2 text-sm font-medium bg-autronis-accent hover:bg-autronis-accent/90 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {bezig ? "Opslaan..." : "Opslaan"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">Type</label>
          <div className="flex gap-2">
            {(["klant", "facturatie"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateVeld("type", t)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formulier.type === t
                    ? t === "klant"
                      ? "bg-autronis-accent/15 border-autronis-accent/40 text-autronis-accent"
                      : "bg-amber-500/15 border-amber-500/40 text-amber-400"
                    : "bg-autronis-bg border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                }`}
              >
                {t === "klant" ? "Klant" : "Alleen facturatie"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">Taal (facturen & e-mails)</label>
          <div className="flex gap-2">
            {(["nl", "en"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateVeld("taal", t)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formulier.taal === t
                    ? "bg-autronis-accent/15 border-autronis-accent/40 text-autronis-accent"
                    : "bg-autronis-bg border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                }`}
              >
                {t === "nl" ? "🇳🇱 Nederlands" : "🇬🇧 English"}
              </button>
            ))}
          </div>
        </div>

        <FormField
          label="Bedrijfsnaam"
          verplicht
          type="text"
          value={formulier.bedrijfsnaam}
          onChange={(e) => updateVeld("bedrijfsnaam", e.target.value)}
          placeholder="Naam van het bedrijf"
          fout={fouten.bedrijfsnaam}
        />

        <FormField
          label="Contactpersoon"
          type="text"
          value={formulier.contactpersoon}
          onChange={(e) => updateVeld("contactpersoon", e.target.value)}
          placeholder="Naam contactpersoon"
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Email"
            type="email"
            value={formulier.email}
            onChange={(e) => updateVeld("email", e.target.value)}
            placeholder="email@voorbeeld.nl"
            fout={fouten.email}
          />

          <FormField
            label="Telefoon"
            type="text"
            value={formulier.telefoon}
            onChange={(e) => updateVeld("telefoon", e.target.value)}
            placeholder="Telefoonnummer"
          />
        </div>

        <FormField
          label="Website"
          type="text"
          value={formulier.website}
          onChange={(e) => updateVeld("website", e.target.value)}
          placeholder="https://voorbeeld.nl"
        />

        <FormField
          label="Branche"
          type="text"
          value={formulier.branche}
          onChange={(e) => updateVeld("branche", e.target.value)}
          placeholder="bijv. IT & Software, Retail, Bouw"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Adres
          </label>
          <textarea
            className={textareaClasses}
            rows={2}
            value={formulier.adres}
            onChange={(e) => updateVeld("adres", e.target.value)}
            placeholder="Adresgegevens"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="KvK nummer"
            type="text"
            value={formulier.kvkNummer}
            onChange={(e) => updateVeld("kvkNummer", e.target.value)}
            placeholder="12345678"
          />

          <FormField
            label="BTW nummer"
            type="text"
            value={formulier.btwNummer}
            onChange={(e) => updateVeld("btwNummer", e.target.value)}
            placeholder="NL123456789B01"
          />
        </div>

        <FormField
          label="Uurtarief"
          type="number"
          value={formulier.uurtarief}
          onChange={(e) => updateVeld("uurtarief", e.target.value)}
          placeholder="0.00"
          min={0}
          step="0.01"
          fout={fouten.uurtarief}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Notities
          </label>
          <textarea
            className={textareaClasses}
            rows={3}
            value={formulier.notities}
            onChange={(e) => updateVeld("notities", e.target.value)}
            placeholder="Eventuele notities"
          />
        </div>
      </div>
    </Modal>
  );
}
