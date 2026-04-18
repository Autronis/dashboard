import type { Metadata } from "next";
import UpworkClient from "./upwork-client";

export const metadata: Metadata = {
  title: "Upwork | Autronis Dashboard",
};

export default function UpworkPage() {
  return <UpworkClient />;
}
