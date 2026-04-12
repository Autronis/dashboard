"use client";

import { useToast } from "@/hooks/use-toast";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[280px] max-w-[400px] animate-slide-in",
            "border backdrop-blur-sm",
            toast.type === "succes" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
            toast.type === "fout" && "bg-red-500/10 border-red-500/30 text-red-400",
            toast.type === "info" && "bg-blue-500/10 border-blue-500/30 text-blue-400"
          )}
        >
          {toast.type === "succes" && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          {toast.type === "fout" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          {toast.type === "info" && <Info className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm flex-1">{toast.bericht}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:opacity-70 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
