const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface DistanceResult {
  afstandMeters: number;
  afstandKm: number;
  duurSeconden: number;
  duurTekst: string;
}

export async function berekenAfstand(
  van: string,
  naar: string
): Promise<DistanceResult | null> {
  if (!MAPS_KEY) {
    console.error("GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", van);
  url.searchParams.set("destination", naar);
  url.searchParams.set("key", MAPS_KEY);
  url.searchParams.set("language", "nl");
  url.searchParams.set("region", "nl");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !data.routes?.length) {
    return null;
  }

  const leg = data.routes[0].legs[0];
  return {
    afstandMeters: leg.distance.value,
    afstandKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    duurSeconden: leg.duration.value,
    duurTekst: leg.duration.text,
  };
}

interface PlacePrediction {
  description: string;
  place_id: string;
}

export async function zoekPlaatsen(
  query: string,
  sessionToken?: string
): Promise<PlacePrediction[]> {
  if (!MAPS_KEY || query.length < 2) return [];

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", query);
  url.searchParams.set("key", MAPS_KEY);
  url.searchParams.set("language", "nl");
  url.searchParams.set("components", "country:nl");
  if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") return [];

  return data.predictions.slice(0, 3).map((p: { description: string; place_id: string }) => ({
    description: p.description,
    place_id: p.place_id,
  }));
}
