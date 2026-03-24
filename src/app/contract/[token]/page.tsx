"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  FileText,
  Shield,
  Handshake,
  Clock,
  Download,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { marked } from "marked";

interface Contract {
  id: number;
  titel: string;
  type: string;
  inhoud: string;
  status: string;
  ondertekendOp: string | null;
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof FileText; kleur: string }> = {
  samenwerkingsovereenkomst: { label: "Samenwerkingsovereenkomst", icon: Handshake, kleur: "#17B8A5" },
  sla: { label: "Service Level Agreement", icon: Clock, kleur: "#3B82F6" },
  nda: { label: "Geheimhoudingsovereenkomst", icon: Shield, kleur: "#A855F7" },
};

export default function OndertekenPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [ondertekening, setOndertekening] = useState(false);
  const [ondertekend, setOndertekend] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracten/onderteken/${token}`);
      if (!res.ok) {
        const d = await res.json();
        setFout(d.fout || "Contract niet gevonden.");
        return;
      }
      const d = await res.json();
      setContract(d.contract);
      if (d.contract.status === "ondertekend") setOndertekend(true);
    } catch {
      setFout("Er is iets misgegaan.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  async function handleOndertekenen() {
    setOndertekening(true);
    try {
      const res = await fetch(`/api/contracten/onderteken/${token}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout);
      }
      setOndertekend(true);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Ondertekenen mislukt");
    }
    setOndertekening(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1719] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#17B8A5] animate-spin" />
      </div>
    );
  }

  if (fout || !contract) {
    return (
      <div className="min-h-screen bg-[#0E1719] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Contract niet gevonden</h1>
          <p className="text-gray-400">{fout || "Deze link is ongeldig of verlopen."}</p>
        </div>
      </div>
    );
  }

  const typeCfg = TYPE_LABELS[contract.type] ?? TYPE_LABELS.samenwerkingsovereenkomst;
  const Icon = typeCfg.icon;
  const inhoudHtml = marked(contract.inhoud || "") as string;

  return (
    <div className="min-h-screen bg-[#0E1719] text-gray-100">
      {/* Header */}
      <div className="border-b border-[#2A3538] bg-[#192225]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${typeCfg.kleur}20` }}>
              <Icon className="w-5 h-5" style={{ color: typeCfg.kleur }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">{contract.titel}</h1>
              <p className="text-xs text-gray-400">{typeCfg.label}</p>
            </div>
          </div>
          <a
            href={`/api/contracten/${contract.id}/pdf`}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Contract inhoud */}
        <div
          className="prose prose-invert prose-sm max-w-none bg-[#192225] border border-[#2A3538] rounded-2xl p-8"
          dangerouslySetInnerHTML={{ __html: inhoudHtml }}
        />

        {/* Ondertekening sectie */}
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-6">
          <AnimatePresence mode="wait">
            {ondertekend ? (
              <motion.div
                key="ondertekend"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-3 py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </motion.div>
                <h2 className="text-lg font-bold text-white">Contract ondertekend</h2>
                <p className="text-gray-400 text-sm">
                  {contract.ondertekendOp
                    ? `Ondertekend op ${new Date(contract.ondertekendOp).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`
                    : "Bedankt voor het ondertekenen."}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-base font-semibold text-white">Contract ondertekenen</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Door te ondertekenen bevestigt u dat u het bovenstaande contract heeft gelezen en akkoord gaat met de inhoud.
                  </p>
                </div>

                <div className="bg-[#0E1719] border border-[#2A3538] rounded-xl p-4 text-sm text-gray-400">
                  <p>Uw digitale handtekening wordt vastgelegd met tijdstempel en IP-adres conform de eIDAS-verordening.</p>
                </div>

                <button
                  onClick={handleOndertekenen}
                  disabled={ondertekening}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#17B8A5] hover:bg-[#4DC9B4] text-[#0E1719] font-bold rounded-xl transition-colors disabled:opacity-50 text-sm shadow-lg shadow-[#17B8A5]/20"
                >
                  {ondertekening
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Verwerken...</>
                    : <><CheckCircle2 className="w-4 h-4" /> Ik ga akkoord en onderteken</>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-gray-600">
          Dit contract is opgesteld door Autronis · dashboard.autronis.nl
        </p>
      </div>
    </div>
  );
}
