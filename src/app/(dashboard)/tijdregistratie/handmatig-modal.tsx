"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: number;
  naam: string;
  klantNaam: string;
}

interface Registratie {
  id: number;
  projectId: number;
  omschrijving: string | null;
  startTijd: string;
  eindTijd: string | null;
  duurMinuten: number | null;
  categorie: string;
}

interface HandmatigModalProps {
  open: boolean;
  onClose: () => void;
  projecten: Project[];
  registratie: Registratie | null; // null = new, object = edit
  onOpgeslagen: () => void;
}

const CATEGORIEEN = [
  { waarde: "development", label: "Development" },
  { waarde: "meeting", label: "Meeting" },
  { waarde: "administratie", label: "Administratie" },
  { waarde: "overig", label: "Overig" },
];

export function HandmatigModal({ open, onClose, projecten, registratie, onOpgeslagen }: HandmatigModalProps) {
  const { addToast } = useToast();
  const [laden, setLaden] = useState(false);

  const [projectId, setProjectId] = useState<string>("");
  const [omschrijving, setOmschrijving] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [startTijd, setStartTijd] = useState("09:00");
  const [eindTijd, setEindTijd] = useState("10:00");
  const [categorie, setCategorie] = useState("development");
  const [fouten, setFouten] = useState<Record<string, string>>({});

  // Reset form when opening
  useEffect(() => {
    if (!open) return;

    if (registratie) {
      setProjectId(String(registratie.projectId));
      setOmschrijving(registratie.omschrijving || "");
      setCategorie(registratie.categorie);
      if (registratie.startTijd) {
        const start = new Date(registratie.startTijd);
        setDatum(start.toISOString().split("T")[0]);
        setStartTijd(`${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")}`);
      }
      if (registratie.eindTijd) {
        const eind = new Date(registratie.eindTijd);
        setEindTijd(`${eind.getHours().toString().padStart(2, "0")}:${eind.getMinutes().toString().padStart(2, "0")}`);
      }
    } else {
      setProjectId(projecten[0]?.id ? String(projecten[0].id) : "");
      setOmschrijving("");
      setDatum(new Date().toISOString().split("T")[0]);
      setStartTijd("09:00");
      setEindTijd("10:00");
      setCategorie("development");
    }
    setFouten({});
  }, [open, registratie, projecten]);

  function valideer(): boolean {
    const f: Record<string, string> = {};
    if (!projectId) f.projectId = "Selecteer een project";
    if (!omschrijving.trim()) f.omschrijving = "Omschrijving is verplicht";
    if (!datum) f.datum = "Datum is verplicht";
    if (!startTijd) f.startTijd = "Starttijd is verplicht";
    if (!eindTijd) f.eindTijd = "Eindtijd is verplicht";
    if (startTijd && eindTijd && startTijd >= eindTijd) {
      f.eindTijd = "Eindtijd moet na starttijd liggen";
    }
    setFouten(f);
    return Object.keys(f).length === 0;
  }

  async function handleOpslaan() {
    if (!valideer()) return;
    setLaden(true);

    const startISO = new Date(`${datum}T${startTijd}:00`).toISOString();
    const eindISO = new Date(`${datum}T${eindTijd}:00`).toISOString();
    const startMs = new Date(startISO).getTime();
    const eindMs = new Date(eindISO).getTime();
    const duurMinuten = Math.round((eindMs - startMs) / 60000);

    try {
      const url = registratie
        ? `/api/tijdregistraties/${registratie.id}`
        : "/api/tijdregistraties";

      const res = await fetch(url, {
        method: registratie ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          omschrijving,
          startTijd: startISO,
          eindTijd: eindISO,
          duurMinuten,
          categorie,
          isHandmatig: registratie ? undefined : true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon niet opslaan");
      }

      addToast(registratie ? "Registratie bijgewerkt" : "Registratie toegevoegd");
      onOpgeslagen();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon niet opslaan", "fout");
    } finally {
      setLaden(false);
    }
  }

  const projectOpties = projecten.map((p) => ({
    waarde: String(p.id),
    label: `${p.naam} — ${p.klantNaam}`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel={registratie ? "Registratie bewerken" : "Handmatige invoer"}
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
          label="Project"
          verplicht
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          opties={[{ waarde: "", label: "Selecteer project..." }, ...projectOpties]}
          fout={fouten.projectId}
        />

        <FormField
          label="Omschrijving"
          verplicht
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
          placeholder="Wat heb je gedaan?"
          fout={fouten.omschrijving}
        />

        <FormField
          label="Datum"
          type="date"
          verplicht
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          fout={fouten.datum}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Starttijd"
            type="time"
            verplicht
            value={startTijd}
            onChange={(e) => setStartTijd(e.target.value)}
            fout={fouten.startTijd}
          />
          <FormField
            label="Eindtijd"
            type="time"
            verplicht
            value={eindTijd}
            onChange={(e) => setEindTijd(e.target.value)}
            fout={fouten.eindTijd}
          />
        </div>

        <SelectField
          label="Categorie"
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          opties={CATEGORIEEN}
        />

        {/* Duration preview */}
        {startTijd && eindTijd && startTijd < eindTijd && (
          <div className="bg-autronis-bg rounded-lg px-3 py-2 text-sm text-autronis-text-secondary">
            Duur:{" "}
            <span className="text-autronis-text-primary font-mono font-medium">
              {(() => {
                const startMs = new Date(`2000-01-01T${startTijd}`).getTime();
                const eindMs = new Date(`2000-01-01T${eindTijd}`).getTime();
                const min = Math.round((eindMs - startMs) / 60000);
                const h = Math.floor(min / 60);
                const m = min % 60;
                return `${h}u ${m}m`;
              })()}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
