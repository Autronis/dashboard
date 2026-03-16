import type { BannerIcon } from "@/types/content";

interface CapsuleIconProps {
  icon: BannerIcon;
  size?: number;
}

const NEON = "#2DD4A8";
const SW = "2";

export function CapsuleIcon({ icon, size = 32 }: CapsuleIconProps) {
  const s = size;

  switch (icon) {
    case "cog":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke={NEON} strokeWidth={SW} />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="5" x2="12" y2="18" stroke={NEON} strokeWidth="1" strokeDasharray="3,3" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="12" width="4" height="9" rx="1" stroke={NEON} strokeWidth={SW} />
          <rect x="10" y="7" width="4" height="14" rx="1" stroke={NEON} strokeWidth={SW} />
          <rect x="17" y="3" width="4" height="18" rx="1" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "link":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "target":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={SW} />
          <circle cx="12" cy="12" r="6" stroke={NEON} strokeWidth={SW} />
          <circle cx="12" cy="12" r="2" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "git-branch":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <line x1="6" y1="3" x2="6" y2="15" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <circle cx="18" cy="6" r="3" stroke={NEON} strokeWidth={SW} />
          <circle cx="6" cy="18" r="3" stroke={NEON} strokeWidth={SW} />
          <path d="M18 9a9 9 0 0 1-9 9" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "zap":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case "plug":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 22V12M5 12H2a10 10 0 0 0 20 0h-3" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <rect x="7" y="2" width="3" height="5" rx="1" stroke={NEON} strokeWidth={SW} />
          <rect x="14" y="2" width="3" height="5" rx="1" stroke={NEON} strokeWidth={SW} />
          <path d="M7 7v2a5 5 0 0 0 10 0V7" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" stroke={NEON} strokeWidth={SW} />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "euro":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4 10h12M4 14h12" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M19.5 7.5A7 7 0 1 0 19.5 16.5" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
  }
}
