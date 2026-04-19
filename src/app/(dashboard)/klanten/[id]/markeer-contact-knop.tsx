"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Handshake, Mail, Phone, CalendarDays, Linkedin, MessageCircle, MoreHorizontal, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Kanaal = "email" | "telefoon" | "meeting" | "linkedin" | "whatsapp" | "anders";

const kanaalOpties: Array<{ value: Kanaal; label: string; icon: typeof Mail; color: string }> = [
  { value: "email", label: "E-mail", icon: Mail, color: "text-sky-400" },
  { value: "telefoon", label: "Gebeld", icon: Phone, color: "text-emerald-400" },
  { value: "meeting", label: "Meeting", icon: CalendarDays, color: "text-purple-400" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-400" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-400" },
  { value: "anders", label: "Anders", icon: MoreHorizontal, color: "text-autronis-text-secondary" },
];

interface Props {
  klantId: number;
  compact?: boolean;
  onLogged?: () => void;
}

export function MarkeerContactKnop({ klantId, compact = false, onLogged }: Props) {
  const [open, setOpen] = useState(false);
  const [notitie, setNotitie] = useState("");
  const [geselecteerdKanaal, setGeselecteerdKanaal] = useState<Kanaal | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setGeselecteerdKanaal(null);
        setNotitie("");
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setGeselecteerdKanaal(null);
        setNotitie("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const mutation = useMutation({
    mutationFn: async ({ kanaal, notitieText }: { kanaal: Kanaal; notitieText: string }) => {
      const res = await fetch(`/api/klanten/${klantId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kanaal, notitie: notitieText || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.fout || "Contact loggen mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["klant", klantId] });
      queryClient.invalidateQueries({ queryKey: ["klanten"] });
      addToast("Contact gelogd", "succes");
      setOpen(false);
      setGeselecteerdKanaal(null);
      setNotitie("");
      onLogged?.();
    },
    onError: (e: Error) => {
      addToast(e.message, "fout");
    },
  });

  function logDirect(kanaal: Kanaal) {
    mutation.mutate({ kanaal, notitieText: "" });
  }

  function logMetNotitie() {
    if (!geselecteerdKanaal) return;
    mutation.mutate({ kanaal: geselecteerdKanaal, notitieText: notitie });
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={mutation.isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors border",
          compact
            ? "px-2 py-1 text-[11px] bg-autronis-bg/40 border-autronis-border text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30"
            : "px-3 py-1.5 text-xs bg-autronis-accent/10 border-autronis-accent/30 text-autronis-accent hover:bg-autronis-accent/15",
          mutation.isPending && "opacity-60 cursor-wait"
        )}
        title="Log contactmoment (reset laatste-contact teller)"
      >
        {mutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Handshake className={cn("w-3.5 h-3.5", compact ? "" : "")} />
        )}
        {compact ? "Contact" : "Markeer contact"}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-autronis-card border border-autronis-border rounded-xl shadow-xl shadow-black/40 p-2"
        >
          {geselecteerdKanaal === null ? (
            <>
              <p className="text-[10px] uppercase tracking-wide text-autronis-text-secondary/70 px-2 pt-1 pb-1.5">Via welk kanaal?</p>
              <div className="grid grid-cols-2 gap-1">
                {kanaalOpties.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => logDirect(opt.value)}
                      onContextMenu={(e) => { e.preventDefault(); setGeselecteerdKanaal(opt.value); }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-autronis-text-primary hover:bg-autronis-bg/70 transition-colors text-left"
                    >
                      <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", opt.color)} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="px-2 pt-2 pb-1">
                <p className="text-[10px] text-autronis-text-secondary/60">
                  Tip: rechtsklik op een kanaal om een notitie toe te voegen.
                </p>
              </div>
            </>
          ) : (
            <div className="p-1.5 space-y-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const opt = kanaalOpties.find((k) => k.value === geselecteerdKanaal)!;
                  const Icon = opt.icon;
                  return (
                    <span className={cn("inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-autronis-bg/70 border border-autronis-border", opt.color)}>
                      <Icon className="w-3 h-3" /> {opt.label}
                    </span>
                  );
                })()}
                <button
                  onClick={() => { setGeselecteerdKanaal(null); setNotitie(""); }}
                  className="text-[10px] text-autronis-text-secondary hover:text-autronis-text-primary ml-auto"
                >
                  wijzig
                </button>
              </div>
              <textarea
                value={notitie}
                onChange={(e) => setNotitie(e.target.value)}
                placeholder="Korte notitie (optioneel)…"
                rows={3}
                autoFocus
                className="w-full bg-autronis-bg/60 border border-autronis-border rounded-lg px-2.5 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/40 resize-none"
              />
              <button
                onClick={logMetNotitie}
                disabled={mutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-autronis-accent text-autronis-bg hover:bg-autronis-accent-hover transition-colors disabled:opacity-60"
              >
                {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Log contact
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
