import { Router } from "express";
<<<<<<< HEAD
import { asyncHandler } from "../utils/asyncHandler";
import {
  SportmonksError,
  getDefaultLeagueId,
  getLiveScores,
  getStandings,
  getTeams,
  getUpcomingFixtures,
  isSportmonksConfigured,
} from "../services/sportmonks";

const router = Router();

/** Coupe court proprement si la clé SportMonks n'est pas configurée. */
router.use((_req, res, next) => {
  if (!isSportmonksConfigured()) {
    return res
      .status(503)
      .json({ error: "Données football indisponibles : SPORTMONKS_API_TOKEN non configuré" });
  }
  next();
});

/** Convertit une erreur SportMonks en réponse HTTP cohérente plutôt que de laisser tomber sur le 500 générique. */
function handleSportmonksError(error: unknown, res: import("express").Response) {
  if (error instanceof SportmonksError) {
    console.error("Erreur SportMonks :", error.message);
    return res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
      error: "Service SportMonks momentanément indisponible",
    });
  }
  throw error;
}

/** GET /api/football/fixtures?leagueId=&days= — matchs à venir. */
router.get(
  "/fixtures",
  asyncHandler(async (req, res) => {
    const leagueId = req.query.leagueId
      ? Number.parseInt(String(req.query.leagueId), 10)
      : getDefaultLeagueId();
    const days = req.query.days ? Number.parseInt(String(req.query.days), 10) : 14;

    try {
      const fixtures = await getUpcomingFixtures(leagueId, Number.isFinite(days) ? days : 14);
      res.json({ leagueId, fixtures });
    } catch (error) {
      handleSportmonksError(error, res);
    }
  }),
);

/** GET /api/football/live?leagueId= — scores en direct. */
router.get(
  "/live",
  asyncHandler(async (req, res) => {
    const leagueId = req.query.leagueId
      ? Number.parseInt(String(req.query.leagueId), 10)
      : getDefaultLeagueId();

    try {
      const live = await getLiveScores(leagueId);
      res.json({ leagueId, live });
    } catch (error) {
      handleSportmonksError(error, res);
    }
  }),
);

/** GET /api/football/standings?leagueId= — classement de la saison en cours. */
router.get(
  "/standings",
  asyncHandler(async (req, res) => {
    const leagueId = req.query.leagueId
      ? Number.parseInt(String(req.query.leagueId), 10)
      : getDefaultLeagueId();

    try {
      const standings = await getStandings(leagueId);
      res.json({ leagueId, standings });
    } catch (error) {
      handleSportmonksError(error, res);
    }
  }),
);

/** GET /api/football/teams?leagueId= — équipes de la saison en cours. */
router.get(
  "/teams",
  asyncHandler(async (req, res) => {
    const leagueId = req.query.leagueId
      ? Number.parseInt(String(req.query.leagueId), 10)
      : getDefaultLeagueId();

    try {
      const teams = await getTeams(leagueId);
      res.json({ leagueId, teams });
    } catch (error) {
      handleSportmonksError(error, res);
    }
  }),
);

=======
import { SPORTMONKS_BASE_URL, SportmonksError, sportmonksFetchEnvelope } from "./sportmonks";

const router = Router();

/**
 * TODO // Djamal — c'est ton point d'entrée sur le projet, avec /api/dashboard.
 *
 * Seule route déjà branchée sur la vraie API : elle appelle l'endpoint le moins
 * coûteux de SportMonks pour vérifier que la clé SPORTMONKS_API_TOKEN fonctionne.
 * Commence par elle (`curl localhost:3000/api/football/health`) : sans 200 ici,
 * inutile d'attaquer les routes métier.
 *
 * À faire ensuite : ajouter les routes football dont tu as besoin, en réutilisant
 * sportmonksFetch() de ./sportmonks — toute la plomberie (auth, paramètres,
 * déballage de l'enveloppe, traduction des erreurs) est déjà écrite.
 */
router.get("/health", async (_req, res) => {
  try {
    const envelope = await sportmonksFetchEnvelope<unknown[]>("/leagues", { perPage: 1 });

    res.json({
      ok: true,
      baseUrl: SPORTMONKS_BASE_URL,
      rateLimit: envelope.rate_limit ?? null,
      subscription: envelope.subscription ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof SportmonksError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }
    throw error;
  }
});

>>>>>>> 31b5070cd4779519d2c2670f740f109635006e5f
export default router;
