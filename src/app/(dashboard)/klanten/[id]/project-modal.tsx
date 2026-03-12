"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { useToast } from "@/hooks/use-toast";

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  klantId: number;
  project?: {
    id: number;
    naam: string;
    omschrijving: string | null;
    status: string;
    geschatteUren: number | null;
    deadline: string | null;
    voortgangPercentage: number | null;
  } | null;
  onOpgeslagen: () => void;
}

const STATUSSEN = [
  { waarde: "actief", label: "Actief" },
  { waarde: "afgerond", label: "Afgerond" },
  { waarde: "on-hold", label: "On-hold" },
];

export function ProjectModal({ open, onClose, klantId, project, onOpgeslagen }: ProjectModalProps) {
  const { addToast } = useToast();
  const [laden, setLaden] = useState(false);

  const [naam, setNaam] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [status, setStatus] = useState("actief");
  const [geschatteUren, setGeschatteUren] = useState("");
  const [deadline, setDeadline] = useState("");
  const [voortgang, setVoortgang] = useState("0");
  const [fouten, setFouten] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (project) {
      setNaam(project.naam);
      setOmschrijving(project.omschrijving || "");
      setStatus(project.status);
      setGeschatteUren(project.geschatteUren ? String(project.geschatteUren) : "");
      setDeadline(project.deadline || "");
      setVoortgang(String(project.voortgangPercentage || 0));
    } else {
      setNaam("");
      setOmschrijving("");
      setStatus("actief");
      setGeschatteUren("");
      setDeadline("");
      setVoortgang("0");
    }
    setFouten({});
  }, [open, project]);

  function valideer(): boolean {
    const f: Record<string, string> = {};
    if (!naam.trim()) f.naam = "Projectnaam is verplicht";
    if (geschatteUren && Number(geschatteUren) <= 0) f.geschatteUren = "Moet positief zijn";
    setFouten(f);
    return Object.keys(f).length === 0;
  }

  async function handleOpslaan() {
    if (!valideer()) return;
    setLaden(true);

    try {
      const url = project
        ? `/api/klanten/${klantId}/projecten/${project.id}`
        : `/api/klanten/${klantId}/projecten`;

      const res = await fetch(url, {
        method: project ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: naam.trim(),
          omschrijving: omschrijving.trim() || null,
          status,
          geschatteUren: geschatteUren ? Number(geschatteUren) : null,
          deadline: deadline || null,
          voortgangPercentage: Number(voortgang),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon niet opslaan");
      }

      addToast(project ? "Project bijgewerkt" : "Project aangemaakt");
      onOpgeslagen();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon niet opslaan", "fout");
    } finally {
      setLaden(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel={project ? "Project bewerken" : "Nieuw project"}
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
        <FormField
          label="Naam"
          verplicht
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Projectnaam"
          fout={fouten.naam}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">Omschrijving</label>
          <textarea
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
            placeholder="Beschrijf het project..."
            rows={3}
            className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
          />
        </div>

        <SelectField
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          opties={STATUSSEN}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Geschatte uren"
            type="number"
            value={geschatteUren}
            onChange={(e) => setGeschatteUren(e.target.value)}
            placeholder="0"
            fout={fouten.geschatteUren}
          />
          <FormField
            label="Deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Voortgang: {voortgang}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={voortgang}
            onChange={(e) => setVoortgang(e.target.value)}
            className="w-full accent-[var(--accent)]"
          />
        </div>
      </div>
    </Modal>
  );
}
