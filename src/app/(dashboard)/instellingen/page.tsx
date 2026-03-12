"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  User,
  Lock,
  Save,
  Euro,
  Clock,
  Bell,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

interface Bedrijf {
  id: number | null;
  bedrijfsnaam: string;
  adres: string;
  kvkNummer: string;
  btwNummer: string;
  iban: string;
  email: string;
  telefoon: string;
  standaardBtw: number;
  betalingstermijnDagen: number;
  herinneringNaDagen: number;
}

interface Profiel {
  id: number;
  naam: string;
  email: string;
  rol: string;
  uurtariefStandaard: number | null;
}

export default function InstellingenPage() {
  const { addToast } = useToast();

  // Bedrijfsgegevens
  const [bedrijf, setBedrijf] = useState<Bedrijf>({
    id: null,
    bedrijfsnaam: "Autronis",
    adres: "",
    kvkNummer: "",
    btwNummer: "",
    iban: "",
    email: "",
    telefoon: "",
    standaardBtw: 21,
    betalingstermijnDagen: 30,
    herinneringNaDagen: 7,
  });
  const [bedrijfLaden, setBedrijfLaden] = useState(false);

  // Profiel
  const [profiel, setProfiel] = useState<Profiel>({
    id: 0,
    naam: "",
    email: "",
    rol: "",
    uurtariefStandaard: null,
  });
  const [profielLaden, setProfielLaden] = useState(false);

  // Wachtwoord
  const [huidigWachtwoord, setHuidigWachtwoord] = useState("");
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [bevestigWachtwoord, setBevestigWachtwoord] = useState("");
  const [wachtwoordLaden, setWachtwoordLaden] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [bedrijfRes, profielRes] = await Promise.all([
        fetch("/api/instellingen"),
        fetch("/api/profiel"),
      ]);
      if (bedrijfRes.ok) {
        const d = await bedrijfRes.json();
        setBedrijf({
          ...d.bedrijf,
          adres: d.bedrijf.adres || "",
          kvkNummer: d.bedrijf.kvkNummer || "",
          btwNummer: d.bedrijf.btwNummer || "",
          iban: d.bedrijf.iban || "",
          email: d.bedrijf.email || "",
          telefoon: d.bedrijf.telefoon || "",
        });
      }
      if (profielRes.ok) {
        const d = await profielRes.json();
        setProfiel(d.gebruiker);
      }
    } catch {
      addToast("Kon instellingen niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleBedrijfOpslaan() {
    setBedrijfLaden(true);
    try {
      const res = await fetch("/api/instellingen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bedrijf),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Onbekende fout");
      }
      addToast("Bedrijfsgegevens opgeslagen", "succes");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon niet opslaan", "fout");
    } finally {
      setBedrijfLaden(false);
    }
  }

  async function handleProfielOpslaan() {
    if (!profiel.naam.trim()) {
      addToast("Naam is verplicht", "fout");
      return;
    }
    if (!profiel.email.trim()) {
      addToast("E-mail is verplicht", "fout");
      return;
    }
    setProfielLaden(true);
    try {
      const res = await fetch("/api/profiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: profiel.naam,
          email: profiel.email,
          uurtariefStandaard: profiel.uurtariefStandaard,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Onbekende fout");
      }
      addToast("Profiel bijgewerkt", "succes");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon profiel niet opslaan", "fout");
    } finally {
      setProfielLaden(false);
    }
  }

  async function handleWachtwoordWijzigen() {
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
    setWachtwoordLaden(true);
    try {
      const res = await fetch("/api/profiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ huidigWachtwoord, nieuwWachtwoord }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Onbekende fout");
      }
      addToast("Wachtwoord gewijzigd", "succes");
      setHuidigWachtwoord("");
      setNieuwWachtwoord("");
      setBevestigWachtwoord("");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon wachtwoord niet wijzigen", "fout");
    } finally {
      setWachtwoordLaden(false);
    }
  }

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  if (loading) {
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
              value={bedrijf.bedrijfsnaam}
              onChange={(e) => setBedrijf({ ...bedrijf, bedrijfsnaam: e.target.value })}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">E-mail (facturen)</label>
            <input
              type="email"
              value={bedrijf.email}
              onChange={(e) => setBedrijf({ ...bedrijf, email: e.target.value })}
              placeholder="factuur@autronis.com"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-autronis-text-secondary">Adres</label>
            <input
              type="text"
              value={bedrijf.adres}
              onChange={(e) => setBedrijf({ ...bedrijf, adres: e.target.value })}
              placeholder="Straat 1, 1234 AB Stad"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Telefoon</label>
            <input
              type="text"
              value={bedrijf.telefoon}
              onChange={(e) => setBedrijf({ ...bedrijf, telefoon: e.target.value })}
              placeholder="+31 6 12345678"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">IBAN</label>
            <input
              type="text"
              value={bedrijf.iban}
              onChange={(e) => setBedrijf({ ...bedrijf, iban: e.target.value })}
              placeholder="NL00 BANK 0000 0000 00"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">KvK-nummer</label>
            <input
              type="text"
              value={bedrijf.kvkNummer}
              onChange={(e) => setBedrijf({ ...bedrijf, kvkNummer: e.target.value })}
              placeholder="12345678"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">BTW-nummer</label>
            <input
              type="text"
              value={bedrijf.btwNummer}
              onChange={(e) => setBedrijf({ ...bedrijf, btwNummer: e.target.value })}
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
                value={bedrijf.standaardBtw}
                onChange={(e) => setBedrijf({ ...bedrijf, standaardBtw: Number(e.target.value) })}
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
                value={bedrijf.betalingstermijnDagen}
                onChange={(e) => setBedrijf({ ...bedrijf, betalingstermijnDagen: Number(e.target.value) })}
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
                value={bedrijf.herinneringNaDagen}
                onChange={(e) => setBedrijf({ ...bedrijf, herinneringNaDagen: Number(e.target.value) })}
                min={1}
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleBedrijfOpslaan}
            disabled={bedrijfLaden}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {bedrijfLaden ? "Opslaan..." : "Bedrijfsgegevens opslaan"}
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
              {profiel.rol === "admin" ? "Beheerder" : "Gebruiker"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Naam</label>
            <input
              type="text"
              value={profiel.naam}
              onChange={(e) => setProfiel({ ...profiel, naam: e.target.value })}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">E-mail</label>
            <input
              type="email"
              value={profiel.email}
              onChange={(e) => setProfiel({ ...profiel, email: e.target.value })}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Standaard uurtarief</label>
            <input
              type="number"
              value={profiel.uurtariefStandaard || ""}
              onChange={(e) => setProfiel({ ...profiel, uurtariefStandaard: e.target.value ? Number(e.target.value) : null })}
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
            disabled={profielLaden}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {profielLaden ? "Opslaan..." : "Profiel opslaan"}
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
            disabled={wachtwoordLaden}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {wachtwoordLaden ? "Wijzigen..." : "Wachtwoord wijzigen"}
          </button>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
