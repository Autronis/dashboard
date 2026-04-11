"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Crosshair, Inbox, Settings2, Loader2, Bot, X, Send, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { useIdeeen, useCreateIdee, useConfidenceRecalc } from "@/hooks/queries/use-ideeen";
import type { Idee } from "@/hooks/queries/use-ideeen";
import { DecideTab } from "./decide-tab";
import { CaptureTab } from "./capture-tab";

export default function IdeeenPage() {
  const { addToast } = useToast();
  const { data: ideeen = [], isLoading } = useIdeeen();
  const confidenceRecalc = useConfidenceRecalc();
  const createMutation = useCreateIdee();
  const [activeTab, setActiveTab] = useState<"decide" | "capture">("decide");

  // DAAN spar state
  const [daanOpen, setDaanOpen] = useState(false);
  const [daanInput, setDaanInput] = useState("");
  const [daanMessages, setDaanMessages] = useState<Array<{ role: "user" | "daan"; text: string }>>([]);
  const [daanVragen, setDaanVragen] = useState<string[]>([]);
  const [daanVraagIndex, setDaanVraagIndex] = useState(0);
  const [daanOrigineelIdee, setDaanOrigineelIdee] = useState("");
  const [daanLoading, setDaanLoading] = useState(false);
  const [daanStap, setDaanStap] = useState<"input" | "vragen" | "klaar">("input");
  const daanChatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll DAAN chat
  useEffect(() => {
    if (daanChatRef.current) {
      daanChatRef.current.scrollTop = daanChatRef.current.scrollHeight;
    }
  }, [daanMessages, daanVraagIndex]);

  // DAAN handlers (call /api/ops-room/orchestrate)
  const handleDaanSynth = useCallback(async (opdracht: string, context: string) => {
    try {
      const res = await fetch("/api/ops-room/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opdracht, context, mode: "idee_synth" }),
      });
      const data = await res.json() as { fout?: string; naam?: string; categorie?: string; omschrijving?: string; uitwerking?: string; prioriteit?: string };
      if (data.fout) {
        setDaanMessages((prev) => [...prev, { role: "daan", text: `Fout: ${data.fout}` }]);
        return;
      }
      createMutation.mutate(
        { naam: data.naam ?? opdracht, categorie: data.categorie ?? null, omschrijving: data.omschrijving ?? null, uitwerking: data.uitwerking ?? null, prioriteit: data.prioriteit ?? "normaal" },
        {
          onSuccess: () => {
            setDaanMessages((prev) => [...prev, { role: "daan", text: `Idee "${data.naam}" is aangemaakt! Je vindt het in je backlog.` }]);
            setDaanStap("klaar");
            addToast(`Idee "${data.naam}" aangemaakt via Brent`, "succes");
          },
          onError: () => { setDaanMessages((prev) => [...prev, { role: "daan", text: "Kon het idee niet opslaan." }]); },
        }
      );
    } catch { setDaanMessages((prev) => [...prev, { role: "daan", text: "Er ging iets mis bij het uitwerken." }]); }
  }, [createMutation, addToast]);

  const handleDaanStart = useCallback(async () => {
    if (!daanInput.trim()) return;
    const idee = daanInput.trim();
    setDaanOrigineelIdee(idee);
    setDaanMessages([{ role: "user", text: idee }]);
    setDaanLoading(true);
    setDaanInput("");
    try {
      const res = await fetch("/api/ops-room/orchestrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opdracht: idee, mode: "intake" }) });
      const data = await res.json() as { mode?: string; vragen?: string[] };
      if (data.mode === "idee" && data.vragen && data.vragen.length > 0) {
        setDaanVragen(data.vragen);
        setDaanVraagIndex(0);
        setDaanStap("vragen");
        setDaanMessages((prev) => [...prev, { role: "daan", text: "Leuk idee! Laat me een paar vragen stellen om het concreter te maken." }, { role: "daan", text: data.vragen![0] }]);
      } else {
        setDaanMessages((prev) => [...prev, { role: "daan", text: "Dit klinkt als een concrete taak. Ik maak het direct aan als idee." }]);
        await handleDaanSynth(idee, "");
      }
    } catch { addToast("Brent kon niet bereikt worden", "fout"); setDaanStap("input"); } finally { setDaanLoading(false); }
  }, [daanInput, addToast, handleDaanSynth]);

  const handleDaanAntwoord = useCallback(async () => {
    if (!daanInput.trim()) return;
    const antwoord = daanInput.trim();
    setDaanInput("");
    setDaanMessages((prev) => [...prev, { role: "user", text: antwoord }]);
    const nextIndex = daanVraagIndex + 1;
    if (nextIndex < daanVragen.length) {
      setDaanVraagIndex(nextIndex);
      setDaanMessages((prev) => [...prev, { role: "daan", text: daanVragen[nextIndex] }]);
    } else {
      setDaanLoading(true);
      setDaanMessages((prev) => [...prev, { role: "daan", text: "Top, ik werk je idee uit..." }]);
      const context = daanMessages
        .filter((m) => m.role === "daan" || m.role === "user")
        .concat([{ role: "user", text: antwoord }])
        .slice(1)
        .map((m) => `${m.role === "daan" ? "DAAN" : "Sem"}: ${m.text}`)
        .join("\n");
      await handleDaanSynth(daanOrigineelIdee, context);
      setDaanLoading(false);
    }
  }, [daanInput, daanVraagIndex, daanVragen, daanMessages, daanOrigineelIdee, handleDaanSynth]);

  function resetDaan() {
    setDaanOpen(false);
    setDaanInput("");
    setDaanMessages([]);
    setDaanVragen([]);
    setDaanVraagIndex(0);
    setDaanOrigineelIdee("");
    setDaanLoading(false);
    setDaanStap("input");
  }

  const handleDaanSpar = useCallback((idee: Idee) => {
    setDaanInput(idee.naam);
    setDaanOpen(true);
  }, []);

  const handleRecalcAll = useCallback(() => {
    confidenceRecalc.mutate(undefined, {
      onSuccess: (data: { bijgewerkt?: number }) => addToast(`${data.bijgewerkt ?? 0} ideeën herberekend`, "succes"),
      onError: () => addToast("Herberekening mislukt", "fout"),
    });
  }, [confidenceRecalc, addToast]);

  const captureCount = ideeen.filter((i) => i.categorie === "inzicht").length;

  // Loading state
  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-3">
              <Lightbulb className="w-6 h-6 text-autronis-accent" />
              Ideeën
            </h1>
            <p className="text-sm text-autronis-text-secondary mt-1">Focus op wat je moet bouwen</p>
          </div>
          <button
            onClick={handleRecalcAll}
            disabled={confidenceRecalc.isPending}
            className="flex items-center gap-2 px-3 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-bg border border-autronis-border rounded-xl hover:border-autronis-accent/30 transition-colors"
          >
            <Settings2 className={cn("w-4 h-4", confidenceRecalc.isPending && "animate-spin")} />
            {confidenceRecalc.isPending ? "Berekenen..." : "Herbereken scores"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-autronis-bg border border-autronis-border rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("decide")}
            className={cn("flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors", activeTab === "decide" ? "bg-autronis-accent text-autronis-bg font-semibold" : "text-autronis-text-secondary hover:text-autronis-text-primary")}
          >
            <Crosshair className="w-4 h-4" /> Decide
          </button>
          <button
            onClick={() => setActiveTab("capture")}
            className={cn("flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors", activeTab === "capture" ? "bg-autronis-accent text-autronis-bg font-semibold" : "text-autronis-text-secondary hover:text-autronis-text-primary")}
          >
            <Inbox className="w-4 h-4" /> Capture
            {captureCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-autronis-accent/20 text-autronis-accent tabular-nums">{captureCount}</span>
            )}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "decide" ? (
          <DecideTab ideeen={ideeen} onDaanSpar={handleDaanSpar} />
        ) : (
          <CaptureTab ideeen={ideeen} />
        )}
      </div>

      {/* DAAN Spar Modal */}
      {daanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-autronis-card border border-autronis-accent/30 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between p-5 border-b border-autronis-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-autronis-accent/10 rounded-xl"><Bot className="w-5 h-5 text-autronis-accent" /></div>
                <div>
                  <h3 className="text-base font-semibold text-autronis-text-primary">Spar met Brent</h3>
                  <p className="text-xs text-autronis-text-secondary">Beschrijf je idee en Brent helpt het uitwerken</p>
                </div>
              </div>
              <button onClick={resetDaan} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div ref={daanChatRef} className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[200px]">
              {daanMessages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-10 h-10 text-autronis-accent/30 mx-auto mb-3" />
                  <p className="text-sm text-autronis-text-secondary">Beschrijf kort je idee en Brent stelt slimme vragen om het concreet te maken.</p>
                </div>
              )}
              {daanMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] px-4 py-2.5 rounded-2xl text-sm", msg.role === "user" ? "bg-autronis-accent text-autronis-bg rounded-br-md" : "bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-bl-md")}>
                    {msg.role === "daan" && <Bot className="w-3.5 h-3.5 text-autronis-accent inline mr-1.5 -mt-0.5" />}
                    {msg.text}
                  </div>
                </div>
              ))}
              {daanLoading && (
                <div className="flex justify-start">
                  <div className="bg-autronis-bg border border-autronis-border rounded-2xl rounded-bl-md px-4 py-2.5">
                    <Loader2 className="w-4 h-4 text-autronis-accent animate-spin" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-autronis-border">
              {daanStap === "klaar" ? (
                <button onClick={resetDaan} className="w-full px-4 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors">
                  Sluiten
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={daanInput}
                    onChange={(e) => setDaanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (daanStap === "input") void handleDaanStart();
                        else if (daanStap === "vragen") void handleDaanAntwoord();
                      }
                    }}
                    placeholder={daanStap === "input" ? "Beschrijf je idee..." : "Typ je antwoord..."}
                    disabled={daanLoading}
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors disabled:opacity-50"
                    autoFocus
                  />
                  <button
                    onClick={daanStap === "input" ? handleDaanStart : handleDaanAntwoord}
                    disabled={daanLoading || !daanInput.trim()}
                    className="p-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </PageTransition>
  );
}
