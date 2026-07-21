export type PlantFact = {
  commonName: string;
  scientificName: string | null;
  description: string;
  imageUrl: string | null;
};

type PerenualSpeciesDetails = {
  common_name?: string;
  scientific_name?: string[];
  description?: string;
  default_image?: {
    regular_url?: string;
    medium_url?: string;
  } | null;
};

const PERENUAL_API_URL = "https://perenual.com/api/v2";

// Perenual's free tier only serves full detail records for species ids
// 1-3000 (confirmed by probing the live API) -- ids above that return a
// 429 with an "Please Upgrade Plan" body instead of plant data, so picking
// a fully random id would fail most of the time.
const MAX_FREE_SPECIES_ID = 3000;
const FETCH_ATTEMPTS = 3;

// Used when PLANTS_API_KEY is missing, or the API doesn't cooperate after
// a few tries -- this is decorative welcome-page content, not worth a hard
// failure over.
const FALLBACK_FACTS: PlantFact[] = [
  {
    commonName: "Most houseplants",
    scientificName: null,
    description:
      "Most houseplants prefer to dry out slightly between waterings — soggy soil is a more common killer than a dry spell.",
    imageUrl: null,
  },
  {
    commonName: "Snake plant",
    scientificName: "Dracaena trifasciata",
    description:
      "Snake plants release oxygen at night instead of during the day, making them one of the few houseplants that can freshen a bedroom while you sleep.",
    imageUrl: null,
  },
  {
    commonName: "Pothos",
    scientificName: "Epipremnum aureum",
    description:
      "A pothos cutting will happily root in a glass of water for months — some growers keep whole vines going that way without ever potting them in soil.",
    imageUrl: null,
  },
];

function randomFallback(): PlantFact {
  return FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
}

// Server-only (reads PLANTS_API_KEY, calls a third-party API directly) --
// only fetch from a server component/action, never from client code.
export async function getRandomPlantFact(): Promise<PlantFact> {
  const apiKey = process.env.PLANTS_API_KEY;
  if (!apiKey) {
    return randomFallback();
  }

  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    const id = Math.floor(Math.random() * MAX_FREE_SPECIES_ID) + 1;

    try {
      const res = await fetch(`${PERENUAL_API_URL}/species/details/${id}?key=${apiKey}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        continue;
      }

      const data: PerenualSpeciesDetails = await res.json();

      if (!data.description) {
        continue;
      }

      return {
        commonName: data.common_name ?? "Unknown plant",
        scientificName: data.scientific_name?.[0] ?? null,
        description: data.description,
        imageUrl: data.default_image?.regular_url ?? data.default_image?.medium_url ?? null,
      };
    } catch {
      continue;
    }
  }

  return randomFallback();
}
