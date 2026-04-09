"use client";

import { useState } from "react";
import { Send, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/hooks/use-toast";

interface ShareDocumentModalProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitel: string;
  klantNaam?: string;
}

export function ShareDocumentModal({
  open,
  onClose,
  documentId,
  documentTitel,
  klantNaam,
}: ShareDocumentModalProps) {
  const { addToast } = useToast();
  const [aan, setAan] = useState("");
  const [onderwerp, setOnderwerp] = useState(`Document: ${documentTitel}`);
  const [bericht, setBericht] = useState(
    `Beste${klantNaam ? ` ${klantNaam}` : ""},\n\nHierbij deel ik het document "${documentTitel}" met u.\n\nMet vriendelijke groet,\nAutronis`
  );
  const [includeContent, setIncludeContent] = useState(true);
  const [laden, setLaden] = useState(false);

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  async function handleVerstuur() {
    if (!aan.trim()) {
      addToast("Vul een ontvanger e-mailadres in", "fout");
      return;
    }
    if (!onderwerp.trim() || !bericht.trim()) {
      addToast("Onderwerp en bericht zijn verplicht", "fout");
      return;
    }

    setLaden(true);
    try {
      const res = await fetch(`/api/documenten/${documentId}/verstuur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aan: aan.trim(),
          onderwerp: onderwerp.trim(),
          bericht: bericht.trim(),
          documentTitel,
          includeContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Onbekende fout");
      }

      addToast("Document succesvol gedeeld via e-mail", "succes");
      onClose();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Kon e-mail niet versturen",
        "fout"
      );
    } finally {
      setLaden(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel="Document delen via e-mail"
      breedte="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleVerstuur}
            disabled={laden}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {laden ? "Versturen..." : "Versturen"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-autronis-bg border border-autronis-border">
          <FileText className="w-4 h-4 text-autronis-accent flex-shrink-0" />
          <span className="text-sm text-autronis-text-primary truncate">{documentTitel}</span>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Aan
          </label>
          <input
            type="email"
            value={aan}
            onChange={(e) => setAan(e.target.value)}
            className={inputClasses}
            placeholder="ontvanger@voorbeeld.nl"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Onderwerp
          </label>
          <input
            type="text"
            value={onderwerp}
            onChange={(e) => setOnderwerp(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Bericht
          </label>
          <textarea
            value={bericht}
            onChange={(e) => setBericht(e.target.value)}
            rows={6}
            className={`${inputClasses} resize-none`}
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={includeContent}
              onChange={(e) => setIncludeContent(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded-md border border-autronis-border bg-autronis-bg peer-checked:bg-autronis-accent peer-checked:border-autronis-accent transition-colors flex items-center justify-center">
              {includeContent && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-autronis-text-secondary group-hover:text-autronis-text-primary transition-colors">
            Document inhoud meesturen in de e-mail
          </span>
        </label>
      </div>
    </Modal>
  );
}
