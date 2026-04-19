"use client";

import { cn } from "@/lib/utils";
import { ComponentType, ReactNode, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: IconType;
  /** Optional right-side content (count, filters, actions) */
  aside?: ReactNode;
  /** Content padding — set to "none" when rendering a full-width table */
  padding?: "none" | "compact" | "default";
  children: ReactNode;
  className?: string;
}

/**
 * Unified card shell with optional header. Used wherever /leads/* renders a
 * titled section (tables, filter blocks, stat groups). Keeps border radius,
 * spacing and header typography identical across tabs.
 */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  aside,
  padding = "default",
  children,
  className,
}: SectionCardProps) {
  const bodyPadding = {
    none: "",
    compact: "p-4",
    default: "p-6",
  }[padding];

  return (
    <section
      className={cn(
        "rounded-2xl border border-autronis-border bg-autronis-card overflow-hidden",
        className
      )}
    >
      {(title || aside) && (
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-autronis-border">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="h-8 w-8 rounded-lg bg-autronis-accent/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-autronis-accent" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold text-autronis-text-primary truncate">{title}</h2>
              )}
              {subtitle && (
                <p className="text-xs text-autronis-text-secondary mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {aside && <div className="flex items-center gap-2 flex-shrink-0">{aside}</div>}
        </header>
      )}
      {bodyPadding ? <div className={bodyPadding}>{children}</div> : children}
    </section>
  );
}
