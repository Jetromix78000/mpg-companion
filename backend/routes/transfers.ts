import fs from "fs/promises";
import path from "path";
import { Router } from "express";
import dotenv from "dotenv";
import { lastNameToken, normalizeText } from "../../shared/search";
import type { TransferMovement } from "../../shared/types";
import { getPhoto } from "../photoCache";

dotenv.config({ quiet: true });

/**
 * Marché des transferts. Monté sur "/api/transfers" dans app.ts.
 * /transfers n'accepte que `team` ou `player`, jamais `league` : on liste donc
 * les clubs de Ligue 1, on garde ceux des joueurs suivis, puis on appelle
 * /transfers?team= pour chacun — 7 requêtes par reconstruction au lieu de 20.
 */
const router = Router();

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? "";
const TEAMS_URL = "https://v3.football.api-sports.io/teams?league=61&season=2024";
const transferUrl = (teamId: number) => `https://v3.football.api-sports.io/transfers?team=${teamId}`;

/** Mêmes joueurs suivis que backend/routes/injuries.ts, pour alléger les requêtes. */
const TRACKED_PLAYERS = [
  "Dembele", // Paris Saint Germain
  "David", // Lille
  "Lacazette", // Lyon
  "Emegha", // Strasbourg
  "Gouiri", // Marseille
  "Ajorque", // Stade Brestois 29
];
const TRACKED_CLUBS = ["Paris Saint Germain", "Lille", "Lyon", "Strasbourg", "Marseille", "Stade Brestois"];

/** L'API abrège en "Initiale. Nom" : on compare le dernier mot, pas une sous-chaîne
 *  ("David Luiz" ne doit pas matcher "David"). */
function isTracked(name: string): boolean {
  const surname = lastNameToken(name);
  return TRACKED_PLAYERS.some((player) => normalizeText(player) === surname);
}

/** Cache sur disque : plan Free = 100 req/jour, et tsx redémarre à chaque save. */
const CACHE_FILE = path.join(process.cwd(), ".cache", "transfers.json");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Plan Free = 10 req/min : on espace les appels d'une reconstruction. */
const REQUEST_DELAY_MS = 7_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ApiFootballTeam {
  team: { id: number; name: string; logo: string };
}

/** Sur /transfers, un club peut arriver sans id ni écusson, voire vide. */
interface ApiFootballTransferTeam {
  id: number | null;
  name: string | null;
  logo: string | null;
}

interface ApiFootballTransfer {
  date: string;
  type: string | null;
  teams: { in: ApiFootballTransferTeam | null; out: ApiFootballTransferTeam | null };
}

interface ApiFootballTransferEntry {
  player: { id: number; name: string };
  transfers: ApiFootballTransfer[];
}

interface ApiFootballBody<T> {
  errors: string[] | Record<string, string>;
  response: T[];
}

/** "2026-06-29" -> "29 JUIN 2026", pour la ligne de bas de carte du front. */
const MONTHS = [
  "JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE",
];
function formatFrenchDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  const label = MONTHS[Number(month) - 1];
  return label ? `${Number(day)} ${label} ${year}` : isoDate;
}

/** `type` vaut soit un montant ("€ 60M"), soit un libellé ("Free agent", "Loan"...). */
function describeTransfer(type: string | null): { amount: string; description: string } {
  if (!type || type === "N/A") return { amount: "—", description: "Transfert" };
  if (type.startsWith("€") || type.startsWith("$") || type.startsWith("£")) {
    return { amount: type, description: "Transfert payant" };
  }

  const labels: Record<string, string> = {
    "Free agent": "Transfert libre",
    Free: "Transfert libre",
    Loan: "Prêt",
    "Return from loan": "Retour de prêt",
    Transfer: "Transfert sec",
    Raise: "Levée d'option",
  };

  return { amount: "—", description: labels[type] ?? type };
}

/** GET authentifié sur API Football. Renvoie `response`, ou lève si `errors` est rempli. */
function apiFootballGet<T>(url: string): Promise<T[]> {
  return fetch(url, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
    // Sans ça, fetch attend indéfiniment si API Football ne répond jamais.
    signal: AbortSignal.timeout(10_000),
  })
    .then((response) => {
      // Sur un non-2xx (clé invalide = 403), API Football renvoie quand même du
      // JSON : on le lit pour remonter son message plutôt qu'un code sec. Le
      // .catch couvre le cas où le corps n'est pas du JSON (page d'erreur HTML).
      if (!response.ok) {
        return response
          .json()
          .catch(() => null)
          .then((body: ApiFootballBody<T> | null) => {
            throw new Error(`Erreur API Football (HTTP ${response.status}) : ${JSON.stringify(body?.errors)}`);
          });
      }

      return response.json() as Promise<ApiFootballBody<T>>;
    })
    .then((body) => {
      // Quota dépassé, débit dépassé, saison hors plan : l'API répond 200 avec `errors` rempli.
      const errors = body.errors ?? [];
      const errorCount = Array.isArray(errors) ? errors.length : Object.keys(errors).length;
      if (errorCount > 0) throw new Error(`API Football : ${JSON.stringify(errors)}`);

      return body.response ?? [];
    });
}

/** Aplatit les transferts de tous les clubs, dédupliqué par joueur + trajet + date proche. */
function mapTransfers(entries: ApiFootballTransferEntry[]): TransferMovement[] {
  const seen = new Set<string>();
  const transfers: TransferMovement[] = [];

  for (const entry of entries) {
    if (!isTracked(entry.player.name)) continue;

    for (const movement of entry.transfers) {
      const from = movement.teams?.out;
      const to = movement.teams?.in;
      if (!movement.date || !from?.name || !to?.name) continue;

      // Même trajet le même mois : un club de Ligue 1 apparaît des deux côtés, et
      // l'API réenregistre parfois le même mouvement à un jour d'écart.
      const key = `${entry.player.id}-${from.id}-${to.id}-${movement.date.slice(0, 7)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const { amount, description } = describeTransfer(movement.type);

      transfers.push({
        id: `${entry.player.id}-${from.id}-${to.id}-${movement.date}`,
        playerName: entry.player.name,
        // Photo récupérée depuis /api/injuries si déjà visitée, sinon initiales côté front.
        avatarUrl: getPhoto(lastNameToken(entry.player.name)),
        fromTeam: from.name,
        toTeam: to.name,
        fromTeamLogo: from.logo ?? undefined,
        toTeamLogo: to.logo ?? undefined,
        description,
        amount,
        time: formatFrenchDate(movement.date),
        date: movement.date,
        type: "Official",
      });
    }
  }

  return transfers.sort((a, b) => b.date.localeCompare(a.date));
}

/** Liste les clubs de Ligue 1, garde ceux des joueurs suivis, puis leurs transferts un par un. */
async function fetchAllTransfers(): Promise<TransferMovement[]> {
  const teams = await apiFootballGet<ApiFootballTeam>(TEAMS_URL);
  const trackedTeams = teams.filter(({ team }) =>
    TRACKED_CLUBS.some((club) => normalizeText(team.name).includes(normalizeText(club))),
  );

  const entries: ApiFootballTransferEntry[] = [];
  for (const { team } of trackedTeams) {
    entries.push(...(await apiFootballGet<ApiFootballTransferEntry>(transferUrl(team.id))));
    await sleep(REQUEST_DELAY_MS);
  }

  return mapTransfers(entries);
}

interface CacheFile {
  fetchedAt: number;
  transfers: TransferMovement[];
}

async function readCache(): Promise<CacheFile | null> {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, "utf8")) as CacheFile;
  } catch {
    return null;
  }
}

async function writeCache(transfers: TransferMovement[]): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), transfers }));
}

/** Une seule reconstruction à la fois, pour ne pas doubler la consommation de quota. */
let refreshInFlight: Promise<TransferMovement[]> | null = null;
function refreshCache(): Promise<TransferMovement[]> {
  refreshInFlight ??= fetchAllTransfers()
    .then(async (transfers) => {
      await writeCache(transfers);
      return transfers;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

/**
 * GET /api/transfers — sert le cache tel quel (même périmé) et rafraîchit en
 * arrière-plan : une reconstruction complète prend plus de deux minutes.
 */
router.get("/", async (req, res) => {
  if (!API_FOOTBALL_KEY) {
    res.status(503).json({ error: "API_FOOTBALL_KEY non configuré" });
    return;
  }

  const cached = await readCache();

  if (cached) {
    if (Date.now() - cached.fetchedAt >= CACHE_TTL_MS) {
      refreshCache().catch((error: unknown) => {
        console.error(`Rafraîchissement transferts échoué :`, error);
      });
    }
    res.json({ transfers: cached.transfers });
    return;
  }

  refreshCache()
    .then((transfers) => res.json({ transfers }))
    .catch((error: unknown) => {
      console.error(`Erreur sur ${req.method} ${req.originalUrl} :`, error);
      res.status(504).json({ error: "API Football injoignable" });
    });
});

export default router;
