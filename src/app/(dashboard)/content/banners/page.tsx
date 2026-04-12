"use client";

import { useState, useEffect, useRef, useCallback, createRef } from "react";
import { toPng } from "html-to-image";
import {
  Image as ImageIcon,
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  Instagram,
  Linkedin,
  Sparkles,
  Grid3x3,
  Plus,
  Layers,
  Wand2,
} from "lucide-react";
import {
  useContentBanners,
  useSaveBanner,
  useDeleteBanner,
  useRenderBanner,
  useAnalyzeTopic,
  useGenerateAiBg,
} from "@/hooks/queries/use-content";
import { useToast } from "@/hooks/use-toast";
import { BannerCanvas } from "@/components/banners/banner-canvas";
import type {
  BannerFormaat,
  BannerIcon,
  BannerIllustration,
  ContentBanner,
  BannerStatus,
} from "@/types/content";
import {
  BANNER_FORMAAT_SIZES,
  BANNER_ICONS,
  BANNER_ICON_LABELS,
  BANNER_ILLUSTRATIONS,
  BANNER_ILLUSTRATION_LABELS,
} from "@/types/content";
import { getDefaults } from "@/lib/ai/banner-defaults";
import { PageTransition } from "@/components/ui/page-transition";

// ============ STATUS BADGE ============

function StatusBadge({ status }: { status: BannerStatus }) {
  const map: Record<BannerStatus, { label: string; className: string }> = {
    concept: { label: "Concept", className: "bg-zinc-700 text-zinc-300" },
    klaar: { label: "Klaar", className: "bg-emerald-500/20 text-emerald-400" },
    fout: { label: "Fout", className: "bg-red-500/20 text-red-400" },
  };
  const { label, className } = map[status] ?? map.concept;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
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

  const { width, height } = BANNER_FORMAAT_SIZES[banner.formaat];
  const previewScale = 220 / width;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden group card-glow">
      <div
        className="relative overflow-hidden flex items-center justify-center bg-[#0B1A1F]"
        style={{ height: Math.round(height * previewScale) }}
      >
        {banner.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.imagePath}
            alt={`Banner: ${banner.onderwerp}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <BannerCanvas
            onderwerp={banner.onderwerp}
            icon={banner.icon}
            illustration={banner.illustration}
            formaat={banner.formaat}
            scale={previewScale}
          />
        )}
        <div className="absolute top-2 right-2">
          {banner.formaat === "instagram" ? (
            <span className="bg-black/60 backdrop-blur-sm text-pink-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <Instagram className="w-3 h-3" /> IG
            </span>
          ) : banner.formaat === "instagram_story" ? (
            <span className="bg-black/60 backdrop-blur-sm text-pink-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <Instagram className="w-3 h-3" /> Story
            </span>
          ) : (
            <span className="bg-black/60 backdrop-blur-sm text-blue-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <Linkedin className="w-3 h-3" /> LI
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-xs text-autronis-text-primary font-medium truncate">{banner.onderwerp}</p>
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

// ============ INSTAGRAM GRID ============

function InstagramGridPreview({ banners }: { banners: ContentBanner[] }) {
  const gridBanners = banners.filter((b) => b.formaat === "instagram").slice(0, 9);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 max-w-xs mx-auto">
        {cells.map((banner, idx) => (
          <div
            key={idx}
            className="aspect-square bg-[#0B1A1F] border border-autronis-border/50 rounded overflow-hidden"
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
                  onderwerp={banner.onderwerp}
                  icon={banner.icon}
                  illustration={banner.illustration}
                  formaat={banner.formaat}
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
  const saveBanner = useSaveBanner();
  const renderBanner = useRenderBanner();
  const analyzeTopic = useAnalyzeTopic();
  const generateAiBg = useGenerateAiBg();

  const previewRef = useRef<HTMLDivElement>(null);
  const [onderwerp, setOnderwerp] = useState("");
  const [formaat, setFormaat] = useState<BannerFormaat>("instagram");
  const [icon, setIcon] = useState<BannerIcon>("cog");
  const [illustration, setIllustration] = useState<BannerIllustration>("gear");
  const [capsuleText, setCapsuleText] = useState("");
  const [illustrationScale, setIllustrationScale] = useState<number>(1.0);
  const [illustrationOffsetX, setIllustrationOffsetX] = useState<number>(0);
  const [illustrationOffsetY, setIllustrationOffsetY] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiBgUrl, setAiBgUrl] = useState<string>("");
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  // Batch state
  const [batchInput, setBatchInput] = useState("");
  const [isBatching, setIsBatching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On topic change: instant keyword defaults + debounced AI analyze
  const handleOnderwerpChange = useCallback((value: string) => {
    setOnderwerp(value);

    if (!value.trim()) {
      setCapsuleText("");
      return;
    }

    // Instant keyword-based defaults
    const defaults = getDefaults(value);
    setIcon(defaults.icon);
    setIllustration(defaults.illustration);
    setCapsuleText(value);

    // Debounced AI
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (value.trim().length < 3) return;
      setIsAnalyzing(true);
      try {
        const result = await analyzeTopic.mutateAsync(value.trim());
        setIcon(result.icon);
        setIllustration(result.illustration);
        setCapsuleText(result.capsuleText);
      } catch {
        // Keep keyword defaults on AI failure
      } finally {
        setIsAnalyzing(false);
      }
    }, 500);
  }, [analyzeTopic]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const previewWidth = BANNER_FORMAAT_SIZES[formaat].width;
  const previewScale = 280 / previewWidth;
  const displayText = capsuleText || onderwerp || "Jouw onderwerp";

  async function handleSave() {
    if (!onderwerp.trim()) {
      addToast("Voer een onderwerp in", "info");
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveBanner.mutateAsync({
        onderwerp: capsuleText || onderwerp.trim(),
        icon,
        illustration,
        formaat,
        illustrationScale,
        illustrationOffsetX,
        illustrationOffsetY,
        ...(aiBgUrl ? { aiBgUrl } : {}),
      });
      await renderBanner.mutateAsync(result.banner.id);
      addToast("Banner opgeslagen en gerenderd", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadDirect() {
    if (!onderwerp.trim()) {
      addToast("Voer een onderwerp in", "info");
      return;
    }
    const el = previewRef.current;
    if (!el) {
      addToast("Preview niet gevonden", "fout");
      return;
    }
    setIsSaving(true);
    try {
      const { width, height } = BANNER_FORMAAT_SIZES[formaat];
      // Capture the preview div as PNG at full resolution
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 1 / previewScale, // Scale up to full size
        canvasWidth: width,
        canvasHeight: height,
        backgroundColor: "#0B1A1F",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `banner-${onderwerp.trim().replace(/\s+/g, "-")}-${formaat}.png`;
      a.click();
      addToast("Banner gedownload", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Download mislukt", "fout");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBatch() {
    const topics = batchInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (topics.length === 0) {
      addToast("Voer minimaal één onderwerp in", "info");
      return;
    }

    setIsBatching(true);
    let success = 0;
    let failed = 0;

    for (const topic of topics) {
      try {
        const defaults = getDefaults(topic);
        const saved = await saveBanner.mutateAsync({
          onderwerp: topic,
          icon: defaults.icon,
          illustration: defaults.illustration,
          formaat,
        });
        await renderBanner.mutateAsync(saved.banner.id);
        success++;
      } catch {
        failed++;
      }
    }

    setIsBatching(false);
    addToast(
      `${success} banner${success !== 1 ? "s" : ""} gegenereerd${failed > 0 ? `, ${failed} mislukt` : ""}`,
      failed > 0 ? "info" : "succes"
    );
    setBatchInput("");
  }

  return (
    <PageTransition>
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Banner Generator</h1>
        <p className="text-autronis-text-secondary mt-1">
          Typ een onderwerp en genereer een neon capsule banner voor LinkedIn of Instagram.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Left: Create form */}
        <div className="space-y-6">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-autronis-text-primary">Nieuw banner</h2>

            {/* Onderwerp input */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">
                Onderwerp
                {isAnalyzing && (
                  <span className="ml-2 text-autronis-accent text-xs inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> AI analyseert…
                  </span>
                )}
              </label>
              <input
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-base text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
                placeholder="bijv. Process Automation"
                value={onderwerp}
                onChange={(e) => handleOnderwerpChange(e.target.value)}
              />
              {capsuleText && capsuleText !== onderwerp && (
                <p className="text-xs text-autronis-accent mt-1.5">
                  Capsule tekst: <strong>{capsuleText}</strong>
                </p>
              )}
            </div>

            {/* Formaat */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-3 block">Formaat</label>
              <div className="flex gap-2 flex-wrap">
                {(["instagram", "instagram_square", "instagram_story", "linkedin"] as BannerFormaat[]).map((f) => {
                  const { label } = BANNER_FORMAAT_SIZES[f];
                  const isActive = formaat === f;
                  const isInstagram = f.startsWith("instagram");
                  return (
                    <button
                      key={f}
                      onClick={() => setFormaat(f)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        isActive
                          ? isInstagram
                            ? "border-pink-400 bg-pink-500/10 text-pink-400"
                            : "border-blue-400 bg-blue-500/10 text-blue-400"
                          : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/50"
                      }`}
                    >
                      {isInstagram ? <Instagram className="w-4 h-4" /> : <Linkedin className="w-4 h-4" />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icon override */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Icon</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value as BannerIcon)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
              >
                {BANNER_ICONS.map((ic) => (
                  <option key={ic} value={ic}>{BANNER_ICON_LABELS[ic]}</option>
                ))}
              </select>
            </div>

            {/* Illustration override */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Achtergrond illustratie</label>
              <select
                value={illustration}
                onChange={(e) => setIllustration(e.target.value as BannerIllustration)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
              >
                {BANNER_ILLUSTRATIONS.map((il) => (
                  <option key={il} value={il}>{BANNER_ILLUSTRATION_LABELS[il]}</option>
                ))}
              </select>
            </div>

            {/* Illustration size */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">
                Grootte illustratie
              </label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { label: "Klein", value: 0.6 },
                  { label: "Normaal", value: 1.0 },
                  { label: "Groot", value: 1.3 },
                  { label: "Extra groot", value: 1.5 },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIllustrationScale(opt.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      illustrationScale === opt.value
                        ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                        : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Illustration position */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-3 block">
                Positie illustratie
              </label>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-autronis-text-secondary mb-1">
                    <span>Horizontaal</span>
                    <span className="text-autronis-accent">{illustrationOffsetX}px</span>
                  </div>
                  <input
                    type="range"
                    min={-200}
                    max={200}
                    value={illustrationOffsetX}
                    onChange={(e) => setIllustrationOffsetX(Number(e.target.value))}
                    className="w-full accent-autronis-accent"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-autronis-text-secondary mb-1">
                    <span>Verticaal</span>
                    <span className="text-autronis-accent">{illustrationOffsetY}px</span>
                  </div>
                  <input
                    type="range"
                    min={-200}
                    max={200}
                    value={illustrationOffsetY}
                    onChange={(e) => setIllustrationOffsetY(Number(e.target.value))}
                    className="w-full accent-autronis-accent"
                  />
                </div>
              </div>
            </div>

            {/* AI Achtergrond */}
            <div>
              <label className="text-sm font-medium text-autronis-text-secondary mb-3 block">
                AI Achtergrond (DALL-E 3)
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (!onderwerp.trim()) {
                      addToast("Voer eerst een onderwerp in", "info");
                      return;
                    }
                    setIsGeneratingBg(true);
                    try {
                      const result = await generateAiBg.mutateAsync({
                        onderwerp: onderwerp.trim(),
                        illustration,
                        formaat,
                      });
                      setAiBgUrl(result.imagePath);
                      addToast("AI achtergrond gegenereerd", "succes");
                    } catch (err) {
                      addToast(err instanceof Error ? err.message : "AI achtergrond mislukt", "fout");
                    } finally {
                      setIsGeneratingBg(false);
                    }
                  }}
                  disabled={isGeneratingBg || !onderwerp.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-500/50 bg-purple-500/10 text-purple-400 text-sm font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                >
                  {isGeneratingBg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  {isGeneratingBg ? "Genereren (~15s)…" : "Genereer AI achtergrond"}
                </button>
                {aiBgUrl && (
                  <button
                    onClick={() => setAiBgUrl("")}
                    className="text-xs text-autronis-text-secondary hover:text-red-400 transition-colors"
                  >
                    Verwijder
                  </button>
                )}
              </div>
              {aiBgUrl && (
                <p className="text-xs text-purple-400 mt-2">
                  AI achtergrond actief — wordt gebruikt in de banner
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving || !onderwerp.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-autronis-accent text-autronis-bg font-semibold rounded-xl hover:bg-autronis-accent/90 transition-colors disabled:opacity-50 btn-press"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Opslaan
              </button>
              <button
                onClick={handleDownloadDirect}
                disabled={isSaving || !onderwerp.trim()}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-autronis-bg border border-autronis-border text-autronis-text-primary font-semibold rounded-xl hover:border-autronis-accent hover:text-autronis-accent transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
            </div>
          </div>

          {/* Batch section */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-autronis-accent" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-autronis-text-primary">Batch genereer</h2>
                <p className="text-xs text-autronis-text-secondary">Eén onderwerp per regel</p>
              </div>
            </div>
            <textarea
              rows={5}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent resize-none font-mono"
              placeholder={"Process Automation\nAI Integration\nData & Dashboards\nSysteem Koppelingen"}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
            />
            <button
              onClick={handleBatch}
              disabled={isBatching || !batchInput.trim()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-autronis-bg border border-autronis-border text-autronis-text-primary font-semibold rounded-xl hover:border-autronis-accent hover:text-autronis-accent transition-colors disabled:opacity-50"
            >
              {isBatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isBatching ? "Genereren…" : "Genereer alle banners"}
            </button>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="space-y-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
            <p className="text-xs text-autronis-text-secondary mb-3 font-medium">Live preview</p>
            <div className="flex justify-center overflow-hidden">
              <BannerCanvas
                ref={previewRef}
                onderwerp={displayText}
                icon={icon}
                illustration={illustration}
                formaat={formaat}
                scale={previewScale}
                illustrationScale={illustrationScale}
                illustrationOffsetX={illustrationOffsetX * previewScale}
                illustrationOffsetY={illustrationOffsetY * previewScale}
                aiBgUrl={aiBgUrl || undefined}
              />
            </div>
            <p className="text-center text-xs text-autronis-text-secondary/60 mt-2">
              {BANNER_FORMAAT_SIZES[formaat].width} × {BANNER_FORMAAT_SIZES[formaat].height}px
            </p>
          </div>
        </div>
      </div>

      {/* Banner grid */}
      <div>
        <h2 className="text-xl font-semibold text-autronis-text-primary mb-4">
          Opgeslagen banners
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

      {/* Instagram grid */}
      {banners.filter((b) => b.formaat === "instagram").length > 0 && (
        <InstagramGridPreview banners={banners} />
      )}
    </div>
    </PageTransition>
  );
}
