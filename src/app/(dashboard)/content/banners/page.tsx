"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Zap,
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  Instagram,
  Linkedin,
  Quote,
  BarChart2,
  Lightbulb,
  Star,
  Grid3x3,
} from "lucide-react";
import {
  useContentBanners,
  useCreateBanner,
  useDeleteBanner,
  useRenderBanner,
  useBatchGenereerBanners,
} from "@/hooks/queries/use-content";
import { useContentPosts } from "@/hooks/queries/use-content";
import { useToast } from "@/hooks/use-toast";
import { BannerCanvas } from "@/components/banners/banner-canvas";
import type {
  BannerTemplateType,
  BannerFormaat,
  BannerData,
  QuoteData,
  StatData,
  TipData,
  CaseStudyData,
  ContentBanner,
  BannerStatus,
} from "@/types/content";
import { BANNER_TEMPLATE_LABELS } from "@/types/content";

// ============ STATUS BADGE ============

function StatusBadge({ status }: { status: BannerStatus }) {
  const map: Record<BannerStatus, { label: string; className: string }> = {
    concept: { label: "Concept", className: "bg-zinc-700 text-zinc-300" },
    klaar: { label: "Klaar", className: "bg-green-500/20 text-green-400" },
    fout: { label: "Fout", className: "bg-red-500/20 text-red-400" },
  };
  const { label, className } = map[status] ?? map.concept;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ============ TEMPLATE TYPE CARDS ============

const TEMPLATE_ICONS: Record<BannerTemplateType, React.ReactNode> = {
  quote: <Quote className="w-5 h-5" />,
  stat: <BarChart2 className="w-5 h-5" />,
  tip: <Lightbulb className="w-5 h-5" />,
  case_study: <Star className="w-5 h-5" />,
};

// ============ DEFAULT DATA ============

function defaultData(type: BannerTemplateType): BannerData {
  switch (type) {
    case "quote":
      return { tekst: "", auteur: "" };
    case "stat":
      return { label: "", van: "", naar: "", eenheid: "" };
    case "tip":
      return { titel: "", punten: ["", "", ""] };
    case "case_study":
      return { klantNaam: "", resultaat: "", beschrijving: "" };
  }
}

// ============ DATA FORMS ============

function QuoteForm({ data, onChange }: { data: QuoteData; onChange: (d: QuoteData) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-autronis-text-secondary mb-1.5 block">Quote tekst *</label>
        <textarea
          rows={3}
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent resize-none"
          placeholder="De krachtigste uitspraak of stelling..."
          value={data.tekst}
          onChange={(e) => onChange({ ...data, tekst: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-autronis-text-secondary mb-1.5 block">Auteur (optioneel)</label>
        <input
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
          placeholder="bijv. Sem van Autronis"
          value={data.auteur ?? ""}
          onChange={(e) => onChange({ ...data, auteur: e.target.value })}
        />
      </div>
    </div>
  );
}

function StatForm({ data, onChange }: { data: StatData; onChange: (d: StatData) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-autronis-text-secondary mb-1.5 block">Label *</label>
        <input
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
          placeholder="bijv. Tijdsbesparing per week"
          value={data.label}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">Van *</label>
          <input
            className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
            placeholder="8"
            value={data.van}
            onChange={(e) => onChange({ ...data, van: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">Naar *</label>
          <input
            className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
            placeholder="1"
            value={data.naar}
            onChange={(e) => onChange({ ...data, naar: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">Eenheid</label>
          <input
            className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
            placeholder="uur"
            value={data.eenheid ?? ""}
            onChange={(e) => onChange({ ...data, eenheid: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function TipForm({ data, onChange }: { data: TipData; onChange: (d: TipData) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-autronis-text-secondary mb-1.5 block">Titel *</label>
        <input
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
          placeholder="bijv. 3 stappen naar automatisering"
          value={data.titel}
          onChange={(e) => onChange({ ...data, titel: e.target.value })}
        />
      </div>
      {data.punten.map((punt, idx) => (
        <div key={idx}>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">Punt {idx + 1} *</label>
          <input
            className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
            placeholder={`Tip ${idx + 1}...`}
            value={punt}
            onChange={(e) => {
              const newPunten = [...data.punten] as [string, string, string];
              newPunten[idx] = e.target.value;
              onChange({ ...data, punten: newPunten });
            }}
          />
        </div>
      ))}
    </div>
  );
}

function CaseForm({ data, onChange }: { data: CaseStudyData; onChange: (d: CaseStudyData) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-autronis-text-secondary mb-1.5 block">Klant naam *</label>
        <input
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
          placeholder="bijv. Bakkerij De Molen"
          value={data.klantNaam}
          onChange={(e) => onChange({ ...data, klantNaam: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-autronis-text-secondary mb-1.5 block">Resultaat *</label>
        <input
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
          placeholder="bijv. 80% minder handmatig werk"
          value={data.resultaat}
          onChange={(e) => onChange({ ...data, resultaat: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-autronis-text-secondary mb-1.5 block">Beschrijving (optioneel)</label>
        <textarea
          rows={2}
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent resize-none"
          placeholder="Korte toelichting op het project..."
          value={data.beschrijving ?? ""}
          onChange={(e) => onChange({ ...data, beschrijving: e.target.value })}
        />
      </div>
    </div>
  );
}

// ============ BANNER CARD ============

function BannerCard({ banner }: { banner: ContentBanner }) {
  const { addToast } = useToast();
  const deleteBanner = useDeleteBanner();
  const renderBanner = useRenderBanner();

  function handleDownload() {
    if (!banner.imagePath) {
      addToast("Render de banner eerst", "info");
      return;
    }
    const a = document.createElement("a");
    a.href = banner.imagePath;
    a.download = `banner-${banner.id}-${banner.formaat}.png`;
    a.click();
  }

  async function handleRender() {
    try {
      await renderBanner.mutateAsync(banner.id);
      addToast("Banner gerenderd", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Renderen mislukt", "fout");
    }
  }

  async function handleDelete() {
    try {
      await deleteBanner.mutateAsync(banner.id);
      addToast("Banner verwijderd", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Verwijderen mislukt", "fout");
    }
  }

  const FORMAAT_SIZES = { instagram: { width: 1080, height: 1350 }, linkedin: { width: 1200, height: 627 } };
  const { width, height } = FORMAAT_SIZES[banner.formaat];
  const previewScale = 220 / width;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden group card-glow">
      {/* Preview */}
      <div
        className="relative overflow-hidden flex items-center justify-center bg-[#061217]"
        style={{ height: Math.round(height * previewScale) }}
      >
        {banner.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.imagePath}
            alt="Banner preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <BannerCanvas
            templateType={banner.templateType}
            variant={banner.templateVariant}
            formaat={banner.formaat}
            data={banner.data}
            scale={previewScale}
          />
        )}
        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="bg-black/60 backdrop-blur-sm text-autronis-accent text-xs px-2 py-1 rounded-lg font-medium">
            {BANNER_TEMPLATE_LABELS[banner.templateType]}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          {banner.formaat === "instagram" ? (
            <span className="bg-black/60 backdrop-blur-sm text-pink-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <Instagram className="w-3 h-3" /> IG
            </span>
          ) : (
            <span className="bg-black/60 backdrop-blur-sm text-blue-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <Linkedin className="w-3 h-3" /> LI
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {banner.postTitel && (
          <p className="text-xs text-autronis-text-secondary truncate">
            Post: {banner.postTitel}
          </p>
        )}
        <div className="flex items-center justify-between">
          <StatusBadge status={banner.status} />
          <div className="flex items-center gap-1">
            <button
              onClick={handleRender}
              disabled={renderBanner.isPending}
              className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors disabled:opacity-50"
              title="Opnieuw renderen"
            >
              {renderBanner.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors"
              title="Downloaden"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteBanner.isPending}
              className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Verwijderen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ INSTAGRAM GRID PREVIEW ============

function InstagramGridPreview({ banners }: { banners: ContentBanner[] }) {
  const gridBanners = banners
    .filter((b) => b.formaat === "instagram")
    .slice(0, 9);

  const cells = Array.from({ length: 9 }, (_, i) => gridBanners[i] ?? null);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center">
          <Grid3x3 className="w-4 h-4 text-pink-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-autronis-text-primary">Instagram Grid</h2>
          <p className="text-xs text-autronis-text-secondary">Laatste 9 Instagram banners</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 max-w-xs mx-auto">
        {cells.map((banner, idx) => (
          <div
            key={idx}
            className="aspect-square bg-[#061217] border border-autronis-border/50 rounded overflow-hidden"
          >
            {banner ? (
              banner.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imagePath}
                  alt={`Grid item ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BannerCanvas
                  templateType={banner.templateType}
                  variant={banner.templateVariant}
                  formaat={banner.formaat}
                  data={banner.data}
                  scale={90 / 1080}
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-autronis-text-secondary/30" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============

export default function BannersPage() {
  const { addToast } = useToast();
  const { data: banners = [], isLoading } = useContentBanners();
  const { data: posts = [] } = useContentPosts();
  const createBanner = useCreateBanner();
  const batchGenereer = useBatchGenereerBanners();
  const renderBanner = useRenderBanner();

  const [templateType, setTemplateType] = useState<BannerTemplateType>("quote");
  const [formaat, setFormaat] = useState<BannerFormaat>("instagram");
  const [variant, setVariant] = useState(0);
  const [bannerData, setBannerData] = useState<BannerData>(defaultData("quote"));
  const [selectedPostId, setSelectedPostId] = useState<number | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  const FORMAAT_SIZES = { instagram: { width: 1080, height: 1350 }, linkedin: { width: 1200, height: 627 } };

  function handleTemplateChange(type: BannerTemplateType) {
    setTemplateType(type);
    setBannerData(defaultData(type));
    setVariant(0);
  }

  const VARIANTS_COUNT: Record<BannerTemplateType, number> = {
    quote: 4,
    stat: 3,
    tip: 3,
    case_study: 3,
  };

  const previewWidth = FORMAAT_SIZES[formaat].width;
  const previewHeight = FORMAAT_SIZES[formaat].height;
  const previewScale = 280 / previewWidth;

  async function handleCreate() {
    setIsCreating(true);
    try {
      const result = await createBanner.mutateAsync({
        postId: selectedPostId,
        templateType,
        templateVariant: variant,
        formaat,
        data: bannerData,
      });
      await renderBanner.mutateAsync(result.banner.id);
      addToast("Banner aangemaakt en gerenderd", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Aanmaken mislukt", "fout");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleBatch() {
    try {
      const result = await batchGenereer.mutateAsync();
      if (result.bericht) {
        addToast(result.bericht, "info");
      } else {
        addToast(`${result.generated} banners gegenereerd${result.failed > 0 ? `, ${result.failed} mislukt` : ""}`, result.failed > 0 ? "info" : "succes");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Batch genereren mislukt", "fout");
    }
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Banners</h1>
          <p className="text-autronis-text-secondary mt-1">
            Maak en beheer social media banners voor LinkedIn en Instagram.
          </p>
        </div>
        <button
          onClick={handleBatch}
          disabled={batchGenereer.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-autronis-bg font-semibold rounded-xl hover:bg-autronis-accent/90 transition-colors disabled:opacity-50"
        >
          {batchGenereer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Batch genereer
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Left: Create form */}
        <div className="space-y-6">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-autronis-text-primary">Nieuwe banner</h2>

            {/* Template type */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-3 block">Template type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["quote", "stat", "tip", "case_study"] as BannerTemplateType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTemplateChange(type)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                      templateType === type
                        ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                        : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/50"
                    }`}
                  >
                    {TEMPLATE_ICONS[type]}
                    <span className="text-xs font-medium">{BANNER_TEMPLATE_LABELS[type]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Formaat */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-3 block">Formaat</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormaat("instagram")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    formaat === "instagram"
                      ? "border-pink-400 bg-pink-500/10 text-pink-400"
                      : "border-autronis-border text-autronis-text-secondary hover:border-pink-400/50"
                  }`}
                >
                  <Instagram className="w-4 h-4" />
                  Instagram (4:5)
                </button>
                <button
                  onClick={() => setFormaat("linkedin")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    formaat === "linkedin"
                      ? "border-blue-400 bg-blue-500/10 text-blue-400"
                      : "border-autronis-border text-autronis-text-secondary hover:border-blue-400/50"
                  }`}
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn (1200×627)
                </button>
              </div>
            </div>

            {/* Variant */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-3 block">Variant</label>
              <div className="flex gap-2">
                {Array.from({ length: VARIANTS_COUNT[templateType] }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setVariant(i)}
                    className={`w-9 h-9 rounded-xl border text-sm font-semibold transition-all ${
                      variant === i
                        ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                        : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/50"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Data form */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-3 block">Inhoud</label>
              {templateType === "quote" && (
                <QuoteForm
                  data={bannerData as QuoteData}
                  onChange={(d) => setBannerData(d)}
                />
              )}
              {templateType === "stat" && (
                <StatForm
                  data={bannerData as StatData}
                  onChange={(d) => setBannerData(d)}
                />
              )}
              {templateType === "tip" && (
                <TipForm
                  data={bannerData as TipData}
                  onChange={(d) => setBannerData(d)}
                />
              )}
              {templateType === "case_study" && (
                <CaseForm
                  data={bannerData as CaseStudyData}
                  onChange={(d) => setBannerData(d)}
                />
              )}
            </div>

            {/* Post koppeling */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">
                Koppel aan post <span className="text-autronis-text-secondary/60">(optioneel)</span>
              </label>
              <select
                value={selectedPostId ?? ""}
                onChange={(e) => setSelectedPostId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
              >
                <option value="">Geen post geselecteerd</option>
                {posts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.titel} ({post.platform})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-autronis-accent text-autronis-bg font-semibold rounded-xl hover:bg-autronis-accent/90 transition-colors disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              Genereer banner
            </button>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="space-y-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
            <p className="text-xs text-autronis-text-secondary mb-3 font-medium">Live preview</p>
            <div className="flex justify-center overflow-hidden">
              <BannerCanvas
                templateType={templateType}
                variant={variant}
                formaat={formaat}
                data={bannerData}
                scale={previewScale}
              />
            </div>
            <p className="text-center text-xs text-autronis-text-secondary/60 mt-2">
              {previewWidth} × {previewHeight}px
            </p>
          </div>
        </div>
      </div>

      {/* Banner grid */}
      <div>
        <h2 className="text-xl font-semibold text-autronis-text-primary mb-4">
          Alle banners
          {banners.length > 0 && (
            <span className="ml-2 text-sm font-normal text-autronis-text-secondary">({banners.length})</span>
          )}
        </h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-autronis-text-secondary py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Banners laden…</span>
          </div>
        ) : banners.length === 0 ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
            <ImageIcon className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
            <p className="text-autronis-text-secondary text-sm">Nog geen banners. Maak je eerste banner aan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {banners.map((banner) => (
              <BannerCard key={banner.id} banner={banner} />
            ))}
          </div>
        )}
      </div>

      {/* Instagram grid preview */}
      {banners.filter((b) => b.formaat === "instagram").length > 0 && (
        <InstagramGridPreview banners={banners} />
      )}
    </div>
  );
}
