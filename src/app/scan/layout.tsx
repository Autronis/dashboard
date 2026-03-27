import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Autronis Scanner",
  description: "Scan bonnetjes en facturen",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scanner",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1a",
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
