"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/form-field";
import { useToast } from "@/hooks/use-toast";

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  klantId: number;
  projectId?: number | null;
  onOpgeslagen: () => void;
}

const TYPES = [
  { waarde: "notitie", label: "Notitie" },
  { waarde: "belangrijk", label: "Belangrijk" },
  { waarde: "afspraak", label: "Afspraak" },
];

export function NoteModal({ open, onClose, klantId, projectId, onOpgeslagen }: NoteModalProps) {
  const { addToast } = useToast();
  const [inhoud, setInhoud] = useState("");
  const [type, setType] = useState("notitie");
  const [laden, setLaden] = useState(false);

  useEffect(() => {
    if (open) {
      setInhoud("");
      setType("notitie");
    }
  }, [open]);

  async function handleOpslaan() {
    if (!inhoud.trim()) {
      addToast("Notitie mag niet leeg zijn", "fout");
      return;
    }
    setLaden(true);

    try {
      const res = await fetch("/api/notities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId,
          projectId: projectId || null,
          inhoud: inhoud.trim(),
          type,
        }),
      });

      if (!res.ok) throw new Error();
      addToast("Notitie toegevoegd");
      onOpgeslagen();
    } catch {
      addToast("Kon notitie niet opslaan", "fout");
    } finally {
      setLaden(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel="Nieuwe notitie"
      breedte="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleOpslaan}
            disabled={laden}
            className="px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {laden ? "Opslaan..." : "Opslaan"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          opties={TYPES}
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Notitie <span className="text-red-400 ml-1">*</span>
          </label>
          <textarea
            value={inhoud}
            onChange={(e) => setInhoud(e.target.value)}
            placeholder="Schrijf je notitie hier..."
            rows={4}
            className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
