import { Router } from "express";
import dotenv from "dotenv";
import { lastNameToken, normalizeText } from "../../shared/search";
import { InjuryStatus, type InjuryItem } from "../../shared/types";
import { rememberPhoto } from "../photoCache";

dotenv.config({ quiet: true });

/**
 * Centre des blessures. Monté sur "/api/injuries" dans app.ts.
 * Les chemins ici sont relatifs : `get("/")` répond à GET /api/injuries.
 */
const injuriesRouter = Router();

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? "";

/**
 * Filtres de l'endpoint /injuries. `season` est obligatoire avec `league`.
 * Tester : curl -H "x-apisports-key: VOTRE_CLE" "<url>"
 *
 *   ligue + saison   https://v3.football.api-sports.io/injuries?league=61&season=2024
 *   équipe + saison  https://v3.football.api-sports.io/injuries?team=85&season=2024
 *   joueur + saison  https://v3.football.api-sports.io/injuries?player=276&season=2024
 *   match            https://v3.football.api-sports.io/injuries?fixture=1213754
 *   date             https://v3.football.api-sports.io/injuries?date=2025-05-10
 */
const INJURIES_URL = "https://v3.football.api-sports.io/injuries?league=61&season=2024";

/**
 * Joueurs affichés, comparés sur le nom de famille normalisé.
 * L'API renvoie des noms abrégés sans accent : "O. Dembele", pas "Ousmane Dembélé".
 */
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
 *  ("David Luiz" ne doit pas matcher "David"). */
function isTracked(apiName: string): boolean {
  const surname = lastNameToken(apiName);
  return TRACKED_PLAYERS.some((player) => normalizeText(player) === surname);
}

/**
 * Statut affichable. `player.type` ne vaut que "Missing Fixture" ou "Questionable",
 * le vrai motif est dans `player.reason` ("Muscle Injury", "Yellow Cards"...).
 */
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

/**
 * GET /api/injuries — une seule requête API Football, pas de mock.
 * Renvoie les joueurs de TRACKED_PLAYERS et la liste des clubs du filtre.
 */
injuriesRouter.get("/", (req, res) => {
  if (!API_FOOTBALL_KEY) {
    res.status(503).json({ error: "API_FOOTBALL_KEY non configuré" });
    return;
  }

  // GET - Récupère les blessures Ligue 1 saison 2024 chez API Football
  fetch(INJURIES_URL, {
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
          .then((body: ApiFootballBody | null) => {
            console.error(`Erreur API Football (HTTP ${response.status}) :`, body?.errors);
            res
              .status(response.status)
              .json({ error: "Les données de football sont actuellement indisponibles ..." });
            return null; // stoppe la suite : le .then d'après ne fera rien
          });
      }

      return response.json() as Promise<ApiFootballBody>;
    })
    .then((data) => {
      if (!data) return; // réponse déjà envoyée juste au-dessus

      // Le typage n'est qu'une promesse faite à TypeScript : on vérifie la forme
      // réelle avant de s'en servir, sinon une API qui change fait planter la boucle.
      if (!Array.isArray(data.response)) {
        res.status(502).json({ error: "Les données de football sont actuellement indisponibles ..." });
        return;
      }

      // Quota dépassé ou clé invalide : l'API répond 200 avec "errors" rempli.
      const errors = data.errors ?? [];
      const errorCount = Array.isArray(errors) ? errors.length : Object.keys(errors).length;

      if (errorCount > 0) {
        // Le détail (quota, compte suspendu) reste dans les logs : côté client on
        // ne montre qu'un message lisible.
        console.error("API Football a répondu une erreur :", errors);
        res.status(502).json({ error: "Les données de football sont actuellement indisponibles ..." });
        return;
      }

      // L'API écrit une ligne par match manqué (2460 lignes pour 400 joueurs).
      // On garde une entrée par joueur, la plus récente, et on compte les autres.
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

      // Le filtre du front ne propose que les clubs réellement présents.
      const clubs = ["Tous les clubs", ...new Set(shown.map((injury) => injury.clubName))];

      res.json({ injuries: shown, clubs });
    })
    .catch((error: unknown) => {
      // Attrape tout ce qui casse au-dessus : réseau coupé, JSON illisible, bug du code.
      console.error(`Erreur sur ${req.method} ${req.originalUrl} :`, error);

      res.status(504).json({ error: "Les données de football sont actuellement indisponibles ..." });
    });
});

export default injuriesRouter;
