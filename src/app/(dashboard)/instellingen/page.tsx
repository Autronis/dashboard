import { CheckCircle2 } from "lucide-react";

const fase1Features = [
  "Next.js 16 met Tailwind v4 en Drizzle ORM + SQLite",
  "Alle 15 databasetabellen aangemaakt",
  "Auth-systeem met iron-session (inlog- en uitlog-API-routes)",
  "Inlogpagina op /login",
  "Auth-beveiliging via proxy.ts",
  "Tailwind v4 met aangepaste autronis-* kleur-tokens",
  "Hulpfuncties: cn(), formatDatum(), formatBedrag()",
  "ThemeProvider met donker als standaardthema",
  "Sidebar, Header, ThemeToggle en AppShell-indeling",
  "Dashboard-groepsindeling met alle placeholderpagina's",
];

export default function InstellingenPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-autronis-text-primary">Instellingen</h1>
        <p className="text-autronis-text-secondary mt-1">Beheer je account en voorkeuren</p>
      </div>

      {/* Bedrijfsgegevens */}
      <section className="bg-autronis-card border border-autronis-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">
          Bedrijfsgegevens
        </h2>
        <p className="text-autronis-text-secondary text-sm">
          Bedrijfsgegevens kunnen hier worden beheerd. Functionaliteit beschikbaar in een toekomstige fase.
        </p>
      </section>

      {/* Gebruikersprofiel */}
      <section className="bg-autronis-card border border-autronis-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">
          Gebruikersprofiel
        </h2>
        <p className="text-autronis-text-secondary text-sm">
          Profielinstellingen zoals naam, e-mailadres en wachtwoord zijn binnenkort beschikbaar.
        </p>
      </section>

      {/* Wat is nieuw */}
      <section className="bg-autronis-card border border-autronis-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-1">
          Wat is nieuw
        </h2>
        <p className="text-autronis-text-secondary text-sm mb-5">
          Overzicht van functies geleverd in Fase 1
        </p>
        <ul className="space-y-3">
          {fase1Features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-autronis-success flex-shrink-0 mt-0.5" />
              <span className="text-sm text-autronis-text-primary">{feature}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
