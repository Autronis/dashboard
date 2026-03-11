import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import type { SessionGebruiker } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.gebruiker) {
    redirect("/login");
  }

  const gebruiker: SessionGebruiker = {
    id: session.gebruiker.id,
    naam: session.gebruiker.naam,
    email: session.gebruiker.email,
    rol: session.gebruiker.rol,
    themaVoorkeur: session.gebruiker.themaVoorkeur ?? "donker",
  };

  return <AppShell gebruiker={gebruiker}>{children}</AppShell>;
}
