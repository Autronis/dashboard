"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, Star, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocatieSuggesties } from "@/hooks/queries/use-kilometers";

interface LocatieAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function LocatieAutocomplete({
  value,
  onChange,
  placeholder = "Typ locatie...",
  label,
  className,
}: LocatieAutocompleteProps) {
  const [zoekterm, setZoekterm] = useState(value);
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(zoekterm), 300);
    return () => clearTimeout(timer);
  }, [zoekterm]);

  useEffect(() => {
    setZoekterm(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: suggesties = [] } = useLocatieSuggesties(debounced);

  function handleSelect(locatie: string) {
    setZoekterm(locatie);
    onChange(locatie);
    setOpen(false);
  }

  function handleInputChange(val: string) {
    setZoekterm(val);
    onChange(val);
    if (val.length >= 2) setOpen(true);
    else setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      {label && (
        <label className="block text-xs text-[var(--autronis-text-muted)] mb-1.5 font-medium">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={zoekterm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => zoekterm.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-card)] px-4 py-2.5 text-sm text-[var(--autronis-text)] placeholder:text-[var(--autronis-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--autronis-accent)]/30 focus:border-[var(--autronis-accent)]"
        />
        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--autronis-text-muted)]" />
      </div>

      {open && suggesties.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-card)] shadow-lg overflow-hidden">
          {suggesties.map((s, i) => (
            <button
              key={`${s.locatie}-${i}`}
              type="button"
              onClick={() => handleSelect(s.locatie)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--autronis-accent)]/10 flex items-center justify-between border-b border-[var(--autronis-border)] last:border-0"
            >
              <span className="text-[var(--autronis-text)] truncate">{s.locatie}</span>
              {s.bron === "eigen" ? (
                <span className="flex items-center gap-1 text-xs text-[var(--autronis-accent)] shrink-0">
                  <Star className="w-3 h-3" /> {s.aantalGebruikt}x
                </span>
              ) : (
                <span className="text-xs text-[var(--autronis-text-muted)] shrink-0">
                  <Search className="w-3 h-3 inline mr-1" />Google
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
