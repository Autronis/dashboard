"use client";

import { redirect } from "next/navigation";

export default function FacturenPage() {
  redirect("/financien?tab=facturen");
}
