/**
 * Accès à l'API football API-FOOTBALL (api-sports.io) : authentification, appels
 * HTTP, et les fonctions métier que les routes football.ts et dashboard.ts appellent.
 *
 * Documentation : https://www.api-football.com/documentation-v3
 *
 * Écrit avec fetch().then() (le pattern vu en cours), pas async/await.
 */
import dotenv from "dotenv";
import type { Player } from "../../shared/types";
import { PlayerPosition } from "../../shared/types";
import { CURRENT_SEASON, LIGUE1_ID, SELECTED_PLAYERS, type SelectedPlayer } from "../data/selectedPlayers";

dotenv.config();

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? "";

function isApiFootballConfigured(): boolean {
  return Boolean(API_FOOTBALL_KEY);
}

if (!isApiFootballConfigured()) {
  console.warn(
    "API_FOOTBALL_KEY non configuré : les routes /api/football/stats et /api/dashboard répondront 503.",
  );
}

export const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

const REQUEST_TIMEOUT_MS = 10_000;

export interface ApiFootballEnvelope<T> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

export class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

function describeStatus(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return "Clé API-FOOTBALL invalide";
    case 404:
      return "Ressource introuvable côté API-FOOTBALL";
    case 429:
      return "Quota API-FOOTBALL dépassé, réessayez plus tard";
    default:
      return `Erreur API-FOOTBALL (HTTP ${status})`;
  }
}

/** Appelle un endpoint API-FOOTBALL et renvoie l'enveloppe complète (avec paging/errors). */
export function apiFootballFetchEnvelope<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<ApiFootballEnvelope<T>> {
  if (!isApiFootballConfigured()) {
    return Promise.reject(new ApiFootballError("API_FOOTBALL_KEY non configuré", 503));
  }

  const url = new URL(`${API_FOOTBALL_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  return fetch(url.toString(), {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
    .catch((error: unknown) => {
      throw new ApiFootballError(
        `API-FOOTBALL injoignable : ${error instanceof Error ? error.message : String(error)}`,
        504,
      );
    })
    .then((response) => {
      if (!response.ok) {
        return response
          .text()
          .catch(() => "")
          .then((detail) => {
            throw new ApiFootballError(describeStatus(response.status), response.status, detail.slice(0, 500));
          });
      }
      return response.json() as Promise<ApiFootballEnvelope<T>>;
    })
    .then((envelope) => {
      // API-FOOTBALL répond parfois en HTTP 200 avec un objet errors non vide
      // (quota dépassé, saison hors plan, paramètre invalide...).
      if (envelope.errors && !Array.isArray(envelope.errors) && Object.keys(envelope.errors).length > 0) {
        throw new ApiFootballError(
          `API-FOOTBALL a renvoyé une erreur : ${JSON.stringify(envelope.errors)}`,
          502,
          envelope.errors,
        );
      }
      return envelope;
    });
}

export function apiFootballFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  return apiFootballFetchEnvelope<T>(path, params).then((envelope) => envelope.response);
}

/**
 * Le plan gratuit API-FOOTBALL limite les requêtes/minute (pas seulement/jour).
 * Envoyer nos requêtes toutes en parallèle déclenche des 429. On les met à la
 * suite les unes des autres avec un petit délai, et on met en cache les réponses.
 */
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
let requestQueue: Promise<unknown> = Promise.resolve();
const THROTTLE_DELAY_MS = 7000;

function apiFootballFetchThrottled<T>(
  path: string,
  params: Record<string, string> = {},
  cacheTtlMs = 5 * 60 * 1000,
): Promise<T> {
  const cacheKey = `${path}?${new URLSearchParams(params).toString()}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.data as T);
  }

  const run: Promise<T> = requestQueue.then(() =>
    apiFootballFetch<T>(path, params).then((result) => {
      responseCache.set(cacheKey, { data: result, expiresAt: Date.now() + cacheTtlMs });
      return new Promise((resolve) => setTimeout(resolve, THROTTLE_DELAY_MS)).then(() => result);
    }),
  );

  requestQueue = run.catch(() => undefined);
  return run;
}

// --- Types bruts API-FOOTBALL (sous-ensemble des champs utilisés) ---

interface RawPlayerInfo {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  age: number;
  nationality: string;
  photo: string;
  injured: boolean;
}

interface RawPlayerStatistics {
  team: { id: number; name: string; logo: string };
  league: { id: number; name: string; season: number };
  games: {
    appearences: number | null;
    lineups: number | null;
    minutes: number | null;
    position: string | null;
    rating: string | null;
  };
  substitutes: { in: number | null; out: number | null; bench: number | null };
  goals: { total: number | null; assists: number | null };
  shots: { total: number | null; on: number | null };
  passes: { total: number | null; key: number | null };
  tackles: { total: number | null; blocks: number | null; interceptions: number | null };
  duels: { total: number | null; won: number | null };
  dribbles: { attempts: number | null; success: number | null };
  fouls: { drawn: number | null; committed: number | null };
  cards: { yellow: number | null; yellowred: number | null; red: number | null };
}

interface RawPlayerEntry {
  player: RawPlayerInfo;
  statistics: RawPlayerStatistics[];
}

interface RawInjuryEntry {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string; logo: string };
  fixture: { id: number; date: string };
  league: { id: number; name: string; season: number };
}

/** GET /players?id=&season= — statistiques saison pour un joueur, sur son équipe Ligue 1. */
function fetchRawPlayerStats(playerId: number): Promise<RawPlayerEntry> {
  return apiFootballFetchThrottled<RawPlayerEntry[]>(
    "/players",
    { id: String(playerId), season: String(CURRENT_SEASON) },
    60 * 60 * 1000,
  ).then((response) => {
    const entry = response.find((e) => e.statistics.some((s) => s.league.id === LIGUE1_ID)) ?? response[0];
    if (!entry) {
      throw new ApiFootballError(`Aucune statistique trouvée pour le joueur ${playerId}`, 404);
    }
    return entry;
  });
}

/** GET /injuries?player=&season= — historique des blessures/indisponibilités du joueur. */
function fetchRawInjuries(playerId: number): Promise<RawInjuryEntry[]> {
  return apiFootballFetchThrottled<RawInjuryEntry[]>(
    "/injuries",
    { player: String(playerId), season: String(CURRENT_SEASON) },
    60 * 60 * 1000,
  );
}

interface RawStandingRow {
  team: { id: number };
  all: { played: number };
}

interface RawStandingsResponse {
  league: { standings: RawStandingRow[][] };
}

/** GET /standings?league=&season=&team= — nombre de matchs joués par l'équipe cette saison. */
const teamGamesPlayedCache = new Map<number, number | null>();
function getTeamGamesPlayed(teamId: number): Promise<number | null> {
  if (teamGamesPlayedCache.has(teamId)) {
    return Promise.resolve(teamGamesPlayedCache.get(teamId)!);
  }

  return apiFootballFetchThrottled<RawStandingsResponse[]>(
    "/standings",
    { league: String(LIGUE1_ID), season: String(CURRENT_SEASON), team: String(teamId) },
    6 * 60 * 60 * 1000,
  )
    .then((response) => {
      const row = response[0]?.league.standings.flat().find((t) => t.team.id === teamId);
      const played = row?.all.played ?? null;
      teamGamesPlayedCache.set(teamId, played);
      return played;
    })
    .catch(() => {
      teamGamesPlayedCache.set(teamId, null);
      return null;
    });
}

export function mapPosition(rawPosition: string | null): { short: string; long: string } {
  switch (rawPosition) {
    case "Goalkeeper":
      return { short: PlayerPosition.Gk, long: rawPosition };
    case "Defender":
      return { short: PlayerPosition.Def, long: rawPosition };
    case "Midfielder":
      return { short: PlayerPosition.Mid, long: rawPosition };
    case "Attacker":
      return { short: PlayerPosition.Fwd, long: rawPosition };
    default:
      return { short: PlayerPosition.Fwd, long: rawPosition ?? "Inconnu" };
  }
}

// --- /api/football/stats : payload sur-mesure, uniquement de la vraie donnée API-FOOTBALL ---

export interface PlayerFootballStats {
  player: {
    id: number;
    name: string;
    fullName: string;
    age: number;
    nationality: string;
    photo: string;
    positionRaw: string | null;
  };
  team: { id: number; name: string; logo: string };
  season: number;
  presence: {
    appearances: number;
    lineups: number;
    substituteIn: number;
    minutesPlayed: number;
    minutesPerAppearance: number | null;
    attendanceRate: number | null;
  };
  performance: {
    goals: number;
    assists: number | null;
    goalsPer90: number | null;
    shotsTotal: number | null;
    shotsOnTarget: number | null;
    keyPasses: number | null;
    dribblesSuccess: number | null;
    tacklesTotal: number | null;
    duelsWonRate: number | null;
    foulsCommitted: number | null;
    yellowCards: number;
    redCards: number;
    seasonRating: number | null;
  };
  injuries: {
    isCurrentlyInjured: boolean;
    history: { date: string; type: string; reason: string; team: string; fixtureId: number }[];
  };
}

/** Un seul joueur, identifié par son ID API-FOOTBALL parmi les joueurs sélectionnés. */
export function getPlayerFootballStats(playerId: number): Promise<PlayerFootballStats> {
  const selected = SELECTED_PLAYERS.find((p) => p.apiFootballId === playerId);
  if (!selected) {
    return Promise.reject(
      new ApiFootballError(`Joueur ${playerId} non autorisé — doit faire partie des joueurs sélectionnés`, 400),
    );
  }

  return Promise.all([
    fetchRawPlayerStats(playerId),
    fetchRawInjuries(playerId).catch(() => [] as RawInjuryEntry[]),
    getTeamGamesPlayed(selected.teamId),
  ]).then(([entry, injuries, gamesPlayed]) => {
    const stats = entry.statistics.find((s) => s.team.id === selected.teamId) ?? entry.statistics[0];
    const appearances = stats.games.appearences ?? 0;
    const minutes = stats.games.minutes ?? 0;
    const rating = stats.games.rating ? Number(stats.games.rating) : null;

    return {
      player: {
        id: entry.player.id,
        name: entry.player.name,
        fullName: `${entry.player.firstname} ${entry.player.lastname}`,
        age: entry.player.age,
        nationality: entry.player.nationality,
        photo: entry.player.photo,
        positionRaw: stats.games.position,
      },
      team: stats.team,
      season: CURRENT_SEASON,
      presence: {
        appearances,
        lineups: stats.games.lineups ?? 0,
        substituteIn: stats.substitutes.in ?? 0,
        minutesPlayed: minutes,
        minutesPerAppearance: appearances > 0 ? Math.round(minutes / appearances) : null,
        attendanceRate: gamesPlayed ? Math.round((appearances / gamesPlayed) * 100) / 100 : null,
      },
      performance: {
        goals: stats.goals.total ?? 0,
        assists: stats.goals.assists,
        goalsPer90: minutes > 0 ? Math.round(((stats.goals.total ?? 0) / minutes) * 90 * 100) / 100 : null,
        shotsTotal: stats.shots.total,
        shotsOnTarget: stats.shots.on,
        keyPasses: stats.passes.key,
        dribblesSuccess: stats.dribbles.success,
        tacklesTotal: stats.tackles.total,
        duelsWonRate:
          stats.duels.total && stats.duels.won
            ? Math.round((stats.duels.won / stats.duels.total) * 100) / 100
            : null,
        foulsCommitted: stats.fouls.committed,
        yellowCards: stats.cards.yellow ?? 0,
        redCards: stats.cards.red ?? 0,
        seasonRating: rating,
      },
      injuries: {
        isCurrentlyInjured: entry.player.injured,
        history: injuries.map((i) => ({
          date: i.fixture.date,
          type: i.player.type,
          reason: i.player.reason,
          team: i.team.name,
          fixtureId: i.fixture.id,
        })),
      },
    };
  });
}

// --- /api/dashboard : doit renvoyer le type Player exact déjà consommé par le front ---

/**
 * IMPORTANT : les champs note, probabilityToPlay, iaJustification, recentNotes,
 * styleTags, lastMatches et comparison NE SONT PAS des données API-FOOTBALL.
 * Ce sont des concepts produit à définir avec Romain.
 */
function toDashboardPlayer(stats: PlayerFootballStats, selected: SelectedPlayer): Player {
  const { short, long } = mapPosition(stats.player.positionRaw);
  const rating = stats.performance.seasonRating ?? 0;
  const attendance = stats.presence.attendanceRate ?? 0;

  const probabilityToPlay = stats.injuries.isCurrentlyInjured
    ? 5
    : Math.round(Math.min(1, attendance + 0.1) * 100);

  return {
    id: String(stats.player.id),
    name: stats.player.name,
    fullName: stats.player.fullName,
    age: stats.player.age,
    country: stats.player.nationality,
    position: short,
    positionLong: long,
    team: selected.club,
    teamLogoUrl: stats.team.logo,
    avatarUrl: stats.player.photo,
    form: Math.round(rating * 10) / 10,
    note: Math.round(rating * 10) / 10,
    goals: stats.performance.goals,
    assists: stats.performance.assists ?? undefined,
    starts: `${stats.presence.lineups}/${stats.presence.appearances}`,
    minPerMatch: stats.presence.minutesPerAppearance ? String(stats.presence.minutesPerAppearance) : "0",
    goalsPer90: stats.performance.goalsPer90 ?? 0,
    probabilityToPlay,
    iaJustification: "",
    recentNotes: [],
    styleTags: [],
    lastMatches: [],
    comparison: { alternativeName: "", stats: [], impact: "" },
  };
}

export interface DashboardPayload {
  topPlayers: Player[];
}

export function getDashboard(): Promise<DashboardPayload> {
  return Promise.allSettled(
    SELECTED_PLAYERS.map((selected) =>
      getPlayerFootballStats(selected.apiFootballId).then((stats) => toDashboardPlayer(stats, selected)),
    ),
  ).then((results) => {
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `getDashboard: échec pour ${SELECTED_PLAYERS[i].displayName} (${SELECTED_PLAYERS[i].apiFootballId}) :`,
          r.reason instanceof Error ? r.reason.message : r.reason,
        );
      }
    });

    const topPlayers = results
      .filter((r): r is PromiseFulfilledResult<Player> => r.status === "fulfilled")
      .map((r) => r.value);

    return { topPlayers };
  });
}