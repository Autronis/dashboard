"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings as SettingsIcon,
  Loader2,
  Save,
  Zap,
  Mail,
  TestTube,
  AlertCircle,
  Globe,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLeadsDemo } from "@/lib/leads-demo";

interface WebhookConfig {
  id: string;
  label: string;
  description: string;
  icon: typeof Zap;
}

const WEBHOOKS: WebhookConfig[] = [
  {
    id: "email_generator_webhook_url",
    label: "Email Generator",
    description: "n8n webhook die cold emails genereert via Claude",
    icon: Mail,
  },
  {
    id: "scraper_webhook_url",
    label: "Scraper Webhook",
    description: "n8n webhook die LinkedIn scraper runs start",
    icon: Zap,
  },
  {
    id: "google_maps_scraper_webhook_url",
    label: "Google Maps Scraper",
    description: "n8n webhook die Google Maps scraper runs start",
    icon: Globe,
  },
  {
    id: "enrichment_webhook_url",
    label: "Enrichment Webhook",
    description: "n8n webhook die leads verrijkt (LinkedIn, website, contact info). Wordt nu vanuit Supabase edge function trigger-enrichment aangeroepen.",
    icon: Sparkles,
  },
];

export default function LeadsInstellingenPage() {
  const { addToast } = useToast();
  const { demoMode, setDemoMode } = useLeadsDemo();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads/settings");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSettings(data.settings ?? {});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setValue(id: string, value: string) {
    setEdited((curr) => ({ ...curr, [id]: value }));
  }

  async function save(id: string) {
    const value = edited[id] ?? settings[id] ?? "";
    setSavingKey(id);
    try {
      const res = await fetch("/api/leads/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setSettings((curr) => ({ ...curr, [id]: value }));
      setEdited((curr) => {
        const { [id]: _, ...rest } = curr;
        return rest;
      });
      addToast("Opgeslagen", "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Opslaan mislukt", "fout");
    } finally {
      setSavingKey(null);
    }
  }

  async function testWebhook(id: string) {
    setTestingId(id);
    try {
      const res = await fetch("/api/leads/edge-function/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      if (data.data?.success) {
        addToast(`Webhook OK (status ${data.data.status})`, "succes");
      } else {
        addToast(data.data?.error || "Webhook test faalde", "fout");
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Test mislukt", "fout");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-autronis-accent" />
          Lead Instellingen
        </h1>
        <p className="text-sm text-autronis-text-secondary mt-1">
          Configureer webhook URLs en email generator instellingen.
        </p>
      </div>

      {/* Demo mode toggle */}
      <div className="rounded-xl border border-autronis-border bg-autronis-card p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-autronis-accent/10 flex-shrink-0">
            {demoMode ? (
              <EyeOff className="w-4 h-4 text-autronis-accent" />
            ) : (
              <Eye className="w-4 h-4 text-autronis-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-autronis-text-primary">
              Demo mode
            </h3>
            <p className="text-xs text-autronis-text-secondary mt-0.5">
              Verbergt namen, emails en websites op de leads pagina&apos;s — handig
              voor screenshots. Wordt lokaal in je browser opgeslagen.
            </p>
          </div>
          <button
            onClick={() => {
              setDemoMode(!demoMode);
              addToast(
                demoMode ? "Demo mode uit" : "Demo mode aan — gevoelige velden zijn nu geredact",
                "succes"
              );
            }}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
              demoMode ? "bg-autronis-accent" : "bg-autronis-border"
            )}
            aria-label="Demo mode toggle"
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-autronis-bg transition-transform",
                demoMode ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Instellingen laden...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon instellingen niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {WEBHOOKS.map((webhook) => {
            const Icon = webhook.icon;
            const currentValue = edited[webhook.id] ?? settings[webhook.id] ?? "";
            const isEdited = edited[webhook.id] !== undefined && edited[webhook.id] !== settings[webhook.id];
            const isSaving = savingKey === webhook.id;
            const isTesting = testingId === webhook.id;

            return (
              <div
                key={webhook.id}
                className="rounded-xl border border-autronis-border bg-autronis-card p-5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-autronis-accent/10 flex-shrink-0">
                    <Icon className="w-4 h-4 text-autronis-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-autronis-text-primary">
                      {webhook.label}
                    </h3>
                    <p className="text-xs text-autronis-text-secondary mt-0.5">
                      {webhook.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={currentValue}
                    onChange={(e) => setValue(webhook.id, e.target.value)}
                    placeholder="https://n8n.srv1166699.hstgr.cloud/webhook/..."
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary font-mono placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                  />
                  <button
                    onClick={() => testWebhook(webhook.id)}
                    disabled={!currentValue || isTesting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors disabled:opacity-40"
                  >
                    {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                    Test
                  </button>
                  <button
                    onClick={() => save(webhook.id)}
                    disabled={!isEdited || isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Opslaan
                  </button>
                </div>
              </div>
            );
          })}

          {/* Info card */}
          <div className="rounded-xl border border-autronis-border/50 bg-autronis-card/30 p-4 flex items-start gap-2 text-xs text-autronis-text-secondary">
            <AlertCircle className="w-4 h-4 text-autronis-text-secondary/60 flex-shrink-0 mt-0.5" />
            <p>
              Webhook URLs worden opgeslagen in Supabase <code className="text-autronis-accent">app_settings</code> tabel. Andere
              instellingen (Brevo sender domains, dag limieten, warmup) staan in de{" "}
              <code className="text-autronis-accent">send_settings</code> tabel en worden beheerd vanuit de edge functions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
