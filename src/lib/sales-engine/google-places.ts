const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export interface PlacesData {
  naam: string;
  adres: string;
  rating: number | null;
  aantalReviews: number;
  reviews: PlaceReview[];
  openingstijden: string[];
  telefoon: string | null;
  website: string | null;
  placeId: string;
  categorieen: string[];
}

interface PlaceReview {
  auteur: string;
  rating: number;
  tekst: string;
  datum: string;
}

interface PlaceCandidate {
  place_id: string;
}

interface PlaceDetails {
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    relative_time_description: string;
  }>;
  opening_hours?: { weekday_text?: string[] };
  formatted_phone_number?: string;
  website?: string;
  types?: string[];
}

export async function fetchGooglePlacesData(
  bedrijfsnaam: string,
  websiteUrl: string
): Promise<PlacesData | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;

  try {
    // Extract domain for better search
    const domain = new URL(websiteUrl).hostname.replace("www.", "");

    // Find Place from text search
    const searchQuery = `${bedrijfsnaam} ${domain}`;
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${GOOGLE_PLACES_API_KEY}`;

    const findRes = await fetch(findUrl);
    const findData = (await findRes.json()) as { candidates?: PlaceCandidate[] };

    if (!findData.candidates?.length) return null;

    const placeId = findData.candidates[0].place_id;

    // Get Place details
    const fields = "name,formatted_address,rating,user_ratings_total,reviews,opening_hours,formatted_phone_number,website,types";
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=nl&key=${GOOGLE_PLACES_API_KEY}`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = (await detailsRes.json()) as { result?: PlaceDetails };
    const place = detailsData.result;

    if (!place) return null;

    return {
      naam: place.name ?? bedrijfsnaam,
      adres: place.formatted_address ?? "",
      rating: place.rating ?? null,
      aantalReviews: place.user_ratings_total ?? 0,
      reviews: (place.reviews ?? []).slice(0, 5).map((r) => ({
        auteur: r.author_name,
        rating: r.rating,
        tekst: r.text.substring(0, 300),
        datum: r.relative_time_description,
      })),
      openingstijden: place.opening_hours?.weekday_text ?? [],
      telefoon: place.formatted_phone_number ?? null,
      website: place.website ?? null,
      placeId,
      categorieen: place.types ?? [],
    };
  } catch {
    return null;
  }
}
