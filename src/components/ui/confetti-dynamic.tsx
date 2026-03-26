"use client";

import dynamic from "next/dynamic";

export const Confetti = dynamic(
  () => import("./confetti").then((m) => ({ default: m.Confetti })),
  { ssr: false }
);

export const CheckBurst = dynamic(
  () => import("./confetti").then((m) => ({ default: m.CheckBurst })),
  { ssr: false }
);
