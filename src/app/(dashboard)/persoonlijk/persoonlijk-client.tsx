"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Sun, Smartphone, Moon, Plus, Check, Flame, X } from "lucide-react";

// ─── Interfaces ─────────────────────────────────────────────────
interface Habit {
  id: number;
  naam: string;
  type: "ochtend" | "hele_dag" | "avond";
  tijd: string | null;
  volgorde: number;
  gedaan: boolean;
}

interface Todo {
  id: number;
  titel: string;
  gedaan: number;
}

interface DagResponse {
  datum: string;
  habits: Habit[];
  todos: Todo[];
  streak: number;
  weekHeatmap: { datum: string; score: number }[];
}

// ─── Constanten ─────────────────────────────────────────────────
const SECTIES: { type: Habit["type"]; label: string; icon: typeof Sun; kleur: string }[] = [
  { type: "ochtend", label: "Ochtend", icon: Sun, kleur: "text-amber-400" },
  { type: "hele_dag", label: "Hele dag", icon: Smartphone, kleur: "text-zinc-400" },
  { type: "avond", label: "Avond", icon: Moon, kleur: "text-indigo-400" },
];

// Streaks waarbij we een mijlpaal tonen
const MIJLPALEN = [3, 7, 14, 30];

// ─── AnimatedScore component ────────────────────────────────────
function AnimatedScore({ score, totaal }: { score: number; totaal: number }) {
  const motionWaarde = useMotionValue(score);
  const afgerond = useTransform(motionWaarde, (v) => Math.round(v));
  const [weergaveScore, setWeergaveScore] = useState(score);
  const isPerfect = score === totaal && totaal > 0;

  useEffect(() => {
    const controls = animate(motionWaarde, score, {
      duration: 0.4,
      ease: "easeOut",
    });
    const unsub = afgerond.on("change", (v) => setWeergaveScore(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [score, motionWaarde, afgerond]);

  return (
    <motion.span
      className={`text-4xl font-bold tabular-nums ${isPerfect ? "text-[#17B8A5]" : "text-white"}`}
      animate={isPerfect ? { textShadow: ["0 0 0px #17B8A5", "0 0 20px #17B8A5", "0 0 0px #17B8A5"] } : {}}
      transition={{ duration: 1.2, repeat: isPerfect ? 1 : 0 }}
    >
      {weergaveScore}
      <span className="text-2xl text-zinc-500 font-normal">/{totaal}</span>
    </motion.span>
  );
}

// ─── ProgressDots component ─────────────────────────────────────
function ProgressDots({ habits }: { habits: Habit[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {habits.map((habit) => (
        <motion.div
          key={habit.id}
          className="w-2.5 h-2.5 rounded-full border-2"
          animate={{
            backgroundColor: habit.gedaan ? "#17B8A5" : "transparent",
            borderColor: habit.gedaan ? "#17B8A5" : "#4B5563",
            boxShadow: habit.gedaan ? "0 0 6px #17B8A580" : "none",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          title={habit.naam}
        />
      ))}
    </div>
  );
}

// ─── Hoofdcomponent ─────────────────────────────────────────────
export function PersoonlijkClient() {
  const [data, setData] = useState<DagResponse | null>(null);
  const [nieuweTodo, setNieuweTodo] = useState("");
  const [laden, setLaden] = useState(true);
  const perfecteCelebrated = useRef(false);

  const ophalen = useCallback(async () => {
    try {
      const res = await fetch("/api/persoonlijk/dag");
      if (!res.ok) throw new Error("Kon niet ophalen");
      const json = (await res.json()) as DagResponse;
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    ophalen();
    const interval = setInterval(ophalen, 60000);
    return () => clearInterval(interval);
  }, [ophalen]);

  const toggleHabit = async (habit: Habit) => {
    if (!data) return;
    setData({
      ...data,
      habits: data.habits.map((h) => (h.id === habit.id ? { ...h, gedaan: !h.gedaan } : h)),
    });
    try {
      await fetch("/api/persoonlijk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId: habit.id, gedaan: !habit.gedaan }),
      });
      ophalen();
    } catch {
      ophalen();
    }
  };

  const todoToevoegen = async () => {
    const titel = nieuweTodo.trim();
    if (!titel) return;
    setNieuweTodo("");
    try {
      await fetch("/api/persoonlijk/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel }),
      });
      ophalen();
    } catch {
      // negeer fout
    }
  };

  const todoToggle = async (todo: Todo) => {
    if (!data) return;
    setData({
      ...data,
      todos: data.todos.map((t) => (t.id === todo.id ? { ...t, gedaan: t.gedaan ? 0 : 1 } : t)),
    });
    try {
      await fetch(`/api/persoonlijk/todo/${todo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gedaan: !todo.gedaan }),
      });
      ophalen();
    } catch {
      ophalen();
    }
  };

  const todoVerwijderen = async (todoId: number) => {
    try {
      await fetch(`/api/persoonlijk/todo/${todoId}`, { method: "DELETE" });
      ophalen();
    } catch {
      // negeer fout
    }
  };

  if (laden || !data) {
    return (
      <div className="p-6 flex items-center gap-2 text-zinc-400">
        <motion.div
          className="w-4 h-4 rounded-full bg-[#17B8A5]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        Laden...
      </div>
    );
  }

  const score = data.habits.filter((h) => h.gedaan).length;
  const totaal = data.habits.length;
  const isPerfect = score === totaal && totaal > 0;
  const heeftMijlpaal = MIJLPALEN.includes(data.streak);

  // Bijhouden dat we de perfecte dag slechts één keer per sessie vieren
  if (isPerfect && !perfecteCelebrated.current) {
    perfecteCelebrated.current = true;
  }

  const datumLabel = new Date(data.datum).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const vandaag = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Persoonlijk</h1>
          <span className="text-sm text-zinc-500">{datumLabel}</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Geanimeerde score */}
          <AnimatedScore score={score} totaal={totaal} />
          {/* Streak badge */}
          {data.streak > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <Flame className="w-4 h-4 text-orange-400" />
              </motion.div>
              <span className="text-orange-400 font-medium">{data.streak} dagen op rij</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <ProgressDots habits={data.habits} />

      {/* Mijlpaal banner */}
      <AnimatePresence>
        {heeftMijlpaal && data.streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-orange-400/10 border border-orange-400/20 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-orange-300"
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span>
              <strong>{data.streak} dagen op rij</strong> — volhouden
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Perfecte dag badge */}
      <AnimatePresence>
        {isPerfect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-[#17B8A5]/10 border border-[#17B8A5]/25 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-[#17B8A5]"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>Perfecte dag — alle gewoontes gedaan</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Habits per sectie */}
      {SECTIES.map(({ type, label, icon: Icon, kleur }) => {
        const habitsInSectie = data.habits.filter((h) => h.type === type);
        if (habitsInSectie.length === 0) return null;
        return (
          <motion.div
            key={type}
            className="bg-gradient-to-br from-[#192225] to-[#1A2528] border border-[#2A3538] rounded-2xl p-5"
            layout
          >
            <div className={`flex items-center gap-2 mb-3 text-sm font-medium ${kleur}`}>
              <Icon className="w-4 h-4" />
              {label}
            </div>
            <div className="space-y-1">
              {habitsInSectie.map((habit) => (
                <motion.button
                  key={habit.id}
                  onClick={() => toggleHabit(habit)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 py-3 px-2 rounded-lg transition-colors ${
                    habit.gedaan
                      ? "bg-[#17B8A5]/5 hover:bg-[#17B8A5]/8"
                      : "hover:bg-white/5"
                  }`}
                >
                  {/* Geanimeerd checkbox */}
                  <motion.div
                    whileTap={{ scale: 0.85 }}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                      habit.gedaan
                        ? "bg-[#17B8A5] border-[#17B8A5]"
                        : "border-zinc-600"
                    }`}
                    animate={{
                      boxShadow: habit.gedaan ? "0 0 8px #17B8A560" : "0 0 0px transparent",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <AnimatePresence mode="wait">
                      {habit.gedaan && (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          <Check className="w-4 h-4 text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <span
                    className={`flex-1 text-left text-sm transition-colors ${
                      habit.gedaan ? "text-zinc-500 line-through" : "text-white"
                    }`}
                  >
                    {habit.naam}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* To-do&apos;s */}
      <motion.div
        className="bg-gradient-to-br from-[#192225] to-[#1A2528] border border-[#2A3538] rounded-2xl p-5"
        layout
      >
        <div className="text-sm font-medium text-zinc-300 mb-3">To-do&apos;s</div>
        <div className="space-y-1 mb-3">
          <AnimatePresence>
            {data.todos.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-zinc-600 py-2 px-2"
              >
                Geen open to-do&apos;s &mdash; voeg er een toe &darr;
              </motion.p>
            )}
            {data.todos.map((todo) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5 group"
              >
                <motion.button
                  onClick={() => todoToggle(todo)}
                  whileTap={{ scale: 0.85 }}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      todo.gedaan ? "bg-[#17B8A5] border-[#17B8A5]" : "border-zinc-600"
                    }`}
                  >
                    {todo.gedaan === 1 && <Check className="w-3 h-3 text-white" />}
                  </div>
                </motion.button>
                <span className={`flex-1 text-sm ${todo.gedaan ? "text-zinc-500 line-through" : "text-white"}`}>
                  {todo.titel}
                </span>
                <motion.button
                  onClick={() => todoVerwijderen(todo.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  whileTap={{ scale: 0.85 }}
                >
                  <X className="w-4 h-4 text-zinc-500 hover:text-red-400" />
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 border-t border-[#2A3538] pt-3">
          <Plus className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={nieuweTodo}
            onChange={(e) => setNieuweTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") todoToevoegen();
            }}
            placeholder="Nieuwe to-do..."
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-600 text-sm"
          />
        </div>
      </motion.div>

      {/* Heatmap */}
      <div className="bg-gradient-to-br from-[#192225] to-[#1A2528] border border-[#2A3538] rounded-2xl p-5">
        <div className="text-sm font-medium text-zinc-300 mb-4">Laatste 14 dagen</div>
        <div className="grid grid-cols-7 gap-2">
          {data.weekHeatmap.map(({ datum, score: dagScore }) => {
            const isVandaag = datum === vandaag;
            const intensiteit = Math.min(dagScore / totaal, 1);
            const dagNummer = new Date(datum).getDate();

            return (
              <div key={datum} className="flex flex-col items-center gap-1">
                <motion.div
                  className={`aspect-square w-full rounded-md cursor-default ${
                    isVandaag ? "ring-2 ring-[#17B8A5] ring-offset-1 ring-offset-[#192225]" : ""
                  }`}
                  style={{
                    backgroundColor:
                      dagScore === 0
                        ? "#1E2D30"
                        : `rgba(23, 184, 165, ${0.2 + intensiteit * 0.8})`,
                  }}
                  whileHover={{ scale: 1.1, filter: "brightness(1.2)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  title={`${datum}: ${dagScore}/${totaal}`}
                />
                <span className="text-[10px] text-zinc-600 tabular-nums">{dagNummer}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
