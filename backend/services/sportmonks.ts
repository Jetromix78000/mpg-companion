/**
 * Client HTTP minimal pour l'API SportMonks Football v3 (https://api.sportmonks.com/v3/football).
 *
 * Authentification par `api_token` en query string (méthode documentée par SportMonks,
 * compatible avec tous les plans y compris Free/Standard).
 *
 * ⚠️ IMPORTANT : les identifiants de ligue/saison ci-dessous (ex. Ligue 1 = 301) sont ceux
 * habituellement utilisés par SportMonks mais peuvent varier selon ton plan d'abonnement.
 * Une fois ta clé SPORTMONKS_API_TOKEN obtenue, vérifie-les depuis ton compte
 * (My SportMonks > My Leagues) et ajuste SPORTMONKS_LEAGUE_ID si besoin.
 */

const BASE_URL = "https://api.sportmonks.com/v3/football";

// Ligue 1 (France). Redéfinissable via l'env sans toucher au code.
const DEFAULT_LEAGUE_ID = 301;

export class SportmonksError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SportmonksError";
    this.status = status;
  }
}

export function isSportmonksConfigured(): boolean {
  return Boolean(process.env.SPORTMONKS_API_TOKEN);
}

export function getDefaultLeagueId(): number {
  const fromEnv = process.env.SPORTMONKS_LEAGUE_ID;
  const parsed = fromEnv ? Number.parseInt(fromEnv, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_LEAGUE_ID;
}

interface CacheEntry {
  data: unknown;
  ts: number;
}

// Cache mémoire simple par URL complète : évite de cramer le quota d'appels/jour
// du plan SportMonks pendant les démos, et accélère les réponses côté frontend.
const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60 * 1000; // 1 min : les scores live doivent rester frais
const MAX_CACHE_ENTRIES = 200;

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("api_token", process.env.SPORTMONKS_API_TOKEN ?? "");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// SportMonks répond parfois par des 5xx transitoires : on réessaie avec un backoff court
// plutôt que de casser l'expérience utilisateur pour un aléa réseau.
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (response.ok) return response;
      if (response.status >= 500 && i < attempts - 1) {
        lastErr = new SportmonksError(`SportMonks HTTP ${response.status}`, response.status);
      } else {
        return response;
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Échec de connexion à SportMonks");
}

/**
 * Appelle l'API SportMonks et met le résultat en cache mémoire pendant `ttlMs`.
 * Lève SportmonksError si la clé API est absente ou si SportMonks renvoie une erreur.
 */
export async function sportmonksGet<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  if (!isSportmonksConfigured()) {
    throw new SportmonksError("SPORTMONKS_API_TOKEN non configuré", 503);
  }

  const url = buildUrl(path, params);
  const now = Date.now();

  const cached = cache.get(url);
  if (cached && now - cached.ts < ttlMs) {
    return cached.data as T;
  }

  const response = await fetchWithRetry(url);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && String((body as { message?: unknown }).message)) ||
      `Erreur SportMonks (HTTP ${response.status})`;
    throw new SportmonksError(message, response.status);
  }

  if (cache.size > MAX_CACHE_ENTRIES) {
    // Purge grossière : on vide tout plutôt que de gérer une LRU pour un cache
    // dont la volumétrie reste faible (quelques dizaines d'endpoints distincts).
    cache.clear();
  }
  cache.set(url, { data: body, ts: now });

  return body as T;
}

// --- Helpers de haut niveau, réutilisés par /api/football et /api/dashboard ---

interface SportmonksListResponse<T> {
  data: T;
}

/** ID de la saison en cours pour une ligue. Change rarement : cache 6h. */
export async function getCurrentSeasonId(leagueId: number = getDefaultLeagueId()): Promise<number> {
  const result = await sportmonksGet<
    SportmonksListResponse<{ currentseason?: { id: number } }>
  >(`/leagues/${leagueId}`, { include: "currentseason" }, 6 * 60 * 60 * 1000);

  const seasonId = result.data?.currentseason?.id;
  if (!seasonId) {
    throw new SportmonksError("Saison en cours introuvable pour cette ligue", 502);
  }
  return seasonId;
}

/** Prochains matchs de la ligue configurée sur les `days` prochains jours (défaut 14 min 1 min 90). */
export async function getUpcomingFixtures(
  leagueId: number = getDefaultLeagueId(),
  days = 14,
) {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const result = await sportmonksGet<SportmonksListResponse<unknown[]>>(
    `/fixtures/between/${fmt(start)}/${fmt(end)}`,
    {
      include: "participants;scores;league",
      filters: `fixtureLeagues:${leagueId}`,
    },
    5 * 60 * 1000,
  );
  return result.data;
}

/** Scores en direct, filtrés sur la ligue configurée. Cache très court (30s). */
export async function getLiveScores(leagueId: number = getDefaultLeagueId()) {
  const result = await sportmonksGet<SportmonksListResponse<unknown[]>>(
    "/livescores/inplay",
    {
      include: "participants;scores;league",
      filters: `fixtureLeagues:${leagueId}`,
    },
    30 * 1000,
  );
  return result.data;
}

/** Classement complet de la saison en cours. */
export async function getStandings(leagueId: number = getDefaultLeagueId()) {
  const seasonId = await getCurrentSeasonId(leagueId);
  const result = await sportmonksGet<SportmonksListResponse<unknown[]>>(
    `/standings/seasons/${seasonId}`,
    { include: "participant" },
    5 * 60 * 1000,
  );
  return result.data;
}

/** Équipes engagées dans la saison en cours de la ligue configurée. */
export async function getTeams(leagueId: number = getDefaultLeagueId()) {
  const seasonId = await getCurrentSeasonId(leagueId);
  const result = await sportmonksGet<SportmonksListResponse<unknown[]>>(
    `/teams/seasons/${seasonId}`,
    { include: "venue" },
    60 * 60 * 1000,
  );
  return result.data;
}
