"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/hooks/use-toast";

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadEmail: string;
  afzenderEmail: string;
  onVerstuurd?: () => void;
}

export function EmailComposer({
  open,
  onClose,
  leadId,
  leadEmail,
  afzenderEmail,
  onVerstuurd,
}: EmailComposerProps) {
  const { addToast } = useToast();
  const [onderwerp, setOnderwerp] = useState("");
  const [bericht, setBericht] = useState("");
  const [laden, setLaden] = useState(false);

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  async function handleVerstuur() {
    if (!onderwerp.trim() || !bericht.trim()) {
      addToast("Onderwerp en bericht zijn verplicht", "fout");
      return;
    }

    setLaden(true);
    try {
      const res = await fetch(`/api/klant-leads/${leadId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onderwerp, bericht }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Onbekende fout");
      }

      addToast("E-mail succesvol verstuurd", "succes");
      setOnderwerp("");
      setBericht("");
      onClose();
      onVerstuurd?.();
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
      titel="E-mail versturen"
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
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Van
          </label>
          <input
            type="text"
            value={afzenderEmail}
            readOnly
            className={`${inputClasses} opacity-60 cursor-not-allowed`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Aan
          </label>
          <input
            type="text"
            value={leadEmail}
            readOnly
            className={`${inputClasses} opacity-60 cursor-not-allowed`}
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
            placeholder="Onderwerp van de e-mail..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Bericht
          </label>
          <textarea
            value={bericht}
            onChange={(e) => setBericht(e.target.value)}
            rows={8}
            className={`${inputClasses} resize-none`}
            placeholder="Typ je bericht..."
          />
        </div>
      </div>
    </Modal>
  );
}
