import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PersoonlijkClient } from "./persoonlijk-client";

export default async function PersoonlijkPage() {
  const session = await getSession();
  if (!session.gebruiker || session.gebruiker.id !== 1) {
    redirect("/");
  }

  return <PersoonlijkClient />;
}
