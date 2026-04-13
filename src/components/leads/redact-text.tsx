"use client";

import { ReactNode } from "react";
import { useLeadsDemo } from "@/lib/leads-demo";
import { cn } from "@/lib/utils";

/**
 * Wrapped een tekst die in demo mode geblurd moet worden voor screenshots.
 * Buiten demo mode is het een transparante wrapper.
 */
export function RedactText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { demoMode } = useLeadsDemo();
  if (!demoMode) return <>{children}</>;
  return (
    <span
      className={cn(
        "inline-block bg-autronis-text-secondary/30 text-transparent rounded select-none",
        className
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}
