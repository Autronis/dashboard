"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  FileWarning,
  Clock,
  CheckCircle,
  UserPlus,
  X,
  CheckCheck,
  Calendar,
  Plane,
  ThumbsUp,
  MessageSquare,
  FileSignature,
  FileCheck,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNotificaties, type Notificatie } from "@/hooks/queries/use-notificaties";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const typeIcons: Record<Notificatie["type"], typeof Bell> = {
  factuur_te_laat: FileWarning,
  deadline_nadert: Clock,
  factuur_betaald: CheckCircle,
  taak_toegewezen: UserPlus,
  belasting_deadline: Calendar,
  verlof_aangevraagd: Plane,
  verlof_goedgekeurd: ThumbsUp,
  client_bericht: MessageSquare,
  proposal_ondertekend: FileSignature,
  offerte_geaccepteerd: FileCheck,
};

const typeKleuren: Record<Notificatie["type"], string> = {
  factuur_te_laat: "text-red-400",
  deadline_nadert: "text-amber-400",
  factuur_betaald: "text-emerald-400",
  taak_toegewezen: "text-autronis-accent",
  belasting_deadline: "text-orange-400",
  verlof_aangevraagd: "text-blue-400",
  verlof_goedgekeurd: "text-emerald-400",
  client_bericht: "text-purple-400",
  proposal_ondertekend: "text-emerald-400",
  offerte_geaccepteerd: "text-autronis-accent",
};

function tijdGeleden(datum: string): string {
  const nu = new Date();
  const then = new Date(datum);
  const diffMs = nu.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;

  const diffUur = Math.floor(diffMin / 60);
  if (diffUur < 24) return `${diffUur} uur geleden`;

  const diffDag = Math.floor(diffUur / 24);
  if (diffDag === 1) return "Gisteren";
  if (diffDag < 7) return `${diffDag} dagen geleden`;

  return then.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function NotificationCenter() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useNotificaties();
  const notificaties = data?.notificaties ?? [];
  const ongelezen = data?.ongelezen ?? 0;

  // Genereer notificaties bij mount
  useEffect(() => {
    fetch("/api/notificaties/genereer", { method: "POST" }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["notificaties"] });
    });
  }, [queryClient]);

  // Sluit panel als je buiten klikt
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const markeerAllesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notificaties", { method: "PUT" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificaties"] });
    },
  });

  const markeerGelezenMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notificaties/${id}`, { method: "PUT" });
      if (!res.ok) throw new Error();
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificaties"] });
    },
  });

  // Push notification state
  const [pushStatus, setPushStatus] = useState<"loading" | "granted" | "denied" | "default" | "unsupported">("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    // Check current permission
    const perm = Notification.permission;
    if (perm === "granted") {
      // Verify we have an active subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushStatus(sub ? "granted" : "default");
        });
      });
    } else {
      setPushStatus(perm as "denied" | "default");
    }
  }, []);

  const handlePushToggle = useCallback(async () => {
    if (pushStatus === "unsupported" || pushStatus === "denied") return;

    try {
      // Register service worker if not already
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      if (pushStatus === "granted") {
        // Unsubscribe
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setPushStatus("default");
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setPushStatus("denied");
          return;
        }

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });

        const subJson = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: subJson.keys,
          }),
        });

        setPushStatus("granted");
      }
    } catch {
      // Silently fail
    }
  }, [pushStatus]);

  function handleNotificatieKlik(notificatie: Notificatie) {
    if (notificatie.gelezen === 0) {
      markeerGelezenMutation.mutate(notificatie.id);
    }
    if (notificatie.link) {
      setOpen(false);
      router.push(notificatie.link);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
        aria-label="Notificaties"
      >
        <Bell className="w-5 h-5" />
        {ongelezen > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 tabular-nums">
            {ongelezen > 99 ? "99+" : ongelezen}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-autronis-card border border-autronis-border rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-autronis-border">
              <h3 className="text-sm font-semibold text-autronis-text-primary">
                Notificaties
              </h3>
              <div className="flex items-center gap-1">
                {ongelezen > 0 && (
                  <button
                    onClick={() => markeerAllesMutation.mutate()}
                    className="flex items-center gap-1 text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors px-2 py-1 rounded-lg hover:bg-autronis-accent/10"
                    title="Alles als gelezen markeren"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Alles gelezen
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notificaties.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-autronis-text-secondary">
                  Geen notificaties
                </div>
              ) : (
                notificaties.map((notificatie) => {
                  const Icon = typeIcons[notificatie.type];
                  const kleur = typeKleuren[notificatie.type];

                  return (
                    <button
                      key={notificatie.id}
                      onClick={() => handleNotificatieKlik(notificatie)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-autronis-border/50 transition-colors border-b border-autronis-border/50 last:border-0",
                        notificatie.gelezen === 0 && "bg-autronis-accent/5"
                      )}
                    >
                      <div className={cn("mt-0.5 flex-shrink-0", kleur)}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm leading-tight",
                            notificatie.gelezen === 0
                              ? "font-semibold text-autronis-text-primary"
                              : "text-autronis-text-secondary"
                          )}
                        >
                          {notificatie.titel}
                        </p>
                        {notificatie.omschrijving && (
                          <p className="text-xs text-autronis-text-secondary mt-0.5 truncate">
                            {notificatie.omschrijving}
                          </p>
                        )}
                        <p className="text-xs text-autronis-text-secondary/60 mt-1">
                          {tijdGeleden(notificatie.aangemaaktOp)}
                        </p>
                      </div>
                      {notificatie.gelezen === 0 && (
                        <div className="w-2 h-2 rounded-full bg-autronis-accent flex-shrink-0 mt-1.5" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Push notification toggle */}
            {pushStatus !== "unsupported" && (
              <div className="px-4 py-3 border-t border-autronis-border">
                <button
                  onClick={handlePushToggle}
                  disabled={pushStatus === "denied" || pushStatus === "loading"}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pushStatus === "granted"
                      ? "bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20"
                      : pushStatus === "denied"
                        ? "bg-autronis-border/50 text-autronis-text-secondary/50 cursor-not-allowed"
                        : "bg-autronis-border/50 text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border"
                  )}
                >
                  <BellRing className="w-3.5 h-3.5" />
                  {pushStatus === "granted"
                    ? "Push meldingen aan"
                    : pushStatus === "denied"
                      ? "Meldingen geblokkeerd in browser"
                      : pushStatus === "loading"
                        ? "Laden..."
                        : "Push meldingen inschakelen"}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
