import { Router } from "express";
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

export default router;
