export function detectLocatie(): "kantoor" | "thuis" {
  if (typeof navigator === "undefined") return "kantoor";
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "thuis";
  return "kantoor"; // Mac = kantoor
}
