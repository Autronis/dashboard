"use client";

import { useCallback, useEffect, useState } from "react";
import { Sun, Smartphone, Moon, Plus, Check, Flame, X } from "lucide-react";

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

const SECTIES: { type: Habit["type"]; label: string; icon: typeof Sun }[] = [
  { type: "ochtend", label: "Ochtend", icon: Sun },
  { type: "hele_dag", label: "Hele dag", icon: Smartphone },
  { type: "avond", label: "Avond", icon: Moon },
];

export function PersoonlijkClient() {
  const [data, setData] = useState<DagResponse | null>(null);
  const [nieuweTodo, setNieuweTodo] = useState("");
  const [laden, setLaden] = useState(true);

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
      // ignore
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
      // ignore
    }
  };

  if (laden || !data) {
    return <div className="p-6 text-zinc-400">Laden...</div>;
  }

  const score = data.habits.filter((h) => h.gedaan).length;
  const totaal = data.habits.length;
  const datumLabel = new Date(data.datum).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-white">Persoonlijk</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{datumLabel}</span>
          <span className="font-semibold text-[#17B8A5]">{score}/{totaal}</span>
          <span className="flex items-center gap-1 text-orange-400">
            <Flame className="w-4 h-4" />
            {data.streak}
          </span>
        </div>
      </div>

      {/* Habits per sectie */}
      {SECTIES.map(({ type, label, icon: Icon }) => {
        const habitsInSectie = data.habits.filter((h) => h.type === type);
        if (habitsInSectie.length === 0) return null;
        return (
          <div key={type} className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-zinc-300">
              <Icon className="w-4 h-4" />
              {label}
            </div>
            <div className="space-y-1">
              {habitsInSectie.map((habit) => (
                <button
                  key={habit.id}
                  onClick={() => toggleHabit(habit)}
                  className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-white/5 transition"
                >
                  <div
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
                      habit.gedaan
                        ? "bg-[#17B8A5] border-[#17B8A5]"
                        : "border-zinc-600"
                    }`}
                  >
                    {habit.gedaan && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span
                    className={`flex-1 text-left ${
                      habit.gedaan ? "text-zinc-500 line-through" : "text-white"
                    }`}
                  >
                    {habit.naam}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Todos */}
      <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5">
        <div className="text-sm font-medium text-zinc-300 mb-3">To-do&apos;s</div>
        <div className="space-y-1 mb-3">
          {data.todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5 group">
              <button onClick={() => todoToggle(todo)}>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    todo.gedaan ? "bg-[#17B8A5] border-[#17B8A5]" : "border-zinc-600"
                  }`}
                >
                  {todo.gedaan === 1 && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
              <span className={`flex-1 ${todo.gedaan ? "text-zinc-500 line-through" : "text-white"}`}>
                {todo.titel}
              </span>
              <button
                onClick={() => todoVerwijderen(todo.id)}
                className="opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-4 h-4 text-zinc-500 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-zinc-500" />
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
      </div>

      {/* Heatmap */}
      <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5">
        <div className="text-sm font-medium text-zinc-300 mb-3">Laatste 14 dagen</div>
        <div className="grid grid-cols-7 gap-1.5">
          {data.weekHeatmap.map(({ datum, score }) => {
            const intensiteit = Math.min(score / 9, 1);
            const bg = score === 0 ? "bg-zinc-800" : "bg-[#17B8A5]";
            const opacity = score === 0 ? 1 : 0.3 + intensiteit * 0.7;
            return (
              <div
                key={datum}
                className={`aspect-square rounded ${bg}`}
                style={{ opacity }}
                title={`${datum}: ${score}/9`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
