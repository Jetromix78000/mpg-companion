import fs from "fs/promises";
import path from "path";
import { Router } from "express";
import dotenv from "dotenv";
import type { TransferMovement } from "../../shared/types";

dotenv.config({ quiet: true });

const router = Router();

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? "";

const LIGUE_1_LEAGUE_ID = 61;

/**
 * L'endpoint /transfers n'accepte que `team` ou `player`, jamais `league` :
 * passer `league=61` renvoie une réponse vide sans erreur HTTP. Il faut donc
 * lister les clubs de Ligue 1, puis interroger les transferts club par club.
 *
 * La liste des clubs vient de la saison 2024 : le plan Free d'API Football
 * refuse tout ce qui dépasse ("Free plans do not have access to this season,
 * try from 2022 to 2024"). L'effectif est donc celui de 2024/2025, mais les
 * transferts renvoyés par /transfers?team= couvrent bien toute l'histoire du
 * club, 2026 compris.
 */
const TEAMS_SEASON = 2024;

/**
 * Plan Free : 100 requêtes par jour. Un rafraîchissement complet en coûte 20
 * (1 pour les clubs + 19 pour les transferts), et `tsx` relance le serveur à
 * chaque sauvegarde — un cache en mémoire seul viderait le quota en trois
 * redémarrages. D'où le cache sur disque, qui survit aux relances.
 */
const CACHE_FILE = path.join(process.cwd(), ".cache", "transfers.json");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Le plan Free plafonne aussi à 10 requêtes par minute (en-tête
 * `x-ratelimit-limit`), au-delà l'API répond 200 avec `errors.rateLimit`.
 * On espace donc les appels : 20 requêtes prennent un peu plus de deux minutes,
 * d'où le rafraîchissement en arrière-plan plus bas.
 */
const MIN_REQUEST_INTERVAL_MS = 7_000;

interface ApiFootballTeamRef {
  id: number;
  name: string;
  logo: string;
}

interface ApiFootballTeamEntry {
  team: ApiFootballTeamRef;
}

/**
 * Sur /transfers, un club peut arriver incomplet : soit sans identifiant ni
 * écusson (`{ id: null, name: "Juventus FC", logo: null }`), soit entièrement
 * vide. Le typer en `| null` évite de propager des `fromTeam: null` jusqu'au front.
 */
interface ApiFootballTransferTeamRef {
  id: number | null;
  name: string | null;
  logo: string | null;
}

interface ApiFootballTransfer {
  date: string;
  type: string | null;
  teams: { in: ApiFootballTransferTeamRef | null; out: ApiFootballTransferTeamRef | null };
}

interface ApiFootballTransferEntry {
  player: { id: number; name: string };
  transfers: ApiFootballTransfer[];
}

/** Erreur portant le statut HTTP à renvoyer au client. */
class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * File d'attente d'un seul créneau à la fois : chaque appel réserve le suivant,
 * ce qui espace les requêtes sans avoir à compter les fenêtres glissantes.
 */
let nextRequestSlot = 0;

async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextRequestSlot);
  nextRequestSlot = slot + MIN_REQUEST_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
}

/**
 * Appel API Football. Les erreurs métier arrivent en HTTP 200 avec un objet
 * `errors` rempli (quota dépassé, débit dépassé, saison hors plan) : les ignorer
 * donnerait une liste vide silencieuse, comme avec `league=61` sur /transfers.
 */
async function apiFootballFetch<T>(endpoint: string, retriesLeft = 1): Promise<T[]> {
  await waitForSlot();

  let response: Response;
  try {
    response = await fetch(`${API_FOOTBALL_BASE_URL}${endpoint}`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error: unknown) {
    throw new ApiFootballError(
      `API Football injoignable : ${error instanceof Error ? error.message : String(error)}`,
      504,
    );
  }

  if (response.status === 429) {
    if (retriesLeft <= 0) throw new ApiFootballError("Débit API Football dépassé", 429);
    await sleep(60_000);
    return apiFootballFetch<T>(endpoint, retriesLeft - 1);
  }

  if (!response.ok) {
    throw new ApiFootballError(`Erreur API Football (HTTP ${response.status})`, response.status);
  }

  const body = (await response.json()) as { response?: T[]; errors?: unknown };

  // `errors` est [] quand tout va bien, un objet { champ: message } sinon.
  const errors = body.errors;
  if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
    const detail = Object.values(errors as Record<string, string>).join(" ; ");

    // Débit dépassé : on laisse passer une minute plutôt que d'abandonner la
    // construction du cache en cours de route.
    if (/too many requests/i.test(detail) && retriesLeft > 0) {
      await sleep(60_000);
      return apiFootballFetch<T>(endpoint, retriesLeft - 1);
    }

    throw new ApiFootballError(`API Football : ${detail}`, 502);
  }

  return body.response ?? [];
}

/** Écart en jours entre deux dates ISO (YYYY-MM-DD). */
function daysBetween(from: string, to: string): number {
  return Math.abs(Date.parse(to) - Date.parse(from)) / 86_400_000;
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

/**
 * `type` vaut soit un montant ("€ 60M"), soit un libellé ("Free agent", "Loan",
 * "Return from loan"). On sépare les deux : le montant va dans `amount`, le
 * libellé dans `description`.
 */
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

/**
 * Aplatit, déduplique et convertit les réponses API Football.
 *
 * Deux sources de doublons :
 *  - un mouvement entre deux clubs de Ligue 1 apparaît dans la réponse des deux
 *    clubs, à l'identique ;
 *  - API Football enregistre souvent le même mouvement sur deux dates
 *    consécutives (Kolo Muani au 31/07 *et* au 01/08). L'écart pouvant franchir
 *    un changement de mois, on compare des dates, pas des chaînes.
 */
function mapTransfers(entries: ApiFootballTransferEntry[]): TransferMovement[] {
  /**
   * Mouvement déjà validé. On extrait les champs nullables du brut d'API une
   * seule fois, au moment du contrôle : le regroupement se fait sur deux boucles,
   * et un test sur `movement.teams.in` dans la première ne restreindrait pas le
   * type dans la seconde. Transporter les valeurs plutôt que l'objet brut évite
   * autant les assertions `!` que les re-tests.
   */
  interface Row {
    playerName: string;
    date: string;
    type: string | null;
    fromTeam: string;
    toTeam: string;
    fromTeamLogo: string | null;
    toTeamLogo: string | null;
  }

  // Regroupe par joueur + trajet, pour ne comparer les dates qu'entre mouvements
  // réellement identiques. Un aller-retour en prêt des années plus tard reste
  // deux mouvements distincts.
  const byRoute = new Map<string, Row[]>();

  for (const entry of entries) {
    for (const movement of entry.transfers) {
      const from = movement.teams?.out;
      const to = movement.teams?.in;

      // Sans nom des deux clubs, la carte « X ➔ Y » n'a rien à afficher :
      // on écarte le mouvement plutôt que de rendre une flèche vers du vide.
      if (!movement.date || !from?.name || !to?.name) continue;

      const route = `${entry.player.id}-${from.id}-${to.id}`;
      const row: Row = {
        playerName: entry.player.name,
        date: movement.date,
        type: movement.type,
        fromTeam: from.name,
        toTeam: to.name,
        fromTeamLogo: from.logo,
        toTeamLogo: to.logo,
      };

      const rows = byRoute.get(route);
      if (rows) rows.push(row);
      else byRoute.set(route, [row]);
    }
  }

  const transfers: TransferMovement[] = [];

  for (const [route, rows] of byRoute) {
    rows.sort((a, b) => a.date.localeCompare(b.date));

    let previousDate: string | null = null;
    for (const row of rows) {
      // Même trajet à un ou deux jours d'intervalle : c'est le même transfert,
      // ré-enregistré par l'API. On ne garde que la première occurrence.
      if (previousDate && daysBetween(previousDate, row.date) <= 2) continue;
      previousDate = row.date;

      const { amount, description } = describeTransfer(row.type);

      transfers.push({
        // Clé unique et stable pour le rendu de liste côté front : le seul
        // identifiant joueur ne suffit pas, un joueur a plusieurs transferts.
        id: `${route}-${row.date}`,
        playerName: row.playerName,
        avatarUrl: "", // API Football ne renvoie pas de photo ici : PlayerAvatar affiche les initiales.
        fromTeam: row.fromTeam,
        toTeam: row.toTeam,
        // Le contrat front déclare ces champs optionnels : `undefined`, pas `null`.
        fromTeamLogo: row.fromTeamLogo ?? undefined,
        toTeamLogo: row.toTeamLogo ?? undefined,
        description,
        amount,
        time: formatFrenchDate(row.date),
        date: row.date,
        // API Football ne publie que des transferts actés : pas d'équivalent
        // aux types "Rumor" et "Prolongation" du contrat de réponse.
        type: "Official",
      });
    }
  }

  return transfers.sort((a, b) => b.date.localeCompare(a.date));
}

/** Un club de Ligue 1 = un appel /transfers?team={id}. */
async function fetchAllTransfers(): Promise<TransferMovement[]> {
  const teams = await apiFootballFetch<ApiFootballTeamEntry>(
    `/teams?league=${LIGUE_1_LEAGUE_ID}&season=${TEAMS_SEASON}`,
  );

  if (teams.length === 0) {
    throw new ApiFootballError("Aucun club de Ligue 1 renvoyé par API Football", 502);
  }

  // Séquentiel : waitForSlot() espace déjà les appels, paralléliser ne ferait
  // que déclencher le plafond de débit.
  const entries: ApiFootballTransferEntry[] = [];
  for (const { team } of teams) {
    entries.push(...(await apiFootballFetch<ApiFootballTransferEntry>(`/transfers?team=${team.id}`)));
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
    return null; // Absent ou illisible : on rafraîchira.
  }
}

async function writeCache(transfers: TransferMovement[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), transfers }));
  } catch (error: unknown) {
    // Le cache est une optimisation de quota, pas une dépendance : on continue.
    console.warn("Cache transferts non écrit :", error instanceof Error ? error.message : error);
  }
}

/**
 * Une seule construction à la fois : sans ce garde, deux onglets ouverts en même
 * temps lanceraient deux rafraîchissements et doubleraient la consommation.
 */
let refreshInFlight: Promise<TransferMovement[]> | null = null;

function refreshCache(): Promise<TransferMovement[]> {
  refreshInFlight ??= fetchAllTransfers()
    .then(async (transfers) => {
      await writeCache(transfers);
      console.log(`Transferts Ligue 1 rafraîchis : ${transfers.length} mouvements.`);
      return transfers;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

/**
 * Tous les transferts des clubs de Ligue 1, sans filtre de date — le front
 * choisit sa fenêtre (voir frontend/components/MarketView.tsx).
 *
 * Une reconstruction complète dure plus de deux minutes à cause du plafond de
 * débit : on ne fait jamais attendre le client. Tant qu'un cache existe il est
 * servi tel quel, même périmé, et le rafraîchissement se fait en arrière-plan.
 */
router.get("/", async (_req, res) => {
  if (!API_FOOTBALL_KEY) {
    return res.status(503).json({ error: "API_FOOTBALL_KEY non configuré" });
  }

  const cached = await readCache();

  if (cached) {
    if (Date.now() - cached.fetchedAt >= CACHE_TTL_MS) {
      // Périmé : on sert quand même, et on reconstruit pour la prochaine fois.
      refreshCache().catch((error: unknown) => {
        console.warn(
          "Rafraîchissement des transferts impossible, cache périmé conservé :",
          error instanceof Error ? error.message : error,
        );
      });
    }
    return res.json({ transfers: cached.transfers });
  }

  // Premier démarrage : rien à servir. On lance la construction et on demande au
  // front de réessayer, plutôt que de tenir la requête ouverte deux minutes.
  refreshCache().catch((error: unknown) => {
    console.warn(
      "Construction du cache des transferts échouée :",
      error instanceof Error ? error.message : error,
    );
  });

  res.status(503).json({
    error:
      "Transferts en cours de récupération auprès d'API Football (environ deux minutes). Réessayez dans un instant.",
  });
});

export default router;
