"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Gauge, Save, Check, AlertCircle, Camera, Trash2, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useKmStanden, useSaveKmStand, useKmStandFoto, useUploadKmStandFoto } from "@/hooks/queries/use-kilometers";
import { motion, AnimatePresence } from "framer-motion";

interface KmStandPanelProps {
  maand: number;
  jaar: number;
  zakelijkeKm: number; // from rittenData
}

export function KmStandPanel({ maand, jaar, zakelijkeKm }: KmStandPanelProps) {
  const { addToast } = useToast();
  const { data } = useKmStanden(jaar);
  const saveMutation = useSaveKmStand();
  const uploadMutation = useUploadKmStandFoto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [beginStand, setBeginStand] = useState("");
  const [eindStand, setEindStand] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Get current km-stand ID for this maand/jaar
  const huidigeStand = data?.standen.find((s) => s.maand === maand && s.jaar === jaar);
  const kmStandId = huidigeStand?.id ?? null;

  const { data: foto } = useKmStandFoto(kmStandId);

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !kmStandId) return;
    try {
      await uploadMutation.mutateAsync({ kmStandId, foto: file });
      addToast("Foto opgeslagen", "succes");
    } catch {
      addToast("Foto uploaden mislukt", "fout");
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFotoVerwijderen() {
    if (!foto) return;
    try {
      const res = await fetch(`/api/kilometers/km-stand/foto?id=${foto.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      addToast("Foto verwijderd", "succes");
    } catch {
      addToast("Foto verwijderen mislukt", "fout");
    }
  }

  // Pre-fill from existing data
  useEffect(() => {
    if (!data) return;
    const stand = data.standen.find((s) => s.maand === maand && s.jaar === jaar);
    if (stand) {
      setBeginStand(String(stand.beginStand));
      setEindStand(String(stand.eindStand));
    } else {
      // Pre-fill beginStand from previous month's eindStand
      const prevMaand = maand === 1 ? 12 : maand - 1;
      const prevJaar = maand === 1 ? jaar - 1 : jaar;
      const prev = data.standen.find((s) => s.maand === prevMaand && s.jaar === prevJaar);
      if (prev) {
        setBeginStand(String(prev.eindStand));
      } else if (data.huidigeStand != null) {
        setBeginStand(String(data.huidigeStand));
      } else {
        setBeginStand("");
      }
      setEindStand("");
    }
    setFout(null);
    setSaved(false);
  }, [data, maand, jaar]);

  const totaalGereden = beginStand && eindStand ? parseFloat(eindStand) - parseFloat(beginStand) : 0;
  const verschil = totaalGereden > 0 ? totaalGereden - zakelijkeKm : 0;

  async function handleSave() {
    setFout(null);
    const b = parseFloat(beginStand);
    const e = parseFloat(eindStand);

    if (isNaN(b) || isNaN(e)) {
      setFout("Vul beide waarden in.");
      return;
    }

    try {
      await saveMutation.mutateAsync({ jaar, maand, beginStand: b, eindStand: e });
      addToast("Km-stand opgeslagen", "succes");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kon niet opslaan";
      setFout(msg);
      addToast(msg, "fout");
    }
  }

  return (
    <div className="border border-autronis-border rounded-2xl p-5 bg-autronis-card">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-autronis-accent" />
        <span className="text-sm font-semibold text-autronis-text-primary">Km-stand</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
        {/* Begin */}
        <div>
          <label className="block text-xs text-autronis-text-secondary mb-1">Beginstand</label>
          <input
            type="number"
            value={beginStand}
            onChange={(e) => { setBeginStand(e.target.value); setFout(null); setSaved(false); }}
            placeholder="0"
            className="w-full px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-sm text-autronis-text-primary focus:border-autronis-accent focus:outline-none"
          />
        </div>

        {/* Eind */}
        <div>
          <label className="block text-xs text-autronis-text-secondary mb-1">Eindstand</label>
          <input
            type="number"
            value={eindStand}
            onChange={(e) => { setEindStand(e.target.value); setFout(null); setSaved(false); }}
            placeholder="0"
            className="w-full px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-sm text-autronis-text-primary focus:border-autronis-accent focus:outline-none"
          />
        </div>

        {/* Stats */}
        <div className="text-sm">
          {totaalGereden > 0 && (
            <>
              <div className="text-autronis-text-secondary text-xs">Totaal gereden</div>
              <div className="text-autronis-text-primary font-semibold">{Math.round(totaalGereden).toLocaleString("nl-NL")} km</div>
              {verschil > 0 && (
                <div className="text-xs text-autronis-text-secondary mt-0.5">
                  {Math.round(verschil).toLocaleString("nl-NL")} km privé
                </div>
              )}
            </>
          )}
        </div>

        {/* Save button */}
        <div>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !beginStand || !eindStand}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all w-full justify-center",
              saved
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg"
            )}
          >
            <AnimatePresence mode="wait">
              {saved ? (
                <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Opgeslagen
                </motion.span>
              ) : (
                <motion.span key="save" initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                  <Save className="w-4 h-4" /> Opslaan
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Foto km-stand */}
      {kmStandId && (
        <div className="mt-4 pt-4 border-t border-autronis-border">
          <div className="flex items-center gap-2 mb-2">
            <Image className="w-3.5 h-3.5 text-autronis-accent" />
            <span className="text-xs text-autronis-text-secondary">Foto km-stand (belastingbewijs)</span>
          </div>
          {foto ? (
            <div className="flex items-center gap-3">
              <a href={foto.bestandspad} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.bestandspad}
                  alt="Km-stand foto"
                  className="w-16 h-16 object-cover rounded-xl border border-autronis-border hover:opacity-80 transition-opacity"
                />
              </a>
              <button
                onClick={handleFotoVerwijderen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Verwijderen
              </button>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFotoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 w-full border border-dashed border-autronis-border rounded-xl text-sm text-autronis-text-secondary hover:border-autronis-accent hover:text-autronis-accent transition-colors",
                  uploadMutation.isPending && "opacity-50 cursor-not-allowed"
                )}
              >
                <Camera className="w-4 h-4" />
                {uploadMutation.isPending ? "Uploaden..." : "Foto toevoegen"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {fout && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="flex items-center gap-2 mt-3 text-sm text-red-400"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {fout}
        </motion.div>
      )}
    </div>
  );
}
