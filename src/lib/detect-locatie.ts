const LOCATIE_KEY = "autronis-locatie-config";

interface LocatieConfig {
  thuisIps: string[];
  laatsteLocatie: "kantoor" | "thuis";
}

function getConfig(): LocatieConfig {
  if (typeof localStorage === "undefined") return { thuisIps: [], laatsteLocatie: "kantoor" };
  try {
    const stored = localStorage.getItem(LOCATIE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { thuisIps: [], laatsteLocatie: "kantoor" };
}

function saveConfig(config: LocatieConfig) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCATIE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

/** Register current IP as a "thuis" or "kantoor" IP */
export function registreerLocatie(locatie: "kantoor" | "thuis") {
  const config = getConfig();
  config.laatsteLocatie = locatie;
  saveConfig(config);

  // Also save the current IP for future auto-detection
  fetch("https://api.ipify.org?format=json")
    .then((r) => r.json())
    .then((data: { ip: string }) => {
      if (!data.ip) return;
      if (locatie === "thuis") {
        if (!config.thuisIps.includes(data.ip)) {
          config.thuisIps.push(data.ip);
          saveConfig(config);
        }
      } else {
        // Remove from thuis IPs if it was marked as kantoor
        config.thuisIps = config.thuisIps.filter((ip) => ip !== data.ip);
        saveConfig(config);
      }
    })
    .catch(() => {});
}

/** Detect location: checks IP against known thuis IPs */
export function detectLocatie(): "kantoor" | "thuis" {
  if (typeof navigator === "undefined") return "kantoor";

  const config = getConfig();

  // Return last known location as default (updated async below)
  return config.laatsteLocatie || "kantoor";
}

/** Async version: checks IP and returns accurate location */
export async function detectLocatieAsync(): Promise<"kantoor" | "thuis"> {
  if (typeof navigator === "undefined") return "kantoor";

  const config = getConfig();

  // If no thuis IPs configured yet, fall back to OS detection
  if (config.thuisIps.length === 0) {
    return navigator.userAgent.includes("Windows") ? "thuis" : "kantoor";
  }

  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data: { ip: string } = await res.json();
    const locatie = config.thuisIps.includes(data.ip) ? "thuis" : "kantoor";
    config.laatsteLocatie = locatie;
    saveConfig(config);
    return locatie;
  } catch {
    return config.laatsteLocatie || "kantoor";
  }
}
