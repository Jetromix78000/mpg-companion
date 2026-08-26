import { Router } from "express";
import dotenv from "dotenv";
import { lastNameToken, normalizeText } from "../../shared/search";
import { InjuryStatus, type InjuryItem } from "../../shared/types";
import { rememberPhoto } from "../photoCache";
import { createDiskCache } from "../diskCache";

dotenv.config({ quiet: true });

const injuriesRouter = Router();
const API_FOOTBALL_MANAGER = process.env.API_FOOTBALL_MANAGER?.trim() ?? "";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const INJURIES_URL = "https://v3.football.api-sports.io/injuries?league=61&season=2024";

/** Comparés sur le nom de famille normalisé. L'API renvoie des noms abrégés sans accent. */
const TRACKED_PLAYERS = [
  "Dembele", // Paris Saint Germain
  "David", // Lille
  "Lacazette", // Lyon
  "Emegha", // Strasbourg
  "Gouiri", // Marseille
  "Ajorque", // Stade Brestois 29
];

/** Nombre maximum de cartes renvoyées au front. */
const MAX_RESULTS = 10;

/** Une entrée de la réponse API Football. */
interface ApiFootballInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string; logo: string };
  fixture: { date: string };
}
/** Le corps JSON complet renvoyé par API Football. */
interface ApiFootballBody {
  errors: string[] | Record<string, string>;
  response: ApiFootballInjury[];
}

/** L'API abrège en "Initiale. Nom" : on compare le dernier mot, pas une sous-chaîne
 *  ("David Luiz" ne doit pas matcher "David").
 */
function isTracked(apiName: string): boolean {
  const surname = lastNameToken(apiName);
  return TRACKED_PLAYERS.some((player) => normalizeText(player) === surname);
}

/** `player.type` ne vaut que "Missing Fixture"/"Questionable", le vrai motif est `player.reason`. */
function readStatus(injury: ApiFootballInjury): InjuryStatus {
  const reason = normalizeText(injury.player.reason);

  if (reason.includes("card") || reason.includes("suspend")) return InjuryStatus.Suspendu;
  if (injury.player.type === "Questionable") return InjuryStatus.Incertain;

  return InjuryStatus.Absent;
}

/** "2025-05-10T18:45:00+00:00" → "10/05/2025". */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

interface InjuriesPayload {
  injuries: InjuryItem[];
  clubs: string[];
}
/** Logique
 * 1. Un seul appel API Football (/injuries?league=61&season=2024), en 4 étapes :
 * 2. Si le HTTP n'est pas 2xx, ou si `response` n'est pas un tableau (l'API a changé), on lève une exception.
 * 3. L'API renvoie une ligne par match manqué (2460 lignes pour 400 joueurs)
 * 4. On construit les cartes affichées côté front, limitées à MAX_RESULTS.
 */
function fetchInjuries(): Promise<InjuriesPayload> {
  return fetch(INJURIES_URL, {
    headers: { "x-apisports-key": API_FOOTBALL_MANAGER },
    signal: AbortSignal.timeout(10_000), // Fetch attend indéfiniment si API Football ne répond pas. Ajout d'un timeout côté serveur pour protéger le front (qui n'a pas de timeout côté fetch).
  })
    .then((response) => {
      /**
       * Sur un non-2xx (clé invalide = 403), API Football renvoie quand même du
       * JSON : on le lit pour remonter son message plutôt qu'un code sec.
       * Le .catch couvre le cas où le corps n'est pas du JSON (page d'erreur HTML).
       */
      if (!response.ok) {
        return response
          .json()
          .catch(() => null)
          .then((body: ApiFootballBody | null) => {
            throw new Error(
              `Erreur API Football (HTTP ${response.status}) : ${JSON.stringify(body?.errors)}`,
            );
          });
      }

      return response.json() as Promise<ApiFootballBody>;
    })
    .then((data) => {
      /**
       * L'API renvoie un JSON avec `response` et `errors`. Si `errors` est rempli, on lève une exception.
       * Le typage n'est qu'une promesse faite à TypeScript : on vérifie la forme réelle avant de s'en servir, sinon une API qui change fait planter la boucle.
       */
      if (!data || typeof data !== "object") {
        throw new Error("Réponse API Football malformée : pas d'objet JSON");
      }

      if (!Array.isArray(data.response)) {
        throw new Error("Réponse API Football malformée : `response` n'est pas un tableau");
      }

      // Quota dépassé ou clé invalide : l'API répond 200 avec "errors" rempli.
      const errors = data.errors ?? [];
      const errorCount = Array.isArray(errors) ? errors.length : Object.keys(errors).length;
      if (errorCount > 0) {
        throw new Error(`API Football a répondu une erreur : ${JSON.stringify(errors)}`);
      }

      /**
       * L'API renvoie une ligne par match manqué (2460 lignes pour 400 joueurs) : on ne
       * On garde qu'une entrée par joueur suivi, la plus récente, et on compte les autres.
       */
      const byPlayer = new Map<number, { injury: ApiFootballInjury; missedMatches: number }>();

      for (const injury of data.response) {
        if (!isTracked(injury.player.name)) continue;

        const known = byPlayer.get(injury.player.id);

        if (!known) {
          byPlayer.set(injury.player.id, { injury, missedMatches: 1 });
          continue;
        }

        known.missedMatches += 1;

        // Dates toutes en UTC, donc comparables telles quelles.
        if (injury.fixture.date > known.injury.fixture.date) {
          known.injury = injury;
        }
      }

      const injuries: InjuryItem[] = [];

      for (const { injury, missedMatches } of byPlayer.values()) {
        rememberPhoto(lastNameToken(injury.player.name), injury.player.photo);

        injuries.push({
          id: String(injury.player.id),
          playerName: injury.player.name,
          avatarUrl: injury.player.photo,
          clubName: injury.team.name,
          clubLogoUrl: injury.team.logo,
          league: "Ligue 1",
          type: injury.player.reason,
          detail: `${missedMatches} match(s) manqué(s), dernier le ${formatDate(injury.fixture.date)}`,
          estimatedReturn: "Inconnu",
          status: readStatus(injury),
          confidence: 100,
        });
      }

      const shown = injuries.slice(0, MAX_RESULTS);
      const clubs = ["Tous les clubs", ...new Set(shown.map((injury) => injury.clubName))];

      return { injuries: shown, clubs };
    });
}

const cache = createDiskCache("injuries.json", CACHE_TTL_MS, fetchInjuries);

/** Logique
 * GET /api/injuries, en 3 cas (même logique que /api/transfers) :
 * 1. Cache absent (premier démarrage) : on attend le fetch avant de répondre.
 * 2. Cache présent et frais (< 6h) : on le sert tel quel, aucun appel à l'API.
 * 3. Cache présent mais périmé : on le sert quand même, et on relance un fetch en
 * 4. Arrière-plan pour la prochaine visite — le client n'attend jamais.
 */
injuriesRouter.get("/", async (req, res) => {
  if (!API_FOOTBALL_MANAGER) {
    res.status(503).json({ error: "API_FOOTBALL_MANAGER non configuré" });
    return;
  }

  const cached = await cache.get();

  if (cached) {
    if (cached.stale) {
      cache.refresh().catch((error: unknown) => {
        console.error(`Rafraîchissement blessures échoué :`, error);
      });
    }
    res.json(cached.data);
    return;
  }

  cache
    .refresh()
    .then((payload) => res.json(payload))
    .catch((error: unknown) => {
      console.error(`Erreur sur ${req.method} ${req.originalUrl} :`, error);
      res
        .status(504)
        .json({ error: "Les données de football sont actuellement indisponibles ..." });
    });
});

export default injuriesRouter;
