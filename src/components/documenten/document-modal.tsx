"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { useCreateDocument, useGenerateDraft, useDocumenten } from "@/hooks/queries/use-documenten";
import { useKlanten } from "@/hooks/queries/use-klanten";
import { useToast } from "@/hooks/use-toast";
import { DocumentBase, DocumentType, DocumentPayload, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_CONFIG } from "@/types/documenten";
import { Sparkles, Loader2, ExternalLink } from "lucide-react";

interface InitialValues {
  titel?: string;
  type?: DocumentType;
  content?: string;
  klantId?: number;
  projectId?: number;
}

interface DocumentModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: DocumentType;
  initialValues?: InitialValues;
}

export function DocumentModal({ open, onClose, initialType, initialValues }: DocumentModalProps) {
  const [type, setType] = useState<DocumentType>(initialValues?.type ?? initialType ?? "notitie");
  const [titel, setTitel] = useState(initialValues?.titel ?? "");
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [klantId, setKlantId] = useState<number | undefined>();
  const [projectId, setProjectId] = useState<number | undefined>();

  const [status, setStatus] = useState("concept");
  const [startdatum, setStartdatum] = useState("");
  const [einddatum, setEinddatum] = useState("");
  const [bedrag, setBedrag] = useState("");
  const [subtype, setSubtype] = useState("overig");
  const [categorie, setCategorie] = useState("overig");
  const [urgentie, setUrgentie] = useState("normaal");
  const [gerelateerdAan, setGerelateerdAan] = useState("intern");
  const [datum, setDatum] = useState("");

  const { data: klantenData } = useKlanten();
  const klanten = klantenData?.klanten;
  const { data: allDocs } = useDocumenten();
  const createDocument = useCreateDocument();
  const generateDraft = useGenerateDraft();
  const { addToast } = useToast();

  useEffect(() => {
    if (open) {
      setType(initialValues?.type ?? initialType ?? "notitie");
      setTitel(initialValues?.titel ?? "");
      setContent(initialValues?.content ?? "");
      setKlantId(initialValues?.klantId);
      setProjectId(initialValues?.projectId);
      setStatus("concept");
      setStartdatum("");
      setEinddatum("");
      setBedrag("");
      setSubtype("overig");
      setCategorie("overig");
      setUrgentie("normaal");
      setGerelateerdAan("intern");
      setDatum("");
    }
  }, [open, initialType]);

  const selectedKlant = klanten?.find((k: { id: number }) => k.id === klantId) as { id: number; bedrijfsnaam: string } | undefined;

  async function handleAiDraft() {
    if (!titel) {
      addToast("Vul eerst een titel in", "info");
      return;
    }

    try {
      const result = await generateDraft.mutateAsync({
        type,
        titel,
        klantNaam: selectedKlant?.bedrijfsnaam,
        velden: {
          ...(status && { status }),
          ...(subtype && { subtype }),
          ...(categorie && { categorie }),
        },
      });
      setContent(result.content);
      addToast("AI draft gegenereerd", "succes");
    } catch {
      addToast("Kon AI draft niet genereren", "fout");
    }
  }

  async function handleOpslaan() {
    if (!titel) {
      addToast("Titel is verplicht", "info");
      return;
    }

    let payload: DocumentPayload;

    switch (type) {
      case "contract":
        payload = { type, titel, klantId, projectId, status: status as "concept" | "actief" | "verlopen", startdatum: startdatum || undefined, einddatum: einddatum || undefined, bedrag: bedrag ? parseFloat(bedrag) : undefined, content };
        break;
      case "klantdocument":
        payload = { type, titel, klantId, projectId, subtype: subtype as "proposal" | "oplevering" | "overig", content };
        break;
      case "intern":
        payload = { type, titel, categorie: categorie as "proces" | "handleiding" | "overig", content };
        break;
      case "belangrijke-info":
        payload = { type, titel, urgentie: urgentie as "hoog" | "normaal", gerelateerdAan: gerelateerdAan as "klant" | "project" | "intern", klantId, projectId, content };
        break;
      case "plan":
        payload = { type, titel, klantId, projectId, status: status as "concept" | "definitief", content };
        break;
      case "notitie":
        payload = { type, titel, klantId, projectId, subtype: subtype as "vergadering" | "brainstorm" | "overig", datum: datum || undefined, content };
        break;
    }

    try {
      const result = await createDocument.mutateAsync(payload);
      addToast("Document aangemaakt in Notion", "succes");
      if (result.document?.notionUrl) {
        window.open(result.document.notionUrl, "_blank");
      }
      onClose();
    } catch {
      addToast("Kon document niet aanmaken", "fout");
    }
  }

  const inputClass = "w-full rounded-lg bg-autronis-bg border border-autronis-border px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent";
  const labelClass = "block text-sm font-medium text-autronis-text-secondary mb-1";
  const selectClass = inputClass;

  return (
    <Modal open={open} onClose={onClose} titel="Nieuw document" breedte="lg">
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as DocumentType)} className={selectClass}>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Titel</label>
          <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Document titel..." className={inputClass} />
        </div>

        {["contract", "klantdocument", "belangrijke-info", "plan", "notitie"].includes(type) && (
          <div>
            <label className={labelClass}>Klant (optioneel)</label>
            <select value={klantId ?? ""} onChange={(e) => setKlantId(e.target.value ? parseInt(e.target.value) : undefined)} className={selectClass}>
              <option value="">Geen klant</option>
              {klanten?.map((k: { id: number; bedrijfsnaam: string }) => (
                <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>
              ))}
            </select>
          </div>
        )}

        {type === "contract" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                  <option value="concept">Concept</option>
                  <option value="actief">Actief</option>
                  <option value="verlopen">Verlopen</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Bedrag</label>
                <input type="number" value={bedrag} onChange={(e) => setBedrag(e.target.value)} placeholder="0.00" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Startdatum</label>
                <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Einddatum</label>
                <input type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)} className={inputClass} />
              </div>
            </div>
          </>
        )}

        {type === "klantdocument" && (
          <div>
            <label className={labelClass}>Subtype</label>
            <select value={subtype} onChange={(e) => setSubtype(e.target.value)} className={selectClass}>
              <option value="proposal">Proposal</option>
              <option value="oplevering">Oplevering</option>
              <option value="overig">Overig</option>
            </select>
          </div>
        )}

        {type === "intern" && (
          <div>
            <label className={labelClass}>Categorie</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={selectClass}>
              <option value="proces">Proces</option>
              <option value="handleiding">Handleiding</option>
              <option value="overig">Overig</option>
            </select>
          </div>
        )}

        {type === "belangrijke-info" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Urgentie</label>
              <select value={urgentie} onChange={(e) => setUrgentie(e.target.value)} className={selectClass}>
                <option value="normaal">Normaal</option>
                <option value="hoog">Hoog</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Gerelateerd aan</label>
              <select value={gerelateerdAan} onChange={(e) => setGerelateerdAan(e.target.value)} className={selectClass}>
                <option value="intern">Intern</option>
                <option value="klant">Klant</option>
                <option value="project">Project</option>
              </select>
            </div>
          </div>
        )}

        {type === "plan" && (
          <div>
            <label className={labelClass}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="concept">Concept</option>
              <option value="definitief">Definitief</option>
            </select>
          </div>
        )}

        {type === "notitie" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Subtype</label>
              <select value={subtype} onChange={(e) => setSubtype(e.target.value)} className={selectClass}>
                <option value="vergadering">Vergadering</option>
                <option value="brainstorm">Brainstorm</option>
                <option value="overig">Overig</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Datum</label>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass}>Content</label>
            <button
              onClick={handleAiDraft}
              disabled={generateDraft.isPending}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 transition-colors disabled:opacity-50"
            >
              {generateDraft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Draft
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Document inhoud..."
            rows={12}
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {/* Slimme suggesties */}
      {klantId && allDocs?.documenten && (() => {
        const suggesties = allDocs.documenten
          .filter((d: DocumentBase) => d.klantNaam === selectedKlant?.bedrijfsnaam && d.type === type)
          .slice(0, 3);
        if (suggesties.length === 0) return null;
        return (
          <div className="mt-4 p-3 rounded-lg bg-autronis-bg/50 border border-autronis-border">
            <p className="text-xs font-medium text-autronis-text-secondary mb-2">
              Bestaande documenten voor {selectedKlant?.bedrijfsnaam}
            </p>
            <div className="space-y-1.5">
              {suggesties.map((d: DocumentBase) => {
                const cfg = DOCUMENT_TYPE_CONFIG[d.type];
                return (
                  <a
                    key={d.notionId}
                    href={d.notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <span className="truncate flex-1">{d.titel}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </a>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
          Annuleren
        </button>
        <button
          onClick={handleOpslaan}
          disabled={createDocument.isPending || !titel}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-autronis-accent text-white hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
        >
          {createDocument.isPending ? "Opslaan..." : "Opslaan in Notion"}
        </button>
      </div>
    </Modal>
  );
}
