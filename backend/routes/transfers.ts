import { Router } from "express";
import dotenv from "dotenv";
import { lastNameToken, normalizeText } from "../../shared/search";
import type { TransferMovement } from "../../shared/types";
import { getPhoto } from "../photoCache";
import { createDiskCache } from "../diskCache";

dotenv.config({ quiet: true });

/** /transfers n'accepte que `team`/`player`, jamais `league` : on liste les clubs Ligue 1 suivis, puis leurs transferts un par un. */
const router = Router();

const API_FOOTBALL_MANAGER = process.env.API_FOOTBALL_MANAGER?.trim() ?? "";
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

/** L'API abrège en "Initiale. Nom" : on compare le dernier mot, pas une sous-chaîne. */
function isTracked(name: string): boolean {
  const surname = lastNameToken(name);
  return TRACKED_PLAYERS.some((player) => normalizeText(player) === surname);
}
/** Cache sur disque : plan Free = 100 req/jour, et tsx redémarre à chaque save. */
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
    "Free agent": "Transfert libre", Free: "Transfert libre", Loan: "Prêt",
    "Return from loan": "Retour de prêt", Transfer: "Transfert sec", Raise: "Levée d'option",
  };

  return { amount: "—", description: labels[type] ?? type };
}
/**
 * GET authentifié sur API Football, en 3 étapes :
 * 1. On envoie la requête avec la clé dans l'en-tête `x-apisports-key`.
 * 2. Si le HTTP n'est pas 2xx (clé invalide, etc.), on lève une erreur avec le détail.
 * 3. Même en 200, l'API peut renvoyer `errors` rempli (quota dépassé, saison hors plan) —
 *    on vérifie ce champ et on lève aussi dans ce cas. Sinon, on renvoie `response`.
 */
function apiFootballGet<T>(url: string): Promise<T[]> {
  return fetch(url, {
    headers: { "x-apisports-key": API_FOOTBALL_MANAGER },
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
/**
 * Aplatit les transferts de tous les clubs en une seule liste, en 3 étapes :
 * 1. Pour chaque club, on ne garde que les joueurs suivis (TRACKED_PLAYERS).
 * 2. Pour chaque transfert de ce joueur, on ignore les mouvements incomplets (pas de
 *    date, ou un club sans nom — une carte "X ➔ Y" sans Y n'a rien à afficher).
 * 3. On déduplique par joueur + trajet + mois : un transfert entre deux clubs de
 *    Ligue 1 apparaît côté sortant ET entrant, et l'API réenregistre parfois le même
 *    mouvement à un jour d'écart.
 */
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
/**
 * 1. On demande à l'API la liste de tous les clubs de Ligue 1.
 * 2. On ne garde que les clubs où jouent nos joueurs suivis (TRACKED_CLUBS) — pas la peine d'interroger les 18 clubs si on n'en suit que 6.
 * 3. Pour chaque club gardé, on demande ses transferts (endpoint `/transfers?team=`).
 */
async function fetchAllTransfers(): Promise<TransferMovement[]> {
  const teams = await apiFootballGet<ApiFootballTeam>(TEAMS_URL);
  const trackedTeams = teams.filter(({ team }) =>
    TRACKED_CLUBS.some((club) => normalizeText(team.name).includes(normalizeText(club))),
  );

  /**
   * Un `await` par club, jamais `Promise.all` : le plan Free tolère 10 req/min, donc les
   * appels parallèles surchargeraient. `sleep` espace le suivant ; `apiFootballGet` renvoie
   * déjà un tableau par club, d'où le spread pour aplatir dans `entries`.
   */
  const entries: ApiFootballTransferEntry[] = [];
  for (const { team } of trackedTeams) {
    entries.push(...(await apiFootballGet<ApiFootballTransferEntry>(transferUrl(team.id))));
    await sleep(REQUEST_DELAY_MS);
  }

  return mapTransfers(entries);
}
const cache = createDiskCache("transfers.json", CACHE_TTL_MS, fetchAllTransfers);
/**
 * GET /api/transfers, en 3 cas :
 * 1. Cache absent (premier démarrage) : on attend la reconstruction complète (~2min20)
 *    avant de répondre — pas d'autre choix, il n'y a encore rien à servir.
 * 2. Cache présent et frais (< 6h) : on le sert tel quel, aucun appel à l'API.
 * 3. Cache présent mais périmé : on le sert quand même (le client n'attend jamais),
 *    et on relance une reconstruction en arrière-plan pour la prochaine visite.
 */
router.get("/", async (req, res) => {
  if (!API_FOOTBALL_MANAGER) {
    res.status(503).json({ error: "API_FOOTBALL_MANAGER non configuré" });
    return;
  }

  const cached = await cache.get();

  if (cached) {
    if (cached.stale) {
      cache.refresh().catch((error: unknown) => {
        console.error(`Rafraîchissement transferts échoué :`, error);
      });
    }
    res.json({ transfers: cached.data });
    return;
  }

  cache
    .refresh()
    .then((transfers) => res.json({ transfers }))
    .catch((error: unknown) => {
      console.error(`Erreur sur ${req.method} ${req.originalUrl} :`, error);
      res.status(504).json({ error: "API Football injoignable" });
    });
});

export default router;
