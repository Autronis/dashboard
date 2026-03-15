"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentList } from "@/components/documenten/document-list";
import { DocumentModal } from "@/components/documenten/document-modal";
import { Plus } from "lucide-react";
import { DocumentType } from "@/types/documenten";

export default function DocumentenPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialType, setInitialType] = useState<DocumentType | undefined>();
  const searchParams = useSearchParams();

  useEffect(() => {
    const nieuwType = searchParams.get("nieuw");
    if (nieuwType) {
      setInitialType(nieuwType as DocumentType);
      setModalOpen(true);
      window.history.replaceState({}, "", "/documenten");
    }
  }, [searchParams]);

  function openModal(type?: DocumentType) {
    setInitialType(type);
    setModalOpen(true);
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary">Documenten</h1>
          <p className="text-sm text-autronis-text-secondary mt-1">Alle documenten in Notion</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent text-white text-sm font-medium hover:bg-autronis-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuw document
        </button>
      </div>

      <DocumentList />

      <DocumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialType={initialType}
      />
    </div>
  );
}
