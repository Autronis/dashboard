const kpiCards = [
  { label: "Omzet deze maand", value: "—", kleur: "text-autronis-accent" },
  { label: "Gewerkte uren", value: "—", kleur: "text-autronis-success" },
  { label: "Actieve projecten", value: "—", kleur: "text-autronis-warning" },
  { label: "Openstaande facturen", value: "—", kleur: "text-autronis-danger" },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-autronis-text-primary">Dashboard</h1>
        <p className="text-autronis-text-secondary mt-1">Welkom terug bij Autronis</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-autronis-card border border-autronis-border rounded-xl p-5"
          >
            <p className="text-sm text-autronis-text-secondary mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.kleur}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
