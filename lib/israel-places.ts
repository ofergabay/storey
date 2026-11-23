import cityCatalog from "@/lib/data/israel-cities.json";

// Localities: data.gov.il resource 8f714b6f-c35c-4b40-a0e7-547b675eee0e.
// Streets: data.gov.il resource bf185c7f-1a4e-4662-88c5-fa118a244bda (official names only).

const STREET_RESOURCE = "bf185c7f-1a4e-4662-88c5-fa118a244bda";
const STREET_CACHE_MS = 24 * 60 * 60 * 1000;

export type IsraelCity = {
  code: number;
  name: string;
};

type StreetCache = {
  at: number;
  streets: string[];
};

const cities: IsraelCity[] = (cityCatalog as IsraelCity[])
  .filter((city) => Number.isInteger(city.code) && city.code > 0 && city.name.trim().length >= 2)
  .map((city) => ({ code: city.code, name: city.name }))
  .sort((left, right) => left.name.localeCompare(right.name, "he"));

const cityByCode = new Map(cities.map((city) => [city.code, city]));
const streetCache = new Map<number, StreetCache>();
const streetRequests = new Map<number, Promise<string[]>>();

export function listCities(): IsraelCity[] {
  return cities;
}

export function findCity(code: number): IsraelCity | null {
  return cityByCode.get(code) ?? null;
}

export function listStreets(code: number): Promise<string[]> {
  if (!findCity(code)) return Promise.resolve([]);
  const cached = streetCache.get(code);
  if (cached && Date.now() - cached.at < STREET_CACHE_MS) return Promise.resolve(cached.streets);
  const pending = streetRequests.get(code);
  if (pending) return pending;
  const request = fetchOfficialStreets(code)
    .then((streets) => {
      streetCache.set(code, { at: Date.now(), streets });
      streetRequests.delete(code);
      return streets;
    })
    .catch((error: unknown) => {
      streetRequests.delete(code);
      throw error;
    });
  streetRequests.set(code, request);
  return request;
}

export async function confirmIsraelAddress(
  cityCode: number,
  cityName: string,
  streetName: string,
): Promise<{ ok: true; city: string; streetName: string } | { ok: false; message: string }> {
  const city = findCity(cityCode);
  if (!city || city.name !== cityName) return { ok: false, message: "בחרו עיר מהרשימה." };
  let streets: string[];
  try {
    streets = await listStreets(cityCode);
  } catch {
    return { ok: false, message: "לא הצלחנו לבדוק את הכתובת. הפרטים נשארו בטופס ואפשר לנסות שוב." };
  }
  if (streets.length === 0) return { ok: false, message: "אין רחובות רשמיים ליישוב הזה ברשימה." };
  if (!streets.includes(streetName)) return { ok: false, message: "בחרו רחוב מהרשימה." };
  return { ok: true, city: city.name, streetName };
}

async function fetchOfficialStreets(code: number): Promise<string[]> {
  const names = new Set<string>();
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total && offset < 20000) {
    const page = await searchStreets(code, offset);
    total = page.total;
    for (const name of page.names) names.add(name);
    if (page.fetched === 0) break;
    offset += page.fetched;
  }
  return [...names].sort((left, right) => left.localeCompare(right, "he"));
}

async function searchStreets(code: number, offset: number): Promise<{ total: number; fetched: number; names: string[] }> {
  const params = new URLSearchParams({
    resource_id: STREET_RESOURCE,
    limit: "5000",
    offset: String(offset),
    filters: JSON.stringify({ city_code: code, street_name_status: "official" }),
  });
  const response = await fetch(`https://data.gov.il/api/3/action/datastore_search?${params}`, {
    headers: { "User-Agent": "datagov-external-client", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("address catalog unavailable");
  const body = (await response.json()) as {
    success?: boolean;
    result?: { total?: number; records?: Record<string, unknown>[] };
  };
  const records = body.result?.records;
  if (!body.success || !Array.isArray(records) || typeof body.result?.total !== "number") {
    throw new Error("address catalog unavailable");
  }
  const names: string[] = [];
  for (const record of records) {
    if (record.street_name_status !== "official" || typeof record.street_name !== "string") continue;
    const name = record.street_name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || /[\u0000-\u001f]/.test(name)) continue;
    names.push(name);
  }
  return { total: body.result.total, fetched: records.length, names };
}
