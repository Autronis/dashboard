"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BelastingrapportKnopProps {
  jaar: number;
}

export function BelastingrapportKnop({ jaar }: BelastingrapportKnopProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/kilometers/belastingrapport?jaar=${jaar}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon rapport niet genereren");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Autronis_Kilometerregistratie_${jaar}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast("Belastingrapport gedownload", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon rapport niet genereren", "fout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors hover:bg-autronis-card disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      Belastingrapport
    </button>
  );
}
