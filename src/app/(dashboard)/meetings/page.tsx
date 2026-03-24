"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Upload,
  FileText,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  Trash2,
  ChevronDown,
  Plus,
  Loader2,
  X,
  ArrowLeft,
  Calendar,
  ClipboardList,
  Search,
  Clock,
  AlertTriangle,
  Target,
  Sparkles,
  Play,
  Pause,
  Tag,
  TrendingUp,
  Heart,
  Video,
  Users,
  ExternalLink,
  Save,
  ChevronRight,
  Copy,
  Check,
  Radio,
  Mail,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useMeetings,
  useMeeting,
  useUploadMeeting,
  useVerwerkMeeting,
  useSubmitTranscript,
  useDeleteMeeting,
  useUpdateMeeting,
  useUploadMeetingAudio,
  useMeetingVoorbereiding,
} from "@/hooks/queries/use-meetings";
import type { Meeting } from "@/hooks/queries/use-meetings";

interface Klant {
  id: number;
  bedrijfsnaam: string;
}

interface Project {
  id: number;
  naam: string;
  klantId: number;
}

const statusConfig = {
  verwerken: { label: "Verwerken", color: "text-yellow-400", bg: "bg-yellow-500/15" },
  klaar: { label: "Klaar", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  mislukt: { label: "Mislukt", color: "text-red-400", bg: "bg-red-500/15" },
} as const;

const verantwoordelijkeConfig: Record<string, { color: string; bg: string }> = {
  sem: { color: "text-autronis-accent", bg: "bg-autronis-accent/15" },
  syb: { color: "text-blue-400", bg: "bg-blue-500/15" },
  klant: { color: "text-purple-400", bg: "bg-purple-500/15" },
};

function getVerantwoordelijkeStyle(naam: string) {
  const lower = naam.toLowerCase();
  if (lower.includes("sem")) return verantwoordelijkeConfig.sem;
  if (lower.includes("syb")) return verantwoordelijkeConfig.syb;
  return verantwoordelijkeConfig.klant;
}

function formatDuur(minuten: number | null): string {
  if (!minuten) return "-";
  if (minuten < 60) return `${minuten} min`;
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest > 0 ? `${uren}u ${rest}min` : `${uren}u`;
}

function formatTijd(datum: string): string {
  const d = new Date(datum);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatCountdown(datum: string): string {
  const now = new Date();
  const target = new Date(datum);
  const diff = target.getTime() - now.getTime();

  if (diff < 0) return "Gestart";

  const minuten = Math.floor(diff / 60000);
  const uren = Math.floor(minuten / 60);
  const dagen = Math.floor(uren / 24);

  if (dagen > 0) return `Over ${dagen}d ${uren % 24}u`;
  if (uren > 0) return `Over ${uren}u ${minuten % 60}min`;
  return `Over ${minuten}min`;
}

function isUpcoming(datum: string): boolean {
  return new Date(datum) > new Date();
}

function isWithinTwoHours(datum: string): boolean {
  const diff = new Date(datum).getTime() - Date.now();
  return diff > 0 && diff < 2 * 60 * 60 * 1000;
}

function sentimentEmoji(sentiment: string | null): { emoji: string; color: string } {
  if (!sentiment) return { emoji: "😐", color: "text-autronis-text-secondary" };
  const l = sentiment.toLowerCase();
  if (l.includes("positief") || l.includes("goed") || l.includes("enthousiast") || l.includes("constructief") || l.includes("prettig"))
    return { emoji: "😊", color: "text-emerald-400" };
  if (l.includes("gespannen") || l.includes("negatief") || l.includes("conflict") || l.includes("moeilijk"))
    return { emoji: "😟", color: "text-red-400" };
  return { emoji: "😐", color: "text-amber-400" };
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

function isThisWeek(datum: string): boolean {
  const d = new Date(datum);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

// ============ AUDIO PLAYER ============

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  }, [duration]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 bg-autronis-bg/50 rounded-xl px-4 py-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className="p-2 bg-autronis-accent/20 rounded-lg hover:bg-autronis-accent/30 transition-colors"
      >
        {playing ? <Pause className="w-4 h-4 text-autronis-accent" /> : <Play className="w-4 h-4 text-autronis-accent" />}
      </button>
      <span className="text-xs text-autronis-text-secondary tabular-nums w-10">{formatTime(currentTime)}</span>
      <div
        className="flex-1 h-2 bg-autronis-border rounded-full cursor-pointer relative"
        onClick={seek}
      >
        <div
          className="h-full bg-autronis-accent rounded-full transition-all"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
        />
      </div>
      <span className="text-xs text-autronis-text-secondary tabular-nums w-10">{formatTime(duration)}</span>
    </div>
  );
}

// ============ LIVE RECORDER ============

function LiveRecorder({ onRecorded }: { onRecorded: (file: File) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `opname_${Date.now()}.webm`, { type: "audio/webm" });
        onRecorded(file);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      // Microfoon geweigerd
    }
  }, [onRecorded]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3">
      {recording ? (
        <>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 rounded-xl font-medium hover:bg-red-500/30 transition-colors"
          >
            <MicOff className="w-4 h-4" />
            Stop opname
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-400 tabular-nums font-medium">{formatTime(elapsed)}</span>
          </div>
        </>
      ) : (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent/20 text-autronis-accent rounded-xl font-medium hover:bg-autronis-accent/30 transition-colors"
        >
          <Mic className="w-4 h-4" />
          Live opnemen
        </button>
      )}
    </div>
  );
}

// ============ VOORBEREIDING PANEL ============

function VoorbereidingPanel({ klantId, projectId, titel }: { klantId?: number | null; projectId?: number | null; titel?: string }) {
  const { data: voorbereiding, isLoading } = useMeetingVoorbereiding(klantId, projectId, titel);

  if (!klantId && !projectId) return null;

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-autronis-accent/5 to-blue-500/5 border border-autronis-accent/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-autronis-accent">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">AI voorbereiding laden...</span>
        </div>
      </div>
    );
  }

  if (!voorbereiding) return null;

  return (
    <div className="bg-gradient-to-r from-autronis-accent/5 to-blue-500/5 border border-autronis-accent/20 rounded-2xl p-6 space-y-4">
      <h3 className="text-base font-semibold text-autronis-text-primary flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-autronis-accent" />
        AI Voorbereiding
      </h3>

      <p className="text-sm text-autronis-text-secondary leading-relaxed">{voorbereiding.context}</p>

      {voorbereiding.suggesties.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-autronis-text-secondary mb-2">Gespreksonderwerpen</p>
          <div className="space-y-1.5">
            {voorbereiding.suggesties.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-autronis-text-primary">
                <Target className="w-3.5 h-3.5 text-autronis-accent mt-0.5 flex-shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {voorbereiding.waarschuwingen && voorbereiding.waarschuwingen.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-yellow-400 mb-2">Aandachtspunten</p>
          <div className="space-y-1.5">
            {voorbereiding.waarschuwingen.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-yellow-300">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {voorbereiding.openActiepunten.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-autronis-text-secondary mb-2">
            Openstaande actiepunten uit vorige meetings
          </p>
          <div className="space-y-1.5">
            {voorbereiding.openActiepunten.slice(0, 5).map((ap, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-autronis-text-secondary">
                <CheckCircle2 className="w-3.5 h-3.5 text-autronis-text-secondary/50 mt-0.5 flex-shrink-0" />
                <span className="flex-1">{ap.tekst}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-autronis-bg/50">{ap.verantwoordelijke}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ UPCOMING MEETING CARD ============

function UpcomingMeetingCard({ meeting, onSelect }: { meeting: Meeting; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className="bg-gradient-to-br from-autronis-card to-autronis-card/80 border border-autronis-border rounded-2xl p-6 card-glow cursor-pointer hover:border-autronis-accent/30 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-autronis-accent/10 rounded-lg">
            <Video className="w-4 h-4 text-autronis-accent" />
          </div>
          <span className="text-xs font-medium text-autronis-accent px-2 py-0.5 rounded-full bg-autronis-accent/10">
            {formatCountdown(meeting.datum)}
          </span>
        </div>
        {meeting.meetingUrl && (
          <a
            href={meeting.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-accent text-autronis-bg text-xs font-semibold rounded-lg hover:bg-autronis-accent-hover transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Deelnemen
          </a>
        )}
      </div>

      <h3 className="text-base font-semibold text-autronis-text-primary mb-1 truncate">{meeting.titel}</h3>

      <div className="flex items-center gap-3 text-sm text-autronis-text-secondary mb-3">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formatDatum(meeting.datum)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatTijd(meeting.datum)}
          {meeting.eindDatum && ` - ${formatTijd(meeting.eindDatum)}`}
        </span>
      </div>

      {meeting.deelnemers.length > 0 && (
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-autronis-text-secondary" />
          <div className="flex items-center gap-1 flex-wrap">
            {meeting.deelnemers.slice(0, 4).map((d, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-autronis-bg/50 text-autronis-text-secondary"
                title={d.email}
              >
                {d.naam || d.email.split("@")[0]}
              </span>
            ))}
            {meeting.deelnemers.length > 4 && (
              <span className="text-xs text-autronis-text-secondary">
                +{meeting.deelnemers.length - 4}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ MEETING LIST ITEM ============

function MeetingListItem({ meeting, onSelect, onDelete }: {
  meeting: Meeting;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const isDb = meeting.bron === "database";
  const sc = meeting.status && statusConfig[meeting.status];
  const upcoming = isUpcoming(meeting.datum);

  const stripColor = meeting.status === "klaar"
    ? "bg-emerald-400"
    : meeting.status === "verwerken"
    ? "bg-amber-400 animate-pulse"
    : meeting.status === "mislukt"
    ? "bg-red-400"
    : upcoming ? "bg-autronis-accent" : "bg-autronis-border";

  const sentiment = meeting.status === "klaar" ? sentimentEmoji(meeting.sentiment) : null;

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
      className="w-full text-left bg-autronis-bg/30 rounded-xl border border-autronis-border/50 pl-4 pr-5 py-4 hover:border-autronis-accent/30 transition-colors group relative overflow-hidden"
    >
      {/* Status strip */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", stripColor)} />
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {meeting.bron === "kalender" ? (
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
          ) : (
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
              <Mic className="w-4 h-4 text-autronis-accent" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-base font-medium text-autronis-text-primary truncate">{meeting.titel}</p>
            {sc && (
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 flex-shrink-0", sc.bg, sc.color)}>
                {meeting.status === "verwerken" && <Loader2 className="w-3 h-3 animate-spin" />}
                {sc.label}
              </span>
            )}
            {meeting.bron === "kalender" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 flex-shrink-0">
                Kalender
              </span>
            )}
            {upcoming && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-accent/10 text-autronis-accent flex-shrink-0">
                {formatCountdown(meeting.datum)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-autronis-text-secondary flex-wrap">
            <span>{formatDatum(meeting.datum)} {formatTijd(meeting.datum)}</span>
            {meeting.duurMinuten && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuur(meeting.duurMinuten)}
              </span>
            )}
            {meeting.klantNaam && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-autronis-accent/10 text-autronis-accent">
                {meeting.klantNaam}
              </span>
            )}
            {meeting.deelnemers.length > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <Users className="w-3 h-3" />
                {meeting.deelnemers.length}
              </span>
            )}
            {meeting.meetingUrl && (
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <Video className="w-3 h-3" />
                Link
              </span>
            )}
            {isDb && meeting.status === "klaar" && (
              <span className="text-xs">
                {meeting.actiepunten.length} actiepunten
              </span>
            )}
            {sentiment && (
              <span className={cn("text-sm flex-shrink-0", sentiment.color)} title={meeting.sentiment ?? undefined}>
                {sentiment.emoji}
              </span>
            )}
            {meeting.hasNotities ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <FileText className="w-3 h-3" />
                Notities
              </span>
            ) : !upcoming ? (
              <span className="flex items-center gap-1 text-xs text-autronis-text-secondary/50">
                <FileText className="w-3 h-3" />
                Geen notities
              </span>
            ) : null}
            {meeting.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="flex items-center gap-1 text-xs text-autronis-text-secondary/70">
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {meeting.meetingUrl && upcoming && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-accent text-autronis-bg text-xs font-semibold rounded-lg hover:bg-autronis-accent-hover transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Deelnemen
            </a>
          )}
          {isDb && (
            <Trash2
              className="w-4 h-4 text-autronis-text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            />
          )}
          <ChevronRight className="w-4 h-4 text-autronis-text-secondary/50" />
        </div>
      </div>
    </motion.button>
  );
}

// ============ MAIN PAGE ============

export default function MeetingsPage() {
  const { addToast } = useToast();
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [pasteTranscript, setPasteTranscript] = useState("");
  const [transcriptZoek, setTranscriptZoek] = useState("");
  const [filterKlant, setFilterKlant] = useState<number | null>(null);
  const [filterPeriode, setFilterPeriode] = useState<"alles" | "week" | "maand">("alles");
  const [zoekTerm, setZoekTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [notitiesText, setNotitiesText] = useState("");
  const [notitiesDirty, setNotitiesDirty] = useState(false);
  const { data: meetings = [], isLoading } = useMeetings(filterKlant ?? undefined);
  const selectedNumericId = typeof selectedId === "number" ? selectedId : 0;
  const { data: selectedMeeting } = useMeeting(selectedNumericId);
  const uploadMutation = useUploadMeeting();
  const verwerkMutation = useVerwerkMeeting();
  const transcriptMutation = useSubmitTranscript();
  const deleteMutation = useDeleteMeeting();
  const updateMutation = useUpdateMeeting();
  const uploadAudioMutation = useUploadMeetingAudio();

  // Klanten for filter
  const [klanten, setKlanten] = useState<Klant[]>([]);
  useEffect(() => {
    fetch("/api/klanten")
      .then((r) => r.json())
      .then((d) => setKlanten(d.klanten || []))
      .catch(() => {});
  }, []);

  // When selecting a DB meeting, populate notities
  useEffect(() => {
    if (selectedMeeting) {
      setNotitiesText(selectedMeeting.samenvatting || "");
      setNotitiesDirty(false);
    }
  }, [selectedMeeting]);

  // Split meetings into upcoming and recent
  const { upcoming, recent, kpis } = useMemo(() => {
    const now = new Date();
    const upcomingMeetings: Meeting[] = [];
    const recentMeetings: Meeting[] = [];

    const periodeFilter = (datum: string) => {
      if (filterPeriode === "alles") return true;
      const d = new Date(datum);
      if (filterPeriode === "week") {
        const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0,0,0,0);
        return d >= start;
      }
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= start;
    };

    const filtered = zoekTerm.trim()
      ? meetings.filter((m) => {
          const lower = zoekTerm.toLowerCase();
          return (
            m.titel.toLowerCase().includes(lower) ||
            m.klantNaam?.toLowerCase().includes(lower) ||
            m.projectNaam?.toLowerCase().includes(lower) ||
            m.samenvatting?.toLowerCase().includes(lower) ||
            m.tags.some((t) => t.toLowerCase().includes(lower))
          );
        })
      : meetings;

    for (const m of filtered) {
      if (new Date(m.datum) > now) {
        upcomingMeetings.push(m);
      } else {
        recentMeetings.push(m);
      }
    }

    // Upcoming sorted by soonest first
    upcomingMeetings.sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());

    const dezeWeek = meetings.filter((m) => isThisWeek(m.datum)).length;
    const totaalActiepunten = meetings.reduce((sum, m) => sum + (m.actiepunten?.length || 0), 0);
    const verwerkt = meetings.filter((m) => m.status === "klaar").length;
    const totaalMinuten = meetings.reduce((sum, m) => sum + (m.duurMinuten || 0), 0);

    return {
      upcoming: upcomingMeetings,
      recent: recentMeetings,
      kpis: { dezeWeek, totaalActiepunten, verwerkt, totaalMinuten },
    };
  }, [meetings, zoekTerm]);

  const handleDelete = useCallback(
    (id: number) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          addToast("Meeting verwijderd", "succes");
          if (selectedId === id) setSelectedId(null);
        },
        onError: () => addToast("Kon meeting niet verwijderen", "fout"),
      });
    },
    [deleteMutation, addToast, selectedId]
  );

  const handleSaveNotities = useCallback(
    (id: number) => {
      updateMutation.mutate(
        { id, notities: notitiesText },
        {
          onSuccess: () => {
            addToast("Notities opgeslagen", "succes");
            setNotitiesDirty(false);
          },
          onError: () => addToast("Opslaan mislukt", "fout"),
        }
      );
    },
    [updateMutation, notitiesText, addToast]
  );

  const handleSubmitTranscript = useCallback(
    (id: number) => {
      if (!pasteTranscript.trim()) return;
      transcriptMutation.mutate(
        { id, transcript: pasteTranscript },
        {
          onSuccess: () => {
            addToast("Transcript verzonden voor verwerking", "succes");
            setPasteTranscript("");
          },
          onError: () => addToast("Kon transcript niet verwerken", "fout"),
        }
      );
    },
    [transcriptMutation, pasteTranscript, addToast]
  );

  const handleVerwerk = useCallback(
    (id: number) => {
      verwerkMutation.mutate(id, {
        onSuccess: () => addToast("Verwerking gestart", "succes"),
        onError: () => addToast("Verwerking mislukt", "fout"),
      });
    },
    [verwerkMutation, addToast]
  );

  const handleUploadAudio = useCallback(
    (id: number, file: File) => {
      uploadAudioMutation.mutate(
        { id, audio: file },
        {
          onSuccess: () => {
            addToast("Audio geupload, starten met verwerking...", "succes");
            verwerkMutation.mutate(id, {
              onSuccess: () => addToast("Verwerking gestart", "succes"),
              onError: () => addToast("Verwerking mislukt", "fout"),
            });
          },
          onError: () => addToast("Upload mislukt", "fout"),
        }
      );
    },
    [uploadAudioMutation, verwerkMutation, addToast]
  );

  // Highlight search in transcript
  const highlightTranscript = useCallback(
    (text: string) => {
      if (!transcriptZoek.trim()) return text;
      const regex = new RegExp(`(${transcriptZoek.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      return text.replace(regex, "**$1**");
    },
    [transcriptZoek]
  );

  // ============ DETAIL VIEW ============
  if (selectedId !== null && typeof selectedId === "number" && selectedMeeting) {
    const m = selectedMeeting;
    const sc = m.status ? statusConfig[m.status] : null;

    return (
      <PageTransition>
        <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
          {/* Back + header */}
          <div>
            <button
              onClick={() => { setSelectedId(null); setShowTranscript(false); setTranscriptZoek(""); }}
              className="flex items-center gap-2 text-autronis-text-secondary hover:text-autronis-accent transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Terug naar overzicht
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-autronis-text-primary">{m.titel}</h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-autronis-text-secondary">
                    <Calendar className="w-4 h-4" />
                    {formatDatum(m.datum)} {formatTijd(m.datum)}
                  </span>
                  {m.duurMinuten && (
                    <span className="flex items-center gap-1.5 text-autronis-text-secondary">
                      <Clock className="w-4 h-4" />
                      {formatDuur(m.duurMinuten)}
                    </span>
                  )}
                  {m.klantNaam && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-autronis-accent/15 text-autronis-accent">
                      {m.klantNaam}
                    </span>
                  )}
                  {m.projectNaam && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                      {m.projectNaam}
                    </span>
                  )}
                  {sc && (
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5", sc.bg, sc.color)}>
                      {m.status === "verwerken" && <Loader2 className="w-3 h-3 animate-spin" />}
                      {sc.label}
                    </span>
                  )}
                  {m.deelnemers.length > 0 && (
                    <span className="flex items-center gap-1.5 text-autronis-text-secondary">
                      <Users className="w-4 h-4" />
                      {m.deelnemers.length} deelnemers
                    </span>
                  )}
                  {m.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-autronis-bg border border-autronis-border text-autronis-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id as number)}
                className="p-2 text-autronis-text-secondary hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Meeting URL */}
          {m.meetingUrl && (
            <a
              href={m.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-autronis-accent/10 text-autronis-accent rounded-xl hover:bg-autronis-accent/20 transition-colors"
            >
              <Video className="w-4 h-4" />
              Deelnemen aan meeting
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Sentiment */}
          {m.sentiment && (
            <div className="flex items-center gap-2 bg-autronis-card/50 border border-autronis-border/50 rounded-xl px-4 py-3">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="text-sm text-autronis-text-secondary">Stemming:</span>
              <span className="text-sm text-autronis-text-primary font-medium">{m.sentiment}</span>
            </div>
          )}

          {/* Audio player or upload */}
          {m.audioPad ? (
            <AudioPlayer src={`/api/meetings/${m.id}/audio`} />
          ) : (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2 mb-3">
                <Upload className="w-4 h-4 text-autronis-text-secondary" />
                Upload opname
              </h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border border-autronis-border border-dashed rounded-xl cursor-pointer hover:border-autronis-accent/50 transition-colors">
                  <Upload className="w-4 h-4 text-autronis-text-secondary" />
                  <span className="text-sm text-autronis-text-secondary">Kies audiobestand (mp3, m4a, wav, webm)</span>
                  <input
                    type="file"
                    accept=".mp3,.m4a,.wav,.webm,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadAudio(m.id as number, file);
                    }}
                  />
                </label>
                {uploadAudioMutation.isPending && (
                  <Loader2 className="w-4 h-4 text-autronis-accent animate-spin" />
                )}
              </div>
            </div>
          )}

          {m.status === "verwerken" && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
              <p className="text-yellow-400 font-medium">Meeting wordt verwerkt...</p>
            </div>
          )}

          {m.status === "mislukt" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
              <p className="text-red-400 font-medium mb-3">Verwerking mislukt</p>
              <button
                onClick={() => handleVerwerk(m.id as number)}
                disabled={verwerkMutation.isPending}
                className="px-4 py-2 bg-autronis-accent text-autronis-bg rounded-xl font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
              >
                {verwerkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Opnieuw verwerken"}
              </button>
            </div>
          )}

          {/* Samenvatting / Notities */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-autronis-accent" />
              {m.status === "klaar" ? "Samenvatting & Notities" : "Notities"}
            </h2>
            <textarea
              value={notitiesText}
              onChange={(e) => { setNotitiesText(e.target.value); setNotitiesDirty(true); }}
              placeholder="Voeg notities toe aan deze meeting..."
              rows={6}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none leading-relaxed"
            />
            {notitiesDirty && (
              <button
                onClick={() => handleSaveNotities(m.id as number)}
                disabled={updateMutation.isPending}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-autronis-accent text-autronis-bg rounded-xl font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Opslaan
              </button>
            )}
          </div>

          {/* Actiepunten + Besluiten grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {m.actiepunten.length > 0 && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Actiepunten
                  <span className="text-sm font-normal text-autronis-text-secondary">({m.actiepunten.length})</span>
                </h2>
                <div className="space-y-2.5">
                  {m.actiepunten.map((ap, i) => {
                    const style = getVerantwoordelijkeStyle(ap.verantwoordelijke);
                    return (
                      <div key={i} className="flex items-start gap-3 bg-autronis-bg/30 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-autronis-text-primary flex-1">{ap.tekst}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", style.bg, style.color)}>
                          {ap.verantwoordelijke}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {m.besluiten.length > 0 && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                  Besluiten
                  <span className="text-sm font-normal text-autronis-text-secondary">({m.besluiten.length})</span>
                </h2>
                <div className="space-y-2">
                  {m.besluiten.map((b, i) => (
                    <div key={i} className="flex items-start gap-3 bg-autronis-bg/30 rounded-xl px-4 py-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                      <span className="text-sm text-autronis-text-primary">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Open vragen */}
          {m.openVragen.length > 0 && (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
              <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-yellow-400" />
                Open vragen
                <span className="text-sm font-normal text-autronis-text-secondary">({m.openVragen.length})</span>
              </h2>
              <div className="space-y-2">
                {m.openVragen.map((v, i) => (
                  <div key={i} className="flex items-start gap-3 bg-autronis-bg/30 rounded-xl px-4 py-3">
                    <HelpCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-autronis-text-primary">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {m.transcript ? (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center gap-2 text-lg font-semibold text-autronis-text-primary w-full"
              >
                <MessageSquare className="w-5 h-5 text-autronis-text-secondary" />
                Transcript
                <ChevronDown className={cn("w-5 h-5 text-autronis-text-secondary ml-auto transition-transform", showTranscript && "rotate-180")} />
              </button>
              {showTranscript && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
                    <input
                      type="text"
                      value={transcriptZoek}
                      onChange={(e) => setTranscriptZoek(e.target.value)}
                      placeholder="Zoek in transcript..."
                      className="w-full bg-autronis-bg border border-autronis-border rounded-xl pl-9 pr-4 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                    />
                  </div>
                  <div className="text-sm text-autronis-text-secondary leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {transcriptZoek.trim() ? (
                      highlightTranscript(m.transcript).split("**").map((part, i) =>
                        i % 2 === 1 ? (
                          <mark key={i} className="bg-autronis-accent/30 text-autronis-text-primary rounded px-0.5">
                            {part}
                          </mark>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )
                    ) : (
                      m.transcript
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : m.status !== "verwerken" ? (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
              <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-autronis-text-secondary" />
                Transcript plakken
              </h2>
              <textarea
                value={pasteTranscript}
                onChange={(e) => setPasteTranscript(e.target.value)}
                placeholder="Plak hier het transcript van de meeting..."
                rows={8}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
              />
              <button
                onClick={() => handleSubmitTranscript(m.id as number)}
                disabled={transcriptMutation.isPending || !pasteTranscript.trim()}
                className="mt-3 px-5 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {transcriptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Verwerk
              </button>
            </div>
          ) : null}
        </div>
      </PageTransition>
    );
  }

  // ============ CALENDAR MEETING EXPANDED VIEW ============
  if (selectedId !== null && typeof selectedId === "string") {
    const calMeeting = meetings.find((m) => m.id === selectedId);
    if (!calMeeting) {
      setSelectedId(null);
      return null;
    }

    return (
      <PageTransition>
        <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 text-autronis-text-secondary hover:text-autronis-accent transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug naar overzicht
          </button>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                Kalender
              </span>
              {isUpcoming(calMeeting.datum) && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-autronis-accent/10 text-autronis-accent">
                  {formatCountdown(calMeeting.datum)}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">{calMeeting.titel}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-autronis-text-secondary">
                <Calendar className="w-4 h-4" />
                {formatDatum(calMeeting.datum)} {formatTijd(calMeeting.datum)}
                {calMeeting.eindDatum && ` - ${formatTijd(calMeeting.eindDatum)}`}
              </span>
              {calMeeting.duurMinuten && (
                <span className="flex items-center gap-1.5 text-autronis-text-secondary">
                  <Clock className="w-4 h-4" />
                  {formatDuur(calMeeting.duurMinuten)}
                </span>
              )}
              {calMeeting.bronNaam && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                  {calMeeting.bronNaam}
                </span>
              )}
            </div>
          </div>

          {/* Meeting URL */}
          {calMeeting.meetingUrl && (
            <a
              href={calMeeting.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-autronis-accent text-autronis-bg rounded-xl font-semibold hover:bg-autronis-accent-hover transition-colors"
            >
              <Video className="w-5 h-5" />
              Deelnemen aan meeting
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Deelnemers */}
          {calMeeting.deelnemers.length > 0 && (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                Deelnemers
                <span className="text-sm font-normal text-autronis-text-secondary">({calMeeting.deelnemers.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {calMeeting.deelnemers.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 bg-autronis-bg/30 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-autronis-accent/15 flex items-center justify-center text-xs font-semibold text-autronis-accent">
                      {(d.naam || d.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-autronis-text-primary truncate">{d.naam || d.email.split("@")[0]}</p>
                      <p className="text-xs text-autronis-text-secondary truncate">{d.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Omschrijving */}
          {calMeeting.omschrijving && (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-autronis-text-secondary" />
                Omschrijving
              </h2>
              <p className="text-sm text-autronis-text-secondary leading-relaxed whitespace-pre-wrap">
                {calMeeting.omschrijving}
              </p>
            </div>
          )}

          {/* Locatie */}
          {calMeeting.locatie && !calMeeting.meetingUrl && (
            <div className="flex items-center gap-2 bg-autronis-card/50 border border-autronis-border/50 rounded-xl px-4 py-3">
              <span className="text-sm text-autronis-text-secondary">Locatie:</span>
              <span className="text-sm text-autronis-text-primary">{calMeeting.locatie}</span>
            </div>
          )}

          {/* Create DB record + add notities */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-autronis-accent" />
              Notities toevoegen
            </h2>
            <p className="text-sm text-autronis-text-secondary mb-3">
              Voeg notities toe om deze meeting op te slaan in de database.
            </p>
            <textarea
              value={notitiesText}
              onChange={(e) => { setNotitiesText(e.target.value); setNotitiesDirty(true); }}
              placeholder="Voeg notities toe aan deze meeting..."
              rows={6}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
            />
            <button
              onClick={() => {
                updateMutation.mutate(
                  {
                    id: 0,
                    calendarImport: true,
                    titel: calMeeting.titel,
                    datum: calMeeting.datum,
                    notities: notitiesText,
                  },
                  {
                    onSuccess: () => {
                      addToast("Meeting opgeslagen met notities", "succes");
                      setSelectedId(null);
                      setNotitiesText("");
                      setNotitiesDirty(false);
                    },
                    onError: () => addToast("Opslaan mislukt", "fout"),
                  }
                );
              }}
              disabled={updateMutation.isPending || !notitiesText.trim()}
              className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Opslaan als meeting
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  // ============ LOADING ============
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
      </div>
    );
  }

  // ============ LIST VIEW ============
  const nextMeeting = upcoming[0];

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-5">
        {/* Hero header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">Meetings</h1>
            <p className="text-sm text-autronis-text-secondary mt-0.5">
              Neem meetings op, krijg automatische samenvattingen en zet alles om in taken.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nieuwe meeting
            </button>
          </div>
        </div>

        {/* Smart stats — show AI output value */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-autronis-card border border-autronis-border rounded-xl p-3.5 card-glow">
            <p className="text-xl font-bold text-autronis-text-primary tabular-nums">{kpis.dezeWeek}</p>
            <p className="text-[11px] text-autronis-text-secondary mt-0.5">Meetings deze week</p>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-xl p-3.5 card-glow">
            <p className="text-xl font-bold text-autronis-accent tabular-nums">{kpis.totaalActiepunten}</p>
            <p className="text-[11px] text-autronis-text-secondary mt-0.5">Actiepunten gegenereerd</p>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-xl p-3.5 card-glow">
            <p className="text-xl font-bold text-emerald-400 tabular-nums">{kpis.verwerkt}</p>
            <p className="text-[11px] text-autronis-text-secondary mt-0.5">AI geanalyseerd</p>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-xl p-3.5 card-glow">
            <p className="text-xl font-bold text-purple-400 tabular-nums">{kpis.totaalMinuten > 0 ? formatDuur(kpis.totaalMinuten) : "—"}</p>
            <p className="text-[11px] text-autronis-text-secondary mt-0.5">Totale tijd opgenomen</p>
          </div>
        </div>

        {/* Next meeting hero — only if upcoming */}
        {nextMeeting && (
          <div className="bg-gradient-to-r from-autronis-accent/10 via-autronis-card to-autronis-card border border-autronis-accent/20 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-autronis-accent/15 rounded-xl shrink-0">
                  <Video className="w-5 h-5 text-autronis-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-autronis-accent font-semibold uppercase tracking-wide">Volgende meeting</p>
                  <p className="text-base font-semibold text-autronis-text-primary truncate">{nextMeeting.titel}</p>
                  <p className="text-xs text-autronis-text-secondary">
                    {formatDatum(nextMeeting.datum)} om {formatTijd(nextMeeting.datum)}
                    {nextMeeting.klantNaam && ` · ${nextMeeting.klantNaam}`}
                    {nextMeeting.deelnemers.length > 0 && ` · ${nextMeeting.deelnemers.length} deelnemers`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {nextMeeting.meetingUrl && (
                  <a href={nextMeeting.meetingUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Deelnemen
                  </a>
                )}
                <button onClick={() => setSelectedId(nextMeeting.id)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-autronis-border hover:border-autronis-accent/50 text-autronis-text-secondary hover:text-autronis-accent rounded-xl text-sm font-medium transition-colors">
                  <Sparkles className="w-3.5 h-3.5" />
                  Voorbereiden
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search + filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
            <input
              type="text"
              value={zoekTerm}
              onChange={(e) => setZoekTerm(e.target.value)}
              placeholder="Zoek in transcripts, samenvattingen, actiepunten..."
              className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            />
          </div>
          <select
            value={filterKlant ?? ""}
            onChange={(e) => setFilterKlant(e.target.value ? Number(e.target.value) : null)}
            className="bg-autronis-card border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
          >
            <option value="">Alle klanten</option>
            {klanten.map((k) => (
              <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>
            ))}
          </select>
        </div>

        {/* Upcoming meetings (if more than 1) */}
        {upcoming.length > 1 && (
          <div>
            <h2 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-autronis-accent" />
              Aankomende meetings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcoming.slice(1, 7).map((m) => (
                <UpcomingMeetingCard key={String(m.id)} meeting={m} onSelect={() => setSelectedId(m.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Meetings list */}
        {meetings.length === 0 && !isLoading ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-8 lg:p-12 text-center">
            <div className="inline-flex p-4 bg-autronis-accent/10 rounded-2xl mb-4">
              <Mic className="w-10 h-10 text-autronis-accent" />
            </div>
            <h2 className="text-xl font-bold text-autronis-text-primary mb-2">AI Meeting Intelligence</h2>
            <div className="space-y-2 mb-6 max-w-md mx-auto">
              <p className="text-sm text-autronis-text-secondary flex items-center gap-2 justify-center">
                <Mic className="w-4 h-4 text-autronis-accent shrink-0" /> Neem een meeting op of upload audio
              </p>
              <p className="text-sm text-autronis-text-secondary flex items-center gap-2 justify-center">
                <Sparkles className="w-4 h-4 text-autronis-accent shrink-0" /> Krijg automatisch samenvattingen en actiepunten
              </p>
              <p className="text-sm text-autronis-text-secondary flex items-center gap-2 justify-center">
                <CheckCircle2 className="w-4 h-4 text-autronis-accent shrink-0" /> Taken worden direct aangemaakt
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Plus className="w-4 h-4" />
              Start eerste meeting
            </button>
          </div>
        ) : recent.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-autronis-text-secondary" />
              Recente meetings
            </h2>
            <div className="space-y-2">
              {recent.map((m) => (
                <MeetingListItem
                  key={String(m.id)}
                  meeting={m}
                  onSelect={() => setSelectedId(m.id)}
                  onDelete={() => { if (typeof m.id === "number") handleDelete(m.id); }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Upload modal */}
        {showModal && (
          <UploadModal
            onClose={() => setShowModal(false)}
            uploadMutation={uploadMutation}
            verwerkMutation={verwerkMutation}
            addToast={addToast}
          />
        )}
      </div>
    </PageTransition>
  );
}

// ============ UPLOAD MODAL ============

interface UploadModalProps {
  onClose: () => void;
  uploadMutation: ReturnType<typeof useUploadMeeting>;
  verwerkMutation: ReturnType<typeof useVerwerkMeeting>;
  addToast: (msg: string, type: "succes" | "fout") => void;
}

function UploadModal({ onClose, uploadMutation, verwerkMutation, addToast }: UploadModalProps) {
  const [titel, setTitel] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [klantId, setKlantId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [inputModus, setInputModus] = useState<"upload" | "opname" | "transcript">("upload");
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [projecten, setProjecten] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/klanten")
      .then((r) => r.json())
      .then((d) => setKlanten(d.klanten || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!klantId) {
      setProjecten([]);
      setProjectId(null);
      return;
    }
    fetch(`/api/projecten?klantId=${klantId}`)
      .then((r) => r.json())
      .then((d) => setProjecten(d.projecten || []))
      .catch(() => {});
  }, [klantId]);

  const handleRecorded = useCallback((file: File) => {
    setAudioFile(file);
    setInputModus("upload");
    addToast("Opname opgeslagen", "succes");
  }, [addToast]);

  const handleSubmit = async () => {
    if (!titel.trim()) {
      addToast("Titel is verplicht", "fout");
      return;
    }

    const formData = new FormData();
    formData.append("titel", titel);
    formData.append("datum", datum);
    if (klantId) formData.append("klantId", String(klantId));
    if (projectId) formData.append("projectId", String(projectId));
    if (audioFile) formData.append("audio", audioFile);
    if (transcript.trim()) formData.append("transcript", transcript);

    uploadMutation.mutate(formData, {
      onSuccess: (data) => {
        addToast("Meeting aangemaakt", "succes");
        const meetingId = data?.meeting?.id;
        if (meetingId && (audioFile || transcript.trim())) {
          verwerkMutation.mutate(meetingId, {
            onSuccess: () => addToast("Verwerking gestart", "succes"),
            onError: () => addToast("Verwerking mislukt", "fout"),
          });
        }
        onClose();
      },
      onError: (err) => addToast(err.message || "Upload mislukt", "fout"),
    });
  };

  const submitting = uploadMutation.isPending || verwerkMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-autronis-text-primary">Nieuwe meeting</h2>
          <button onClick={onClose} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Titel */}
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1.5">Titel *</label>
            <input
              type="text"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Bijv. Kickoff project X"
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            />
          </div>

          {/* Datum */}
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1.5">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            />
          </div>

          {/* Klant */}
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1.5">Klant (optioneel)</label>
            <select
              value={klantId ?? ""}
              onChange={(e) => setKlantId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            >
              <option value="">Geen klant</option>
              {klanten.map((k) => (
                <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          {klantId && projecten.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-autronis-text-secondary mb-1.5">Project (optioneel)</label>
              <select
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
              >
                <option value="">Geen project</option>
                {projecten.map((p) => (
                  <option key={p.id} value={p.id}>{p.naam}</option>
                ))}
              </select>
            </div>
          )}

          {/* AI Voorbereiding */}
          <VoorbereidingPanel klantId={klantId} projectId={projectId} titel={titel} />

          {/* Input mode tabs */}
          <div className="flex items-center gap-1 bg-autronis-bg rounded-xl p-1">
            <button
              onClick={() => setInputModus("upload")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                inputModus === "upload" ? "bg-autronis-card text-autronis-text-primary" : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
            <button
              onClick={() => setInputModus("opname")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                inputModus === "opname" ? "bg-autronis-card text-autronis-text-primary" : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              <Mic className="w-3.5 h-3.5" />
              Opnemen
            </button>
            <button
              onClick={() => setInputModus("transcript")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                inputModus === "transcript" ? "bg-autronis-card text-autronis-text-primary" : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Transcript
            </button>
          </div>

          {/* Upload */}
          {inputModus === "upload" && (
            <div>
              <label className="flex items-center gap-3 bg-autronis-bg border border-autronis-border border-dashed rounded-xl px-4 py-4 cursor-pointer hover:border-autronis-accent/50 transition-colors">
                <Upload className="w-5 h-5 text-autronis-text-secondary" />
                <span className="text-sm text-autronis-text-secondary">
                  {audioFile ? audioFile.name : "Kies een audiobestand (mp3, m4a, wav, webm)..."}
                </span>
                <input
                  type="file"
                  accept=".mp3,.m4a,.wav,.webm,audio/*,video/*"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {/* Live recording */}
          {inputModus === "opname" && (
            <div className="bg-autronis-bg rounded-xl p-4 border border-autronis-border">
              <LiveRecorder onRecorded={handleRecorded} />
              {audioFile && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Opname klaar: {audioFile.name}
                </p>
              )}
            </div>
          )}

          {/* Direct transcript */}
          {inputModus === "transcript" && (
            <div>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Plak hier het transcript..."
                rows={6}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !titel.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Aanmaken
          </button>
        </div>
      </div>
    </div>
  );
}
