/**
 * Accès à l'API football SportMonks : authentification, appels HTTP, et les
 * fonctions métier que les routes appellent.
 *
 * Documentation : https://docs.sportmonks.com/football
 */
import dotenv from "dotenv";
import type { InjuryItem, Player, TransferMovement } from "../../shared/types";

dotenv.config();

const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_TOKEN?.trim() ?? "";

/** Les routes football répondent 503 tant que la clé n'est pas renseignée. */
function isSportmonksConfigured(): boolean {
  return Boolean(SPORTMONKS_TOKEN);
}

if (!isSportmonksConfigured()) {
  console.warn(
    "SPORTMONKS_API_TOKEN non configuré : les routes /api/football, /api/players, /api/injuries, /api/transfers et /api/dashboard répondront 503.",
  );
}

export interface SportmonksPagination {
  count: number;
  per_page: number;
  current_page: number;
  next_page: string | null;
  has_more: boolean;
}

export interface SportmonksRateLimit {
  resets_in_seconds: number;
  remaining: number;
  requested_entity: string;
}

export interface SportmonksEnvelope<T> {
  data: T;
  pagination?: SportmonksPagination;
  subscription?: unknown[];
  rate_limit?: SportmonksRateLimit;
  timezone?: string;
}

/** Options de requête acceptées par tous les endpoints. */
export interface SportmonksQuery {
  /** Relations à charger, ex. ["team", "position"] ou ["sidelined.player"]. */
  include?: string[];
  /** Filtres SportMonks, ex. { populate: "..." }. Assemblés en "clé:valeur;clé:valeur". */
  filters?: Record<string, string>;
  /** Champs à ne pas charger inutilement, ex. { players: "image_path,height" }. */
  select?: Record<string, string>;
  page?: number;
  perPage?: number;
}

/**
 * Erreur remontée par le client SportMonks.
 * `status` est repris tel quel par les routes pour choisir le code HTTP renvoyé au front.
 */
export class SportmonksError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "SportmonksError";
  }
}

/**
 * Client HTTP SportMonks v3.
 *
 * Toute la plomberie tient ici — authentification, assemblage des paramètres,
 * déballage de l'enveloppe, traduction des erreurs — pour que les services métier
 * (players, injuries, transfers, dashboard) n'aient plus qu'à nommer leur endpoint.
 *
 * Documentation : https://docs.sportmonks.com/football
 */
export const SPORTMONKS_BASE_URL = "https://api.sportmonks.com/v3/football";

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * SportMonks attend le token nu dans l'en-tête Authorization, sans préfixe `Bearer`.
 * Écrire "Bearer <token>" ici renverrait un 401 difficile à diagnostiquer.
 */
function authHeaders(): Record<string, string> {
  return {
    Authorization: SPORTMONKS_TOKEN,
    Accept: "application/json",
  };
}

/** Traduit les options typées en paramètres d'URL SportMonks. */
function buildSearchParams(query: SportmonksQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.include?.length) {
    params.set("include", query.include.join(";"));
  }
  if (query.filters && Object.keys(query.filters).length > 0) {
    params.set(
      "filters",
      Object.entries(query.filters)
        .map(([key, value]) => `${key}:${value}`)
        .join(";"),
    );
  }
  if (query.select && Object.keys(query.select).length > 0) {
    params.set(
      "select",
      Object.entries(query.select)
        .map(([entity, fields]) => `${entity}:${fields}`)
        .join(";"),
    );
  }
  if (query.page) params.set("page", String(query.page));
  if (query.perPage) params.set("per_page", String(query.perPage));

  return params;
}

/** Messages parlants plutôt qu'un code nu, pour que l'erreur soit lisible en logs. */
function describeStatus(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return "Clé SportMonks invalide ou plan insuffisant pour cette ressource";
    case 404:
      return "Ressource introuvable côté SportMonks";
    case 429:
      return "Quota SportMonks dépassé, réessayez plus tard";
    default:
      return `Erreur SportMonks (HTTP ${status})`;
  }
}

/**
 * Appelle un endpoint SportMonks et renvoie l'enveloppe complète.
 * Utile quand la pagination ou le quota restant compte — la route /health s'en sert.
 *
 * @param path chemin relatif à la base, ex. "/players/search/mbappe"
 * @throws SportmonksError avec le statut à propager au client
 */
export async function sportmonksFetchEnvelope<T>(
  path: string,
  query: SportmonksQuery = {},
): Promise<SportmonksEnvelope<T>> {
  // Mode dégradé plutôt que crash au démarrage : on peut développer le reste de
  // l'application sans clé, seules les routes football répondent 503.
  if (!isSportmonksConfigured()) {
    throw new SportmonksError("SPORTMONKS_API_TOKEN non configuré", 503);
  }

  const params = buildSearchParams(query);
  const suffix = params.toString();
  const url = `${SPORTMONKS_BASE_URL}${path}${suffix ? `?${suffix}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    // Coupure réseau ou dépassement du délai : 504, la faute n'est pas au client.
    throw new SportmonksError(
      `SportMonks injoignable : ${error instanceof Error ? error.message : String(error)}`,
      504,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SportmonksError(
      describeStatus(response.status),
      response.status,
      detail.slice(0, 500),
    );
  }

  return (await response.json()) as SportmonksEnvelope<T>;
}

/** Même appel, déballé : les services métier ne voient que le contenu de `data`. */
export async function sportmonksFetch<T>(path: string, query: SportmonksQuery = {}): Promise<T> {
  const envelope = await sportmonksFetchEnvelope<T>(path, query);
  return envelope.data;
}

// --- Fonctions métier, à implémenter (voir les routes correspondantes) ---

/**
 * TEMPLATE. Endpoints : GET /players/search/{name}?include=team;position
 *
 * Mapper la réponse SportMonks vers le type `Player` de shared/types.ts, que
 * toute l'interface consomme déjà. Les champs `form`, `note`, `probabilityToPlay`,
 * `iaJustification` et `comparison` n'ont pas d'équivalent direct chez SportMonks :
 * à calculer depuis `statistics.details`, ou à laisser neutres dans un premier temps.
 */
export async function searchPlayers(_name: string): Promise<Player[]> {
  throw new Error("TODO: searchPlayers — mapper /players/search/{name} vers Player[]");
}

/** TEMPLATE. Endpoint : GET /players/{id}?include=team;position;statistics.details */
export async function getPlayerById(_id: string): Promise<Player | null> {
  throw new Error("TODO: getPlayerById — mapper /players/{id} vers Player");
}

/**
 * TEMPLATE — Centre des blessures.
 *
 * ATTENTION : SportMonks n'expose PAS d'endpoint /injuries autonome. Les absences
 * passent par l'include `sidelined` sur une équipe ou un match :
 *
 *   GET /teams/{teamId}?include=sidelined.sideline;sidelined.player;sidelined.type
 *
 * Chaque enregistrement porte un booléen `completed` : `false` signifie que le
 * joueur est toujours absent. Construire la vue impose donc d'itérer sur les
 * équipes d'une saison (GET /teams/seasons/{seasonId}) — attention au quota.
 */
export async function getInjuries(_leagueId?: number): Promise<InjuryItem[]> {
  throw new Error("TODO: getInjuries — agréger l'include sidelined des équipes");
}

/**
 * TEMPLATE. Endpoints : GET /transfers/latest?include=player;fromteam;toteam
 *
 * Limite connue : SportMonks ne publie que des transferts actés. Les champs
 * `type: "Rumor"`, `confidence` et `statusLabel` de TransferMovement n'ont pas
 * d'équivalent — les transferts réels seront tous de type "Official".
 */
export async function getLatestTransfers(): Promise<TransferMovement[]> {
  throw new Error("TODO: getLatestTransfers — mapper /transfers/latest");
}

/**
 * Contrat de réponse de GET /api/dashboard, déjà consommé par DashboardView.
 * Le respecter à l'identique permet de brancher l'API réelle sans toucher au front.
 */
export interface DashboardPayload {
  topPlayers: Player[];
}

/**
 * TODO // Djamal — TEMPLATE. Endpoints :
 *   GET /standings/seasons/{seasonId}?include=participant
 *   GET /fixtures/between/{start}/{end}?include=participants
 *   GET /topscorers/seasons/{seasonId}?include=player;participant
 *
 * Les trois appels sont indépendants : les lancer avec Promise.all plutôt qu'en
 * série. Prévoir un cache, le plan gratuit est vite consommé.
 */
export async function getDashboard(_seasonId: number): Promise<DashboardPayload> {
  throw new Error("TODO // Djamal: getDashboard — agréger standings, fixtures et topscorers");
}
