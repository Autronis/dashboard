"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { useToast } from "@/hooks/use-toast";

interface DocumentModalProps {
  open: boolean;
  onClose: () => void;
  klantId: number;
  projectId?: number | null;
  onOpgeslagen: () => void;
}

const TYPES = [
  { waarde: "contract", label: "Contract" },
  { waarde: "offerte", label: "Offerte" },
  { waarde: "link", label: "Link" },
  { waarde: "overig", label: "Overig" },
];

export function DocumentModal({ open, onClose, klantId, projectId, onOpgeslagen }: DocumentModalProps) {
  const { addToast } = useToast();
  const [naam, setNaam] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("overig");
  const [laden, setLaden] = useState(false);
  const [fouten, setFouten] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setNaam("");
      setUrl("");
      setType("overig");
      setFouten({});
    }
  }, [open]);

  function valideer(): boolean {
    const f: Record<string, string> = {};
    if (!naam.trim()) f.naam = "Naam is verplicht";
    if (url.trim() && !/^https?:\/\/.+/.test(url.trim())) f.url = "Voer een geldige URL in (https://...)";
    setFouten(f);
    return Object.keys(f).length === 0;
  }

  async function handleOpslaan() {
    if (!valideer()) return;
    setLaden(true);

    try {
      const res = await fetch("/api/documenten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId,
          projectId: projectId || null,
          naam: naam.trim(),
          url: url.trim() || null,
          type,
        }),
      });

      if (!res.ok) throw new Error();
      addToast("Document toegevoegd");
      onOpgeslagen();
    } catch {
      addToast("Kon document niet opslaan", "fout");
    } finally {
      setLaden(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel="Document of link toevoegen"
      breedte="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleOpslaan}
            disabled={laden}
            className="px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {laden ? "Opslaan..." : "Toevoegen"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          label="Naam"
          verplicht
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Bijv. Contract 2026, Projectplan, Google Drive link..."
          fout={fouten.naam}
        />

        <SelectField
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          opties={TYPES}
        />

        <FormField
          label="URL / Link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          fout={fouten.url}
        />
      </div>
    </Modal>
  );
}
