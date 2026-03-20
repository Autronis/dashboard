"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon?: ReactNode;
  trend?: { value: number; label?: string }; // percentage change
  target?: { current: number; goal: number }; // progress bar
  color?: "accent" | "emerald" | "orange" | "red" | "blue" | "purple";
  index?: number;
  className?: string;
}

const colorMap = {
  accent: { bg: "from-autronis-accent/10", text: "text-autronis-accent", bar: "bg-autronis-accent" },
  emerald: { bg: "from-emerald-500/10", text: "text-emerald-400", bar: "bg-emerald-500" },
  orange: { bg: "from-orange-500/10", text: "text-orange-400", bar: "bg-orange-500" },
  red: { bg: "from-red-500/10", text: "text-red-400", bar: "bg-red-500" },
  blue: { bg: "from-blue-500/10", text: "text-blue-400", bar: "bg-blue-500" },
  purple: { bg: "from-purple-500/10", text: "text-purple-400", bar: "bg-purple-500" },
};

export function KPICard({
  label,
  value,
  format,
  icon,
  trend,
  target,
  color = "accent",
  index = 0,
  className,
}: KPICardProps) {
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "bg-gradient-to-br to-autronis-card border border-autronis-border rounded-xl p-3 sm:p-4 card-glow relative overflow-hidden",
        c.bg,
        className
      )}
    >
      {/* Icon top-left with glow */}
      {icon && (
        <div className={cn("mb-2 icon-glow", c.text)}>
          {icon}
        </div>
      )}

      {/* Label */}
      <p className="text-xs font-medium text-autronis-text-secondary mb-0.5">{label}</p>

      {/* Value */}
      <div className="flex items-end justify-between gap-2">
        <AnimatedNumber
          value={value}
          format={format}
          className={cn("text-lg sm:text-2xl font-bold tabular-nums", c.text)}
        />

        {/* Trend indicator */}
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg",
            trend.value > 0 ? "text-emerald-400 bg-emerald-500/10" :
            trend.value < 0 ? "text-red-400 bg-red-500/10" :
            "text-autronis-text-secondary bg-white/5"
          )}>
            {trend.value > 0 ? <TrendingUp className="w-3 h-3" /> :
             trend.value < 0 ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            <span className="tabular-nums">{trend.value > 0 ? "+" : ""}{trend.value}%</span>
            {trend.label && <span className="text-autronis-text-tertiary ml-1">{trend.label}</span>}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {target && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-autronis-text-secondary mb-1">
            <span>{target.current} / {target.goal}</span>
            <span className="tabular-nums">{Math.min(100, Math.round((target.current / target.goal) * 100))}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (target.current / target.goal) * 100)}%` }}
              transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
              className={cn("h-full rounded-full", c.bar)}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
