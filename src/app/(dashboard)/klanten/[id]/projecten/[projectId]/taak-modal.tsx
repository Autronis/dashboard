"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField, TextareaField } from "@/components/ui/form-field";
import { useToast } from "@/hooks/use-toast";

interface Taak {
  id: number;
  titel: string;
  omschrijving: string | null;
  status: string;
  deadline: string | null;
  prioriteit: string;
}

interface TaakModalProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  taak?: Taak | null;
  onOpgeslagen: () => void;
}

const STATUSSEN = [
  { waarde: "open", label: "Open" },
  { waarde: "bezig", label: "Bezig" },
  { waarde: "afgerond", label: "Afgerond" },
];

const PRIORITEITEN = [
  { waarde: "laag", label: "Laag" },
  { waarde: "normaal", label: "Normaal" },
  { waarde: "hoog", label: "Hoog" },
];

export function TaakModal({ open, onClose, projectId, taak, onOpgeslagen }: TaakModalProps) {
  const { addToast } = useToast();
  const [titel, setTitel] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [status, setStatus] = useState("open");
  const [deadline, setDeadline] = useState("");
  const [prioriteit, setPrioriteit] = useState("normaal");
  const [laden, setLaden] = useState(false);
  const [fouten, setFouten] = useState<Record<string, string>>({});

  const isBewerken = !!taak;

  useEffect(() => {
    if (open) {
      if (taak) {
        setTitel(taak.titel);
        setOmschrijving(taak.omschrijving || "");
        setStatus(taak.status);
        setDeadline(taak.deadline || "");
        setPrioriteit(taak.prioriteit);
      } else {
        setTitel("");
        setOmschrijving("");
        setStatus("open");
        setDeadline("");
        setPrioriteit("normaal");
      }
      setFouten({});
    }
  }, [open, taak]);

  function valideer(): boolean {
    const f: Record<string, string> = {};
    if (!titel.trim()) f.titel = "Titel is verplicht";
    setFouten(f);
    return Object.keys(f).length === 0;
  }

  async function handleOpslaan() {
    if (!valideer()) return;
    setLaden(true);

    try {
      const url = isBewerken ? `/api/taken/${taak.id}` : "/api/taken";
      const res = await fetch(url, {
        method: isBewerken ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          titel: titel.trim(),
          omschrijving: omschrijving.trim() || null,
          status,
          deadline: deadline || null,
          prioriteit,
        }),
      });

      if (!res.ok) throw new Error();
      addToast(isBewerken ? "Taak bijgewerkt" : "Taak toegevoegd");
      onOpgeslagen();
    } catch {
      addToast("Kon taak niet opslaan", "fout");
    } finally {
      setLaden(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel={isBewerken ? "Taak bewerken" : "Nieuwe taak"}
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
            {laden ? "Opslaan..." : isBewerken ? "Bijwerken" : "Toevoegen"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          label="Titel"
          verplicht
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder="Bijv. API endpoints bouwen, Design review..."
          fout={fouten.titel}
        />

        <TextareaField
          label="Omschrijving"
          isTextarea
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
          placeholder="Optionele beschrijving van de taak..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Prioriteit"
            value={prioriteit}
            onChange={(e) => setPrioriteit(e.target.value)}
            opties={PRIORITEITEN}
          />

          <SelectField
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            opties={STATUSSEN}
          />
        </div>

        <FormField
          label="Deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
    </Modal>
  );
}
