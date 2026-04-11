"use client";

import { useState, useEffect } from "react";
import { Plus, X, CornerDownLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOpgeslagenRoutes, useUseRoute, useAfstandBerekening, type OpgeslagenRoute } from "@/hooks/queries/use-kilometers";
import { LocatieAutocomplete } from "./LocatieAutocomplete";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const DOEL_TYPES = [
  { waarde: "klantbezoek", label: "Klantbezoek" },
  { waarde: "meeting", label: "Meeting" },
  { waarde: "inkoop", label: "Inkoop" },
  { waarde: "netwerk", label: "Netwerk" },
  { waarde: "training", label: "Training" },
  { waarde: "boekhouder", label: "Boekhouder" },
  { waarde: "overig", label: "Overig" },
];

export function MobileQuickEntry() {
  const [open, setOpen] = useState(false);
  const [vanLocatie, setVanLocatie] = useState("");
  const [naarLocatie, setNaarLocatie] = useState("");
  const [kilometers, setKilometers] = useState("");
  const [doelType, setDoelType] = useState("klantbezoek");
  const [autoKm, setAutoKm] = useState(false);
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { data: routesData } = useOpgeslagenRoutes();
  const useRoute = useUseRoute();
  const afstandMutation = useAfstandBerekening();

  const routes = routesData ?? [];

  // Auto-fill "Van" with most used departure
  useEffect(() => {
    if (!vanLocatie && routes.length > 0) {
      const topRoute = routes[0];
      if (topRoute) setVanLocatie(topRoute.vanLocatie);
    }
  }, [routes, vanLocatie]);

  // Auto-calculate distance
  useEffect(() => {
    if (vanLocatie.length >= 3 && naarLocatie.length >= 3) {
      const timer = setTimeout(async () => {
        const result = await afstandMutation.mutateAsync({ van: vanLocatie, naar: naarLocatie });
        if (result) {
          setKilometers(String(result.afstandKm));
          setAutoKm(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vanLocatie, naarLocatie]);

  const addRitMutation = useMutation({
    mutationFn: async (data: { datum: string; vanLocatie: string; naarLocatie: string; kilometers: number; doelType: string; isRetour: boolean }) => {
      const res = await fetch("/api/kilometers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kon rit niet opslaan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers"] });
    },
  });

  async function handleQuickRoute(route: OpgeslagenRoute) {
    const datum = new Date().toISOString().slice(0, 10);
    await addRitMutation.mutateAsync({
      datum,
      vanLocatie: route.vanLocatie,
      naarLocatie: route.naarLocatie,
      kilometers: route.kilometers,
      doelType: route.doelType ?? "overig",
      isRetour: false,
    });
    useRoute.mutate(route.id);
    addToast("Rit toegevoegd!", "succes");
    setOpen(false);
  }

  async function handleSubmit(isRetour: boolean) {
    const km = parseFloat(kilometers);
    if (!vanLocatie || !naarLocatie || !km || km <= 0) {
      addToast("Vul alle velden in", "fout");
      return;
    }
    const datum = new Date().toISOString().slice(0, 10);
    await addRitMutation.mutateAsync({
      datum, vanLocatie, naarLocatie, kilometers: km, doelType, isRetour,
    });
    addToast(isRetour ? "Retourrit toegevoegd!" : "Rit toegevoegd!", "succes");
    setNaarLocatie("");
    setKilometers("");
    setAutoKm(false);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-2xl bg-[var(--autronis-accent)] text-white shadow-lg shadow-[var(--autronis-accent)]/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/50 z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--autronis-card)] rounded-t-3xl p-5 pb-8"
            >
              <div className="w-10 h-1 bg-[var(--autronis-border)] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--autronis-text)]">Nieuwe rit</h3>
                <button onClick={() => setOpen(false)}>
                  <X className="w-5 h-5 text-[var(--autronis-text-muted)]" />
                </button>
              </div>

              {routes.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-[var(--autronis-text-muted)] mb-2 font-medium">Snelkeuze</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {routes.slice(0, 4).map((r: OpgeslagenRoute) => (
                      <button
                        key={r.id}
                        onClick={() => handleQuickRoute(r)}
                        className="shrink-0 px-3 py-2 rounded-xl bg-[var(--autronis-accent)]/10 border border-[var(--autronis-accent)]/20 text-left"
                      >
                        <div className="text-sm text-[var(--autronis-accent)]">{r.vanLocatie} → {r.naarLocatie}</div>
                        <div className="text-xs text-[var(--autronis-text-muted)]">{r.kilometers} km</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <LocatieAutocomplete value={vanLocatie} onChange={setVanLocatie} label="Van" placeholder="Vertrek..." />
                <LocatieAutocomplete value={naarLocatie} onChange={setNaarLocatie} label="Naar" placeholder="Bestemming..." />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-[var(--autronis-text-muted)] mb-1.5 font-medium">
                    Km {autoKm && <span className="text-[var(--autronis-accent)]">(auto)</span>}
                  </label>
                  <input
                    type="number"
                    value={kilometers}
                    onChange={(e) => { setKilometers(e.target.value); setAutoKm(false); }}
                    className="w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-bg)] px-4 py-2.5 text-sm text-[var(--autronis-text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--autronis-text-muted)] mb-1.5 font-medium">Type</label>
                  <select
                    value={doelType}
                    onChange={(e) => setDoelType(e.target.value)}
                    className="w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-bg)] px-4 py-2.5 text-sm text-[var(--autronis-text)]"
                  >
                    {DOEL_TYPES.map((d) => (
                      <option key={d.waarde} value={d.waarde}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={addRitMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-[var(--autronis-accent)] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  Toevoegen
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={addRitMutation.isPending}
                  className="flex-1 py-3 rounded-xl border border-[var(--autronis-accent)]/20 text-[var(--autronis-accent)] font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <CornerDownLeft className="w-4 h-4 inline mr-1" />
                  Retour
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
