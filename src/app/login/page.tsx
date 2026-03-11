"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPagina() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [laden, setLaden] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFout(null);
    setLaden(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, wachtwoord }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFout(data.fout ?? "Er is een fout opgetreden. Probeer het opnieuw.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setFout("Kan geen verbinding maken met de server. Probeer het opnieuw.");
    } finally {
      setLaden(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-autronis-bg px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-autronis-card rounded-xl border border-autronis-border shadow-lg px-8 py-10">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-autronis-accent tracking-tight">
              Autronis
            </h1>
            <p className="mt-2 text-sm text-autronis-text-secondary">
              Log in op het dashboard
            </p>
          </div>

          {/* Error message */}
          {fout && (
            <div className="mb-6 rounded-lg border border-autronis-danger bg-autronis-danger/10 px-4 py-3">
              <p className="text-sm text-autronis-danger">{fout}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block mb-1.5 text-sm font-medium text-autronis-text-primary"
              >
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={laden}
                placeholder="naam@bedrijf.nl"
                className="w-full rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary outline-none transition focus:border-autronis-accent focus:ring-2 focus:ring-autronis-accent/30 disabled:opacity-50"
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="wachtwoord"
                className="block mb-1.5 text-sm font-medium text-autronis-text-primary"
              >
                Wachtwoord
              </label>
              <input
                id="wachtwoord"
                type="password"
                autoComplete="current-password"
                required
                value={wachtwoord}
                onChange={(e) => setWachtwoord(e.target.value)}
                disabled={laden}
                placeholder="••••••••"
                className="w-full rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary outline-none transition focus:border-autronis-accent focus:ring-2 focus:ring-autronis-accent/30 disabled:opacity-50"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={laden || !email || !wachtwoord}
              className="mt-2 w-full rounded-lg bg-autronis-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-autronis-accent-hover focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {laden ? "Bezig met inloggen…" : "Inloggen"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
