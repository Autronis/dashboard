import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-autronis-bg p-8">
      <div className="text-center max-w-md">
        <p className="text-7xl font-black text-autronis-accent mb-4">404</p>
        <h2 className="text-xl font-bold text-autronis-text-primary mb-2">Pagina niet gevonden</h2>
        <p className="text-sm text-autronis-text-secondary mb-6">
          Deze pagina bestaat niet of is verplaatst.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
        >
          Naar dashboard
        </Link>
      </div>
    </div>
  );
}
