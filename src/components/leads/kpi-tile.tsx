"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ComponentType, SVGProps } from "react";

export type LeadsKpiAccent =
  | "cyan"
  | "blue"
  | "green"
  | "purple"
  | "red"
  | "amber"
  | "pink";

const ACCENT: Record<
  LeadsKpiAccent,
  { iconBg: string; iconColor: string; valueColor: string; ring: string; gradient: string }
> = {
  cyan:   { iconBg: "bg-autronis-accent/15",  iconColor: "text-autronis-accent", valueColor: "text-autronis-accent", ring: "ring-autronis-accent/60",  gradient: "from-autronis-accent/[0.08] via-transparent" },
  blue:   { iconBg: "bg-blue-500/15",         iconColor: "text-blue-400",        valueColor: "text-blue-400",        ring: "ring-blue-500/60",          gradient: "from-blue-500/[0.08] via-transparent" },
  green:  { iconBg: "bg-emerald-500/15",      iconColor: "text-emerald-400",     valueColor: "text-emerald-400",     ring: "ring-emerald-500/60",       gradient: "from-emerald-500/[0.08] via-transparent" },
  purple: { iconBg: "bg-purple-500/15",       iconColor: "text-purple-400",      valueColor: "text-purple-400",      ring: "ring-purple-500/60",        gradient: "from-purple-500/[0.08] via-transparent" },
  red:    { iconBg: "bg-red-500/15",          iconColor: "text-red-400",         valueColor: "text-red-400",         ring: "ring-red-500/60",           gradient: "from-red-500/[0.08] via-transparent" },
  amber:  { iconBg: "bg-amber-500/15",        iconColor: "text-amber-400",       valueColor: "text-amber-400",       ring: "ring-amber-500/60",         gradient: "from-amber-500/[0.08] via-transparent" },
  pink:   { iconBg: "bg-pink-500/15",         iconColor: "text-pink-400",        valueColor: "text-pink-400",        ring: "ring-pink-500/60",          gradient: "from-pink-500/[0.08] via-transparent" },
};

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface LeadsKpiTileProps {
  label: string;
  value: number;
  icon: IconType;
  accent?: LeadsKpiAccent;
  sub?: string;
  active?: boolean;
  onClick?: () => void;
  index?: number;
  format?: (n: number) => string;
}

export function LeadsKpiTile({
  label,
  value,
  icon: Icon,
  accent = "cyan",
  sub,
  active = false,
  onClick,
  index = 0,
  format,
}: LeadsKpiTileProps) {
  const cfg = ACCENT[accent];
  const clickable = !!onClick;

  const Inner = (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80",
          cfg.gradient
        )}
      />
      <div className="relative">
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110",
            cfg.iconBg
          )}
        >
          <Icon className={cn("w-5 h-5", cfg.iconColor)} />
        </div>
        <div className={cn("text-3xl sm:text-4xl font-bold tabular-nums leading-none", cfg.valueColor)}>
          <AnimatedNumber value={value} format={format} />
        </div>
        <div className="text-[11px] uppercase tracking-wider text-autronis-text-secondary mt-2.5 font-semibold">
          {label}
        </div>
        {sub && (
          <div className="text-[11px] text-autronis-text-secondary/60 mt-1 truncate">{sub}</div>
        )}
      </div>
    </>
  );

  const base =
    "group relative overflow-hidden rounded-2xl border bg-autronis-card p-6 text-left transition-all duration-300";
  const borderCls = active
    ? cn("ring-2", cfg.ring, "border-transparent shadow-lg shadow-black/20")
    : "border-autronis-border hover:border-autronis-border-hover";

  const motionProps = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.05, duration: 0.3, ease: "easeOut" as const },
    whileHover: clickable ? { y: -3 } : undefined,
  };

  if (clickable) {
    return (
      <motion.button type="button" onClick={onClick} className={cn(base, borderCls)} {...motionProps}>
        {Inner}
      </motion.button>
    );
  }

  return (
    <motion.div className={cn(base, borderCls)} {...motionProps}>
      {Inner}
    </motion.div>
  );
}
