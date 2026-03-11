import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  titel: string;
  beschrijving: string;
}

export function PlaceholderPage({ titel, beschrijving }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <div className="w-16 h-16 rounded-full bg-autronis-border flex items-center justify-center">
        <Construction className="w-8 h-8 text-autronis-accent" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-autronis-text-primary mb-2">{titel}</h1>
        <p className="text-autronis-text-secondary max-w-md">{beschrijving}</p>
      </div>
      <span className="px-4 py-2 rounded-full bg-autronis-accent/10 text-autronis-accent text-sm font-medium">
        Binnenkort beschikbaar
      </span>
    </div>
  );
}
