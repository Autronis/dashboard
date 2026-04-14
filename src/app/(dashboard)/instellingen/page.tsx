"use client";

import { useState } from "react";
import {
  Building2,
  User,
  Lock,
  Save,
  Euro,
  Clock,
  Bell,
  FolderSync,
  Loader2,
  Landmark,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useInstellingen, type Bedrijf, type Profiel } from "@/hooks/queries/use-instellingen";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { ApiKeysSection } from "./api-keys-section";

export default function InstellingenPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useInstellingen();

  const [bedrijf, setBedrijf] = useState<Bedrijf | null>(null);
  const [profiel, setProfiel] = useState<Profiel | null>(null);

  const [huidigWachtwoord, setHuidigWachtwoord] = useState("");
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [bevestigWachtwoord, setBevestigWachtwoord] = useState("");

  const [syncResultaten, setSyncResultaten] = useState<
    Array<{ naam: string; status: "aangemaakt" | "al_aanwezig" }>
  >([]);

  // Initialize local state from query data
  const currentBedrijf = bedrijf ?? data?.bedrijf ?? {
    id: null,
    bedrijfsnaam: "Autronis VOF",
    adres: "",
    kvkNummer: "",
    btwNummer: "",
    iban: "",
    email: "",
    telefoon: "",
    website: "",
    standaardBtw: 21,
    betalingstermijnDagen: 30,
    herinneringNaDagen: 7,
  };

  const currentProfiel = profiel ?? data?.profiel ?? {
    id: 0,
    naam: "",
    email: "",
    rol: "",
    uurtariefStandaard: null,
  };

  const bedrijfMutation = useMutation({
    mutationFn: async (body: Bedrijf) => {
      const res = await fetch("/api/instellingen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Onbekende fout");
      }
    },
    onSuccess: () => {
      addToast("Bedrijfsgegevens opgeslagen", "succes");
      queryClient.invalidateQueries({ queryKey: ["instellingen"] });
    },
    onError: (error: Error) => {
      addToast(error.message || "Kon niet opslaan", "fout");
    },
  });

  const profielMutation = useMutation({
    mutationFn: async (body: { naam: string; email: string; uurtariefStandaard: number | null }) => {
      const res = await fetch("/api/profiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Onbekende fout");
      }
    },
    onSuccess: () => {
      addToast("Profiel bijgewerkt", "succes");
      queryClient.invalidateQueries({ queryKey: ["instellingen"] });
    },
    onError: (error: Error) => {
      addToast(error.message || "Kon profiel niet opslaan", "fout");
    },
  });

  const wachtwoordMutation = useMutation({
    mutationFn: async (body: { huidigWachtwoord: string; nieuwWachtwoord: string }) => {
      const res = await fetch("/api/profiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Onbekende fout");
      }
    },
    onSuccess: () => {
      addToast("Wachtwoord gewijzigd", "succes");
      setHuidigWachtwoord("");
      setNieuwWachtwoord("");
      setBevestigWachtwoord("");
    },
    onError: (error: Error) => {
      addToast(error.message || "Kon wachtwoord niet wijzigen", "fout");
    },
  });

  // Revolut bank koppeling
  const revolutStatus = useQuery({
    queryKey: ["revolut-status"],
    queryFn: async () => {
      const res = await fetch("/api/revolut");
      if (!res.ok) throw new Error("Kon status niet ophalen");
      return res.json() as Promise<{
        gekoppeld: boolean;
        laatsteSyncOp?: string;
        accountId?: string;
        configured: boolean;
        authUrl?: string;
      }>;
    },
    staleTime: 60_000,
  });

  const revolutSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/revolut/sync", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Sync mislukt");
      }
      return res.json() as Promise<{
        nieuweTransacties: number;
        gedetecteerdeAbonnementen: string[];
      }>;
    },
    onSuccess: (data) => {
      addToast(
        data.nieuweTransacties > 0
          ? `${data.nieuweTransacties} transactie${data.nieuweTransacties === 1 ? "" : "s"} gesynchroniseerd${data.gedetecteerdeAbonnementen.length > 0 ? `, ${data.gedetecteerdeAbonnementen.length} abonnement(en) gedetecteerd` : ""}`
          : "Alles is up-to-date",
        "succes"
      );
      queryClient.invalidateQueries({ queryKey: ["revolut-status"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transacties"] });
      queryClient.invalidateQueries({ queryKey: ["abonnementen"] });
    },
    onError: (error: Error) => {
      addToast(error.message || "Revolut sync mislukt", "fout");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/project-sync", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Synchronisatie mislukt");
      }
      return res.json() as Promise<{
        resultaten: Array<{ naam: string; status: "aangemaakt" | "al_aanwezig" }>;
      }>;
    },
    onSuccess: (data) => {
      const nieuw = data.resultaten.filter((r) => r.status === "aangemaakt").length;
      setSyncResultaten(data.resultaten);
      addToast(
        nieuw > 0
          ? `${nieuw} nieuw${nieuw === 1 ? "" : "e"} project${nieuw === 1 ? "" : "en"} gesynchroniseerd`
          : "Alle projecten zijn al aanwezig",
        "succes"
      );
      queryClient.invalidateQueries({ queryKey: ["projecten"] });
    },
    onError: (error: Error) => {
      addToast(error.message || "Synchronisatie mislukt", "fout");
    },
  });

  function handleBedrijfOpslaan() {
    bedrijfMutation.mutate(currentBedrijf);
  }

  function handleProfielOpslaan() {
    if (!currentProfiel.naam.trim()) {
      addToast("Naam is verplicht", "fout");
      return;
    }
    if (!currentProfiel.email.trim()) {
      addToast("E-mail is verplicht", "fout");
      return;
    }
    profielMutation.mutate({
      naam: currentProfiel.naam,
      email: currentProfiel.email,
      uurtariefStandaard: currentProfiel.uurtariefStandaard,
    });
  }

  function handleWachtwoordWijzigen() {
    if (!huidigWachtwoord) {
      addToast("Vul je huidige wachtwoord in", "fout");
      return;
    }
    if (nieuwWachtwoord.length < 6) {
      addToast("Nieuw wachtwoord moet minimaal 6 tekens zijn", "fout");
      return;
    }
    if (nieuwWachtwoord !== bevestigWachtwoord) {
      addToast("Wachtwoorden komen niet overeen", "fout");
      return;
    }
    wachtwoordMutation.mutate({ huidigWachtwoord, nieuwWachtwoord });
  }

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header skeleton */}
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        {/* 3 card skeletons */}
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-autronis-text-primary">Instellingen</h1>
        <p className="text-base text-autronis-text-secondary mt-1">
          Beheer je bedrijfsgegevens en profiel
        </p>
      </div>

      {/* Bedrijfsgegevens */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
            <Building2 className="w-5 h-5 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">Bedrijfsgegevens</h2>
            <p className="text-sm text-autronis-text-secondary">Deze gegevens verschijnen op facturen</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Bedrijfsnaam</label>
            <input
              type="text"
              value={currentBedrijf.bedrijfsnaam}
              onChange={(e) => setBedrijf({ ...currentBedrijf, bedrijfsnaam: e.target.value })}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">E-mail (facturen)</label>
            <input
              type="email"
              value={currentBedrijf.email}
              onChange={(e) => setBedrijf({ ...currentBedrijf, email: e.target.value })}
              placeholder="zakelijk@autronis.com"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-autronis-text-secondary">Adres</label>
            <input
              type="text"
              value={currentBedrijf.adres}
              onChange={(e) => setBedrijf({ ...currentBedrijf, adres: e.target.value })}
              placeholder="Straat 1, 1234 AB Stad"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Telefoon</label>
            <input
              type="text"
              value={currentBedrijf.telefoon}
              onChange={(e) => setBedrijf({ ...currentBedrijf, telefoon: e.target.value })}
              placeholder="+31 6 12345678"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">IBAN</label>
            <input
              type="text"
              value={currentBedrijf.iban}
              onChange={(e) => setBedrijf({ ...currentBedrijf, iban: e.target.value })}
              placeholder="NL00 BANK 0000 0000 00"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Website</label>
            <input
              type="text"
              value={currentBedrijf.website}
              onChange={(e) => setBedrijf({ ...currentBedrijf, website: e.target.value })}
              placeholder="autronis.nl"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">KvK-nummer</label>
            <input
              type="text"
              value={currentBedrijf.kvkNummer}
              onChange={(e) => setBedrijf({ ...currentBedrijf, kvkNummer: e.target.value })}
              placeholder="12345678"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">BTW-nummer</label>
            <input
              type="text"
              value={currentBedrijf.btwNummer}
              onChange={(e) => setBedrijf({ ...currentBedrijf, btwNummer: e.target.value })}
              placeholder="NL000000000B01"
              className={inputClasses}
            />
          </div>
        </div>

        {/* Facturatie defaults */}
        <div className="mt-8 pt-6 border-t border-autronis-border">
          <h3 className="text-base font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
            <Euro className="w-4 h-4 text-autronis-accent" />
            Factuurstandaarden
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Standaard BTW %</label>
              <input
                type="number"
                value={currentBedrijf.standaardBtw}
                onChange={(e) => setBedrijf({ ...currentBedrijf, standaardBtw: Number(e.target.value) })}
                min={0}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Betalingstermijn (dagen)
              </label>
              <input
                type="number"
                value={currentBedrijf.betalingstermijnDagen}
                onChange={(e) => setBedrijf({ ...currentBedrijf, betalingstermijnDagen: Number(e.target.value) })}
                min={1}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Herinnering na (dagen)
              </label>
              <input
                type="number"
                value={currentBedrijf.herinneringNaDagen}
                onChange={(e) => setBedrijf({ ...currentBedrijf, herinneringNaDagen: Number(e.target.value) })}
                min={1}
                className={inputClasses}
              />
            </div>
          </div>

          {/* Google Calendar sync toggle — default uit zodat je agenda niet vol loopt */}
          <div className="mt-6 pt-6 border-t border-autronis-border space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label className="text-sm font-medium text-autronis-text-primary flex items-center gap-1.5">
                  <FolderSync className="w-3.5 h-3.5" />
                  Google Calendar sync
                </label>
                <p className="text-xs text-autronis-text-secondary mt-1 max-w-md">
                  Push taken met een deadline of geplande tijd automatisch naar je Google Calendar. Standaard uit — zet aan als je taken in je Google agenda wil zien verschijnen.
                </p>
              </div>
              <button
                onClick={() =>
                  setBedrijf({
                    ...currentBedrijf,
                    googleCalSyncEnabled: currentBedrijf.googleCalSyncEnabled === 1 ? 0 : 1,
                  })
                }
                className={
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 " +
                  (currentBedrijf.googleCalSyncEnabled === 1
                    ? "bg-autronis-accent"
                    : "bg-autronis-border")
                }
                aria-label="Google Calendar sync toggle"
              >
                <span
                  className={
                    "inline-block h-4 w-4 transform rounded-full bg-autronis-bg transition-transform " +
                    (currentBedrijf.googleCalSyncEnabled === 1 ? "translate-x-6" : "translate-x-1")
                  }
                />
              </button>
            </div>

            {/* Cleanup knop: verwijder bestaande Google Cal events die het dashboard ooit heeft gepushed */}
            <div className="rounded-xl border border-autronis-border/50 bg-autronis-bg/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-autronis-text-primary">Bestaande events opruimen</p>
                  <p className="text-[11px] text-autronis-text-secondary mt-0.5 max-w-md">
                    Eenmalige schoonmaak: verwijder alle bestaande Google Calendar events die het dashboard ooit heeft aangemaakt. Draait via jouw Google koppeling, alleen events die aan taken/agenda items gelinkt zijn worden geraakt.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm("Alle bestaande Google Cal events die door dit dashboard zijn aangemaakt verwijderen? Dit kan een paar seconden duren.")) return;
                    try {
                      const res = await fetch("/api/admin/google-cal-cleanup", { method: "POST" });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.fout || "Opruim mislukt");
                      addToast(
                        `${data.verwijderd} events verwijderd${data.alWeg > 0 ? `, ${data.alWeg} waren al weg` : ""}${data.fouten > 0 ? `, ${data.fouten} fouten` : ""}`,
                        data.fouten > 0 ? "fout" : "succes"
                      );
                    } catch (err) {
                      addToast(err instanceof Error ? err.message : "Opruim mislukt", "fout");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors flex-shrink-0"
                >
                  <XCircle className="w-3 h-3" />
                  Ruim op
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleBedrijfOpslaan}
            disabled={bedrijfMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {bedrijfMutation.isPending ? "Opslaan..." : "Bedrijfsgegevens opslaan"}
          </button>
        </div>
      </div>

      {/* Profiel */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
            <User className="w-5 h-5 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">Mijn profiel</h2>
            <p className="text-sm text-autronis-text-secondary">
              {currentProfiel.rol === "admin" ? "Beheerder" : "Gebruiker"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Naam</label>
            <input
              type="text"
              value={currentProfiel.naam}
              onChange={(e) => setProfiel({ ...currentProfiel, naam: e.target.value })}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">E-mail</label>
            <input
              type="email"
              value={currentProfiel.email}
              onChange={(e) => setProfiel({ ...currentProfiel, email: e.target.value })}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Standaard uurtarief</label>
            <input
              type="number"
              value={currentProfiel.uurtariefStandaard || ""}
              onChange={(e) => setProfiel({ ...currentProfiel, uurtariefStandaard: e.target.value ? Number(e.target.value) : null })}
              min={0}
              step={0.01}
              placeholder="0,00"
              className={inputClasses}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleProfielOpslaan}
            disabled={profielMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {profielMutation.isPending ? "Opslaan..." : "Profiel opslaan"}
          </button>
        </div>
      </div>

      {/* Wachtwoord wijzigen */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
            <Lock className="w-5 h-5 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">Wachtwoord wijzigen</h2>
            <p className="text-sm text-autronis-text-secondary">Minimaal 6 tekens</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-autronis-text-secondary">Huidig wachtwoord</label>
            <input
              type="password"
              value={huidigWachtwoord}
              onChange={(e) => setHuidigWachtwoord(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Nieuw wachtwoord</label>
            <input
              type="password"
              value={nieuwWachtwoord}
              onChange={(e) => setNieuwWachtwoord(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Bevestig nieuw wachtwoord</label>
            <input
              type="password"
              value={bevestigWachtwoord}
              onChange={(e) => setBevestigWachtwoord(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleWachtwoordWijzigen}
            disabled={wachtwoordMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {wachtwoordMutation.isPending ? "Wijzigen..." : "Wachtwoord wijzigen"}
          </button>
        </div>
      </div>

      {/* Bank Koppeling (Revolut) */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-500/10 rounded-xl">
            <Landmark className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">Bank koppeling</h2>
            <p className="text-sm text-autronis-text-secondary">
              Koppel je Revolut Business account om transacties automatisch te synchroniseren en abonnementen te detecteren.
            </p>
          </div>
        </div>

        {revolutStatus.isLoading ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : !revolutStatus.data?.configured ? (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">Nog niet geconfigureerd</p>
                <p className="text-xs text-autronis-text-secondary mt-1">
                  Voeg <code className="px-1.5 py-0.5 bg-autronis-bg rounded text-autronis-accent">REVOLUT_CLIENT_ID</code> en <code className="px-1.5 py-0.5 bg-autronis-bg rounded text-autronis-accent">REVOLUT_PRIVATE_KEY</code> toe aan je .env.local.
                  Je hebt hiervoor een Revolut Business Grow plan nodig (€30/maand).
                </p>
              </div>
            </div>
          </div>
        ) : revolutStatus.data?.gekoppeld ? (
          <div className="space-y-4">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-400">Revolut gekoppeld</p>
                  {revolutStatus.data.laatsteSyncOp && (
                    <p className="text-xs text-autronis-text-secondary mt-0.5">
                      Laatste sync: {new Date(revolutStatus.data.laatsteSyncOp).toLocaleString("nl-NL")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => revolutSyncMutation.mutate()}
                  disabled={revolutSyncMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {revolutSyncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {revolutSyncMutation.isPending ? "Syncing..." : "Sync nu"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-autronis-bg rounded-xl p-3 border border-autronis-border">
                <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wider">Status</p>
                <p className="text-sm font-semibold text-emerald-400 mt-1">Actief</p>
              </div>
              <div className="bg-autronis-bg rounded-xl p-3 border border-autronis-border">
                <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wider">Account</p>
                <p className="text-sm font-semibold text-autronis-text-primary mt-1">EUR</p>
              </div>
              <div className="bg-autronis-bg rounded-xl p-3 border border-autronis-border">
                <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wider">Sync</p>
                <p className="text-sm font-semibold text-autronis-text-primary mt-1">Automatisch</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-autronis-bg/50 border border-autronis-border rounded-xl p-4">
              <p className="text-sm text-autronis-text-secondary">
                API credentials zijn geconfigureerd. Klik op de knop om je Revolut account te koppelen.
              </p>
            </div>
            <a
              href={revolutStatus.data.authUrl}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
            >
              <ExternalLink className="w-4 h-4" />
              Koppel Revolut
            </a>
          </div>
        )}
      </div>

      {/* Project Synchronisatie */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
            <FolderSync className="w-5 h-5 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">Project Synchronisatie</h2>
            <p className="text-sm text-autronis-text-secondary">
              Scan de Projects map en importeer nieuwe projecten automatisch naar het dashboard en Notion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderSync className="w-4 h-4" />
            )}
            {syncMutation.isPending ? "Synchroniseren..." : "Synchroniseren"}
          </button>
        </div>

        {syncResultaten.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-autronis-text-secondary mb-3">Resultaten</h3>
            {syncResultaten.map((r) => (
              <div
                key={r.naam}
                className="flex items-center justify-between bg-autronis-bg rounded-xl px-4 py-2.5 border border-autronis-border"
              >
                <span className="text-sm text-autronis-text-primary">{r.naam}</span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    r.status === "aangemaakt"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-autronis-text-secondary/15 text-autronis-text-secondary"
                  }`}
                >
                  {r.status === "aangemaakt" ? "Aangemaakt" : "Al aanwezig"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Keys */}
      <ApiKeysSection />
    </div>
    </PageTransition>
  );
}
