"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useFocus } from "@/hooks/use-focus";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";

export function FocusReflectieModal() {
  const focus = useFocus();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [reflectie, setReflectie] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpslaan = async () => {
    setIsSaving(true);
    try {
      await focus.stop(reflectie || undefined);
      queryClient.invalidateQueries({ queryKey: ["focus-sessies"] });
      queryClient.invalidateQueries({ queryKey: ["focus-statistieken"] });
      addToast("Focus sessie opgeslagen!", "succes");
    } catch {
      addToast("Opslaan mislukt", "fout");
    } finally {
      setIsSaving(false);
      setReflectie("");
    }
  };

  const handleOverslaan = async () => {
    setIsSaving(true);
    try {
      await focus.stop();
      queryClient.invalidateQueries({ queryKey: ["focus-sessies"] });
      queryClient.invalidateQueries({ queryKey: ["focus-statistieken"] });
    } catch {
      addToast("Opslaan mislukt", "fout");
    } finally {
      setIsSaving(false);
      setReflectie("");
    }
  };

  return (
    <Modal
      open={focus.showReflectie}
      onClose={handleOverslaan}
      titel={focus.resterend <= 0 ? "Focus sessie voltooid!" : "Focus sessie gestopt"}
      breedte="md"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-autronis-accent/10 border border-autronis-accent/20">
          <CheckCircle className="w-6 h-6 text-autronis-accent flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-autronis-text-primary">
              {focus.projectNaam}
            </p>
            {focus.taakTitel && (
              <p className="text-xs text-autronis-text-secondary">
                {focus.taakTitel}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Wat heb je gedaan? (optioneel)
          </label>
          <textarea
            value={reflectie}
            onChange={(e) => setReflectie(e.target.value)}
            placeholder="Kort samenvatten wat je hebt bereikt..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 resize-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <button
              onClick={handleOverslaan}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-50"
            >
              Overslaan
            </button>
            <button
              onClick={handleOpslaan}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Opslaan"
              )}
            </button>
          </div>
          <button
            onClick={async () => {
              setIsSaving(true);
              try {
                await focus.stop(reflectie || undefined);
                queryClient.invalidateQueries({ queryKey: ["focus-sessies"] });
                queryClient.invalidateQueries({ queryKey: ["focus-statistieken"] });
                setReflectie("");
                // Direct opnieuw starten
                focus.openSetup();
              } catch {
                addToast("Opslaan mislukt", "fout");
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="w-full px-4 py-2.5 rounded-xl border border-autronis-accent/30 text-autronis-accent font-medium hover:bg-autronis-accent/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Nog een sessie starten
          </button>
        </div>
      </div>
    </Modal>
  );
}
