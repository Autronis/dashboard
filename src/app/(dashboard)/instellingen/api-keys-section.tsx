"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Copy, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ApiKey {
  id: number;
  naam: string;
  keyPrefix: string;
  permissions: string[];
  laatstGebruiktOp: string | null;
  aangemaaktOp: string;
}

interface CreatedKey extends ApiKey {
  volledigeKey: string;
}

function formatDatum(iso: string | null): string {
  if (!iso) return "nooit";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApiKeysSection() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [showNieuweKey, setShowNieuweKey] = useState<CreatedKey | null>(null);

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/api-keys");
      if (!res.ok) throw new Error("Kon API keys niet laden");
      return res.json();
    },
  });

  const maakKey = useMutation({
    mutationFn: async (naam: string) => {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam, permissions: [] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon key niet aanmaken");
      return json.key as CreatedKey;
    },
    onSuccess: (key) => {
      setShowNieuweKey(key);
      setNieuwNaam("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      addToast("API key aangemaakt — kopieer de key nu, je ziet 'm maar 1 keer", "succes");
    },
    onError: (err: Error) => {
      addToast(err.message, "fout");
    },
  });

  const verwijderKey = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon key niet verwijderen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      addToast("API key ingetrokken", "succes");
    },
  });

  const kopieer = (tekst: string) => {
    navigator.clipboard.writeText(tekst);
    addToast("Gekopieerd naar clipboard", "succes");
  };

  const handleCreate = () => {
    if (!nieuwNaam.trim()) {
      addToast("Geef een naam op voor de key", "fout");
      return;
    }
    maakKey.mutate(nieuwNaam.trim());
  };

  return (
    <section className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Key className="w-5 h-5 text-autronis-accent" />
        <h2 className="text-lg font-semibold text-autronis-text-primary">API Keys</h2>
      </div>

      <p className="text-sm text-autronis-text-secondary">
        Gebruik API keys voor de desktop agent, Claude Code hooks, en andere externe integraties.
        Na aanmaken zie je de volledige key maar <strong>één keer</strong>.
      </p>

      {/* Nieuwe key tonen na aanmaken */}
      {showNieuweKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Key aangemaakt — kopieer hem nu
          </div>
          <div className="flex items-center gap-2 bg-autronis-bg rounded-lg p-3 border border-autronis-border">
            <code className="flex-1 text-xs text-autronis-text-primary font-mono break-all">
              {showNieuweKey.volledigeKey}
            </code>
            <button
              onClick={() => kopieer(showNieuweKey.volledigeKey)}
              className="p-2 hover:bg-autronis-border/40 rounded-md transition shrink-0"
              title="Kopieer"
            >
              <Copy className="w-3.5 h-3.5 text-autronis-accent" />
            </button>
          </div>
          <div className="flex items-start gap-2 text-xs text-autronis-text-secondary">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
            <span>Na sluiten van dit scherm kun je de volledige key niet meer ophalen — sla hem ergens veilig op.</span>
          </div>
          <button
            onClick={() => setShowNieuweKey(null)}
            className="w-full text-xs text-autronis-text-secondary hover:text-autronis-text-primary py-1"
          >
            Sluiten
          </button>
        </div>
      )}

      {/* Nieuwe key aanmaken */}
      <div className="flex gap-2">
        <input
          type="text"
          value={nieuwNaam}
          onChange={(e) => setNieuwNaam(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Naam (bijv. 'claude-sync-syb' of 'desktop-agent')"
          className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
        />
        <button
          onClick={handleCreate}
          disabled={maakKey.isPending || !nieuwNaam.trim()}
          className={cn(
            "flex items-center gap-2 px-4 py-2 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-medium transition",
            maakKey.isPending || !nieuwNaam.trim()
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-autronis-accent/90"
          )}
        >
          <Plus className="w-4 h-4" />
          Nieuwe key
        </button>
      </div>

      {/* Bestaande keys */}
      <div className="space-y-2">
        {isLoading && (
          <div className="text-sm text-autronis-text-secondary py-4">Laden...</div>
        )}
        {!isLoading && (!data?.keys || data.keys.length === 0) && (
          <div className="text-sm text-autronis-text-secondary py-4 text-center">
            Nog geen API keys aangemaakt
          </div>
        )}
        {data?.keys?.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between gap-3 bg-autronis-bg rounded-xl p-3 border border-autronis-border/30"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-autronis-text-primary truncate">{key.naam}</span>
                <code className="text-xs text-autronis-text-secondary font-mono">{key.keyPrefix}</code>
              </div>
              <div className="text-xs text-autronis-text-secondary mt-0.5">
                Aangemaakt {formatDatum(key.aangemaaktOp)} · Laatst gebruikt {formatDatum(key.laatstGebruiktOp)}
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm(`"${key.naam}" intrekken? Dit kan niet ongedaan worden gemaakt.`)) {
                  verwijderKey.mutate(key.id);
                }
              }}
              disabled={verwijderKey.isPending}
              className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
              title="Intrekken"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
